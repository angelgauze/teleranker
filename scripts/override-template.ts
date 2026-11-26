import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { getProvider } from "../src/lib/collect/registry";
import { describeError } from "../src/lib/db/errors";
import { buildOverrideTemplate } from "../src/lib/manual/override-sheet";

/**
 * Exports the override sheet for one automatically collected provider.
 *
 *   pnpm overrides:template --provider=dito --out=<path.csv>
 *
 * One row per published promo with its ID and details filled in, and any
 * stored overrides already filled in. Fill network_support, verified_at,
 * source_url (and an optional note) for the promos you checked, then run
 * `pnpm import:overrides`. Keep the file outside this repository: no provider
 * data is committed (AGENTS.md section 7).
 */

const args = process.argv.slice(2);
const valueOf = (name: string) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

async function main(): Promise<number> {
  const providerId = valueOf("provider");
  const out = valueOf("out");

  if (!providerId || !out) {
    console.error("[error] pass --provider=<id> and --out=<path for the CSV>");
    return 2;
  }
  const provider = getProvider(providerId);
  if (!provider) {
    console.error(`[error] unknown provider "${providerId}"`);
    return 2;
  }
  if (provider.collection !== "automated") {
    console.error(
      `[error] ${provider.name} is entered by hand: its checked values go in the main promo sheet, not the override sheet`,
    );
    return 2;
  }
  if (!process.env.DATABASE_URL) {
    console.error("[error] DATABASE_URL is required; see .env.example");
    return 2;
  }

  const { getPrismaClient } = await import("../src/lib/db/client");
  const { PrismaPromoRepository } = await import("../src/lib/db/prisma-repository");
  const prisma = getPrismaClient();

  try {
    const repository = new PrismaPromoRepository(prisma);
    const [candidates, overrides] = await Promise.all([
      repository.listOverrideCandidates(provider.id),
      repository.listOverrides(provider.id),
    ]);

    if (candidates.length === 0 && overrides.length === 0) {
      console.error(`[error] ${provider.name} has no published collected promos yet; run its scrape first`);
      return 1;
    }

    const csv = buildOverrideTemplate({
      providerId: provider.id,
      candidates,
      overrides,
      fallbackSourceUrl: provider.promoPageUrl,
    });
    // The byte-order mark lets spreadsheet apps read the file as UTF-8.
    await writeFile(out, "﻿" + csv, "utf8");

    console.log(
      `Wrote ${out}: ${candidates.length} published promos, ${overrides.length} stored overrides.`,
    );
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
