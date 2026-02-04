import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PageContainer } from "../components/layout/PageContainer";
import { Button } from "../components/ui";

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
    <PageContainer title="Home">
      <p className="text-[var(--color-text)] leading-relaxed mb-6">
        Welcome to HygherTales. Use the menu to browse mods, view installed mods,
        or change settings.
      </p>
      <div className="mt-8 space-y-4">
        <Button
          variant="primary"
          size="lg"
          onClick={handleLaunch}
          disabled={!gameExePath?.trim()}
        >
          Launch Hytale
        </Button>
        {!gameExePath?.trim() && (
          <p className="text-sm text-[var(--color-text-muted)]">
            Configure the game executable in Settings to enable Launch.
          </p>
        )}
        {launchError && (
          <div
            className="p-3 bg-[var(--color-danger)] border border-[rgba(220,80,80,0.6)] rounded text-[#ffb3b3]"
            role="alert"
          >
            {launchError}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
