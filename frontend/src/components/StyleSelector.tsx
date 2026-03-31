import { StyleName, StyleOption } from '../types.js';

interface Props {
  options: StyleOption[];
  selected: StyleName;
  onChange: (style: StyleName) => void;
}

export default function StyleSelector({ options, selected, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {options.map(opt => (
        <button
          key={opt.name}
          onClick={() => onChange(opt.name)}
          aria-pressed={selected === opt.name}
          style={{
            border: selected === opt.name ? '3px solid #333' : '3px solid transparent',
            borderRadius: 8,
            padding: 0,
            cursor: 'pointer',
            background: 'none',
          }}
        >
          {/* Thumbnail: small SVG preview of the style */}
          <svg
            width={80}
            height={80}
            viewBox="0 0 80 80"
            style={{ display: 'block', borderRadius: 6 }}
          >
            <rect width={80} height={80} fill={opt.backgroundColor} />
            <polyline
              points="10,70 30,30 50,55 70,20"
              fill="none"
              stroke={opt.strokeColor}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points="10,40 40,60 70,45"
              fill="none"
              stroke={opt.strokeColor}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p style={{ margin: '4px 0 0', fontSize: 12, textAlign: 'center' }}>{opt.label}</p>
        </button>
      ))}
    </div>
  );
}
