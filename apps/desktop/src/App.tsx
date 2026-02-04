import { useState, useCallback } from "react";
import "./App.css";
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
    <div className="app">
      <div className="app-background" aria-hidden="true" />
      <header className="app-header">
        <h1 className="app-title">HygherTales</h1>
        <nav className="app-nav" aria-label="Main">
          {PAGES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`nav-link ${page === id ? "active" : ""}`}
              onClick={() => setPage(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main className="app-main">
        {page === "home" && <Home />}
        {page === "browse" && <Browse proxyBaseUrl={settings.proxyBaseUrl} />}
        {page === "installed" && <Installed />}
        {page === "settings" && (
          <SettingsPage onSettingsChange={handleSettingsChange} />
        )}
      </main>
    </div>
  );
}

export default App;
