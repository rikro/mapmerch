import { useState, useCallback } from 'react';
import { generateArtwork } from '../api/client.js';
import { PolygonCoords, StyleName } from '../types.js';

interface ArtworkState {
  draftId: string | null;
  svg: string | null;
  loading: boolean;
  error: string | null;
}

export function useArtwork(sessionToken: string) {
  const [state, setState] = useState<ArtworkState>({
    draftId: null,
    svg: null,
    loading: false,
    error: null,
  });

  const generate = useCallback(
    async (polygon: PolygonCoords, style: StyleName) => {
      setState(s => ({ ...s, loading: true, error: null }));
      try {
        const result = await generateArtwork(polygon, style, sessionToken);
        setState({ draftId: result.draftId, svg: result.svg, loading: false, error: null });
      } catch {
        setState(s => ({
          ...s,
          loading: false,
          error: 'Artwork generation failed. Please try again.',
        }));
      }
    },
    [sessionToken],
  );

  return { ...state, generate };
}
