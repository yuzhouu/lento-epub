import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LIBRARY_ALERT_DURATION_MS,
  scheduleLibraryAlertDismiss,
} from './LibraryAlert'

describe('library alert auto-dismiss', () => {
  beforeEach(() => vi.useFakeTimers())

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('dismisses the notice after eight seconds', () => {
    const onDismiss = vi.fn()

    scheduleLibraryAlertDismiss(onDismiss)
    vi.advanceTimersByTime(LIBRARY_ALERT_DURATION_MS - 1)
    expect(onDismiss).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('cancels the pending dismissal when the notice changes or unmounts', () => {
    const onDismiss = vi.fn()

    const cancelDismiss = scheduleLibraryAlertDismiss(onDismiss)
    cancelDismiss()
    vi.advanceTimersByTime(LIBRARY_ALERT_DURATION_MS)

    expect(onDismiss).not.toHaveBeenCalled()
  })
})
