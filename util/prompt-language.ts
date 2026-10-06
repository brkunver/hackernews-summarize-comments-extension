export const DEFAULT_OUTPUT_LANGUAGE = "English"

export function normalizeOutputLanguage(language: string) {
  return language.trim() || DEFAULT_OUTPUT_LANGUAGE
}

export function resolvePromptLanguage(prompt: string, language: string) {
  return prompt.replaceAll("{language}", () => normalizeOutputLanguage(language))
}
