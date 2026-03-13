#!/usr/bin/env node
/**
 * @fileoverview Google provider evaluation script.
 *
 * Usage:
 *   GOOGLE_API_KEY=your-key node examples/google.js
 */

import { createAi } from '../src/index.js'
import { runEvalSuite } from './utils.js'

const MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
]

const PROMPTS = [
  'What is the capital of Vietnam?',
  'Explain quantum entanglement in one paragraph.',
  'Write a haiku about TypeScript.',
]

const main = async () => {
  console.log('Running Google provider evaluation...\n')

  const ai = createAi()

  // Note: temperature is not specified to let each model use its default
  await runEvalSuite(ai.ask, MODELS, PROMPTS, {
    maxTokens: 256,
  })
}

main().catch(console.error)
