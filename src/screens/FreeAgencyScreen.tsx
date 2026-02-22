import { useState } from "react";
import { COLORS, fmtCurrency } from "../ui/theme";
import { Section, DataRow, RatingBadge, PosTag } from "../ui/components";
import { gameStateManager } from "../types/GameStateManager";
import { Player, PlayerStatus } from "../types/player";
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

    // ─── FA Contract System (spec 1.2) ───────────────────────────────────────
    const NFL_MIN_SALARY = 795_000;
    const baseSalary = Math.max(player.contract?.currentYearCap ?? NFL_MIN_SALARY, NFL_MIN_SALARY);

    // Prorate cap hit if mid-season (weeks 29-46 = regular season)
    const { week } = gameStateManager.currentGameDate;
    let capHit = baseSalary;
    if (week >= 29 && week <= 46) {
      const weeksRemaining = 46 - week + 1; // +1 to include current week
      const weeksInRegularSeason = 18;
      capHit = Math.round((weeksRemaining / weeksInRegularSeason) * baseSalary);
    }

    const apy = capHit;

    // Record for compensatory pick tracking
    gameStateManager.recordFreeAgentSigning(
      player.id,
      player.teamId ?? null,
      userTeamId,
      apy
    );

    // Move player onto the user's roster and update contract
    const idx = gameStateManager.allPlayers.findIndex(p => p.id === player.id);
    if (idx !== -1) {
      const signedPlayer = gameStateManager.allPlayers[idx];
      signedPlayer.teamId = userTeamId;
      signedPlayer.status = PlayerStatus.ACTIVE; // Spec 1.2: Set to ACTIVE when signed
      // Generate default 1-year contract at calculated cap hit
      signedPlayer.contract = {
        totalValue: baseSalary,
        yearsRemaining: 1,
        guaranteedMoney: 0,
        currentYearCap: capHit,
        signingBonus: 0,
        incentives: 0,
        canRestructure: false,
        canCut: true,
        deadCap: 0,
        hasNoTradeClause: false,
        approvedTradeDestinations: [],
      };
    }

    // Remove from free agent pool
    gameStateManager.freeAgents = gameStateManager.freeAgents.filter(p => p.id !== player.id);

    // Validate roster constraints after signing
    gameStateManager.validateRosterConstraints();

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
