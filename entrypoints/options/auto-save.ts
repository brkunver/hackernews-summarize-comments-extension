import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js"
import { getErrorMessage } from "~/util/errors"

export function createSettingsAutoSave(ready: Accessor<boolean>) {
  const [pendingCount, setPendingCount] = createSignal(0)
  const [errors, setErrors] = createSignal<Record<string, string>>({})
  const flushers: (() => void)[] = []

  function bind<T>(name: string, source: Accessor<T>, write: (value: T) => Promise<void>, delay = 0) {
    let initialized = false
    let previous = ""
    let pending: { value: T } | undefined
    let failed: { value: T } | undefined
    let timer: ReturnType<typeof window.setTimeout> | undefined
    let running = false
    let active = false

    async function flush() {
      window.clearTimeout(timer)
      if (running || !pending) {
        return
      }

      running = true
      try {
        while (pending) {
          const current = pending
          pending = undefined
          try {
            await write(current.value)
            failed = undefined
            setErrors(previousErrors => {
              const next = { ...previousErrors }
              delete next[name]
              return next
            })
          } catch (error) {
            failed = current
            setErrors(previousErrors => ({ ...previousErrors, [name]: getErrorMessage(error) }))
          }
        }
      } finally {
        running = false
        active = false
        setPendingCount(count => count - 1)
      }
    }

    flushers.push(() => {
      if (!pending && failed) {
        pending = failed
        if (!active) {
          active = true
          setPendingCount(count => count + 1)
        }
      }
      void flush()
    })

    createEffect(() => {
      if (!ready()) {
        return
      }

      const value = source()
      const serialized = JSON.stringify(value)
      if (!initialized) {
        initialized = true
        previous = serialized
        return
      }
      if (serialized === previous) {
        return
      }

      previous = serialized
      pending = { value }
      if (!active) {
        active = true
        setPendingCount(count => count + 1)
      }
      window.clearTimeout(timer)
      if (delay > 0) {
        timer = window.setTimeout(() => void flush(), delay)
      } else {
        void flush()
      }
    })
  }

  function flush() {
    for (const flushSetting of flushers) {
      flushSetting()
    }
  }

  window.addEventListener("pagehide", flush)
  onCleanup(() => {
    flush()
    window.removeEventListener("pagehide", flush)
  })

  return { bind, flush, pendingCount, error: () => Object.entries(errors())[0] }
}
