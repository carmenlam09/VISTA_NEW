const WIDTH = 92;
const HEIGHT = 28;
const PAD = 2;

/**
 * Inline trend line for a KPI card. Deliberately unlabelled and unaxed - it
 * conveys shape only, and the exact figure is the big number beside it.
 *
 * A flat series (every value equal, including all-zero) is drawn as a flat
 * mid-line rather than being normalized into a misleading rise or fall.
 */
export function Sparkline({ series, color }: { series: number[]; color: string }) {
  if (series.length < 2) return null;

  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min;
  const stepX = (WIDTH - PAD * 2) / (series.length - 1);

  const points = series.map((v, i) => {
    const x = PAD + i * stepX;
    const y =
      range === 0
        ? HEIGHT / 2
        : PAD + (HEIGHT - PAD * 2) * (1 - (v - min) / range);
    return [x, y] as const;
  });

  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${PAD},${HEIGHT - PAD} ${line} ${(WIDTH - PAD).toFixed(1)},${HEIGHT - PAD}`;
  const last = points[points.length - 1];
  const gradientId = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      aria-hidden="true"
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradientId})`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />
    </svg>
  );
}
