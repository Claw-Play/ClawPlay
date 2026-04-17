import { ArkVisionProvider } from "./ark";
import { GeminiVisionProvider } from "./gemini";
import type { VisionProvider } from "./types";
import { pickKeyWithRetry, recordKeyUsage } from "../key-pool";

export type { VisionProvider, VisionAnalyzeRequest, VisionAnalyzeResponse, VisionMode, VisionImage } from "./types";

let _arkProvider: VisionProvider | null = null;
let _geminiKeyId: number | null = null;

export async function getVisionProvider(provider?: string): Promise<VisionProvider> {
  const actual = provider ?? process.env.VISION_PROVIDER ?? "ark";
  if (actual === "gemini") {
    const { id: keyId, key, endpoint, modelName } = await pickKeyWithRetry("gemini", "vision");
    _geminiKeyId = keyId;
    return new GeminiVisionProvider(key, endpoint || undefined, modelName || undefined);
  }

  // Ark uses Key Pool — single shared instance
  if (!_arkProvider) {
    _arkProvider = new ArkVisionProvider();
  }
  return _arkProvider;
}

export async function recordVisionKeyUsage(): Promise<void> {
  if (_geminiKeyId !== null) {
    await recordKeyUsage("gemini", "vision", _geminiKeyId);
    _geminiKeyId = null;
  }
}
