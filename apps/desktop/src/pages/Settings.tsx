import { useState, useEffect } from "react";
import type { Settings } from "../lib/settings";
import { loadSettings, saveSettings } from "../lib/settings";

interface SettingsPageProps {
  onSettingsChange?: (settings: Settings) => void;
}

export function SettingsPage({ onSettingsChange }: SettingsPageProps) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  useEffect(() => {
    saveSettings(settings);
    onSettingsChange?.(settings);
  }, [settings, onSettingsChange]);

  return (
    <section className="page">
      <h2>Settings</h2>
      <div className="settings-form">
        <label>
          <span>Proxy base URL</span>
          <input
            type="url"
            value={settings.proxyBaseUrl}
            onChange={(e) =>
              setSettings((s) => ({ ...s, proxyBaseUrl: e.target.value }))
            }
            placeholder="http://localhost:8787"
          />
        </label>
        <label>
          <span>Hytale user data path (optional)</span>
          <input
            type="text"
            value={settings.hytaleUserDataPath ?? ""}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                hytaleUserDataPath: e.target.value.trim() || null,
              }))
            }
            placeholder="Override path to game user data"
          />
        </label>
        <label>
          <span>Mods directory path</span>
          <input
            type="text"
            value={settings.modsDirPath ?? ""}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                modsDirPath: e.target.value.trim() || null,
              }))
            }
            placeholder="Path where mods are stored"
          />
        </label>
      </div>
    </section>
  );
}
