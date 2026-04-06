import { ArkProvider } from "./ark";
import { GeminiProvider } from "./gemini";
import type { ImageProvider } from "./types";

export type { ImageProvider, ImageGenerateRequest, ImageGenerateResponse } from "./types";

/**
 * Returns the configured image provider.
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

  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) throw new Error("ARK_API_KEY is required when IMAGE_PROVIDER=ark");
  return new ArkProvider(apiKey);
}
