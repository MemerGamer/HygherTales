import { useState, useCallback, useEffect } from "react";
import {
  readInstalledMods,
  writeInstalledMods,
  ensureModsDisabledDir,
  moveModFile,
  moveFileToTrash,
  listModDirFileNames,
  nextId,
  type InstalledModRecord,
} from "../lib/modsDb";
import { openPath } from "../lib/shell";

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
}

export function Installed({ modsDirPath }: InstalledProps) {
  const [mods, setMods] = useState<InstalledModRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rescanModal, setRescanModal] = useState<{
    inMods: string[];
    inDisabled: string[];
  } | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<InstalledModRecord | null>(null);

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
      </div>
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
          {mods.map((mod) => (
            <li key={mod.id ?? mod.installedFilename} className="installed-item">
              <div className="installed-info">
                <strong>{isUntracked(mod) ? mod.installedFilename : mod.name}</strong>
                <span className="installed-meta">
                  {mod.installedFilename}
                  {" · "}
                  {new Date(mod.installedAt).toLocaleDateString()}
                  {" · "}
                  {mod.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <div className="installed-actions">
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
          ))}
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
