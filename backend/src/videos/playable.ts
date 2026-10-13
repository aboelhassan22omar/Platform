/**
 * A lesson stays watchable while its video is being replaced: the published
 * HLS version (`hlsPrefix`, set with `processedAt` only when a transcode
 * finishes) keeps serving until the worker swaps in the new one. `status`
 * describes the latest upload/transcode, not what students can watch.
 */
export const hasPlayableVersion = (
  asset: { hlsPrefix: string | null; processedAt: Date | null } | null | undefined,
): boolean => Boolean(asset?.hlsPrefix && asset.processedAt);
