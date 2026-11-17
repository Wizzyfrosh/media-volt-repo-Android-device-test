export interface ExtractorModule {
  /** True only when the real extractor client is bundled (direct flavor). */
  readonly enabled: boolean;
  /** Source ids this build can resolve, for example "tiktok". */
  readonly supportedSources: readonly string[];
}
