import { promoInputSchema, type PromoInput } from "../schema/promo";
import { createConsoleAlertSink, type AlertSink } from "./alerts";
import {
  DEFAULT_PUBLISH_POLICY,
  evaluatePublish,
  type PublishDecision,
  type PublishPolicy,
} from "./publish";
import type { FetchPage, Logger, ProviderCollector, RunReport } from "./types";

/**
 * Runs one provider collector end to end:
 * collect -> normalise -> validate -> decide whether the run may be published.
 *
 * It never touches the database. The caller records the report and, when
 * `decision.publish` is true, replaces the published set.
 */

export interface CollectProviderOptions {
  providerId: string;
  collector: ProviderCollector;
  fetchPage: FetchPage;
  logger: Logger;
  sourceUrl: string;
  /** Baseline for the drop guard (see RunCounts.previousPublishedCount). */
  previousPublishedCount: number;
  now?: () => Date;
  policy?: PublishPolicy;
  /** See PublishOptions.acceptSmallerSet. */
  acceptSmallerSet?: boolean;
  alerts?: AlertSink;
}

export interface CollectProviderResult {
  report: RunReport;
  decision: PublishDecision;
  /** Validated promos. Only publish these when `decision.publish` is true. */
  promos: PromoInput[];
}

function describeIssues(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.map(String).join(".") || "record";
      return `${path}: ${issue.message}`;
    })
    .join("; ")
    .slice(0, 300);
}

/** Diagnostics must stay useful but never contain credentials or tokens. */
export function safeDetail(message: string): string {
  return message.replace(/\s+/g, " ").slice(0, 500);
}

export async function collectProvider(
  options: CollectProviderOptions,
): Promise<CollectProviderResult> {
  const now = options.now ?? (() => new Date());
  const alerts = options.alerts ?? createConsoleAlertSink(options.logger);
  const startedAt = now();

  try {
    const { drafts, warnings } = await options.collector.collect({
      fetchPage: options.fetchPage,
      now: startedAt,
      logger: options.logger,
    });

    for (const warning of warnings) {
      options.logger.warn(warning, { providerId: options.providerId });
    }

    const promos: PromoInput[] = [];
    const rejections: RunReport["rejections"] = [];
    const seen = new Set<string>();

    for (const draft of drafts) {
      const parsed = promoInputSchema.safeParse({
        ...draft,
        providerId: options.providerId,
        compatibility: draft.compatibility ?? "UNKNOWN",
        status: "ACTIVE",
        sourceUrl: options.sourceUrl,
        lastVerifiedAt: startedAt,
        sourceMetadata: { collector: options.providerId, sourceUrl: options.sourceUrl },
      });

      if (!parsed.success) {
        rejections.push({ name: draft.name, reason: describeIssues(parsed.error) });
        continue;
      }

      const key = parsed.data.externalKey;
      if (!key) {
        rejections.push({ name: draft.name, reason: "record has no stable key" });
        continue;
      }

      if (seen.has(key)) {
        rejections.push({ name: draft.name, reason: `duplicate key "${key}"` });
        continue;
      }

      seen.add(key);
      promos.push(parsed.data);
    }

    const decision = evaluatePublish(
      {
        collected: drafts.length,
        accepted: promos.length,
        rejected: rejections.length,
        previousPublishedCount: options.previousPublishedCount,
      },
      options.policy ?? DEFAULT_PUBLISH_POLICY,
      { acceptSmallerSet: options.acceptSmallerSet },
    );

    const completedAt = now();
    const report: RunReport = {
      providerId: options.providerId,
      startedAt,
      completedAt,
      status: "SUCCEEDED",
      recordsCollected: drafts.length,
      recordsAccepted: promos.length,
      recordsRejected: rejections.length,
      published: decision.publish,
      errorDetail: decision.publish ? undefined : decision.reason,
      rejections,
      ...(decision.override ? { override: decision.override } : {}),
    };

    if (!decision.publish) {
      await alerts.send({
        severity: "critical",
        providerId: options.providerId,
        title: `Collection run blocked for ${options.providerId}`,
        detail: decision.reason ?? "unknown reason",
        at: completedAt,
      });
    }

    options.logger.info("Collection finished", {
      providerId: options.providerId,
      collected: report.recordsCollected,
      accepted: report.recordsAccepted,
      rejected: report.recordsRejected,
      publishable: decision.publish,
    });

    return { report, decision, promos };
  } catch (error) {
    const completedAt = now();
    const detail = safeDetail(error instanceof Error ? error.message : "unknown error");

    await alerts.send({
      severity: "critical",
      providerId: options.providerId,
      title: `Collection failed for ${options.providerId}`,
      detail,
      at: completedAt,
    });

    options.logger.error("Collection failed", {
      providerId: options.providerId,
      error: detail,
    });

    return {
      report: {
        providerId: options.providerId,
        startedAt,
        completedAt,
        status: "FAILED",
        recordsCollected: 0,
        recordsAccepted: 0,
        recordsRejected: 0,
        published: false,
        errorDetail: detail,
        rejections: [],
      },
      decision: { publish: false, reason: detail },
      promos: [],
    };
  }
}
