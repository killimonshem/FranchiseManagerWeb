import React from "react";
import { COLORS, FONT } from "../ui/theme";
import type { GameStateManager } from "../types/GameStateManager";
import { RatingBadge, PosTag, Section } from "../ui/components";

interface DraftEntryScreenProps {
  season: number;
  gsm: GameStateManager;
  onStart: () => void;
}

export function DraftEntryScreen({ season, gsm, onStart }: DraftEntryScreenProps) {
  const userTeam = gsm.userTeam;
  const userTeamIndex = gsm.draftOrder.length > 0
    ? gsm.draftOrder.indexOf(gsm.userTeamId ?? "")
    : -1;

  // Count user's picks
  const teamsCount = gsm.teams.length || 32;
  const userPickPositions = Array.from({ length: 7 }).flatMap((_, round) =>
    Array.from({ length: teamsCount }).map((_, i) => ({
      round: round + 1,
      pick: round * teamsCount + i + 1,
      teamIndex: i,
    }))
  ).filter(p => p.teamIndex === userTeamIndex);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: `linear-gradient(135deg, ${COLORS.bg} 0%, rgba(80, 0, 100, 0.1) 100%)`,
      padding: 40,
      overflow: "auto",
    }}>
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .war-room { animation: slideIn 0.5s ease-out; }
      `}</style>

      <div className="war-room" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        {/* Header */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>
            {season} NFL Draft
          </div>
          <h1 style={{ fontSize: 48, fontWeight: 900, margin: 0, color: COLORS.light, lineHeight: 1.1, marginBottom: 20 }}>
            Welcome to the War Room
          </h1>
          <p style={{ fontSize: 14, color: COLORS.muted, margin: 0, lineHeight: 1.6, maxWidth: 500 }}>
            The {userTeam?.name ?? "Your Team"} are ready to make their mark in this year's draft. Seven rounds, 32 teams, and infinite possibilities await.
          </p>
        </div>

        {/* War Room Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, margin: "40px 0", maxWidth: 600 }}>
          <div style={{
            background: `rgba(215, 241, 113, 0.05)`,
            border: `1px solid ${COLORS.lime}`,
            borderRadius: 12,
            padding: 20,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.lime, textTransform: "uppercase", marginBottom: 8 }}>
              Your Picks
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: COLORS.light, marginBottom: 12 }}>
              {userPickPositions.length}
            </div>
            <div style={{ fontSize: 12, color: COLORS.muted }}>
              {Array.from({ length: 7 }).map((_, round) => {
                const roundPicks = userPickPositions.filter(p => p.round === round + 1);
                return roundPicks.length > 0 ? (
                  <div key={round}>Round {round + 1}: Pick #{roundPicks[0].pick}</div>
                ) : null;
              })}
            </div>
          </div>

          <div style={{
            background: `rgba(255, 255, 255, 0.02)`,
            border: `1px solid ${COLORS.darkMagenta}`,
            borderRadius: 12,
            padding: 20,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", marginBottom: 8 }}>
              Draft Format
            </div>
            <div style={{ fontSize: 14, color: COLORS.light, lineHeight: 1.8 }}>
              <div>7 Rounds</div>
              <div>5 Minutes Per Pick</div>
              <div>256 Total Selections</div>
            </div>
          </div>
        </div>

        {/* Top Prospects Preview */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", marginBottom: 16, letterSpacing: 1 }}>
            Available Talent (Top 5)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, maxWidth: 600 }}>
            {gsm.draftProspects.slice(0, 5).map((prospect) => (
              <div
                key={prospect.id}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${COLORS.darkMagenta}`,
                  borderRadius: 8,
                  padding: 12,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.light, marginBottom: 4 }}>
                  {prospect.name.split(" ")[0]}
                </div>
                <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 6 }}>
                  {prospect.position} · {prospect.college}
                </div>
                <RatingBadge value={prospect.overall} size="sm" />
              </div>
            ))}
          </div>
        </div>

        {/* Call to Action */}
        <div style={{ marginTop: 40 }}>
          <button
            onClick={onStart}
            style={{
              padding: "16px 40px",
              background: COLORS.lime,
              color: COLORS.bg,
              border: "none",
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 900,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: 1,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.filter = "brightness(1)")}
          >
            🏈 Open War Room
          </button>
          <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 12 }}>
            The clock is ready. Your first pick awaits.
          </div>
        </div>
      </div>
    </div>
  );
}
