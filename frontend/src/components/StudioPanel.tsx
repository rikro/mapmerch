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
  TypographyConfig, CoordsConfig, CoordFormat,
  SymbolConfig, SymbolIcon,
  StreetConfig, StreetGroupId, StreetGroupStyle, DashStyle,
  BoundaryConfig, CustomSlot,
} from '../types.js';
import { STREET_GROUPS } from '../constants.js';

export type StudioTab = 'streets' | 'typography' | 'symbols' | 'export';

export const STUDIO_TABS: { id: StudioTab; label: string; icon: typeof Route }[] = [
  { id: 'streets',    label: 'Design',     icon: Route  },
  { id: 'typography', label: 'Typography', icon: Type   },
  { id: 'symbols',    label: 'Symbols',    icon: Heart  },
  { id: 'export',     label: 'Export',     icon: Share2 },
];

const TYPEFACES = [
  // Sans-serif
  'Manrope', 'Inter', 'DM Sans', 'Nunito', 'Montserrat', 'Raleway',
  // Display sans
  'Oswald', 'Space Grotesk', 'Bebas Neue',
  // Serif
  'Georgia', 'Playfair Display', 'Lora', 'EB Garamond',
  // Monospace
  'Space Mono', 'Courier New',
];

const WEIGHT_VALUES  = ['400', '600', '700', '800'];
const WEIGHT_LABELS  = ['Regular', 'SemiBold', 'Bold', 'Extra Bold'];

const SYMBOL_OPTIONS: { id: SymbolIcon; icon: typeof Heart; label: string }[] = [
  { id: 'heart', icon: Heart,  label: 'Heart' },
  { id: 'star',  icon: Star,   label: 'Star'  },
  { id: 'pin',   icon: MapPin, label: 'Pin'   },
  { id: 'zap',   icon: Zap,    label: 'Zap'   },
];

const DASH_OPTIONS: { id: DashStyle; label: string }[] = [
  { id: 'solid',  label: 'Solid'  },
  { id: 'dashed', label: 'Dashed' },
  { id: 'dotted', label: 'Dotted' },
];

type PendingAction =
  | { type: 'builtin'; style: StyleName }
  | { type: 'slot'; slot: CustomSlot };

const CUSTOM_SLOTS_KEY = 'mapmerch_custom_slots';

function loadCustomSlots(): CustomSlot[] {
  try { return JSON.parse(localStorage.getItem(CUSTOM_SLOTS_KEY) ?? '[]'); }
  catch { return []; }
}

interface Props {
  activeTab: StudioTab;
  // Streets
  styleOptions: StyleOption[];
  selectedStyle: StyleName;
  onStyleChange: (s: StyleName) => void;
  onApplyDesignPreset: (style: StyleName, streetConfig: StreetConfig, waterColor: string, boundaryConfig: BoundaryConfig, landColor: string) => void;
  streetConfig: StreetConfig;
  onStreetConfigChange: (patch: Partial<StreetConfig>) => void;
  waterColor: string;
  onWaterColorChange: (color: string) => void;
  landColor: string;
  onLandColorChange: (color: string) => void;
  boundaryConfig: BoundaryConfig;
  onBoundaryConfigChange: (patch: Partial<BoundaryConfig>) => void;
  // Typography
  mapTitle: string;
  onMapTitleChange: (t: string) => void;
  titlePosition: 'top' | 'bottom';
  onTitlePositionChange: (p: 'top' | 'bottom') => void;
  typography: TypographyConfig;
  onTypographyChange: (patch: Partial<TypographyConfig>) => void;
  labelTypography: TypographyConfig;
  onLabelTypographyChange: (patch: Partial<TypographyConfig>) => void;
  // Coordinates
  coordsConfig: CoordsConfig;
  onCoordsConfigChange: (patch: Partial<CoordsConfig>) => void;
  coordTypography: TypographyConfig;
  onCoordTypographyChange: (patch: Partial<TypographyConfig>) => void;
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

function AccordionSection({ label, isOpen, onToggle, children }: {
  label: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3 text-left"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
        <span className={cn('text-[9px] text-slate-400 transition-transform duration-150 inline-block', isOpen && 'rotate-180')}>▼</span>
      </button>
      <div className={cn(
        'overflow-hidden transition-all duration-150',
        isOpen ? 'max-h-[2000px]' : 'max-h-0',
      )}>
        {children}
      </div>
    </div>
  );
}

function SizeSlider({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (s: number) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dragging = React.useRef(false);
  React.useEffect(() => {
    if (!dragging.current && inputRef.current) inputRef.current.value = String(value);
  }, [value]);
  return (
    <input
      ref={inputRef}
      type="range" min={min} max={max} step="any"
      defaultValue={value}
      onPointerDown={() => { dragging.current = true; }}
      onPointerUp={() => { dragging.current = false; }}
      onChange={(e) => onChange(Math.round(parseFloat(e.target.value)))}
      className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary"
    />
  );
}

function WeightSlider({ value, onChange }: { value: string; onChange: (w: string) => void }) {
  const toIdx = (v: string) => Math.max(0, WEIGHT_VALUES.indexOf(v));
  const [local, setLocal] = React.useState(() => toIdx(value));

  // Keep in sync when value changes externally (e.g. slot restore)
  React.useEffect(() => { setLocal(toIdx(value)); }, [value]);

  const commit = () => {
    const snapped = Math.max(0, Math.min(3, Math.round(local)));
    setLocal(snapped);
    onChange(WEIGHT_VALUES[snapped]);
  };

  return (
    <div className="space-y-1.5">
      <input
        type="range" min={0} max={3} step={0.01}
        value={local}
        onChange={(e) => setLocal(parseFloat(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary"
      />
      <div className="flex justify-between text-[9px] text-slate-400 font-medium">
        {WEIGHT_LABELS.map(l => <span key={l}>{l}</span>)}
      </div>
    </div>
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

function TypoControls({
  typo, onChange, sizeMin, sizeMax, allowAutoColor,
}: {
  typo: TypographyConfig;
  onChange: (p: Partial<TypographyConfig>) => void;
  sizeMin: number; sizeMax: number;
  allowAutoColor?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Typeface</Label>
        <select
          className="w-full bg-slate-50 border-none rounded-lg p-2.5 text-sm font-medium outline-none"
          value={typo.typeface}
          onChange={(e) => onChange({ typeface: e.target.value })}
        >
          {TYPEFACES.map((f) => <option key={f}>{f}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Weight</Label>
        <WeightSlider value={typo.weight} onChange={(w) => onChange({ weight: w })} />
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <Label>Size</Label>
          <span className="text-xs font-bold text-primary">{typo.size}px</span>
        </div>
        <SizeSlider value={typo.size} min={sizeMin} max={sizeMax} onChange={(s) => onChange({ size: s })} />
      </div>
      <div className="flex items-center gap-2">
        <Label>
          Color
          {allowAutoColor && !typo.color && <span className="ml-1 normal-case font-normal text-slate-400">(follows theme)</span>}
        </Label>
        <ColorPalette
          value={typo.color || null}
          onChange={(c) => onChange({ color: c ?? '' })}
          allowAuto={allowAutoColor}
        />
      </div>
    </div>
  );
}

export default function StudioPanel({
  activeTab,
  styleOptions, selectedStyle, onStyleChange, onApplyDesignPreset,
  streetConfig, onStreetConfigChange,
  waterColor, onWaterColorChange,
  landColor, onLandColorChange,
  boundaryConfig, onBoundaryConfigChange,
  mapTitle, onMapTitleChange,
  titlePosition, onTitlePositionChange,
  typography, onTypographyChange,
  labelTypography, onLabelTypographyChange,
  coordsConfig, onCoordsConfigChange,
  coordTypography, onCoordTypographyChange,
  symbolConfig, onSymbolConfigChange,
  svg, draftId, loading, onProceedToCheckout,
}: Props) {
  const [expandedGroups, setExpandedGroups] = React.useState<Set<StreetGroupId>>(new Set());
  const [openDesignSection, setOpenDesignSection] = React.useState<string | null>('theme');
  const [openTypoSection, setOpenTypoSection] = React.useState<string | null>('labels');

  // ── Dirty / theme-switch guard ─────────────────────────────────────────────
  const [isDirty, setIsDirty] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<PendingAction | null>(null);
  const [showSlotPicker, setShowSlotPicker] = React.useState(false);
  const [customSlots, setCustomSlots] = React.useState<CustomSlot[]>(loadCustomSlots);

  const persistSlots = (slots: CustomSlot[]) => {
    setCustomSlots(slots);
    localStorage.setItem(CUSTOM_SLOTS_KEY, JSON.stringify(slots));
  };

  // Dirty-aware wrappers for design controls
  const dirtyStreetConfig = (patch: Partial<StreetConfig>)   => { setIsDirty(true); onStreetConfigChange(patch); };
  const dirtyWaterColor   = (c: string)                      => { setIsDirty(true); onWaterColorChange(c); };
  const dirtyLandColor    = (c: string | null)               => { setIsDirty(true); onLandColorChange(c ?? ''); };
  const dirtyBoundary     = (patch: Partial<BoundaryConfig>) => { setIsDirty(true); onBoundaryConfigChange(patch); };

  // Intercept theme/slot selection
  const requestStyle = (newStyle: StyleName) => {
    if (newStyle === selectedStyle && !isDirty) return;
    if (isDirty) { setPendingAction({ type: 'builtin', style: newStyle }); setShowSlotPicker(false); }
    else { onStyleChange(newStyle); }
  };

  const requestSlot = (slot: CustomSlot) => {
    if (isDirty) { setPendingAction({ type: 'slot', slot }); setShowSlotPicker(false); }
    else { applySlot(slot); }
  };

  const applySlot = (slot: CustomSlot) => {
    onApplyDesignPreset(slot.baseStyle, slot.streetConfig, slot.waterColor, slot.boundaryConfig, slot.landColor ?? '');
    setIsDirty(false);
  };

  const confirmSwitch = () => {
    if (!pendingAction) return;
    if (pendingAction.type === 'builtin') onStyleChange(pendingAction.style);
    else applySlot(pendingAction.slot);
    setIsDirty(false);
    setPendingAction(null);
    setShowSlotPicker(false);
  };

  const saveToSlot = (id: 1 | 2 | 3) => {
    const slot: CustomSlot = {
      id, label: `Custom ${id}`,
      baseStyle: selectedStyle,
      streetConfig, waterColor, landColor, boundaryConfig,
    };
    persistSlots([...customSlots.filter(s => s.id !== id), slot].sort((a, b) => a.id - b.id));
    confirmSwitch();
  };
  return (
    <aside className="w-80 h-full bg-white border-l overflow-y-auto p-6 flex flex-col gap-8 flex-shrink-0">

      {/* ── DESIGN ── */}
      {activeTab === 'streets' && (() => {
        const toggle = (id: string) =>
          setOpenDesignSection(prev => prev === id ? null : id);

        return (
          <div className="space-y-0">
            <SectionHeader icon={Route} title="Design" subtitle="Control street appearance, water, and boundary options" />

            {/* Theme */}
            <AccordionSection label="Theme" isOpen={openDesignSection === 'theme'} onToggle={() => toggle('theme')}>
              <div className="pb-4">
                <StyleSelector
                  options={styleOptions}
                  selected={selectedStyle}
                  onChange={requestStyle}
                  customSlots={customSlots}
                  onCustomSlotSelect={requestSlot}
                />
              </div>
            </AccordionSection>

            {/* Streets */}
            <AccordionSection label="Streets" isOpen={openDesignSection === 'streets'} onToggle={() => toggle('streets')}>
              <div className="pb-4 space-y-0.5">
                {STREET_GROUPS.map(({ id, label }) => {
                  const groupId = id as StreetGroupId;
                  const isEnabled = streetConfig.enabledGroups.includes(groupId);
                  const isExpanded = expandedGroups.has(groupId);
                  const groupStyle = streetConfig.groupStyles[groupId];

                  const toggleEnabled = () => {
                    const groups = isEnabled
                      ? streetConfig.enabledGroups.filter(g => g !== groupId)
                      : [...streetConfig.enabledGroups, groupId];
                    dirtyStreetConfig({ enabledGroups: groups });
                  };

                  const toggleExpanded = () => {
                    setExpandedGroups(prev => {
                      const next = new Set(prev);
                      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
                      return next;
                    });
                  };

                  const patchGroupStyle = (patch: Partial<StreetGroupStyle>) => {
                    dirtyStreetConfig({
                      groupStyles: {
                        ...streetConfig.groupStyles,
                        [groupId]: { ...groupStyle, ...patch },
                      },
                    });
                  };

                  return (
                    <div key={id}>
                      <div className={cn(
                        'flex items-center gap-2 py-2 px-1.5 rounded-lg',
                        isExpanded ? 'bg-primary/5 rounded-b-none' : 'hover:bg-slate-50',
                      )}>
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
                        <span
                          onClick={toggleExpanded}
                          className={cn(
                            'text-sm font-medium flex-1 cursor-pointer',
                            isEnabled ? 'text-slate-700' : 'text-slate-400',
                          )}
                        >
                          {label}
                        </span>
                        <button
                          onClick={toggleExpanded}
                          className={cn('flex-shrink-0', !isEnabled && 'opacity-30')}
                        >
                          <GroupLinePreview groupStyle={groupStyle} />
                        </button>
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

                      {isExpanded && (
                        <div className="bg-primary/5 rounded-b-lg px-3 pb-3 pt-2 space-y-3 border-t border-primary/10">
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
                <p className="text-[10px] text-slate-400 leading-relaxed mt-2">
                  Toggling a street type regenerates the artwork. Style changes apply instantly.
                </p>
              </div>
            </AccordionSection>

            {/* Water & Land */}
            <AccordionSection label="Water & Land" isOpen={openDesignSection === 'water'} onToggle={() => toggle('water')}>
              <div className="pb-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Label>Water Color</Label>
                  <ColorPalette
                    value={waterColor}
                    onChange={(c) => { if (c) dirtyWaterColor(c); }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label>
                    Land Color
                    {!landColor && <span className="ml-1 normal-case font-normal text-slate-400">(follows theme)</span>}
                  </Label>
                  <ColorPalette
                    value={landColor || null}
                    onChange={dirtyLandColor}
                    allowAuto
                  />
                </div>
              </div>
            </AccordionSection>

            {/* Boundary */}
            <AccordionSection label="Boundary" isOpen={openDesignSection === 'boundary'} onToggle={() => toggle('boundary')}>
              <div className="pb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">Clip to drawn boundary</span>
                  <Toggle on={boundaryConfig.clip} onToggle={() => dirtyBoundary({ clip: !boundaryConfig.clip })} />
                </div>

                {boundaryConfig.clip && (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">Show border</span>
                      <Toggle on={boundaryConfig.border} onToggle={() => dirtyBoundary({ border: !boundaryConfig.border })} />
                    </div>

                    {boundaryConfig.border && (
                      <div className="bg-primary/5 rounded-lg px-3 pb-3 pt-2 space-y-3">
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <Label>Weight</Label>
                            <span className="text-xs font-bold text-primary">{boundaryConfig.borderWeight}px</span>
                          </div>
                          <input
                            type="range" min="0.5" max="50" step="0.5"
                            className="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
                            value={boundaryConfig.borderWeight}
                            onChange={(e) => dirtyBoundary({ borderWeight: parseFloat(e.target.value) })}
                          />
                          <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                            <span>Hairline</span>
                            <span>Bold</span>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Label>Color</Label>
                            <ColorPalette
                              value={boundaryConfig.borderColor}
                              onChange={(c) => { if (c) dirtyBoundary({ borderColor: c }); }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </AccordionSection>
          </div>
        );
      })()}

      {/* ── TYPOGRAPHY ── */}
      {activeTab === 'typography' && (() => {
        const toggleTypo = (id: string) =>
          setOpenTypoSection(prev => prev === id ? null : id);

        return (
          <div className="space-y-0">
            <SectionHeader icon={Type} title="Typography" subtitle="Configure text elements on your map art" />

            {/* Street Labels */}
            <AccordionSection label="Street Labels" isOpen={openTypoSection === 'labels'} onToggle={() => toggleTypo('labels')}>
              <div className="pb-4">
                <TypoControls typo={labelTypography} onChange={onLabelTypographyChange} sizeMin={20} sizeMax={80} allowAutoColor />
              </div>
            </AccordionSection>

            {/* Map Title */}
            <AccordionSection label="Map Title" isOpen={openTypoSection === 'title'} onToggle={() => toggleTypo('title')}>
              <div className="pb-4 space-y-4">
                <div className="space-y-1.5">
                  <Label>Title Text</Label>
                  <input
                    className="w-full bg-slate-50 border-none rounded-lg p-2.5 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="e.g. Lower East Side, NYC"
                    value={mapTitle}
                    onChange={(e) => onMapTitleChange(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Position</Label>
                  <div className="flex gap-2">
                    {(['top', 'bottom'] as const).map(p => (
                      <button key={p} onClick={() => onTitlePositionChange(p)}
                        className={cn('flex-1 py-1.5 text-xs font-bold rounded-lg border-2 capitalize transition-all',
                          titlePosition === p ? 'border-primary bg-primary/5 text-primary' : 'border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100')}
                      >{p}</button>
                    ))}
                  </div>
                </div>
                <TypoControls typo={typography} onChange={onTypographyChange} sizeMin={10} sizeMax={48} />
              </div>
            </AccordionSection>

            {/* Coordinates */}
            <AccordionSection label="Coordinates" isOpen={openTypoSection === 'coords'} onToggle={() => toggleTypo('coords')}>
              <div className="pb-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">Show Coordinates</span>
                  <Toggle on={coordsConfig.show} onToggle={() => onCoordsConfigChange({ show: !coordsConfig.show })} />
                </div>
                {coordsConfig.show && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Format</Label>
                      <div className="flex gap-2">
                        {(['Decimal Degrees', 'DMS'] as CoordFormat[]).map(f => (
                          <button key={f} onClick={() => onCoordsConfigChange({ format: f })}
                            className={cn('flex-1 py-1.5 text-xs font-bold rounded-lg border-2 transition-all',
                              coordsConfig.format === f ? 'border-primary bg-primary/5 text-primary' : 'border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100')}
                          >{f}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Position</Label>
                      <div className="flex gap-2">
                        {(['top', 'bottom'] as const).map(p => (
                          <button key={p} onClick={() => onCoordsConfigChange({ position: p })}
                            className={cn('flex-1 py-1.5 text-xs font-bold rounded-lg border-2 capitalize transition-all',
                              coordsConfig.position === p ? 'border-primary bg-primary/5 text-primary' : 'border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100')}
                          >{p}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <Label>Opacity</Label>
                        <span className="text-xs font-bold text-primary">{Math.round(coordsConfig.opacity * 100)}%</span>
                      </div>
                      <input type="range" min="20" max="100" step="0.1"
                        className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary"
                        value={Math.round(coordsConfig.opacity * 100)}
                        onChange={(e) => onCoordsConfigChange({ opacity: Math.round(parseFloat(e.target.value)) / 100 })}
                      />
                    </div>
                    <TypoControls typo={coordTypography} onChange={onCoordTypographyChange} sizeMin={8} sizeMax={24} allowAutoColor />
                  </>
                )}
              </div>
            </AccordionSection>
          </div>
        );
      })()}

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
                  type="range" min="24" max="120" step="0.1"
                  className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary"
                  value={symbolConfig.scale}
                  onChange={(e) => onSymbolConfigChange({ scale: Math.round(parseFloat(e.target.value)) })}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label>Color</Label>
                  <ColorPalette
                    value={symbolConfig.color}
                    onChange={(c) => { if (c) onSymbolConfigChange({ color: c }); }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Opacity</Label>
                  <span className="text-xs font-bold text-primary">{Math.round(symbolConfig.opacity * 100)}%</span>
                </div>
                <input
                  type="range" min="10" max="100" step="0.1"
                  className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary"
                  value={Math.round(symbolConfig.opacity * 100)}
                  onChange={(e) => onSymbolConfigChange({ opacity: Math.round(parseFloat(e.target.value)) / 100 })}
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

      {/* ── Theme-switch guard dialog ── */}
      {pendingAction && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40"
          onMouseDown={(e) => { if (e.target === e.currentTarget) { setPendingAction(null); setShowSlotPicker(false); } }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-80 p-6 space-y-4">
            {!showSlotPicker ? (
              <>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">Unsaved Style Changes</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Switching themes will discard your current color and style edits.
                  </p>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => setShowSlotPicker(true)}
                    className="w-full py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors"
                  >
                    Save to Custom Slot&hellip;
                  </button>
                  <button
                    onClick={confirmSwitch}
                    className="w-full py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
                  >
                    Discard &amp; Switch
                  </button>
                  <button
                    onClick={() => { setPendingAction(null); setShowSlotPicker(false); }}
                    className="w-full py-2.5 text-slate-400 rounded-xl text-xs font-semibold hover:text-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">Save to Custom Slot</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Choose a slot. Occupied slots will be overwritten.
                  </p>
                </div>
                <div className="space-y-2">
                  {([1, 2, 3] as const).map((id) => {
                    const existing = customSlots.find(s => s.id === id);
                    return (
                      <button
                        key={id}
                        onClick={() => saveToSlot(id)}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-primary/5 border-2 border-transparent hover:border-primary/20 rounded-xl text-xs font-semibold text-slate-700 transition-all"
                      >
                        <span>Custom {id}</span>
                        {existing
                          ? <span className="text-[10px] text-slate-400 font-normal">Overwrite</span>
                          : <span className="text-[10px] text-primary font-normal">Empty</span>
                        }
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setShowSlotPicker(false)}
                  className="w-full py-2 text-slate-400 text-xs font-semibold hover:text-slate-600 transition-colors"
                >
                  ← Back
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
