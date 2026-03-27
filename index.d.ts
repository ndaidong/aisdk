/**
 * @fileoverview Type declarations for @pwshub/aisdk
 */

export interface AiOptions {
  gatewayUrl?: string;
  timeout?: number;
  models?: ModelRecord[];
  onRequest?: (context: HookContext) => void | Promise<void>;
  onResponse?: (context: ResponseHookContext) => void | Promise<void>;
}

export interface HookContext {
  model: string;
  provider: string;
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

export interface ResponseHookContext {
  model: string;
  provider: string;
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  status: number;
  data: unknown;
  duration: number;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AskParams {
  model: string;
  apikey: string;
  prompt?: string;
  system?: string;
  messages?: Message[];
  fallbacks?: string[];
  providerOptions?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  randomSeed?: number;
  seed?: number;
  numPredict?: number;
  stop?: string | string[];
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
  id?: string;
  name: string;
  provider: string;
  input_price?: number;
  output_price?: number;
  cache_price?: number;
  max_in?: number;
  max_out?: number;
  enable?: boolean;
  supportedParams?: string[];
  paramOverrides?: Record<string, ParamOverride>;
}

export interface ParamOverride {
  fixedValue?: number;
  supportedValues?: number[];
  range?: { min: number; max: number };
}

export class ProviderError extends Error {
  status: number;
  provider: string;
  model: string;
  raw?: unknown;
  retryAfter?: number;
  constructor(message: string, options: { status: number; provider: string; model: string; raw?: unknown; retryAfter?: number });
}

export class InputError extends Error {
  status: number;
  provider: string;
  model: string;
  raw?: unknown;
  constructor(message: string, options: { status: number; provider: string; model: string; raw?: unknown });
}

export interface Logger {
  warn: (message: string) => void;
  error: (message: string) => void;
  debug: (message: string) => void;
}

export interface AiClient {
  ask: (params: AskParams) => Promise<AskResult>;
  listModels: () => ModelRecord[];
  addModels: (models: ModelRecord[]) => void;
}

export function createAi(opts?: AiOptions): AiClient;
export function addModels(models: ModelRecord[]): void;
export function setModels(models: ModelRecord[]): void;
export function listModels(): ModelRecord[];
export function setLogger(logger: Logger): void;
export function getLogger(): Logger;
export const noopLogger: Logger;
