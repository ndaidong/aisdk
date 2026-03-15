/**
 * @fileoverview Shared utilities for provider evaluation scripts.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { setModels } from '../src/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// models.json is in the same directory as utils.js
const MODELS_PATH = join(__dirname, 'models.json')

/**
 * Loads models from models.json and registers them via setModels().
 * This is used only for evaluation scripts — the SDK itself does not
 * load models from JSON files.
 */
export const loadModelsForEval = () => {
  const models = JSON.parse(readFileSync(MODELS_PATH, 'utf-8'))
  setModels(models)
}

/**
 * @typedef {Object} Usage
 * @property {number} inputTokens
 * @property {number} outputTokens
 * @property {number} cacheTokens
 * @property {number} estimatedCost
 */

/**
 * @typedef {Object} TestResult
 * @property {boolean} success
 * @property {string} [text]
 * @property {Usage} [usage]
 * @property {string} [error]
 * @property {number} [durationMs]
 */

/**
 * Runs a single test case and measures duration.
 * @param {import('../src/index.js').AskFn} ask
 * @param {string} prompt
 * @param {import('../src/index.js').AskParams} [options]
 * @returns {Promise<TestResult>}
 */
export const runTest = async (ask, prompt, options = {}) => {
  const start = Date.now()
  try {
    const result = await ask({
      prompt,
      ...options,
    })
    const duration = Date.now() - start
    return {
      success: true,
      text: result.text,
      usage: result.usage,
      durationMs: duration,
    }
  } catch (error) {
    const duration = Date.now() - start
    return {
      success: false,
      error: error.message,
      durationMs: duration,
    }
  }
}

/**
 * Formats a test result for console output.
 * @param {TestResult} result
 * @param {string} modelId
 */
export const printResult = (result, modelId) => {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Model: ${modelId}`)
  console.log(`Status: ${result.success ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Duration: ${result.durationMs}ms`)

  if (result.success) {
    console.log(`Input tokens: ${result.usage.inputTokens}`)
    console.log(`Reasoning tokens: ${result.usage.reasoningTokens}`)
    console.log(`Output tokens: ${result.usage.outputTokens}`)
    console.log(`Cache tokens: ${result.usage.cacheTokens}`)
    console.log(`Estimated cost: $${result.usage.estimatedCost.toFixed(6)}`)
    console.log(`\nResponse preview (first 200 chars):`)
    console.log(`  ${result.text.slice(0, 200)}${result.text.length > 200 ? '...' : ''}`)
  } else {
    console.log(`Error: ${result.error}`)
  }
  console.log('='.repeat(60))
}

/**
 * Runs multiple test cases for a provider.
 * Loads models from models.json before running tests.
 * @param {import('../src/index.js').AskFn} ask
 * @param {string[]} modelIds
 * @param {string[]} prompts
 * @param {string} apikey
 * @param {import('../src/index.js').AskParams} [options]
 */
export const runEvalSuite = async (ask, modelIds, prompts, apikey, options = {}) => {
  // Load models from models.json for evaluation
  loadModelsForEval()

  const results = []

  for (const modelId of modelIds) {
    for (const prompt of prompts) {
      const result = await runTest(ask, prompt, {
        ...options, model: modelId, apikey,
      })
      results.push({
        modelId, prompt, result,
      })
      printResult(result, modelId)

      // Small delay between tests to avoid rate limits
      await new Promise((resolve) => {
        setTimeout(resolve, 500)
      })
    }
  }

  // Summary
  const passed = results.filter((r) => r.result.success).length
  const failed = results.length - passed
  console.log(`\n\n${'='.repeat(60)}`)
  console.log(`SUMMARY: ${passed} passed, ${failed} failed out of ${results.length} tests`)
  console.log('='.repeat(60))

  return results
}
