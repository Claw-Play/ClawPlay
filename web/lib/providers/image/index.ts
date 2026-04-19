import { ArkProvider } from "./ark";
import { GeminiProvider } from "./gemini";
import type { ImageProvider } from "./types";
import { pickKeyWithRetry } from "../key-pool";

export type { ImageProvider, ImageGenerateRequest, ImageGenerateResponse } from "./types";

let _arkProvider: ImageProvider | null = null;

/**
 * Returns the configured image provider.
 * Set IMAGE_PROVIDER=gemini in .env.local to use Gemini.
 * Defaults to Ark (uses Key Pool for both Ark and Gemini).
 *
 * For Gemini, the provider internally records key usage after each generate() call,
 * so callers do NOT need to call a separate recordImageKeyUsage() function.
 */
export async function getImageProvider(): Promise<ImageProvider> {
  const provider = process.env.IMAGE_PROVIDER ?? "ark";

  if (provider === "gemini") {
    const { id: keyId, key, endpoint, modelName } = await pickKeyWithRetry("gemini", "image");
    return new GeminiProvider(key, keyId, endpoint || undefined, modelName || undefined);
  }

  // Ark uses Key Pool — single shared instance
  if (!_arkProvider) {
    _arkProvider = new ArkProvider();
  }
  return _arkProvider;
}
