import { getErrorMessage } from "~/util/errors"
import { lastSummaryErrorStore, type LastSummaryError } from "~/util/storage"
import type { SummarizerState } from "./summarizer-state"

export function setSummarizerError(
  state: SummarizerState,
  message: string,
  details = "",
  action?: LastSummaryError["action"],
) {
  state.setError(message)
  state.setErrorDetails(details)

  if (action && state.currentUrl()) {
    void rememberLastSummaryError(state, action, message, details)
  }
}

export function setSummarizerErrorFromUnknown(
  state: SummarizerState,
  err: unknown,
  fallback: string,
  action?: LastSummaryError["action"],
) {
  state.setError(getErrorMessage(err, fallback))
  state.setErrorDetails(err instanceof Error ? err.stack || err.message : "")

  if (action && state.currentUrl()) {
    void rememberLastSummaryError(state, action, state.error(), state.errorDetails())
  }
}

export async function rememberLastSummaryError(
  state: SummarizerState,
  action: LastSummaryError["action"],
  message: string,
  details = "",
) {
  try {
    await lastSummaryErrorStore.setValue({
      url: state.currentUrl(),
      action,
      message,
      details,
      timestamp: Date.now(),
    })
  } catch (err) {
    console.warn("Failed to store summarizer error details:", err)
  }
}
