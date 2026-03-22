#!/usr/bin/env node
/**
 * @fileoverview Mistral provider evaluation script.
 *
 * Usage:
 *   MISTRAL_API_KEY=your-key node examples/mistral.js
 */

import { createAi } from '../src/index.js'
import { runEvalSuite } from './utils.js'

const MODELS = [
  'mistral/mistral-small-latest',
  'mistral/mistral-medium-latest',
  'mistral/mistral-large-latest',
]

const PROMPTS = [
  'What is the capital of Vietnam?',
  'Explain quantum entanglement in one paragraph.',
  'Write a haiku about TypeScript.',
]

const main = async () => {
  const apikey = process.env.MISTRAL_API_KEY
  if (!apikey) {
    throw new Error('Missing env var: MISTRAL_API_KEY')
  }

  console.log('Running Mistral provider evaluation...\n')

  const ai = createAi()

  await runEvalSuite(ai.ask, MODELS, PROMPTS, apikey, { maxTokens: 256 })
}

main().catch(console.error)
