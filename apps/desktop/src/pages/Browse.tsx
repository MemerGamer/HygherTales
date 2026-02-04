import { useState, useCallback } from "react";
import { searchMods, ApiError } from "../lib/api";
import type { ModSummary } from "@hyghertales/shared";

interface BrowseProps {
  proxyBaseUrl: string;
}

export function Browse({ proxyBaseUrl }: BrowseProps) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ModSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback(async () => {
    if (!query.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await searchMods(proxyBaseUrl, {
        q: query.trim(),
        page: 1,
        pageSize: 20,
      });
      setItems(res.items);
      setTotalCount(res.totalCount);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.body?.message ?? e.message);
      } else {
        setError("Proxy unreachable. Check the proxy URL in Settings and that the server is running.");
      }
      setItems([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [proxyBaseUrl, query]);

  return (
    <section className="page">
      <h2>Browse mods</h2>
      <div className="browse-toolbar">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          placeholder="Search CurseForge mods…"
          disabled={loading}
        />
        <button type="button" onClick={doSearch} disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </button>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {items.length > 0 && (
        <p className="browse-meta">
          {totalCount} result{totalCount !== 1 ? "s" : ""}
        </p>
      )}
      <ul className="mod-list">
        {items.map((mod) => (
          <li key={`${mod.provider}-${mod.projectId}`} className="mod-card">
            {mod.logoUrl && (
              <img src={mod.logoUrl} alt="" className="mod-logo" />
            )}
            <div className="mod-info">
              <strong>{mod.name}</strong>
              {mod.summary && <p>{mod.summary}</p>}
              <span className="mod-meta">
                {mod.provider} · {mod.slug}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
