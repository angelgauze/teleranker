import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PROVIDERS, providerSeed } from "../src/lib/collect/registry";
import { describeError } from "../src/lib/db/errors";
import type { ProviderSeed } from "../src/lib/db/repository";
import { publishSheet, validateSheet } from "../src/lib/manual/import";

/**
 * Manual promo import CLI.
 *
 *   pnpm import:promos --file=<path.csv>                 # validate only (no database)
 *   pnpm import:promos --file=<path.csv> --publish       # also publish to Postgres
 *   ... --publish --replace-collected                    # allow replacing scraped promos
 *
 * The CSV is an export of the team's "Promos" sheet. Keep it outside this
 * repository: no provider data is committed (AGENTS.md section 7).
 */

const args = process.argv.slice(2);
const valueOf = (name: string) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const hasFlag = (name: string) => args.includes(`--${name}`);

const knownProviders = new Map<string, ProviderSeed>(
  PROVIDERS.map((provider) => [provider.id, providerSeed(provider)]),
);

async function main(): Promise<number> {
  const file = valueOf("file");
  const publish = hasFlag("publish");

  if (!file) {
    console.error("[error] pass --file=<path to the Promos sheet exported as CSV>");
    return 2;
  }
  if (publish && !process.env.DATABASE_URL) {
    console.error("[error] --publish requires DATABASE_URL; see .env.example");
    return 2;
  }

  const result = validateSheet(await readFile(file, "utf8"), knownProviders);

  if (!result.ok) {
    for (const message of result.fileErrors) console.error(`[error] ${message}`);
    for (const row of result.rowErrors) {
      console.error(`[error] line ${row.line} ${row.promoId || "(no promo_id)"}: ${row.errors.join("; ")}`);
    }
    console.error(
      `[error] ${result.rowErrors.length} invalid rows; nothing was imported. Fix the sheet and re-run.`,
    );
    return 1;
  }

  for (const plan of result.providers) {
    console.log(`${plan.providerId.padEnd(8)} ${String(plan.promos.length).padStart(4)} valid promos`);
  }

  if (!publish) {
    console.log("Validation passed. Re-run with --publish to write to the database.");
    return 0;
  }

  const { getPrismaClient } = await import("../src/lib/db/client");
  const { PrismaPromoRepository } = await import("../src/lib/db/prisma-repository");
  const prisma = getPrismaClient();

  try {
    let outcomes: Awaited<ReturnType<typeof publishSheet>>;
    try {
      outcomes = await publishSheet({
        plans: result.providers,
        repository: new PrismaPromoRepository(prisma),
        knownProviders,
        replaceCollected: hasFlag("replace-collected"),
      });
    } catch (error) {
      // publishSheet writes every provider in one transaction, so a failure
      // means no provider was changed.
      console.error(
        `[error] Import failed; nothing was imported for any provider: ${describeError(error).message}`,
      );
      return 1;
    }

    let exitCode = 0;
    for (const outcome of outcomes) {
      if (outcome.status === "skipped") {
        exitCode = 1;
        console.warn(`${outcome.providerId.padEnd(8)} SKIPPED    ${outcome.reason}`);
      } else {
        console.log(
          `${outcome.providerId.padEnd(8)} PUBLISHED  published=${outcome.published} markedUnavailable=${outcome.markedUnavailable}`,
        );
      }
    }
    return exitCode;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    // Database problems get a short message; anything else is a bug, so keep
    // the full error with its stack trace.
    const described = describeError(error);
    if (described.isDatabase) console.error("[error] Unexpected failure:", described.message);
    else console.error("[error] Unexpected failure:", error);
    process.exitCode = 1;
  });
