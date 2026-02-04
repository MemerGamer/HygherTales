import { useState, useCallback, useEffect } from "react";
import {
  searchMods,
  getFeaturedMods,
  getCategories,
  getOrbisFeatured,
  getOrbisSearch,
  ApiError,
} from "../lib/api";
import type { ModSummary, ModCategory } from "@hyghertales/shared";

type ModSource = "curseforge" | "orbis";

const SORT_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Featured" },
  { value: 2, label: "Popularity" },
  { value: 3, label: "Last updated" },
  { value: 4, label: "Name" },
  { value: 5, label: "Author" },
  { value: 6, label: "Total downloads" },
];

const ORBIS_SORT_OPTIONS: { value: "date" | "downloads" | "name"; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "downloads", label: "Downloads" },
  { value: "name", label: "Name" },
];

interface BrowseProps {
  proxyBaseUrl: string;
}

export function Browse({ proxyBaseUrl }: BrowseProps) {
  const [source, setSource] = useState<ModSource>("curseforge");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<number>(0);
  const [sortField, setSortField] = useState(2);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [orbisSortBy, setOrbisSortBy] = useState<"date" | "downloads" | "name">("date");
  const [categories, setCategories] = useState<ModCategory[]>([]);
  const [items, setItems] = useState<ModSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadFeatured = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      if (source === "orbis") {
        const res = await getOrbisFeatured(proxyBaseUrl);
        setItems(res.items);
        setTotalCount(res.totalCount);
      } else {
        const res = await getFeaturedMods(proxyBaseUrl);
        setItems(res.items);
        setTotalCount(res.totalCount);
      }
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
  }, [proxyBaseUrl, source]);

  useEffect(() => {
    loadFeatured();
  }, [loadFeatured]);

  const loadCategories = useCallback(async () => {
    if (source !== "curseforge") return;
    try {
      const res = await getCategories(proxyBaseUrl);
      setCategories(res.categories);
    } catch {
      setCategories([]);
    }
  }, [proxyBaseUrl, source]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const doSearch = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      if (source === "orbis") {
        const res = await getOrbisSearch(proxyBaseUrl, {
          page: 1,
          limit: 20,
          sortBy: orbisSortBy,
          ...(query.trim() && { q: query.trim() }),
        });
        setItems(res.items);
        setTotalCount(res.totalCount);
      } else {
        const res = await searchMods(proxyBaseUrl, {
          q: query.trim(),
          page: 1,
          pageSize: 20,
          ...(categoryId > 0 && { categoryId }),
          ...(sortField > 0 && { sortField }),
          sortOrder,
        });
        setItems(res.items);
        setTotalCount(res.totalCount);
      }
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
  }, [proxyBaseUrl, source, query, categoryId, sortField, sortOrder, orbisSortBy]);

  const modKey = (mod: ModSummary) =>
    mod.provider === "curseforge"
      ? `${mod.provider}-${mod.projectId}`
      : `${mod.provider}-${mod.resourceId}`;

  return (
    <section className="page">
      <h2>Browse mods</h2>
      <div className="browse-toolbar">
        <select
          aria-label="Mod source"
          value={source}
          onChange={(e) => setSource(e.target.value as ModSource)}
          disabled={loading}
        >
          <option value="curseforge">CurseForge</option>
          <option value="orbis">Orbis.place</option>
        </select>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          placeholder={source === "orbis" ? "Search Orbis.place mods…" : "Search CurseForge mods…"}
          disabled={loading}
          aria-label="Search mods"
        />
        {source === "curseforge" && (
          <>
            <select
              aria-label="Category"
              value={categoryId || ""}
              onChange={(e) => setCategoryId(Number(e.target.value) || 0)}
              disabled={loading}
            >
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Sort by"
              value={sortField}
              onChange={(e) => setSortField(Number(e.target.value))}
              disabled={loading}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Sort order"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
              disabled={loading}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </>
        )}
        {source === "orbis" && (
          <select
            aria-label="Sort by"
            value={orbisSortBy}
            onChange={(e) =>
              setOrbisSortBy(e.target.value as "date" | "downloads" | "name")
            }
            disabled={loading}
          >
            {ORBIS_SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
        <button type="button" onClick={doSearch} disabled={loading}>
          {loading ? "Loading…" : "Search"}
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
          <li key={modKey(mod)} className="mod-card">
            {mod.logoUrl && (
              <img src={mod.logoUrl} alt="" className="mod-logo" />
            )}
            <div className="mod-info">
              <strong>{mod.name}</strong>
              {mod.summary && <p>{mod.summary}</p>}
              <span className="mod-meta">
                {mod.provider} · {mod.slug}
                {mod.provider === "orbis" && (
                  <> · <a href={`https://www.orbis.place/resources/${mod.resourceId}`} target="_blank" rel="noopener noreferrer">View on Orbis</a></>
                )}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
