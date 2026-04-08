// LLM text generation types

export interface LLMGenerateRequest {
  prompt: string;
  system?: string;
  /** Override default model (provider-specific) */
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMGenerateResult {
  text: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface LLMProvider {
  generate(req: LLMGenerateRequest): Promise<LLMGenerateResult>;
}
