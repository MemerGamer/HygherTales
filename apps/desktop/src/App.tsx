import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Home } from "./pages/Home";
import { Browse } from "./pages/Browse";
import { Installed } from "./pages/Installed";
import { SettingsPage } from "./pages/Settings";
import { loadSettings, type Settings } from "./lib/settings";
import { checkHealth } from "./lib/api";
import { Spinner } from "./components/ui";

type PageId = "home" | "browse" | "installed" | "settings";

const PAGES: { id: PageId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "browse", label: "Browse" },
  { id: "installed", label: "Installed" },
  { id: "settings", label: "Settings" },
];

function App() {
  const [page, setPage] = useState<PageId>("home");
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [proxyReady, setProxyReady] = useState(false);
  const [proxyError, setProxyError] = useState<string | null>(null);

  const handleSettingsChange = useCallback((s: Settings) => {
    setSettings(s);
  }, []);

  // Start proxy sidecar on app mount
  useEffect(() => {
    let cancelled = false;

    async function startProxyAndWaitForHealth() {
      try {
        console.log("[app] Starting proxy sidecar...");
        await invoke("start_proxy_sidecar");
        console.log("[app] Proxy sidecar started, waiting for health check...");

        // Wait for proxy to be ready (health check with retries)
        const maxRetries = 30; // 30 seconds max
        const retryDelay = 1000; // 1 second between retries

        for (let i = 0; i < maxRetries; i++) {
          if (cancelled) return;

          const healthy = await checkHealth(settings.proxyBaseUrl);
          if (healthy) {
            console.log("[app] Proxy is ready!");
            setProxyReady(true);
            return;
          }

          // Wait before next retry
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }

        if (!cancelled) {
          setProxyError(
            "Proxy server failed to start. Check that port 8787 is not in use."
          );
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[app] Failed to start proxy:", err);
          setProxyError(
            err instanceof Error ? err.message : "Failed to start proxy server"
          );
        }
      }
    }

    startProxyAndWaitForHealth();

    return () => {
      cancelled = true;
    };
  }, [settings.proxyBaseUrl]);

  // Show loading screen while proxy is starting
  if (!proxyReady && !proxyError) {
    return (
      <div className="relative min-h-screen flex flex-col">
        {/* Background with overlay */}
        <div
          className="fixed inset-0 bg-cover bg-center z-0"
          style={{ backgroundImage: "url(/background.png)" }}
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-black/40 z-10" />
        </div>

        {/* Loading content */}
        <div className="relative z-20 flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Spinner className="w-12 h-12 mx-auto" />
            <p className="text-white text-lg">Starting HygherTales...</p>
            <p className="text-white/70 text-sm">Initializing proxy server</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error screen if proxy failed to start
  if (proxyError) {
    return (
      <div className="relative min-h-screen flex flex-col">
        {/* Background with overlay */}
        <div
          className="fixed inset-0 bg-cover bg-center z-0"
          style={{ backgroundImage: "url(/background.png)" }}
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-black/40 z-10" />
        </div>

        {/* Error content */}
        <div className="relative z-20 flex-1 flex items-center justify-center p-4">
          <div className="max-w-md text-center space-y-4 bg-black/60 border border-red-500/50 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-400">
              Failed to Start Proxy
            </h2>
            <p className="text-white/90">{proxyError}</p>
            <p className="text-white/70 text-sm">
              Try restarting the application. If the problem persists, check the
              Settings page to configure a different proxy URL.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Background with overlay */}
      <div
        className="fixed inset-0 bg-cover bg-center z-0"
        style={{ backgroundImage: "url(/background.png)" }}
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-black/40 z-10" />
      </div>

      {/* Header */}
      <header className="relative z-20 px-4 py-3 flex items-center gap-4 flex-wrap border-b border-white/15">
        <h1 className="text-xl font-semibold text-white">HygherTales</h1>
        <nav className="flex gap-1" aria-label="Main">
          {PAGES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`px-3 py-2 text-sm rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] ${
                page === id
                  ? "bg-white/25 border border-white/35 text-white"
                  : "bg-white/10 border border-white/20 text-white/90 hover:bg-white/15"
              }`}
              onClick={() => setPage(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {/* Main content */}
      <main className="relative z-20 flex-1 overflow-auto">
        {page === "home" && (
          <Home
            gameExePath={settings.gameExePath}
            onNavigate={(nextPage) => setPage(nextPage)}
          />
        )}
        {page === "browse" && (
          <Browse
            proxyBaseUrl={settings.proxyBaseUrl}
            modsDirPath={settings.modsDirPath}
          />
        )}
        {page === "installed" && (
          <Installed
            modsDirPath={settings.modsDirPath}
            proxyBaseUrl={settings.proxyBaseUrl}
          />
        )}
        {page === "settings" && (
          <SettingsPage onSettingsChange={handleSettingsChange} />
        )}
      </main>
    </div>
  );
}

export default App;
