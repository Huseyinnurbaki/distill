export interface ModelOption {
  id: string;
  name: string;
}

export const modelCache: Record<string, { models: ModelOption[]; fetchedAt: number }> = {};
export const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export function bustModelCache(provider: string) {
  delete modelCache[provider];
}
