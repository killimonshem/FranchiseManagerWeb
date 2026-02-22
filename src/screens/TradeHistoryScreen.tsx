import { COLORS } from "../ui/theme";
import { Section, DataRow } from "../ui/components";
import { ArrowLeftRight } from "lucide-react";
import type { GameStateManager } from "../types/GameStateManager";

export function TradeHistoryScreen({ gsm }: { gsm: GameStateManager }) {
  const trades = gsm.completedTrades;

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 800, color: COLORS.light }}>
        Trade History
      </h2>

      {trades.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, fontSize: 13 }}>
          No trades have been completed in this league yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {trades.map((trade) => {
            const team1 = gsm.teams.find(t => t.id === trade.team1Id);
            const team2 = gsm.teams.find(t => t.id === trade.team2Id);

            return (
              <Section key={trade.id} pad={false}>
                <div style={{ padding: "10px 14px", borderBottom: `1px solid ${COLORS.darkMagenta}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.light }}>
                      {team1?.abbreviation} <span style={{ color: COLORS.muted, margin: "0 4px" }}>⇄</span> {team2?.abbreviation}
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: COLORS.muted, fontFamily: "monospace" }}>
                    Week {trade.week}, {trade.season}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  {/* Team 1 Receives (from Team 2) */}
                  <div style={{ padding: 14, borderRight: `1px solid ${COLORS.darkMagenta}` }}>
                    <div style={{ fontSize: 9, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
                      {team1?.abbreviation} Receives
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {trade.team2Assets.length > 0 ? trade.team2Assets.map((asset, i) => (
                        <div key={i} style={{ fontSize: 11, color: COLORS.light }}>
                          {asset}
                        </div>
                      )) : (
                        <div style={{ fontSize: 11, color: COLORS.muted, fontStyle: "italic" }}>Nothing</div>
                      )}
                    </div>
                  </div>

                  {/* Team 2 Receives (from Team 1) */}
                  <div style={{ padding: 14 }}>
                    <div style={{ fontSize: 9, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
                      {team2?.abbreviation} Receives
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {trade.team1Assets.length > 0 ? trade.team1Assets.map((asset, i) => (
                        <div key={i} style={{ fontSize: 11, color: COLORS.light }}>
                          {asset}
                        </div>
                      )) : (
                        <div style={{ fontSize: 11, color: COLORS.muted, fontStyle: "italic" }}>Nothing</div>
                      )}
                    </div>
                  </div>
                </div>
              </Section>
            );
          })}
        </div>
      )}
    </div>
  );
}