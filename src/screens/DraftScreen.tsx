import { COLORS } from "../ui/theme";
import { Section, RatingBadge, DataRow, PosTag, Pill } from "../ui/components";
import { useState, useEffect, useRef, useMemo } from "react";
import type { GameStateManager, DraftProspect } from "../types/GameStateManager";
import { Phone, User, Glasses, AlertOctagon, X, Check, Siren, Gavel, Star, ArrowUp, ArrowDown } from "lucide-react";
import { HardStopReason } from "../types/engine-types";
import { analyzeTeamNeeds } from "../types/DraftWeekSystem";

// ─── Draft pick computation from ledger ──────────────────────────────────────

interface DraftPick {
  year: number;
  round: number;
  originalTeam: string;
  isOwn: boolean;
  notes?: string;
}

const DRAFT_YEARS = [2026, 2027, 2028];
const TOTAL_ROUNDS = 7;
const ROUND_LABEL = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th"];

/** Compute which picks a given team currently owns after applying all trades. */
function computeTeamPicks(teamAbbr: string, gsm: GameStateManager): DraftPick[] {
  if (!teamAbbr) return [];

  return gsm.draftPicks.filter(p => p.currentTeamId === teamAbbr).map(p => ({
    year: p.year,
    round: p.round,
    originalTeam: p.originalTeamId,
    isOwn: p.originalTeamId === teamAbbr,
    notes: p.notes
  })).sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.round - b.round
  );
}

// ─── Fog-of-war OVR renderer (three tiers) ───────────────────────────────────

function renderOvr(p: DraftProspect): JSX.Element {
  if (p.scoutingPointsSpent >= 2) {
    // Fully revealed
    return <RatingBadge value={p.overall} size="sm" />;
  }
  if (p.scoutingPointsSpent === 1) {
    // Narrowed — tighter range in accent color
    return (
      <span style={{ fontSize: 10, color: COLORS.lime, fontWeight: 600 }}>
        {p.scoutingRange.min}–{p.scoutingRange.max}
      </span>
    );
  }
  // Full fog — wide range, muted italic
  return (
    <span style={{ fontSize: 9, color: COLORS.muted, fontStyle: "italic" }}>
      {p.scoutingRange.min}–{p.scoutingRange.max}
    </span>
  );
}

// ─── Overlays ─────────────────────────────────────────────────────────────────

function AdvisorDebateOverlay({ prospects, needs, onDismiss }: { prospects: DraftProspect[], needs: string[], onDismiss: () => void }) {
  const [data, setData] = useState<{ scout: { p: DraftProspect, r: string }, coach: { p: DraftProspect, r: string } } | null>(null);

  useEffect(() => {
    // 1. Scout Pick: Best Player Available (highest overall)
    const sortedByOvr = [...prospects].sort((a, b) => b.overall - a.overall);
    const scoutPick = sortedByOvr[0];

    // 2. Coach Pick: Highest OVR at a position of need
    // Search top 15 prospects for a need match
    const coachPickCandidate = sortedByOvr.slice(0, 15).find(p => needs.includes(p.position));
    
    // Fallback if no need found or if it's the same player (force variety if possible)
    let coachPick = coachPickCandidate || sortedByOvr[1] || sortedByOvr[0];
    
    // If they picked the same player, try to find a different need player to create debate
    if (coachPick.id === scoutPick.id) {
        const altCoachPick = sortedByOvr.slice(0, 15).find(p => needs.includes(p.position) && p.id !== scoutPick.id);
        if (altCoachPick) {
            coachPick = altCoachPick;
        } else if (sortedByOvr[1]) {
            coachPick = sortedByOvr[1];
        }
    }

    // 3. Dynamic Reasoning
    const getScoutReason = (p: DraftProspect) => {
        const reasons = [
            `The analytics are clear. ${p.name} has the highest production grade in the class.`,
            `Don't overthink it. He's the best athlete on the board regardless of position.`,
            `Value is king. Getting a talent like ${p.lastName} here is a steal.`,
            `His ceiling is Hall of Fame. We can figure out the roster fit later.`,
            `Trust the board. He's the #1 player available.`
        ];
        return reasons[Math.floor(Math.random() * reasons.length)];
    };

    const getCoachReason = (p: DraftProspect, isNeed: boolean) => {
        if (isNeed) {
            return [
                `We have a gaping hole at ${p.position}. ${p.lastName} plugs it on Day 1.`,
                `I need someone who can contribute now. ${p.name} is ready to play.`,
                `Forget "value", we need a ${p.position} to compete. Draft him.`,
                `He fits our scheme perfectly. I can build a gameplan around him.`,
                `My unit needs a ${p.position} like him. Don't get cute with a project.`
            ][Math.floor(Math.random() * 5)];
        } else {
            return [
                `He's just a football player. Put him on the field and he makes plays.`,
                `I like his grit. He plays the game the right way.`,
                `He's a locker room leader. We need that kind of culture.`,
                `Look at the tape. He dominates his competition.`
            ][Math.floor(Math.random() * 4)];
        }
    };

    setData({
      scout: { p: scoutPick, r: getScoutReason(scoutPick) },
      coach: { p: coachPick, r: getCoachReason(coachPick, needs.includes(coachPick.position)) }
    });
  }, []); // Run once on mount

  if (!data) return null;
  const { scout, coach } = data;

  return (
    <div style={{
      position: "fixed", bottom: 20, left: 20, right: 20, height: 220,
      background: "rgba(10, 5, 10, 0.95)", border: `1px solid ${COLORS.darkMagenta}`,
      borderRadius: 12, display: "flex", overflow: "hidden", zIndex: 100,
      boxShadow: "0 -10px 40px rgba(0,0,0,0.8)", animation: "slideUp 0.3s ease-out"
    }}>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
      
      {/* Scout Side */}
      <div style={{ flex: 1, borderRight: `1px solid ${COLORS.darkMagenta}`, padding: 20, position: "relative" }}>
        <div style={{ position: "absolute", top: 10, left: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <Glasses size={16} color={COLORS.sky} />
          <span style={{ fontSize: 10, fontWeight: 800, color: COLORS.sky, textTransform: "uppercase" }}>Head Scout</span>
        </div>
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.light }}>{scout.p.name}</div>
          <div style={{ display: "flex", gap: 8, margin: "4px 0 12px" }}>
            <PosTag pos={scout.p.position} />
            <span style={{ fontSize: 12, color: COLORS.muted }}>{scout.p.college}</span>
          </div>
          <p style={{ fontSize: 12, color: COLORS.light, lineHeight: 1.4, fontStyle: "italic" }}>
            "{scout.r}"
          </p>
        </div>
      </div>

      {/* Coach Side */}
      <div style={{ flex: 1, padding: 20, position: "relative", background: "rgba(255,255,255,0.02)" }}>
        <div style={{ position: "absolute", top: 10, right: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: COLORS.gold, textTransform: "uppercase" }}>Head Coach</span>
          <User size={16} color={COLORS.gold} />
        </div>
        <div style={{ marginTop: 20, textAlign: "right" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.light }}>{coach.p.name}</div>
          <div style={{ display: "flex", gap: 8, margin: "4px 0 12px", justifyContent: "flex-end" }}>
            <span style={{ fontSize: 12, color: COLORS.muted }}>{coach.p.college}</span>
            <PosTag pos={coach.p.position} />
          </div>
          <p style={{ fontSize: 12, color: COLORS.light, lineHeight: 1.4, fontStyle: "italic" }}>
            "{coach.r}"
          </p>
        </div>
      </div>

      <button 
        onClick={onDismiss}
        style={{
          position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.5)", border: "none", color: COLORS.muted,
          borderRadius: "50%", width: 24, height: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

function SnipeAlertOverlay({ player, onDismiss }: { player: DraftProspect, onDismiss: () => void }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(60, 0, 0, 0.85)", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", animation: "flashRed 0.5s"
    }}>
      <style>{`@keyframes flashRed { 0% { background: rgba(255,0,0,0.5); } 100% { background: rgba(60,0,0,0.85); } }`}</style>
      
      <Siren size={64} color={COLORS.coral} style={{ marginBottom: 20 }} />
      <h1 style={{ fontSize: 48, fontWeight: 900, color: COLORS.light, margin: 0, textTransform: "uppercase", letterSpacing: 2 }}>
        Target Sniped!
      </h1>
      <div style={{ fontSize: 24, color: COLORS.coral, marginTop: 10, fontWeight: 600 }}>
        {player.name} taken just before your pick.
      </div>
      
      <div style={{ marginTop: 40, padding: "16px 32px", background: "rgba(0,0,0,0.5)", borderRadius: 8, border: `1px solid ${COLORS.coral}` }}>
        <div style={{ fontSize: 12, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, textAlign: "center" }}>
          War Room Status
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.light, display: "flex", alignItems: "center", gap: 10 }}>
          <AlertOctagon size={20} color={COLORS.gold} /> SCRAMBLE MODE ACTIVATED
        </div>
      </div>

      <button 
        onClick={onDismiss}
        style={{
          marginTop: 40, background: "transparent", border: `1px solid ${COLORS.light}`,
          color: COLORS.light, padding: "12px 32px", borderRadius: 30,
          fontSize: 14, fontWeight: 700, cursor: "pointer", textTransform: "uppercase"
        }}
      >
        Regroup & Return to Board
      </button>
    </div>
  );
}

function PhoneCallOverlay({ offer, onAccept, onDecline, onNegotiate }: { offer: any, onAccept: () => void, onDecline: () => void, onNegotiate: () => void }) {
  return (
    <div style={{
      position: "fixed", bottom: 20, right: 20, width: 320,
      background: "linear-gradient(135deg, #1a1a1a, #2a2a2a)",
      border: `1px solid ${COLORS.lime}`, borderRadius: 16,
      boxShadow: "0 10px 30px rgba(0,0,0,0.5)", overflow: "hidden", zIndex: 150,
      animation: "ring 1s infinite"
    }}>
      <style>{`@keyframes ring { 0% { box-shadow: 0 0 0 0 rgba(215, 241, 113, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(215, 241, 113, 0); } 100% { box-shadow: 0 0 0 0 rgba(215, 241, 113, 0); } }`}</style>
      
      <div style={{ padding: 20, textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ width: 60, height: 60, background: COLORS.lime, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
          <Phone size={32} color={COLORS.bg} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.light }}>Incoming Trade</div>
        <div style={{ fontSize: 12, color: COLORS.lime, fontWeight: 600, marginTop: 4 }}>
          {offer.description || "Trade Offer"}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 12, textAlign: "center" }}>
          The other GM is on the line waiting for an answer.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button onClick={onAccept} style={{
            background: COLORS.lime, border: "none", borderRadius: 8, padding: 12,
            color: COLORS.bg, fontWeight: 800, fontSize: 12, cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4
          }}>
            <Check size={16} /> Accept
          </button>
          <button onClick={onDecline} style={{
            background: COLORS.coral, border: "none", borderRadius: 8, padding: 12,
            color: COLORS.bg, fontWeight: 800, fontSize: 12, cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4
          }}>
            <X size={16} /> Decline
          </button>
        </div>
        <button onClick={onNegotiate} style={{
          width: "100%", marginTop: 8, background: "rgba(255,255,255,0.1)",
          border: "none", borderRadius: 8, padding: 10,
          color: COLORS.light, fontWeight: 600, fontSize: 11, cursor: "pointer"
        }}>
          Negotiate / Counter
        </button>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DraftScreen({
  userTeamAbbr,
  gsm,
  refresh,
}: {
  userTeamAbbr: string;
  gsm: GameStateManager;
  refresh: () => void;
}) {
  const [tab, setTab] = useState("board");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [targetedPlayers, setTargetedPlayers] = useState<Set<string>>(new Set());
  const [showSnipeAlert, setShowSnipeAlert] = useState<DraftProspect | null>(null);
  const [showAdvisor, setShowAdvisor] = useState(false);
  const lastPickRef = useRef<number>(0);

  const myPicks = computeTeamPicks(userTeamAbbr, gsm);
  const byYear  = DRAFT_YEARS.map(yr => ({
    year: yr,
    picks: myPicks.filter(p => p.year === yr),
  }));

  const prospects = gsm.draftProspects;
  const scoutPtsLeft = gsm.scoutingPointsAvailable;

  const sortedProspects = useMemo(() => {
    if (!sortConfig) return prospects;
    return [...prospects].sort((a, b) => {
      let aVal: any = 0;
      let bVal: any = 0;

      switch (sortConfig.key) {
        case "#":
          aVal = prospects.indexOf(a);
          bVal = prospects.indexOf(b);
          break;
        case "Name":
          aVal = a.name;
          bVal = b.name;
          break;
        case "Pos":
          aVal = a.position;
          bVal = b.position;
          break;
        case "College":
          aVal = a.college;
          bVal = b.college;
          break;
        case "OVR":
          // Sort by visible range center
          aVal = (a.scoutingRange.min + a.scoutingRange.max) / 2;
          bVal = (b.scoutingRange.min + b.scoutingRange.max) / 2;
          break;
        case "Proj":
          aVal = a.projectedRound;
          bVal = b.projectedRound;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [prospects, sortConfig, prospects.length, scoutPtsLeft]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Check for Snipes & Advisor Trigger
  useEffect(() => {
    // 1. Snipe Detection
    if (gsm.draftEngine && gsm.draftEngine.pickResults.length > lastPickRef.current) {
      const lastResult = gsm.draftEngine.pickResults[gsm.draftEngine.pickResults.length - 1];
      lastPickRef.current = gsm.draftEngine.pickResults.length;

      // If a targeted player was picked by someone else
      if (targetedPlayers.has(lastResult.playerId) && lastResult.teamId !== userTeamAbbr) {
        const player = gsm.allPlayers.find(p => p.id === lastResult.playerId);
        if (player) {
          // We need to reconstruct a DraftProspect-like object for the alert since it's gone from prospects
          const prospect: any = { ...player, name: `${player.firstName} ${player.lastName}` };
          setShowSnipeAlert(prospect);
          // Remove from targets
          const next = new Set(targetedPlayers);
          next.delete(lastResult.playerId);
          setTargetedPlayers(next);
        }
      }
    }

    // 2. Advisor Trigger (On The Clock)
    const currentPickTeam = gsm.draftOrder[gsm.currentDraftPick - 1];
    if (gsm.isDraftActive && currentPickTeam === userTeamAbbr && !showAdvisor) {
      setShowAdvisor(true);
    } else if (currentPickTeam !== userTeamAbbr) {
      setShowAdvisor(false);
    }
  }, [gsm.currentDraftPick, gsm.draftEngine?.pickResults.length, targetedPlayers, userTeamAbbr, gsm.isDraftActive, gsm.draftOrder, showAdvisor, gsm.allPlayers, gsm.draftEngine]);

  function handleScout(prospectId: string) {
    gsm.spendScoutingPoints(prospectId, 1);
    refresh();
  }

  function toggleTarget(id: string) {
    const next = new Set(targetedPlayers);
    if (next.has(id)) next.delete(id); else next.add(id);
    setTargetedPlayers(next);
  }

  // Intercept Trade Offers
  const activeTradeInterrupt = gsm.activeInterrupt?.reason === HardStopReason.TRADE_OFFER_RECEIVED 
    ? gsm.activeInterrupt 
    : null;
  
  // Dynamic team needs
  const teamNeeds = useMemo(() => {
    const userTeam = gsm.teams.find(t => t.id === userTeamAbbr);
    return userTeam ? analyzeTeamNeeds(userTeam, gsm.allPlayers) : ["QB", "OL", "CB"];
  }, [userTeamAbbr, gsm.allPlayers, gsm.teams]);

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: COLORS.light, marginBottom: 8 }}>
        {gsm.currentGameDate.season} NFL Draft
      </h2>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <Pill active={tab === "board"}  onClick={() => setTab("board")}>Big Board</Pill>
        <Pill active={tab === "picks"}  onClick={() => setTab("picks")}>My Picks</Pill>
        <Pill active={tab === "needs"}  onClick={() => setTab("needs")}>Team Needs</Pill>
      </div>

      {tab === "board" && (
        <Section title={`Prospect Board — Scout Pts: ${scoutPtsLeft}`} pad={false}>
          {prospects.length === 0 ? (
            <div style={{ padding: "14px", fontSize: 11, color: COLORS.muted }}>
              Draft class generates when you enter Draft Prep phase.
            </div>
          ) : (
            <>
              <DataRow header>
                {["#", "Name", "Pos", "College", "OVR", "Proj", "Target", "Scout"].map(h => {
                  const isSortable = ["#", "Name", "Pos", "College", "OVR", "Proj"].includes(h);
                  return (
                    <span 
                      key={h} 
                      onClick={() => isSortable && requestSort(h)}
                      style={{ 
                        fontSize: 8, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700, 
                        flex: h === "Name" ? 2 : 1,
                        cursor: isSortable ? "pointer" : "default",
                        display: "flex", alignItems: "center", gap: 4,
                        userSelect: "none"
                      }}
                    >
                      {h}
                      {sortConfig?.key === h && (
                        sortConfig.direction === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                      )}
                    </span>
                  );
                })}
              </DataRow>
              {sortedProspects.map((p, i) => {
                const canScout = scoutPtsLeft >= 1 && p.scoutingPointsSpent < 2;
                const isTarget = targetedPlayers.has(p.id);
                const rank = prospects.indexOf(p) + 1;
                return (
                  <DataRow key={p.id} even={i % 2 === 0} hover>
                    <span style={{ flex: 1, fontSize: 10, fontFamily: "monospace", color: COLORS.muted }}>{rank}</span>
                    <span style={{ flex: 2, fontSize: 11, fontWeight: 600, color: COLORS.light }}>{p.name}</span>
                    <span style={{ flex: 1 }}><PosTag pos={p.position} /></span>
                    <span style={{ flex: 1.5, fontSize: 10, color: COLORS.muted }}>{p.college}</span>
                    <span style={{ flex: 1 }}>{renderOvr(p)}</span>
                    <span style={{ flex: 1, fontSize: 10, color: COLORS.muted }}>Rd {p.projectedRound === 8 ? "UDFA" : p.projectedRound}</span>
                    <span style={{ flex: 1 }}>
                      <button 
                        onClick={() => toggleTarget(p.id)}
                        style={{ 
                          background: "transparent", border: "none", cursor: "pointer",
                          color: isTarget ? COLORS.gold : "rgba(255,255,255,0.1)"
                        }}
                      >
                        <Star size={14} fill={isTarget ? COLORS.gold : "none"} />
                      </button>
                    </span>
                    <span style={{ flex: 1 }}>
                      <button
                        onClick={() => canScout && handleScout(p.id)}
                        disabled={!canScout}
                        style={{
                          fontSize: 9,
                          padding: "2px 6px",
                          borderRadius: 3,
                          border: "none",
                          cursor: canScout ? "pointer" : "default",
                          background: canScout ? "rgba(215,241,113,0.15)" : "transparent",
                          color: canScout ? COLORS.lime : COLORS.muted,
                          fontWeight: 600,
                        }}
                      >
                        {p.scoutingPointsSpent >= 2 ? "Done" : "Scout"}
                      </button>
                    </span>
                  </DataRow>
                );
              })}
            </>
          )}
        </Section>
      )}

      {tab === "picks" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {byYear.map(({ year, picks }) => (
            <Section key={year} title={`${year} Draft Picks (${picks.length})`} pad={false}>
              {picks.length === 0 ? (
                <div style={{ padding: "14px", fontSize: 11, color: COLORS.muted }}>No picks in {year}.</div>
              ) : (
                <>
                  <DataRow header>
                    {["Round", "From", "Via Trade", "Notes"].map(h =>
                      <span key={h} style={{ flex: h === "Notes" ? 3 : 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.8 }}>{h}</span>
                    )}
                  </DataRow>
                  {picks.map((pick, i) => (
                    <DataRow key={`${pick.year}-${pick.round}-${pick.originalTeam}`} even={i % 2 === 0}>
                      <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: pick.round === 1 ? COLORS.lime : COLORS.light }}>
                        {ROUND_LABEL[pick.round]}
                      </span>
                      <span style={{ flex: 1, fontSize: 10, color: COLORS.muted, fontFamily: "monospace" }}>
                        {pick.originalTeam}
                      </span>
                      <span style={{ flex: 1 }}>
                        {!pick.isOwn ? (
                          <span style={{ fontSize: 9, color: COLORS.lime, background: "rgba(215,241,113,0.1)", padding: "2px 6px", borderRadius: 3, fontWeight: 600 }}>
                            Acquired
                          </span>
                        ) : (
                          <span style={{ fontSize: 9, color: COLORS.muted }}>Own</span>
                        )}
                      </span>
                      <span style={{ flex: 3, fontSize: 9, color: COLORS.muted, lineHeight: 1.3 }}>
                        {pick.notes || "—"}
                      </span>
                    </DataRow>
                  ))}
                </>
              )}
            </Section>
          ))}

          {myPicks.length === 0 && (
            <div style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", padding: "40px 0" }}>
              {userTeamAbbr ? `No pick data found for ${userTeamAbbr}.` : "No team selected."}
            </div>
          )}
        </div>
      )}

      {tab === "needs" && (
        <Section title="Team Needs">
          <div style={{ fontSize: 12, color: COLORS.muted, padding: "12px 0" }}>
            Team needs analysis coming soon.
          </div>
        </Section>
      )}

      {/* ── Overlays ── */}

      {showAdvisor && (
        <AdvisorDebateOverlay 
          prospects={prospects.slice(0, 50)} 
          needs={teamNeeds} 
          onDismiss={() => setShowAdvisor(false)} 
        />
      )}

      {showSnipeAlert && (
        <SnipeAlertOverlay 
          player={showSnipeAlert} 
          onDismiss={() => setShowSnipeAlert(null)} 
        />
      )}

      {activeTradeInterrupt && (
        <PhoneCallOverlay 
          offer={activeTradeInterrupt.payload}
          onAccept={() => { gsm.resolveEngineInterrupt({ reason: HardStopReason.TRADE_OFFER_RECEIVED, accepted: true }); refresh(); }}
          onDecline={() => { gsm.resolveEngineInterrupt({ reason: HardStopReason.TRADE_OFFER_RECEIVED, accepted: false }); refresh(); }}
          onNegotiate={() => { gsm.resolveEngineInterrupt({ reason: HardStopReason.TRADE_OFFER_RECEIVED, navigate: true }); refresh(); }}
        />
      )}
    </div>
  );
}
