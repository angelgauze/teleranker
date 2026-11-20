import type {
  DataAllocationKind,
  PromoCompatibility,
  ValidityUnit,
} from "../schema/promo";

/** One normalised promo parsed from a provider page, before final validation. */
export interface PromoDraft {
  /** Stable key derived from the promo name, used to match records between runs. */
  externalKey: string;
  name: string;
  description?: string;
  priceCentavos: number;
  dataKind: DataAllocationKind;
  dataGb?: number;
  /** All-network part of dataGb when the provider publishes a breakdown. */
  allAccessGb?: number;
  dataNotes?: string;
  validityValue?: number;
  validityUnit?: ValidityUnit;
  compatibility?: PromoCompatibility;
  callsUnlimited?: boolean;
  callsIncluded?: number;
  textsUnlimited?: boolean;
  textsIncluded?: number;
}

export interface FetchedPage {
  url: string;
  status: number;
  body: string;
}

export type FetchPage = (url: string) => Promise<FetchedPage>;

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface CollectorContext {
  fetchPage: FetchPage;
  now: Date;
  logger: Logger;
}

export interface CollectorResult {
  drafts: PromoDraft[];
  warnings: string[];
}

/** A provider-specific parser. It may only know about its own markup. */
export interface ProviderCollector {
  providerId: string;
  sourceUrls: string[];
  collect(context: CollectorContext): Promise<CollectorResult>;
}

export type RunStatus = "SUCCEEDED" | "FAILED";

export interface RunReport {
  providerId: string;
  startedAt: Date;
  completedAt: Date;
  status: RunStatus;
  recordsCollected: number;
  recordsAccepted: number;
  recordsRejected: number;
  published: boolean;
  errorDetail?: string;
  rejections: Array<{ name?: string; reason: string }>;
  /**
   * Set when an administrator published a run that the drop guard would have
   * held back (`--accept-smaller-set`): the guard's reason, kept in the run log.
   */
  override?: string;
}
