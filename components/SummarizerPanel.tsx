import { createSummarizer } from "./summarizer/create-summarizer"
import SummarizerBody from "./summarizer/SummarizerBody"
import SummarizerHeader from "./summarizer/SummarizerHeader"
import type { SummarizerSource } from "./summarizer/types"

type SummarizerPanelProps = {
  variant: "popup" | "inline"
  source: SummarizerSource
  onClose?: () => void
  fontScale?: number
  onAdjustFontScale?: (delta: number) => void
}

export default function SummarizerPanel(props: SummarizerPanelProps) {
  const state = createSummarizer(props.source)

  return (
    <main
      class={
        props.variant === "popup"
          ? "min-w-107.5 max-w-155 bg-zinc-950 p-4 text-zinc-100"
          : "flex h-full max-h-[calc(100vh-4.5rem)] flex-col bg-zinc-950 text-zinc-100"
      }
    >
      <SummarizerHeader
        variant={props.variant}
        fontScale={props.fontScale}
        onAdjustFontScale={props.onAdjustFontScale}
        onClose={props.onClose}
      />
      <SummarizerBody state={state} showOptions={props.variant === "popup"} scrollable={props.variant === "inline"} />
    </main>
  )
}
