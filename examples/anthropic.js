#!/usr/bin/env node
/**
 * @fileoverview Anthropic provider evaluation script.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=your-key node examples/anthropic.js
 */

import { createAi } from '../src/index.js'
import { runEvalSuite } from './utils.js'

const MODELS = [
  'claude-haiku-4-5',
  'claude-sonnet-4-6',
  'claude-opus-4-6',
]

const PROMPTS = [
  'What is the capital of Vietnam?',
  'Explain quantum entanglement in one paragraph.',
  'Write a haiku about TypeScript.',
]

const main = async () => {
  console.log('Running Anthropic provider evaluation...\n')

  const ai = createAi()

  // Note: temperature is not specified to let each model use its default
  await runEvalSuite(ai.ask, MODELS, PROMPTS, {
    maxTokens: 256,
  })
}

main().catch(console.error)
