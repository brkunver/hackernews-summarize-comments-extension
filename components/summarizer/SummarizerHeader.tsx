import { Show } from "solid-js"
import { getExtensionVersion } from "~/util/format"

type SummarizerHeaderProps = {
  variant: "popup" | "inline"
  fontScale?: number
  onAdjustFontScale?: (delta: number) => void
  onClose?: () => void
}

export default function SummarizerHeader(props: SummarizerHeaderProps) {
  return (
    <header
      class={
        props.variant === "popup"
          ? "mb-3 flex items-center gap-2.5"
          : "flex shrink-0 items-center gap-2 border-b border-zinc-800 px-3 py-2.5"
      }
    >
      <span
        class={`flex shrink-0 items-center justify-center rounded-lg bg-orange-600 font-bold text-white ${
          props.variant === "popup" ? "h-8 w-8 text-base" : "h-7 w-7 text-sm"
        }`}
      >
        Y
      </span>
      <div class="min-w-0 flex-1">
        <h1
          class={`truncate font-bold ${props.variant === "popup" ? "text-base leading-tight" : "text-sm leading-tight"}`}
        >
          HN Comments Summarizer
        </h1>
        <Show when={props.variant === "popup"}>
          <p class="text-[11px] text-zinc-500">v{getExtensionVersion()}</p>
        </Show>
      </div>
      <Show when={props.onAdjustFontScale}>
        <div class="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onclick={() => props.onAdjustFontScale?.(-1)}
            title={`Decrease text size (${Math.round((props.fontScale ?? 1) * 100)}%)`}
            aria-label="Decrease text size"
            class="flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-semibold text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            A−
          </button>
          <button
            type="button"
            onclick={() => props.onAdjustFontScale?.(1)}
            title={`Increase text size (${Math.round((props.fontScale ?? 1) * 100)}%)`}
            aria-label="Increase text size"
            class="flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-semibold text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            A+
          </button>
        </div>
      </Show>
      <Show when={props.onClose}>
        <button
          type="button"
          onclick={() => props.onClose?.()}
          title="Hide summary panel"
          aria-label="Hide summary panel"
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          <svg
            viewBox="0 0 16 16"
            class="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </Show>
    </header>
  )
}
