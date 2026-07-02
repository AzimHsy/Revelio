import type { CropRect, OffscreenToWorker, WorkerToOffscreen } from '../lib/types'

// Offscreen document: hosts the MediaRecorder for tab capture. A service worker
// can't hold a MediaStream/MediaRecorder, so the worker mints a tabCapture
// streamId and hands it here; we record the tab to webm and return a data URL.
// Video only (no tab audio). When a crop rect is supplied, we draw just the
// element's region onto a canvas each frame and record the canvas stream;
// otherwise we record the whole tab.

const MAX_MS = 20_000 // hard safety cap so a recording can never run away
const MAX_CROP_WIDTH = 480 // downscale the cropped clip to a sane width

let recorder: MediaRecorder | null = null
let stream: MediaStream | null = null // the raw tab stream (always stopped on cleanup)
let chunks: Blob[] = []
let capTimer: ReturnType<typeof setTimeout> | null = null
// Crop pipeline resources, torn down on stop.
let cropVideo: HTMLVideoElement | null = null
let cropRaf: number | null = null
let cropStream: MediaStream | null = null

chrome.runtime.onMessage.addListener((raw: unknown) => {
  if (typeof raw !== 'object' || raw === null || !('type' in raw)) return
  const msg = raw as WorkerToOffscreen
  if (msg.type === 'START_RECORDING') void start(msg.streamId, msg.crop ?? null)
  else if (msg.type === 'STOP_RECORDING') stop()
})

async function start(streamId: string, crop: CropRect | null): Promise<void> {
  if (recorder) stop() // never run two recorders at once
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      // Chrome-specific tab-capture constraints (not in the standard TS types).
      video: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
    } as unknown as MediaStreamConstraints)

    // Crop to the element when we have a rect; else record the whole tab.
    const recordStream = crop ? await buildCroppedStream(stream, crop) : stream

    chunks = []
    recorder = new MediaRecorder(recordStream, { mimeType: pickMimeType() })
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onstop = finish
    recorder.start()
    capTimer = setTimeout(stop, MAX_MS)
  } catch (error) {
    fail(error)
  }
}

// Play the tab stream into a hidden <video> and draw the element region onto a
// canvas each frame; record canvas.captureStream() so the webm is just the
// component. Maps CSS rect → frame pixels via the frame/viewport width ratio, so
// it's correct regardless of the capture resolution.
async function buildCroppedStream(source: MediaStream, crop: CropRect): Promise<MediaStream> {
  const video = document.createElement('video')
  video.srcObject = source
  video.muted = true
  video.playsInline = true
  await video.play()
  cropVideo = video

  const scaleX = video.videoWidth / crop.viewportWidth
  const scaleY = video.videoHeight / crop.viewportHeight
  const sx = clamp(crop.x * scaleX, 0, video.videoWidth)
  const sy = clamp(crop.y * scaleY, 0, video.videoHeight)
  const sw = clamp(crop.width * scaleX, 1, video.videoWidth - sx)
  const sh = clamp(crop.height * scaleY, 1, video.videoHeight - sy)

  const scale = Math.min(1, MAX_CROP_WIDTH / sw)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sw * scale))
  canvas.height = Math.max(1, Math.round(sh * scale))
  const ctx = canvas.getContext('2d')

  const draw = (): void => {
    if (ctx) ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    cropRaf = requestAnimationFrame(draw)
  }
  draw()

  cropStream = canvas.captureStream(30)
  return cropStream
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function stop(): void {
  if (capTimer) {
    clearTimeout(capTimer)
    capTimer = null
  }
  if (cropRaf !== null) {
    cancelAnimationFrame(cropRaf)
    cropRaf = null
  }
  try {
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  } catch {
    // Already stopped — the onstop/finish path still runs.
  }
  // Release the capture so the tab stops showing the "being captured" state.
  stream?.getTracks().forEach((track) => track.stop())
  cropStream?.getTracks().forEach((track) => track.stop())
  cropVideo?.pause()
  stream = null
  cropStream = null
  cropVideo = null
}

function finish(): void {
  const blob = new Blob(chunks, { type: 'video/webm' })
  chunks = []
  recorder = null
  const reader = new FileReader()
  reader.onload = () => send({ type: 'RECORDING_DATA', dataUrl: String(reader.result) })
  reader.onerror = () => fail(reader.error)
  reader.readAsDataURL(blob)
}

function pickMimeType(): string {
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? 'video/webm'
}

function fail(error: unknown): void {
  send({
    type: 'RECORDING_FAILED',
    reason: error instanceof Error ? error.message : 'Recording failed.',
  })
}

function send(message: OffscreenToWorker): void {
  chrome.runtime.sendMessage(message).catch(() => {})
}
