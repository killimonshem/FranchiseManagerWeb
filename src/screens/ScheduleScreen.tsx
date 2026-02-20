import { COLORS } from "../ui/theme";
import { Section, DataRow, RatingBadge } from "../ui/components";

export function ScheduleScreen() {
  const SCHEDULE = [
    { wk: 1, opp: "Ravens", ovr: 88, home: true },
    { wk: 2, opp: "Bengals", ovr: 85, home: false },
    { wk: 3, opp: "Colts", ovr: 72, home: true },
  ];

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: COLORS.light }}>2025 Schedule</h2>
      
      <Section title="Regular Season" pad={false}>
        <DataRow header>
          {["Wk", "Location", "Opponent", "Rating"].map(h =>
            <span key={h} style={{ fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, flex: 1 }}>
              {h}
            </span>
          )}
        </DataRow>
        
        {SCHEDULE.map((g, i) => (
          <DataRow key={g.wk} even={i % 2 === 0}>
            <span style={{ flex: 1, fontSize: 10, color: COLORS.muted, fontFamily: "monospace" }}>Wk {g.wk}</span>
            <span style={{ flex: 1, fontSize: 10, fontWeight: 600, color: g.home ? COLORS.lime : COLORS.magenta }}>
              {g.home ? "HOME" : "AWAY"}
            </span>
            <span style={{ flex: 1, fontSize: 11, color: COLORS.light }}>{g.opp}</span>
            <span style={{ flex: 1 }}><RatingBadge value={g.ovr} size="sm" /></span>
          </DataRow>
        ))}
      </Section>
    </div>
  );
}
