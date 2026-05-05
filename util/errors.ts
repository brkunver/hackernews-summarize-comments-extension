export interface AppErrorInfo {
  message: string
  details?: string
  name?: string
  stack?: string
}

export function getErrorMessage(error: unknown, fallback = "Unknown error"): string {
  if (error instanceof Error) {
    return error.message || fallback
  }

  if (typeof error === "string") {
    return error || fallback
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message

    if (typeof message === "string" && message.trim() !== "") {
      return message
    }
  }

  return fallback
}

export function serializeError(error: unknown, fallback = "Unknown error"): AppErrorInfo {
  if (error instanceof Error) {
    return {
      message: getErrorMessage(error, fallback),
      details: error.stack || error.message,
      name: error.name,
      stack: error.stack,
    }
  }

  if (typeof error === "object" && error !== null) {
    try {
      return {
        message: getErrorMessage(error, fallback),
        details: JSON.stringify(error, null, 2),
      }
    } catch {
      return {
        message: getErrorMessage(error, fallback),
      }
    }
  }

  return {
    message: getErrorMessage(error, fallback),
  }
}
