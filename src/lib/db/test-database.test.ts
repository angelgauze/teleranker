import { describe, expect, it } from "vitest";
import { testDatabaseName } from "./test-database";

const url = (name: string, host = "localhost:5432") =>
  `postgresql://someone:secret@${host}/${name}?schema=public`;

describe("testDatabaseName", () => {
  it("accepts a database whose name ends in _test", () => {
    expect(testDatabaseName(url("teleranker_test"), url("teleranker"))).toBe("teleranker_test");
  });

  it("refuses other database names", () => {
    expect(() => testDatabaseName(url("teleranker"))).toThrow(/ends in "_test"/);
    expect(() => testDatabaseName(url("teleranker_test; DROP"))).toThrow(/ends in "_test"/);
  });

  it("refuses the main database even if it is named _test", () => {
    expect(() => testDatabaseName(url("app_test"), url("app_test"))).toThrow(/same database/);
    expect(testDatabaseName(url("app_test"), url("app_test", "other:5432"))).toBe("app_test");
  });

  it("never echoes the password", () => {
    expect(() => testDatabaseName("not a url")).toThrow("TEST_DATABASE_URL is not a valid connection URL");
    try {
      testDatabaseName(url("teleranker"));
    } catch (error) {
      expect(String(error)).not.toContain("secret");
    }
  });
});
