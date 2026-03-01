import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { apiKeyStore, modelStore, systemPromptStore } from "./storage"
import { generateText } from "ai"

const googleGenerativeAI = createGoogleGenerativeAI({
  apiKey: await apiKeyStore.getValue(),
})

export async function GenerateText(prompt: string) {
  const model = await modelStore.getValue()
  const systemPrompt = await systemPromptStore.getValue()

  const { text } = await generateText({
    model: googleGenerativeAI(model),
    system: systemPrompt,
    prompt: prompt,
  })

  return text
}
