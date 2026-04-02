import { useState, useCallback, useRef } from 'react';
import { generateArtwork } from '../api/client.js';
import { PolygonCoords, StyleName } from '../types.js';

interface ArtworkState {
  draftId: string | null;
  svg: string | null;
  loading: boolean;
  error: string | null;
}

interface CachedResult {
  draftId: string;
  svg: string;
}

export function useArtwork(sessionToken: string) {
  const [state, setState] = useState<ArtworkState>({
    draftId: null,
    svg: null,
    loading: false,
    error: null,
  });

  // Cache key = "<style>:<sorted highway types>", cleared when polygon changes.
  const cache = useRef<Map<string, CachedResult>>(new Map());
  const lastPolygonRef = useRef<PolygonCoords | null>(null);

  const generate = useCallback(
    async (polygon: PolygonCoords, style: StyleName, highwayTypes: string[], labelOffset: number, groupMap: Record<string, string>, clipToBoundary: boolean) => {
      if (lastPolygonRef.current !== polygon) {
        cache.current.clear();
        lastPolygonRef.current = polygon;
      }

      const cacheKey = `${style}:${[...highwayTypes].sort().join(',')}:${labelOffset}:${clipToBoundary}`;
      const cached = cache.current.get(cacheKey);
      if (cached) {
        setState({ draftId: cached.draftId, svg: cached.svg, loading: false, error: null });
        return;
      }

      setState(s => ({ ...s, loading: true, error: null }));
      try {
        const result = await generateArtwork(polygon, style, sessionToken, highwayTypes, labelOffset, groupMap, clipToBoundary);
        cache.current.set(cacheKey, { draftId: result.draftId, svg: result.svg });
        setState({ draftId: result.draftId, svg: result.svg, loading: false, error: null });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Artwork generation failed. Please try again.';
        setState(s => ({ ...s, loading: false, error: message }));
      }
    },
    [sessionToken],
  );

  return { ...state, generate };
}
