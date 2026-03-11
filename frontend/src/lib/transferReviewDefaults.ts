/** Shared defaults for Transfer Review page and badge count. */

export const TRANSFER_REVIEW_DEFAULTS_KEY = "transfer_review_candidate_defaults_v1";

/** Dispatched when user saves new defaults so badge count can refetch. */
export const TRANSFER_REVIEW_DEFAULTS_SAVED_EVENT = "transfer-review-defaults-saved";

export const SYSTEM_DEFAULTS = {
  minConfidence: 0.55,
  seedLimit: 1200,
  maxResults: 400,
  amountTolerance: 5,
  dateWindowDays: 5,
  autoConfidence: 0.9,
};

export type TransferReviewDefaults = typeof SYSTEM_DEFAULTS;

/** Returns current defaults from localStorage or SYSTEM_DEFAULTS. */
export function getTransferReviewDefaults(): TransferReviewDefaults {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(TRANSFER_REVIEW_DEFAULTS_KEY) : null;
    if (!raw) return SYSTEM_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<TransferReviewDefaults>;
    return {
      minConfidence: Number(parsed.minConfidence ?? SYSTEM_DEFAULTS.minConfidence),
      seedLimit: Number(parsed.seedLimit ?? SYSTEM_DEFAULTS.seedLimit),
      maxResults: Number(parsed.maxResults ?? SYSTEM_DEFAULTS.maxResults),
      amountTolerance: Number(parsed.amountTolerance ?? SYSTEM_DEFAULTS.amountTolerance),
      dateWindowDays: Number(parsed.dateWindowDays ?? SYSTEM_DEFAULTS.dateWindowDays),
      autoConfidence: Number(parsed.autoConfidence ?? SYSTEM_DEFAULTS.autoConfidence),
    };
  } catch {
    return SYSTEM_DEFAULTS;
  }
}
