/**
 * Guard for the PostgreSQL integration tests (`pnpm test:db`) and their setup
 * script (`pnpm db:setup-test`). Those tests delete every promo and provider
 * before each case, so they must never run against the real database.
 *
 * Returns the test database's name when TEST_DATABASE_URL is safe to use:
 * its database name ends in "_test" and it is not the DATABASE_URL database.
 * Error messages name the database only, never the URL (it holds a password).
 */
export function testDatabaseName(testUrl: string, mainUrl?: string): string {
  let url: URL;
  try {
    url = new URL(testUrl);
  } catch {
    throw new Error("TEST_DATABASE_URL is not a valid connection URL");
  }

  const name = decodeURIComponent(url.pathname.slice(1));
  if (!/^[a-z0-9_]+_test$/.test(name)) {
    throw new Error(
      `TEST_DATABASE_URL must point at a database whose name ends in "_test" (got "${name}")`,
    );
  }

  if (mainUrl) {
    try {
      const main = new URL(mainUrl);
      if (main.host === url.host && main.pathname === url.pathname) {
        throw new Error("TEST_DATABASE_URL must not point at the same database as DATABASE_URL");
      }
    } catch (error) {
      if (error instanceof TypeError) return name; // DATABASE_URL unparsable: nothing to compare
      throw error;
    }
  }

  return name;
}
