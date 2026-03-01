<script lang="ts">
  let isLoading = $state(false)
  let buttonText = $state("Get Comments")

  async function getComments() {
    isLoading = true
    buttonText = "Loading..."

    try {
      // Get the active tab
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true })

      if (!tab.id) {
        console.error("No active tab found")
        return
      }

      // Send message to content script
      const response = await browser.tabs.sendMessage(tab.id, { action: "getComments" })

      if (response.success) {
        console.log("Comments received:", response.comments)
      } else {
        console.error("Error getting comments:", response.error)
      }
    } catch (error) {
      console.error("Error:", error)
    } finally {
      isLoading = false
      buttonText = "Get Comments"
    }
  }
</script>

<main class="p-4 min-w-[300px]">
  <h1 class="text-2xl font-bold mb-4">HN Comments Summarizer</h1>

  <button
    onclick={getComments}
    disabled={isLoading}
    class="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-semibold py-2 px-4 rounded transition-colors"
  >
    {buttonText}
  </button>
</main>
