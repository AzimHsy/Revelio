import type { SelectedTarget } from '../lib/types'

// Element thumbnail: capture the visible tab and crop to the inspected
// element's rect. Runs entirely in the background service worker
// (chrome.tabs.captureVisibleTab, createImageBitmap, OffscreenCanvas and
// FileReader are all available there). Failure-tolerant by design: any error
// (0-size rect, capture denied, missing permission) yields null — the
// thumbnail is an optional enhancement and must never block or fail analysis.

const MAX_THUMB_WIDTH = 320

/** Capture the visible tab and return a cropped webp data URL, or null. */
export async function captureThumbnail(
  target: SelectedTarget,
  windowId?: number,
): Promise<string | null> {
  try {
    const dataUrl =
      windowId === undefined
        ? await chrome.tabs.captureVisibleTab({ format: 'png' })
        : await chrome.tabs.captureVisibleTab(windowId, { format: 'png' })
    if (!dataUrl) return null
    return await cropToRect(dataUrl, target)
  } catch {
    return null
  }
}

async function cropToRect(dataUrl: string, target: SelectedTarget): Promise<string | null> {
  const blob = await (await fetch(dataUrl)).blob()
  const bitmap = await createImageBitmap(blob)
  try {
    // rect is CSS px; the captured image is at device-pixel scale.
    const dpr = target.dpr || 1
    const sx = clamp(Math.round(target.rect.x * dpr), 0, bitmap.width)
    const sy = clamp(Math.round(target.rect.y * dpr), 0, bitmap.height)
    const sw = clamp(Math.round(target.rect.width * dpr), 1, bitmap.width - sx)
    const sh = clamp(Math.round(target.rect.height * dpr), 1, bitmap.height - sy)
    if (sw < 1 || sh < 1) return null

    const scale = Math.min(1, MAX_THUMB_WIDTH / sw)
    const dw = Math.max(1, Math.round(sw * scale))
    const dh = Math.max(1, Math.round(sh * scale))

    const canvas = new OffscreenCanvas(dw, dh)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, dw, dh)
    const out = await canvas.convertToBlob({ type: 'image/webp', quality: 0.7 })
    return await blobToDataUrl(out)
  } finally {
    bitmap.close()
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
