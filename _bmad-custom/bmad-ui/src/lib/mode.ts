/**
 * Production mode flag. When true, the app is deployed to the web
 * and local-only features (agent server, session prompts, skill runs)
 * are disabled. Data is served from pre-built static JSON files.
 */
export const IS_LOCAL_MODE = import.meta.env.DEV

/**
 * Resolve an API path to the correct URL based on mode.
 * In dev, returns the path as-is (handled by Vite dev server middleware).
 * In production, maps to static JSON files under /data/.
 */
export function apiUrl(path: string): string {
  if (IS_LOCAL_MODE) {
    return path
  }

  // Map /api/overview → /data/overview.json
  // Map /api/analytics → /data/analytics.json
  // Map /api/epic/epic-1 → /data/epic/epic-1.json
  // Map /api/story/1-1-foo → /data/story/1-1-foo.json
  // Map /api/story-preview/1-1-foo → /data/story-preview/1-1-foo.json
  // Map /api/session/abc → /data/session/abc.json
  const stripped = path.replace(/^\/api\//, "")
  return `/data/${stripped}.json`
}
