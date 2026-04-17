import { ArkProvider } from "./ark";
import { GeminiProvider } from "./gemini";
import type { ImageProvider } from "./types";
import { pickKeyWithRetry, recordKeyUsage } from "../key-pool";

export type { ImageProvider, ImageGenerateRequest, ImageGenerateResponse } from "./types";

let _arkProvider: ImageProvider | null = null;
let _geminiKeyId: number | null = null;

/**
 * Returns the configured image provider.
 * Set IMAGE_PROVIDER=gemini in .env.local to use Gemini.
 * Defaults to Ark (uses Key Pool for both Ark and Gemini).
 */
export async function getImageProvider(): Promise<ImageProvider> {
  const provider = process.env.IMAGE_PROVIDER ?? "ark";

  if (provider === "gemini") {
    const { id: keyId, key, endpoint, modelName } = await pickKeyWithRetry("gemini", "image");
    _geminiKeyId = keyId;
    return new GeminiProvider(key, endpoint || undefined, modelName || undefined);
  }

  // Ark uses Key Pool — single shared instance
  if (!_arkProvider) {
    _arkProvider = new ArkProvider();
  }
  return _arkProvider;
}

/**
 * Record key usage after a successful image generation call.
 */
export async function recordImageKeyUsage(): Promise<void> {
  if (_geminiKeyId !== null) {
    await recordKeyUsage("gemini", "image", _geminiKeyId);
    _geminiKeyId = null;
  }
}
