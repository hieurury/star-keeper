/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
	readonly VITE_UPDATE_MANIFEST_URL?: string
}

declare const __APP_VERSION__: string
