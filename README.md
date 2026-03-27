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
- **Request timeout**: Configurable timeout per client instance
- **Request/Response hooks**: `onRequest` and `onResponse` callbacks for observability
- **Configurable logging**: Custom or silent loggers via `setLogger()`, `getLogger()`, `noopLogger`
- **Instance-based registry**: Each `createAi()` gets isolated model registry
- **Custom models at creation**: Load custom models via `createAi({ models: [...] })`
- **Stop sequences**: Control generation with `stop: string | string[]`
- **Retry-After support**: `retryAfter` property on `ProviderError` for rate limit handling
- **API key validation**: Pre-request validation with provider-specific format warnings
- **Empty prompt validation**: Rejects empty prompts and message content

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
- `timeout` (optional): Request timeout in milliseconds (default: 30000)
- `models` (optional): Custom model registry to load on creation
- `onRequest` (optional): Hook called before each request with context `{ model, provider, url, headers, body }`
- `onResponse` (optional): Hook called after each response with context `{ model, provider, url, headers, body, status, data, duration }`

**Returns:** An object with:
- `ask(params)`: Send a generation request
- `listModels()`: Get all available models from the registry
- `addModels(models)`: Add models to this instance's registry

### `ai.ask(params)`

Sends a text generation request.

**Parameters:**
- `model` (string, required): Use `provider/name` format (e.g., `anthropic/claude-sonnet-4-6`)
- `apikey` (string, required): API key for the provider. With ollama local, set to any string.
- `prompt` (string, required): The user message (or use `messages` array)
- `system` (string, optional): Optional system prompt
- `messages` (array, optional): Array of `{ role, content }` objects for multi-turn conversations
- `fallbacks` (string[], optional): Ordered list of fallback models (same format as `model`)
- `providerOptions` (object, optional): Provider-specific options
- `temperature` (number, optional): Sampling temperature
- `maxTokens` (number, optional): Maximum output tokens
- `topP` (number, optional): Nucleus sampling parameter
- `topK` (number, optional): Top-K sampling
- `frequencyPenalty` (number, optional): Frequency penalty
- `presencePenalty` (number, optional): Presence penalty
- `stop` (string | string[], optional): Stop sequences to end generation
- `seed` (number, optional): Random seed for reproducible output

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

### With Stop Sequences

Control where generation stops using `stop` parameter:

```javascript
// Single stop sequence
const result = await ai.ask({
  model: 'openai/gpt-4o',
  apikey: process.env.OPENAI_API_KEY,
  prompt: 'Complete this sentence: The quick brown fox',
  stop: '.',  // Stop at first period
})

// Multiple stop sequences
const result = await ai.ask({
  model: 'anthropic/claude-sonnet-4-6',
  apikey: process.env.ANTHROPIC_API_KEY,
  prompt: 'Write a story',
  stop: ['\n\n', 'THE END'],  // Stop at double newline or "THE END"
})
```

### With Request Timeout

Set a custom timeout for requests:

```javascript
import { createAi } from '@pwshub/aisdk'

const ai = createAi({
  timeout: 5000,  // 5 second timeout
})

try {
  const result = await ai.ask({
    model: 'openai/gpt-4o',
    apikey: process.env.OPENAI_API_KEY,
    prompt: 'Hello',
  })
} catch (error) {
  if (error.message.includes('timeout')) {
    console.error('Request timed out after 5 seconds')
  }
}
```

### With Request/Response Hooks

Add observability with hooks:

```javascript
import { createAi } from '@pwshub/aisdk'

const ai = createAi({
  onRequest: (context) => {
    console.log(`Sending request to ${context.provider}/${context.model}`)
    console.log(`URL: ${context.url}`)
    // context.headers and context.body are also available
  },
  onResponse: (context) => {
    console.log(`Response from ${context.provider}/${context.model}`)
    console.log(`Status: ${context.status}, Duration: ${context.duration}ms`)
    // context.data contains the raw response
  },
})

const result = await ai.ask({
  model: 'openai/gpt-4o',
  apikey: process.env.OPENAI_API_KEY,
  prompt: 'Hello',
})
```

### Custom Logger

Configure logging behavior:

```javascript
import { createAi, setLogger, noopLogger } from '@pwshub/aisdk'

// Use a custom logger
setLogger({
  warn: (msg) => myLogger.warning(msg),
  error: (msg) => myLogger.error(msg),
  debug: (msg) => myLogger.debug(msg),
})

// Or silence all logging (production)
setLogger(noopLogger)

// Get current logger
const logger = getLogger()

const ai = createAi()
```

### Instance-Based Registry

Each `createAi()` instance has its own isolated model registry:

```javascript
import { createAi, addModels } from '@pwshub/aisdk'

// Create two independent instances
const ai1 = createAi()
const ai2 = createAi()

// Add models to ai1 only
ai1.addModels([
  { name: 'llama3.2', provider: 'ollama' },
])

// ai1 has the custom model
console.log(ai1.listModels().length) // includes llama3.2

// ai2 doesn't have it (isolated registry)
console.log(ai2.listModels().length) // default models only
```

### Custom Models at Creation

Load custom models when creating the AI client:

```javascript
import { createAi } from '@pwshub/aisdk'

const customModels = [
  { name: 'llama3.2', provider: 'ollama' },
  { name: 'mistral', provider: 'ollama' },
  {
    name: 'gpt-4o-custom',
    provider: 'openai',
    input_price: 0.5,
    output_price: 1.5,
  },
]

const ai = createAi({
  models: customModels,
})

// This instance only has the custom models
console.log(ai.listModels())
```

## Supported Models

The library comes with just a few popular models configured in src/models.js

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
    
    // For rate limits (429), check retryAfter for recommended wait time
    if (error.retryAfter) {
      console.log(`Retry after ${error.retryAfter} seconds`)
    }
  } else if (error instanceof InputError) {
    // Client-side error (bad request, invalid API key)
    // Do NOT retry — fix the input
    console.error('Input error:', error.status, error.message)
  }
}
```

**ProviderError properties:**
- `status`: HTTP status code (429, 5xx, etc.)
- `provider`: Provider ID (e.g., 'openai', 'anthropic')
- `model`: Model identifier that failed
- `raw`: Raw response data from provider
- `retryAfter`: Seconds to wait before retrying (only for 429 responses with Retry-After header)

**InputError properties:**
- `status`: HTTP status code (400, 401, 403, 422)
- `provider`: Provider ID
- `model`: Model identifier
- `raw`: Raw response data from provider

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
