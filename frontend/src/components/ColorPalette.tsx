import { useState, useRef, useEffect } from 'react';
import { cn } from '../lib/utils.js';

// ── Palette generation ───────────────────────────────────────────────────────

function hslToHex(h: number, s: number, l: number): string {
  const sl = s / 100;
  const ll = l / 100;
  const a = sl * Math.min(ll, 1 - ll);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const val = ll - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * val).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// 10 grayscale steps: white → black
const GRAYS: string[] = Array.from({ length: 10 }, (_, i) =>
  hslToHex(0, 0, Math.round(100 - i * (100 / 9))),
);

// 8 hue families × 10 lightness steps (light pastel → deep dark)
const HUES = [0, 24, 48, 90, 150, 200, 225, 270];
const LIGHTNESS = [92, 82, 70, 58, 46, 36, 26, 18, 12, 7];
const HUE_ROWS: string[][] = HUES.map(h =>
  LIGHTNESS.map(l => hslToHex(h, 70, l)),
);

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  value: string | null;        // null = "auto / follows theme"
  onChange: (color: string | null) => void;
  allowAuto?: boolean;
}

export default function ColorPalette({ value, onChange, allowAuto }: Props) {
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // Sync hex input with current value
  useEffect(() => {
    setHexInput(value ?? '');
  }, [value, open]);

  // Position + open popover
  const handleTrigger = () => {
    if (open) { setOpen(false); return; }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const popoverWidth = 256;
    const popoverHeight = 310; // estimated: 9 swatch rows + hex row + padding
    const left = Math.min(rect.left, window.innerWidth - popoverWidth - 8);
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < popoverHeight + 8
      ? Math.max(8, rect.top - popoverHeight - 6)
      : rect.bottom + 6;
    setPos({ top, left: Math.max(8, left) });
    setOpen(true);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!popoverRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const select = (color: string | null) => {
    onChange(color);
    setOpen(false);
  };

  const handleHexChange = (raw: string) => {
    setHexInput(raw);
    const cleaned = raw.startsWith('#') ? raw : `#${raw}`;
    if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) onChange(cleaned);
  };

  return (
    <>
      {/* Trigger swatch */}
      <button
        ref={triggerRef}
        onClick={handleTrigger}
        title={value ?? 'Auto (follows theme)'}
        className={cn(
          'w-6 h-6 rounded-[5px] border-2 transition-all flex-shrink-0 flex items-center justify-center',
          open   ? 'border-primary ring-2 ring-primary/20 scale-110'
                 : 'border-slate-200 hover:scale-105',
          !value && 'border-dashed border-slate-400',
        )}
        style={{ background: value ?? 'transparent' }}
      >
        {!value && <span className="text-[8px] font-bold text-slate-400 leading-none select-none">A</span>}
      </button>

      {/* Palette popover */}
      {open && (
        <div
          ref={popoverRef}
          className="fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-200 p-3 space-y-1.5"
          style={{ top: pos.top, left: pos.left }}
          // Prevent drag-to-pan on the artwork canvas from firing while using the picker
          onMouseDown={e => e.stopPropagation()}
        >
          {/* Grayscale row */}
          <div className="flex gap-1">
            {GRAYS.map(c => (
              <button
                key={c}
                onClick={() => select(c)}
                className={cn(
                  'w-5 h-5 rounded-[3px] border transition-all hover:scale-125 hover:z-10 hover:shadow-sm',
                  value === c ? 'border-primary scale-110' : 'border-slate-200',
                )}
                style={{ background: c }}
              />
            ))}
          </div>

          {/* Hue rows */}
          {HUE_ROWS.map((row, ri) => (
            <div key={ri} className="flex gap-1">
              {row.map(c => (
                <button
                  key={c}
                  onClick={() => select(c)}
                  className={cn(
                    'w-5 h-5 rounded-[3px] border transition-all hover:scale-125 hover:z-10 hover:shadow-sm',
                    value === c ? 'border-primary scale-110' : 'border-transparent',
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          ))}

          {/* Hex input + auto + preview */}
          <div className="flex items-center gap-2 pt-1.5 border-t border-slate-100">
            {allowAuto && (
              <button
                onClick={() => select(null)}
                className={cn(
                  'px-2 py-1 rounded-md text-[10px] font-bold border-2 flex-shrink-0 transition-all',
                  !value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-dashed border-slate-300 text-slate-400 hover:border-slate-400',
                )}
              >
                Auto
              </button>
            )}
            <input
              value={hexInput}
              onChange={e => handleHexChange(e.target.value)}
              placeholder="#1c1b1b"
              spellCheck={false}
              maxLength={7}
              className="flex-1 min-w-0 px-2 py-1 rounded-md bg-slate-50 text-xs font-mono border border-slate-200 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
            <div
              className="w-6 h-6 rounded-md border border-slate-200 flex-shrink-0"
              style={{ background: value ?? '#ffffff' }}
            />
          </div>
        </div>
      )}
    </>
  );
}
