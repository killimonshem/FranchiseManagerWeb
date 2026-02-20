import { useState } from "react";
import { COLORS, fmtCurrency } from "../ui/theme";
import { Section, DataRow, RatingBadge, PosTag } from "../ui/components";
import { gameStateManager } from "../types/GameStateManager";
import { Player } from "../types/player";
import { calculatePlayerMarketValue } from "../types/player";

interface Props {
  onRosterChange?: () => void;
}

export function FreeAgencyScreen({ onRosterChange }: Props) {
  const [signingId, setSigningId] = useState<string | null>(null);

  const freeAgents = gameStateManager.freeAgents;
  const userTeamId = gameStateManager.userTeamId ?? "";
  const capSpace   = gameStateManager.getCapSpace(userTeamId);

  function handleSign(player: Player) {
    if (!userTeamId) return;
    setSigningId(player.id);

    const apy = player.contract?.currentYearCap ?? gameStateManager.leagueMinimumSalary;

    // Record for compensatory pick tracking
    gameStateManager.recordFreeAgentSigning(
      player.id,
      player.teamId ?? null,
      userTeamId,
      apy
    );

    // Move player onto the user's roster
    const idx = gameStateManager.allPlayers.findIndex(p => p.id === player.id);
    if (idx !== -1) gameStateManager.allPlayers[idx].teamId = userTeamId;

    // Remove from free agent pool
    gameStateManager.freeAgents = gameStateManager.freeAgents.filter(p => p.id !== player.id);

    setSigningId(null);
    onRosterChange?.();
  }

  const isEmpty = freeAgents.length === 0;

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: COLORS.light }}>Free Agency</h2>
        <span style={{ fontSize: 11, color: COLORS.muted }}>
          Cap Space: <span style={{ color: COLORS.lime, fontFamily: "monospace" }}>{fmtCurrency(capSpace)}</span>
        </span>
      </div>

      <Section pad={false}>
        <DataRow header>
          {["Player", "Pos", "Rating", "Age", "Market Value", ""].map((h, i) =>
            <span key={i} style={{
              fontSize: 8, color: COLORS.muted, textTransform: "uppercase",
              letterSpacing: 0.8, fontWeight: 700,
              flex: h === "Player" ? 1.5 : h === "" ? 0.8 : 1,
            }}>
              {h}
            </span>
          )}
        </DataRow>

        {isEmpty && (
          <div style={{ padding: "24px 16px", color: COLORS.muted, fontSize: 12, textAlign: "center" }}>
            No free agents available.
          </div>
        )}

        {freeAgents.map((player, i) => {
          const marketValue = calculatePlayerMarketValue(player);
          const canAfford   = capSpace >= marketValue;
          const isSigning   = signingId === player.id;
          return (
            <DataRow key={player.id} even={i % 2 === 0} hover>
              <span style={{ flex: 1.5, fontSize: 11, fontWeight: 600, color: COLORS.light }}>
                {player.firstName} {player.lastName}
              </span>
              <span style={{ flex: 1 }}><PosTag pos={player.position} /></span>
              <span style={{ flex: 1 }}><RatingBadge value={player.overall} size="sm" /></span>
              <span style={{ flex: 1, fontSize: 10, color: COLORS.muted }}>{player.age}</span>
              <span style={{ flex: 1, fontSize: 10, color: COLORS.lime, fontFamily: "monospace" }}>
                {fmtCurrency(marketValue)}
              </span>
              <span style={{ flex: 0.8 }}>
                <button
                  disabled={!canAfford || isSigning}
                  onClick={() => handleSign(player)}
                  style={{
                    fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 4,
                    border: "none", cursor: canAfford ? "pointer" : "not-allowed",
                    background: canAfford ? COLORS.magenta : "rgba(255,255,255,0.08)",
                    color: canAfford ? COLORS.light : COLORS.muted,
                  }}
                >
                  {isSigning ? "…" : "Sign"}
                </button>
              </span>
            </DataRow>
          );
        })}
      </Section>
    </div>
  );
}
