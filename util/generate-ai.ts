import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { apiKeyStore, modelStore, systemPromptStore } from "./storage"
import { generateText } from "ai"
import { getModelFallbackChain } from "./models"

let googleGenerativeAI: ReturnType<typeof createGoogleGenerativeAI> | null = null
let googleGenerativeAIApiKey: string | null = null

async function getGoogleGenerativeAI() {
  const apiKey = await apiKeyStore.getValue()

  if (!googleGenerativeAI || googleGenerativeAIApiKey !== apiKey) {
    googleGenerativeAI = createGoogleGenerativeAI({
      apiKey,
    })
    googleGenerativeAIApiKey = apiKey
  }

  return googleGenerativeAI
}

export interface GenerateTextResult {
  text: string
  model: string
  attemptedModels: string[]
}

export async function GenerateText(prompt: string) {
  const preferredModel = await modelStore.getValue()
  const systemPrompt = await systemPromptStore.getValue()
  const ai = await getGoogleGenerativeAI()
  const attemptedModels = getModelFallbackChain(preferredModel)
  const errors: unknown[] = []

  for (const model of attemptedModels) {
    try {
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
