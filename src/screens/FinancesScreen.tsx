import { COLORS, FONT, fmtCurrency } from "../ui/theme";
import { Section, StatBar } from "../ui/components";
import type { GameStateManager } from "../types/GameStateManager";

export function FinancesScreen({ gsm }: { gsm?: GameStateManager }) {
  const SALARY_CAP = 255400000;

  // Get live cap data from gameStateManager
  const totalCap = gsm ? gsm.getCapHit(gsm.userTeamId) : 0;
  const capSpace = SALARY_CAP - totalCap;
  const cashReserves = gsm?.userTeam?.cashReserves ?? 0;

  // Estimate revenue and expenses based on cap structure
  // Revenue estimate: ~1.3x salary cap for typical team
  const estimatedRevenue = SALARY_CAP * 1.3;
  const playerExpense = totalCap;
  const coachingExpense = totalCap * 0.08; // ~8% of player salary
  const facilitiesExpense = totalCap * 0.05; // ~5%
  const travelExpense = totalCap * 0.03; // ~3%
  const totalExpense = playerExpense + coachingExpense + facilitiesExpense + travelExpense;

  // Revenue breakdown (estimated)
  const ticketSales = estimatedRevenue * 0.35;
  const merchandise = estimatedRevenue * 0.15;
  const broadcasting = estimatedRevenue * 0.40;
  const concessions = estimatedRevenue * 0.10;

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: COLORS.light }}>Financial Overview</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
        {[
          { l: "Cap Used", v: fmtCurrency(totalCap), c: COLORS.light },
          { l: "Cap Space", v: fmtCurrency(capSpace), c: COLORS.lime },
          { l: "Cash Reserves", v: fmtCurrency(cashReserves), c: COLORS.lime },
        ].map((s, i) => (
          <div key={i} style={{ background: "rgba(141,36,110,0.1)", borderRadius: 8, padding: 14, textAlign: "center", border: `1px solid ${COLORS.darkMagenta}` }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.c, fontFamily: FONT.mono }}>{s.v}</div>
            <div style={{ fontSize: 8, color: COLORS.muted, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Section title="Revenue">
          {[
            { k: "Ticket Sales", v: ticketSales },
            { k: "Merchandise", v: merchandise },
            { k: "Broadcasting", v: broadcasting },
            { k: "Concessions", v: concessions },
          ].map((item) => (
            <div key={item.k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(116,0,86,0.4)" }}>
              <span style={{ fontSize: 11, color: COLORS.muted }}>{item.k}</span>
              <span style={{ fontSize: 11, color: COLORS.lime, fontFamily: FONT.mono, fontWeight: 600 }}>
                {fmtCurrency(item.v)}
              </span>
            </div>
          ))}
        </Section>

        <Section title="Expenses">
          {[
            { k: "Players", v: playerExpense },
            { k: "Coaching", v: coachingExpense },
            { k: "Facilities", v: facilitiesExpense },
            { k: "Travel", v: travelExpense },
          ].map((item) => (
            <div key={item.k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(116,0,86,0.4)" }}>
              <span style={{ fontSize: 11, color: COLORS.muted }}>{item.k}</span>
              <span style={{ fontSize: 11, color: COLORS.magenta, fontFamily: FONT.mono, fontWeight: 600 }}>
                {fmtCurrency(item.v)}
              </span>
            </div>
          ))}
        </Section>
      </div>
    </div>
  );
}
