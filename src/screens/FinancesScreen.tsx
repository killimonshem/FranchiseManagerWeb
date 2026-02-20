import { COLORS, FONT, fmtCurrency } from "../ui/theme";
import { Section, StatBar } from "../ui/components";

export function FinancesScreen() {
  const SALARY_CAP = 255400000;
  const totalCap = 230000000;
  const TOTAL_REV = 330000000;
  const TOTAL_EXP = 310000000;

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: COLORS.light }}>Financial Overview</h2>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
        {[
          { l: "Cap Used", v: fmtCurrency(totalCap), c: COLORS.light },
          { l: "Cap Space", v: fmtCurrency(SALARY_CAP - totalCap), c: COLORS.lime },
          { l: "Cash Reserves", v: "$50.0M", c: COLORS.lime },
        ].map((s, i) => (
          <div key={i} style={{ background: "rgba(141,36,110,0.1)", borderRadius: 8, padding: 14, textAlign: "center", border: `1px solid ${COLORS.darkMagenta}` }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.c, fontFamily: FONT.mono }}>{s.v}</div>
            <div style={{ fontSize: 8, color: COLORS.muted, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Section title="Revenue">
          {["Ticket Sales", "Merchandise", "Broadcasting", "Concessions"].map((k, i) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(116,0,86,0.4)" }}>
              <span style={{ fontSize: 11, color: COLORS.muted }}>{k}</span>
              <span style={{ fontSize: 11, color: COLORS.lime, fontFamily: FONT.mono, fontWeight: 600 }}>
                {fmtCurrency([85000000, 42000000, 120000000, 18000000][i])}
              </span>
            </div>
          ))}
        </Section>

        <Section title="Expenses">
          {["Players", "Coaching", "Facilities", "Travel"].map((k, i) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(116,0,86,0.4)" }}>
              <span style={{ fontSize: 11, color: COLORS.muted }}>{k}</span>
              <span style={{ fontSize: 11, color: COLORS.magenta, fontFamily: FONT.mono, fontWeight: 600 }}>
                {fmtCurrency([230000000, 18000000, 12000000, 6000000][i])}
              </span>
            </div>
          ))}
        </Section>
      </div>
    </div>
  );
}
