import { createSignal, onMount, Show } from "solid-js"
import { render } from "solid-js/web"
import type { ContentScriptContext } from "#imports"
import SummarizerPanel from "~/components/SummarizerPanel"
import type { SummarizerSource } from "~/components/summarizer/types"
import { collectHNComments } from "~/util/collect-comments"
import { contentUiFontScaleStore, contentUiHeightStore, contentUiOpenStore, contentUiWidthStore } from "~/util/storage"

const FONT_SCALE_MIN = 0.8
const FONT_SCALE_MAX = 1.4
const FONT_SCALE_STEP = 0.1
const DEFAULT_FONT_SCALE = 1

const PANEL_DEFAULT_WIDTH = 336
const PANEL_MIN_WIDTH = 260
const PANEL_MAX_WIDTH = 640
const PANEL_MIN_HEIGHT = 240
const PANEL_TOP_OFFSET = 56
const PANEL_VIEWPORT_MARGIN = 12

function clampFontScale(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_FONT_SCALE
  }

  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, Math.round(value * 100) / 100))
}

function getMaxPanelWidth() {
  return Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, window.innerWidth - PANEL_VIEWPORT_MARGIN * 2))
}

function getMaxPanelHeight() {
  return Math.max(PANEL_MIN_HEIGHT, window.innerHeight - PANEL_TOP_OFFSET - PANEL_VIEWPORT_MARGIN)
}

function clampPanelWidth(value: number) {
  if (!Number.isFinite(value)) {
    return PANEL_DEFAULT_WIDTH
  }

  return Math.round(Math.min(getMaxPanelWidth(), Math.max(PANEL_MIN_WIDTH, value)))
}

function clampPanelHeight(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }

  return Math.round(Math.min(getMaxPanelHeight(), Math.max(PANEL_MIN_HEIGHT, value)))
}

const inlineSource: SummarizerSource = {
  getUrl: async () => location.href,
  readComments: async ({ withContext, previewOnly }) => {
    const collected = await collectHNComments({ withContext, previewOnly })

    return { success: true, ...collected }
  },
}

function ContentSummarizer() {
  const [isOpen, setIsOpen] = createSignal<boolean | null>(null)
  const [fontScale, setFontScale] = createSignal(DEFAULT_FONT_SCALE)
  const [panelWidth, setPanelWidth] = createSignal(PANEL_DEFAULT_WIDTH)
  const [panelHeight, setPanelHeight] = createSignal(0)
  let panelRef: HTMLDivElement | undefined

  onMount(() => {
    void Promise.all([
      contentUiOpenStore.getValue(),
      contentUiFontScaleStore.getValue(),
      contentUiWidthStore.getValue(),
      contentUiHeightStore.getValue(),
    ])
      .then(([isPanelOpen, savedFontScale, savedWidth, savedHeight]) => {
        setIsOpen(isPanelOpen)
        setFontScale(clampFontScale(savedFontScale))
        setPanelWidth(clampPanelWidth(savedWidth))
        setPanelHeight(clampPanelHeight(savedHeight))
      })
      .catch(error => {
        console.warn("Failed to load the in-page panel state.", error)
        setIsOpen(true)
        setFontScale(DEFAULT_FONT_SCALE)
        setPanelWidth(PANEL_DEFAULT_WIDTH)
        setPanelHeight(0)
      })
  })

  function togglePanel() {
    const nextOpen = !(isOpen() ?? true)

    setIsOpen(nextOpen)
    void contentUiOpenStore.setValue(nextOpen).catch(error => {
      console.warn("Failed to save the in-page panel state.", error)
    })
  }

  function adjustFontScale(direction: number) {
    const nextScale = clampFontScale(fontScale() + direction * FONT_SCALE_STEP)

    if (nextScale === fontScale()) {
      return
    }

    setFontScale(nextScale)
    void contentUiFontScaleStore.setValue(nextScale).catch(error => {
      console.warn("Failed to save the in-page panel text size.", error)
    })
  }

  function startResize(event: PointerEvent & { currentTarget: HTMLDivElement }) {
    if (event.button !== 0 || !panelRef) {
      return
    }

    event.preventDefault()

    const handle = event.currentTarget
    const startX = event.clientX
    const startY = event.clientY
    const startRect = panelRef.getBoundingClientRect()
    let nextWidth = Math.round(startRect.width)
    let nextHeight = Math.round(startRect.height)

    function handleMove(moveEvent: PointerEvent) {
      nextWidth = clampPanelWidth(startRect.width + (startX - moveEvent.clientX))
      nextHeight = clampPanelHeight(startRect.height + (moveEvent.clientY - startY))
      setPanelWidth(nextWidth)
      setPanelHeight(nextHeight)
    }

    function stopResizing() {
      handle.removeEventListener("pointermove", handleMove)
      handle.removeEventListener("pointerup", stopResizing)
      handle.removeEventListener("pointercancel", stopResizing)

      if (handle.hasPointerCapture(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId)
      }

      void Promise.all([contentUiWidthStore.setValue(nextWidth), contentUiHeightStore.setValue(nextHeight)]).catch(
        error => {
          console.warn("Failed to save the in-page panel size.", error)
        },
      )
    }

    handle.setPointerCapture(event.pointerId)
    handle.addEventListener("pointermove", handleMove)
    handle.addEventListener("pointerup", stopResizing)
    handle.addEventListener("pointercancel", stopResizing)
  }

  return (
    <Show when={isOpen() !== null}>
      <div
        ref={panelRef}
        class="hn-embedded-panel fixed top-14 right-3 z-[2147483646] max-h-[calc(100vh-4.5rem)] max-w-[calc(100vw-1.5rem)]"
        classList={{ hidden: !isOpen() }}
        style={`--hn-font-scale: ${fontScale()}; width: ${panelWidth()}px;${
          panelHeight() > 0 ? ` height: ${panelHeight()}px;` : ""
        }`}
      >
        <aside class="h-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/60">
          <SummarizerPanel
            variant="inline"
            source={inlineSource}
            onClose={togglePanel}
            fontScale={fontScale()}
            onAdjustFontScale={adjustFontScale}
          />
        </aside>

        <div
          class="absolute bottom-0 left-0 z-20 flex h-4 w-4 cursor-nesw-resize touch-none items-end justify-start rounded-bl-xl p-0.5 text-zinc-500 opacity-70 transition-opacity hover:text-orange-400 hover:opacity-100"
          title="Drag to resize"
          aria-label="Resize summary panel"
          aria-orientation="vertical"
          role="separator"
          onPointerDown={startResize}
        >
          <svg
            viewBox="0 0 12 12"
            class="h-3 w-3"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M2 8l6-6M2 11l9-9" />
          </svg>
        </div>
      </div>

      <button
        type="button"
        onclick={togglePanel}
        title={isOpen() ? "Hide HN Comments Summarizer" : "Open HN Comments Summarizer"}
        aria-label={isOpen() ? "Hide HN Comments Summarizer" : "Open HN Comments Summarizer"}
        aria-expanded={isOpen() === true}
        class="fixed top-3 right-3 z-[2147483647] flex h-9 w-9 items-center justify-center rounded-lg border border-orange-400/40 bg-orange-600 text-white shadow-lg shadow-black/40 transition-colors hover:bg-orange-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
      >
        <Show
          when={isOpen()}
          fallback={
            <svg
              viewBox="0 0 16 16"
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <path d="M3 4.5h10M3 8h10M3 11.5h10" />
            </svg>
          }
        >
          <svg
            viewBox="0 0 16 16"
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M4 10l4-4 4 4" />
          </svg>
        </Show>
      </button>
    </Show>
  )
}

export async function mountSummarizerUi(ctx: ContentScriptContext) {
  const ui = await createShadowRootUi(ctx, {
    name: "hn-summarizer",
    position: "inline",
    anchor: "body",
    isolateEvents: true,
    onMount: container => {
      const unmount = render(() => <ContentSummarizer />, container)

      return unmount
    },
    onRemove: unmount => unmount?.(),
  })

  ui.mount()
}
