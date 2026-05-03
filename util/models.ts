export const MODEL_CHAIN_LENGTH = 5
const MODEL_REF_SEPARATOR = "::"

export const GOOGLE_AI_MODEL_FALLBACKS = [
  "gemini-3.1-flash-lite-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
] as const

export const GROQ_AI_MODEL_FALLBACKS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"] as const

export const CEREBRAS_AI_MODEL_FALLBACKS = ["zai-glm-4.7", "gpt-oss-120b", "qwen-3-235b-a22b-instruct-2507"] as const

export const GOOGLE_AI_MODELS = [
  ...GOOGLE_AI_MODEL_FALLBACKS,
  "gemini-3.1-flash-lite",
  "gemini-3.0-flash",
  "gemini-2.5-flash-lite",
  "gemma-3-27b-it",
] as const

export const AI_PROVIDER_LABELS = {
  google: "Google",
  groq: "Groq",
  cerebras: "Cerebras",
} as const

export type AiProvider = keyof typeof AI_PROVIDER_LABELS

export const AI_PROVIDER_MODELS = {
  google: GOOGLE_AI_MODELS,
  groq: GROQ_AI_MODEL_FALLBACKS,
  cerebras: CEREBRAS_AI_MODEL_FALLBACKS,
} satisfies Record<AiProvider, readonly string[]>

export const AI_PROVIDER_ORDER = Object.keys(AI_PROVIDER_LABELS) as AiProvider[]

export const AVAILABLE_AI_MODELS = AI_PROVIDER_ORDER.flatMap(provider => AI_PROVIDER_MODELS[provider])

export type AiModel = (typeof AVAILABLE_AI_MODELS)[number]
export type AiModelRef = `${AiProvider}${typeof MODEL_REF_SEPARATOR}${string}`

const LEGACY_MODEL_PROVIDERS: Record<string, AiProvider> = {
  ...Object.fromEntries(
    AI_PROVIDER_ORDER.flatMap(provider => AI_PROVIDER_MODELS[provider].map(model => [model, provider])),
  ),
}

export function createModelRef(provider: AiProvider, model: string): AiModelRef {
  return `${provider}${MODEL_REF_SEPARATOR}${model}`
}

export function parseModelRef(modelRef: string): { provider: AiProvider; model: string } | null {
  const separatorIndex = modelRef.indexOf(MODEL_REF_SEPARATOR)

  if (separatorIndex > 0) {
    const provider = modelRef.slice(0, separatorIndex) as AiProvider
    const model = modelRef.slice(separatorIndex + MODEL_REF_SEPARATOR.length)

    if (AI_PROVIDER_ORDER.includes(provider) && model.trim() !== "") {
      return {
        provider,
        model,
      }
    }
  }

  const legacyProvider = LEGACY_MODEL_PROVIDERS[modelRef]

  if (legacyProvider) {
    return {
      provider: legacyProvider,
      model: modelRef,
    }
  }

  return null
}

export function getModelProvider(modelRef: string): AiProvider | null {
  return parseModelRef(modelRef)?.provider ?? null
}

export function getProviderLabel(provider: AiProvider | null): string {
  return provider ? AI_PROVIDER_LABELS[provider] : "Unknown"
}

export function getModelId(modelRef: string): string {
  return parseModelRef(modelRef)?.model ?? modelRef
}

export function formatModelWithProvider(
  modelRef: string,
  provider: AiProvider | null = getModelProvider(modelRef),
): string {
  return `${getProviderLabel(provider)} - ${getModelId(modelRef)}`
}

export function getModelsForAvailableProviders(availableProviders: AiProvider[]): string[] {
  const providers = new Set(availableProviders)
  return getAvailableModelRefs().filter(modelRef => {
    const provider = getModelProvider(modelRef)
    return provider !== null && providers.has(provider)
  })
}

export function getAvailableModelRefs(): string[] {
  return AI_PROVIDER_ORDER.flatMap(provider =>
    AI_PROVIDER_MODELS[provider].map(model => createModelRef(provider, model)),
  )
}

export function normalizeModelChain(modelRefs: readonly string[]): string[] {
  const seenModels = new Set<string>()
  const normalizedModels: string[] = []

  for (const modelRef of modelRefs) {
    const parsedModel = parseModelRef(modelRef.trim())

    if (parsedModel === null) {
      continue
    }

    const normalizedModelRef = createModelRef(parsedModel.provider, parsedModel.model)

    if (seenModels.has(normalizedModelRef)) {
      continue
    }

    seenModels.add(normalizedModelRef)
    normalizedModels.push(normalizedModelRef)

    if (normalizedModels.length >= MODEL_CHAIN_LENGTH) {
      break
    }
  }

  return normalizedModels
}

export function getConfiguredModelChain(
  configuredModelChain: readonly string[],
  legacyPreferredModel: string,
): string[] {
  const modelChain = normalizeModelChain(configuredModelChain)

  if (modelChain.length > 0) {
    return modelChain
  }

  return normalizeModelChain([legacyPreferredModel])
}
