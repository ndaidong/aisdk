#!/usr/bin/env node
/**
 * @fileoverview Ollama provider evaluation script.
 *
 * Ollama runs locally, but may require an API key for remote instances.
 * Users can specify a custom base URL via gatewayUrl if needed.
 *
 * Usage:
 *   OLLAMA_API_KEY=your-key node examples/ollama.js
 *
 * With custom base URL:
 *   OLLAMA_API_KEY=your-key OLLAMA_BASE_URL=https://ollama.example.com node examples/ollama.js
 */

import { createAi, addModels, listModels } from '../src/index.js'
import { runEvalSuite } from './utils.js'

addModels([
  {
    name: 'qwen3.5:2b',
    provider: 'ollama',
  },
  {
    name: 'qwen2.5:7b',
    provider: 'ollama',
  },
])

console.log(listModels())

const MODELS = [
  'ollama/qwen2.5:7b',
]

const PROMPTS = [
  'What is the capital of Vietnam?',
  'Explain quantum entanglement in one paragraph.',
  'Write a haiku about TypeScript.',
]

const main = async () => {
  if (MODELS.length === 0) {
    console.log('No models configured. Add model names to the MODELS array in ollama.js')
    console.log('Example: const MODELS = ["ollama/llama3.2", "ollama/mistral", "ollama/gemma3"]')
    console.log('\nMake sure Ollama is running and the models are installed:')
    console.log('  ollama serve')
    console.log('  ollama pull llama3.2')
    return
  }

  const apikey = process.env.OLLAMA_API_KEY || ''
  const baseUrl = process.env.OLLAMA_BASE_URL

  const ai = createAi(baseUrl ? { gatewayUrl: baseUrl } : {})

  console.log('Running Ollama provider evaluation...\n')
  console.log(`Using models: ${MODELS.join(', ')}`)
  if (baseUrl) {
    console.log(`Custom base URL: ${baseUrl}`)
  }
  if (apikey) {
    console.log('Using API key authentication')
  }
  console.log()

  await runEvalSuite(ai.ask, MODELS, PROMPTS, apikey, { maxTokens: 256 })
}

main().catch(console.error)
