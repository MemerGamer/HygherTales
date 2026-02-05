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
  writeTextFile,
  readTextFile,
  type InstalledModRecord,
} from "../lib/modsDb";
import {
  readProfiles,
  writeProfiles,
  createProfile,
  addProfile,
  deleteProfile as deleteProfileFromData,
  renameProfile as renameProfileInData,
  type ProfileRecord,
  type ProfilesData,
} from "../lib/profilesDb";
import { openPath } from "../lib/shell";
import { open as openFileDialog, save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import { getModFiles, getDownloadUrlCurseForge, getDownloadUrlOrbis, ApiError } from "../lib/api";
import { getLatestFile, isUpdateAvailable } from "../lib/updates";
import type { ModFile } from "@hyghertales/shared";
import { PageContainer } from "../components/layout/PageContainer";
import { Button, Input, Card, Modal, Badge, Spinner } from "../components/ui";

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

/** Export format: list of mod identifiers for import. */
interface ExportedProfileMod {
  provider: "curseforge" | "orbis";
  projectId?: number;
  resourceId?: string;
  fileId?: number;
  versionId?: string;
  fileIndex?: number;
  slug: string;
  name: string;
}

interface ExportedProfile {
  name: string;
  exportedAt: string;
  mods: ExportedProfileMod[];
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
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [profilesData, setProfilesData] = useState<ProfilesData | null>(null);
  const [profileModal, setProfileModal] = useState<
    "create" | { rename: ProfileRecord } | { delete: ProfileRecord } | null
  >(null);
  const [switchDryRun, setSwitchDryRun] = useState<{
    profile: ProfileRecord;
    toEnable: InstalledModRecord[];
    toDisable: InstalledModRecord[];
    progress?: { done: number; total: number };
  } | null>(null);
  const [applyingProfile, setApplyingProfile] = useState(false);
  const [exportImportError, setExportImportError] = useState<string | null>(null);
  const [createProfileDraft, setCreateProfileDraft] = useState<{
    name: string;
    fromCurrent: boolean;
  } | null>(null);
  const [renameProfileDraft, setRenameProfileDraft] = useState<string>("");

  const loadMods = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await readInstalledMods();
      
      // Verify enabled state matches actual file location
      if (modsDirPath) {
        const disabledDirPath = getDisabledDir(modsDirPath);
        const [modsFiles, disabledFiles] = await Promise.all([
          listModDirFileNames(modsDirPath).catch(() => [] as string[]),
          listModDirFileNames(disabledDirPath).catch(() => [] as string[]),
        ]);
        const modsSet = new Set(modsFiles);
        const disabledSet = new Set(disabledFiles);
        
        let needsUpdate = false;
        const verified = list.map((mod) => {
          const inMods = modsSet.has(mod.installedFilename);
          const inDisabled = disabledSet.has(mod.installedFilename);
          const actualEnabled = inMods && !inDisabled;
          
          // Sync DB state with actual file location
          if (mod.enabled !== actualEnabled && (inMods || inDisabled)) {
            needsUpdate = true;
            return { ...mod, enabled: actualEnabled };
          }
          return mod;
        });
        
        if (needsUpdate) {
          await writeInstalledMods(verified);
          setMods(verified);
        } else {
          setMods(list);
        }
      } else {
        setMods(list);
      }
    } catch (e) {
      setError(String(e));
      setMods([]);
    } finally {
      setLoading(false);
    }
  }, [modsDirPath]);

  const loadProfiles = useCallback(async () => {
    try {
      const data = await readProfiles();
      setProfilesData(data);
    } catch {
      setProfilesData({ nextId: 1, activeProfileId: null, profiles: [] });
    }
  }, []);

  useEffect(() => {
    loadMods();
  }, [loadMods]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

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
        if (profilesData?.activeProfileId != null && mod.id != null) {
          const active = profilesData.profiles.find(
            (p) => p.id === profilesData.activeProfileId
          );
          if (active) {
            const enabledIds = updated
              .filter((m) => m.enabled && m.id != null)
              .map((m) => m.id!);
            const next = profilesData.profiles.map((p) =>
              p.id === active.id ? { ...p, enabledModIds: enabledIds } : p
            );
            const nextData = { ...profilesData, profiles: next };
            await writeProfiles(nextData);
            setProfilesData(nextData);
          }
        }
      } catch (e) {
        setActionError(String(e));
      }
    },
    [modsDirPath, disabledDir, mods, getFilePath, profilesData]
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

  const activeProfile =
    profilesData?.activeProfileId != null && profilesData?.profiles
      ? profilesData.profiles.find(
          (p) => p.id === profilesData.activeProfileId
        ) ?? null
      : null;

  function computeProfileSwitch(
    profile: ProfileRecord
  ): { toEnable: InstalledModRecord[]; toDisable: InstalledModRecord[] } {
    const enabledSet = new Set(profile.enabledModIds);
    const toEnable = mods.filter(
      (m) => m.id != null && enabledSet.has(m.id) && !m.enabled
    );
    const toDisable = mods.filter(
      (m) => m.id != null && !enabledSet.has(m.id) && m.enabled
    );
    return { toEnable, toDisable };
  }

  const requestProfileSwitch = useCallback(
    (profile: ProfileRecord) => {
      const { toEnable, toDisable } = computeProfileSwitch(profile);
      if (toEnable.length === 0 && toDisable.length === 0) {
        setProfilesData((prev) =>
          prev ? { ...prev, activeProfileId: profile.id } : null
        );
        writeProfiles({
          ...profilesData!,
          activeProfileId: profile.id,
        }).then(() => loadProfiles()).catch(() => {});
        return;
      }
      setSwitchDryRun({ profile, toEnable, toDisable });
    },
    [mods, profilesData]
  );

  const cancelSwitchDryRun = useCallback(() => {
    setSwitchDryRun(null);
  }, []);

  const applyProfileSwitch = useCallback(async () => {
    if (!switchDryRun || !modsDirPath || !profilesData) return;
    setApplyingProfile(true);
    setActionError(null);
    setExportImportError(null);
    try {
      await ensureModsDisabledDir(modsDirPath);
      const baseMods = modsDirPath.replace(/\\/g, "/").replace(/\/$/, "");
      const baseDisabled = disabledDir.replace(/\\/g, "/").replace(/\/$/, "");
      let updatedMods = [...mods];
      const total = switchDryRun.toEnable.length + switchDryRun.toDisable.length;
      let done = 0;
      for (const mod of switchDryRun.toDisable) {
        const fromPath = getFilePath(mod);
        const toPath = `${baseDisabled}/${mod.installedFilename}`;
        const finalPath = await moveModFile(fromPath, toPath);
        const newFilename = finalPath.replace(/^.*[/\\]/, "");
        updatedMods = updatedMods.map((m) =>
          m.id === mod.id
            ? { ...m, enabled: false, installedFilename: newFilename }
            : m
        );
        done++;
        setSwitchDryRun((prev) =>
          prev ? { ...prev, progress: { done, total } } : null
        );
      }
      for (const mod of switchDryRun.toEnable) {
        const fromPath = getFilePath({ ...mod, enabled: false });
        const toPath = `${baseMods}/${mod.installedFilename}`;
        const finalPath = await moveModFile(fromPath, toPath);
        const newFilename = finalPath.replace(/^.*[/\\]/, "");
        updatedMods = updatedMods.map((m) =>
          m.id === mod.id
            ? { ...m, enabled: true, installedFilename: newFilename }
            : m
        );
        done++;
        setSwitchDryRun((prev) =>
          prev ? { ...prev, progress: { done, total } } : null
        );
      }
      await writeInstalledMods(updatedMods);
      setMods(updatedMods);
      const nextData = {
        ...profilesData,
        activeProfileId: switchDryRun.profile.id,
      };
      await writeProfiles(nextData);
      setProfilesData(nextData);
      setSwitchDryRun(null);
    } catch (e) {
      setActionError(String(e));
    } finally {
      setApplyingProfile(false);
    }
  }, [
    switchDryRun,
    modsDirPath,
    profilesData,
    mods,
    disabledDir,
    getFilePath,
  ]);

  const handleCreateProfile = useCallback(
    async (name: string, fromCurrent: boolean) => {
      if (!profilesData || name.trim() === "") return;
      const enabledIds = fromCurrent
        ? mods.filter((m) => m.enabled && m.id != null).map((m) => m.id!)
        : [];
      const newProfile = createProfile(profilesData, name.trim(), enabledIds);
      const nextData = addProfile(profilesData, newProfile, true);
      await writeProfiles(nextData);
      setProfilesData(nextData);
      setProfileModal(null);
    },
    [profilesData, mods]
  );

  const handleRenameProfile = useCallback(
    async (profileId: number, name: string) => {
      if (!profilesData || name.trim() === "") return;
      const nextData = renameProfileInData(profilesData, profileId, name.trim());
      await writeProfiles(nextData);
      setProfilesData(nextData);
      setProfileModal(null);
    },
    [profilesData]
  );

  const handleDeleteProfile = useCallback(
    async (profile: ProfileRecord) => {
      if (!profilesData) return;
      const nextData = deleteProfileFromData(profilesData, profile.id);
      await writeProfiles(nextData);
      setProfilesData(nextData);
      setProfileModal(null);
    },
    [profilesData]
  );

  const handleExportProfile = useCallback(
    async (profile: ProfileRecord) => {
      setExportImportError(null);
      const profileMods = mods.filter(
        (m) => m.id != null && profile.enabledModIds.includes(m.id)
      );
      const exported: ExportedProfile = {
        name: profile.name,
        exportedAt: new Date().toISOString(),
        mods: profileMods.map((m) => {
          const entry: ExportedProfileMod = {
            provider: m.provider,
            slug: m.slug,
            name: m.name,
          };
          if (m.provider === "curseforge" && m.projectId != null) {
            entry.projectId = m.projectId;
            const fid =
              typeof m.installedFileId === "number"
                ? m.installedFileId
                : undefined;
            if (fid != null) entry.fileId = fid;
          }
          if (m.provider === "orbis" && m.resourceId != null) {
            entry.resourceId = m.resourceId;
            const v = m.installedFileId;
            if (typeof v === "string" && v.includes(":")) {
              const [versionId, fileIndex] = v.split(":");
              entry.versionId = versionId;
              const idx = parseInt(fileIndex, 10);
              if (!Number.isNaN(idx)) entry.fileIndex = idx;
            }
          }
          return entry;
        }),
      };
      try {
        const path = await saveFileDialog({
          filters: [{ name: "JSON", extensions: ["json"] }],
          defaultPath: `hyghertales-profile-${profile.name.replace(/[^a-z0-9-_]/gi, "-")}.json`,
        });
        if (path) {
          await writeTextFile(path, JSON.stringify(exported, null, 2));
        }
      } catch (e) {
        setExportImportError(String(e));
      }
    },
    [mods]
  );

  const handleImportProfile = useCallback(async () => {
    if (!modsDirPath?.trim() || !profilesData) return;
    setExportImportError(null);
    try {
      const path = await openFileDialog({
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path || typeof path !== "string") return;
      const raw = await readTextFile(path);
      const parsed = JSON.parse(raw) as ExportedProfile;
      if (!parsed.name || !Array.isArray(parsed.mods)) {
        throw new Error("Invalid profile file format.");
      }
      let currentMods = await readInstalledMods();
      const enabledIds: number[] = [];
      for (const entry of parsed.mods as ExportedProfileMod[]) {
        const match = currentMods.find((m) => {
          if (m.provider !== entry.provider) return false;
          if (entry.provider === "curseforge" && entry.projectId != null)
            return m.projectId === entry.projectId;
          if (entry.provider === "orbis" && entry.resourceId != null)
            return m.resourceId === entry.resourceId;
          return false;
        });
        if (match?.id != null) {
          enabledIds.push(match.id);
          continue;
        }
        if (entry.provider === "curseforge" && entry.fileId == null && entry.projectId != null) {
          const res = await getModFiles(proxyBaseUrl, "curseforge", String(entry.projectId));
          const latest = getLatestFile("curseforge", res.files);
          if (!latest?.fileId) continue;
          entry.fileId = latest.fileId;
        }
        if (entry.provider === "orbis" && (entry.versionId == null || entry.fileIndex == null) && entry.resourceId != null) {
          const res = await getModFiles(proxyBaseUrl, "orbis", entry.resourceId);
          const latest = getLatestFile("orbis", res.files);
          if (!latest?.versionId || latest.fileIndex == null) continue;
          entry.versionId = latest.versionId;
          entry.fileIndex = latest.fileIndex;
        }
        let url: string;
        if (entry.provider === "curseforge" && entry.projectId != null && entry.fileId != null) {
          const r = await getDownloadUrlCurseForge(proxyBaseUrl, entry.projectId, entry.fileId);
          url = r.url;
        } else if (
          entry.provider === "orbis" &&
          entry.resourceId != null &&
          entry.versionId != null &&
          entry.fileIndex != null
        ) {
          const r = await getDownloadUrlOrbis(
            proxyBaseUrl,
            entry.resourceId,
            entry.versionId,
            entry.fileIndex
          );
          url = r.url;
        } else {
          continue;
        }
        const baseDir = modsDirPath.replace(/\\/g, "/").replace(/\/$/, "");
        const fileName = `${entry.slug || "mod"}.jar`;
        const destPath = `${baseDir}/${fileName}`;
        const finalPath = await downloadFileToPath(url, destPath);
        const installedFilename = finalPath.replace(/^.*[/\\]/, "");
        const newId = nextId(currentMods);
        const newRecord: InstalledModRecord = {
          id: newId,
          provider: entry.provider,
          projectId: entry.provider === "curseforge" ? entry.projectId : null,
          resourceId: entry.provider === "orbis" ? entry.resourceId : null,
          slug: entry.slug,
          name: entry.name,
          installedFileId:
            entry.provider === "curseforge"
              ? entry.fileId ?? null
              : entry.versionId != null && entry.fileIndex != null
                ? `${entry.versionId}:${entry.fileIndex}`
                : null,
          installedFilename,
          installedAt: new Date().toISOString(),
          sourceUrl:
            entry.provider === "orbis"
              ? `https://www.orbis.place/mod/${entry.slug}`
              : undefined,
          enabled: true,
        };
        currentMods = [...currentMods, newRecord];
        await writeInstalledMods(currentMods);
        enabledIds.push(newId);
      }
      setMods(currentMods);
      const newProfile = createProfile(
        profilesData,
        `Imported: ${parsed.name}`,
        enabledIds
      );
      const nextData = addProfile(profilesData, newProfile, true);
      await writeProfiles(nextData);
      setProfilesData(nextData);
      await ensureModsDisabledDir(modsDirPath);
      const baseMods = modsDirPath.replace(/\\/g, "/").replace(/\/$/, "");
      const baseDisabled = getDisabledDir(modsDirPath).replace(/\\/g, "/").replace(/\/$/, "");
      const enabledSet = new Set(enabledIds);
      let finalMods = currentMods.map((m) => ({
        ...m,
        enabled: m.id != null && enabledSet.has(m.id),
      }));
      for (const mod of currentMods) {
        const shouldEnable = mod.id != null && enabledSet.has(mod.id);
        if (shouldEnable && !mod.enabled) {
          const fromPath = `${baseDisabled}/${mod.installedFilename}`;
          const toPath = `${baseMods}/${mod.installedFilename}`;
          try {
            const finalPath = await moveModFile(fromPath, toPath);
            const newFilename = finalPath.replace(/^.*[/\\]/, "");
            finalMods = finalMods.map((m) =>
              m.id === mod.id ? { ...m, enabled: true, installedFilename: newFilename } : m
            );
          } catch {
            /* file may already be in Mods */
          }
        } else if (!shouldEnable && mod.enabled) {
          const fromPath = `${baseMods}/${mod.installedFilename}`;
          const toPath = `${baseDisabled}/${mod.installedFilename}`;
          try {
            const finalPath = await moveModFile(fromPath, toPath);
            const newFilename = finalPath.replace(/^.*[/\\]/, "");
            finalMods = finalMods.map((m) =>
              m.id === mod.id ? { ...m, enabled: false, installedFilename: newFilename } : m
            );
          } catch {
            /* file may already be in Mods.disabled */
          }
        }
      }
      await writeInstalledMods(finalMods);
      setMods(finalMods);
    } catch (e) {
      setExportImportError(String(e));
    }
  }, [
    modsDirPath,
    profilesData,
    proxyBaseUrl,
  ]);

  const canCheckUpdate = (mod: InstalledModRecord): boolean => {
    if (isUntracked(mod) || mod.pinned) return false;
    if (mod.provider === "curseforge" && mod.projectId != null) return true;
    if (mod.provider === "orbis" && mod.resourceId != null) return true;
    return false;
  };

  const checkUpdates = useCallback(async () => {
    setUpdateError(null);
    setUpdateSuccess(null);
    setCheckingUpdates(true);
    const next: Record<string, ModFile> = {};
    let checkedCount = 0;
    let updateCount = 0;
    
    try {
      const toCheck = mods.filter(canCheckUpdate);
      checkedCount = toCheck.length;
      
      await Promise.all(
        toCheck.map(async (mod) => {
          let latest: ModFile | null = null;
          
          // Try CurseForge first if we have projectId
          if (mod.projectId != null) {
            try {
              const res = await getModFiles(proxyBaseUrl, "curseforge", String(mod.projectId));
              latest = getLatestFile("curseforge", res.files);
            } catch {
              /* fall through to Orbis */
            }
          }
          
          // Fallback to Orbis if CurseForge failed or no update found
          if (!latest && mod.resourceId != null) {
            try {
              const res = await getModFiles(proxyBaseUrl, "orbis", mod.resourceId);
              latest = getLatestFile("orbis", res.files);
            } catch {
              /* skip */
            }
          }
          
          if (latest && isUpdateAvailable(mod, latest)) {
            next[updateKey(mod)] = latest;
            updateCount++;
          }
        })
      );
      
      setUpdateMap(next);
      // Show success message even if no updates
      setUpdateSuccess(
        `Checked ${checkedCount} mod(s). ${updateCount > 0 ? `${updateCount} update(s) available.` : "All mods are up to date."}`
      );
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

  const selectStyles =
    "px-3 py-2 bg-[rgba(255,255,255,0.1)] border border-[var(--color-border)] rounded text-[var(--color-text)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1a1a1a] focus:ring-[rgba(100,160,100,0.6)] disabled:opacity-60 disabled:cursor-not-allowed";

  if (!modsDirPath?.trim()) {
    return (
      <PageContainer title="Installed mods">
        <div className="p-3 bg-[var(--color-danger)] border border-[rgba(220,80,80,0.6)] rounded text-[#ffb3b3]">
          Set the Mods directory in Settings to manage installed mods.
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Installed mods">
      {/* Profile switcher */}
      <div className="flex flex-wrap items-center gap-3 mb-6 pb-6 border-b border-[var(--color-border)]">
        <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
          Profile
          <select
            value={profilesData?.activeProfileId ?? ""}
            aria-label="Active profile"
            className={selectStyles}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") {
                if (profilesData?.activeProfileId != null) {
                  setProfilesData((prev) =>
                    prev ? { ...prev, activeProfileId: null } : null
                  );
                  writeProfiles({
                    ...profilesData!,
                    activeProfileId: null,
                  }).then(() => loadProfiles()).catch(() => {});
                }
                return;
              }
              const id = Number(v);
              const profile = profilesData?.profiles.find((p) => p.id === id);
              if (profile) requestProfileSwitch(profile);
            }}
          >
            <option value="">No profile</option>
            {profilesData?.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => {
              setProfileModal("create");
              setCreateProfileDraft({ name: "", fromCurrent: true });
            }}
          >
            Create
          </Button>
          <Button
            size="sm"
            disabled={!activeProfile}
            onClick={() => {
              if (activeProfile) {
                setProfileModal({ rename: activeProfile });
                setRenameProfileDraft(activeProfile.name);
              }
            }}
          >
            Rename
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={!activeProfile}
            onClick={() =>
              activeProfile && setProfileModal({ delete: activeProfile })
            }
          >
            Delete
          </Button>
          <Button
            size="sm"
            disabled={!activeProfile}
            onClick={() => activeProfile && handleExportProfile(activeProfile)}
          >
            Export
          </Button>
          <Button size="sm" onClick={handleImportProfile}>
            Import
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button onClick={runRescan} disabled={loading} size="sm">
          Rescan folders
        </Button>
        <Button
          onClick={checkUpdates}
          disabled={loading || checkingUpdates}
          size="sm"
          isLoading={checkingUpdates}
        >
          Check updates
        </Button>
        {hasAnyUpdate && (
          <Button
            variant="primary"
            onClick={updateAll}
            disabled={updatingIds.size > 0}
            size="sm"
            isLoading={updatingIds.size > 0}
          >
            Update all
          </Button>
        )}
      </div>

      {/* Error messages */}
      {updateError && (
        <div
          className="p-3 mb-4 bg-[var(--color-danger)] border border-[rgba(220,80,80,0.6)] rounded text-[#ffb3b3]"
          role="alert"
        >
          {updateError}
        </div>
      )}
      {updateSuccess && (
        <div
          className="p-3 mb-4 bg-[rgba(100,160,100,0.2)] border border-[rgba(100,160,100,0.6)] rounded text-[#b3ffb3]"
          role="status"
        >
          {updateSuccess}
        </div>
      )}
      {exportImportError && (
        <div
          className="p-3 mb-4 bg-[var(--color-danger)] border border-[rgba(220,80,80,0.6)] rounded text-[#ffb3b3]"
          role="alert"
        >
          {exportImportError}
        </div>
      )}
      {actionError && (
        <div
          className="p-3 mb-4 bg-[var(--color-danger)] border border-[rgba(220,80,80,0.6)] rounded text-[#ffb3b3]"
          role="alert"
        >
          {actionError}
        </div>
      )}
      {error && (
        <div
          className="p-3 mb-4 bg-[var(--color-danger)] border border-[rgba(220,80,80,0.6)] rounded text-[#ffb3b3]"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : mods.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">
          No mods in the database. Install mods from Browse (downloads go to your Mods folder).
        </p>
      ) : (
        <div className="space-y-3">
          {mods.map((mod) => {
            const key = updateKey(mod);
            const latestFile = updateMap[key];
            const updateAvailable = latestFile != null && !mod.pinned;
            const isUpdating = mod.id != null && updatingIds.has(mod.id);
            return (
              <Card
                key={mod.id ?? mod.installedFilename}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white">
                      {isUntracked(mod) ? mod.installedFilename : mod.name}
                    </h3>
                    {updateAvailable && (
                      <Badge variant="success">Update available</Badge>
                    )}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {mod.installedFilename}
                    {" · "}
                    {new Date(mod.installedAt).toLocaleDateString()}
                    {" · "}
                    {mod.enabled ? "Enabled" : "Disabled"}
                    {mod.pinned && " · Pinned"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!isUntracked(mod) && (
                    <label className="flex items-center gap-1.5 text-sm text-[var(--color-text)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!mod.pinned}
                        onChange={() => togglePinned(mod)}
                        className="cursor-pointer"
                      />
                      Pinned
                    </label>
                  )}
                  {updateAvailable && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => updateOne(mod)}
                      disabled={isUpdating}
                      isLoading={isUpdating}
                    >
                      Update
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => toggleEnabled(mod)}
                    title={mod.enabled ? "Disable" : "Enable"}
                  >
                    {mod.enabled ? "Disable" : "Enable"}
                  </Button>
                  <Button size="sm" onClick={() => openInFolder(mod)}>
                    Open in folder
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setRemoveConfirm(mod)}
                  >
                    Remove
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Remove confirmation modal */}
      <Modal
        isOpen={removeConfirm !== null}
        onClose={() => setRemoveConfirm(null)}
        title="Remove mod?"
        footer={
          <>
            <Button onClick={() => setRemoveConfirm(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => removeConfirm && handleRemove(removeConfirm)}
            >
              Move to Trash
            </Button>
          </>
        }
      >
        <p className="text-[var(--color-text)]">
          Move &quot;{removeConfirm?.installedFilename}&quot; to Trash? You can
          restore it from the Recycle Bin.
        </p>
      </Modal>

      {/* Rescan modal */}
      <Modal
        isOpen={rescanModal !== null}
        onClose={ignoreUntracked}
        title="Untracked files"
        size="wide"
        footer={<Button onClick={ignoreUntracked}>Close</Button>}
      >
        {rescanModal && (
          <div className="space-y-4">
            {rescanModal.inMods.length > 0 && (
              <div>
                <h4 className="font-semibold text-white mb-2">In Mods/</h4>
                <ul className="space-y-2">
                  {rescanModal.inMods.map((f) => (
                    <li
                      key={f}
                      className="flex items-center justify-between gap-2 text-sm text-[var(--color-text)]"
                    >
                      <span className="truncate">{f}</span>
                      <Button size="sm" onClick={() => addUntracked(f, true)}>
                        Add as enabled
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {rescanModal.inDisabled.length > 0 && (
              <div>
                <h4 className="font-semibold text-white mb-2">In Mods.disabled/</h4>
                <ul className="space-y-2">
                  {rescanModal.inDisabled.map((f) => (
                    <li
                      key={f}
                      className="flex items-center justify-between gap-2 text-sm text-[var(--color-text)]"
                    >
                      <span className="truncate">{f}</span>
                      <Button size="sm" onClick={() => addUntracked(f, false)}>
                        Add as disabled
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-[var(--color-text-muted)]">
              Add tracks the file in the database. Close to ignore.
            </p>
          </div>
        )}
      </Modal>

      {/* Create profile modal */}
      <Modal
        isOpen={profileModal === "create" && createProfileDraft !== null}
        onClose={() => {
          setProfileModal(null);
          setCreateProfileDraft(null);
        }}
        title="Create profile"
        footer={
          <>
            <Button
              onClick={() => {
                setProfileModal(null);
                setCreateProfileDraft(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!createProfileDraft?.name.trim()}
              onClick={() =>
                createProfileDraft &&
                handleCreateProfile(
                  createProfileDraft.name,
                  createProfileDraft.fromCurrent
                )
              }
            >
              Create
            </Button>
          </>
        }
      >
        {createProfileDraft && (
          <div className="space-y-4">
            <div>
              <label htmlFor="profile-name" className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                Name
              </label>
              <Input
                id="profile-name"
                type="text"
                value={createProfileDraft.name}
                onChange={(e) =>
                  setCreateProfileDraft((d) =>
                    d ? { ...d, name: e.target.value } : d
                  )
                }
                placeholder="Profile name"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-[var(--color-text)] cursor-pointer">
              <input
                type="checkbox"
                checked={createProfileDraft.fromCurrent}
                onChange={(e) =>
                  setCreateProfileDraft((d) =>
                    d ? { ...d, fromCurrent: e.target.checked } : d
                  )
                }
                className="cursor-pointer"
              />
              Start from current enabled mod set
            </label>
          </div>
        )}
      </Modal>

      {/* Rename profile modal */}
      <Modal
        isOpen={
          profileModal !== null &&
          profileModal !== "create" &&
          "rename" in profileModal
        }
        onClose={() => {
          setProfileModal(null);
          setRenameProfileDraft("");
        }}
        title="Rename profile"
        footer={
          <>
            <Button
              onClick={() => {
                setProfileModal(null);
                setRenameProfileDraft("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!renameProfileDraft.trim()}
              onClick={() =>
                profileModal &&
                profileModal !== "create" &&
                "rename" in profileModal &&
                handleRenameProfile(profileModal.rename.id, renameProfileDraft)
              }
            >
              Rename
            </Button>
          </>
        }
      >
        <div>
          <label htmlFor="rename-profile-name" className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
            Name
          </label>
          <Input
            id="rename-profile-name"
            type="text"
            value={renameProfileDraft}
            onChange={(e) => setRenameProfileDraft(e.target.value)}
            placeholder="Profile name"
          />
        </div>
      </Modal>

      {/* Delete profile modal */}
      <Modal
        isOpen={
          profileModal !== null &&
          profileModal !== "create" &&
          "delete" in profileModal
        }
        onClose={() => setProfileModal(null)}
        title="Delete profile?"
        footer={
          <>
            <Button onClick={() => setProfileModal(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() =>
                profileModal &&
                profileModal !== "create" &&
                "delete" in profileModal &&
                handleDeleteProfile(profileModal.delete)
              }
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-[var(--color-text)]">
          Delete profile &quot;
          {profileModal !== null &&
            profileModal !== "create" &&
            "delete" in profileModal &&
            profileModal.delete.name}
          &quot;? This does not remove any mod files.
        </p>
      </Modal>

      {/* Profile switch dry-run modal */}
      <Modal
        isOpen={switchDryRun !== null}
        onClose={() => applyingProfile ? undefined : cancelSwitchDryRun()}
        title={switchDryRun ? `Switch to "${switchDryRun.profile.name}"` : ""}
        size="wide"
        footer={
          !switchDryRun?.progress && (
            <>
              <Button onClick={cancelSwitchDryRun}>Cancel</Button>
              <Button
                variant="primary"
                onClick={applyProfileSwitch}
                disabled={applyingProfile}
                isLoading={applyingProfile}
              >
                Apply
              </Button>
            </>
          )
        }
      >
        {switchDryRun && (
          <div className="space-y-4">
            {switchDryRun.progress ? (
              <div className="flex items-center gap-3">
                <Spinner />
                <p className="text-[var(--color-text)]">
                  Applying… {switchDryRun.progress.done} /{" "}
                  {switchDryRun.progress.total} files moved.
                </p>
              </div>
            ) : (
              <>
                <p className="text-[var(--color-text)]">
                  Summary: the following mods will be moved (no files will be
                  deleted).
                </p>
                {switchDryRun.toEnable.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-white mb-2">
                      Enable ({switchDryRun.toEnable.length})
                    </h4>
                    <ul className="space-y-1">
                      {switchDryRun.toEnable.map((m) => (
                        <li
                          key={m.id}
                          className="text-sm text-[var(--color-text)]"
                        >
                          {m.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {switchDryRun.toDisable.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-white mb-2">
                      Disable ({switchDryRun.toDisable.length})
                    </h4>
                    <ul className="space-y-1">
                      {switchDryRun.toDisable.map((m) => (
                        <li
                          key={m.id}
                          className="text-sm text-[var(--color-text)]"
                        >
                          {m.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
