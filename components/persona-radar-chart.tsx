'use client';

interface Persona {
  technicalDepth: number;
  codeExamples: number;
  assumedKnowledge: number;
  businessContext: number;
  responseDetail: number;
}

interface PersonaRadarChartProps {
  persona: Persona;
  size?: number;
  color?: string;
}

const DIMENSIONS = [
  { key: 'technicalDepth',   label: 'Technical' },
  { key: 'codeExamples',     label: 'Code'      },
  { key: 'assumedKnowledge', label: 'Knowledge' },
  { key: 'businessContext',  label: 'Business'  },
  { key: 'responseDetail',   label: 'Detail'    },
];

// Clock-degrees (0 = top, clockwise). One per dimension in order.
const ANGLES = [0, 72, 144, 216, 288];

/** Convert clock-angle + radius to SVG [x, y]. */
function pt(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
}

/** SVG points string for a regular pentagon at radius r. */
function pentagonPts(cx: number, cy: number, r: number) {
  return ANGLES.map(a => pt(cx, cy, r, a).join(',')).join(' ');
}

export function PersonaRadarChart({
  persona,
  size = 200,
  color = '#3b82f6',
}: PersonaRadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.3;
  const labelR  = outerR + 14;
  const fs = 11;

  // Filled polygon for the data values
  const dataPath = DIMENSIONS.map(({ key }, i) => {
    const val = (persona[key as keyof Persona] ?? 0);
    const r = (val / 5) * outerR;
    const [x, y] = pt(cx, cy, r, ANGLES[i]);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ') + 'Z';

  return (
    <svg width={size} height={size} style={{ overflow: 'visible' }}>
      {/* Concentric pentagon grid rings */}
      {[0.25, 0.5, 0.75, 1].map(scale => (
        <polygon
          key={scale}
          points={pentagonPts(cx, cy, outerR * scale)}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={1}
        />
      ))}

      {/* Axis spokes */}
      {ANGLES.map((a, i) => {
        const [x, y] = pt(cx, cy, outerR, a);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" strokeWidth={1} />;
      })}

      {/* Data shape */}
      <path
        d={dataPath}
        fill={color}
        fillOpacity={0.2}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Labels adjacent to each vertex */}
      {DIMENSIONS.map(({ label }, i) => {
        const a = ANGLES[i];
        const [x, y] = pt(cx, cy, labelR, a);
        // Horizontal anchor: top/bottom → centre; right side → start; left side → end
        const anchor = (a === 0 || a === 180) ? 'middle' : a < 180 ? 'start' : 'end';
        // Vertical offset: top → push text up (dy negative); bottom → push down; sides → centre
        const dy = a === 0 ? `-${fs * 0.3}` : a === 180 ? `${fs}` : `${fs * 0.35}`;
        return (
          <text
            key={i}
            x={x.toFixed(2)}
            y={y.toFixed(2)}
            textAnchor={anchor}
            dy={dy}
            fontSize={fs}
            fill="#64748b"
            fontFamily="inherit"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}
