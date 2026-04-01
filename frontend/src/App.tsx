import { useState, useCallback, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import {
  RefreshCw, Plus, Minus, Map as MapIcon,
  Search, AlertTriangle, Settings, HelpCircle,
  Heart, Star, Zap,
} from 'lucide-react';

import MapView from './components/MapView.js';
import ArtworkPreview from './components/ArtworkPreview.js';
import CheckoutForm from './components/CheckoutForm.js';
import Layout from './components/Layout.js';
import Home from './components/Home.js';
import SuccessPage from './components/SuccessPage.js';
import StudioPanel, { STUDIO_TABS, StudioTab } from './components/StudioPanel.js';

import { useSession } from './hooks/useSession.js';
import { useArtwork } from './hooks/useArtwork.js';
import { createPaymentIntent } from './api/client.js';

import { STYLE_OPTIONS, PRODUCT_OPTIONS, STREET_GROUPS, DEFAULT_STREET_CONFIG } from './constants.js';
import {
  AppStep, PolygonCoords, StyleName, ProductType,
  TypographyConfig, CoordsConfig, SymbolConfig, SymbolIcon, CoordFormat, CoordPosition,
  StreetConfig, DashStyle,
} from './types.js';
import { cn } from './lib/utils.js';

const stripePromise = loadStripe(
  (import.meta as unknown as { env: { VITE_STRIPE_PUBLISHABLE_KEY: string } }).env
    .VITE_STRIPE_PUBLISHABLE_KEY,
);

// ── Helpers ──────────────────────────────────────────────────────────────────

function polygonCenter(polygon: PolygonCoords): { lat: number; lng: number } {
  const ring = polygon.coordinates[0];
  const lat = ring.reduce((s, [, la]) => s + la, 0) / ring.length;
  const lng = ring.reduce((s, [lo]) => s + lo, 0) / ring.length;
  return { lat, lng };
}

function toDMS(decimal: number): string {
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const minDecimal = (abs - deg) * 60;
  const min = Math.floor(minDecimal);
  const sec = Math.round((minDecimal - min) * 60);
  return `${deg}° ${min}' ${sec}"`;
}

function formatCoords(lat: number, lng: number, format: CoordFormat): string {
  if (format === 'DMS') {
    return `${toDMS(lat)} ${lat >= 0 ? 'N' : 'S'}, ${toDMS(lng)} ${lng >= 0 ? 'E' : 'W'}`;
  }
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`;
}

const DASH_ARRAYS: Record<DashStyle, string | null> = {
  solid: null,
  dashed: '20,14',
  dotted: '3,10',
};

function applyStreetStyle(
  rawSvg: string | null,
  config: StreetConfig,
  labelTypography: TypographyConfig,
): string | null {
  if (!rawSvg) return null;

  const groupRules = STREET_GROUPS
    .filter(g => config.enabledGroups.includes(g.id))
    .map(g => {
      const s = config.groupStyles[g.id];
      const dash = DASH_ARRAYS[s.dashStyle];
      const dashRule = dash ? `stroke-dasharray:${dash};` : '';
      const colorRule = s.color ? `stroke:${s.color};` : '';
      return `path.road-${g.id}{stroke-width:${s.strokeWidth};${dashRule}${colorRule}}`;
    })
    .join('');

  const textRules = [
    `font-family:${labelTypography.typeface},sans-serif`,
    `font-size:${labelTypography.size}px`,
    `font-weight:${labelTypography.weight}`,
    labelTypography.color ? `fill:${labelTypography.color}` : '',
  ].filter(Boolean).join(';');

  const style = `<style>${groupRules}text{${textRules};}</style>`;
  return rawSvg.replace(/(<svg[^>]*>)/, `$1${style}`);
}

const COORD_POSITION_CLASSES: Record<CoordPosition, string> = {
  'top-left':     'top-5 left-5',
  'top-right':    'top-5 right-5',
  'bottom-left':  'bottom-5 left-5',
  'bottom-right': 'bottom-5 right-5',
};

function SymbolOverlay({ icon, scale, color, opacity }: { icon: SymbolIcon; scale: number; color: string; opacity: number }) {
  const props = { style: { width: scale, height: scale, color, opacity } };
  if (icon === 'heart') return <Heart {...props} fill={color} />;
  if (icon === 'star')  return <Star  {...props} fill={color} />;
  if (icon === 'zap')   return <Zap   {...props} fill={color} />;
  return <MapIcon {...props} />;
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const sessionToken = useSession();
  const { draftId, svg, loading, error, generate } = useArtwork(sessionToken);

  const [step, setStep] = useState<AppStep>('home');
  const [polygon, setPolygon] = useState<PolygonCoords | null>(null);
  const [style, setStyle] = useState<StyleName>('minimal-line-art');
  const [product] = useState<ProductType>('print');
  const [size] = useState<string>('12x12');
  const [areaError, setAreaError] = useState<string | null>(null);
  const [polygonLargeHint, setPolygonLargeHint] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [studioTab, setStudioTab] = useState<StudioTab>('streets');
  const [streetConfig, setStreetConfig] = useState<StreetConfig>(DEFAULT_STREET_CONFIG);

  // Overlay state
  const [mapTitle, setMapTitle] = useState('');
  const [typography, setTypography] = useState<TypographyConfig>({
    typeface: 'Manrope', size: 18, weight: '700', color: '#1c1b1b',
  });
  const [labelTypography, setLabelTypography] = useState<TypographyConfig>({
    typeface: 'sans-serif', size: 40, weight: '400', color: '', baselineOffset: 24,
  });
  const [coordsConfig, setCoordsConfig] = useState<CoordsConfig>({
    show: false, format: 'Decimal Degrees', position: 'bottom-left', opacity: 0.85,
  });
  const [symbolConfig, setSymbolConfig] = useState<SymbolConfig>({
    show: false, icon: 'heart', scale: 48, color: '#0050cb', opacity: 1,
  });

  const handleAreaTooLarge = useCallback(() => {
    setAreaError('Area exceeds the maximum supported size. Please draw a smaller boundary.');
    setPolygonLargeHint(false);
  }, []);

  const handlePolygonLarge = useCallback(() => {
    setPolygonLargeHint(true);
  }, []);

  const handleShapeCleared = useCallback(() => {
    setPolygon(null);
    setAreaError(null);
    setPolygonLargeHint(false);
  }, []);

  const labelOffsetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function resolvedStreetArgs(config: StreetConfig): { highwayTypes: string[]; groupMap: Record<string, string> } {
    const enabled = STREET_GROUPS.filter(g => config.enabledGroups.includes(g.id));
    const highwayTypes = enabled.flatMap(g => g.types);
    const groupMap: Record<string, string> = {};
    enabled.forEach(g => g.types.forEach(t => { groupMap[t] = g.id; }));
    return { highwayTypes, groupMap };
  }

  const handlePolygonComplete = useCallback(
    (p: PolygonCoords) => {
      setPolygon(p);
      setAreaError(null);
      setPolygonLargeHint(false); // will be re-set by onPolygonLarge if applicable
      const { highwayTypes, groupMap } = resolvedStreetArgs(streetConfig);
      generate(p, style, highwayTypes, labelTypography.baselineOffset ?? 24, groupMap);
      setStep('customize');
    },
    [generate, style, streetConfig, labelTypography.baselineOffset],
  );

  const handleStyleChange = useCallback(
    (newStyle: StyleName) => {
      setStyle(newStyle);
      if (polygon) {
        const { highwayTypes, groupMap } = resolvedStreetArgs(streetConfig);
        generate(polygon, newStyle, highwayTypes, labelTypography.baselineOffset ?? 24, groupMap);
      }
    },
    [generate, polygon, streetConfig, labelTypography.baselineOffset],
  );

  const handleStreetConfigChange = useCallback(
    (patch: Partial<StreetConfig>) => {
      const next = { ...streetConfig, ...patch };
      setStreetConfig(next);
      if ('enabledGroups' in patch && polygon) {
        const { highwayTypes, groupMap } = resolvedStreetArgs(next);
        generate(polygon, style, highwayTypes, labelTypography.baselineOffset ?? 24, groupMap);
      }
    },
    [streetConfig, polygon, style, generate, labelTypography.baselineOffset],
  );

  const handleLabelTypographyChange = useCallback(
    (patch: Partial<TypographyConfig>) => {
      const next = { ...labelTypography, ...patch };
      setLabelTypography(next);
      if ('baselineOffset' in patch && polygon) {
        if (labelOffsetTimerRef.current) clearTimeout(labelOffsetTimerRef.current);
        labelOffsetTimerRef.current = setTimeout(() => {
          const { highwayTypes, groupMap } = resolvedStreetArgs(streetConfig);
          generate(polygon, style, highwayTypes, next.baselineOffset ?? 24, groupMap);
        }, 400);
      }
    },
    [labelTypography, polygon, style, streetConfig, generate],
  );

  const handleProceedToCheckout = async () => {
    const { clientSecret } = await createPaymentIntent(product, size);
    setStripeClientSecret(clientSecret);
    setStep('checkout');
  };

  const handleOrderComplete = (id: string) => {
    setOrderId(id);
    setStep('confirmation');
  };

  const currentProductOption = PRODUCT_OPTIONS.find((o) => o.type === product)!;
  const priceCents = currentProductOption.retailPriceCents[size];
  const center = polygon ? polygonCenter(polygon) : null;
  const displaySvg = applyStreetStyle(svg, streetConfig, labelTypography);

  return (
    <Layout step={step} onStepChange={setStep}>
      {/* ─── HOME ─── */}
      {step === 'home' && <Home onStart={() => setStep('draw')} />}

      {/* ─── DRAW ─── */}
      {step === 'draw' && (
        <div className="relative h-[calc(100vh)] overflow-hidden">
          <MapView
            onPolygonComplete={handlePolygonComplete}
            onAreaTooLarge={handleAreaTooLarge}
            onPolygonLarge={handlePolygonLarge}
            onShapeCleared={handleShapeCleared}
            className="absolute inset-0 w-full h-full"
          />

          <div className="absolute top-24 left-1/2 -translate-x-1/2 w-full max-w-xl z-[1000] px-4">
            <div className="glass-panel rounded-full shadow-lg p-1.5 flex items-center border border-white/40">
              <div className="pl-4 pr-3 text-slate-400">
                <Search className="w-5 h-5" />
              </div>
              <span className="w-full text-slate-400/80 text-sm font-medium py-2">
                Draw a polygon, rectangle, or circle using the toolbar (top-left)
              </span>
            </div>
          </div>

          {areaError && (
            <div
              className="absolute top-36 left-1/2 -translate-x-1/2 z-[1001] glass-panel rounded-xl shadow-lg px-5 py-3 flex items-center gap-3 border border-red-200"
              role="alert"
            >
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm font-medium text-red-700">{areaError}</p>
            </div>
          )}
          {polygonLargeHint && !areaError && (
            <div className="absolute top-36 left-1/2 -translate-x-1/2 z-[1001] glass-panel rounded-xl shadow-lg px-5 py-3 flex items-center gap-3 border border-blue-200">
              <HelpCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <p className="text-sm font-medium text-blue-700">Large area — showing major roads only. Draw a smaller area for full street detail.</p>
            </div>
          )}

          <div className="absolute bottom-8 left-8 z-[1000] w-72">
            <div className="glass-panel rounded-2xl shadow-xl border border-white/40 p-5">
              <h3 className="font-headline font-bold text-sm mb-3 flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-primary" />
                How to Draw
              </h3>
              <ol className="space-y-2">
                {[
                  'Use the toolbar (top-left) to choose a shape: polygon, rectangle, or circle',
                  'Draw your boundary on the map',
                  'Use the trash icon to clear and start over',
                ].map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                    <span className="w-4 h-4 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* ─── CUSTOMIZE (Studio) ─── */}
      {step === 'customize' && (
        <div className="h-[calc(100vh-80px)] flex overflow-hidden">

          {/* Left: Studio tab nav */}
          <aside className="w-64 bg-slate-50 border-r p-4 flex flex-col gap-2 flex-shrink-0">
            <div className="mb-6 px-2">
              <h2 className="text-lg font-black text-slate-800 font-headline">Studio</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Map Art Editor</p>
            </div>
            <nav className="flex flex-col gap-1 flex-grow">
              {STUDIO_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStudioTab(tab.id)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-3 rounded-lg font-semibold text-xs uppercase tracking-widest transition-all duration-200',
                    studioTab === tab.id
                      ? 'bg-white shadow-sm ring-1 ring-primary/10 text-primary'
                      : 'text-slate-500 hover:bg-white/50 hover:text-primary',
                  )}
                >
                  <tab.icon className={cn('w-4 h-4', studioTab === tab.id && 'fill-current')} />
                  <span>{tab.label}</span>
                  {studioTab === tab.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                </button>
              ))}
            </nav>

            <button
              onClick={() => setStep('draw')}
              className="mt-2 w-full py-2.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-slate-200 transition-colors"
            >
              ← Redraw Area
            </button>

            <div className="mt-auto flex flex-col gap-1 border-t pt-4">
              <button className="flex items-center gap-3 px-3 py-2 text-slate-500 hover:bg-white/50 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                <Settings className="w-4 h-4" /><span>Settings</span>
              </button>
              <button className="flex items-center gap-3 px-3 py-2 text-slate-500 hover:bg-white/50 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                <HelpCircle className="w-4 h-4" /><span>Help</span>
              </button>
            </div>
          </aside>

          {/* Center: Artwork canvas */}
          <main className="flex-grow bg-white relative flex items-center justify-center p-12 overflow-hidden">
            <div className="absolute inset-0 map-mesh opacity-10 pointer-events-none" />

            <div className="absolute top-6 left-6 flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-primary rounded-full" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Active Workspace // Your Map Art
              </span>
            </div>

            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10">
              <div className="glass-panel px-4 py-2 rounded-full border border-primary/10 shadow-xl flex items-center gap-3">
                <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center text-[10px] text-white font-bold">i</div>
                <span className="text-xs font-medium text-slate-900">
                  {loading ? 'Generating your artwork…' : 'Use the panels to customize your design.'}
                </span>
              </div>
            </div>

            {/* Artwork canvas with overlays */}
            <div className="relative w-full max-w-[560px] aspect-square shadow-2xl border border-white p-1 flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 border-[12px] border-white z-10 pointer-events-none" />

              <ArtworkPreview svg={displaySvg} loading={loading} error={error} />

              {/* Coordinates overlay */}
              {coordsConfig.show && center && (
                <div
                  className={cn(
                    'absolute z-20 px-3 py-1.5 rounded-full text-[10px] font-mono font-bold tracking-wider',
                    'bg-white/80 backdrop-blur-sm border border-white/40',
                    COORD_POSITION_CLASSES[coordsConfig.position],
                  )}
                  style={{ opacity: coordsConfig.opacity }}
                >
                  {formatCoords(center.lat, center.lng, coordsConfig.format)}
                </div>
              )}

              {/* Symbol overlay */}
              {symbolConfig.show && (
                <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                  <SymbolOverlay
                    icon={symbolConfig.icon}
                    scale={symbolConfig.scale}
                    color={symbolConfig.color}
                    opacity={symbolConfig.opacity}
                  />
                </div>
              )}

              {/* Title overlay */}
              {mapTitle && (
                <div
                  className="absolute bottom-0 left-0 right-0 px-6 py-4 z-20 text-center"
                  style={{
                    fontFamily: typography.typeface,
                    fontSize: typography.size,
                    fontWeight: typography.weight,
                    color: typography.color,
                    textShadow: '0 1px 3px rgba(0,0,0,0.15)',
                  }}
                >
                  {mapTitle}
                </div>
              )}

              {/* Floating zoom controls */}
              <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-20">
                <button className="w-9 h-9 glass-panel rounded-full flex items-center justify-center shadow-sm text-slate-600 hover:text-primary transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
                <button className="w-9 h-9 glass-panel rounded-full flex items-center justify-center shadow-sm text-slate-600 hover:text-primary transition-colors">
                  <Minus className="w-4 h-4" />
                </button>
                {loading && (
                  <button className="w-9 h-9 glass-panel rounded-full flex items-center justify-center shadow-sm text-primary">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  </button>
                )}
              </div>
            </div>
          </main>

          {/* Right: StudioPanel */}
          <StudioPanel
            activeTab={studioTab}
            styleOptions={STYLE_OPTIONS}
            selectedStyle={style}
            onStyleChange={handleStyleChange}
            streetConfig={streetConfig}
            onStreetConfigChange={handleStreetConfigChange}
            mapTitle={mapTitle}
            onMapTitleChange={setMapTitle}
            typography={typography}
            onTypographyChange={(patch) => setTypography((t) => ({ ...t, ...patch }))}
            labelTypography={labelTypography}
            onLabelTypographyChange={handleLabelTypographyChange}
            coordsConfig={coordsConfig}
            onCoordsConfigChange={(patch) => setCoordsConfig((c) => ({ ...c, ...patch }))}
            symbolConfig={symbolConfig}
            onSymbolConfigChange={(patch) => setSymbolConfig((s) => ({ ...s, ...patch }))}
            svg={displaySvg}
            draftId={draftId}
            loading={loading}
            onProceedToCheckout={handleProceedToCheckout}
          />
        </div>
      )}

      {/* ─── CHECKOUT ─── */}
      {step === 'checkout' && stripeClientSecret && draftId && (
        <Elements stripe={stripePromise} options={{ clientSecret: stripeClientSecret }}>
          <CheckoutForm
            draftId={draftId}
            sessionToken={sessionToken}
            product={product}
            productLabel={currentProductOption.label}
            size={size}
            priceCents={priceCents}
            onOrderComplete={handleOrderComplete}
          />
        </Elements>
      )}

      {/* ─── CONFIRMATION ─── */}
      {step === 'confirmation' && orderId && (
        <SuccessPage
          orderId={orderId}
          onReset={() => {
            setStep('home');
            setPolygon(null);
            setOrderId(null);
            setStripeClientSecret(null);
          }}
        />
      )}
    </Layout>
  );
}
