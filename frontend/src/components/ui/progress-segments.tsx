interface ProgressSegmentsProps {
  total: number;
  filled: number;
  label: string;
}

export function ProgressSegments({
  total,
  filled,
  label,
}: ProgressSegmentsProps) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={filled}
      className="flex gap-1"
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-2 flex-1 rounded-full ${i < filled ? 'bg-star' : 'bg-flag'}`}
        />
      ))}
    </div>
  );
}
