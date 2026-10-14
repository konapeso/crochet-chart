"use client";

import { useId, useState } from "react";

/** iOS で入力しやすい数値欄（± ボタン付き。入力中は自由に書けて、確定時に範囲内へ丸める） */
export function NumberField(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  const { label, value, min, max, onChange, suffix } = props;
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v)));
  const commit = () => {
    const v = Number(draft);
    if (draft !== null && draft.trim() !== "" && Number.isFinite(v)) onChange(clamp(v));
    setDraft(null);
  };
  const step = (d: number) => onChange(clamp(value + d));
  const btn = "h-11 w-11 shrink-0 rounded-full border-[1.5px] border-ink/70 bg-cream text-lg text-ink active:bg-oat disabled:border-line disabled:opacity-40";

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <button type="button" className={btn} aria-label={`${label}を減らす`} disabled={value <= min} onClick={() => step(-1)}>
          −
        </button>
        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="h-11 w-full rounded-xl border-[1.5px] border-line bg-white px-2 text-center text-base font-bold tabular-nums"
            value={draft ?? String(value)}
            onFocus={(e) => {
              setDraft(String(value));
              e.currentTarget.select();
            }}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          {suffix && <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted/70">{suffix}</span>}
        </div>
        <button type="button" className={btn} aria-label={`${label}を増やす`} disabled={value >= max} onClick={() => step(1)}>
          ＋
        </button>
      </div>
    </div>
  );
}
