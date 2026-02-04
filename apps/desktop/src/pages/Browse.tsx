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
import { PageContainer } from "../components/layout/PageContainer";
import { Button, Input, Card, Modal, Spinner } from "../components/ui";

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

  const selectStyles =
    "px-3 py-2 bg-[rgba(255,255,255,0.1)] border border-[var(--color-border)] rounded text-[var(--color-text)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1a1a1a] focus:ring-[rgba(100,160,100,0.6)] disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <PageContainer title="Browse mods">
      {/* Search and filter toolbar */}
      <div className="flex flex-wrap gap-2 mb-6">
        <select
          aria-label="Mod source"
          value={source}
          onChange={(e) => {
            const next = e.target.value as ModSource;
            setSource(next);
            saveBrowseSource(next);
          }}
          disabled={loading}
          className={selectStyles}
        >
          <option value="curseforge">CurseForge</option>
          <option value="orbis">Orbis.place</option>
        </select>
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          placeholder={source === "orbis" ? "Search Orbis.place mods…" : "Search CurseForge mods…"}
          disabled={loading}
          aria-label="Search mods"
          className="flex-1 min-w-[200px]"
        />
        {source === "curseforge" && (
          <>
            <select
              aria-label="Category"
              value={categoryId || ""}
              onChange={(e) => setCategoryId(Number(e.target.value) || 0)}
              disabled={loading}
              className={selectStyles}
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
              className={selectStyles}
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
              className={selectStyles}
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
            className={selectStyles}
          >
            {ORBIS_SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
        <Button onClick={doSearch} disabled={loading}>
          {loading ? "Loading…" : "Search"}
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="p-3 mb-6 bg-[var(--color-danger)] border border-[rgba(220,80,80,0.6)] rounded text-[#ffb3b3]"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Results count */}
      {items.length > 0 && (
        <p className="mb-4 text-sm text-[var(--color-text-muted)]">
          {totalCount} result{totalCount !== 1 ? "s" : ""}
        </p>
      )}

      {/* Loading state */}
      {loading && items.length === 0 && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {/* Results grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((mod) => (
          <Card
            key={modKey(mod)}
            clickable
            onClick={() => openModDetail(mod)}
            onKeyDown={(e) => e.key === "Enter" && openModDetail(mod)}
            className="flex gap-3"
          >
            {mod.logoUrl && (
              <img
                src={mod.logoUrl}
                alt=""
                className="w-12 h-12 rounded object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white mb-1">{mod.name}</h3>
              {mod.summary && (
                <p className="text-sm text-[var(--color-text-muted)] line-clamp-2 mb-2">
                  {mod.summary}
                </p>
              )}
              <div className="text-xs text-[var(--color-text-muted)]">
                {mod.provider} · {mod.slug}
                {mod.provider === "orbis" && orbisModUrl(mod) && (
                  <>
                    {" · "}
                    <button
                      type="button"
                      className="text-[#7eb8ff] hover:text-[#a8d4ff] underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[rgba(100,160,100,0.6)]"
                      onClick={(e) => {
                        e.stopPropagation();
                        openExternalUrl(orbisModUrl(mod));
                      }}
                    >
                      View on Orbis
                    </button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Mod detail modal */}
      <Modal
        isOpen={selectedMod !== null}
        onClose={closeModDetail}
        title={selectedMod?.name}
        size="wide"
      >
        {detailLoading && (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        )}
        {detailError && (
          <div
            className="p-3 bg-[var(--color-danger)] border border-[rgba(220,80,80,0.6)] rounded text-[#ffb3b3] mb-4"
            role="alert"
          >
            {detailError}
          </div>
        )}
        {detail && !detailLoading && (
          <div className="space-y-6">
            {detail.logoUrl && (
              <img
                src={detail.logoUrl}
                alt={detail.name}
                className="w-24 h-24 rounded object-cover"
              />
            )}
            {detail.description && (
              <div
                className="prose prose-invert prose-sm max-w-none overflow-y-auto max-h-[40vh] text-[var(--color-text)] [&_a]:text-[#7eb8ff] [&_a:hover]:text-[#a8d4ff] [&_strong]:text-white [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_h4]:text-white [&_code]:bg-black/30 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-black/30 [&_pre]:p-3 [&_blockquote]:border-l-white/30"
                dangerouslySetInnerHTML={{
                  __html: parseDescriptionToHtml(detail.description),
                }}
              />
            )}
            <div className="space-y-3">
              <h4 className="font-semibold text-white">Files / versions</h4>
              {detailFiles.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">No files available.</p>
              ) : (
                <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                  {detailFiles.map((file, i) => {
                    const key =
                      selectedMod?.provider === "curseforge"
                        ? `cf-${file.fileId ?? i}`
                        : `orbis-${file.versionId ?? ""}-${file.fileIndex ?? i}`;
                    const isDownloading = downloadingFile === key;
                    return (
                      <div
                        key={key}
                        className="flex flex-wrap items-center gap-2 p-3 bg-[rgba(255,255,255,0.05)] rounded"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">
                            {file.displayName || file.fileName || `File ${i + 1}`}
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)]">
                            {file.releaseType && `${file.releaseType} · `}
                            {file.fileDate ? new Date(file.fileDate).toLocaleDateString() : ""}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          disabled={isDownloading}
                          onClick={() => handleDownloadFile(file)}
                          isLoading={isDownloading}
                        >
                          Download
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {selectedMod?.provider === "orbis" && orbisModUrl(selectedMod) && (
              <div className="pt-4 border-t border-[var(--color-border)]">
                <button
                  type="button"
                  className="text-sm text-[#7eb8ff] hover:text-[#a8d4ff] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(100,160,100,0.6)]"
                  onClick={() => selectedMod && openExternalUrl(orbisModUrl(selectedMod))}
                >
                  Open on Orbis.place
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
