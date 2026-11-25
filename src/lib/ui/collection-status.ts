import type { PromoOrigin } from "../schema/promo";
import { formatDate } from "./format";

/**
 * Public, plain-language collection status per provider (AGENTS.md §4,
 * Reliability: "inform the users whenever the information cannot be updated").
 *
 * Deliberately non-technical: it never names the blocking mechanism (bot
 * challenges, firewalls, HTTP codes). Those details live in docs/providers.md
 * and the admin-facing run log.
 */

export interface RunSummary {
  status: "RUNNING" | "SUCCEEDED" | "FAILED";
  published: boolean;
  startedAt: Date;
}

export interface CollectionStatusInput {
  providerName: string;
  /** Recorded collection runs, newest first. Empty for hand-entered providers. */
  runs: RunSummary[];
  /** Where the provider's currently listed promos came from, if any are listed. */
  origin: PromoOrigin | null;
  /** Most recent verification date among the provider's listed promos. */
  lastVerifiedAt?: Date;
}

export interface CollectionStatus {
  tone: "ok" | "paused" | "manual" | "none";
  /** Short text label, so the status never relies on colour. */
  label: string;
  detail: string;
}

const succeeded = (run: RunSummary) => run.status === "SUCCEEDED" && run.published;

export function describeCollectionStatus(input: CollectionStatusInput): CollectionStatus {
  const { providerName, runs, origin, lastVerifiedAt } = input;
  const latest = runs[0];

  if (latest && succeeded(latest)) {
    return {
      tone: "ok",
      label: "Updated automatically",
      detail: `Last checked ${formatDate(latest.startedAt)}.`,
    };
  }

  if (latest && latest.status === "SUCCEEDED") {
    // The check completed, but the publish policy held its results back.
    return {
      tone: "paused",
      label: "Update on hold",
      detail: `The latest automatic check on ${formatDate(latest.startedAt)} found big changes, so they are waiting for review. ${
        lastVerifiedAt
          ? `Showing the details last verified ${formatDate(lastVerifiedAt)}.`
          : "No verified details are available yet."
      }`,
    };
  }

  if (latest) {
    // The oldest run in the current streak of failed runs. Held-back runs
    // completed, so they end the streak like published ones.
    const firstCompleted = runs.findIndex((run) => run.status === "SUCCEEDED");
    const streak = firstCompleted === -1 ? runs : runs.slice(0, firstCompleted);
    const since = streak[streak.length - 1].startedAt;

    const showing = !lastVerifiedAt
      ? "No verified details are available yet."
      : origin === "MANUAL"
        ? `Showing details entered by hand from ${providerName}'s promo page, last checked ${formatDate(lastVerifiedAt)}.`
        : `Showing the details last verified ${formatDate(lastVerifiedAt)}.`;

    return {
      tone: "paused",
      label: "Automatic updates paused",
      detail: `Automatic checks have not completed since ${formatDate(since)}. ${showing}`,
    };
  }

  if (origin || lastVerifiedAt) {
    return {
      tone: "manual",
      label: "Entered by hand",
      detail: `From ${providerName}'s promo page${
        lastVerifiedAt ? `, last checked ${formatDate(lastVerifiedAt)}` : ""
      }.`,
    };
  }

  return {
    tone: "none",
    label: "Not published yet",
    detail: "No promos from this provider have been published yet.",
  };
}
