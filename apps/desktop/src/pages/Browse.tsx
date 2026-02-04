import { useState, useCallback, useEffect } from "react";
import {
  searchMods,
  getFeaturedMods,
  getCategories,
  getOrbisFeatured,
  getOrbisSearch,
  getModDetails,
  getModFiles,
  getDownloadUrlCurseForge,
  getDownloadUrlOrbis,
  ApiError,
} from "../lib/api";
import { marked } from "marked";
import {
  readInstalledMods,
  writeInstalledMods,
  downloadFileToPath,
  nextId,
  type InstalledModRecord,
} from "../lib/modsDb";
import { loadBrowseSource, saveBrowseSource } from "../lib/settings";
import { openExternalUrl } from "../lib/shell";
import type { ModSummary, ModCategory, ModDetailsResponse, ModFile } from "@hyghertales/shared";

/** Parse description that may be Markdown, HTML, or both. Returns HTML string. */
function parseDescriptionToHtml(description: string): string {
  try {
    return marked.parse(description, {
      gfm: true,
      breaks: true,
    }) as string;
  } catch {
    return description;
  }
}

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
  modsDirPath: string | null;
}

export function Browse({ proxyBaseUrl, modsDirPath }: BrowseProps) {
  const [source, setSource] = useState<ModSource>(loadBrowseSource);
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
  const [selectedMod, setSelectedMod] = useState<ModSummary | null>(null);
  const [detail, setDetail] = useState<ModDetailsResponse | null>(null);
  const [detailFiles, setDetailFiles] = useState<ModFile[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

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

  const modId = (mod: ModSummary) =>
    mod.provider === "curseforge" ? String(mod.projectId) : mod.resourceId;

  const openModDetail = useCallback(
    async (mod: ModSummary) => {
      setSelectedMod(mod);
      setDetail(null);
      setDetailFiles([]);
      setDetailError(null);
      setDetailLoading(true);
      try {
        const id = modId(mod);
        const [detailsRes, filesRes] = await Promise.all([
          getModDetails(proxyBaseUrl, mod.provider, id),
          getModFiles(proxyBaseUrl, mod.provider, id),
        ]);
        setDetail(detailsRes);
        setDetailFiles(filesRes.files);
      } catch (e) {
        setDetailError(
          e instanceof ApiError ? e.body?.message ?? e.message : "Failed to load mod details"
        );
      } finally {
        setDetailLoading(false);
      }
    },
    [proxyBaseUrl]
  );

  const closeModDetail = useCallback(() => {
    setSelectedMod(null);
    setDetail(null);
    setDetailFiles([]);
    setDetailError(null);
    setDownloadingFile(null);
  }, []);

  const handleDownloadFile = useCallback(
    async (file: ModFile) => {
      if (!selectedMod || !detail) return;
      const key =
        selectedMod.provider === "curseforge"
          ? `cf-${file.fileId}`
          : `orbis-${file.versionId}-${file.fileIndex}`;
      setDownloadingFile(key);
      try {
        let url: string;
        if (selectedMod.provider === "curseforge" && detail.provider === "curseforge" && file.fileId != null) {
          const res = await getDownloadUrlCurseForge(proxyBaseUrl, detail.projectId, file.fileId);
          url = res.url;
        } else if (
          selectedMod.provider === "orbis" &&
          detail.provider === "orbis" &&
          file.versionId != null &&
          file.fileIndex != null
        ) {
          const res = await getDownloadUrlOrbis(
            proxyBaseUrl,
            detail.resourceId,
            file.versionId,
            file.fileIndex
          );
          url = res.url;
        } else if (file.downloadUrl) {
          url = file.downloadUrl;
        } else {
          throw new Error("Cannot get download URL for this file");
        }

        if (modsDirPath?.trim()) {
          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("ensure_mods_dir", { path: modsDirPath.trim() });
          const baseDir = modsDirPath.trim().replace(/\\/g, "/").replace(/\/$/, "");
          const fileName = file.fileName || file.displayName || "mod.jar";
          const destPath = `${baseDir}/${fileName}`;
          const finalPath = await downloadFileToPath(url, destPath);
          const installedFilename = finalPath.replace(/^.*[/\\]/, "");
          const existing = await readInstalledMods();
          const newRecord: InstalledModRecord = {
            id: nextId(existing),
            provider: detail.provider,
            projectId: detail.provider === "curseforge" ? detail.projectId : null,
            resourceId: detail.provider === "orbis" ? detail.resourceId : null,
            slug: detail.slug,
            name: detail.name,
            installedFileId:
              detail.provider === "curseforge"
                ? file.fileId ?? null
                : file.versionId != null && file.fileIndex != null
                  ? `${file.versionId}:${file.fileIndex}`
                  : null,
            installedFilename,
            installedAt: new Date().toISOString(),
            sourceUrl:
              detail.provider === "orbis"
                ? `https://www.orbis.place/mod/${detail.slug}`
                : `https://www.curseforge.com/hytale/mods/${detail.slug}`,
            enabled: true,
          };
          await writeInstalledMods([...existing, newRecord]);
          setDetailError(null);
        } else {
          await openExternalUrl(url);
        }
      } catch (e) {
        setDetailError(
          e instanceof ApiError ? e.body?.message ?? e.message : "Download failed"
        );
      } finally {
        setDownloadingFile(null);
      }
    },
    [proxyBaseUrl, selectedMod, detail, modsDirPath]
  );

  const orbisModUrl = (mod: ModSummary) =>
    mod.provider === "orbis"
      ? `https://www.orbis.place/mod/${mod.slug}`
      : "";

  return (
    <section className="page">
      <h2>Browse mods</h2>
      <div className="browse-toolbar">
        <select
          aria-label="Mod source"
          value={source}
          onChange={(e) => {
            const next = e.target.value as ModSource;
            setSource(next);
            saveBrowseSource(next);
          }}
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
          <li
            key={modKey(mod)}
            className="mod-card mod-card-clickable"
            role="button"
            tabIndex={0}
            onClick={() => openModDetail(mod)}
            onKeyDown={(e) => e.key === "Enter" && openModDetail(mod)}
          >
            {mod.logoUrl && (
              <img src={mod.logoUrl} alt="" className="mod-logo" />
            )}
            <div className="mod-info">
              <strong>{mod.name}</strong>
              {mod.summary && <p>{mod.summary}</p>}
              <span className="mod-meta">
                {mod.provider} · {mod.slug}
                {mod.provider === "orbis" && orbisModUrl(mod) && (
                  <> ·{" "}
                    <button
                      type="button"
                      className="link-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openExternalUrl(orbisModUrl(mod));
                      }}
                    >
                      View on Orbis
                    </button>
                  </>
                )}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {selectedMod && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="mod-detail-title">
          <div className="modal">
            <div className="modal-header">
              <h3 id="mod-detail-title">{selectedMod.name}</h3>
              <button type="button" className="modal-close" onClick={closeModDetail} aria-label="Close">
                ×
              </button>
            </div>
            <div className="modal-body">
              {detailLoading && <p>Loading…</p>}
              {detailError && (
                <div className="error-banner" role="alert">
                  {detailError}
                </div>
              )}
              {detail && !detailLoading && (
                <>
                  {detail.logoUrl && (
                    <img src={detail.logoUrl} alt="" className="mod-detail-logo" />
                  )}
                  {detail.description && (
                    <div
                      className="mod-detail-description mod-detail-description-html"
                      dangerouslySetInnerHTML={{
                        __html: parseDescriptionToHtml(detail.description),
                      }}
                    />
                  )}
                  <div className="mod-file-list-wrapper">
                    <h4>Files / versions</h4>
                    {detailFiles.length === 0 ? (
                      <p>No files available.</p>
                    ) : (
                      <ul className="mod-file-list">
                        {detailFiles.map((file, i) => {
                          const key =
                            selectedMod.provider === "curseforge"
                              ? `cf-${file.fileId ?? i}`
                              : `orbis-${file.versionId ?? ""}-${file.fileIndex ?? i}`;
                          const isDownloading = downloadingFile === key;
                          return (
                            <li key={key} className="mod-file-item">
                              <span className="mod-file-name">
                                {file.displayName || file.fileName || `File ${i + 1}`}
                              </span>
                              <span className="mod-file-meta">
                                {file.releaseType && `${file.releaseType} · `}
                                {file.fileDate ? new Date(file.fileDate).toLocaleDateString() : ""}
                              </span>
                              <button
                                type="button"
                                disabled={isDownloading}
                                onClick={() => handleDownloadFile(file)}
                              >
                                {isDownloading ? "…" : "Download"}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  {selectedMod.provider === "orbis" && orbisModUrl(selectedMod) && (
                    <p className="mod-detail-link">
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => openExternalUrl(orbisModUrl(selectedMod))}
                      >
                        Open on Orbis.place
                      </button>
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
