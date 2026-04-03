import { StyleName, StyleOption, CustomSlot } from '../types.js';

interface Props {
  options: StyleOption[];
  selected: StyleName;
  onChange: (style: StyleName) => void;
  customSlots?: CustomSlot[];
  onCustomSlotSelect?: (slot: CustomSlot) => void;
}

export default function StyleSelector({ options, selected, onChange, customSlots = [], onCustomSlotSelect }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {options.map(opt => (
        <button
          key={opt.name}
          onClick={() => onChange(opt.name)}
          aria-pressed={selected === opt.name}
          style={{
            border: selected === opt.name ? '2px solid #0050cb' : '2px solid transparent',
            borderRadius: 8,
            padding: 0,
            cursor: 'pointer',
            background: 'none',
          }}
        >
          <svg
            width="100%"
            viewBox="0 0 56 56"
            style={{ display: 'block', borderRadius: 6 }}
          >
            <rect width={56} height={56} fill={opt.backgroundColor} />
            <polyline
              points="7,49 21,21 35,39 49,14"
              fill="none"
              stroke={opt.strokeColor}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points="7,28 28,42 49,32"
              fill="none"
              stroke={opt.strokeColor}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p style={{ margin: '3px 0 2px', fontSize: 10, textAlign: 'center' }}>{opt.label}</p>
        </button>
      ))}

      {customSlots.map(slot => {
        const baseOpt = options.find(o => o.name === slot.baseStyle);
        const bg     = slot.waterColor || baseOpt?.backgroundColor || '#f0f0f0';
        const stroke = slot.streetConfig.groupStyles.major?.color || baseOpt?.strokeColor || '#6b7280';
        return (
          <button
            key={`custom-${slot.id}`}
            onClick={() => onCustomSlotSelect?.(slot)}
            title={slot.label}
            style={{
              border: '2px solid transparent',
              borderRadius: 8,
              padding: 0,
              cursor: 'pointer',
              background: 'none',
              position: 'relative',
            }}
          >
            <svg
              width="100%"
              viewBox="0 0 56 56"
              style={{ display: 'block', borderRadius: 6 }}
            >
              <rect width={56} height={56} fill={bg} />
              <polyline
                points="7,49 21,21 35,39 49,14"
                fill="none"
                stroke={stroke}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points="7,28 28,42 49,32"
                fill="none"
                stroke={stroke}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Slot number badge */}
              <circle cx={46} cy={10} r={8} fill="#0050cb" />
              <text x={46} y={14} textAnchor="middle" fontSize={9} fontWeight="bold" fill="white">{slot.id}</text>
            </svg>
            <p style={{ margin: '3px 0 2px', fontSize: 10, textAlign: 'center' }}>{slot.label}</p>
          </button>
        );
      })}
    </div>
  );
}
