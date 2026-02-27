'use client';

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from 'recharts';

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
  { key: 'technicalDepth', label: 'Technical' },
  { key: 'codeExamples', label: 'Code' },
  { key: 'assumedKnowledge', label: 'Knowledge' },
  { key: 'businessContext', label: 'Business' },
  { key: 'responseDetail', label: 'Detail' },
];

export function PersonaRadarChart({
  persona,
  size = 200,
  color = '#3b82f6',
}: PersonaRadarChartProps) {
  const data = DIMENSIONS.map(({ key, label }) => ({
    dimension: label,
    value: persona[key as keyof Persona],
    fullMark: 5,
  }));

  return (
    <ResponsiveContainer width={size} height={size}>
      <RadarChart data={data} margin={{ top: 10, right: 35, bottom: 10, left: 35 }}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{ fontSize: 11, fill: '#64748b' }}
        />
        <Radar
          dataKey="value"
          stroke={color}
          fill={color}
          fillOpacity={0.2}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
