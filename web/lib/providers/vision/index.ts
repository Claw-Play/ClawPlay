import { ArkVisionProvider } from "./ark";
import { GeminiVisionProvider } from "./gemini";
import type { VisionProvider } from "./types";

export type { VisionProvider, VisionAnalyzeRequest, VisionAnalyzeResponse, VisionMode } from "./types";

let _arkProvider: VisionProvider | null = null;

export function getVisionProvider(provider = "ark"): VisionProvider {
  if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is required when provider=gemini");
    return new GeminiVisionProvider(key);
  }

  // Ark uses Key Pool — single shared instance
  if (!_arkProvider) {
    _arkProvider = new ArkVisionProvider();
  }
  return _arkProvider;
}
