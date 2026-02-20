import { COLORS, fmtCurrency } from "../ui/theme";
import { Section, DataRow, RatingBadge, PosTag } from "../ui/components";

export function FreeAgencyScreen() {
  const FA = [
    { id: 1, name: "Mike Evans", pos: "WR", ovr: 87, age: 31, asking: 18000000 },
    { id: 2, name: "Hunter Henry", pos: "TE", ovr: 80, age: 30, asking: 10000000 },
  ];

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: COLORS.light, marginBottom: 12 }}>Free Agency</h2>
      
      <Section pad={false}>
        <DataRow header>
          {["Player", "Pos", "Rating", "Age", "Asking"].map(h =>
            <span key={h} style={{ fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, flex: h === "Player" ? 1.5 : 1 }}>
              {h}
            </span>
          )}
        </DataRow>
        
        {FA.map((p, i) => (
          <DataRow key={p.id} even={i % 2 === 0} hover>
            <span style={{ flex: 1.5, fontSize: 11, fontWeight: 600, color: COLORS.light }}>{p.name}</span>
            <span style={{ flex: 1 }}><PosTag pos={p.pos} /></span>
            <span style={{ flex: 1 }}><RatingBadge value={p.ovr} size="sm" /></span>
            <span style={{ flex: 1, fontSize: 10, color: COLORS.muted }}>{p.age}</span>
            <span style={{ flex: 1, fontSize: 10, color: COLORS.lime, fontFamily: "monospace" }}>{fmtCurrency(p.asking)}</span>
          </DataRow>
        ))}
      </Section>
    </div>
  );
}
