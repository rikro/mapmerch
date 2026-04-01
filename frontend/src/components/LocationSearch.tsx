import { useState, useRef } from 'react';
import { Search, Crosshair } from 'lucide-react';
import L from 'leaflet';
import { cn } from '../lib/utils.js';

interface Props {
  mapRef: React.RefObject<L.Map | null>;
}

type GeoError = 'not-found' | 'geo-denied' | 'geo-unavailable' | null;

export default function LocationSearch({ mapRef }: Props) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState<GeoError>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
        { headers: { 'User-Agent': 'MapMerch/1.0' } },
      );
      const data = await res.json() as { lat: string; lon: string }[];
      if (data.length === 0) {
        setError('not-found');
      } else {
        mapRef.current?.flyTo([parseFloat(data[0].lat), parseFloat(data[0].lon)], 15);
      }
    } catch {
      setError('not-found');
    } finally {
      setLoading(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('geo-unavailable');
      return;
    }
    setGeoLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 15);
        setGeoLoading(false);
      },
      (err) => {
        setError(err.code === err.PERMISSION_DENIED ? 'geo-denied' : 'geo-unavailable');
        setGeoLoading(false);
      },
    );
  };

  const errorMessages: Record<NonNullable<GeoError>, string> = {
    'not-found':       'No results found.',
    'geo-denied':      'Location access denied.',
    'geo-unavailable': 'Location unavailable.',
  };

  return (
    <div
      className="absolute top-3 right-3 z-[1000] flex flex-col items-end gap-1"
      data-testid="location-search"
    >
      <div className="flex items-center gap-1 glass-panel rounded-full shadow-lg border border-white/40 px-2 py-1.5">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setError(null); }}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Search location…"
          className="bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400 w-44 px-2"
          data-testid="location-search-input"
        />
        <button
          onClick={search}
          disabled={loading || !query.trim()}
          className={cn(
            'w-7 h-7 flex items-center justify-center rounded-full transition-colors',
            loading ? 'text-slate-400' : 'text-primary hover:bg-primary/10',
          )}
          data-testid="location-search-submit"
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </button>
        <button
          onClick={useMyLocation}
          disabled={geoLoading}
          className={cn(
            'w-7 h-7 flex items-center justify-center rounded-full transition-colors',
            geoLoading ? 'text-slate-400' : 'text-slate-600 hover:bg-slate-100',
          )}
          data-testid="use-my-location"
          aria-label="Use my location"
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div
          className="glass-panel rounded-lg px-3 py-1.5 text-xs text-red-600 font-medium shadow border border-red-100"
          data-testid="location-search-error"
        >
          {errorMessages[error]}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-400 hover:text-red-600"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
