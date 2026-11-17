import { useEffect, useState } from 'react';
import { getAssetUrl } from '@/db/repos/assets';

/** Object URL for an IndexedDB asset (cached), or null while loading/missing. */
export function useAssetUrl(assetId: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (assetId) void getAssetUrl(assetId).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [assetId]);
  return url;
}
