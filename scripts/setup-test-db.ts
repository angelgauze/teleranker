import "dotenv/config";
import { spawnSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { describeError } from "../src/lib/db/errors";
import { testDatabaseName } from "../src/lib/db/test-database";

/**
 * Prepares the database used by `pnpm test:db`.
 *
 *   pnpm db:setup-test
 *
 * Reads TEST_DATABASE_URL from .env, creates that database on the same server
 * as DATABASE_URL if it does not exist, and applies the migrations to it
 * (prisma migrate deploy). It never touches the DATABASE_URL database's data.
 * Safe to re-run, for example after a new migration.
 */

async function main(): Promise<number> {
  const testUrl = process.env.TEST_DATABASE_URL;
  // Prefer Neon's direct URL: CREATE DATABASE cannot run through PgBouncer's
  // transaction pooling, and migrations need a session-level connection.
  const mainUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!testUrl || !mainUrl) {
    console.error("[error] set DATABASE_URL and TEST_DATABASE_URL in .env; see .env.example");
    return 2;
  }

  const name = testDatabaseName(testUrl, mainUrl); // only [a-z0-9_]+_test

  // CREATE DATABASE cannot run inside the target database, so connect to the
  // main one. Creating a database needs the CREATEDB permission.
  const admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: mainUrl }) });
  try {
    const [{ exists }] = await admin.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = ${name}) AS "exists"`;
    if (exists) {
      console.log(`Test database "${name}" already exists.`);
    } else {
      await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
      console.log(`Created test database "${name}".`);
    }
  } finally {
    await admin.$disconnect();
  }

  console.log(`Applying migrations to "${name}"...`);
  // A fixed command string (no user input), run through the shell so pnpm's
  // Windows .cmd shim resolves. Both URLs point at the test database so
  // prisma7.config.ts cannot fall back to the main branch's unpooled URL.
  const migrate = spawnSync("pnpm exec prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: testUrl, DATABASE_URL_UNPOOLED: testUrl },
    stdio: "inherit",
    shell: true,
  });
  return migrate.status ?? 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    const described = describeError(error);
    if (described.isDatabase) console.error("[error]", described.message);
    else console.error("[error]", error);
    process.exitCode = 1;
  });
