/**
 * Turns errors into short, plain diagnostics for run logs, alerts and CLI
 * output.
 *
 * Prisma's own messages start with the failing call and a source-code excerpt
 * and end with the cause, so storing or truncating them hides the cause and
 * leaks file paths. Known Prisma error codes get a fixed message instead; any
 * other error keeps only the last line of its message (where the cause is).
 *
 * Detected by shape, not by importing Prisma, so the collection pipeline stays
 * independent of the storage layer.
 */

export interface DescribedError {
  message: string;
  /** True when the error came from the database layer (Prisma or its driver). */
  isDatabase: boolean;
}

const MAX_LENGTH = 300;

const PRISMA_CODES: Record<string, string> = {
  P1000: "Database login failed (check DATABASE_URL in .env)",
  P1001: "Database server could not be reached",
  P1002: "Database server timed out",
  P1003: "Database does not exist (check DATABASE_URL in .env)",
  P1008: "Database operation timed out",
  P1017: "Database server closed the connection",
  P2002: "A record with the same unique key already exists",
  P2021: "A database table is missing (run pnpm db:migrate)",
  P2022: "A database column is missing (run pnpm db:migrate)",
  P2024: "Timed out waiting for a database connection",
  P2028: "Database transaction failed or timed out",
};

function prismaCode(error: object): string | undefined {
  const code = (error as { code?: unknown }).code ?? (error as { errorCode?: unknown }).errorCode;
  return typeof code === "string" && /^P\d{4}$/.test(code) ? code : undefined;
}

function isPrismaError(error: object): boolean {
  const name = (error as { name?: unknown }).name;
  return (
    prismaCode(error) !== undefined ||
    (typeof name === "string" && (name.startsWith("PrismaClient") || name === "DriverAdapterError"))
  );
}

function lastLine(message: string): string {
  const lines = message
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return (lines[lines.length - 1] ?? "unknown error").slice(0, MAX_LENGTH);
}

export function describeError(error: unknown): DescribedError {
  if (typeof error !== "object" || error === null) {
    return { message: "unknown error", isDatabase: false };
  }

  if (isPrismaError(error)) {
    const code = prismaCode(error);
    if (code && PRISMA_CODES[code]) return { message: PRISMA_CODES[code], isDatabase: true };
    const cause = error instanceof Error ? lastLine(error.message) : "unknown error";
    return { message: code ? `Database error ${code}: ${cause}` : cause, isDatabase: true };
  }

  return {
    message: error instanceof Error ? lastLine(error.message) : "unknown error",
    isDatabase: false,
  };
}

/** "database error: …" or "unexpected error: …", for run logs and alerts. */
export function errorDetail(error: unknown): string {
  const { message, isDatabase } = describeError(error);
  return `${isDatabase ? "database error" : "unexpected error"}: ${message}`;
}
