import SummarizerPanel from "~/components/SummarizerPanel"
import type { GetCommentsResponse, SummarizerSource } from "~/components/summarizer/types"

async function getActiveTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true })

  return tabs[0]
}

const popupSource: SummarizerSource = {
  getUrl: async () => {
    const tab = await getActiveTab()

    return tab?.url ?? null
  },
  readComments: async ({ withContext, previewOnly }) => {
    const tab = await getActiveTab()

    if (!tab?.id) {
      throw new Error("No active tab found.")
    }

    const response: GetCommentsResponse = await browser.tabs.sendMessage(tab.id, {
      action: "getComments",
      withContext,
      previewOnly,
    })

    return response
  },
}

export default function Popup() {
  return <SummarizerPanel variant="popup" source={popupSource} />
}
