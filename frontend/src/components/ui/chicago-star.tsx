import type { CSSProperties } from 'react';

const CENTER = 12;
const OUTER_RADIUS = 10;
const INNER_RADIUS = 4.1;

/** 12 vertices every 30 degrees, starting straight up, alternating outer and inner radius. */
const POINTS = Array.from({ length: 12 }, (_, i) => {
  const radius = i % 2 === 0 ? OUTER_RADIUS : INNER_RADIUS;
  const angle = (i * Math.PI) / 6;
  const x = CENTER + radius * Math.sin(angle);
  const y = CENTER - radius * Math.cos(angle);
  return `${x.toFixed(3)},${y.toFixed(3)}`;
}).join(' ');

interface ChicagoStarProps {
  filled: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Six-pointed Chicago star, one point up. Solid red when filled, red outline when not. */
export function ChicagoStar({ filled, className = '', style }: ChicagoStarProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={style}
      data-filled={filled}
      className={`${className} ${filled ? 'fill-star stroke-star' : 'fill-white stroke-star'}`.trim()}
    >
      <polygon
        points={POINTS}
        strokeWidth={1.1}
        strokeLinejoin="miter"
        strokeMiterlimit={6}
      />
    </svg>
  );
}
