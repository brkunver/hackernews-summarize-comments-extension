export const AI_MODEL_FALLBACKS = [
  "gemini-3.1-flash-lite-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
] as const

export const AVAILABLE_AI_MODELS = [
  ...AI_MODEL_FALLBACKS,
  "gemini-3.1-flash-lite",
  "gemini-3.0-flash",
  "gemini-2.5-flash-lite",
  "gemma-3-27b-it",
] as const

export type AiModel = (typeof AVAILABLE_AI_MODELS)[number]

export function getModelFallbackChain(preferredModel: string): string[] {
  const fallbackStartIndex = AI_MODEL_FALLBACKS.indexOf(preferredModel as (typeof AI_MODEL_FALLBACKS)[number])
  const fallbacks =
    fallbackStartIndex >= 0 ? AI_MODEL_FALLBACKS.slice(fallbackStartIndex) : [preferredModel, ...AI_MODEL_FALLBACKS]

  return [...new Set(fallbacks)]
}
