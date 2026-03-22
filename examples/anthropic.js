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
  'anthropic/claude-haiku-4-5',
  'anthropic/claude-sonnet-4-6',
  'anthropic/claude-opus-4-6',
]

const PROMPTS = [
  'What is the capital of Vietnam?',
  'Explain quantum entanglement in one paragraph.',
  'Write a haiku about TypeScript.',
]

const main = async () => {
  const apikey = process.env.ANTHROPIC_API_KEY
  if (!apikey) {
    throw new Error('Missing env var: ANTHROPIC_API_KEY')
  }

  console.log('Running Anthropic provider evaluation...\n')

  const ai = createAi()

  // Note: temperature is not specified to let each model use its default
  await runEvalSuite(ai.ask, MODELS, PROMPTS, apikey, { maxTokens: 256 })
}

main().catch(console.error)
