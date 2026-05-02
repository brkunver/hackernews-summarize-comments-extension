import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createGroq } from "@ai-sdk/groq"
import { createCerebras } from "@ai-sdk/cerebras"
import { apiKeyStore, cerebrasApiKeyStore, groqApiKeyStore, modelStore, systemPromptStore } from "./storage"
import { generateText } from "ai"
import { type AiProvider, getModelFallbackChain, getModelProvider } from "./models"

let googleGenerativeAI: ReturnType<typeof createGoogleGenerativeAI> | null = null
let googleGenerativeAIApiKey: string | null = null
let groqAI: ReturnType<typeof createGroq> | null = null
let groqAIApiKey: string | null = null
let cerebrasAI: ReturnType<typeof createCerebras> | null = null
let cerebrasAIApiKey: string | null = null

function getGoogleGenerativeAI(apiKey: string) {
  if (!googleGenerativeAI || googleGenerativeAIApiKey !== apiKey) {
    googleGenerativeAI = createGoogleGenerativeAI({
      apiKey,
    })
    googleGenerativeAIApiKey = apiKey
  }

  return googleGenerativeAI
}

function getGroqAI(apiKey: string) {
  if (!groqAI || groqAIApiKey !== apiKey) {
    groqAI = createGroq({
      apiKey,
    })
    groqAIApiKey = apiKey
  }

  return groqAI
}

function getCerebrasAI(apiKey: string) {
  if (!cerebrasAI || cerebrasAIApiKey !== apiKey) {
    cerebrasAI = createCerebras({
      apiKey,
    })
    cerebrasAIApiKey = apiKey
  }

  return cerebrasAI
}

function getAvailableProviders(apiKeys: Record<AiProvider, string>): AiProvider[] {
  return (Object.entries(apiKeys) as [AiProvider, string][])
    .filter(([, apiKey]) => apiKey.trim() !== "")
    .map(([provider]) => provider)
}

export interface GenerateTextResult {
  text: string
  model: string
  attemptedModels: string[]
}

export async function GenerateText(prompt: string) {
  const preferredModel = await modelStore.getValue()
  const systemPrompt = await systemPromptStore.getValue()
  const apiKeys = {
    google: await apiKeyStore.getValue(),
    groq: await groqApiKeyStore.getValue(),
    cerebras: await cerebrasApiKeyStore.getValue(),
  } satisfies Record<AiProvider, string>
  const availableProviders = getAvailableProviders(apiKeys)
  const attemptedModels = getModelFallbackChain(preferredModel, availableProviders)
  const errors: unknown[] = []

  if (attemptedModels.length === 0) {
    throw new Error("No AI provider API key configured. Add a Google AI, Groq, or Cerebras API key in options.")
  }

  for (const model of attemptedModels) {
    try {
      const provider = getModelProvider(model)

      if (provider === null) {
        throw new Error(`Unknown AI model provider for model: ${model}`)
      }

      const ai =
        provider === "google"
          ? getGoogleGenerativeAI(apiKeys.google)
          : provider === "groq"
            ? getGroqAI(apiKeys.groq)
            : getCerebrasAI(apiKeys.cerebras)

      const { text } = await generateText({
        model: ai(model),
        system: systemPrompt,
        prompt,
      })

      if (text.trim() === "") {
        throw new Error("AI returned empty summary")
      }

      return {
        text,
        model,
        attemptedModels,
      } satisfies GenerateTextResult
    } catch (error) {
      errors.push(error)
      console.warn(`AI model ${model} failed, trying fallback if available.`, error)
    }
  }

  const errorMessages = errors
    .map(error => (error instanceof Error ? error.message : String(error)))
    .filter(Boolean)
    .join(" | ")

  throw new Error(`All AI models failed: ${errorMessages || "unknown error"}`)
}
