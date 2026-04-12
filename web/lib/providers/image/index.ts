import { ArkProvider } from "./ark";
import { GeminiProvider } from "./gemini";
import type { ImageProvider } from "./types";

export type { ImageProvider, ImageGenerateRequest, ImageGenerateResponse } from "./types";

let _arkProvider: ImageProvider | null = null;

/**
 * Returns the configured image provider (singleton for Ark since it uses Key Pool).
 * Set IMAGE_PROVIDER=gemini in .env.local to use Gemini.
 * Defaults to Ark.
 */
export function getImageProvider(): ImageProvider {
  const provider = process.env.IMAGE_PROVIDER ?? "ark";

  if (provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is required when IMAGE_PROVIDER=gemini");
    return new GeminiProvider(apiKey);
  }

  // Ark uses Key Pool — single shared instance
  if (!_arkProvider) {
    _arkProvider = new ArkProvider();
  }
  return _arkProvider;
}
