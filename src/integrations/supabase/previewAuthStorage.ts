/**
 * Client-side auth storage for Supabase.
 * Uses browser localStorage in browser environment.
 */
export function brokeredPreviewStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}
