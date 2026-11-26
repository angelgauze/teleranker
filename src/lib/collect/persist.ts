import { errorDetail } from "../db/errors";
import { applyOverrides, describeOverrideReport } from "../overrides/apply";
import type { PromoRepository, ProviderSeed } from "../db/repository";
import type { AlertSink } from "./alerts";
import { collectProvider, type CollectProviderResult } from "./run";
import type { FetchPage, Logger, ProviderCollector, RunReport } from "./types";

/**
 * Writes the outcome of one collection run through the repository.
 *
 * Publishes the validated promos only when the publish policy allowed it, and
 * always records the run. A published set and its run log are written in one
 * transaction, so the log never disagrees with what was published. A failed
 * publish leaves the previous published set in place, records the run as
 * FAILED and raises an alert, so it is never silent.
 */

export interface PersistRunOptions {
  repository: PromoRepository;
  provider: ProviderSeed;
  result: CollectProviderResult;
  alerts: AlertSink;
  logger: Logger;
  now?: () => Date;
}

export async function persistRun(options: PersistRunOptions): Promise<RunReport> {
  const { repository, provider, result, alerts, logger } = options;
  const now = options.now ?? (() => new Date());
  let report = result.report;

  await repository.ensureProvider(provider);

  if (result.decision.publish) {
    try {
      // Values a person checked replace the collector's (same promo count, so
      // the publish decision above is unaffected).
      const overrides = await repository.listOverrides(provider.id);
      const applied = applyOverrides(result.promos, overrides);
      if (overrides.length > 0) report = { ...report, promoOverrides: applied.report };

      const summary = await repository.publishRun(report, applied.promos, applied.collected);
      logger.info("Published promo set", { providerId: provider.id, ...summary });
      if (overrides.length > 0) {
        const line = describeOverrideReport(applied.report);
        if (applied.report.unmatched.length > 0 || applied.report.conflicts.length > 0) {
          logger.warn("Promo overrides need a look", { providerId: provider.id, overrides: line });
        } else {
          logger.info("Applied promo overrides", { providerId: provider.id, overrides: line });
        }
      }
      if (applied.report.conflicts.length > 0) {
        // The checked value was kept; the collector now disagrees with it.
        await alerts.send({
          severity: "warning",
          providerId: provider.id,
          title: `Collected values disagree with checked overrides for ${provider.id}`,
          detail: describeOverrideReport(applied.report),
          at: now(),
        });
      }
      if (report.override) {
        // Sent only once the smaller set is actually published.
        await alerts.send({
          severity: "warning",
          providerId: provider.id,
          title: `Smaller promo set accepted by an administrator for ${provider.id}`,
          detail: report.override,
          at: now(),
        });
      }
      return report;
    } catch (error) {
      const attempted = report.override ? " (the smaller-set override was not applied)" : "";
      const detail = `publish failed${attempted}: ${errorDetail(error)}`;
      // The run log keeps only overrides that took effect.
      const { override: _override, promoOverrides: _promoOverrides, ...rest } = report;
      report = { ...rest, status: "FAILED", published: false, errorDetail: detail };

      await alerts.send({
        severity: "critical",
        providerId: provider.id,
        title: `Publishing failed for ${provider.id}`,
        detail,
        at: now(),
      });
      logger.error("Publishing failed", { providerId: provider.id, error: detail });
    }
  }

  // Best effort: when the database is what failed, recording the run fails
  // too. The run already raised its alert, so log and keep the real report
  // (with its counts) instead of raising a second alert.
  try {
    await repository.recordRun(report);
  } catch (error) {
    logger.warn("Could not record the run", { providerId: provider.id, error: errorDetail(error) });
  }
  return report;
}

/**
 * What the drop guard compares a run against: the provider's last successful
 * published run (0 when none has published yet). A run only replaces
 * collected promos, never the hand-entered ones listed beside them, so the
 * hand-entered set is not a baseline. An administrator can accept a
 * genuinely smaller set with `--accept-smaller-set`.
 */
export async function guardBaseline(repository: PromoRepository, providerId: string): Promise<number> {
  return repository.lastPublishedRunCount(providerId);
}

export interface RunProviderOptions {
  provider: ProviderSeed & { collector: ProviderCollector; sourceUrl: string };
  /** Null for dry runs that only fetch and validate. */
  repository: PromoRepository | null;
  /** See PublishOptions.acceptSmallerSet; for one provider at a time. */
  acceptSmallerSet?: boolean;
  fetchPage: FetchPage;
  alerts: AlertSink;
  logger: Logger;
  now?: () => Date;
}

export interface RunProviderResult {
  report: RunReport;
  /** Why the run did not publish, when it did not. */
  reason?: string;
}

/**
 * Collects, validates and (with a repository) publishes one provider, and
 * never throws. A database error is turned into a FAILED run with an alert, so
 * the caller can move on to the next provider: one provider's breakage must
 * not stop the others.
 */
export async function runProviderSafely(options: RunProviderOptions): Promise<RunProviderResult> {
  const { provider, repository, alerts, logger } = options;
  const now = options.now ?? (() => new Date());
  const startedAt = now();

  try {
    const previousPublishedCount = repository ? await guardBaseline(repository, provider.id) : 0;

    const result = await collectProvider({
      providerId: provider.id,
      collector: provider.collector,
      fetchPage: options.fetchPage,
      logger,
      sourceUrl: provider.sourceUrl,
      previousPublishedCount,
      acceptSmallerSet: options.acceptSmallerSet,
      alerts,
      now: options.now,
    });

    const report = repository
      ? await persistRun({
          repository,
          provider: {
            id: provider.id,
            name: provider.name,
            websiteUrl: provider.websiteUrl,
            promoPageUrl: provider.promoPageUrl,
          },
          result,
          alerts,
          logger,
          now: options.now,
        })
      : result.report;

    return { report, reason: result.decision.publish ? undefined : result.decision.reason };
  } catch (error) {
    const detail = errorDetail(error);
    const completedAt = now();

    await alerts.send({
      severity: "critical",
      providerId: provider.id,
      title: `Collection run could not be completed for ${provider.id}`,
      detail,
      at: completedAt,
    });
    logger.error("Collection run could not be completed", { providerId: provider.id, error: detail });

    const report: RunReport = {
      providerId: provider.id,
      startedAt,
      completedAt,
      status: "FAILED",
      recordsCollected: 0,
      recordsAccepted: 0,
      recordsRejected: 0,
      published: false,
      errorDetail: detail,
      rejections: [],
    };

    // Best effort: the database may be the thing that failed.
    if (repository) {
      try {
        await repository.recordRun(report);
      } catch {
        logger.warn("Could not record the failed run", { providerId: provider.id });
      }
    }

    return { report, reason: detail };
  }
}
