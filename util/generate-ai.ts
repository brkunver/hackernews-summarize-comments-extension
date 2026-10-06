import {
  DEFAULT_SUMMARY_TIMEOUT_SECONDS,
  customGoogleModelsStore,
  hiddenGoogleModelsStore,
  modelChainStore,
  modelStore,
  systemPromptStore,
  timeoutStore,
} from "./storage"
import { generateText, smoothStream, streamText } from "ai"
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
import { getErrorMessage, serializeError } from "./errors"

export interface GenerateTextResult {
  text: string
  model: string
  provider: AiProvider
  attemptedModels: string[]
}

export interface GenerateTextModelError {
  modelRef: string
  message: string
  details?: string
  reason: string
}

export interface GenerateTextOptions {
  streaming?: boolean
  onText?: (text: string) => Promise<void> | void
  abortSignal?: AbortSignal
  systemPrompt?: string
  onModelStart?: (modelRef: string) => Promise<void> | void
  onModelError?: (error: GenerateTextModelError) => Promise<void> | void
}

export class SummaryGenerationCancelledError extends Error {
  constructor() {
    super("Summary generation cancelled")
    this.name = "SummaryGenerationCancelledError"
  }
}

function normalizeTimeoutSeconds(timeoutSeconds: number): number {
  return Number.isFinite(timeoutSeconds) && timeoutSeconds > 0 ? timeoutSeconds : DEFAULT_SUMMARY_TIMEOUT_SECONDS
}

function classifyGenerationError(error: unknown): string {
  const serializedError = serializeError(error)
  const text = `${serializedError.name ?? ""} ${serializedError.message} ${serializedError.details ?? ""}`.toLowerCase()

  if (
    text.includes("rate limit") ||
    text.includes("ratelimit") ||
    text.includes("too many requests") ||
    text.includes("429")
  ) {
    return "Rate limit"
  }

  if (
    text.includes("token") ||
    text.includes("context length") ||
    text.includes("context window") ||
    text.includes("maximum context") ||
    text.includes("too large")
  ) {
    return "Token/context limit"
  }

  if (text.includes("timeout") || text.includes("timed out") || text.includes("aborterror")) {
    return "Timeout"
  }

  if (
    text.includes("api key") ||
    text.includes("unauthorized") ||
    text.includes("forbidden") ||
    text.includes("auth") ||
    text.includes("401") ||
    text.includes("403")
  ) {
    return "API key/auth"
  }

  if (
    text.includes("network") ||
    text.includes("fetch failed") ||
    text.includes("failed to fetch") ||
    text.includes("internet") ||
    text.includes("econn") ||
    text.includes("enotfound")
  ) {
    return "Network"
  }

  if (text.includes("permission") || text.includes("permissions")) {
    return "Extension permission"
  }

  if (text.includes("empty summary")) {
    return "Empty response"
  }

  return "Provider error"
}

export async function GenerateText(prompt: string, options: GenerateTextOptions = {}) {
  const { abortSignal, systemPrompt: systemPromptOverride, onModelError, onModelStart } = options
  const [configuredModelChain, preferredModel, customGoogleModels, hiddenGoogleModels] = await Promise.all([
    modelChainStore.getValue(),
    modelStore.getValue(),
    customGoogleModelsStore.getValue(),
    hiddenGoogleModelsStore.getValue(),
  ])
  const [storedSystemPrompt, configuredTimeoutSeconds] = await Promise.all([
    systemPromptStore.getValue(),
    timeoutStore.getValue(),
  ])
  const systemPrompt = systemPromptOverride ?? storedSystemPrompt
  const timeoutMs = normalizeTimeoutSeconds(configuredTimeoutSeconds) * 1000
  const apiKeys = await getProviderApiKeys()
  const availableProviders = getAvailableProviders(apiKeys)
  const attemptedModels = getConfiguredModelChain(
    configuredModelChain,
    preferredModel,
    customGoogleModels,
    hiddenGoogleModels,
  )
  const errors: { modelRef: string; error: unknown }[] = []

  if (availableProviders.length === 0) {
    const providerLabels = AI_PROVIDER_ORDER.map(getProviderLabel).join(", ")
    throw new Error(`No AI provider API key configured. Add an API key for one of: ${providerLabels || "provider"}.`)
  }

  if (attemptedModels.length === 0) {
    throw new Error("No AI model chain configured. Choose at least one model in options.")
  }

  for (const modelRef of attemptedModels) {
    try {
      if (abortSignal?.aborted) {
        throw new SummaryGenerationCancelledError()
      }

      await onModelStart?.(modelRef)

      const provider = getModelProvider(modelRef)
      const model = getModelId(modelRef)

      if (provider === null) {
        throw new Error(`Unknown AI model provider for model: ${modelRef}`)
      }

      const apiKey = getProviderApiKey(apiKeys, provider)

      if (apiKey === "") {
        throw new Error(`Missing API key for ${formatModelWithProvider(modelRef, provider)}`)
      }

      const settings = {
        model: getProviderLanguageModel(provider, apiKey, model),
        system: systemPrompt,
        prompt,
        abortSignal,
        timeout: timeoutMs,
      }
      let text = ""
      if (options.streaming) {
        let streamError: unknown
        const result = streamText({
          ...settings,
          experimental_transform: smoothStream({ chunking: "word", delayInMs: null }),
          onError: event => {
            streamError = event.error
          },
        })
        for await (const word of result.textStream) {
          if (abortSignal?.aborted) {
            throw new SummaryGenerationCancelledError()
          }
          text += word
          await options.onText?.(text)
        }
        if (streamError) {
          throw streamError
        }
        text = await result.text
      } else {
        text = (await generateText(settings)).text
      }

      if (abortSignal?.aborted) {
        throw new SummaryGenerationCancelledError()
      }

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
      if (abortSignal?.aborted || error instanceof SummaryGenerationCancelledError) {
        throw new SummaryGenerationCancelledError()
      }

      errors.push({ modelRef, error })
      const errorInfo = serializeError(error)
      await onModelError?.({
        modelRef,
        message: errorInfo.message,
        details: errorInfo.details,
        reason: classifyGenerationError(error),
      })
      console.warn(`AI model ${modelRef} failed, trying next configured model if available.`, error)
    }
  }

  const errorMessages = errors
    .map(
      ({ modelRef, error }) =>
        `${formatModelWithProvider(modelRef, getModelProvider(modelRef))}: ${getErrorMessage(error)}`,
    )
    .filter(Boolean)
    .join(" | ")

  throw new Error(`All configured AI models failed: ${errorMessages || "unknown error"}`)
}
