import { useState } from "react";
import { COLORS, fmtCurrency } from "../ui/theme";
import { Section, DataRow, RatingBadge, PosTag } from "../ui/components";
import { Player, PlayerStatus } from "../types/player";
import { calculatePlayerMarketValue } from "../types/player";
import { ArrowUp, ArrowDown } from "lucide-react";

interface Props {
  gsm?: any;
  onRosterChange?: () => void;
  onNavigate?: (screen: string, detail?: any) => void;
}

export function FreeAgencyScreen({ gsm, onRosterChange, onNavigate }: Props) {
  const [signingId, setSigningId] = useState<string | null>(null);
  const [columnSort, setColumnSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const engine = gsm;
  const userTeamId = engine.userTeamId ?? "";
  const capSpace   = engine.getCapSpace(userTeamId);
  
  // Sort free agents
  const freeAgents = engine.freeAgents;
  const sortedAgents = [...freeAgents].sort((a, b) => {
    if (!columnSort) return 0;
    
    const { key, direction } = columnSort;
    let aVal: any, bVal: any;
    
    switch (key) {
      case "rating":
        aVal = a.overall;
        bVal = b.overall;
        break;
      case "age":
        aVal = a.age;
        bVal = b.age;
        break;
      case "value":
        aVal = calculatePlayerMarketValue(a);
        bVal = calculatePlayerMarketValue(b);
        break;
      default:
        return 0;
    }
    
    if (typeof aVal === "number" && typeof bVal === "number") {
      return direction === "asc" ? aVal - bVal : bVal - aVal;
    }
    return 0;
  });

  const requestColumnSort = (key: string) => {
    if (columnSort?.key === key) {
      setColumnSort({ key, direction: columnSort.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      setColumnSort({ key, direction: 'desc' });
    }
  };

  function handleMinDealSign(player: Player, years: number = 1) {
    if (!userTeamId) return;
    setSigningId(player.id);

    // ─── FA Contract System (spec 1.2) ───────────────────────────────────────
    const NFL_MIN_SALARY = engine.leagueMinimumSalary ?? 795_000;
    const baseSalary = Math.max(player.contract?.currentYearCap ?? NFL_MIN_SALARY, NFL_MIN_SALARY);

    // Prorate cap hit if mid-season (weeks 29-46 = regular season)
    const { week } = engine.currentGameDate;
    let capHit = baseSalary;
    if (week >= 29 && week <= 46) {
      const weeksRemaining = 46 - week + 1; // +1 to include current week
      const weeksInRegularSeason = 18;
      capHit = Math.round((weeksRemaining / weeksInRegularSeason) * baseSalary);
    }

    const apy = capHit;

    // Record for compensatory pick tracking
    engine.recordFreeAgentSigning(
      player.id,
      player.teamId ?? null,
      userTeamId,
      apy
    );

    // Move player onto the user's roster and update contract
    const idx = engine.allPlayers.findIndex(p => p.id === player.id);
    if (idx !== -1) {
      const signedPlayer = engine.allPlayers[idx];
      signedPlayer.teamId = userTeamId;
      signedPlayer.status = PlayerStatus.ACTIVE;
      // If multi-year extension requested, generate accordingly
      signedPlayer.contract = {
        totalValue: baseSalary * years,
        yearsRemaining: years,
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
    engine.freeAgents = engine.freeAgents.filter(p => p.id !== player.id);

    // Validate roster constraints after signing
    engine.validateRosterConstraints();

    setSigningId(null);
    onRosterChange?.();
  }

  function handleQuickOffer(player: Player, years: number) {
    if (!userTeamId) return;
    setSigningId(player.id);

    const marketValue = calculatePlayerMarketValue(player);
    const apy = Math.round(marketValue);
    const totalValue = Math.round(marketValue * years);
    const guaranteed = Math.round(totalValue * 0.35);
    const signingBonus = Math.round(totalValue * 0.15);

    // Record FA signing for comp pick tracking
    engine.recordFreeAgentSigning(player.id, player.teamId ?? null, userTeamId, apy);

    const idx = engine.allPlayers.findIndex(p => p.id === player.id);
    if (idx !== -1) {
      const signedPlayer = engine.allPlayers[idx];
      signedPlayer.teamId = userTeamId;
      signedPlayer.status = PlayerStatus.ACTIVE;
      signedPlayer.contract = {
        totalValue,
        yearsRemaining: years,
        guaranteedMoney: guaranteed,
        currentYearCap: marketValue,
        signingBonus,
        incentives: 0,
        canRestructure: true,
        canCut: true,
        deadCap: Math.round(signingBonus / years),
        hasNoTradeClause: false,
        approvedTradeDestinations: [],
      };
    }

    engine.freeAgents = engine.freeAgents.filter(p => p.id !== player.id);
    engine.validateRosterConstraints();
    setSigningId(null);
    onRosterChange?.();
  }

  const isEmpty = freeAgents.length === 0;

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: COLORS.light }}>Free Agency</h2>
          <span style={{ fontSize: 11, color: COLORS.muted }}>
            Cap Space: <span style={{ color: COLORS.lime, fontFamily: "monospace" }}>{fmtCurrency(capSpace)}</span>
          </span>
        </div>
        <button
          onClick={() => onNavigate?.("rfa")}
          style={{
            background: "rgba(116,0,86,0.3)", border: `1px solid ${COLORS.darkMagenta}`,
            color: COLORS.light, borderRadius: 6, padding: "6px 12px",
            fontSize: 11, fontWeight: 600, cursor: "pointer"
          }}
        >
          Manage RFA Tenders
        </button>
      </div>

      <Section pad={false}>
        <DataRow header>
          <span style={{ flex: 1.5, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Player</span>
          <span style={{ flex: 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Pos</span>
          <span
            onClick={() => requestColumnSort("rating")}
            style={{
              flex: 1, fontSize: 8, color: columnSort?.key === "rating" ? COLORS.lime : COLORS.muted, 
              textTransform: "uppercase", letterSpacing: 0.8, fontWeight: columnSort?.key === "rating" ? 800 : 700,
              cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 4
            }}
          >
            Rating {columnSort?.key === "rating" && (columnSort.direction === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
          </span>
          <span
            onClick={() => requestColumnSort("age")}
            style={{
              flex: 1, fontSize: 8, color: columnSort?.key === "age" ? COLORS.lime : COLORS.muted,
              textTransform: "uppercase", letterSpacing: 0.8, fontWeight: columnSort?.key === "age" ? 800 : 700,
              cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 4
            }}
          >
            Age {columnSort?.key === "age" && (columnSort.direction === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
          </span>
          <span
            onClick={() => requestColumnSort("value")}
            style={{
              flex: 1, fontSize: 8, color: columnSort?.key === "value" ? COLORS.lime : COLORS.muted,
              textTransform: "uppercase", letterSpacing: 0.8, fontWeight: columnSort?.key === "value" ? 800 : 700,
              cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 4
            }}
          >
            Market Value {columnSort?.key === "value" && (columnSort.direction === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
          </span>
          <span style={{ flex: 0.8 }} />
        </DataRow>

        {isEmpty && (
          <div style={{ padding: "24px 16px", color: COLORS.muted, fontSize: 12, textAlign: "center" }}>
            No free agents available.
          </div>
        )}

        {sortedAgents.map((player, i) => {
          const marketValue = calculatePlayerMarketValue(player);
          const isMinSalaryPlayer = marketValue <= 1_200_000;
          const canAfford = capSpace >= marketValue;
          const isSigning = signingId === player.id;

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
              <span style={{ flex: 0.8, display: "flex", gap: 4 }}>
                {isMinSalaryPlayer ? (
                  // Min salary player: one "Sign (Min)" button
                  <button
                    disabled={!canAfford || isSigning}
                    onClick={() => handleMinDealSign(player)}
                    style={{
                      fontSize: 8, fontWeight: 700, padding: "3px 6px", borderRadius: 3,
                      border: "none", cursor: canAfford ? "pointer" : "not-allowed",
                      background: canAfford ? COLORS.lime : "rgba(255,255,255,0.08)",
                      color: canAfford ? "#000" : COLORS.muted,
                      flex: 1,
                    }}
                  >
                    {isSigning ? "…" : "Sign (Min)"}
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 6, width: "100%" }}>
                    <button
                      disabled={!canAfford || isSigning}
                      onClick={() => handleQuickOffer(player, 2)}
                      style={{
                        fontSize: 8, fontWeight: 700, padding: "3px 6px", borderRadius: 3,
                        border: "none", cursor: canAfford ? "pointer" : "not-allowed",
                        background: canAfford ? "#b8f18b" : "rgba(255,255,255,0.06)",
                        color: canAfford ? "#000" : COLORS.muted,
                        flex: 1,
                      }}
                    >
                      {isSigning ? "…" : "Quick 2yr"}
                    </button>

                    <button
                      disabled={!canAfford || isSigning}
                      onClick={() => handleQuickOffer(player, 3)}
                      style={{
                        fontSize: 8, fontWeight: 700, padding: "3px 6px", borderRadius: 3,
                        border: "none", cursor: canAfford ? "pointer" : "not-allowed",
                        background: canAfford ? COLORS.lime : "rgba(255,255,255,0.06)",
                        color: canAfford ? "#000" : COLORS.muted,
                        flex: 1,
                      }}
                    >
                      {isSigning ? "…" : "Quick 3yr"}
                    </button>

                    <button
                      disabled={isSigning}
                      onClick={() => onNavigate?.("contractNegotiation", { playerId: player.id })}
                      style={{
                        fontSize: 8, fontWeight: 700, padding: "3px 6px", borderRadius: 3,
                        border: "none", cursor: "pointer",
                        background: COLORS.magenta,
                        color: COLORS.light,
                        flex: 1,
                      }}
                    >
                      {isSigning ? "…" : "Negotiate"}
                    </button>
                  </div>
                )}
              </span>
            </DataRow>
          );
        })}
      </Section>
    </div>
  );
}
