import { ArkProvider } from "./ark";
import { GeminiProvider } from "./gemini";
import type { LLMProvider } from "./types";

export type { LLMProvider, LLMGenerateRequest, LLMGenerateResult } from "./types";

/**
 * Returns the configured LLM text generation provider.
 * Set LLM_PROVIDER=gemini in .env.local to use Gemini.
 * Defaults to Ark (uses Key Pool for both).
 */
export function getLLMProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER ?? "ark";
  if (provider === "gemini") {
    return new GeminiProvider();
  }
  return new ArkProvider();
}
