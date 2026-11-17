/** Binary assets (images, PDFs) stored as Blobs in IndexedDB. */
import type { Asset, ID } from '@/types/models';
import { db } from '../db';
import { newId } from '@/lib/ids';

export const MAX_ASSET_BYTES = 50 * 1024 * 1024;

export async function addAsset(projectId: ID, file: File | Blob, name?: string): Promise<Asset> {
  if (file.size > MAX_ASSET_BYTES) throw new Error('File is larger than 50 MB');
  const asset: Asset = {
    id: newId(),
    projectId,
    name: name ?? (file instanceof File ? file.name : 'file'),
    mime: file.type || 'application/octet-stream',
    size: file.size,
    blob: file,
    createdAt: Date.now(),
  };
  await db.assets.put(asset);
  return asset;
}

export const getAsset = (id: ID) => db.assets.get(id);

export async function deleteAsset(id: ID): Promise<void> {
  revokeAssetUrl(id);
  await db.assets.delete(id);
}

const urlCache = new Map<ID, string>();

/** Returns (and caches) an object URL for an asset. */
export async function getAssetUrl(id: ID): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  const asset = await db.assets.get(id);
  if (!asset) return null;
  const url = URL.createObjectURL(asset.blob);
  urlCache.set(id, url);
  return url;
}

export function revokeAssetUrl(id: ID) {
  const url = urlCache.get(id);
  if (url) URL.revokeObjectURL(url);
  urlCache.delete(id);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const [head, body] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream';
  const isBase64 = head.includes(';base64');
  const raw = isBase64 ? atob(body) : decodeURIComponent(body);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
