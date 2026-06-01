/**
 * Dependency-free inline-SVG mini charts for the progress dynamics. Kept tiny on
 * purpose — CLAUDE.md forbids pulling in a charting library for this.
 */

interface SparklineProps {
  /** Values in 0..1, oldest→newest. */
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}

/** A smooth 0..1 line (e.g. accuracy over days). */
export function Sparkline({ values, width = 220, height = 48, className }: SparklineProps) {
  if (values.length < 2) {
    return <div className="sparkline sparkline--empty">Недостаточно данных</div>;
  }
  const stepX = width / (values.length - 1);
  const y = (v: number) => height - Math.max(0, Math.min(1, v)) * height;
  const points = values.map((v, i) => `${(i * stepX).toFixed(1)},${y(v).toFixed(1)}`);
  const line = `M ${points.join(' L ')}`;
  const area = `${line} L ${width},${height} L 0,${height} Z`;
  return (
    <svg
      className={className ? `sparkline ${className}` : 'sparkline'}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-hidden
    >
      <path className="sparkline__area" d={area} />
      <path className="sparkline__line" d={line} fill="none" />
    </svg>
  );
}

interface BarsProps {
  /** Non-negative counts, oldest→newest. */
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}

/** Simple bar chart for daily activity counts. */
export function Bars({ values, width = 220, height = 48, className }: BarsProps) {
  const max = Math.max(1, ...values);
  const slot = width / Math.max(1, values.length);
  const barW = Math.max(2, slot * 0.7);
  return (
    <svg
      className={className ? `bars ${className}` : 'bars'}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-hidden
    >
      {values.map((v, i) => {
        const h = (v / max) * height;
        const x = i * slot + (slot - barW) / 2;
        return (
          <rect
            key={i}
            className="bars__bar"
            x={x.toFixed(1)}
            y={(height - h).toFixed(1)}
            width={barW.toFixed(1)}
            height={h.toFixed(1)}
            rx={1}
          />
        );
      })}
    </svg>
  );
}
