import { createCerebras } from "@ai-sdk/cerebras"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createGroq } from "@ai-sdk/groq"
import type { LanguageModel } from "ai"
import { apiKeyStore, cerebrasApiKeyStore, groqApiKeyStore } from "./storage"
import { AI_PROVIDER_ORDER, type AiProvider } from "./models"

interface StringStorageItem {
  getValue: () => Promise<string>
  setValue: (value: string) => Promise<void>
}

export interface AiProviderApiKeyField {
  provider: AiProvider
  inputId: string
  label: string
  placeholder: string
  helpText: string
  store: StringStorageItem
}

const AI_PROVIDER_API_KEY_FIELD_BY_PROVIDER = {
  google: {
    inputId: "apiKey",
    label: "Google AI API Key",
    placeholder: "Enter your Google AI API key",
    helpText: "Your API key is stored locally and sent only to Google to generate summaries",
    store: apiKeyStore,
  },
  groq: {
    inputId: "groqApiKey",
    label: "Groq API Key",
    placeholder: "Enter your Groq API key",
    helpText: "Stored locally and sent only to Groq to generate summaries",
    store: groqApiKeyStore,
  },
  cerebras: {
    inputId: "cerebrasApiKey",
    label: "Cerebras API Key",
    placeholder: "Enter your Cerebras API key",
    helpText: "Stored locally and sent only to Cerebras to generate summaries",
    store: cerebrasApiKeyStore,
  },
} satisfies Record<AiProvider, Omit<AiProviderApiKeyField, "provider">>

export const AI_PROVIDER_API_KEY_FIELDS = AI_PROVIDER_ORDER.map(provider => ({
  provider,
  ...AI_PROVIDER_API_KEY_FIELD_BY_PROVIDER[provider],
}))

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

const AI_PROVIDER_MODEL_FACTORIES = {
  google: (apiKey: string, model: string) => getGoogleGenerativeAI(apiKey)(model) as LanguageModel,
  groq: (apiKey: string, model: string) => getGroqAI(apiKey)(model) as LanguageModel,
  cerebras: (apiKey: string, model: string) => getCerebrasAI(apiKey)(model) as LanguageModel,
} satisfies Record<AiProvider, (apiKey: string, model: string) => LanguageModel>

export function createEmptyProviderApiKeys(): Record<AiProvider, string> {
  return Object.fromEntries(AI_PROVIDER_ORDER.map(provider => [provider, ""])) as Record<AiProvider, string>
}

export async function getProviderApiKeys(): Promise<Record<AiProvider, string>> {
  const apiKeyEntries = await Promise.all(
    AI_PROVIDER_API_KEY_FIELDS.map(async field => [field.provider, await field.store.getValue()] as const),
  )

  return Object.fromEntries(apiKeyEntries) as Record<AiProvider, string>
}

export async function setProviderApiKeys(apiKeys: Record<AiProvider, string>) {
  await Promise.all(AI_PROVIDER_API_KEY_FIELDS.map(field => field.store.setValue(apiKeys[field.provider] ?? "")))
}

export function getAvailableProviders(apiKeys: Record<AiProvider, string>): AiProvider[] {
  return AI_PROVIDER_ORDER.filter(provider => apiKeys[provider]?.trim() !== "")
}

export function getProviderApiKey(apiKeys: Record<AiProvider, string>, provider: AiProvider): string {
  return apiKeys[provider]?.trim() ?? ""
}

export function getProviderLanguageModel(provider: AiProvider, apiKey: string, model: string): LanguageModel {
  return AI_PROVIDER_MODEL_FACTORIES[provider](apiKey, model)
}
