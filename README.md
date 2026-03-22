# @pwshub/aisdk

A thin, unified AI client for OpenAI, Anthropic, Google, DashScope, DeepSeek, and Mistral with automatic parameter normalization and fallback support.

[![npm version](https://badge.fury.io/js/@pwshub%2Faisdk.svg)](https://badge.fury.io/js/@pwshub%2Faisdk)
![CodeQL](https://github.com/pwshub/aisdk/workflows/CodeQL/badge.svg)
![CI test](https://github.com/pwshub/aisdk/workflows/ci-test/badge.svg)

## Features

- **Unified API**: Single interface for multiple AI providers
- **Automatic parameter normalization**: Canonical camelCase params are translated to provider-specific wire format
- **Parameter clamping**: Values are automatically clamped to provider-accepted ranges
- **Fallback support**: Chain multiple models with automatic fallback on provider errors
- **Token usage tracking**: Detailed token counts and estimated cost per request
- **Provider-specific options**: Pass provider-specific parameters when needed

## Limitations

This package is designed for **personal project usage** with a focus on simplicity:

- **Text-only chat**: Supports basic text generation and conversation
- **No streaming**: All responses are returned as complete results
- **No multimodal inputs**: Images, audio, video, and file uploads are not supported
- **No function calling**: Tool use and function calling features are not available

For production applications requiring advanced features, consider using the official provider SDKs directly.

## Installation

```bash
npm i @pwshub/aisdk
# or
pnpm i @pwshub/aisdk
# or
bun add @pwshub/aisdk
```

## Quick Start

```javascript
import { createAi } from '@pwshub/aisdk'

const ai = createAi()

// Basic usage
const result = await ai.ask({
  model: 'openai/gpt-4o',
  apikey: 'your-api-key-here',
  prompt: 'What is the capital of Vietnam?',
  temperature: 0.5,
})

console.log(result.text)
console.log(result.usage) // { inputTokens, outputTokens, cacheTokens, estimatedCost }
```

## API

### `createAi(options?)`

Creates an AI client instance.

**Options:**
- `gatewayUrl` (optional): Override the default API endpoint URL

**Returns:** An object with:
- `ask(params)`: Send a generation request
- `listModels()`: Get all available models from the registry

### `ai.ask(params)`

Sends a text generation request.

**Parameters:**
- `model` (string, required): Model name or `provider/name` format (e.g., `'gpt-4o'`, `'ollama/llama3.2'`)
- `apikey` (string, required): API key for the provider
- `prompt` (string, required): The user message
- `system` (string, optional): Optional system prompt
- `fallbacks` (string[], optional): Ordered list of fallback models (same format as `model`)
- `providerOptions` (object, optional): Provider-specific options
- `temperature` (number, optional): Sampling temperature
- `maxTokens` (number, optional): Maximum output tokens
- `topP` (number, optional): Nucleus sampling parameter
- `topK` (number, optional): Top-K sampling
- `frequencyPenalty` (number, optional): Frequency penalty
- `presencePenalty` (number, optional): Presence penalty

**Returns:** Promise resolving to:
```javascript
{
  text: string,           // Generated text
  model: string,          // Model that responded
  usage: {
    inputTokens: number,
    outputTokens: number,
    cacheTokens: number,
    reasoningTokens: number,  // Reasoning/thinking tokens (0 for non-reasoning models)
    estimatedCost: number     // USD
  }
}
```

**Throws:**
- `ProviderError`: Transient provider errors (429, 5xx) — safe to retry
- `InputError`: Invalid input (400, 401, 403, 422) — fix input, do not retry

## Examples

### OpenAI

```javascript
import { createAi } from '@pwshub/aisdk'

const ai = createAi()

const result = await ai.ask({
  model: 'openai/gpt-4o',
  apikey: process.env.OPENAI_API_KEY,
  prompt: 'Explain quantum entanglement',
  temperature: 0.7,
  maxTokens: 500,
})
```

### Anthropic

```javascript
const result = await ai.ask({
  model: 'anthropic/claude-sonnet-4-6',
  apikey: process.env.ANTHROPIC_API_KEY,
  prompt: 'Write a haiku about TypeScript',
  temperature: 0.5,
})
```

### Google

```javascript
const result = await ai.ask({
  model: 'google/gemini-2.5-flash',
  apikey: process.env.GOOGLE_API_KEY,
  prompt: 'What is 2+2?',
  providerOptions: {
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    ],
  },
})
```

### Google (Disable Thinking Mode)

Gemini 2.5 Pro and other reasoning models use thinking tokens by default. Disable thinking mode to reduce latency and cost:

```javascript
const result = await ai.ask({
  model: 'google/gemini-2.5-pro',
  apikey: process.env.GOOGLE_API_KEY,
  prompt: 'What is the capital of Vietnam?',
  maxTokens: 256,
  providerOptions: {
    thinkingConfig: {
      thinkingBudget: 0,      // Disable reasoning tokens
      includeThoughts: false, // Don't include thought process in response
    },
  },
})
```

> **Note:** When thinking mode is enabled (default for Gemini 2.5 Pro), the model may use most of the `maxTokens` budget for reasoning. Set a higher `maxTokens` (e.g., 2048) or disable thinking with `thinkingBudget: 0`.

### With Fallbacks

```javascript
try {
  const result = await ai.ask({
    model: 'openai/gpt-4o',
    apikey: process.env.OPENAI_API_KEY,
    prompt: 'Hello',
    fallbacks: ['openai/gpt-4o-mini', 'anthropic/claude-haiku-4-5'],
  })
  
  if (result.model !== 'gpt-4o') {
    console.warn(`Fell back to ${result.model}`)
  }
} catch (error) {
  if (error instanceof ProviderError) {
    console.error('All models failed:', error.message)
  } else if (error instanceof InputError) {
    console.error('Invalid request:', error.message)
  }
}
```

### DashScope (Alibaba)

```javascript
const result = await ai.ask({
  model: 'dashscope/qwen3.5-plus',
  apikey: process.env.DASHSCOPE_API_KEY,
  prompt: 'Hello',
})
```

### DashScope with Custom Region

DashScope endpoints vary by region. Use `gatewayUrl` to specify your region:

```javascript
import { createAi } from '@pwshub/aisdk'

// Singapore region
const aiSingapore = createAi({
  gatewayUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
})

// Virginia region (US)
const aiUS = createAi({
  gatewayUrl: 'https://dashscope-us.aliyuncs.com/compatible-mode/v1',
})

// Beijing region (China)
const aiCN = createAi({
  gatewayUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
})

// Use the regional client
const result = await aiSingapore.ask({
  model: 'dashscope/qwen3.5-plus',
  apikey: process.env.DASHSCOPE_API_KEY,
  prompt: 'Hello from Singapore!',
})
```

### DeepSeek

```javascript
const result = await ai.ask({
  model: 'deepseek/deepseek-chat',
  apikey: process.env.DEEPSEEK_API_KEY,
  prompt: 'Hello',
})
```

### Mistral

```javascript
const result = await ai.ask({
  model: 'mistral/mistral-large-latest',
  apikey: process.env.MISTRAL_API_KEY,
  prompt: 'Hello',
  temperature: 0.7,
})
```

### Mistral with Random Seed

For reproducible results, use `randomSeed`:

```javascript
const result = await ai.ask({
  model: 'mistral/mistral-medium-latest',
  apikey: process.env.MISTRAL_API_KEY,
  prompt: 'Write a poem',
  randomSeed: 42,
})
```

## Supported Models

The library comes with **34 pre-configured models** from all supported providers:

- **OpenAI**: gpt-4.1-nano, gpt-4.1-mini, gpt-4.1, gpt-4o, gpt-4o-mini, gpt-5, gpt-5-mini, gpt-5-nano, gpt-5.1, gpt-5.2, gpt-5.4, o3-mini, o4-mini
- **Anthropic**: claude-haiku-4-5, claude-sonnet-4-6, claude-sonnet-4-5, claude-opus-4-6
- **Google**: gemini-2.5-flash, gemini-2.5-flash-lite, gemini-2.5-pro, gemini-3.1-pro-preview, gemini-3.1-flash-lite-preview
- **DashScope**: qwen-flash, qwen3.5-flash, qwen-plus, qwen3.5-plus, qwen-max, qwen3-max
- **DeepSeek**: deepseek-chat, deepseek-reasoner
- **Mistral**: mistral-small-latest, mistral-medium-latest, mistral-large-latest, codestral-latest

## Model Management

Models are automatically loaded from the built-in registry when the library is imported. You can add custom models or replace the entire list with your own (e.g., from a CMS).

### Adding Custom Models

Use `addModels()` to add models to the existing registry. Only `name` and `provider` are required — other fields get sensible defaults:

```javascript
import { createAi, addModels, listModels } from '@pwshub/aisdk'

// Add minimal model records (auto-generates ID and sets defaults)
addModels([
  { name: 'llama3.2', provider: 'ollama' },
  { name: 'mistral', provider: 'ollama' },
  { name: 'gemma3', provider: 'ollama' },
])

// Add models with custom pricing
addModels([
  {
    name: 'my-custom-model',
    provider: 'openai',
    input_price: 0.5,
    output_price: 1.5,
    max_in: 128000,
    max_out: 16384,
  },
])

// View all available models
console.log(listModels())
```

**Default values for missing fields:**
- `id`: Auto-generated as `${provider}_${name}` (e.g., `ollama_llama3.2`)
- `input_price`, `output_price`, `cache_price`: `0`
- `max_in`: `32000`
- `max_out`: `8000`
- `enable`: `true`

### Loading Models from CMS

Use `setModels()` to replace the entire registry with models from your CMS:

```javascript
import { createAi, setModels } from '@pwshub/aisdk'

// Fetch models from your CMS
const modelsFromCms = await fetch('https://cms.example.com/api/models').then(r => r.json())

// Expected format from CMS:
// [
//   { id: 'uuid-123', name: 'llama3.2', provider: 'ollama', ... },
//   { id: 'uuid-456', name: 'mistral', provider: 'ollama', ... }
// ]

setModels(modelsFromCms)

const ai = createAi()
```

> **Note:** Model `id` can be any unique string (UUID, slug, etc.). The library uses it for internal tracking. When using models from CMS, you reference them by `provider/name` format (see below).

### Using Models

Models MUST be referenced in `provider/name` format:

```javascript
const ai = createAi()

// Correct: provider/name format
await ai.ask({
  model: 'openai/gpt-4o',
  apikey: process.env.OPENAI_API_KEY,
  prompt: 'Hello',
})

// Correct: works for all providers
await ai.ask({
  model: 'ollama/llama3.2',
  apikey: '',
  prompt: 'Hello',
})

await ai.ask({
  model: 'anthropic/claude-sonnet-4-6',
  apikey: process.env.ANTHROPIC_API_KEY,
  prompt: 'Hello',
})
```

### Model Record Format

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `name` | Yes | - | Model name used in API calls |
| `provider` | Yes | - | Provider ID (openai, anthropic, google, dashscope, deepseek, mistral, ollama) |
| `id` | No | `${provider}_${name}` | Unique identifier (auto-generated if not provided) |
| `input_price` | No | `0` | Price per 1M input tokens (USD) |
| `output_price` | No | `0` | Price per 1M output tokens (USD) |
| `cache_price` | No | `0` | Price per 1M cached tokens (USD) |
| `max_in` | No | `32000` | Maximum input tokens (context window) |
| `max_out` | No | `8000` | Maximum output tokens |
| `enable` | No | `true` | Enable/disable the model |
| `supportedParams` | No | Provider defaults | Array of supported parameter names |

## Error Handling

```javascript
import { createAi, ProviderError, InputError } from '@pwshub/aisdk'

const ai = createAi()

try {
  const result = await ai.ask({
    model: 'openai/gpt-4o',
    apikey: process.env.OPENAI_API_KEY,
    prompt: 'Hello',
  })
} catch (error) {
  if (error instanceof ProviderError) {
    // Provider-side error (rate limit, server error)
    // Safe to retry or fallback to another model
    console.error('Provider error:', error.status, error.message)
  } else if (error instanceof InputError) {
    // Client-side error (bad request, invalid API key)
    // Do NOT retry — fix the input
    console.error('Input error:', error.status, error.message)
  }
}
```

## Running Evaluation Scripts

The package includes evaluation scripts to test each provider:

```bash
# OpenAI
OPENAI_API_KEY=your-key npm run eval:openai

# Anthropic
ANTHROPIC_API_KEY=your-key npm run eval:anthropic

# Google
GOOGLE_API_KEY=your-key npm run eval:google

# DashScope
DASHSCOPE_API_KEY=your-key npm run eval:dashscope

# DeepSeek
DEEPSEEK_API_KEY=your-key npm run eval:deepseek

# Mistral
MISTRAL_API_KEY=your-key npm run eval:mistral
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run linter
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

## AI Agents team

- Claude Code: initiator
- Qwen Code: implementer
- Google Gemini: reviewer
- DeepSeek: supporter
- Ollama: supporter

## License

The MIT License (MIT)
