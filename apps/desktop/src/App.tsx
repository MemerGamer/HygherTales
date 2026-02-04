import { useState, useCallback } from "react";
import { Home } from "./pages/Home";
import { Browse } from "./pages/Browse";
import { Installed } from "./pages/Installed";
import { SettingsPage } from "./pages/Settings";
import { loadSettings, type Settings } from "./lib/settings";

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

  const handleSettingsChange = useCallback((s: Settings) => {
    setSettings(s);
  }, []);

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
        {page === "home" && <Home gameExePath={settings.gameExePath} />}
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
