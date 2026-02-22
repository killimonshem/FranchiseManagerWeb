import { COLORS } from "../ui/theme";
import { Section, DataRow, PosTag, Pill } from "../ui/components";
import { ArrowLeftRight } from "lucide-react";
import { useState, useEffect } from "react";
import type { GameStateManager, TeamDraftPick } from "../types/GameStateManager";
import type { TradeOfferPayloadUI, TradeEvaluation } from "../systems/TradeSystem";

// ─── Component ────────────────────────────────────────────────────────────────

const ROUND_LABEL = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th"];

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
  player, selected, onToggle
}: {
  player: { id: string; firstName: string; lastName: string; overall: number; position: any; age: number };
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <DataRow hover even={false} key={player.id}>
      <span style={{ flex: 1 }}>
        <PosTag pos={player.position} />
      </span>
      <span style={{ flex: 3, fontSize: 11, fontWeight: 600, color: COLORS.light }}>
        {player.firstName} {player.lastName}
      </span>
      <span style={{ flex: 1, fontSize: 10, color: COLORS.muted }}>{player.overall}</span>
      <span style={{ flex: 1, fontSize: 9, color: COLORS.muted }}>Age {player.age}</span>
      <span style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
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
  const [partnerTeamId, setPartnerTeamId] = useState("");
  const [offeringPlayerIds, setOfferingPlayerIds] = useState<Set<string>>(new Set());
  const [receivingPlayerIds, setReceivingPlayerIds] = useState<Set<string>>(new Set());
  const [offeringPickIds, setOfferingPickIds]     = useState<Set<string>>(new Set());
  const [receivingPickIds, setReceivingPickIds]   = useState<Set<string>>(new Set());
  const [evaluation, setEvaluation]               = useState<TradeEvaluation | null>(null);
  const [activeTab, setActiveTab]                 = useState<"players" | "picks">("players");

  // Pre-populate from AI-initiated offer (Negotiate flow)
  useEffect(() => {
    const pending = gsm.pendingAITradeOffer;
    if (!pending) return;
    setPartnerTeamId(pending.offeringTeamId);
    // AI's offer: they want your players, they offer their picks
    setReceivingPlayerIds(new Set(pending.receivingPlayerIds));
    setReceivingPickIds(new Set(pending.offeringPickIds));
    setOfferingPickIds(new Set());
    setOfferingPlayerIds(new Set());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const userTeamId = gsm.userTeamId ?? "";
  const sortedTeams = [...gsm.teams]
    .filter(t => t.id !== userTeamId)
    .sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));

  const userPlayers  = gsm.allPlayers.filter(p => p.teamId === userTeamId);
  const userPicks    = gsm.draftPicks.filter(p => p.currentTeamId === userTeamId);
  const partnerPlayers = partnerTeamId ? gsm.allPlayers.filter(p => p.teamId === partnerTeamId) : [];
  const partnerPicks   = partnerTeamId ? gsm.draftPicks.filter(p => p.currentTeamId === partnerTeamId) : [];

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

  function handleAcceptCounter() {
    if (!evaluation?.counterOffer) return;
    gsm.executeTrade(evaluation.counterOffer);
    setEvaluation(null);
    setOfferingPlayerIds(new Set());
    setReceivingPlayerIds(new Set());
    setOfferingPickIds(new Set());
    setReceivingPickIds(new Set());
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
          onChange={e => { setPartnerTeamId(e.target.value); setEvaluation(null); setReceivingPlayerIds(new Set()); setReceivingPickIds(new Set()); }}
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

      {/* Sub-tab for players / picks */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <Pill active={activeTab === "players"} onClick={() => setActiveTab("players")}>Players</Pill>
        <Pill active={activeTab === "picks"}   onClick={() => setActiveTab("picks")}>Draft Picks</Pill>
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
          {activeTab === "players" ? (
            <>
              <DataRow header>
                {["Pos", "Name", "OVR", "Age", ""].map(h => (
                  <span key={h} style={{ flex: h === "Name" ? 3 : 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700 }}>{h}</span>
                ))}
              </DataRow>
              {userPlayers.length === 0 ? (
                <div style={{ padding: 12, fontSize: 11, color: COLORS.muted }}>No players on your roster.</div>
              ) : (
                userPlayers.map(p => (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    selected={offeringPlayerIds.has(p.id)}
                    onToggle={id => toggle(offeringPlayerIds, setOfferingPlayerIds, id)}
                  />
                ))
              )}
            </>
          ) : (
            <>
              <DataRow header>
                {["Pick", ""].map(h => (
                  <span key={h} style={{ flex: h === "Pick" ? 3 : 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700 }}>{h}</span>
                ))}
              </DataRow>
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
        <Section title={partnerTeam ? `${partnerTeam.abbreviation} Assets` : "Partner Assets"} pad={false}>
          {!partnerTeamId ? (
            <div style={{ padding: 20, textAlign: "center", fontSize: 11, color: COLORS.muted }}>
              Select a team to see their assets.
            </div>
          ) : activeTab === "players" ? (
            <>
              <DataRow header>
                {["Pos", "Name", "OVR", "Age", ""].map(h => (
                  <span key={h} style={{ flex: h === "Name" ? 3 : 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700 }}>{h}</span>
                ))}
              </DataRow>
              {partnerPlayers.length === 0 ? (
                <div style={{ padding: 12, fontSize: 11, color: COLORS.muted }}>No players found for this team.</div>
              ) : (
                partnerPlayers.map(p => (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    selected={receivingPlayerIds.has(p.id)}
                    onToggle={id => toggle(receivingPlayerIds, setReceivingPlayerIds, id)}
                  />
                ))
              )}
            </>
          ) : (
            <>
              <DataRow header>
                {["Pick", ""].map(h => (
                  <span key={h} style={{ flex: h === "Pick" ? 3 : 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700 }}>{h}</span>
                ))}
              </DataRow>
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
            </>
          )}

          {(receivingPlayerIds.size > 0 || receivingPickIds.size > 0) && (
            <div style={{ padding: "8px 12px", borderTop: `1px solid ${COLORS.darkMagenta}`, fontSize: 10, color: COLORS.lime }}>
              Requesting: {receivingPlayerIds.size} player(s) + {receivingPickIds.size} pick(s)
            </div>
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
                Clear
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
                We're close. Accept our revised package to finalize the deal.
              </p>
              <button
                onClick={handleAcceptCounter}
                style={{
                  padding: "6px 16px", borderRadius: 5, fontSize: 11, fontWeight: 700,
                  background: "rgba(245,166,35,0.2)", border: "1px solid rgba(245,166,35,0.5)",
                  color: "#f5a623", cursor: "pointer",
                }}
              >
                Accept Counter-Offer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
