import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface HomeProps {
  gameExePath: string | null;
}

export function Home({ gameExePath }: HomeProps) {
  const [launchError, setLaunchError] = useState<string | null>(null);

  async function handleLaunch() {
    setLaunchError(null);
    const path = gameExePath?.trim();
    if (!path) {
      setLaunchError("Set the Hytale executable path in Settings first.");
      return;
    }
    try {
      await invoke<{ ok: boolean }>("launch_game", {
        exePath: path,
        args: undefined,
      });
    } catch (e) {
      setLaunchError(String(e));
    }
  }

  return (
    <section className="page">
      <h2>Home</h2>
      <p>
        Welcome to HygherTales. Use the menu to browse mods, view installed mods,
        or change settings.
      </p>
      <div className="home-launch">
        <button
          type="button"
          className="home-launch-btn"
          onClick={handleLaunch}
          disabled={!gameExePath?.trim()}
        >
          Launch Hytale
        </button>
        {!gameExePath?.trim() && (
          <p className="home-launch-hint">
            Configure the game executable in Settings to enable Launch.
          </p>
        )}
        {launchError && (
          <p className="error-banner" role="alert">
            {launchError}
          </p>
        )}
      </div>
    </section>
  );
}
