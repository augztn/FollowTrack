import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { toByteArray } from 'base64-js';
import { parseInstagramExport } from '../../domain/instagramExport';
import type { RelationshipSnapshot } from '../../domain/types';

export async function pickInstagramExport(): Promise<RelationshipSnapshot | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/zip', 'application/x-zip-compressed'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) throw new Error('No file was selected.');
  if (asset.size !== undefined && asset.size > 250 * 1024 * 1024) {
    throw new Error('The ZIP is larger than the 250 MB import limit.');
  }

  const base64 = await readAsStringAsync(asset.uri, { encoding: EncodingType.Base64 });
  return parseInstagramExport(toByteArray(base64));
}
