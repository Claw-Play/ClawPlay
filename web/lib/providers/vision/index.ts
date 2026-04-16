import { ArkVisionProvider } from "./ark";
import { GeminiVisionProvider } from "./gemini";
import type { VisionProvider } from "./types";

export type { VisionProvider, VisionAnalyzeRequest, VisionAnalyzeResponse, VisionMode, VisionImage } from "./types";

let _arkProvider: VisionProvider | null = null;

export function getVisionProvider(provider?: string): VisionProvider {
  const actual = provider ?? process.env.VISION_PROVIDER ?? "ark";
  if (actual === "gemini") {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is required when VISION_PROVIDER=gemini");
    return new GeminiVisionProvider(key);
  }

  // Ark uses Key Pool — single shared instance
  if (!_arkProvider) {
    _arkProvider = new ArkVisionProvider();
  }
  return _arkProvider;
}
