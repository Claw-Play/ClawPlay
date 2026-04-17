import type { LLMProvider, LLMGenerateRequest, LLMGenerateResult } from "./types";
import { pickKeyWithRetry, recordKeyUsage } from "../key-pool";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = process.env.LLM_MODEL_GEMINI ?? "gemini-3-flash-preview";
const MAX_RETRIES = 3;

export class GeminiProvider implements LLMProvider {
  async generate(req: LLMGenerateRequest): Promise<LLMGenerateResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const { id: keyId, key: apiKey, endpoint, modelName } =
        await pickKeyWithRetry("gemini", "llm");

      const resolvedEndpoint = endpoint || GEMINI_BASE;
      const resolvedModel = modelName || DEFAULT_MODEL;

      try {
        const result = await this.callGemini(apiKey, resolvedEndpoint, resolvedModel, req);
        await recordKeyUsage("gemini", "llm", keyId);
        return result;
      } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException)?.code;
        if (code === "PROVIDER_RATE_LIMITED") {
          lastError = err as Error;
          console.warn(`[gemini/llm] 429 on key ${keyId}, retrying with next key...`);
          continue;
        }
        throw err;
      }
    }

    const msg = lastError?.message ?? "All Gemini LLM keys are rate-limited.";
    const err = new Error(msg);
    (err as NodeJS.ErrnoException).code = "PROVIDER_RATE_LIMITED";
    throw err;
  }

  private async callGemini(
    apiKey: string,
    endpoint: string,
    model: string,
    req: LLMGenerateRequest
  ): Promise<LLMGenerateResult> {
    const url = `${endpoint}/${model}:generateContent?key=${apiKey}`;

    const generationConfig: Record<string, unknown> = {};
    if (req.maxTokens != null) generationConfig.maxOutputTokens = req.maxTokens;
    if (req.temperature != null) generationConfig.temperature = req.temperature;

    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: req.prompt }] }],
      ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) {
        const err = new Error("Provider rate limit exceeded. Please retry shortly.");
        (err as NodeJS.ErrnoException).code = "PROVIDER_RATE_LIMITED";
        throw err;
      }
      throw new Error(`Gemini API error ${res.status}: ${text}`);
    }

    const data = await res.json() as {
      modelVersion?: string;
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return {
      text,
      model: data.modelVersion ?? model,
      usage:
        data.usageMetadata
          ? {
              inputTokens: data.usageMetadata.promptTokenCount ?? 0,
              outputTokens: data.usageMetadata.candidatesTokenCount ?? 0,
              totalTokens: data.usageMetadata.totalTokenCount ?? 0,
            }
          : undefined,
    };
  }
}
