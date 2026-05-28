interface Props {
  value: number; // 0..1
}

export function ProgressBar({ value }: Props) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="pbar">
      <div className="pbar__track">
        <div className="pbar__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="pbar__pct">{pct}%</span>
    </div>
  );
}
