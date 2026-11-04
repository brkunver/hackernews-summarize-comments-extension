import { getConfiguredModelChain, getModelProvider } from "~/util/models"
import { customGoogleModelsStore, hiddenGoogleModelsStore, modelChainStore, modelStore } from "~/util/storage"

export async function readConfiguredModel() {
  const [configuredModelChain, legacyModel, customGoogleModels, hiddenGoogleModels] = await Promise.all([
    modelChainStore.getValue(),
    modelStore.getValue(),
    customGoogleModelsStore.getValue(),
    hiddenGoogleModelsStore.getValue(),
  ])
  const name =
    getConfiguredModelChain(configuredModelChain, legacyModel, customGoogleModels, hiddenGoogleModels)[0] ?? ""

  return {
    name,
    provider: getModelProvider(name),
  }
}
