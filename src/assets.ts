// Resolve public files relative to the app, including GitHub Pages subdirectories.
export const appBase = new URL(import.meta.env.BASE_URL, document.baseURI);

export function assetUrl(path: string): string {
  const key = path.replace(/^\/+/, "");
  const embedded = (
    window as Window & { __NAVY_ASSETS__?: Record<string, string> }
  ).__NAVY_ASSETS__;
  if (embedded?.[key]) return embedded[key];
  return new URL(key, appBase).pathname;
}
