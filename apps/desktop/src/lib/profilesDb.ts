/**
 * Profiles DB: multiple mod sets (which mods are enabled per profile).
 * Stored via Tauri commands; matches Rust ProfilesData (camelCase in JSON).
 */

import { invoke } from "@tauri-apps/api/core";

export interface ProfileRecord {
  id: number;
  name: string;
  createdAt: string;
  enabledModIds: number[];
}

export interface ProfilesData {
  nextId: number;
  activeProfileId: number | null;
  profiles: ProfileRecord[];
}

export async function readProfiles(): Promise<ProfilesData> {
  return invoke<ProfilesData>("read_profiles");
}

export async function writeProfiles(data: ProfilesData): Promise<void> {
  return invoke("write_profiles", { data });
}

export function createProfile(
  data: ProfilesData,
  name: string,
  enabledModIds: number[]
): ProfileRecord {
  const id = data.nextId;
  return {
    id,
    name,
    createdAt: new Date().toISOString(),
    enabledModIds: [...enabledModIds],
  };
}

export function nextProfileId(data: ProfilesData): number {
  return data.nextId;
}

/** Returns new ProfilesData with the new profile added and optionally set as active. */
export function addProfile(
  data: ProfilesData,
  profile: ProfileRecord,
  setActive: boolean
): ProfilesData {
  const profiles = [...data.profiles, profile];
  return {
    nextId: data.nextId + 1,
    activeProfileId: setActive ? profile.id : data.activeProfileId,
    profiles,
  };
}

/** Returns new ProfilesData with the profile removed. Clears active if it was this profile. */
export function deleteProfile(
  data: ProfilesData,
  profileId: number
): ProfilesData {
  const profiles = data.profiles.filter((p) => p.id !== profileId);
  const activeProfileId =
    data.activeProfileId === profileId
      ? profiles[0]?.id ?? null
      : data.activeProfileId;
  return { ...data, profiles, activeProfileId };
}

/** Returns new ProfilesData with the profile renamed. */
export function renameProfile(
  data: ProfilesData,
  profileId: number,
  name: string
): ProfilesData {
  const profiles = data.profiles.map((p) =>
    p.id === profileId ? { ...p, name } : p
  );
  return { ...data, profiles };
}
