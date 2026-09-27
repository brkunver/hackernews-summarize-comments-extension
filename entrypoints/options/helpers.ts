import { MODEL_CHAIN_LENGTH } from "~/util/models"
import {
  DEFAULT_MAX_COMMENTS,
  DEFAULT_MAX_COMMENT_DEPTH,
  DEFAULT_SUMMARY_TIMEOUT_SECONDS,
  MAX_COMMENT_DEPTH_LIMIT,
} from "~/util/storage"

export function normalizeTimeout(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_SUMMARY_TIMEOUT_SECONDS
}

export function normalizeMaxComments(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_MAX_COMMENTS
  }

  if (value <= 0) {
    return value === 0 ? 0 : -1
  }

  return Math.floor(value)
}

export function normalizeMaxDepth(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_MAX_COMMENT_DEPTH
  }

  if (value <= 0) {
    return value === 0 ? 0 : -1
  }

  return Math.min(Math.floor(value), MAX_COMMENT_DEPTH_LIMIT)
}

export function padModelChain(modelChain: readonly string[]): string[] {
  return [
    ...modelChain.slice(0, MODEL_CHAIN_LENGTH),
    ...Array(Math.max(0, MODEL_CHAIN_LENGTH - modelChain.length)).fill(""),
  ]
}
