import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Settings } from "../lib/settings";
import { loadSettings, saveSettings } from "../lib/settings";

interface SettingsPageProps {
  onSettingsChange?: (settings: Settings) => void;
}

type PathStatus = "idle" | "ok" | "missing" | "not-dir" | "not-writable" | "created" | "error";

export function SettingsPage({ onSettingsChange }: SettingsPageProps) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [candidates, setCandidates] = useState<string[]>([]);
  const [pathStatus, setPathStatus] = useState<PathStatus>("idle");
  const [pathMessage, setPathMessage] = useState<string>("");

  useEffect(() => {
    saveSettings(settings);
    onSettingsChange?.(settings);
  }, [settings, onSettingsChange]);

  async function handleAutoDetect() {
    setPathStatus("idle");
    setPathMessage("");
    try {
      const paths = await invoke<string[]>("get_default_hytale_mods_paths");
      setCandidates(paths);
      if (paths.length === 0) {
        setPathMessage("No default paths found for this platform.");
      }
    } catch (e) {
      setPathMessage(String(e));
      setCandidates([]);
    }
  }

  function selectCandidate(path: string) {
    setSettings((s) => ({ ...s, modsDirPath: path }));
    setCandidates([]);
    setPathStatus("idle");
    setPathMessage("");
  }

  async function handleBrowse() {
    setPathStatus("idle");
    setPathMessage("");
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected) {
        setSettings((s) => ({ ...s, modsDirPath: selected }));
      }
    } catch (e) {
      setPathMessage(String(e));
    }
  }

  async function handleValidate() {
    const path = settings.modsDirPath?.trim();
    setPathMessage("");
    if (!path) {
      setPathStatus("missing");
      setPathMessage("Enter or choose a mods directory first.");
      return;
    }
    try {
      const access = await invoke<{ exists: boolean; is_dir: boolean; writable: boolean }>(
        "check_path_access",
        { path }
      );
      if (!access.exists) {
        const result = await invoke<{ ok: boolean; created: boolean }>("ensure_mods_dir", {
          path,
        });
        if (result.ok && result.created) {
          setPathStatus("created");
          setPathMessage("Directory was created. You can use it for mods.");
        } else {
          setPathStatus("error");
          setPathMessage("Could not create directory.");
        }
        return;
      }
      if (!access.is_dir) {
        setPathStatus("not-dir");
        setPathMessage("Path exists but is not a directory.");
        return;
      }
      if (!access.writable) {
        setPathStatus("not-writable");
        setPathMessage("Directory is not writable.");
        return;
      }
      setPathStatus("ok");
      setPathMessage("Path is valid and writable.");
      saveSettings(settings);
    } catch (e) {
      setPathStatus("error");
      setPathMessage(String(e));
    }
  }

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
          <div className="mods-dir-row">
            <input
              type="text"
              value={settings.modsDirPath ?? ""}
              onChange={(e) => {
                setSettings((s) => ({
                  ...s,
                  modsDirPath: e.target.value.trim() || null,
                }));
                setPathStatus("idle");
              }}
              placeholder="Path where mods are stored"
            />
            <div className="mods-dir-buttons">
              <button type="button" onClick={handleAutoDetect}>
                Auto-detect
              </button>
              <button type="button" onClick={handleBrowse}>
                Browse…
              </button>
              <button type="button" onClick={handleValidate}>
                Validate
              </button>
            </div>
          </div>
          {candidates.length > 0 && (
            <div className="candidates-list">
              <span>Pick a path:</span>
              <ul>
                {candidates.map((p) => (
                  <li key={p}>
                    <button
                      type="button"
                      className="candidate-link"
                      onClick={() => selectCandidate(p)}
                    >
                      {p}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {pathMessage && (
            <p
              className={`path-status path-status--${pathStatus}`}
              role="status"
              aria-live="polite"
            >
              {pathMessage}
            </p>
          )}
        </label>
      </div>
    </section>
  );
}
