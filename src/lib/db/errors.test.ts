import { describe, expect, it } from "vitest";
import { describeError, errorDetail } from "./errors";

function prismaError(code: string | undefined, message: string, name = "PrismaClientKnownRequestError") {
  return Object.assign(new Error(message), { name, ...(code ? { code } : {}) });
}

// Shaped like Prisma's real message: the call, a code excerpt, then the cause.
const verbose = [
  "Invalid `prisma.promo.count()` invocation in",
  "E:\\project\\src\\lib\\db\\prisma-repository.ts:100:30",
  "  99 async countPublished() {",
  "  100   return this.prisma.promo.count(",
  "Authentication failed against the database server, the provided database credentials for `someone` are not valid",
].join("\n");

describe("describeError", () => {
  it("maps known Prisma codes to short messages without paths, code or user names", () => {
    const result = describeError(prismaError("P1000", verbose));
    expect(result).toEqual({
      message: "Database login failed (check DATABASE_URL in .env)",
      isDatabase: true,
    });
    expect(result.message).not.toMatch(/prisma-repository|someone/);
  });

  it("reads the code from initialization errors (errorCode)", () => {
    const error = Object.assign(new Error("x"), {
      name: "PrismaClientInitializationError",
      errorCode: "P1001",
    });
    expect(describeError(error).message).toBe("Database server could not be reached");
  });

  it("keeps the last line (the cause) of unmapped Prisma errors", () => {
    expect(
      describeError(prismaError("P2003", "Invalid call\n  excerpt\nForeign key constraint failed")).message,
    ).toBe("Database error P2003: Foreign key constraint failed");
    expect(
      describeError(
        prismaError(undefined, "Invalid call\nArgument `take` is missing.", "PrismaClientValidationError"),
      ),
    ).toEqual({ message: "Argument `take` is missing.", isDatabase: true });
  });

  it("treats other errors as unexpected and keeps their last line", () => {
    expect(describeError(new TypeError("boom"))).toEqual({ message: "boom", isDatabase: false });
    expect(describeError("text")).toEqual({ message: "unknown error", isDatabase: false });
  });

  it("caps long messages", () => {
    expect(describeError(new Error("x".repeat(1000))).message).toHaveLength(300);
  });

  it("prefixes run-log details by origin", () => {
    expect(errorDetail(prismaError("P2021", verbose))).toBe(
      "database error: A database table is missing (run pnpm db:migrate)",
    );
    expect(errorDetail(new Error("boom"))).toBe("unexpected error: boom");
  });
});
