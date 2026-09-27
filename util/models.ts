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

const CUSTOM_GOOGLE_MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
export const MAX_CUSTOM_GOOGLE_MODEL_LENGTH = 128

export function sanitizeCustomGoogleModel(value: string): string | null {
  const trimmed = value.trim()

  if (trimmed === "" || trimmed.length > MAX_CUSTOM_GOOGLE_MODEL_LENGTH) {
    return null
  }

  if (!CUSTOM_GOOGLE_MODEL_PATTERN.test(trimmed)) {
    return null
  }

  return trimmed
}

export function normalizeCustomGoogleModels(values: readonly unknown[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  const builtin = new Set<string>(GOOGLE_AI_MODELS)

  for (const value of values) {
    if (typeof value !== "string") {
      continue
    }

    const sanitized = sanitizeCustomGoogleModel(value)

    if (sanitized === null || builtin.has(sanitized) || seen.has(sanitized)) {
      continue
    }

    seen.add(sanitized)
    normalized.push(sanitized)
  }

  return normalized
}

export function getGoogleModelIds(customGoogleModels: readonly string[] = []): string[] {
  return [...GOOGLE_AI_MODELS, ...normalizeCustomGoogleModels(customGoogleModels)]
}

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

export function parseModelRef(
  modelRef: string,
  customGoogleModels: readonly string[] = [],
): { provider: AiProvider; model: string } | null {
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

  const sanitizedCustom = sanitizeCustomGoogleModel(modelRef)

  if (sanitizedCustom !== null && normalizeCustomGoogleModels(customGoogleModels).includes(sanitizedCustom)) {
    return {
      provider: "google",
      model: sanitizedCustom,
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

export function getModelsForAvailableProviders(
  availableProviders: AiProvider[],
  customGoogleModels: readonly string[] = [],
): string[] {
  const providers = new Set(availableProviders)
  return getAvailableModelRefs(customGoogleModels).filter(modelRef => {
    const provider = getModelProvider(modelRef)
    return provider !== null && providers.has(provider)
  })
}

export function getAvailableModelRefs(customGoogleModels: readonly string[] = []): string[] {
  const googleModels = getGoogleModelIds(customGoogleModels).map(model => createModelRef("google", model))

  return [
    ...googleModels,
    ...AI_PROVIDER_MODELS.groq.map(model => createModelRef("groq", model)),
    ...AI_PROVIDER_MODELS.cerebras.map(model => createModelRef("cerebras", model)),
  ]
}

export function normalizeModelChain(
  modelRefs: readonly string[],
  customGoogleModels: readonly string[] = [],
): string[] {
  const seenModels = new Set<string>()
  const normalizedModels: string[] = []

  for (const modelRef of modelRefs) {
    const parsedModel = parseModelRef(modelRef.trim(), customGoogleModels)

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
  customGoogleModels: readonly string[] = [],
): string[] {
  const modelChain = normalizeModelChain(configuredModelChain, customGoogleModels)

  if (modelChain.length > 0) {
    return modelChain
  }

  return normalizeModelChain([legacyPreferredModel], customGoogleModels)
}
