// Content de-duplication helper. Computes a SHA-256 hex digest over imported image bytes
// so a genuinely re-sent identical capture can be detected and skipped at import time.
//
// Uses Web Crypto (`crypto.subtle`), which is available in the Tauri WebView because the
// app origin (e.g. http://tauri.localhost) is treated as a secure context.

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Copy the view's exact bytes into a fresh ArrayBuffer so digest() gets a plain
  // (non-shared) BufferSource and only the view range is hashed.
  const buffer = new Uint8Array(bytes).buffer;
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const view = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < view.length; i += 1) {
    hex += view[i].toString(16).padStart(2, '0');
  }
  return hex;
}
