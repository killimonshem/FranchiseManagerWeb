import { COLORS, fmtCurrency } from "../ui/theme";
import { Section, DataRow, PosTag, Pill } from "../ui/components";
import { useState, useEffect } from "react";
import { ArrowLeftRight, Lock } from "lucide-react";
import type { GameStateManager, TeamDraftPick } from "../types/GameStateManager";
import type { TradeOfferPayloadUI, TradeEvaluation } from "../systems/TradeSystem";

// ─── Component ────────────────────────────────────────────────────────────────

const ROUND_LABEL = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th"];
const POSITIONS = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K", "P"];

function pickLabel(p: TeamDraftPick): string {
  const rnd = ROUND_LABEL[p.round] ?? `Rd ${p.round}`;
  return `${p.year} ${rnd} (${p.originalTeamId})`;
}

function pickId(p: TeamDraftPick): string {
  return `${p.year}-${p.round}-${p.originalTeamId}`;
}

function fairnessColor(result: TradeEvaluation): string {
  if (result.errorState) return "#ff5555";
  if (result.accepted) return COLORS.lime;
  if (result.counterOffer) return "#f5a623";
  return "#ff5555";
}

function FairnessBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.round((score / 1.2) * 100));
  return (
    <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, marginTop: 6 }}>
      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: COLORS.lime, transition: "width 0.4s" }} />
    </div>
  );
}

// ─── Asset toggle row ─────────────────────────────────────────────────────────

function PlayerRow({
  player, selected, onToggle, onToggleBlock, isUserPlayer, showTeam
}: {
  player: any;
  selected: boolean;
  onToggle: (id: string) => void;
  onToggleBlock?: (id: string) => void;
  isUserPlayer?: boolean;
  showTeam?: boolean;
}) {
  const isOnBlock = player.shoppingStatus === "On The Block";
  return (
    <DataRow hover even={false} key={player.id}>
      <span style={{ flex: 1 }}>
        <PosTag pos={player.position} />
      </span>
      <span style={{ flex: 3, fontSize: 11, fontWeight: 600, color: COLORS.light }}>
        {player.firstName} {player.lastName}
        {showTeam && <span style={{ marginLeft: 6, fontSize: 9, color: COLORS.muted, fontWeight: 400 }}>{player.teamId}</span>}
      </span>
      <span style={{ flex: 1, fontSize: 10, color: COLORS.muted }}>{player.overall}</span>
      <span style={{ flex: 1, fontSize: 9, color: COLORS.muted }}>Age {player.age}</span>
      <span style={{ flex: 1, display: "flex", justifyContent: "flex-end", gap: 6 }}>
        {isUserPlayer && onToggleBlock && (
          <button
            onClick={() => onToggleBlock(player.id)}
            title={isOnBlock ? "Remove from Trade Block" : "Add to Trade Block"}
            style={{
              fontSize: 9, padding: "6px", borderRadius: 3, border: "none", cursor: "pointer",
              background: isOnBlock ? COLORS.magenta : "rgba(255,255,255,0.05)",
              color: COLORS.light,
              display: "flex", alignItems: "center", justifyContent: "center",
              minWidth: "28px"
            }}
          >
            <Lock size={12} />
          </button>
        )}
        <button
          onClick={() => onToggle(player.id)}
          style={{
            fontSize: 9, padding: "6px 12px", borderRadius: 3, border: "none", cursor: "pointer",
            background: selected ? "rgba(215,241,113,0.15)" : "rgba(116,0,86,0.2)",
            color: selected ? COLORS.lime : COLORS.muted,
            fontWeight: 700,
            minHeight: "32px",
            minWidth: "48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {selected ? "Remove" : "Add"}
        </button>
      </span>
    </DataRow>
  );
}

function PickRow({
  pick, selected, onToggle
}: {
  pick: TeamDraftPick;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <DataRow hover even={false} key={pickId(pick)}>
      <span style={{ flex: 3, fontSize: 11, fontWeight: 600, color: pick.round === 1 ? COLORS.lime : COLORS.light }}>
        {pickLabel(pick)}
      </span>
      <span style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => onToggle(pickId(pick))}
          style={{
            fontSize: 9, padding: "6px 12px", borderRadius: 3, border: "none", cursor: "pointer",
            background: selected ? "rgba(215,241,113,0.15)" : "rgba(116,0,86,0.2)",
            color: selected ? COLORS.lime : COLORS.muted,
            fontWeight: 700,
            minHeight: "32px",
            minWidth: "48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {selected ? "Remove" : "Add"}
        </button>
      </span>
    </DataRow>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function TradeScreen({
  gsm,
  refresh,
}: {
  gsm: GameStateManager;
  refresh: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"propose" | "history">("propose");

  const [partnerTeamId, setPartnerTeamId] = useState("");
  const [offeringPlayerIds, setOfferingPlayerIds] = useState<Set<string>>(new Set());
  const [receivingPlayerIds, setReceivingPlayerIds] = useState<Set<string>>(new Set());
  const [offeringPickIds, setOfferingPickIds]     = useState<Set<string>>(new Set());
  const [receivingPickIds, setReceivingPickIds]   = useState<Set<string>>(new Set());
  const [evaluation, setEvaluation]               = useState<TradeEvaluation | null>(null);
  const [showConfirm, setShowConfirm]             = useState(false);
  const [userFilter, setUserFilter]               = useState("ALL");
  const [partnerFilter, setPartnerFilter]         = useState("ALL");

  // Pre-populate from AI-initiated offer (Negotiate flow)
  useEffect(() => {
    const pending = gsm.pendingAITradeOffer;
    if (!pending) return;
    setPartnerTeamId(pending.offeringTeamId);
    
    // Map AI offer (AI perspective) to Trade Screen state (User perspective)
    // AI Offering -> User Receiving
    // AI Receiving -> User Offering
    setReceivingPlayerIds(new Set(pending.offeringPlayerIds));
    setReceivingPickIds(new Set(pending.offeringPickIds));
    setOfferingPlayerIds(new Set(pending.receivingPlayerIds));
    setOfferingPickIds(new Set(pending.receivingPickIds));
    
    setActiveTab("propose");
    
    // Consume the pending offer so it doesn't persist on future visits
    gsm.pendingAITradeOffer = null;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const leagueBlockPlayers = !partnerTeamId 
    ? gsm.allPlayers.filter(p => gsm.leagueTradeBlock.has(p.id) && p.teamId !== gsm.userTeamId)
    : [];

  function handleLeagueBlockToggle(player: any) {
    if (!player.teamId) return;
    setPartnerTeamId(player.teamId);
    setReceivingPlayerIds(new Set([player.id]));
    setReceivingPickIds(new Set());
    setOfferingPlayerIds(new Set());
    setOfferingPickIds(new Set());
    setEvaluation(null);
  }

  const userTeamId = gsm.userTeamId ?? "";
  const sortedTeams = [...gsm.teams]
    .filter(t => t.id !== userTeamId)
    .sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));

  const userPlayers  = gsm.allPlayers.filter(p => p.teamId === userTeamId);
  const userPicks    = gsm.draftPicks.filter(p => p.currentTeamId === userTeamId);
  const partnerPlayers = partnerTeamId ? gsm.allPlayers.filter(p => p.teamId === partnerTeamId) : [];
  const partnerPicks   = partnerTeamId ? gsm.draftPicks.filter(p => p.currentTeamId === partnerTeamId) : [];

  const visibleUserPlayers = userFilter === "ALL" || userFilter === "Picks"
    ? userPlayers 
    : userPlayers.filter(p => p.position === userFilter);

  const visiblePartnerPlayers = partnerFilter === "ALL" || partnerFilter === "Picks" || partnerFilter === "Trade Block"
    ? (partnerFilter === "Trade Block" ? partnerPlayers.filter(p => gsm.leagueTradeBlock.has(p.id)) : partnerPlayers)
    : partnerPlayers.filter(p => p.position === partnerFilter);

  function toggle(set: Set<string>, setFn: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setFn(next);
    setEvaluation(null); // clear result on any change
  }

  const hasOffer = (offeringPlayerIds.size + offeringPickIds.size) > 0 ||
                   (receivingPlayerIds.size + receivingPickIds.size) > 0;
  const canSubmit = partnerTeamId && hasOffer;

  function handleSubmit() {
    if (!canSubmit) return;
    setShowConfirm(true);
  }

  function executeTradeProposal() {
    setShowConfirm(false);
    const payload: TradeOfferPayloadUI = {
      offeringTeamId:    userTeamId,
      receivingTeamId:   partnerTeamId,
      offeringPlayerIds: [...offeringPlayerIds],
      receivingPlayerIds:[...receivingPlayerIds],
      offeringPickIds:   [...offeringPickIds],
      receivingPickIds:  [...receivingPickIds],
    };
    const result = gsm.proposeTrade(payload);
    setEvaluation(result);
    if (result.accepted) {
      gsm.executeTrade(payload);
      // Clear state after successful trade
      setOfferingPlayerIds(new Set());
      setReceivingPlayerIds(new Set());
      setOfferingPickIds(new Set());
      setReceivingPickIds(new Set());
      refresh();
    }
  }

  function handleReviewCounter() {
    if (!evaluation?.counterOffer) return;
    const co = evaluation.counterOffer;
    // Load counter-offer assets into state for review/modification
    setOfferingPlayerIds(new Set(co.offeringPlayerIds));
    setReceivingPlayerIds(new Set(co.receivingPlayerIds));
    setOfferingPickIds(new Set(co.offeringPickIds));
    setReceivingPickIds(new Set(co.receivingPickIds));
    // Clear evaluation to allow user to review and re-propose
    setEvaluation(null);
  }

  function handleToggleBlock(playerId: string) {
    gsm.togglePlayerShoppingStatus(playerId);
    refresh();
  }

  const partnerTeam = partnerTeamId ? gsm.teams.find(t => t.id === partnerTeamId) : null;

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: COLORS.light, marginBottom: 12 }}>
        Trade Center
      </h2>

      {/* Partner selector */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.8 }}>
          Trade Partner
        </label>
        <select
          value={partnerTeamId}
          onChange={e => { 
            setPartnerTeamId(e.target.value); 
            setEvaluation(null); 
            setReceivingPlayerIds(new Set()); 
            setReceivingPickIds(new Set());
            setPartnerFilter("ALL");
          }}
          style={{
            display: "block", marginTop: 4, width: "100%", maxWidth: 280,
            background: "rgba(116,0,86,0.2)", color: COLORS.light,
            border: `1px solid ${COLORS.darkMagenta}`, borderRadius: 6,
            padding: "6px 10px", fontSize: 11,
          }}
        >
          <option value="">Select a team...</option>
          {sortedTeams.map(t => (
            <option key={t.id} value={t.id}>{t.abbreviation} — {t.city} {t.name}</option>
          ))}
        </select>
      </div>

      {/* 3-column asset grid — responsive: side-by-side on desktop, stacked on mobile */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 44px 1fr",
        gap: 10,
      }}
      className="trade-grid"
      >
        <style>{`
          @media (min-width: 768px) {
            .trade-sticky-footer {
              left: 240px !important;
            }
          }
          @media (max-width: 767px) {
            .trade-grid {
              grid-template-columns: 1fr !important;
              gap: 14px !important;
            }
            .trade-arrow {
              display: none !important;
            }
            .trade-sticky-footer {
              bottom: calc(65px + env(safe-area-inset-bottom)) !important;
              background: ${COLORS.bg} !important;
              border-top: 1px solid ${COLORS.darkMagenta} !important;
            }
            .trade-footer-content {
              flex-direction: column !important;
              gap: 12px !important;
              align-items: stretch !important;
            }
            .trade-buttons {
              width: 100% !important;
              gap: 8px !important;
            }
            .trade-buttons button {
              flex: 1 !important;
              padding: 12px 16px !important;
              font-size: 13px !important;
              min-height: 44px !important;
            }
            .trade-summary {
              flex-direction: column !important;
              gap: 8px !important;
              align-items: flex-start !important;
            }
            .trade-summary > div {
              font-size: 13px !important;
              color: ${COLORS.light} !important;
            }
            .trade-spacer {
              height: 220px !important;
            }
          }
        `}</style>

        {/* Your Assets */}
        <Section title="Your Assets" pad={false}>
          <div style={{ padding: "8px 12px", display: "flex", gap: 4, overflowX: "auto", borderBottom: `1px solid ${COLORS.darkMagenta}` }}>
            <Pill active={userFilter === "ALL"} onClick={() => setUserFilter("ALL")}>ALL</Pill>
            <Pill active={userFilter === "Picks"} onClick={() => setUserFilter("Picks")}>Picks</Pill>
            {POSITIONS.map(p => (
              <Pill key={p} active={userFilter === p} onClick={() => setUserFilter(p)}>{p}</Pill>
            ))}
          </div>

          {userFilter === "Picks" ? (
            <>
              <DataRow header>
                {["Pick", ""].map(h => (
                  <span key={h} style={{ flex: h === "Pick" ? 3 : 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700 }}>{h}</span>
                ))}
              </DataRow>
              <div style={{ height: 320, overflowY: "auto" }}>
                {userPicks.length === 0 ? (
                  <div style={{ padding: 12, fontSize: 11, color: COLORS.muted }}>No picks in your portfolio.</div>
                ) : (
                  userPicks.map(p => (
                    <PickRow
                      key={pickId(p)}
                      pick={p}
                      selected={offeringPickIds.has(pickId(p))}
                      onToggle={id => toggle(offeringPickIds, setOfferingPickIds, id)}
                    />
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <DataRow header>
                {["Pos", "Name", "OVR", "Age", ""].map(h => (
                  <span key={h} style={{ flex: h === "Name" ? 3 : 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700 }}>{h}</span>
                ))}
              </DataRow>
              <div style={{ height: 320, overflowY: "auto" }}>
                {userPlayers.length === 0 ? (
                  <div style={{ padding: 12, fontSize: 11, color: COLORS.muted }}>No players on your roster.</div>
                ) : visibleUserPlayers.length === 0 ? (
                  <div style={{ padding: 12, fontSize: 11, color: COLORS.muted }}>No players match filter.</div>
                ) : (
                  visibleUserPlayers.map((p, i) => (
                    <PlayerRow
                      key={`${p.id}-${i}`}
                      player={p}
                      selected={offeringPlayerIds.has(p.id)}
                      onToggle={id => toggle(offeringPlayerIds, setOfferingPlayerIds, id)}
                      onToggleBlock={handleToggleBlock}
                      isUserPlayer={true}
                    />
                  ))
                )}
              </div>
            </>
          )}

          {/* Selected summary */}
          {(offeringPlayerIds.size > 0 || offeringPickIds.size > 0) && (
            <div style={{ padding: "8px 12px", borderTop: `1px solid ${COLORS.darkMagenta}`, fontSize: 10, color: COLORS.lime }}>
              Offering: {offeringPlayerIds.size} player(s) + {offeringPickIds.size} pick(s)
            </div>
          )}
        </Section>

        {/* Center arrows — hidden on mobile */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }} className="trade-arrow">
          <ArrowLeftRight size={22} color={COLORS.magenta} />
        </div>

        {/* Partner Assets */}
        <Section 
          title={partnerTeam ? `${partnerTeam.abbreviation} Assets` : "Partner Assets"} 
          right={partnerTeam ? <span style={{ fontSize: 10, color: COLORS.lime }}>Cap: {fmtCurrency(partnerTeam.capSpace)}</span> : null}
          pad={false}
        >
          {!partnerTeamId ? (
            <div style={{ display: "flex", flexDirection: "column", height: 360 }}>
              <div style={{ padding: "8px 12px", borderBottom: `1px solid ${COLORS.darkMagenta}`, fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase" }}>
                League Trade Block
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {leagueBlockPlayers.length === 0 ? (
                  <div style={{ padding: 20, textAlign: "center", fontSize: 11, color: COLORS.muted }}>
                    No players currently on the block. Select a team above to browse rosters.
                  </div>
                ) : (
                  leagueBlockPlayers.map((p) => (
                    <PlayerRow
                      key={p.id}
                      player={p}
                      selected={false}
                      onToggle={() => handleLeagueBlockToggle(p)}
                      isUserPlayer={false}
                      showTeam={true}
                    />
                  ))
                )}
              </div>
            </div>
          ) : (
            <>
              <div style={{ padding: "8px 12px", display: "flex", gap: 4, overflowX: "auto", borderBottom: `1px solid ${COLORS.darkMagenta}` }}>
                <Pill active={partnerFilter === "ALL"} onClick={() => setPartnerFilter("ALL")}>ALL</Pill>
                <Pill active={partnerFilter === "Picks"} onClick={() => setPartnerFilter("Picks")}>Picks</Pill>
                <Pill active={partnerFilter === "Trade Block"} onClick={() => setPartnerFilter("Trade Block")}>Trade Block</Pill>
                {POSITIONS.map(p => (
                  <Pill key={p} active={partnerFilter === p} onClick={() => setPartnerFilter(p)}>{p}</Pill>
                ))}
              </div>
              {partnerFilter === "Picks" ? (
                <>
                  <DataRow header>
                    {["Pick", ""].map(h => (
                      <span key={h} style={{ flex: h === "Pick" ? 3 : 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700 }}>{h}</span>
                    ))}
                  </DataRow>
                  <div style={{ height: 320, overflowY: "auto" }}>
                    {partnerPicks.length === 0 ? (
                      <div style={{ padding: 12, fontSize: 11, color: COLORS.muted }}>No picks available from this team.</div>
                    ) : (
                      partnerPicks.map(p => (
                        <PickRow
                          key={pickId(p)}
                          pick={p}
                          selected={receivingPickIds.has(pickId(p))}
                          onToggle={id => toggle(receivingPickIds, setReceivingPickIds, id)}
                        />
                      ))
                    )}
                  </div>
                </>
              ) : (
                <>
                  <DataRow header>
                    {["Pos", "Name", "OVR", "Age", ""].map(h => (
                      <span key={h} style={{ flex: h === "Name" ? 3 : 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700 }}>{h}</span>
                    ))}
                  </DataRow>
                  <div style={{ height: 320, overflowY: "auto" }}>
                    {partnerPlayers.length === 0 ? (
                      <div style={{ padding: 12, fontSize: 11, color: COLORS.muted }}>No players found for this team.</div>
                    ) : visiblePartnerPlayers.length === 0 ? (
                      <div style={{ padding: 12, fontSize: 11, color: COLORS.muted }}>No players match filter.</div>
                    ) : (
                      visiblePartnerPlayers.map((p, i) => (
                        <PlayerRow
                          key={`${p.id}-${i}`}
                          player={p}
                          selected={receivingPlayerIds.has(p.id)}
                          onToggle={id => toggle(receivingPlayerIds, setReceivingPlayerIds, id)}
                        />
                      ))
                    )}
                  </div>
                </>
              )}
            </>
          )}

        </Section>
      </div>

      {/* Sticky Trade Summary Footer */}
      <div style={{
        marginTop: 20,
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: `linear-gradient(180deg, transparent, rgba(0,0,0,0.95))`,
        borderTop: `1px solid ${COLORS.darkMagenta}`,
        padding: "16px",
        paddingBottom: "12px",
      }} className="trade-sticky-footer">
        <div style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
          justifyContent: "space-between",
        }} className="trade-footer-content">
          {/* Trade Summary */}
          <div style={{ display: "flex", gap: 24, alignItems: "center" }} className="trade-summary">
            <div style={{ fontSize: 11, color: COLORS.muted }}>
              <span style={{ color: COLORS.lime, fontWeight: 700 }}>Your Offer:</span> {offeringPlayerIds.size} player(s), {offeringPickIds.size} pick(s)
            </div>
            <div style={{ fontSize: 11, color: COLORS.muted }}>
              <span style={{ color: COLORS.lime, fontWeight: 700 }}>Requesting:</span> {receivingPlayerIds.size} player(s), {receivingPickIds.size} pick(s)
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: 10 }} className="trade-buttons">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                padding: "8px 24px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                background: canSubmit
                  ? `linear-gradient(135deg, ${COLORS.magenta}, rgba(116,0,86,0.8))`
                  : "rgba(116,0,86,0.15)",
                border: `1px solid ${canSubmit ? COLORS.magenta : COLORS.darkMagenta}`,
                color: canSubmit ? COLORS.light : COLORS.muted,
                cursor: canSubmit ? "pointer" : "not-allowed",
                whiteSpace: "nowrap",
              }}
            >
              Propose Trade
            </button>
            {(offeringPlayerIds.size + offeringPickIds.size + receivingPlayerIds.size + receivingPickIds.size) > 0 && (
              <button
                onClick={() => {
                  setOfferingPlayerIds(new Set()); setReceivingPlayerIds(new Set());
                  setOfferingPickIds(new Set()); setReceivingPickIds(new Set());
                  setEvaluation(null);
                }}
                style={{
                  padding: "8px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: "transparent", border: `1px solid ${COLORS.darkMagenta}`,
                  color: COLORS.muted, cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Spacer to account for fixed footer */}
      <div style={{ height: 100 }} className="trade-spacer" />

      {/* Evaluation result — positioned before sticky footer to avoid overlap */}
      {evaluation && (
        <div style={{
          marginTop: 14, marginBottom: 120, padding: 16, borderRadius: 8,
          border: `1px solid ${fairnessColor(evaluation)}33`,
          background: `${fairnessColor(evaluation)}0a`,
        }}>
          {/* Status header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8,
              padding: "3px 8px", borderRadius: 4,
              background: `${fairnessColor(evaluation)}20`,
              color: fairnessColor(evaluation),
            }}>
              {evaluation.accepted ? "Accepted" : evaluation.errorState ?? (evaluation.counterOffer ? "Counter-Offer" : "Rejected")}
            </span>
            {!evaluation.errorState && isFinite(evaluation.fairnessScore) && (
              <span style={{ fontSize: 10, color: COLORS.muted }}>
                Fairness: {(evaluation.fairnessScore * 100).toFixed(0)}%
              </span>
            )}
          </div>

          {!evaluation.errorState && isFinite(evaluation.fairnessScore) && (
            <FairnessBar score={evaluation.fairnessScore} />
          )}

          {/* AI response text */}
          <p style={{ margin: "10px 0 0", fontSize: 12, color: COLORS.light, lineHeight: 1.5 }}>
            {evaluation.reason}
          </p>

          {/* Error detail */}
          {evaluation.errorState && (
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "#ff7070" }}>
              {evaluation.errorState === "DEADLINE_PASSED" && "The trade deadline (Week 39) has passed for this season."}
              {evaluation.errorState === "CAP_VIOLATION" && "This trade would put a team over the salary cap."}
              {evaluation.errorState === "ASSET_INVALID" && "One or more assets are no longer valid (check ownership)."}
            </p>
          )}

          {/* Counter-offer banner */}
          {evaluation.counterOffer && (
            <div style={{
              marginTop: 14, padding: 12, borderRadius: 6,
              background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.3)",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#f5a623", marginBottom: 6 }}>
                Counter-Offer Available
              </div>
              <p style={{ margin: "0 0 10px", fontSize: 11, color: COLORS.muted, lineHeight: 1.4 }}>
                We are close. Accept this counter-offer to finalize.
              </p>
              <button
                onClick={handleReviewCounter}
                style={{
                  padding: "6px 16px", borderRadius: 5, fontSize: 11, fontWeight: 700,
                  background: "rgba(245,166,35,0.2)", border: "1px solid rgba(245,166,35,0.5)",
                  color: "#f5a623", cursor: "pointer",
                }}
              >
                Review Counter-Offer
              </button>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 300,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div style={{
            background: COLORS.bg, border: `1px solid ${COLORS.darkMagenta}`,
            borderRadius: 12, padding: 24, maxWidth: 400, width: "100%",
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800, color: COLORS.light }}>
              Confirm Trade Proposal
            </h3>
            <p style={{ fontSize: 13, color: COLORS.muted, marginBottom: 24, lineHeight: 1.5 }}>
              Are you sure you want to submit this offer to the <strong>{partnerTeam?.city} {partnerTeam?.name}</strong>?
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  flex: 1, padding: "10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: "transparent", border: `1px solid ${COLORS.muted}`,
                  color: COLORS.muted, cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={executeTradeProposal}
                style={{
                  flex: 1, padding: "10px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                  background: COLORS.magenta, border: "none",
                  color: COLORS.light, cursor: "pointer",
                }}
              >
                Confirm Proposal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
