import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PROVIDERS } from "../src/lib/collect/registry";
import { describeError } from "../src/lib/db/errors";
import type { OverrideImportSummary } from "../src/lib/db/repository";
import { validateOverrideSheet } from "../src/lib/manual/override-sheet";

/**
 * Override import CLI: values a person checked, applied on top of collected
 * promos.
 *
 *   pnpm import:overrides --file=<path.csv>             # check only (no database)
 *   pnpm import:overrides --file=<path.csv> --publish   # save and apply
 *
 * The file is the override sheet from `pnpm overrides:template`. Every row is
 * validated first and nothing is written if any row fails. Each provider in
 * the file has its overrides replaced by the file's and its published promos
 * updated, all in one transaction. Later collection runs apply the stored
 * overrides again.
 */

const args = process.argv.slice(2);
const valueOf = (name: string) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const hasFlag = (name: string) => args.includes(`--${name}`);

const overridable = new Set(
  PROVIDERS.filter((provider) => provider.collection === "automated").map((provider) => provider.id),
);

async function main(): Promise<number> {
  const file = valueOf("file");
  const publish = hasFlag("publish");

  if (!file) {
    console.error("[error] pass --file=<path to the override sheet CSV>");
    return 2;
  }
  if (publish && !process.env.DATABASE_URL) {
    console.error("[error] --publish requires DATABASE_URL; see .env.example");
    return 2;
  }

  const result = validateOverrideSheet(await readFile(file, "utf8"), overridable);

  if (!result.ok) {
    for (const message of result.fileErrors) console.error(`[error] ${message}`);
    for (const row of result.rowErrors) {
      console.error(`[error] line ${row.line} ${row.promoId || "(no promo_id)"}: ${row.errors.join("; ")}`);
    }
    console.error("[error] Nothing was imported. Fix the sheet and re-run.");
    return 1;
  }

  for (const set of result.providers) {
    console.log(`${set.providerId.padEnd(8)} ${String(set.overrides.length).padStart(4)} checked values`);
  }

  if (!publish) {
    console.log("Validation passed. Re-run with --publish to save and apply them.");
    return 0;
  }

  const { getPrismaClient } = await import("../src/lib/db/client");
  const { PrismaPromoRepository } = await import("../src/lib/db/prisma-repository");
  const prisma = getPrismaClient();

  try {
    let summaries: OverrideImportSummary[];
    try {
      summaries = await new PrismaPromoRepository(prisma).replaceOverrides(result.providers);
    } catch (error) {
      // One transaction for every provider: a failure means nothing changed.
      console.error(`[error] Import failed; nothing was changed: ${describeError(error).message}`);
      return 1;
    }

    for (const summary of summaries) {
      console.log(
        `${summary.providerId.padEnd(8)} SAVED      saved=${summary.saved} applied=${summary.applied} restored=${summary.restored} unmatched=${summary.unmatched.length}`,
      );
      if (summary.unmatched.length > 0) {
        console.warn(
          `         not published now (renamed or removed?): ${summary.unmatched.join(", ")}`,
        );
      }
    }
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    const described = describeError(error);
    if (described.isDatabase) console.error("[error] Unexpected failure:", described.message);
    else console.error("[error] Unexpected failure:", error);
    process.exitCode = 1;
  });
