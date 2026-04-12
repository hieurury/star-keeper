/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
	readonly VITE_UPDATE_MANIFEST_URL?: string
	readonly VITE_NATIVE_OAUTH_SCHEME?: string
}

declare const __APP_VERSION__: string
