import { ArkVisionProvider } from "./ark";
import { GeminiVisionProvider } from "./gemini";
import type { VisionProvider } from "./types";

export type { VisionProvider, VisionAnalyzeRequest, VisionAnalyzeResponse, VisionMode } from "./types";

export function getVisionProvider(provider = "ark"): VisionProvider {
  if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is required when provider=gemini");
    return new GeminiVisionProvider(key);
  }

  const key = process.env.ARK_API_KEY;
  if (!key) throw new Error("ARK_API_KEY is required when provider=ark");
  return new ArkVisionProvider(key);
}
