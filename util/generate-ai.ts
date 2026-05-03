import { modelChainStore, modelStore, systemPromptStore } from "./storage"
import { generateText } from "ai"
import {
  type AiProvider,
  AI_PROVIDER_ORDER,
  formatModelWithProvider,
  getConfiguredModelChain,
  getModelId,
  getModelProvider,
  getProviderLabel,
} from "./models"
import { getAvailableProviders, getProviderApiKey, getProviderApiKeys, getProviderLanguageModel } from "./providers"

export interface GenerateTextResult {
  text: string
  model: string
  provider: AiProvider
  attemptedModels: string[]
}

export async function GenerateText(prompt: string) {
  const [configuredModelChain, preferredModel] = await Promise.all([modelChainStore.getValue(), modelStore.getValue()])
  const systemPrompt = await systemPromptStore.getValue()
  const apiKeys = await getProviderApiKeys()
  const availableProviders = getAvailableProviders(apiKeys)
  const attemptedModels = getConfiguredModelChain(configuredModelChain, preferredModel)
  const errors: unknown[] = []

  if (availableProviders.length === 0) {
    const providerLabels = AI_PROVIDER_ORDER.map(getProviderLabel).join(", ")
    throw new Error(`No AI provider API key configured. Add an API key for one of: ${providerLabels || "provider"}.`)
  }

  if (attemptedModels.length === 0) {
    throw new Error("No AI model chain configured. Choose at least one model in options.")
  }

  for (const modelRef of attemptedModels) {
    try {
      const provider = getModelProvider(modelRef)
      const model = getModelId(modelRef)

      if (provider === null) {
        throw new Error(`Unknown AI model provider for model: ${modelRef}`)
      }

      const apiKey = getProviderApiKey(apiKeys, provider)

      if (apiKey === "") {
        throw new Error(`Missing API key for ${formatModelWithProvider(modelRef, provider)}`)
      }

      const { text } = await generateText({
        model: getProviderLanguageModel(provider, apiKey, model),
        system: systemPrompt,
        prompt,
      })

      if (text.trim() === "") {
        throw new Error("AI returned empty summary")
      }

      return {
        text,
        model,
        provider,
        attemptedModels,
      } satisfies GenerateTextResult
    } catch (error) {
      errors.push(error)
      console.warn(`AI model ${modelRef} failed, trying next configured model if available.`, error)
    }
  }

  const errorMessages = errors
    .map(error => (error instanceof Error ? error.message : String(error)))
    .filter(Boolean)
    .join(" | ")

  throw new Error(`All configured AI models failed: ${errorMessages || "unknown error"}`)
}
