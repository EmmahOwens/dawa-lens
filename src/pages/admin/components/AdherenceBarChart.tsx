type DayData = { day: string; pct: number };

const COLOR = (v: number) => (v >= 80 ? "#30d158" : v >= 60 ? "#ffd60a" : "#ff453a");

export function AdherenceBarChart({ data }: { data: DayData[] }) {
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: 90 }}>
        {data.map((d) => {
          const h = Math.round((d.pct / 100) * 90);
          const color = COLOR(d.pct);
          return (
            <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-1">
              <div
                className="group relative w-full cursor-pointer rounded-t-[4px] transition-[filter] hover:brightness-125"
                style={{
                  height: h,
                  background: `linear-gradient(180deg, ${color}, ${color}66)`,
                }}
              >
                <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[#161d2e] px-1.5 py-0.5 font-mono text-[9px] text-[#f2f2f7] opacity-0 transition-opacity group-hover:opacity-100">
                  {d.pct}%
                </span>
              </div>
              <span className="font-mono text-[9px] text-[#6e7585]">{d.day}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2.5 flex gap-3">
        {[{ color: "#30d158", label: "≥80% Good" }, { color: "#ffd60a", label: "60–79% Fair" }, { color: "#ff453a", label: "<60% Poor" }].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5 text-[10.5px] text-[#6e7585]">
            <div className="h-1.5 w-1.5 rounded-[2px]" style={{ background: l.color }} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}
