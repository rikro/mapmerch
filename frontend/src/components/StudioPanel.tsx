import React from 'react';
import {
  Route, Type, MapPin, Heart, Share2, ArrowRight,
  Star, Zap, Download,
} from 'lucide-react';
import ColorPalette from './ColorPalette.js';
import StyleSelector from './StyleSelector.js';
import { cn } from '../lib/utils.js';
import {
  StyleName, StyleOption,
  TypographyConfig, CoordsConfig, CoordFormat, CoordPosition,
  SymbolConfig, SymbolIcon,
  StreetConfig, StreetGroupId, StreetGroupStyle, DashStyle,
} from '../types.js';
import { STREET_GROUPS } from '../constants.js';

export type StudioTab = 'streets' | 'typography' | 'coordinates' | 'symbols' | 'export';

export const STUDIO_TABS: { id: StudioTab; label: string; icon: typeof Route }[] = [
  { id: 'streets',     label: 'Streets',     icon: Route   },
  { id: 'typography',  label: 'Typography',  icon: Type    },
  { id: 'coordinates', label: 'Coordinates', icon: MapPin  },
  { id: 'symbols',     label: 'Symbols',     icon: Heart   },
  { id: 'export',      label: 'Export',      icon: Share2  },
];

const TYPEFACES = ['Manrope', 'Inter', 'Space Grotesk', 'Georgia', 'Courier New'];
const WEIGHTS   = [
  { value: '400', label: 'Regular' },
  { value: '600', label: 'SemiBold' },
  { value: '700', label: 'Bold' },
  { value: '800', label: 'ExtraBold' },
];
const COLOR_SWATCHES = [
  '#1c1b1b', '#ffffff', '#0050cb', '#1a3a5c',
  '#8b6f47', '#f5c518', '#1a1a1a', '#a8c8f0',
];

const SYMBOL_OPTIONS: { id: SymbolIcon; icon: typeof Heart; label: string }[] = [
  { id: 'heart', icon: Heart,  label: 'Heart' },
  { id: 'star',  icon: Star,   label: 'Star'  },
  { id: 'pin',   icon: MapPin, label: 'Pin'   },
  { id: 'zap',   icon: Zap,    label: 'Zap'   },
];

const POSITIONS: { id: CoordPosition; label: string }[] = [
  { id: 'top-left',     label: 'Top Left'     },
  { id: 'top-right',    label: 'Top Right'    },
  { id: 'bottom-left',  label: 'Bottom Left'  },
  { id: 'bottom-right', label: 'Bottom Right' },
];

const DASH_OPTIONS: { id: DashStyle; label: string }[] = [
  { id: 'solid',  label: 'Solid'  },
  { id: 'dashed', label: 'Dashed' },
  { id: 'dotted', label: 'Dotted' },
];

interface Props {
  activeTab: StudioTab;
  // Streets
  styleOptions: StyleOption[];
  selectedStyle: StyleName;
  onStyleChange: (s: StyleName) => void;
  streetConfig: StreetConfig;
  onStreetConfigChange: (patch: Partial<StreetConfig>) => void;
  waterColor: string;
  onWaterColorChange: (color: string) => void;
  // Typography
  mapTitle: string;
  onMapTitleChange: (t: string) => void;
  typography: TypographyConfig;
  onTypographyChange: (patch: Partial<TypographyConfig>) => void;
  labelTypography: TypographyConfig;
  onLabelTypographyChange: (patch: Partial<TypographyConfig>) => void;
  // Coordinates
  coordsConfig: CoordsConfig;
  onCoordsConfigChange: (patch: Partial<CoordsConfig>) => void;
  // Symbols
  symbolConfig: SymbolConfig;
  onSymbolConfigChange: (patch: Partial<SymbolConfig>) => void;
  // CTA
  svg: string | null;
  draftId: string | null;
  loading: boolean;
  onProceedToCheckout: () => void;
}


function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-10 h-5 rounded-full relative transition-colors flex-shrink-0',
        on ? 'bg-primary' : 'bg-slate-200',
      )}
    >
      <div className={cn(
        'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all',
        on ? 'right-0.5' : 'left-0.5',
      )} />
    </button>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: {
  icon: typeof Route; title: string; subtitle: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">{title}</h3>
      </div>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
      {children}
    </label>
  );
}

function downloadSvg(svg: string) {
  const printable = svg.replace(/width="100%"\s*height="100%"/, 'width="2400" height="2400"');
  const blob = new Blob([printable], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'map-art.svg';
  a.click();
  URL.revokeObjectURL(url);
}

function GroupLinePreview({ groupStyle }: { groupStyle: StreetGroupStyle }) {
  const dashArray =
    groupStyle.dashStyle === 'dashed' ? '5,3' :
    groupStyle.dashStyle === 'dotted' ? '2,3' :
    undefined;
  return (
    <svg width="22" height="10" viewBox="0 0 22 10" className="flex-shrink-0">
      <line
        x1="1" y1="5" x2="21" y2="5"
        stroke={groupStyle.color ?? 'currentColor'}
        strokeWidth={Math.min(groupStyle.strokeWidth, 5)}
        strokeLinecap="round"
        strokeDasharray={dashArray}
      />
    </svg>
  );
}

export default function StudioPanel({
  activeTab,
  styleOptions, selectedStyle, onStyleChange,
  streetConfig, onStreetConfigChange,
  waterColor, onWaterColorChange,
  mapTitle, onMapTitleChange,
  typography, onTypographyChange,
  labelTypography, onLabelTypographyChange,
  coordsConfig, onCoordsConfigChange,
  symbolConfig, onSymbolConfigChange,
  svg, draftId, loading, onProceedToCheckout,
}: Props) {
  const [activeTextElement, setActiveTextElement] = React.useState<'title' | 'labels'>('title');
  const [expandedGroups, setExpandedGroups] = React.useState<Set<StreetGroupId>>(new Set());
  return (
    <aside className="w-80 h-full bg-white border-l overflow-y-auto p-6 flex flex-col gap-8 flex-shrink-0">

      {/* ── STREETS ── */}
      {activeTab === 'streets' && (
        <div className="space-y-6">
          <SectionHeader icon={Route} title="Streets" subtitle="Control which streets appear and how they're drawn" />

          <div className="space-y-3">
            <Label>Color Theme</Label>
            <StyleSelector options={styleOptions} selected={selectedStyle} onChange={onStyleChange} />
          </div>

          <div className="space-y-3">
            <Label>Street Types</Label>
            <div className="space-y-0.5">
              {STREET_GROUPS.map(({ id, label }) => {
                const groupId = id as StreetGroupId;
                const isEnabled = streetConfig.enabledGroups.includes(groupId);
                const isExpanded = expandedGroups.has(groupId);
                const groupStyle = streetConfig.groupStyles[groupId];

                const toggleEnabled = () => {
                  const groups = isEnabled
                    ? streetConfig.enabledGroups.filter(g => g !== groupId)
                    : [...streetConfig.enabledGroups, groupId];
                  onStreetConfigChange({ enabledGroups: groups });
                };

                const toggleExpanded = () => {
                  setExpandedGroups(prev => {
                    const next = new Set(prev);
                    next.has(groupId) ? next.delete(groupId) : next.add(groupId);
                    return next;
                  });
                };

                const patchGroupStyle = (patch: Partial<StreetGroupStyle>) => {
                  onStreetConfigChange({
                    groupStyles: {
                      ...streetConfig.groupStyles,
                      [groupId]: { ...groupStyle, ...patch },
                    },
                  });
                };

                return (
                  <div key={id}>
                    {/* Row */}
                    <div className={cn(
                      'flex items-center gap-2 py-2 px-1.5 rounded-lg',
                      isExpanded ? 'bg-primary/5 rounded-b-none' : 'hover:bg-slate-50',
                    )}>
                      {/* Checkbox */}
                      <button
                        onClick={toggleEnabled}
                        className={cn(
                          'w-[17px] h-[17px] rounded-[5px] border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                          isEnabled ? 'bg-primary border-primary' : 'bg-white border-slate-300',
                        )}
                      >
                        {isEnabled && (
                          <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="white" strokeWidth="2.8">
                            <polyline points="2,6 5,9 10,3"/>
                          </svg>
                        )}
                      </button>

                      {/* Label */}
                      <span
                        onClick={toggleExpanded}
                        className={cn(
                          'text-sm font-medium flex-1 cursor-pointer',
                          isEnabled ? 'text-slate-700' : 'text-slate-400',
                        )}
                      >
                        {label}
                      </span>

                      {/* Mini line preview */}
                      <button
                        onClick={toggleExpanded}
                        className={cn('flex-shrink-0', !isEnabled && 'opacity-30')}
                      >
                        <GroupLinePreview groupStyle={groupStyle} />
                      </button>

                      {/* Chevron */}
                      <button
                        onClick={toggleExpanded}
                        className={cn(
                          'text-[9px] flex-shrink-0 transition-colors w-4 text-center',
                          isExpanded ? 'text-primary' : 'text-slate-400',
                        )}
                      >
                        {isExpanded ? '▲' : '▼'}
                      </button>
                    </div>

                    {/* Inline controls */}
                    {isExpanded && (
                      <div className="bg-primary/5 rounded-b-lg px-3 pb-3 pt-2 space-y-3 border-t border-primary/10">
                        {/* Weight */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <Label>Weight</Label>
                            <span className="text-xs font-bold text-primary">{groupStyle.strokeWidth}px</span>
                          </div>
                          <input
                            type="range" min="0.5" max="12" step="0.5"
                            className="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
                            value={groupStyle.strokeWidth}
                            onChange={(e) => patchGroupStyle({ strokeWidth: parseFloat(e.target.value) })}
                          />
                          <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                            <span>Hairline</span>
                            <span>Bold</span>
                          </div>
                        </div>

                        {/* Dash style */}
                        <div className="space-y-1.5">
                          <Label>Style</Label>
                          <div className="flex gap-1.5">
                            {DASH_OPTIONS.map(({ id: dashId, label: dashLabel }) => (
                              <button
                                key={dashId}
                                onClick={() => patchGroupStyle({ dashStyle: dashId })}
                                className={cn(
                                  'flex-1 py-1.5 text-xs font-bold rounded-lg border-2 transition-all',
                                  groupStyle.dashStyle === dashId
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-transparent bg-white text-slate-600 hover:bg-slate-50',
                                )}
                              >
                                {dashLabel}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Color */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Label>
                              Color
                              {!groupStyle.color && (
                                <span className="ml-1 normal-case font-normal text-slate-400">(follows theme)</span>
                              )}
                            </Label>
                            <ColorPalette
                              value={groupStyle.color}
                              onChange={(c) => patchGroupStyle({ color: c })}
                              allowAuto
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Toggling a street type regenerates the artwork. Style changes apply instantly.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label>Water Fill</Label>
              <ColorPalette
                value={waterColor}
                onChange={(c) => { if (c) onWaterColorChange(c); }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── TYPOGRAPHY ── */}
      {activeTab === 'typography' && (() => {
        const isTitle = activeTextElement === 'title';
        const activeTypo = isTitle ? typography : labelTypography;
        const onChange = isTitle ? onTypographyChange : onLabelTypographyChange;
        const sizeMin = isTitle ? 10 : 20;
        const sizeMax = isTitle ? 48 : 80;

        return (
          <div className="space-y-6">
            <SectionHeader icon={Type} title="Typography" subtitle="Configure text elements on your map art" />

            {/* Element toggle */}
            <div className="space-y-3">
              <Label>Edit Element</Label>
              <div className="flex gap-2">
                {([
                  { id: 'title',  label: 'Map Title'      },
                  { id: 'labels', label: 'Street Labels'  },
                ] as const).map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTextElement(id)}
                    className={cn(
                      'flex-1 py-2 text-xs font-bold rounded-lg border-2 transition-all',
                      activeTextElement === id
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Map title input — only for title element */}
            {isTitle && (
              <div className="space-y-3">
                <Label>Title Text</Label>
                <input
                  className="w-full bg-slate-50 border-none rounded-lg p-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder="e.g. Lower East Side, NYC"
                  value={mapTitle}
                  onChange={(e) => onMapTitleChange(e.target.value)}
                />
                <p className="text-[10px] text-slate-400">Appears as an overlay on the canvas preview</p>
              </div>
            )}

            <div className="space-y-3">
              <Label>Typeface</Label>
              <select
                className="w-full bg-slate-50 border-none rounded-lg p-3 text-sm font-medium outline-none"
                value={activeTypo.typeface}
                onChange={(e) => onChange({ typeface: e.target.value })}
              >
                {TYPEFACES.map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>

            <div className="space-y-3">
              <Label>Weight</Label>
              <div className="flex flex-wrap gap-2">
                {WEIGHTS.map((w) => (
                  <button
                    key={w.value}
                    onClick={() => onChange({ weight: w.value })}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs border-2 transition-all',
                      activeTypo.weight === w.value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100',
                    )}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label>Size</Label>
                <span className="text-xs font-bold text-primary">{activeTypo.size}px</span>
              </div>
              <input
                type="range" min={sizeMin} max={sizeMax}
                className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary"
                value={activeTypo.size}
                onChange={(e) => onChange({ size: parseInt(e.target.value) })}
              />
            </div>

            {false && !isTitle && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Offset Above Line</Label>
                  <span className="text-xs font-bold text-primary">{activeTypo.baselineOffset ?? 12}px</span>
                </div>
                <input
                  type="range" min="0" max="80" step="1"
                  className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary"
                  value={activeTypo.baselineOffset ?? 12}
                  onChange={(e) => onChange({ baselineOffset: parseInt(e.target.value) })}
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                  <span>On line</span>
                  <span>Above</span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Label>Color{!isTitle && !activeTypo.color && <span className="ml-1 normal-case font-normal text-slate-400">(follows theme)</span>}</Label>
              <div className="flex flex-wrap gap-2">
                {!isTitle && (
                  <button
                    onClick={() => onChange({ color: '' })}
                    title="Follow color theme"
                    className={cn(
                      'w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center text-[9px] font-bold',
                      !activeTypo.color ? 'border-primary scale-110 text-primary' : 'border-slate-200 text-slate-400 hover:scale-105',
                    )}
                  >
                    Auto
                  </button>
                )}
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => onChange({ color: c })}
                    className={cn(
                      'w-7 h-7 rounded-full border-2 transition-all',
                      activeTypo.color === c ? 'border-primary scale-110' : 'border-slate-200 hover:scale-105',
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── COORDINATES ── */}
      {activeTab === 'coordinates' && (
        <div className="space-y-6">
          <SectionHeader icon={MapPin} title="Coordinates" subtitle="Display map coordinates on the canvas" />

          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">Show Coordinates</span>
            <Toggle on={coordsConfig.show} onToggle={() => onCoordsConfigChange({ show: !coordsConfig.show })} />
          </div>

          {coordsConfig.show && (
            <>
              <div className="space-y-3">
                <Label>Format</Label>
                <div className="flex gap-2">
                  {(['Decimal Degrees', 'DMS'] as CoordFormat[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => onCoordsConfigChange({ format: f })}
                      className={cn(
                        'flex-1 py-2 text-xs font-bold rounded-lg border-2 transition-all',
                        coordsConfig.format === f
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100',
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Position</Label>
                <div className="grid grid-cols-2 gap-2">
                  {POSITIONS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onCoordsConfigChange({ position: p.id })}
                      className={cn(
                        'py-2 text-xs font-semibold rounded-lg border-2 transition-all',
                        coordsConfig.position === p.id
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100',
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Opacity</Label>
                  <span className="text-xs font-bold text-primary">{Math.round(coordsConfig.opacity * 100)}%</span>
                </div>
                <input
                  type="range" min="20" max="100"
                  className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary"
                  value={Math.round(coordsConfig.opacity * 100)}
                  onChange={(e) => onCoordsConfigChange({ opacity: parseInt(e.target.value) / 100 })}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── SYMBOLS ── */}
      {activeTab === 'symbols' && (
        <div className="space-y-6">
          <SectionHeader icon={Heart} title="Symbols" subtitle="Overlay an icon on your map art" />

          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">Show Symbol</span>
            <Toggle on={symbolConfig.show} onToggle={() => onSymbolConfigChange({ show: !symbolConfig.show })} />
          </div>

          {symbolConfig.show && (
            <>
              <div className="space-y-3">
                <Label>Icon</Label>
                <div className="grid grid-cols-4 gap-2">
                  {SYMBOL_OPTIONS.map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      onClick={() => onSymbolConfigChange({ icon: id })}
                      title={label}
                      className={cn(
                        'flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all',
                        symbolConfig.icon === id
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-transparent bg-slate-50 text-slate-500 hover:bg-slate-100',
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Scale</Label>
                  <span className="text-xs font-bold text-primary">{symbolConfig.scale}px</span>
                </div>
                <input
                  type="range" min="24" max="120"
                  className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary"
                  value={symbolConfig.scale}
                  onChange={(e) => onSymbolConfigChange({ scale: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-3">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_SWATCHES.map((c) => (
                    <button
                      key={c}
                      onClick={() => onSymbolConfigChange({ color: c })}
                      className={cn(
                        'w-7 h-7 rounded-full border-2 transition-all',
                        symbolConfig.color === c ? 'border-primary scale-110' : 'border-slate-200 hover:scale-105',
                      )}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Opacity</Label>
                  <span className="text-xs font-bold text-primary">{Math.round(symbolConfig.opacity * 100)}%</span>
                </div>
                <input
                  type="range" min="10" max="100"
                  className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary"
                  value={Math.round(symbolConfig.opacity * 100)}
                  onChange={(e) => onSymbolConfigChange({ opacity: parseInt(e.target.value) / 100 })}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── EXPORT ── */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          <SectionHeader icon={Share2} title="Export" subtitle="Download your map art file" />

          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Format</span>
              <span className="font-bold text-slate-900">SVG (Vector)</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Resolution</span>
              <span className="font-bold text-slate-900">2400 × 2400 px</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Print DPI</span>
              <span className="font-bold text-slate-900">300 dpi (8 × 8 in)</span>
            </div>
          </div>

          <button
            onClick={() => svg && downloadSvg(svg)}
            disabled={!svg || loading}
            className="w-full flex items-center justify-center gap-2 py-4 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Download SVG
          </button>

          <p className="text-[10px] text-slate-400 leading-relaxed">
            The exported SVG is fully scalable and suitable for professional print production.
            Overlays (coordinates, symbols, title) are preview-only — embed them in your design app before printing.
          </p>
        </div>
      )}

      {/* ── Persistent CTA ── */}
      <div className="mt-auto pt-6 border-t">
        <button
          onClick={onProceedToCheckout}
          disabled={!draftId || loading}
          className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-br from-primary to-primary-container text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>Continue to Checkout</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
