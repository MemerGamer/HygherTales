/**
 * Settings stored in localStorage (persists in the Tauri webview app data).
 * For a production app you could switch to Tauri plugin store or JSON in app data dir.
 */

const STORAGE_KEY = "hyghertales-settings";

const defaultProxyBaseUrl =
  typeof import.meta.env.VITE_PROXY_BASE_URL === "string" &&
  import.meta.env.VITE_PROXY_BASE_URL.trim() !== ""
    ? import.meta.env.VITE_PROXY_BASE_URL.trim()
    : "http://localhost:8787";

export interface Settings {
  proxyBaseUrl: string;
  hytaleUserDataPath: string | null;
  modsDirPath: string | null;
}

const defaults: Settings = {
  proxyBaseUrl: defaultProxyBaseUrl,
  hytaleUserDataPath: null,
  modsDirPath: null,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      proxyBaseUrl:
        typeof parsed.proxyBaseUrl === "string" && parsed.proxyBaseUrl.trim()
          ? parsed.proxyBaseUrl.trim()
          : defaults.proxyBaseUrl,
      hytaleUserDataPath:
        typeof parsed.hytaleUserDataPath === "string" &&
        parsed.hytaleUserDataPath.trim()
          ? parsed.hytaleUserDataPath.trim()
          : null,
      modsDirPath:
        typeof parsed.modsDirPath === "string" && parsed.modsDirPath.trim()
          ? parsed.modsDirPath.trim()
          : null,
    };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
