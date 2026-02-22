import { COLORS, FONT, fmtCurrency } from "../ui/theme";
import { Section, StatBar } from "../ui/components";
import type { GameStateManager } from "../types/GameStateManager";
import { CashReserveTier } from "../systems/FinanceSystem";

export function FinancesScreen({ gsm }: { gsm?: GameStateManager }) {
  if (!gsm || !gsm.userTeam) {
    return <div style={{ color: COLORS.muted }}>No team data available</div>;
  }

  const userTeam = gsm.userTeam;
  const totalCap = gsm.getCapHit(gsm.userTeamId!);
  const capSpace = gsm.salaryCap - totalCap;
  const cashReserves = userTeam.cashReserves ?? 0;
  const tier = gsm.financeSystem.getCashReserveTier(userTeam);
  const tierLabel = gsm.financeSystem.getTierLabel(tier);
  const tierColor = gsm.financeSystem.getTierColor(tier);

  // Get latest finance report (if available during regular season weeks 29–46)
  const latestReport = gsm.getLatestFinanceReport();

  // ─── Tier Indicator Banner ────────────────────────────────────────────────────
  const tierBg = tierColor;
  const tierTextColor = tier === CashReserveTier.WEALTHY ? COLORS.dark : COLORS.light;

  // ─── Revenue & Expenses from Latest Report ────────────────────────────────────
  let revenue = 0;
  let expenses = 0;
  let ticketRevenue = 0;
  let merchandiseRevenue = 0;
  let tvRevenue = 0;
  let weeklyBaseSalaries = 0;

  if (latestReport) {
    ticketRevenue = latestReport.ticketRevenue;
    merchandiseRevenue = latestReport.merchandiseRevenue;
    tvRevenue = latestReport.tvRevenue;
    weeklyBaseSalaries = latestReport.weeklyBaseSalaries;
    revenue = ticketRevenue + merchandiseRevenue + tvRevenue;
    expenses = weeklyBaseSalaries;
  }

  // ─── Annualized estimates for display (if no report yet) ────────────────────
  const annualizedRevenue = latestReport
    ? revenue * 18 // Extrapolate from one week
    : gsm.salaryCap * 1.2; // Fallback estimate

  const annualizedExpenses = latestReport
    ? expenses * 18
    : totalCap;

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: COLORS.light }}>
        Financial Overview
      </h2>

      {/* ─── Tier Indicator ─────────────────────────────────────────────────────── */}
      <div
        style={{
          background: tierBg,
          borderRadius: 8,
          padding: 12,
          marginBottom: 14,
          textAlign: "center",
          color: tierTextColor,
          fontWeight: 700,
          fontSize: 13,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {tierLabel}
      </div>

      {/* ─── Key Metrics Grid ───────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
        {[
          { l: "Cap Used", v: fmtCurrency(totalCap), c: COLORS.light },
          { l: "Cap Space", v: fmtCurrency(capSpace), c: COLORS.lime },
          { l: "Cash Reserves", v: fmtCurrency(cashReserves), c: COLORS.lime },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              background: "rgba(141,36,110,0.1)",
              borderRadius: 8,
              padding: 14,
              textAlign: "center",
              border: `1px solid ${COLORS.darkMagenta}`,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: s.c, fontFamily: FONT.mono }}>
              {s.v}
            </div>
            <div
              style={{
                fontSize: 8,
                color: COLORS.muted,
                marginTop: 4,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {s.l}
            </div>
          </div>
        ))}
      </div>

      {/* ─── Weekly Report vs. Annualized ─────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        {/* Weekly Revenue */}
        <Section title={`Weekly Revenue${latestReport ? ` (Week ${latestReport.week})` : ''}`}>
          {latestReport ? (
            <>
              {[
                { k: "Ticket Sales", v: ticketRevenue },
                { k: "Merchandise", v: merchandiseRevenue },
                { k: "TV Revenue", v: tvRevenue },
              ].map((item) => (
                <div
                  key={item.k}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "5px 0",
                    borderBottom: "1px solid rgba(116,0,86,0.4)",
                  }}
                >
                  <span style={{ fontSize: 11, color: COLORS.muted }}>{item.k}</span>
                  <span style={{ fontSize: 11, color: COLORS.lime, fontFamily: FONT.mono, fontWeight: 600 }}>
                    {fmtCurrency(item.v)}
                  </span>
                </div>
              ))}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0 0",
                  borderTop: "1px solid rgba(116,0,86,0.6)",
                  marginTop: 8,
                  fontWeight: 700,
                }}
              >
                <span style={{ fontSize: 11, color: COLORS.lime }}>Total Weekly</span>
                <span style={{ fontSize: 11, color: COLORS.lime, fontFamily: FONT.mono }}>
                  {fmtCurrency(revenue)}
                </span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: COLORS.muted, padding: "10px 0" }}>
              No reports yet (begins week 29)
            </div>
          )}
        </Section>

        {/* Weekly Expenses */}
        <Section title={`Weekly Expenses${latestReport ? ` (Week ${latestReport.week})` : ''}`}>
          {latestReport ? (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "5px 0",
                  borderBottom: "1px solid rgba(116,0,86,0.4)",
                }}
              >
                <span style={{ fontSize: 11, color: COLORS.muted }}>Base Salaries</span>
                <span style={{ fontSize: 11, color: COLORS.magenta, fontFamily: FONT.mono, fontWeight: 600 }}>
                  {fmtCurrency(weeklyBaseSalaries)}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0 0",
                  borderTop: "1px solid rgba(116,0,86,0.6)",
                  marginTop: 8,
                  fontWeight: 700,
                }}
              >
                <span style={{ fontSize: 11, color: COLORS.magenta }}>Total Weekly</span>
                <span style={{ fontSize: 11, color: COLORS.magenta, fontFamily: FONT.mono }}>
                  {fmtCurrency(expenses)}
                </span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: COLORS.muted, padding: "10px 0" }}>
              No reports yet (begins week 29)
            </div>
          )}
        </Section>
      </div>

      {/* ─── Annualized Estimates ──────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Section title="Annualized Estimates">
          {[
            { k: "Annual Revenue", v: annualizedRevenue },
            { k: "Player Salaries (Cap)", v: annualizedExpenses },
          ].map((item) => (
            <div
              key={item.k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "5px 0",
                borderBottom: "1px solid rgba(116,0,86,0.4)",
              }}
            >
              <span style={{ fontSize: 11, color: COLORS.muted }}>{item.k}</span>
              <span style={{ fontSize: 11, color: COLORS.light, fontFamily: FONT.mono, fontWeight: 600 }}>
                {fmtCurrency(item.v)}
              </span>
            </div>
          ))}
        </Section>

        <Section title="Financial Health">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "5px 0",
              borderBottom: "1px solid rgba(116,0,86,0.4)",
            }}
          >
            <span style={{ fontSize: 11, color: COLORS.muted }}>Cap Health</span>
            <span style={{ fontSize: 11, color: COLORS.lime, fontFamily: FONT.mono, fontWeight: 600 }}>
              {((capSpace / gsm.salaryCap) * 100).toFixed(1)}% Free
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "5px 0",
              borderBottom: "1px solid rgba(116,0,86,0.4)",
            }}
          >
            <span style={{ fontSize: 11, color: COLORS.muted }}>Cash Status</span>
            <span style={{ fontSize: 11, color: tierColor, fontFamily: FONT.mono, fontWeight: 600 }}>
              {tier}
            </span>
          </div>
          {latestReport && (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "5px 0",
                  borderBottom: "1px solid rgba(116,0,86,0.4)",
                }}
              >
                <span style={{ fontSize: 11, color: COLORS.muted }}>Weekly Net (Latest)</span>
                <span
                  style={{
                    fontSize: 11,
                    color: revenue - expenses > 0 ? COLORS.lime : COLORS.magenta,
                    fontFamily: FONT.mono,
                    fontWeight: 600,
                  }}
                >
                  {fmtCurrency(revenue - expenses)}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "5px 0",
                }}
              >
                <span style={{ fontSize: 11, color: COLORS.muted }}>Closing Balance (Week {latestReport.week})</span>
                <span style={{ fontSize: 11, color: COLORS.light, fontFamily: FONT.mono, fontWeight: 600 }}>
                  {fmtCurrency(latestReport.closingBalance)}
                </span>
              </div>
            </>
          )}
        </Section>
      </div>
    </div>
  );
}
