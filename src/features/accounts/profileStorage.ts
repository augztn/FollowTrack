import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AccountProfile } from '../../domain/types';

const STORAGE_KEY = 'followtrack.profiles.v1';

export async function loadProfiles(): Promise<AccountProfile[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('Saved profiles could not be read. Your local data was left untouched.');
  }
  if (!Array.isArray(value)) throw new Error('Saved profile data has an unsupported format.');
  return value.filter(isAccountProfile);
}

export async function saveProfiles(profiles: readonly AccountProfile[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    throw new Error('Could not save this import. Check available device storage and try again.');
  }
}

function isAccountProfile(value: unknown): value is AccountProfile {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string'
    && typeof item.name === 'string'
    && typeof item.username === 'string'
    && typeof item.createdAt === 'string'
    && Array.isArray(item.snapshots);
}
