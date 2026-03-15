/**
 * @fileoverview Type declarations for @pwshub/aisdk
 */

export interface AiOptions {
  gatewayUrl?: string;
}

export interface AskParams {
  model: string;
  apikey: string;
  prompt: string;
  system?: string;
  fallbacks?: string[];
  providerOptions?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  reasoningTokens: number;
  estimatedCost: number;
}

export interface AskResult {
  text: string;
  model: string;
  usage: Usage;
}

export interface ModelRecord {
  id: string;
  name: string;
  provider: string;
  input_price: number;
  output_price: number;
  cache_price: number;
  max_in: number;
  max_out: number;
  enable: boolean;
  supportedParams?: string[];
}

export class ProviderError extends Error {
  status: number;
  provider: string;
  model: string;
  raw?: unknown;
  constructor(message: string, options: { status: number; provider: string; model: string; raw?: unknown });
}

export class InputError extends Error {
  status: number;
  provider: string;
  model: string;
  raw?: unknown;
  constructor(message: string, options: { status: number; provider: string; model: string; raw?: unknown });
}

export interface AiClient {
  ask: (params: AskParams) => Promise<AskResult>;
  listModels: () => ModelRecord[];
}

export function createAi(opts?: AiOptions): AiClient;
export function setModels(models: ModelRecord[]): void;
export function listModels(): ModelRecord[];
