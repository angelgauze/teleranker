import "dotenv/config";
import { readFile } from "node:fs/promises";
import { createConsoleAlertSink } from "../src/lib/collect/alerts";
import { createPageFetcher } from "../src/lib/collect/http";
import {
  getAutomatedProviders,
  getProvider,
  providerSeed,
  type ProviderConfig,
} from "../src/lib/collect/registry";
import { runProviderSafely } from "../src/lib/collect/persist";
import { describeError } from "../src/lib/db/errors";
import type { FetchPage, Logger, RunReport } from "../src/lib/collect/types";

/**
 * Collection CLI.
 *
 *   pnpm scrape --provider=dito --live                 # fetch, validate, report
 *   pnpm scrape --provider=globe --live --publish      # also publish to Postgres
 *   pnpm scrape --provider=dito --fixture=path.html    # parse a saved page
 *   pnpm scrape --provider=globe --live --publish --accept-smaller-set
 *                                                      # publish a run the drop guard held back
 *
 * Safety: nothing is fetched without --live, and --publish requires --live so a
 * stale fixture can never replace published data. --accept-smaller-set is for
 * a person who has checked the provider's page and confirmed the catalogue
 * really shrank; it needs --publish and a single --provider, and is recorded
 * in the run log (docs/providers.md, "Maintenance").
 */

const args = process.argv.slice(2);
const valueOf = (name: string) =>
  args
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const hasFlag = (name: string) => args.includes(`--${name}`);

const logger: Logger = {
  info(message, meta) {
    console.log(`[info] ${message}`, meta ?? "");
  },
  warn(message, meta) {
    console.warn(`[warn] ${message}`, meta ?? "");
  },
  error(message, meta) {
    console.error(`[error] ${message}`, meta ?? "");
  },
};

function userAgent(): string {
  const contact = process.env.SCRAPER_CONTACT?.trim();
  return contact
    ? `TeleRankerBot/0.1 (${contact})`
    : "TeleRankerBot/0.1 (promo comparison research project)";
}

function printReport(report: RunReport, reason: string | undefined, persisted: boolean) {
  const status =
    report.status === "FAILED"
      ? "FAILED"
      : report.published
        ? persisted
          ? "PUBLISHED"
          : "READY"
        : "BLOCKED";
  console.log(
    `${report.providerId.padEnd(8)} ${status.padEnd(10)} collected=${report.recordsCollected} accepted=${report.recordsAccepted} rejected=${report.recordsRejected}`,
  );
  if (reason) console.log(`         reason: ${reason}`);
  if (report.override) console.log(`         override: ${report.override}`);
  for (const rejection of report.rejections.slice(0, 5)) {
    console.log(`         rejected ${rejection.name ?? "(unnamed)"}: ${rejection.reason}`);
  }
  if (report.rejections.length > 5) {
    console.log(`         ...and ${report.rejections.length - 5} more rejections`);
  }
}

async function main(): Promise<number> {
  const providerArg = valueOf("provider") ?? "all";
  const fixturePath = valueOf("fixture");
  const live = hasFlag("live");
  const publish = hasFlag("publish");
  const acceptSmallerSet = hasFlag("accept-smaller-set");

  let targets: ProviderConfig[];
  if (providerArg === "all") {
    targets = getAutomatedProviders();
  } else {
    const provider = getProvider(providerArg);
    if (!provider) {
      logger.error(`Unknown provider "${providerArg}"`, {
        known: getAutomatedProviders().map((entry) => entry.id).join(", "),
      });
      return 2;
    }
    if (provider.collection === "manual-only") {
      logger.error(`${provider.name} cannot be collected automatically`, {
        reason: provider.compliance.decision,
      });
      return 2;
    }
    targets = [provider];
  }

  if (!fixturePath && !live) {
    logger.error("Refusing to run without an explicit mode", {
      hint: "pass --live to fetch the provider pages, or --fixture=<path> to parse a saved page",
    });
    return 2;
  }

  if (fixturePath && targets.length !== 1) {
    logger.error("--fixture requires a single --provider");
    return 2;
  }

  if (publish && !live) {
    logger.error("--publish requires --live so stale fixture data cannot replace published data");
    return 2;
  }

  if (acceptSmallerSet && (!publish || providerArg === "all")) {
    logger.error("--accept-smaller-set requires --publish and a single --provider");
    return 2;
  }

  if (publish && !process.env.DATABASE_URL) {
    logger.error("--publish requires DATABASE_URL; see .env.example");
    return 2;
  }

  let fetchPage: FetchPage;
  if (fixturePath) {
    const body = await readFile(fixturePath, "utf8");
    fetchPage = async (url) => ({ url, status: 200, body });
    logger.info("Using fixture", { path: fixturePath, bytes: body.length });
  } else {
    fetchPage = createPageFetcher({ userAgent: userAgent() });
    logger.info("Live collection", { userAgent: userAgent() });
  }

  let repository: import("../src/lib/db/prisma-repository").PrismaPromoRepository | null = null;
  if (publish) {
    repository = await createRepository();
  }

  const alerts = createConsoleAlertSink(logger);
  let exitCode = 0;
  try {
    for (const target of targets) {
      if (!target.collector) {
        logger.error(`${target.name} has no collector`);
        exitCode = 1;
        continue;
      }

      // Never throws: a database error becomes a FAILED run with an alert, and
      // the loop moves on to the next provider.
      const { report, reason } = await runProviderSafely({
        provider: {
          ...providerSeed(target),
          collector: target.collector,
          sourceUrl: target.sourceUrls[0],
        },
        repository,
        acceptSmallerSet,
        fetchPage,
        alerts,
        logger,
      });

      printReport(report, reason, Boolean(repository));

      if (report.status === "FAILED" || !report.published) {
        exitCode = 1;
      }
    }
  } finally {
    if (repository) {
      const { getPrismaClient } = await import("../src/lib/db/client");
      await getPrismaClient().$disconnect();
    }
  }

  return exitCode;
}

async function createRepository() {
  const { getPrismaClient } = await import("../src/lib/db/client");
  const { PrismaPromoRepository } = await import("../src/lib/db/prisma-repository");
  return new PrismaPromoRepository(getPrismaClient());
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    // Database problems get a short message; anything else is a bug, so keep
    // the full error with its stack trace.
    const described = describeError(error);
    if (described.isDatabase) logger.error("Unexpected failure", { error: described.message });
    else console.error("[error] Unexpected failure:", error);
    process.exitCode = 1;
  });
