import type { LLMProvider, LLMGenerateRequest, LLMGenerateResult } from "./types";

// Gemini API base — model is appended to the URL path
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = process.env.LLM_MODEL_GEMINI ?? "gemini-3-flash-preview";

export class GeminiProvider implements LLMProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(req: LLMGenerateRequest): Promise<LLMGenerateResult> {
    const model = req.model ?? DEFAULT_MODEL;
    const url = `${GEMINI_BASE}/${model}:generateContent?key=${this.apiKey}`;

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
            }
          : undefined,
    };
  }
}
