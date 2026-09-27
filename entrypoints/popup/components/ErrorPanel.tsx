import { createMemo, For, Show } from "solid-js"

const ALL_MODELS_FAILED_PREFIX = "All configured AI models failed: "

type FormattedErrorItem = {
  model: string
  message: string
}

type ErrorPanelProps = {
  error: string
  errorDetails: string
}

export default function ErrorPanel(props: ErrorPanelProps) {
  const formattedErrorItems = createMemo<FormattedErrorItem[]>(() => {
    if (!props.error.startsWith(ALL_MODELS_FAILED_PREFIX)) {
      return []
    }

    return props.error
      .slice(ALL_MODELS_FAILED_PREFIX.length)
      .split(" | ")
      .map(item => {
        const separatorIndex = item.indexOf(": ")

        if (separatorIndex === -1) {
          return {
            model: "Unknown model",
            message: item.trim(),
          }
        }

        return {
          model: item.slice(0, separatorIndex).trim(),
          message: item.slice(separatorIndex + 2).trim(),
        }
      })
      .filter(item => item.message !== "")
  })

  return (
    <div class="rounded-xl border border-red-800 bg-red-950/60 p-3 text-red-200">
      <p class="font-semibold">
        {props.error.startsWith(ALL_MODELS_FAILED_PREFIX) ? "All configured AI models failed" : "Error"}
      </p>
      <Show
        when={formattedErrorItems().length > 0}
        fallback={<p class="mt-1 text-sm wrap-break-word">{props.error}</p>}
      >
        <ul class="mt-2 space-y-2 text-sm">
          <For each={formattedErrorItems()}>
            {item => (
              <li class="flex gap-2">
                <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded bg-red-500"></span>
                <span class="min-w-0">
                  <strong class="font-semibold text-red-100">{item.model}</strong>
                  <span class="block wrap-break-word">{item.message}</span>
                </span>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <Show when={props.errorDetails}>
        <details class="mt-2 text-xs">
          <summary class="cursor-pointer font-medium">Details</summary>
          <pre class="mt-2 max-h-32 overflow-auto rounded bg-red-950 p-2 text-[11px] whitespace-pre-wrap wrap-break-word">
            {props.errorDetails}
          </pre>
        </details>
      </Show>
    </div>
  )
}
