const MIRROR_FILE_NAME = 'ban-may-bay-save.json'

let pendingPayload: string | null = null
let writeTimer: number | null = null
let writing = false

async function getOpfsRoot(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof navigator === 'undefined') return null
  if (!('storage' in navigator)) return null
  const storage = navigator.storage as StorageManager & { getDirectory?: () => Promise<FileSystemDirectoryHandle> }
  if (typeof storage.getDirectory !== 'function') return null
  try {
    return await storage.getDirectory()
  } catch {
    return null
  }
}

async function writeMirrorNow(payload: string): Promise<void> {
  const root = await getOpfsRoot()
  if (!root) return
  const handle = await root.getFileHandle(MIRROR_FILE_NAME, { create: true })
  const writable = await handle.createWritable()
  await writable.write(payload)
  await writable.close()
}

async function flushPendingMirror(): Promise<void> {
  if (writing) return
  if (!pendingPayload) return
  writing = true
  try {
    const payload = pendingPayload
    pendingPayload = null
    if (payload) await writeMirrorNow(payload)
  } catch {
    // Silent fallback: localStorage remains source of truth.
  } finally {
    writing = false
  }

  if (pendingPayload) {
    void flushPendingMirror()
  }
}

export function queueMirrorSave(payload: string): void {
  pendingPayload = payload
  if (writeTimer != null) return
  writeTimer = window.setTimeout(() => {
    writeTimer = null
    void flushPendingMirror()
  }, 900)
}

export async function readMirrorSave(): Promise<string | null> {
  try {
    const root = await getOpfsRoot()
    if (!root) return null
    const handle = await root.getFileHandle(MIRROR_FILE_NAME)
    const file = await handle.getFile()
    return await file.text()
  } catch {
    return null
  }
}
