import { describe, expect, it } from "vitest";
import { REVIEW_BODY_MAX_LENGTH, reviewInputSchema } from "./review";

const baseReview = {
  providerId: "smart",
  body: "Signal is stable in my area.",
};

describe("reviewInputSchema", () => {
  it("accepts a review at the character limit", () => {
    const body = "a".repeat(REVIEW_BODY_MAX_LENGTH);
    expect(reviewInputSchema.safeParse({ ...baseReview, body }).success).toBe(true);
  });

  it("rejects a review over the character limit", () => {
    const body = "a".repeat(REVIEW_BODY_MAX_LENGTH + 1);
    expect(reviewInputSchema.safeParse({ ...baseReview, body }).success).toBe(false);
  });

  it("rejects an empty or whitespace-only body", () => {
    expect(reviewInputSchema.safeParse({ ...baseReview, body: "   " }).success).toBe(false);
  });

  it("treats a blank name as anonymous", () => {
    const result = reviewInputSchema.parse({ ...baseReview, displayName: "   " });
    expect(result.displayName).toBeUndefined();
  });

  it("treats a missing name as anonymous", () => {
    expect(reviewInputSchema.parse(baseReview).displayName).toBeUndefined();
  });

  it("keeps a provided name and trims it", () => {
    const result = reviewInputSchema.parse({ ...baseReview, displayName: "  Maria  " });
    expect(result.displayName).toBe("Maria");
  });

  it("rejects a provider-less review", () => {
    const { providerId: _providerId, ...rest } = baseReview;
    expect(reviewInputSchema.safeParse(rest).success).toBe(false);
  });
});
