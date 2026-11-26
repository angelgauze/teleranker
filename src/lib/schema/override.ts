import { z } from "zod";
import { promoCompatibilitySchema } from "./promo";

/**
 * A promo override: a value a person checked on the provider's own page,
 * applied on top of a collected promo. Matched by provider and promo key
 * (the promo's externalKey). Only compatibility can be overridden for now.
 *
 * Every override passes this schema before it is stored, like every promo
 * passes promoInputSchema.
 */
export const promoOverrideSchema = z.object({
  providerId: z.string().trim().min(1).max(64),
  externalKey: z.string().trim().min(1).max(200),
  /** "Not verified" is never an override: leave the row blank instead. */
  compatibility: promoCompatibilitySchema.exclude(["UNKNOWN"]),
  verifiedAt: z.date(),
  sourceUrl: z.url({ protocol: /^https$/ }).max(2000),
  note: z.string().trim().max(300).optional(),
});

export type PromoOverride = z.infer<typeof promoOverrideSchema>;
