import { useState, useCallback, useEffect } from "react";
import {
  readInstalledMods,
  writeInstalledMods,
  ensureModsDisabledDir,
  moveModFile,
  moveFileToTrash,
  listModDirFileNames,
  downloadFileToPath,
  applyModUpdate,
  nextId,
  type InstalledModRecord,
} from "../lib/modsDb";
import { openPath } from "../lib/shell";
import { getModFiles, getDownloadUrlCurseForge, getDownloadUrlOrbis, ApiError } from "../lib/api";
import { getLatestFile, isUpdateAvailable } from "../lib/updates";
import type { ModFile } from "@hyghertales/shared";

/** Mods.disabled path from Mods path (e.g. .../UserData/Mods -> .../UserData/Mods.disabled). */
function getDisabledDir(modsDir: string): string {
  const normalized = modsDir.replace(/\\/g, "/").trim();
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) return normalized + ".disabled";
  parts[parts.length - 1] = parts[parts.length - 1] + ".disabled";
  return parts.join("/");
}

function isUntracked(mod: InstalledModRecord): boolean {
  return mod.slug === "__untracked__";
}

interface InstalledProps {
  modsDirPath: string | null;
  proxyBaseUrl: string;
}

/** Key for update map: mod id or fallback. */
function updateKey(mod: InstalledModRecord): string {
  return mod.id != null ? String(mod.id) : `${mod.provider}-${mod.slug}`;
}

export function Installed({ modsDirPath, proxyBaseUrl }: InstalledProps) {
  const [mods, setMods] = useState<InstalledModRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rescanModal, setRescanModal] = useState<{
    inMods: string[];
    inDisabled: string[];
  } | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<InstalledModRecord | null>(null);
  const [updateMap, setUpdateMap] = useState<Record<string, ModFile>>({});
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());
  const [updateError, setUpdateError] = useState<string | null>(null);

  const loadMods = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await readInstalledMods();
      setMods(list);
    } catch (e) {
      setError(String(e));
      setMods([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMods();
  }, [loadMods]);

  const disabledDir = modsDirPath ? getDisabledDir(modsDirPath) : "";
  const getFilePath = useCallback(
    (mod: InstalledModRecord) => {
      if (!modsDirPath) return "";
      const dir = mod.enabled ? modsDirPath : disabledDir;
      return `${dir.replace(/\\/g, "/").replace(/\/$/, "")}/${mod.installedFilename}`;
    },
    [modsDirPath, disabledDir]
  );

  const openInFolder = useCallback(
    async (mod: InstalledModRecord) => {
      if (!modsDirPath) return;
      const dir = mod.enabled ? modsDirPath : disabledDir;
      try {
        await openPath(dir);
      } catch (e) {
        setActionError(String(e));
      }
    },
    [modsDirPath, disabledDir]
  );

  const toggleEnabled = useCallback(
    async (mod: InstalledModRecord) => {
      if (!modsDirPath) return;
      setActionError(null);
      try {
        await ensureModsDisabledDir(modsDirPath);
        const fromPath = getFilePath(mod);
        const toDir = mod.enabled ? disabledDir : modsDirPath;
        const toPath = `${toDir.replace(/\\/g, "/").replace(/\/$/, "")}/${mod.installedFilename}`;
        const finalPath = await moveModFile(fromPath, toPath);
        const newFilename = finalPath.replace(/^.*[/\\]/, "");
        const updated = mods.map((m) =>
          m.id === mod.id
            ? {
                ...m,
                enabled: !m.enabled,
                installedFilename: newFilename,
              }
            : m
        );
        await writeInstalledMods(updated);
        setMods(updated);
      } catch (e) {
        setActionError(String(e));
      }
    },
    [modsDirPath, disabledDir, mods, getFilePath]
  );

  const handleRemove = useCallback(
    async (mod: InstalledModRecord) => {
      setRemoveConfirm(null);
      const path = getFilePath(mod);
      setActionError(null);
      try {
        await moveFileToTrash(path);
        const updated = mods.filter((m) => m.id !== mod.id);
        await writeInstalledMods(updated);
        setMods(updated);
      } catch (e) {
        setActionError(String(e));
      }
    },
    [mods, getFilePath]
  );

  const runRescan = useCallback(async () => {
    if (!modsDirPath) return;
    setActionError(null);
    try {
      await ensureModsDisabledDir(modsDirPath);
      const [inMods, inDisabled] = await Promise.all([
        listModDirFileNames(modsDirPath),
        listModDirFileNames(disabledDir),
      ]);
      const trackedMods = new Set(mods.map((m) => m.installedFilename));
      const untrackedInMods = inMods.filter((f) => !trackedMods.has(f));
      const untrackedInDisabled = inDisabled.filter((f) => !trackedMods.has(f));
      if (untrackedInMods.length === 0 && untrackedInDisabled.length === 0) {
        setActionError(null);
        return;
      }
      setRescanModal({ inMods: untrackedInMods, inDisabled: untrackedInDisabled });
    } catch (e) {
      setActionError(String(e));
    }
  }, [modsDirPath, disabledDir, mods]);

  const addUntracked = useCallback(
    async (filename: string, inModsFolder: boolean) => {
      const newMod: InstalledModRecord = {
        id: nextId(mods),
        provider: "orbis",
        slug: "__untracked__",
        name: filename,
        installedFilename: filename,
        installedAt: new Date().toISOString(),
        enabled: inModsFolder,
        pinned: false,
      };
      const updated = [...mods, newMod];
      await writeInstalledMods(updated);
      setMods(updated);
      setRescanModal((prev) => {
        if (!prev) return null;
        if (inModsFolder) {
          const inMods = prev.inMods.filter((f) => f !== filename);
          const inDisabled = prev.inDisabled;
          return inMods.length === 0 && inDisabled.length === 0 ? null : { inMods, inDisabled };
        } else {
          const inDisabled = prev.inDisabled.filter((f) => f !== filename);
          const inMods = prev.inMods;
          return inMods.length === 0 && inDisabled.length === 0 ? null : { inMods, inDisabled };
        }
      });
    },
    [mods]
  );

  const ignoreUntracked = useCallback(() => {
    setRescanModal(null);
  }, []);

  const canCheckUpdate = (mod: InstalledModRecord): boolean => {
    if (isUntracked(mod) || mod.pinned) return false;
    if (mod.provider === "curseforge" && mod.projectId != null) return true;
    if (mod.provider === "orbis" && mod.resourceId != null) return true;
    return false;
  };

  const checkUpdates = useCallback(async () => {
    setUpdateError(null);
    setCheckingUpdates(true);
    const next: Record<string, ModFile> = {};
    try {
      const toCheck = mods.filter(canCheckUpdate);
      await Promise.all(
        toCheck.map(async (mod) => {
          try {
            const id =
              mod.provider === "curseforge"
                ? String(mod.projectId)
                : mod.resourceId!;
            const res = await getModFiles(proxyBaseUrl, mod.provider, id);
            const latest = getLatestFile(mod.provider, res.files);
            if (latest && isUpdateAvailable(mod, latest)) {
              next[updateKey(mod)] = latest;
            }
          } catch {
            /* skip this mod */
          }
        })
      );
      setUpdateMap(next);
    } catch (e) {
      setUpdateError(String(e));
    } finally {
      setCheckingUpdates(false);
    }
  }, [mods, proxyBaseUrl]);

  const togglePinned = useCallback(
    async (mod: InstalledModRecord) => {
      setActionError(null);
      const updated = mods.map((m) =>
        m.id === mod.id ? { ...m, pinned: !(m.pinned ?? false) } : m
      );
      await writeInstalledMods(updated);
      setMods(updated);
      if (mod.pinned) return;
      setUpdateMap((prev) => {
        const key = updateKey(mod);
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [mods]
  );

  const updateOne = useCallback(
    async (mod: InstalledModRecord) => {
      const key = updateKey(mod);
      const latestFile = updateMap[key];
      if (!latestFile || !modsDirPath || mod.id == null) return;
      setUpdateError(null);
      setUpdatingIds((s) => new Set(s).add(mod.id!));
      const finalDir = mod.enabled ? modsDirPath : disabledDir;
      const baseDir = finalDir.replace(/\\/g, "/").replace(/\/$/, "");
      const oldPath = getFilePath(mod);
      const newFilename = latestFile.fileName || latestFile.displayName || "mod.jar";
      const tempPath = `${baseDir}/.ht-update-${Date.now()}-${newFilename}`;
      try {
        let url: string;
        if (mod.provider === "curseforge" && mod.projectId != null && latestFile.fileId != null) {
          const res = await getDownloadUrlCurseForge(
            proxyBaseUrl,
            mod.projectId,
            latestFile.fileId
          );
          url = res.url;
        } else if (
          mod.provider === "orbis" &&
          mod.resourceId != null &&
          latestFile.versionId != null &&
          latestFile.fileIndex != null
        ) {
          const res = await getDownloadUrlOrbis(
            proxyBaseUrl,
            mod.resourceId,
            latestFile.versionId,
            latestFile.fileIndex
          );
          url = res.url;
        } else if (latestFile.downloadUrl) {
          url = latestFile.downloadUrl;
        } else {
          throw new Error("Cannot get download URL for this file.");
        }
        const downloadedPath = await downloadFileToPath(url, tempPath);
        const finalFilename = await applyModUpdate(
          oldPath,
          downloadedPath,
          finalDir,
          newFilename
        );
        const updated = mods.map((m) =>
          m.id === mod.id
            ? {
                ...m,
                installedFilename: finalFilename,
                installedAt: new Date().toISOString(),
                installedFileId:
                  mod.provider === "curseforge"
                    ? latestFile.fileId ?? m.installedFileId
                    : latestFile.versionId != null && latestFile.fileIndex != null
                      ? `${latestFile.versionId}:${latestFile.fileIndex}`
                      : m.installedFileId,
              }
            : m
        );
        await writeInstalledMods(updated);
        setMods(updated);
        setUpdateError(null);
        setUpdateMap((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      } catch (e) {
        const msg =
          e instanceof ApiError && e.status === 503
            ? "This mod's download is restricted by CurseForge distribution settings. You may need to download it manually from the website."
            : e instanceof ApiError
              ? e.body?.message ?? e.message
              : String(e);
        setUpdateError(msg);
      } finally {
        setUpdatingIds((s) => {
          const next = new Set(s);
          next.delete(mod.id!);
          return next;
        });
      }
    },
    [
      updateMap,
      modsDirPath,
      disabledDir,
      mods,
      getFilePath,
      proxyBaseUrl,
    ]
  );

  const updateAll = useCallback(async () => {
    const toUpdate = mods.filter(
      (m) => m.id != null && !m.pinned && updateMap[updateKey(m)] != null
    );
    for (const mod of toUpdate) {
      await updateOne(mod);
    }
  }, [mods, updateMap, updateOne]);

  const hasAnyUpdate = Object.keys(updateMap).length > 0;

  if (!modsDirPath?.trim()) {
    return (
      <section className="page">
        <h2>Installed mods</h2>
        <p className="error-banner">
          Set the Mods directory in Settings to manage installed mods.
        </p>
      </section>
    );
  }

  return (
    <section className="page">
      <h2>Installed mods</h2>
      <div className="installed-toolbar">
        <button type="button" onClick={runRescan} disabled={loading}>
          Rescan folders
        </button>
        <button
          type="button"
          onClick={checkUpdates}
          disabled={loading || checkingUpdates}
        >
          {checkingUpdates ? "Checking…" : "Check updates"}
        </button>
        {hasAnyUpdate && (
          <button
            type="button"
            className="installed-update-all"
            onClick={updateAll}
            disabled={updatingIds.size > 0}
          >
            {updatingIds.size > 0 ? "Updating…" : "Update all"}
          </button>
        )}
      </div>
      {updateError && (
        <div className="error-banner" role="alert">
          {updateError}
        </div>
      )}
      {actionError && (
        <div className="error-banner" role="alert">
          {actionError}
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <p>Loading…</p>
      ) : mods.length === 0 ? (
        <p>No mods in the database. Install mods from Browse (downloads go to your Mods folder).</p>
      ) : (
        <ul className="installed-list">
          {mods.map((mod) => {
            const key = updateKey(mod);
            const latestFile = updateMap[key];
            const updateAvailable = latestFile != null && !mod.pinned;
            const isUpdating = mod.id != null && updatingIds.has(mod.id);
            return (
              <li key={mod.id ?? mod.installedFilename} className="installed-item">
                <div className="installed-info">
                  <strong>
                    {isUntracked(mod) ? mod.installedFilename : mod.name}
                    {updateAvailable && (
                      <span className="installed-badge">Update available</span>
                    )}
                  </strong>
                  <span className="installed-meta">
                    {mod.installedFilename}
                    {" · "}
                    {new Date(mod.installedAt).toLocaleDateString()}
                    {" · "}
                    {mod.enabled ? "Enabled" : "Disabled"}
                    {mod.pinned && " · Pinned"}
                  </span>
                </div>
                <div className="installed-actions">
                  {!isUntracked(mod) && (
                    <label className="installed-pinned">
                      <input
                        type="checkbox"
                        checked={!!mod.pinned}
                        onChange={() => togglePinned(mod)}
                      />
                      Pinned
                    </label>
                  )}
                  {updateAvailable && (
                    <button
                      type="button"
                      className="installed-update-btn"
                      onClick={() => updateOne(mod)}
                      disabled={isUpdating}
                    >
                      {isUpdating ? "Updating…" : "Update"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleEnabled(mod)}
                    title={mod.enabled ? "Disable" : "Enable"}
                  >
                    {mod.enabled ? "Disable" : "Enable"}
                  </button>
                  <button type="button" onClick={() => openInFolder(mod)}>
                    Open in folder
                  </button>
                  <button
                    type="button"
                    className="installed-remove"
                    onClick={() => setRemoveConfirm(mod)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {removeConfirm && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <h3>Remove mod?</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setRemoveConfirm(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Move &quot;{removeConfirm.installedFilename}&quot; to Trash? You can restore it from
                the Recycle Bin.
              </p>
              <div className="modal-actions">
                <button type="button" onClick={() => setRemoveConfirm(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => handleRemove(removeConfirm)}
                >
                  Move to Trash
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {rescanModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal modal-wide">
            <div className="modal-header">
              <h3>Untracked files</h3>
              <button
                type="button"
                className="modal-close"
                onClick={ignoreUntracked}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {rescanModal.inMods.length > 0 && (
                <>
                  <h4>In Mods/</h4>
                  <ul className="rescan-list">
                    {rescanModal.inMods.map((f) => (
                      <li key={f}>
                        {f}{" "}
                        <button type="button" onClick={() => addUntracked(f, true)}>
                          Add as enabled
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {rescanModal.inDisabled.length > 0 && (
                <>
                  <h4>In Mods.disabled/</h4>
                  <ul className="rescan-list">
                    {rescanModal.inDisabled.map((f) => (
                      <li key={f}>
                        {f}{" "}
                        <button type="button" onClick={() => addUntracked(f, false)}>
                          Add as disabled
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="rescan-hint">Add tracks the file in the database. Close to ignore.</p>
              <button type="button" onClick={ignoreUntracked}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
