#!/usr/bin/env node
/**
 * @fileoverview OpenAI provider evaluation script.
 *
 * Usage:
 *   OPENAI_API_KEY=your-key node examples/openai.js
 */

import { createAi } from '../src/index.js'
import { runEvalSuite } from './utils.js'

const MODELS = [
  'gpt-4.1-nano',
  'gpt-4o-mini',
  'gpt-5-nano',
]

const PROMPTS = [
  'What is the capital of Vietnam?',
  'Explain quantum entanglement in one paragraph.',
  'Write a haiku about TypeScript.',
]

const main = async () => {
  console.log('Running OpenAI provider evaluation...\n')

  const ai = createAi()

  // Note: temperature is not specified to let each model use its default
  // (gpt-5-nano only supports temperature=1)
  await runEvalSuite(ai.ask, MODELS, PROMPTS, {
    maxTokens: 256,
  })
}

main().catch(console.error)
