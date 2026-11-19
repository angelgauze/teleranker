import { z } from "zod";

/**
 * Shared promo schema.
 *
 * Every record - scraped or entered by an administrator - must pass this
 * schema before it can be published. The rules here mirror `prisma/schema.prisma`
 * and the data-model guidance in AGENTS.md section 5:
 *
 * - `dataKind` describes the allowance; `dataGb` is only meaningful for TOTAL.
 * - A missing validity is `undefined`, never 0.
 * - Calls/texts use `null`/`undefined` for unknown and 0 for "none included".
 */

export const PROMO_COMPATIBILITIES = [
  "FOUR_G",
  "FIVE_G",
  "FOUR_G_AND_FIVE_G",
  "UNKNOWN",
] as const;

export const DATA_ALLOCATION_KINDS = [
  "TOTAL",
  "UNLIMITED",
  "NONE",
  "UNKNOWN",
] as const;

export const VALIDITY_UNITS = ["DAY", "WEEK", "MONTH"] as const;

export const PROMO_STATUSES = ["ACTIVE", "OUTDATED", "UNAVAILABLE"] as const;

export const promoCompatibilitySchema = z.enum(PROMO_COMPATIBILITIES);
export const dataAllocationKindSchema = z.enum(DATA_ALLOCATION_KINDS);
export const validityUnitSchema = z.enum(VALIDITY_UNITS);
export const promoStatusSchema = z.enum(PROMO_STATUSES);

export const promoInputSchema = z
  .object({
    providerId: z.string().trim().min(1).max(64),
    /** Stable key from the provider, used to match records between runs. */
    externalKey: z.string().trim().min(1).max(200).optional(),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),

    /** Integer centavos: 10000 === PHP 100.00. */
    priceCentavos: z.number().int().nonnegative(),

    dataKind: dataAllocationKindSchema,
    dataGb: z.number().positive().max(10_000).optional(),
    /** All-network portion of dataGb, when the provider publishes one. */
    allAccessGb: z.number().positive().max(10_000).optional(),
    dataNotes: z.string().trim().max(500).optional(),

    validityValue: z.number().int().positive().optional(),
    validityUnit: validityUnitSchema.optional(),

    compatibility: promoCompatibilitySchema,

    callsUnlimited: z.boolean().optional(),
    callsIncluded: z.number().int().nonnegative().optional(),
    textsUnlimited: z.boolean().optional(),
    textsIncluded: z.number().int().nonnegative().optional(),

    status: promoStatusSchema,

    /** Required by the UI when present; absent means "no official source". */
    sourceUrl: z.url().max(2048).optional(),
    lastVerifiedAt: z.date().optional(),
    sourceMetadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((promo, ctx) => {
    if (promo.dataKind === "TOTAL" && promo.dataGb === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["dataGb"],
        message: "dataGb is required when dataKind is TOTAL",
      });
    }

    if (promo.dataKind !== "TOTAL" && promo.dataGb !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["dataGb"],
        message: "dataGb is only allowed when dataKind is TOTAL",
      });
    }

    if (promo.allAccessGb !== undefined) {
      if (promo.dataKind !== "TOTAL") {
        ctx.addIssue({
          code: "custom",
          path: ["allAccessGb"],
          message: "allAccessGb is only allowed when dataKind is TOTAL",
        });
      } else if (promo.dataGb !== undefined && promo.allAccessGb > promo.dataGb) {
        ctx.addIssue({
          code: "custom",
          path: ["allAccessGb"],
          message: "allAccessGb cannot exceed the total data allocation",
        });
      }
    }

    if ((promo.validityValue === undefined) !== (promo.validityUnit === undefined)) {
      ctx.addIssue({
        code: "custom",
        path: ["validityUnit"],
        message: "validityValue and validityUnit must be provided together",
      });
    }

    if (promo.callsUnlimited === true && promo.callsIncluded !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["callsIncluded"],
        message: "callsIncluded must be omitted when calls are unlimited",
      });
    }

    if (promo.textsUnlimited === true && promo.textsIncluded !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["textsIncluded"],
        message: "textsIncluded must be omitted when texts are unlimited",
      });
    }
  });

export type PromoInput = z.infer<typeof promoInputSchema>;
export type PromoCompatibility = z.infer<typeof promoCompatibilitySchema>;
export type DataAllocationKind = z.infer<typeof dataAllocationKindSchema>;
export type ValidityUnit = z.infer<typeof validityUnitSchema>;
export type PromoStatus = z.infer<typeof promoStatusSchema>;
