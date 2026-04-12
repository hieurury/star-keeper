import type { VersionManifest } from './updateChecker'

export interface UpdateInstallOptions {
  onProgress?: (progress: number) => void
}

function clampProgress(progress: number): number {
  return Math.max(0, Math.min(100, Math.round(progress)))
}

function emitProgress(onProgress: UpdateInstallOptions['onProgress'], progress: number) {
  if (!onProgress) return
  onProgress(clampProgress(progress))
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function downloadWithProgress(
  url: string,
  sizeHint: number | undefined,
  onProgress?: (progress: number) => void,
): Promise<void> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Tai goi cap nhat that bai (${response.status}).`)
  }

  if (!response.body) {
    throw new Error('Trinh duyet khong ho tro theo doi tien trinh tai.')
  }

  const contentLength = Number.parseInt(response.headers.get('content-length') ?? '', 10)
  const total = Number.isFinite(contentLength) && contentLength > 0
    ? contentLength
    : (sizeHint ?? 0)

  const reader = response.body.getReader()
  let received = 0
  let fallbackProgress = 3
  emitProgress(onProgress, fallbackProgress)

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    received += value.byteLength

    if (total > 0) {
      const ratio = (received / total) * 100
      emitProgress(onProgress, Math.min(98, ratio))
    } else {
      fallbackProgress = Math.min(98, fallbackProgress + 2)
      emitProgress(onProgress, fallbackProgress)
    }
  }

  emitProgress(onProgress, 100)
}

export async function installMandatoryUpdate(
  manifest: VersionManifest,
  options: UpdateInstallOptions = {},
): Promise<void> {
  const { onProgress } = options

  if (manifest.packageUrl) {
    await downloadWithProgress(manifest.packageUrl, manifest.packageSizeBytes, onProgress)
    emitProgress(onProgress, 100)
    window.location.reload()
    return
  }

  if (manifest.downloadUrl) {
    emitProgress(onProgress, 15)
    await delay(250)
    emitProgress(onProgress, 42)
    await delay(250)
    emitProgress(onProgress, 78)
    await delay(250)
    emitProgress(onProgress, 100)
    window.location.href = manifest.downloadUrl
    return
  }

  throw new Error('Khong co nguon cap nhat hop le trong version manifest.')
}
