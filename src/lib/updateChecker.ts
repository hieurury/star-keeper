import { APP_VERSION } from './appVersion'

export interface VersionManifest {
  version: string
  publishedAt?: string
  downloadUrl?: string
  packageUrl?: string
  packageSizeBytes?: number
  requiredSizeMb?: number
  forceUpdate?: boolean
  notes?: string
}

export interface UpdateCheckResult {
  currentVersion: string
  latestVersion: string | null
  hasUpdate: boolean
  manifest: VersionManifest | null
}

function normalizeVersion(raw: string): string {
  return raw.trim().replace(/^v/i, '')
}

function sanitizeOptionalNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined
  return value
}

function parseVersionParts(raw: string): [number, number, number] {
  const core = normalizeVersion(raw).split('-')[0] ?? '0.0.0'
  const parts = core.split('.').map((item) => Number.parseInt(item, 10))
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0]
}

export function compareVersion(a: string, b: string): number {
  const left = parseVersionParts(a)
  const right = parseVersionParts(b)
  for (let i = 0; i < 3; i++) {
    if (left[i] > right[i]) return 1
    if (left[i] < right[i]) return -1
  }
  return 0
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const manifestUrl = (import.meta.env.VITE_UPDATE_MANIFEST_URL || '/version.json').trim()
  const response = await fetch(manifestUrl, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Cannot load update manifest (${response.status})`)
  }

  const manifest = (await response.json()) as Partial<VersionManifest>
  const remoteVersion = typeof manifest.version === 'string' ? normalizeVersion(manifest.version) : ''

  if (!remoteVersion) {
    throw new Error('Update manifest is missing version')
  }

  return {
    currentVersion: normalizeVersion(APP_VERSION),
    latestVersion: remoteVersion,
    hasUpdate: compareVersion(remoteVersion, APP_VERSION) > 0,
    manifest: {
      version: remoteVersion,
      publishedAt: manifest.publishedAt,
      downloadUrl: manifest.downloadUrl,
      packageUrl: manifest.packageUrl,
      packageSizeBytes: sanitizeOptionalNumber(manifest.packageSizeBytes),
      requiredSizeMb: sanitizeOptionalNumber(manifest.requiredSizeMb),
      forceUpdate: manifest.forceUpdate !== false,
      notes: manifest.notes,
    },
  }
}
