import { useState } from "react";
import { COLORS, FONT, fmtCurrency } from "../ui/theme";
import {
  RatingBadge, PosTag, Section, StatBar, MoraleMeter, IconBtn, TabBtn,
  StatusBadge, DataRow, Pill
} from "../ui/components";
import { ArrowLeft, TrendingUp, Heart, AlertTriangle } from "lucide-react";
import type { Player, PlayerStatus } from "../types/player";
import { ShoppingStatus, TradeRequestState, PlayerStatus as PlayerStatusEnum } from "../types/player";
import { Position } from "../types/nfl-types";
import { gameStateManager } from "../types/GameStateManager";

export function PlayerProfileScreen({ player, setScreen }: { player: Player | null; setScreen: (s: string) => void }) {
  if (!player) return null;

  const [activeTab, setActiveTab] = useState<'overview' | 'attributes' | 'contract' | 'history'>('overview');
  const [restructurePercent, setRestructurePercent] = useState(25);
  const [releaseConfirm, setReleaseConfirm] = useState(false);

  const fullName = `${player.firstName} ${player.lastName}`;
  const team = gameStateManager.teams.find(t => t.id === player.teamId);

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <button
        onClick={() => setScreen("roster")}
        style={{
          background: "none",
          border: "none",
          color: COLORS.lime,
          fontSize: 11,
          cursor: "pointer",
          padding: 0,
          fontWeight: 600,
          marginBottom: 12,
        }}
      >
        <ArrowLeft size={14} style={{ marginRight: 4, display: "inline" }} /> Back to Roster
      </button>

      {/* HEADER */}
      <div
        style={{
          background: `linear-gradient(135deg, ${COLORS.darkMagenta}, ${COLORS.bg})`,
          borderRadius: 12,
          padding: 22,
          border: `1px solid ${COLORS.magenta}`,
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <RatingBadge value={player.overall} size="lg" />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: COLORS.light }}>
              {player.jerseyNumber != null ? `#${player.jerseyNumber} ` : ""}
              {fullName}
            </h2>
            <PosTag pos={String(player.position)} />
            {player.potential > player.overall && (
              <span title="Developing">
                <TrendingUp size={14} color={COLORS.lime} />
              </span>
            )}
          </div>
          <div style={{ color: COLORS.muted, fontSize: 12 }}>Age {player.age}</div>
          <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 10, color: COLORS.muted }}>
            <span>
              Potential: <RatingBadge value={player.potential} size="sm" />
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              Morale: <MoraleMeter value={player.morale} />
            </span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.lime, fontFamily: FONT.mono }}>
            {player.contract ? fmtCurrency(player.contract.currentYearCap) : "—"}
            {player.contract && <span style={{ fontSize: 10, color: COLORS.muted, fontWeight: 400 }}>/yr</span>}
          </div>
          <div style={{ fontSize: 10, color: COLORS.muted }}>
            {player.contract
              ? `${player.contract.yearsRemaining} year${player.contract.yearsRemaining !== 1 ? "s" : ""} remaining`
              : "Free Agent"}
          </div>
        </div>
      </div>

      {/* TAB NAVIGATION */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: `1px solid ${COLORS.darkMagenta}`, paddingBottom: 12 }}>
        {(['overview', 'attributes', 'contract', 'history'] as const).map((tab) => (
          <TabBtn key={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </TabBtn>
        ))}
      </div>

      {/* TAB: OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {/* Bio Grid */}
          <Section title="Biography">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <DataRow header>
                <span style={{ flex: 1, fontSize: 10, color: COLORS.muted, fontWeight: 700 }}>Height</span>
                <span style={{ fontSize: 10, color: COLORS.light, fontFamily: FONT.mono }}>{player.height}</span>
              </DataRow>
              <DataRow>
                <span style={{ flex: 1, fontSize: 10, color: COLORS.muted, fontWeight: 700 }}>Weight</span>
                <span style={{ fontSize: 10, color: COLORS.light, fontFamily: FONT.mono }}>{player.weight} lbs</span>
              </DataRow>
              <DataRow>
                <span style={{ flex: 1, fontSize: 10, color: COLORS.muted, fontWeight: 700 }}>College</span>
                <span style={{ fontSize: 10, color: COLORS.light, fontFamily: FONT.mono }}>{player.college || "—"}</span>
              </DataRow>
              <DataRow>
                <span style={{ flex: 1, fontSize: 10, color: COLORS.muted, fontWeight: 700 }}>Draft</span>
                <span style={{ fontSize: 10, color: COLORS.light, fontFamily: FONT.mono }}>
                  {player.draftYear > 0
                    ? `${player.draftYear} (R${player.draftRound || "?"}, P${player.draftPick || "?"})`
                    : "—"}
                </span>
              </DataRow>
              <DataRow>
                <span style={{ flex: 1, fontSize: 10, color: COLORS.muted, fontWeight: 700 }}>Injury Status</span>
                <span style={{ fontSize: 10 }}>
                  <StatusBadge
                    label={String(player.injuryStatus)}
                    variant={
                      player.injuryStatus === 'Healthy'
                        ? 'positive'
                        : player.injuryStatus === 'Questionable'
                          ? 'warning'
                          : 'negative'
                    }
                  />
                </span>
              </DataRow>
              <DataRow>
                <span style={{ flex: 1, fontSize: 10, color: COLORS.muted, fontWeight: 700 }}>Fatigue</span>
                <span style={{ flex: 0, width: 200 }}>
                  <StatBar label="" value={player.fatigue} max={100} />
                </span>
              </DataRow>
            </div>
          </Section>

          {/* Personality Traits */}
          <Section title="Personality">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <StatBar label="Work Ethic" value={player.personality.workEthic} />
              <StatBar label="Team Player" value={player.personality.teamPlayer} />
              <StatBar label="Consistency" value={player.personality.consistency} />
            </div>
          </Section>

          {/* Trade Block Controls */}
          {player.contract && (
            <Section title="Trade Block Status" style={{ gridColumn: "1/-1" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { status: ShoppingStatus.OFF_BLOCK, label: 'Off Block' },
                    { status: ShoppingStatus.QUIET_SHOPPING, label: 'Quiet Shopping' },
                    { status: ShoppingStatus.PUBLIC_BLOCK, label: 'On The Block' },
                  ].map(({ status, label }) => (
                    <Pill
                      key={status}
                      active={player.shoppingStatus === status}
                      onClick={() => {
                        gameStateManager.tradeSystem.setShoppingStatus(player, status);
                        gameStateManager.validateRosterConstraints();
                        gameStateManager.onEngineStateChange?.();
                      }}
                    >
                      {label}
                    </Pill>
                  ))}
                </div>
                {player.tradeRequestState === TradeRequestState.PUBLIC_DEMAND && (
                  <StatusBadge label="PUBLIC DEMAND — Trade value -15%" variant="negative" />
                )}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* TAB: ATTRIBUTES */}
      {activeTab === 'attributes' && (
        <AttributesTab player={player} />
      )}

      {/* TAB: CONTRACT */}
      {activeTab === 'contract' && (
        <ContractTab player={player} team={team} restructurePercent={restructurePercent} setRestructurePercent={setRestructurePercent} releaseConfirm={releaseConfirm} setReleaseConfirm={setReleaseConfirm} />
      )}

      {/* TAB: HISTORY */}
      {activeTab === 'history' && (
        <HistoryTab player={player} />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ATTRIBUTES TAB
// ═════════════════════════════════════════════════════════════════════════════

function AttributesTab({ player }: { player: Player }) {
  // Draft prospect fog of war
  if (player.status === PlayerStatusEnum.DRAFT_PROSPECT) {
    const prospect = player.prospectEvaluation;
    return (
      <Section title="Scout Evaluation">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: COLORS.muted }}>PFF Grade</span>
            <RatingBadge value={gradeToValue(prospect?.pffGrade || 'C')} size="md" />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: COLORS.muted }}>Your Grade</span>
            <RatingBadge value={gradeToValue(prospect?.clubGrade || 'C')} size="md" />
          </div>
          {prospect?.confidence && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: COLORS.muted }}>Confidence</span>
              <StatusBadge
                label={['', 'Low', 'Medium', 'High'][prospect.confidence] || 'Unknown'}
                variant={prospect.confidence === 3 ? 'positive' : prospect.confidence === 2 ? 'warning' : 'negative'}
              />
            </div>
          )}
          {prospect?.evidence && prospect.evidence.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 6 }}>Evidence</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {prospect.evidence.map((chip) => (
                  <StatusBadge key={chip.id} label={`${chip.label}: ${chip.value}`} variant={chip.isPositive ? 'positive' : 'negative'} />
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>
    );
  }

  // Real attributes grouped by position
  const attr = player.attributes;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {/* Physical */}
      <Section title="Physical">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <StatBar label="Speed" value={attr.speed} />
          <StatBar label="Strength" value={attr.strength} />
          <StatBar label="Agility" value={attr.agility} />
          <StatBar label="Acceleration" value={attr.acceleration} />
        </div>
      </Section>

      {/* Mental */}
      <Section title="Mental">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <StatBar label="Awareness" value={attr.awareness} />
          <StatBar label="Play Recognition" value={attr.playRecognition} />
          <StatBar label="Leadership" value={attr.leadership} />
        </div>
      </Section>

      {/* Position-specific groups */}
      {player.position === Position.QB && (
        <div style={{ gridColumn: "1/-1" }}>
          <Section title="Throwing">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <StatBar label="Throw Power" value={attr.throwPower} />
              <StatBar label="Throw Accuracy" value={attr.throwAccuracy} />
              <StatBar label="Short Accuracy" value={attr.shortAccuracy} />
              <StatBar label="Medium Accuracy" value={attr.mediumAccuracy} />
              <StatBar label="Deep Accuracy" value={attr.deepAccuracy} />
              <StatBar label="Under Pressure" value={attr.throwUnderPressure} />
            </div>
          </Section>
        </div>
      )}

      {(player.position === Position.RB || player.position === Position.WR || player.position === Position.TE) && (
        <div style={{ gridColumn: "1/-1" }}>
          <Section title="Receiving">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <StatBar label="Catching" value={attr.catching} />
              <StatBar label="Carrying" value={attr.carrying} />
              <StatBar label="Route Running" value={attr.shortRouteRunning} />
              <StatBar label="Release" value={attr.release} />
            </div>
          </Section>
        </div>
      )}

      {player.position === Position.OL && (
        <div style={{ gridColumn: "1/-1" }}>
          <Section title="Blocking">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <StatBar label="Pass Block" value={attr.passBlock} />
              <StatBar label="Run Block" value={attr.runBlock} />
              <StatBar label="Pass Block Power" value={attr.passBlockPower} />
            </div>
          </Section>
        </div>
      )}

      {(player.position === Position.DL || player.position === Position.LB) && (
        <div style={{ gridColumn: "1/-1" }}>
          <Section title="Defense">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <StatBar label="Tackle" value={attr.tackle} />
              <StatBar label="Block Shedding" value={attr.blockShedding} />
              <StatBar label="Power Moves" value={attr.powerMoves} />
              <StatBar label="Finesse Moves" value={attr.finesseMoves} />
            </div>
          </Section>
        </div>
      )}

      {(player.position === Position.CB || player.position === Position.S) && (
        <div style={{ gridColumn: "1/-1" }}>
          <Section title="Coverage">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <StatBar label="Man Coverage" value={attr.manCoverage} />
              <StatBar label="Zone Coverage" value={attr.zoneCoverage} />
              <StatBar label="Press" value={attr.press} />
              <StatBar label="Tackle" value={attr.tackle} />
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CONTRACT TAB
// ═════════════════════════════════════════════════════════════════════════════

function ContractTab({
  player,
  team,
  restructurePercent,
  setRestructurePercent,
  releaseConfirm,
  setReleaseConfirm,
}: {
  player: Player;
  team: any;
  restructurePercent: number;
  setRestructurePercent: (n: number) => void;
  releaseConfirm: boolean;
  setReleaseConfirm: (b: boolean) => void;
}) {
  if (!player.contract) {
    return <Section title="Contract">
      <div style={{ fontSize: 11, color: COLORS.muted }}>No active contract — Free Agent</div>
    </Section>;
  }

  const contract = player.contract;
  const conversionAmount = contract.currentYearCap * (restructurePercent / 100);
  const newCap = contract.currentYearCap - conversionAmount;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {/* Contract Details */}
      <div style={{ gridColumn: "1/-1" }}>
        <Section title="Contract Details">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <DataRow header>
            <span style={{ flex: 1, fontSize: 10, color: COLORS.muted, fontWeight: 700 }}>Annual Cap Hit</span>
            <span style={{ fontSize: 10, color: COLORS.light, fontFamily: FONT.mono }}>{fmtCurrency(contract.currentYearCap)}</span>
          </DataRow>
          <DataRow>
            <span style={{ flex: 1, fontSize: 10, color: COLORS.muted, fontWeight: 700 }}>Total Value</span>
            <span style={{ fontSize: 10, color: COLORS.light, fontFamily: FONT.mono }}>{fmtCurrency(contract.totalValue)}</span>
          </DataRow>
          <DataRow>
            <span style={{ flex: 1, fontSize: 10, color: COLORS.muted, fontWeight: 700 }}>Guaranteed</span>
            <span style={{ fontSize: 10, color: COLORS.light, fontFamily: FONT.mono }}>{fmtCurrency(contract.guaranteedMoney)}</span>
          </DataRow>
          <DataRow>
            <span style={{ flex: 1, fontSize: 10, color: COLORS.muted, fontWeight: 700 }}>Signing Bonus</span>
            <span style={{ fontSize: 10, color: COLORS.light, fontFamily: FONT.mono }}>{fmtCurrency(contract.signingBonus)}</span>
          </DataRow>
          <DataRow>
            <span style={{ flex: 1, fontSize: 10, color: COLORS.muted, fontWeight: 700 }}>Dead Cap</span>
            <span style={{ fontSize: 10, color: COLORS.light, fontFamily: FONT.mono }}>{fmtCurrency(contract.deadCap)}</span>
          </DataRow>
          <DataRow>
            <span style={{ flex: 1, fontSize: 10, color: COLORS.muted, fontWeight: 700 }}>Years Remaining</span>
            <span style={{ fontSize: 10, color: COLORS.light, fontFamily: FONT.mono }}>{contract.yearsRemaining}</span>
          </DataRow>
          <DataRow>
            <span style={{ flex: 1, fontSize: 10, color: COLORS.muted, fontWeight: 700 }}>Can Restructure</span>
            <span style={{ fontSize: 10, color: COLORS.light, fontFamily: FONT.mono }}>{contract.canRestructure ? 'Yes' : 'No'}</span>
          </DataRow>
          <DataRow>
            <span style={{ flex: 1, fontSize: 10, color: COLORS.muted, fontWeight: 700 }}>No-Trade Clause</span>
            <span style={{ fontSize: 10, color: COLORS.light, fontFamily: FONT.mono }}>{contract.hasNoTradeClause ? 'Yes' : 'No'}</span>
          </DataRow>
        </div>
        </Section>
      </div>

      {/* Restructure Widget */}
      {contract.canRestructure && contract.yearsRemaining > 1 && (
        <div style={{ gridColumn: "1/-1" }}>
          <Section title="Contract Restructure">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 8 }}>
                Convert base salary to signing bonus: {restructurePercent}%
              </div>
              <input
                type="range"
                min="1"
                max="50"
                value={restructurePercent}
                onChange={(e) => setRestructurePercent(Number(e.target.value))}
                style={{ width: "100%", cursor: "pointer" }}
              />
            </div>
            <div style={{ fontSize: 10, color: COLORS.lime, fontFamily: FONT.mono }}>
              Saves {fmtCurrency(conversionAmount)}/yr | Adds {fmtCurrency(conversionAmount)} dead cap
            </div>
            <button
              onClick={() => {
                const result = gameStateManager.financeSystem.executeRestructure(player, team, restructurePercent);
                if (result.success) {
                  gameStateManager.validateRosterConstraints();
                  gameStateManager.onEngineStateChange?.();
                }
              }}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                background: COLORS.lime,
                color: COLORS.bg,
                border: "none",
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Restructure
            </button>
            </div>
          </Section>
        </div>
      )}

      {/* Status-Driven Action Buttons */}
      <div style={{ gridColumn: "1/-1" }}>
        <Section title="Actions">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {player.status === PlayerStatusEnum.PRACTICE_SQUAD && (
            <button
              onClick={() => {
                player.status = PlayerStatusEnum.ACTIVE;
                gameStateManager.validateRosterConstraints();
                gameStateManager.onEngineStateChange?.();
              }}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                background: COLORS.lime,
                color: COLORS.bg,
                border: "none",
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Promote to Active
            </button>
          )}

          {player.status === PlayerStatusEnum.INJURED_RESERVE && player.weeksOnIR >= 4 && (
            <button
              onClick={() => {
                player.status = PlayerStatusEnum.ACTIVE;
                player.weeksOnIR = Math.max(0, player.weeksOnIR - 1);
                gameStateManager.validateRosterConstraints();
                gameStateManager.onEngineStateChange?.();
              }}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                background: COLORS.lime,
                color: COLORS.bg,
                border: "none",
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Activate from IR
            </button>
          )}

          {!releaseConfirm && (
            <button
              onClick={() => setReleaseConfirm(true)}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                background: COLORS.coral,
                color: COLORS.light,
                border: "none",
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Release Player
            </button>
          )}

          {releaseConfirm && (
            <div style={{ padding: 12, background: "rgba(141,36,110,0.2)", borderRadius: 6, borderLeft: `3px solid ${COLORS.coral}` }}>
              <div style={{ fontSize: 10, color: COLORS.light, marginBottom: 10 }}>
                Releasing this player will create {fmtCurrency(contract.deadCap)} in dead cap.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    // Release player to free agency
                    player.status = PlayerStatusEnum.FREE_AGENT;
                    player.teamId = undefined;
                    gameStateManager.validateRosterConstraints();
                    gameStateManager.onEngineStateChange?.();
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 4,
                    background: COLORS.coral,
                    color: COLORS.light,
                    border: "none",
                    fontSize: 9,
                    fontWeight: 700,
                    cursor: "pointer",
                    flex: 1,
                  }}
                >
                  Confirm Release
                </button>
                <button
                  onClick={() => setReleaseConfirm(false)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 4,
                    background: "rgba(141,36,110,0.3)",
                    color: COLORS.muted,
                    border: "none",
                    fontSize: 9,
                    fontWeight: 700,
                    cursor: "pointer",
                    flex: 1,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        </Section>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// HISTORY TAB
// ═════════════════════════════════════════════════════════════════════════════

function HistoryTab({ player }: { player: Player }) {
  const stats = player.careerTotalStats;

  const getRelevantStats = () => {
    switch (player.position) {
      case Position.QB:
        return [
          { label: "Passing Yards", value: stats.passingYards },
          { label: "Passing TDs", value: stats.passingTDs },
          { label: "Interceptions", value: stats.interceptions },
          { label: "Completions", value: stats.completions },
          { label: "Attempts", value: stats.attempts },
          { label: "Games Started", value: stats.gamesStarted },
        ];
      case Position.RB:
        return [
          { label: "Rushing Yards", value: stats.rushingYards },
          { label: "Rushing TDs", value: stats.rushingTDs },
          { label: "Rushing Attempts", value: stats.rushingAttempts },
          { label: "Receptions", value: stats.receptions },
          { label: "Receiving Yards", value: stats.receivingYards },
          { label: "Games Played", value: stats.gamesPlayed },
        ];
      case Position.WR:
      case Position.TE:
        return [
          { label: "Receptions", value: stats.receptions },
          { label: "Receiving Yards", value: stats.receivingYards },
          { label: "Receiving TDs", value: stats.receivingTDs },
          { label: "Targets", value: stats.targets },
          { label: "Games Played", value: stats.gamesPlayed },
        ];
      case Position.DL:
      case Position.LB:
      case Position.CB:
      case Position.S:
        return [
          { label: "Tackles", value: stats.tackles },
          { label: "Sacks", value: stats.sacks },
          { label: "Interceptions Def", value: stats.interceptionsDef },
          { label: "Passes Defended", value: stats.passesDefended },
          { label: "Forced Fumbles", value: stats.forcedFumbles },
        ];
      case Position.K:
        return [
          { label: "Field Goals Made", value: stats.fieldGoalsMade },
          { label: "Field Goals Attempted", value: stats.fieldGoalsAttempted },
          { label: "Longest FG", value: stats.longestFieldGoal },
          { label: "Extra Points Made", value: stats.extraPointsMade },
        ];
      case Position.P:
        return [
          { label: "Punts", value: stats.punts },
          { label: "Punt Yards", value: stats.puntYards },
          { label: "Punts Inside 20", value: stats.puntsInside20 },
        ];
      case Position.OL:
        return [
          { label: "Sacks Allowed", value: stats.sacksAllowed },
          { label: "Pancake Blocks", value: stats.pancakeBlocks },
          { label: "Games Started", value: stats.gamesStarted },
        ];
      default:
        return [];
    }
  };

  const relevantStats = getRelevantStats();

  return (
    <Section title="Career Statistics">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {relevantStats.map((stat, idx) => (
          <DataRow key={stat.label} even={idx % 2 === 0}>
            <span style={{ flex: 1, fontSize: 10, color: COLORS.muted }}>{stat.label}</span>
            <span style={{ fontSize: 10, color: COLORS.light, fontFamily: FONT.mono, fontWeight: 600 }}>
              {stat.value.toLocaleString()}
            </span>
          </DataRow>
        ))}
      </div>
    </Section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═════════════════════════════════════════════════════════════════════════════

function gradeToValue(grade: string): number {
  const map: Record<string, number> = {
    "A+": 99, "A": 95, "A-": 91,
    "B+": 87, "B": 83, "B-": 79,
    "C+": 75, "C": 71, "C-": 67,
    "D+": 63, "D": 59, "D-": 55,
    "F": 40,
  };
  return map[grade.toUpperCase()] || 70;
}
