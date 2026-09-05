import { useMemo } from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
  className?: string;
}

export function Sparkline({
  data,
  width = 80,
  height = 24,
  color = '#10b981',
  fillColor,
  className = '',
}: SparklineProps) {
  const { path, fillPath } = useMemo(() => {
    if (data.length < 2) return { path: '', fillPath: '' };

    const minVal = Math.min(...data);
    const maxVal = Math.max(...data);
    const range = maxVal - minVal || 1;

    const padding = 2;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((value - minVal) / range) * chartHeight;
      return { x, y };
    });

    const linePath = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');

    const fillPathData = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`;

    return { path: linePath, fillPath: fillPathData };
  }, [data, width, height]);

  if (data.length < 2) {
    return <div className={className} style={{ width, height }} />;
  }

  return (
    <svg width={width} height={height} className={className}>
      {fillColor && (
        <path
          d={fillPath}
          fill={fillColor}
          opacity={0.2}
        />
      )}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
