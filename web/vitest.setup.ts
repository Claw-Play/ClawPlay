/// <reference types="vitest/globals" />
// Vitest setup — runs before each test file
import { vi } from "vitest";

// Node.js 18+ already ships with Web Crypto API, no need to stub globally.
// Only stub getRandomValues if it's missing (some test environments).
if (typeof globalThis.crypto?.getRandomValues !== "function") {
  vi.stubGlobal("crypto", {
    ...globalThis.crypto,
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
  });
}
