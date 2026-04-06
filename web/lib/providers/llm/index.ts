import { ArkProvider } from "./ark";
import { GeminiProvider } from "./gemini";
import type { LLMProvider } from "./types";

export type { LLMProvider, LLMGenerateRequest, LLMGenerateResult } from "./types";

/**
 * Returns the configured LLM text generation provider.
 * Set LLM_PROVIDER=gemini in .env.local to use Gemini.
 * Defaults to Ark (reuses ARK_API_KEY).
 */
export function getLLMProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER ?? "ark";

  if (provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is required when LLM_PROVIDER=gemini");
    return new GeminiProvider(apiKey);
  }

  // Default: ark
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) throw new Error("ARK_API_KEY is required when LLM_PROVIDER=ark");
  return new ArkProvider(apiKey);
}
