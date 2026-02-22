import React from "react";
import { COLORS } from "./theme";
import { PosTag, RatingBadge } from "./components";
import { X } from "lucide-react";

interface DraftRoundRecapProps {
  round: number;
  picks: Array<{
    pickNumber: number;
    teamId: string;
    teamAbbr: string;
    playerName: string;
    playerPos: string;
    playerOvr: number;
  }>;
  userTeamId: string | null;
  onClose: () => void;
}

export function DraftRoundRecapModal({ round, picks, userTeamId, onClose }: DraftRoundRecapProps) {
  // Filter to show only user's picks from this round
  const userRoundPicks = picks.filter(p => p.teamId === userTeamId);

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 300,
      background: "rgba(0,0,0,0.85)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      animation: "fadeIn 0.3s",
    }} onClick={onClose}>
      <div style={{
        background: COLORS.bg,
        border: `1px solid ${COLORS.darkMagenta}`,
        borderRadius: 12,
        width: 500,
        maxWidth: "90%",
        maxHeight: "80vh",
        overflowY: "auto",
        boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
        position: "relative",
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: 20,
          borderBottom: `1px solid ${COLORS.darkMagenta}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", marginBottom: 4 }}>
              Round {round} Summary
            </div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: COLORS.light }}>
              Round {round} Complete
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: COLORS.muted,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Your Picks */}
        {userRoundPicks.length > 0 && (
          <div style={{ padding: 20, borderBottom: `1px solid ${COLORS.darkMagenta}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.lime, textTransform: "uppercase", marginBottom: 12, letterSpacing: 1 }}>
              Your Selections
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {userRoundPicks.map(pick => (
                <div
                  key={pick.pickNumber}
                  style={{
                    padding: 12,
                    background: "rgba(215,241,113,0.05)",
                    border: `1px solid ${COLORS.lime}`,
                    borderRadius: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.light, marginBottom: 2 }}>
                        {pick.playerName}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <PosTag pos={pick.playerPos} />
                        <span style={{ fontSize: 11, color: COLORS.muted }}>Pick {pick.pickNumber}</span>
                      </div>
                    </div>
                    <RatingBadge value={pick.playerOvr} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Round Picks */}
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", marginBottom: 12, letterSpacing: 1 }}>
            All Round {round} Selections
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {picks.map((pick, i) => (
              <div
                key={pick.pickNumber}
                style={{
                  padding: 10,
                  background: "rgba(255,255,255,0.02)",
                  borderRadius: 6,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderLeft: `3px solid ${pick.teamId === userTeamId ? COLORS.lime : COLORS.darkMagenta}`,
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1 }}>
                  <span style={{ fontSize: 9, color: COLORS.muted, fontFamily: "monospace", width: 30 }}>
                    #{pick.pickNumber}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, width: 40 }}>
                    {pick.teamAbbr}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.light, flex: 1 }}>
                    {pick.playerName}
                  </span>
                </div>
                <PosTag pos={pick.playerPos} />
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: 20,
          borderTop: `1px solid ${COLORS.darkMagenta}`,
          display: "flex",
          justifyContent: "flex-end",
        }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              background: COLORS.lime,
              color: COLORS.bg,
              border: "none",
              borderRadius: 6,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Continue Draft
          </button>
        </div>
      </div>
    </div>
  );
}
