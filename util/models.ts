export type AiProvider = "google" | "groq" | "cerebras"

export const GOOGLE_AI_MODEL_FALLBACKS = [
  "gemini-3.1-flash-lite-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
] as const

export const GROQ_AI_MODEL_FALLBACKS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"] as const

export const CEREBRAS_AI_MODEL_FALLBACKS = ["zai-glm-4.7", "gpt-oss-120b", "qwen-3-235b-a22b-instruct-2507"] as const

export const AI_MODEL_FALLBACKS = [
  ...GOOGLE_AI_MODEL_FALLBACKS,
  ...GROQ_AI_MODEL_FALLBACKS,
  ...CEREBRAS_AI_MODEL_FALLBACKS,
] as const

export const AVAILABLE_AI_MODELS = [
  ...GOOGLE_AI_MODEL_FALLBACKS,
  "gemini-3.1-flash-lite",
  "gemini-3.0-flash",
  "gemini-2.5-flash-lite",
  "gemma-3-27b-it",
  ...GROQ_AI_MODEL_FALLBACKS,
  ...CEREBRAS_AI_MODEL_FALLBACKS,
] as const

export type AiModel = (typeof AVAILABLE_AI_MODELS)[number]

const MODEL_PROVIDERS: Record<string, AiProvider> = {
  ...Object.fromEntries(
    AVAILABLE_AI_MODELS.filter(model => model.startsWith("gemini") || model.startsWith("gemma")).map(model => [
      model,
      "google",
    ]),
  ),
  ...Object.fromEntries(GROQ_AI_MODEL_FALLBACKS.map(model => [model, "groq"])),
  ...Object.fromEntries(CEREBRAS_AI_MODEL_FALLBACKS.map(model => [model, "cerebras"])),
}

const PROVIDER_FALLBACKS = {
  google: GOOGLE_AI_MODEL_FALLBACKS,
  groq: GROQ_AI_MODEL_FALLBACKS,
  cerebras: CEREBRAS_AI_MODEL_FALLBACKS,
} satisfies Record<AiProvider, readonly string[]>

export function getModelProvider(model: string): AiProvider | null {
  return MODEL_PROVIDERS[model] ?? null
}

export function getModelsForAvailableProviders(availableProviders: AiProvider[]): string[] {
  const providers = new Set(availableProviders)
  return AVAILABLE_AI_MODELS.filter(model => {
    const provider = getModelProvider(model)
    return provider !== null && providers.has(provider)
  })
}

export function getModelFallbackChain(preferredModel: string, availableProviders: AiProvider[]): string[] {
  const availableProviderSet = new Set(availableProviders)
  const preferredProvider = getModelProvider(preferredModel)
  const preferredProviderIsAvailable = preferredProvider !== null && availableProviderSet.has(preferredProvider)
  const providerOrder: AiProvider[] = [
    ...(preferredProviderIsAvailable ? [preferredProvider] : []),
    ...availableProviders.filter(provider => provider !== preferredProvider),
  ]
  const fallbacks = providerOrder.flatMap(provider => {
    const providerFallbacks: readonly string[] = PROVIDER_FALLBACKS[provider]
    const fallbackStartIndex = providerFallbacks.indexOf(preferredModel)

    if (fallbackStartIndex >= 0) {
      return providerFallbacks.slice(fallbackStartIndex)
    }

    if (provider === preferredProvider) {
      return [preferredModel, ...providerFallbacks]
    }

    return providerFallbacks
  })

  return [...new Set(fallbacks)]
}
