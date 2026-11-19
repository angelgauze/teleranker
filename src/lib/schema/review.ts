import { z } from "zod";

/**
 * Review submission schema (AGENTS.md section 3, "User-submitted reviews").
 *
 * - The display name is optional; a blank or whitespace-only name is treated
 *   as anonymous and stored as `undefined`, never as an empty string.
 * - The body is limited to 400 characters after trimming.
 * - This schema must be reused on the server; client-side checks alone are
 *   not sufficient.
 */

export const REVIEW_BODY_MAX_LENGTH = 400;
export const REVIEW_NAME_MAX_LENGTH = 80;

export const reviewInputSchema = z.object({
  providerId: z.string().trim().min(1).max(64),
  displayName: z
    .string()
    .trim()
    .max(REVIEW_NAME_MAX_LENGTH)
    .optional()
    .transform((value) => (value ? value : undefined)),
  body: z.string().trim().min(1).max(REVIEW_BODY_MAX_LENGTH),
});

export type ReviewInput = z.infer<typeof reviewInputSchema>;
