import React from "react";
import { Section, DataRow, PosTag } from "../ui/components";
import { COLORS, fmtCurrency } from "../ui/theme";
import { RFATenderType } from "../types/GameStateManager";

export function RFATenderingScreen({ gsm }: { gsm: any }) {
  // Filter for RFA candidates directly from allPlayers to ensure real data usage
  const candidates = gsm.allPlayers.filter((p: any) => 
    p.teamId === gsm.userTeamId &&
    p.contract &&
    p.contract.yearsRemaining === 0 &&
    p.accruedSeasons === 3
  );

  return (
    <div style={{ animation: "fadeIn .3s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: COLORS.light }}>RFA Tendering</h2>
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>Apply tenders to restricted free agents.</div>
        </div>
      </div>

      <Section pad={false}>
        <DataRow header>
          <span style={{ flex: 2, fontSize: 8, color: COLORS.muted }}>Player</span>
          <span style={{ flex: 1, fontSize: 8, color: COLORS.muted }}>Pos</span>
          <span style={{ flex: 1, fontSize: 8, color: COLORS.muted }}>Accrued</span>
          <span style={{ flex: 1, fontSize: 8, color: COLORS.muted }}></span>
        </DataRow>

        {candidates.length === 0 && (
          <div style={{ padding: 24, color: COLORS.muted }}>No RFA candidates at this time.</div>
        )}

        {candidates.map((p: any, i: number) => (
          <DataRow key={p.id} even={i % 2 === 0} hover>
            <div style={{ flex: 2, fontSize: 12, fontWeight: 600, color: COLORS.light }}>{p.firstName} {p.lastName}</div>
            <div style={{ flex: 1 }}><PosTag pos={p.position} /></div>
            <div style={{ flex: 1, color: COLORS.muted }}>{p.accruedSeasons}</div>
            <div style={{ flex: 1, display: "flex", gap: 6 }}>
              <button onClick={() => { gsm.applyRFATender(p.id, RFATenderType.ROFR); gsm.onEngineStateChange?.(); gsm.onAutoSave?.(); }}
                style={{ padding: "4px 8px", borderRadius: 4, border: "none", background: COLORS.magenta, color: COLORS.light, fontSize: 10, fontWeight: 700 }}>
                ROFR
              </button>
              <button onClick={() => { gsm.applyRFATender(p.id, RFATenderType.ORIGINAL_ROUND); gsm.onEngineStateChange?.(); gsm.onAutoSave?.(); }}
                style={{ padding: "4px 8px", borderRadius: 4, border: "none", background: COLORS.lime, color: COLORS.bg, fontSize: 10, fontWeight: 700 }}>
                Orig. Round
              </button>
              <button onClick={() => { gsm.applyRFATender(p.id, RFATenderType.TRANSITION); gsm.onEngineStateChange?.(); gsm.onAutoSave?.(); }}
                style={{ padding: "4px 8px", borderRadius: 4, border: "none", background: COLORS.coral, color: COLORS.light, fontSize: 10, fontWeight: 700 }}>
                Transition
              </button>
            </div>
          </DataRow>
        ))}
      </Section>
    </div>
  );
}

export default RFATenderingScreen;
