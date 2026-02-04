import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button, Card } from "../components/ui";

interface HomeProps {
  gameExePath: string | null;
  onNavigate?: (page: "browse" | "installed" | "settings") => void;
}

export function Home({ gameExePath, onNavigate }: HomeProps) {
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

  const quickActions = [
    {
      id: "browse" as const,
      icon: "🔍",
      title: "Browse Mods",
      description: "Discover and download mods from CurseForge and Orbis.place",
    },
    {
      id: "installed" as const,
      icon: "📦",
      title: "Installed Mods",
      description: "Manage your installed mods and create profiles",
    },
    {
      id: "settings" as const,
      icon: "⚙️",
      title: "Settings",
      description: "Configure paths, proxy URL, and game executable",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-8">
      {/* Hero section */}
      <div className="bg-gradient-to-br from-[rgba(100,160,100,0.15)] to-[rgba(100,160,100,0.05)] border border-[var(--color-border)] rounded-lg p-8 md:p-12 mb-8">
        <div className="max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Welcome to HygherTales
          </h1>
          <p className="text-lg text-[var(--color-text)] leading-relaxed mb-8">
            Your mod launcher for Hytale. Browse, install, and manage mods with ease.
          </p>
          
          <div className="space-y-4">
            <Button
              variant="primary"
              size="lg"
              onClick={handleLaunch}
              disabled={!gameExePath?.trim()}
              className="min-w-[200px]"
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
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <Card
              key={action.id}
              clickable
              onClick={() => onNavigate?.(action.id)}
              onKeyDown={(e) => e.key === "Enter" && onNavigate?.(action.id)}
              className="flex flex-col h-full"
            >
              <div className="text-4xl mb-3" aria-hidden="true">
                {action.icon}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {action.title}
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                {action.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
