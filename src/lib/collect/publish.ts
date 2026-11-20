/**
 * Safe-publish policy (AGENTS.md section 7).
 *
 * A run may only replace published data when it passes every guard. Any
 * rejection leaves the previous published set untouched, and the caller still
 * records the run so the failure is visible to administrators.
 */

export interface PublishPolicy {
  /** Minimum accepted records for a run to be considered usable. */
  minAccepted: number;
  /** Reject a run when more than this share of records failed validation. */
  maxRejectedRatio: number;
  /**
   * Reject a run when it keeps less than this share of the previously
   * published record count - the usual symptom of a broken parser.
   */
  minRetentionRatio: number;
}

export const DEFAULT_PUBLISH_POLICY: PublishPolicy = {
  minAccepted: 1,
  maxRejectedRatio: 0.5,
  minRetentionRatio: 0.5,
};

export interface RunCounts {
  collected: number;
  accepted: number;
  rejected: number;
  /**
   * Size of the set the drop guard compares against: the provider's last
   * successful published run, or its active hand-entered set when no run
   * has published yet (see runProviderSafely).
   */
  previousPublishedCount: number;
}

export interface PublishDecision {
  publish: boolean;
  reason?: string;
  /**
   * Set when the drop guard would have blocked the run but an administrator
   * accepted the smaller set: the guard's reason, for the run log.
   */
  override?: string;
}

export interface PublishOptions {
  /**
   * Publish even if the record count dropped below the retention ratio.
   * Only for a person who has checked that the provider's catalogue really
   * shrank (`pnpm scrape --accept-smaller-set`). Every other guard still applies.
   */
  acceptSmallerSet?: boolean;
}

export function evaluatePublish(
  counts: RunCounts,
  policy: PublishPolicy = DEFAULT_PUBLISH_POLICY,
  options: PublishOptions = {},
): PublishDecision {
  if (counts.collected === 0) {
    return { publish: false, reason: "no records were collected" };
  }

  if (counts.accepted < policy.minAccepted) {
    return { publish: false, reason: "no records passed validation" };
  }

  const rejectedRatio = counts.rejected / counts.collected;
  if (rejectedRatio > policy.maxRejectedRatio) {
    return {
      publish: false,
      reason: `rejection rate ${Math.round(rejectedRatio * 100)}% exceeds the ${Math.round(
        policy.maxRejectedRatio * 100,
      )}% limit`,
    };
  }

  if (counts.previousPublishedCount > 0) {
    const retention = counts.accepted / counts.previousPublishedCount;
    if (retention < policy.minRetentionRatio) {
      const reason = `record count dropped to ${Math.round(retention * 100)}% of the published set (${counts.accepted} of ${counts.previousPublishedCount})`;
      return options.acceptSmallerSet
        ? { publish: true, override: `accepted smaller set: ${reason}` }
        : { publish: false, reason };
    }
  }

  return { publish: true };
}
