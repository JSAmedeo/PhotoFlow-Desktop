import { describe, it, expect, beforeAll } from 'vitest';
import { sha256Hex } from './contentHash';

// The Tauri WebView exposes `crypto.subtle` as a global (secure context). The vitest node
// worker may not, so polyfill it from node's webcrypto for the test only. The dynamic import
// specifier is type-erased (this frontend tsconfig has no node types) but resolves at runtime.
beforeAll(async () => {
  const g = globalThis as { crypto?: Crypto };
  if (!g.crypto?.subtle) {
    const nodeCrypto = (await import('node:crypto' as string)) as { webcrypto: Crypto };
    g.crypto = nodeCrypto.webcrypto;
  }
});

describe('sha256Hex (content de-duplication)', () => {
  it('matches the known SHA-256 vector for "abc"', async () => {
    const bytes = new TextEncoder().encode('abc');
    expect(await sha256Hex(bytes)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('matches the known SHA-256 vector for empty input', async () => {
    expect(await sha256Hex(new Uint8Array())).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('produces identical hashes for identical bytes and different for different bytes', async () => {
    const a1 = await sha256Hex(new TextEncoder().encode('photo-A'));
    const a2 = await sha256Hex(new TextEncoder().encode('photo-A'));
    const b = await sha256Hex(new TextEncoder().encode('photo-B'));
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
  });

  it('hashes only the view range when given a subarray', async () => {
    const full = new TextEncoder().encode('XXabcXX');
    const view = full.subarray(2, 5); // "abc"
    expect(await sha256Hex(view)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
