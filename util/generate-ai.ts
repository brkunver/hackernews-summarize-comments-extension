import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { apiKeyStore, modelStore, systemPromptStore } from "./storage"
import { generateText } from "ai"

let googleGenerativeAI: ReturnType<typeof createGoogleGenerativeAI> | null = null

async function getGoogleGenerativeAI() {
  if (!googleGenerativeAI) {
    googleGenerativeAI = createGoogleGenerativeAI({
      apiKey: await apiKeyStore.getValue(),
    })
  }
  return googleGenerativeAI
}

export async function GenerateText(prompt: string) {
  const model = await modelStore.getValue()
  const systemPrompt = await systemPromptStore.getValue()
  const ai = await getGoogleGenerativeAI()

  const { text } = await generateText({
    model: ai(model),
    system: systemPrompt,
    prompt: prompt,
  })

  return text
}
