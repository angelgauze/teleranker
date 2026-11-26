import { errorDetail } from "../db/errors";
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
      const summary = await repository.publishRun(report, result.promos);
      logger.info("Published promo set", { providerId: provider.id, ...summary });
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
      const { override: _override, ...rest } = report;
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
 * What the drop guard compares a run against.
 *
 * Normally the provider's last successful published run, so a manual import
 * cannot block a recovered collector. When no run has ever published (Globe
 * while its pages are blocked), the active hand-entered set is the baseline
 * instead, so a broken first run cannot replace a full manual catalogue with
 * a handful of promos. An administrator can accept a genuinely smaller set
 * with `--accept-smaller-set`.
 */
export async function guardBaseline(repository: PromoRepository, providerId: string): Promise<number> {
  const lastRun = await repository.lastPublishedRunCount(providerId);
  return lastRun > 0 ? lastRun : repository.countPublished(providerId, "MANUAL");
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
