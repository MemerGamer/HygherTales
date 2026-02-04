import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Settings } from "../lib/settings";
import { loadSettings, saveSettings } from "../lib/settings";
import { PageContainer } from "../components/layout/PageContainer";
import { Button, Input, Label } from "../components/ui";

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

  async function handleBrowseGameExe() {
    try {
      const selected = await open({
        directory: false,
        multiple: false,
        title: "Select Hytale executable",
      });
      if (selected) {
        setSettings((s) => ({ ...s, gameExePath: selected }));
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

  const getStatusColor = (status: PathStatus) => {
    switch (status) {
      case "ok":
      case "created":
        return "text-[#7ed67e]";
      case "error":
      case "not-dir":
      case "not-writable":
        return "text-[#ffb3b3]";
      case "missing":
        return "text-[#f59e0b]";
      default:
        return "text-[var(--color-text-muted)]";
    }
  };

  return (
    <PageContainer title="Settings">
      <div className="space-y-6">
        {/* Proxy URL */}
        <div>
          <Label htmlFor="proxy-url">Proxy base URL</Label>
          <Input
            id="proxy-url"
            type="url"
            value={settings.proxyBaseUrl}
            onChange={(e) =>
              setSettings((s) => ({ ...s, proxyBaseUrl: e.target.value }))
            }
            placeholder="http://localhost:8787"
          />
        </div>

        {/* Hytale user data path */}
        <div>
          <Label htmlFor="userdata-path">Hytale user data path (optional)</Label>
          <Input
            id="userdata-path"
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
        </div>

        {/* Mods directory */}
        <div>
          <Label htmlFor="mods-dir">Mods directory path</Label>
          <div className="flex gap-2">
            <Input
              id="mods-dir"
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
              className="flex-1"
            />
          </div>
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={handleAutoDetect}>
              Auto-detect
            </Button>
            <Button size="sm" onClick={handleBrowse}>
              Browse…
            </Button>
            <Button size="sm" onClick={handleValidate}>
              Validate
            </Button>
          </div>
          {candidates.length > 0 && (
            <div className="mt-3 p-3 bg-[rgba(255,255,255,0.05)] border border-[var(--color-border)] rounded">
              <p className="text-sm text-[var(--color-text)] mb-2">Pick a path:</p>
              <ul className="space-y-1">
                {candidates.map((p) => (
                  <li key={p}>
                    <button
                      type="button"
                      className="text-sm text-[#7eb8ff] hover:text-[#a8d4ff] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(100,160,100,0.6)]"
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
              className={`mt-2 text-sm ${getStatusColor(pathStatus)}`}
              role="status"
              aria-live="polite"
            >
              {pathMessage}
            </p>
          )}
        </div>

        {/* Game executable */}
        <div>
          <Label htmlFor="game-exe">Hytale executable (optional, for Launch)</Label>
          <div className="flex gap-2">
            <Input
              id="game-exe"
              type="text"
              value={settings.gameExePath ?? ""}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  gameExePath: e.target.value.trim() || null,
                }))
              }
              placeholder="Path to Hytale.exe (or game launcher)"
              className="flex-1"
            />
            <Button size="sm" onClick={handleBrowseGameExe}>
              Browse…
            </Button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
