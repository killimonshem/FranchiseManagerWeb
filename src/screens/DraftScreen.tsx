import React from "react";
import { COLORS } from "../ui/theme";
import { Section, RatingBadge, DataRow, PosTag, Pill, StatBar } from "../ui/components";
import { useState, useEffect, useRef, useMemo } from "react";
import type { GameStateManager, DraftProspect } from "../types/GameStateManager";
import { Phone, User, Glasses, AlertOctagon, X, Check, Siren, Gavel, Star, ArrowUp, ArrowDown, FastForward, Clock } from "lucide-react";
import { DraftClock } from "../ui/DraftClock";
import { DraftRoundRecapModal } from "../ui/DraftRoundRecapModal";
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

function renderOvr(p: DraftProspect) {
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
    <div className="advisor-overlay-wrapper" style={{
      background: "rgba(10, 5, 10, 0.95)", border: `1px solid ${COLORS.darkMagenta}`,
      borderRadius: 12, display: "flex", overflow: "hidden", zIndex: 100,
      boxShadow: "0 -10px 40px rgba(0,0,0,0.8)", animation: "slideUp 0.3s ease-out"
    }}>
      {/* Scout Side */}
      <div className="advisor-left-panel" style={{ borderRight: `1px solid ${COLORS.darkMagenta}`, padding: 20, position: "relative" }}>
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
    <div className="phone-call-overlay" style={{
      background: "linear-gradient(135deg, #1a1a1a, #2a2a2a)",
      border: `1px solid ${COLORS.lime}`, borderRadius: 16,
      boxShadow: "0 10px 30px rgba(0,0,0,0.5)", overflow: "hidden",
      animation: "ring 1s infinite"
    }}>
      
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

function TradeUpOverlay({ offer, onAccept, onCancel }: { offer: any, onAccept: () => void, onCancel: () => void }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px"
    }}>
      <div className="trade-up-modal" style={{
        background: COLORS.bg, border: `1px solid ${COLORS.lime}`, borderRadius: 12, padding: 24,
        boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
      }}>
        <h3 style={{ margin: "0 0 16px", color: COLORS.light }}>Trade Up Opportunity</h3>
        <div style={{ marginBottom: 20, fontSize: 13, color: COLORS.muted }}>
          <strong style={{ color: COLORS.light }}>{offer.targetTeamId}</strong> is willing to trade the <strong style={{ color: COLORS.lime }}>Round {offer.targetRound}, Pick {offer.targetPick}</strong>.
        </div>
        
        <div style={{ background: "rgba(255,255,255,0.05)", padding: 12, borderRadius: 8, marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", marginBottom: 8 }}>They Want</div>
          {offer.myPicks.map((p: any) => (
            <div key={`${p.year}-${p.round}-${p.originalTeamId}`} style={{ fontSize: 13, color: COLORS.light, marginBottom: 4 }}>
              {p.year} Round {p.round} <span style={{ color: COLORS.muted }}>(Pick {p.overallPick || "?"})</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onAccept} style={{
            flex: 1, padding: 12, background: COLORS.lime, color: COLORS.bg, border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer"
          }}>
            Accept Trade
          </button>
          <button onClick={onCancel} style={{
            flex: 1, padding: 12, background: "transparent", color: COLORS.muted, border: `1px solid ${COLORS.muted}`, borderRadius: 6, fontWeight: 600, cursor: "pointer"
          }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ScoutingReportModal({ prospect, onClose, onScout, scoutPts, isOnClock, onDraft }: { prospect: DraftProspect, onClose: () => void, onScout: () => void, scoutPts: number, isOnClock?: boolean, onDraft?: () => void }) {
  const isFullyRevealed = prospect.scoutingPointsSpent >= 2;
  
  // Mock attributes for display since they aren't fully modeled in the draft class yet
  const mockAttrs = useMemo(() => {
    return [
      { label: "Athleticism", value: 70 + Math.floor(Math.random() * 25) },
      { label: "Technique", value: 60 + Math.floor(Math.random() * 30) },
      { label: "Football IQ", value: 65 + Math.floor(Math.random() * 25) },
      { label: "Durability", value: prospect.medicalGrade === 'A' ? 90 : prospect.medicalGrade === 'B' ? 80 : 60 },
    ];
  }, [prospect.id]);

  const personality = useMemo(() => {
     const traits = ["Leader", "High Motor", "Team First", "Competitor", "Disciplined", "Raw Talent"];
     // Simple hash to keep traits consistent for the same prospect
     const idx = prospect.id.charCodeAt(0) % traits.length;
     return [traits[idx], traits[(idx + 2) % traits.length]];
  }, [prospect.id]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center",
      animation: "fadeIn 0.2s"
    }} onClick={onClose}>
      <div style={{
        background: COLORS.bg, border: `1px solid ${COLORS.darkMagenta}`, borderRadius: 12,
        width: 500, maxWidth: "90%", maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 20px 50px rgba(0,0,0,0.5)", position: "relative"
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ padding: 20, borderBottom: `1px solid ${COLORS.darkMagenta}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.light, marginBottom: 4 }}>{prospect.name}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <PosTag pos={prospect.position} />
              <span style={{ fontSize: 12, color: COLORS.muted }}>{prospect.college}</span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
             <div style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", marginBottom: 2 }}>Scouting Grade</div>
             {renderOvr(prospect)}
          </div>
        </div>

        <div className="scout-modal-grid" style={{ padding: 20 }}>
          {/* Physicals */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.lime, textTransform: "uppercase", marginBottom: 8 }}>Physical Profile</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
               <div style={{ background: "rgba(255,255,255,0.05)", padding: 8, borderRadius: 6 }}>
                 <div style={{ fontSize: 9, color: COLORS.muted }}>Height</div>
                 <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.light }}>{prospect.height ? `${Math.floor(prospect.height/12)}'${prospect.height%12}"` : "N/A"}</div>
               </div>
               <div style={{ background: "rgba(255,255,255,0.05)", padding: 8, borderRadius: 6 }}>
                 <div style={{ fontSize: 9, color: COLORS.muted }}>Weight</div>
                 <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.light }}>{prospect.weight ? `${prospect.weight} lbs` : "N/A"}</div>
               </div>
            </div>
            
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.lime, textTransform: "uppercase", marginBottom: 8 }}>Combine Data</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
               <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                 <span style={{ color: COLORS.muted }}>40 Yard Dash</span>
                 <span style={{ color: COLORS.light, fontFamily: "monospace" }}>{prospect.fortyYardDash?.toFixed(2) || "-"}</span>
               </div>
               <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                 <span style={{ color: COLORS.muted }}>Bench Press</span>
                 <span style={{ color: COLORS.light, fontFamily: "monospace" }}>{prospect.benchPress || "-"} reps</span>
               </div>
               <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                 <span style={{ color: COLORS.muted }}>Vertical</span>
                 <span style={{ color: COLORS.light, fontFamily: "monospace" }}>{prospect.verticalJump || "-"} in</span>
               </div>
            </div>
          </div>

          {/* Attributes & Personality */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.lime, textTransform: "uppercase", marginBottom: 8 }}>Scout Analysis</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {mockAttrs.map(a => (
                <StatBar key={a.label} label={a.label} value={isFullyRevealed ? a.value : Math.max(40, a.value - 10)} max={100} color={COLORS.sky} />
              ))}
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.lime, textTransform: "uppercase", marginBottom: 8 }}>Personality</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {personality.map(t => (
                <span key={t} style={{ fontSize: 10, padding: "4px 8px", background: "rgba(141,36,110,0.2)", color: COLORS.light, borderRadius: 4, border: `1px solid ${COLORS.magenta}` }}>
                  {t}
                </span>
              ))}
              <span style={{ fontSize: 10, padding: "4px 8px", background: prospect.medicalGrade === 'A' ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)", color: prospect.medicalGrade === 'A' ? COLORS.lime : COLORS.coral, borderRadius: 4, border: `1px solid ${prospect.medicalGrade === 'A' ? COLORS.lime : COLORS.coral}` }}>
                Medical: {prospect.medicalGrade}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ padding: 20, borderTop: `1px solid ${COLORS.darkMagenta}`, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ padding: "8px 16px", background: "transparent", border: `1px solid ${COLORS.muted}`, color: COLORS.muted, borderRadius: 6, cursor: "pointer" }}>Close</button>
          {isOnClock && onDraft && (
            <button
              onClick={() => { onDraft(); onClose(); }}
              style={{
                padding: "8px 16px", background: COLORS.lime,
                color: COLORS.bg, border: "none", borderRadius: 6,
                cursor: "pointer", fontWeight: 700
              }}
            >
              🏈 Draft {prospect.firstName}
            </button>
          )}
          {prospect.scoutingPointsSpent < 2 && (
            <button
              onClick={onScout}
              disabled={scoutPts < 1}
              style={{
                padding: "8px 16px", background: scoutPts >= 1 ? COLORS.lime : "rgba(255,255,255,0.1)",
                color: scoutPts >= 1 ? COLORS.bg : COLORS.muted, border: "none", borderRadius: 6,
                cursor: scoutPts >= 1 ? "pointer" : "not-allowed", fontWeight: 700
              }}
            >
              Scout Player (1 Pt)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DraftScreen({
  userTeamAbbr,
  gsm,
  refresh,
  isMobile = false,
}: {
  userTeamAbbr: string;
  gsm: GameStateManager;
  refresh: () => void;
  isMobile?: boolean;
}) {
  const [tab, setTab] = useState("board");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState<string | null>(null);
  const [targetedPlayers, setTargetedPlayers] = useState<Set<string>>(new Set());
  const [showSnipeAlert, setShowSnipeAlert] = useState<DraftProspect | null>(null);
  const [showAdvisor, setShowAdvisor] = useState(false);
  const [tradeUpOffer, setTradeUpOffer] = useState<any>(null);
  const [viewProspect, setViewProspect] = useState<DraftProspect | null>(null);
  const [clockSeconds, setClockSeconds] = useState(300);
  const [roundRecapData, setRoundRecapData] = useState<{ round: number; picks: any[] } | null>(null);
  const lastPickRef = useRef<number>(0);
  const lastRoundRef = useRef<number>(0);

  // Clock countdown timer — counts down from 300 seconds when user is on the clock
  useEffect(() => {
    const isOnClock = gsm.isDraftActive &&
      gsm.draftOrder.length > 0 &&
      gsm.draftOrder[gsm.currentDraftPick - 1] === gsm.userTeamId;

    if (!isOnClock) return;

    const interval = setInterval(() => {
      setClockSeconds(prev => {
        if (prev <= 1) {
          // Auto-pick the best available prospect
          const topProspect = gsm.draftProspects[0];
          if (topProspect) {
            gsm.draftEngine?.submitUserPick(topProspect.id);
            refresh();
          }
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gsm.isDraftActive, gsm.currentDraftPick, gsm.draftOrder.length]);

  // Reset clock when user makes a pick
  useEffect(() => {
    if (gsm.isDraftActive && lastPickRef.current < gsm.currentDraftPick) {
      setClockSeconds(300);
      lastPickRef.current = gsm.currentDraftPick;
    }
  }, [gsm.currentDraftPick, gsm.isDraftActive]);

  // Show round recap when a round completes
  useEffect(() => {
    if (gsm.isDraftActive && lastRoundRef.current < gsm.currentDraftRound && gsm.draftEngine?.pickResults) {
      // A round has just completed, show the recap
      const completedRound = gsm.currentDraftRound - 1;
      const roundPicks = gsm.draftEngine.pickResults
        .filter(p => p.round === completedRound)
        .map(p => {
          const team = gsm.teams.find(t => t.id === p.teamId);
          const player = gsm.allPlayers.find(pl => pl.id === p.playerId);
          return {
            pickNumber: p.pickNumber,
            teamId: p.teamId,
            teamAbbr: team?.abbreviation ?? "?",
            playerName: player ? `${player.firstName} ${player.lastName}` : "Unknown",
            playerPos: player?.position ?? "?",
            playerOvr: player?.overall ?? 0,
          };
        });
      setRoundRecapData({ round: completedRound, picks: roundPicks });
      lastRoundRef.current = gsm.currentDraftRound;
    }
  }, [gsm.currentDraftRound, gsm.isDraftActive, gsm.draftEngine?.pickResults.length]);

  // Load targeted players from localStorage on mount
  useEffect(() => {
    const season = gsm.currentGameDate.season;
    const storageKey = `draftTargets-season${season}-team${userTeamAbbr}`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const targetIds = JSON.parse(saved) as string[];
        setTargetedPlayers(new Set(targetIds));
      }
    } catch (error) {
      console.warn('Failed to load draft targets from localStorage', error);
    }
  }, [userTeamAbbr, gsm.currentGameDate.season]);

  const currentSeason = gsm.currentGameDate.season;
  const draftYears = [currentSeason, currentSeason + 1, currentSeason + 2];
  const myPicks = computeTeamPicks(userTeamAbbr, gsm);
  const byYear  = draftYears.map(yr => ({
    year: yr,
    picks: myPicks.filter(p => p.year === yr),
  }));

  const prospects = gsm.draftProspects;
  const scoutPtsLeft = gsm.scoutingPointsAvailable;

  // Filter prospects by search query and position
  const filteredProspects = useMemo(() => {
    let filtered = prospects;

    // Apply position filter
    if (positionFilter) {
      filtered = filtered.filter(p => p.position === positionFilter);
    }

    // Apply search query
    if (!searchQuery.trim()) return filtered;

    const query = searchQuery.toLowerCase();
    return filtered.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.position.toLowerCase().includes(query) ||
      p.college.toLowerCase().includes(query)
    );
  }, [prospects, searchQuery, positionFilter]);

  const sortedProspects = useMemo(() => {
    if (!sortConfig) return filteredProspects;
    return [...filteredProspects].sort((a, b) => {
      let aVal: any = 0;
      let bVal: any = 0;

      switch (sortConfig.key) {
        case "#":
          aVal = filteredProspects.indexOf(a);
          bVal = filteredProspects.indexOf(b);
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
  }, [filteredProspects, sortConfig, filteredProspects.length, scoutPtsLeft]);

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
    const engine = gsm.draftEngine;
    if (engine && engine.pickResults.length > lastPickRef.current) {
      const lastResult = engine.pickResults[engine.pickResults.length - 1];
      lastPickRef.current = engine.pickResults.length;

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
    const season = gsm.currentGameDate.season;
    const storageKey = `draftTargets-season${season}-team${userTeamAbbr}`;

    if (next.has(id)) {
      // Remove from targets and localStorage
      next.delete(id);
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const targetIds = JSON.parse(saved) as string[];
          const filtered = targetIds.filter(tid => tid !== id);
          if (filtered.length > 0) {
            localStorage.setItem(storageKey, JSON.stringify(filtered));
          } else {
            localStorage.removeItem(storageKey);
          }
        }
      } catch (error) {
        console.warn('Failed to remove draft target from localStorage', error);
      }
    } else {
      // Add to targets and localStorage
      next.add(id);
      try {
        const saved = localStorage.getItem(storageKey);
        const targetIds = saved ? JSON.parse(saved) as string[] : [];
        if (!targetIds.includes(id)) {
          targetIds.push(id);
          localStorage.setItem(storageKey, JSON.stringify(targetIds));
        }
      } catch (error) {
        console.warn('Failed to save draft target to localStorage', error);
      }
    }

    setTargetedPlayers(next);
  }

  function handleTradeUp() {
    const engine = gsm.draftEngine;
    if (!engine || !gsm.isDraftActive) return;
    engine.pause();

    const currentPickNum = gsm.currentDraftPick;
    const currentRound = gsm.currentDraftRound;
    const teamOnClockId = gsm.draftOrder[currentPickNum - 1];

    if (teamOnClockId === userTeamAbbr) {
      alert("You are already on the clock!");
      engine.resume();
      return;
    }

    // Find user picks to offer (simple heuristic: next 2 available picks)
    const myPicks = gsm.draftPicks
      .filter(p => p.currentTeamId === userTeamAbbr && p.year === gsm.currentGameDate.season)
      .sort((a, b) => a.round - b.round);

    const offerPicks = myPicks.slice(0, 2);

    if (offerPicks.length === 0) {
      alert("You don't have enough draft capital to trade up.");
      engine.resume();
      return;
    }

    setTradeUpOffer({
      targetTeamId: teamOnClockId,
      targetRound: currentRound,
      targetPick: currentPickNum,
      myPicks: offerPicks
    });
  }

  function executeTradeUp() {
    if (!tradeUpOffer) return;
    
    const targetPickObj = gsm.draftPicks.find(p => 
        p.currentTeamId === tradeUpOffer.targetTeamId && 
        p.year === gsm.currentGameDate.season && 
        p.round === tradeUpOffer.targetRound
    );

    const payload = {
        offeringTeamId: userTeamAbbr,
        receivingTeamId: tradeUpOffer.targetTeamId,
        offeringPlayerIds: [],
        receivingPlayerIds: [],
        offeringPickIds: tradeUpOffer.myPicks.map((p: any) => `${p.year}-${p.round}-${p.originalTeamId}`),
        receivingPickIds: targetPickObj ? [`${targetPickObj.year}-${targetPickObj.round}-${targetPickObj.originalTeamId}`] : []
    };
    
    gsm.executeTrade(payload);
    // Force update draft order to reflect user is now on clock
    gsm.draftOrder[gsm.currentDraftPick - 1] = userTeamAbbr;
    
    setTradeUpOffer(null);
    gsm.draftEngine?.resume();
    refresh();
  }

  // Intercept Trade Offers
  const activeTradeInterrupt = gsm.engineActiveInterrupt?.reason === HardStopReason.TRADE_OFFER_RECEIVED 
    ? gsm.engineActiveInterrupt 
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
      {/* Team Needs Section (Always Visible at Top) */}
      <div style={{
        marginBottom: 16,
        paddingBottom: 12,
        borderBottom: `1px solid ${COLORS.darkMagenta}`,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", marginBottom: 8, letterSpacing: 1 }}>
          Team Needs
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {teamNeeds.length === 0 ? (
            <div style={{ fontSize: 11, color: COLORS.lime }}>No critical weaknesses identified.</div>
          ) : (
            teamNeeds.map((pos: string) => (
              <div key={pos} style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "rgba(255, 85, 85, 0.1)", border: "1px solid rgba(255, 85, 85, 0.25)",
                borderRadius: 6, padding: "4px 8px"
              }}>
                <PosTag pos={pos} />
                <span style={{ fontSize: 10, fontWeight: 600, color: COLORS.light }}>Need</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="draft-header-row">
        <div className="draft-header-tabs">
          <Pill active={tab === "board"}  onClick={() => setTab("board")}>Big Board</Pill>
          <Pill active={tab === "targets"}  onClick={() => setTab("targets")}>Draft Targets ({targetedPlayers.size})</Pill>
          <Pill active={tab === "ticker"}  onClick={() => setTab("ticker")}>Pick Tracker</Pill>
          <Pill active={tab === "picks"}  onClick={() => setTab("picks")}>My Picks</Pill>
        </div>
        {gsm.isDraftActive && (
          <div className="draft-header-actions">
            <button onClick={handleTradeUp} style={{
              background: COLORS.lime, color: COLORS.bg, border: "none", borderRadius: 4,
              padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6
            }}>
              <ArrowUp size={14} /> Trade Up
            </button>
            <button onClick={() => gsm.draftEngine?.simulateToNextUserPick()} style={{
              background: "rgba(255,255,255,0.1)", color: COLORS.light, border: "1px solid rgba(255,255,255,0.2)", borderRadius: 4,
              padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6
            }}>
              <FastForward size={14} /> {isMobile ? "Skip" : "Sim to Next Pick"}
            </button>
          </div>
        )}
      </div>

      {/* On The Clock Banner */}
      {gsm.isDraftActive && gsm.draftOrder.length > 0 && gsm.draftOrder[gsm.currentDraftPick - 1] === gsm.userTeamId && (
        <div className="on-the-clock-banner" style={{
          background: `linear-gradient(90deg, ${COLORS.lime}15, transparent)`,
          border: `2px solid ${COLORS.lime}`,
          borderRadius: 10,
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          animation: "pulse 1.5s infinite",
        }}>
          <div>
            <div style={{
              fontSize: 12,
              fontWeight: 900,
              color: COLORS.lime,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}>
              ⚡ YOU ARE ON THE CLOCK
            </div>
            <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>
              Round {gsm.currentDraftRound} · Pick #{gsm.currentDraftPick} of {gsm.draftOrder.length * 7}
            </div>
          </div>
          <DraftClock secondsLeft={clockSeconds} />
        </div>
      )}

      {/* Upcoming Picks Queue */}
      {gsm.isDraftActive && gsm.draftOrder.length > 0 && (
        <div style={{
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: `1px solid ${COLORS.darkMagenta}`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", marginBottom: 10, letterSpacing: 1 }}>
            Next Selections
          </div>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {Array.from({ length: 5 }).map((_, i) => {
              const pickIdx = gsm.currentDraftPick - 1 + i;
              if (pickIdx >= gsm.draftOrder.length * 7) return null;
              const teamId = gsm.draftOrder[pickIdx % gsm.draftOrder.length];
              const team = gsm.teams.find(t => t.id === teamId);
              const isCurrentPick = i === 0;
              return (
                <div
                  key={i}
                  style={{
                    flex: "0 0 auto",
                    width: 100,
                    padding: 12,
                    borderRadius: 8,
                    background: isCurrentPick
                      ? `linear-gradient(135deg, ${COLORS.lime}30, ${COLORS.lime}10)`
                      : "rgba(255,255,255,0.05)",
                    border: `1px solid ${isCurrentPick ? COLORS.lime : COLORS.darkMagenta}`,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 9, color: COLORS.muted, marginBottom: 4 }}>
                    Pick {gsm.currentDraftPick + i}
                  </div>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 900,
                    color: isCurrentPick ? COLORS.lime : COLORS.light,
                  }}>
                    {team?.abbreviation ?? "?"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "board" && (
        <Section title={`Prospect Board — Scout Pts: ${scoutPtsLeft}`} pad={false}>
          {prospects.length === 0 ? (
            <div style={{ padding: "14px", fontSize: 11, color: COLORS.muted }}>
              Draft class generates when you enter Draft Prep phase.
            </div>
          ) : (
            <>
              <div style={{ padding: "12px 14px", borderBottom: `1px solid rgba(255,255,255,0.1)` }}>
                <input
                  type="text"
                  placeholder="Search by name, position, or college..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 6,
                    background: "rgba(255,255,255,0.05)", border: `1px solid ${COLORS.darkMagenta}`,
                    color: COLORS.light, fontSize: 12, fontFamily: "inherit", marginBottom: 10,
                  }}
                />

                {/* Position Filter */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", marginBottom: 6, letterSpacing: 0.5 }}>
                    Filter by Position
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      onClick={() => setPositionFilter(null)}
                      style={{
                        padding: "4px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                        border: `1px solid ${positionFilter === null ? COLORS.lime : "rgba(255,255,255,0.2)"}`,
                        background: positionFilter === null ? `${COLORS.lime}20` : "transparent",
                        color: positionFilter === null ? COLORS.lime : COLORS.light,
                        cursor: "pointer",
                      }}
                    >
                      All
                    </button>
                    {["QB", "RB", "WR", "TE", "OT", "OG", "C", "DT", "EDGE", "LB", "CB", "S", "P", "K"].map(pos => (
                      <button
                        key={pos}
                        onClick={() => setPositionFilter(pos)}
                        style={{
                          padding: "4px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                          border: `1px solid ${positionFilter === pos ? COLORS.lime : "rgba(255,255,255,0.2)"}`,
                          background: positionFilter === pos ? `${COLORS.lime}20` : "transparent",
                          color: positionFilter === pos ? COLORS.lime : COLORS.light,
                          cursor: "pointer",
                        }}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ fontSize: 10, color: COLORS.muted }}>
                  {filteredProspects.length} of {prospects.length} prospects
                </div>
              </div>

              <DataRow header>
                {["#", "Name", "Pos", "College", "OVR", "Proj", "Target", "Scout"].map(h => {
                  const isSortable = ["#", "Name", "Pos", "College", "OVR", "Proj"].includes(h);
                  const colClass = h === "College" ? "draft-col-college" : h === "Proj" ? "draft-col-proj" : undefined;
                  return (
                    <span
                      key={h}
                      className={colClass}
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
                const rank = filteredProspects.indexOf(p) + 1;
                return (
                  <DataRow key={p.id} even={i % 2 === 0} hover onClick={() => setViewProspect(p)}>
                    <span style={{ flex: 1, fontSize: 10, fontFamily: "monospace", color: COLORS.muted }}>{rank}</span>
                    <span style={{ flex: 2, fontSize: 11, fontWeight: 600, color: COLORS.light }}>{p.name}</span>
                    <span style={{ flex: 1 }}><PosTag pos={p.position} /></span>
                    <span className="draft-col-college" style={{ flex: 1.5, fontSize: 10, color: COLORS.muted }}>{p.college}</span>
                    <span style={{ flex: 1 }}>{renderOvr(p)}</span>
                    <span className="draft-col-proj" style={{ flex: 1, fontSize: 10, color: COLORS.muted }}>Rd {p.projectedRound === 8 ? "UDFA" : p.projectedRound}</span>
                    <span style={{ flex: 1 }}>
                      {gsm.isDraftActive && gsm.draftOrder.length > 0 && gsm.draftOrder[gsm.currentDraftPick - 1] === gsm.userTeamId ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); gsm.draftEngine?.submitUserPick(p.id); refresh(); }}
                          style={{
                            fontSize: 9,
                            padding: "2px 6px",
                            borderRadius: 3,
                            border: "none",
                            cursor: "pointer",
                            background: COLORS.lime,
                            color: COLORS.bg,
                            fontWeight: 700,
                          }}
                        >
                          Draft
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleTarget(p.id); }}
                          style={{
                            background: "transparent", border: "none", cursor: "pointer",
                            color: isTarget ? COLORS.gold : "rgba(255,255,255,0.1)"
                          }}
                        >
                          <Star size={14} fill={isTarget ? COLORS.gold : "none"} />
                        </button>
                      )}
                    </span>
                    <span style={{ flex: 1 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); canScout && handleScout(p.id); }}
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

      {tab === "targets" && (
        <Section title={`Draft Targets — ${targetedPlayers.size} Players`} pad={false}>
          {targetedPlayers.size === 0 ? (
            <div style={{ padding: "14px", fontSize: 11, color: COLORS.muted }}>
              Star a prospect on the Big Board to add them to your draft targets.
            </div>
          ) : (
            <div>
              <DataRow header>
                {["#", "Name", "Pos", "College", "OVR", "Proj", "Remove"].map(h => {
                  const colClass = h === "College" ? "draft-col-college" : h === "Proj" ? "draft-col-proj" : undefined;
                  return (
                    <span key={h} className={colClass} style={{
                      fontSize: 8, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700,
                      flex: h === "Name" ? 2 : 1,
                    }}>
                      {h}
                    </span>
                  );
                })}
              </DataRow>
              {gsm.draftProspects
                .filter(p => targetedPlayers.has(p.id))
                .map((p, i) => {
                  const rank = gsm.draftProspects.indexOf(p) + 1;
                  return (
                    <DataRow key={p.id} even={i % 2 === 0} hover onClick={() => setViewProspect(p)}>
                      <span style={{ flex: 1, fontSize: 10, fontFamily: "monospace", color: COLORS.muted }}>{rank}</span>
                      <span style={{ flex: 2, fontSize: 11, fontWeight: 600, color: COLORS.light }}>{p.name}</span>
                      <span style={{ flex: 1 }}><PosTag pos={p.position} /></span>
                      <span className="draft-col-college" style={{ flex: 1.5, fontSize: 10, color: COLORS.muted }}>{p.college}</span>
                      <span style={{ flex: 1 }}>{renderOvr(p)}</span>
                      <span className="draft-col-proj" style={{ flex: 1, fontSize: 10, color: COLORS.muted }}>Rd {p.projectedRound === 8 ? "UDFA" : p.projectedRound}</span>
                      <span style={{ flex: 1 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleTarget(p.id); }}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: COLORS.coral,
                            fontWeight: 700,
                            fontSize: 11,
                          }}
                        >
                          ✕
                        </button>
                      </span>
                    </DataRow>
                  );
                })}
            </div>
          )}
        </Section>
      )}

      {tab === "ticker" && (
        <Section title="Pick Tracker — Recent Selections" pad={false}>
          {gsm.draftEngine?.pickResults && gsm.draftEngine.pickResults.length > 0 ? (
            <div>
              <DataRow header>
                {["Pick #", "Team", "Player", "Pos", "Round"].map(h => (
                  <span key={h} style={{
                    fontSize: 8, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700,
                    flex: h === "Player" ? 2 : 1,
                  }}>
                    {h}
                  </span>
                ))}
              </DataRow>
              {[...gsm.draftEngine.pickResults].reverse().map((result, i) => {
                const team = gsm.teams.find(t => t.id === result.teamId);
                const player = gsm.allPlayers.find(p => p.id === result.playerId);
                return (
                  <DataRow key={`${result.pickNumber}-${result.teamId}`} even={i % 2 === 0}>
                    <span style={{ flex: 1, fontSize: 10, fontFamily: "monospace", color: COLORS.muted }}>
                      {result.pickNumber}
                    </span>
                    <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: COLORS.light }}>
                      {team?.abbreviation ?? "?"}
                    </span>
                    <span style={{ flex: 2, fontSize: 11, fontWeight: 600, color: COLORS.light }}>
                      {player ? `${player.firstName} ${player.lastName}` : "Unknown"}
                    </span>
                    <span style={{ flex: 1 }}>
                      <PosTag pos={player?.position ?? "?"} />
                    </span>
                    <span style={{ flex: 1, fontSize: 10, color: COLORS.muted }}>
                      Rd {result.round}
                    </span>
                  </DataRow>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: "14px", fontSize: 11, color: COLORS.muted }}>
              No picks yet. Start the draft to begin tracking selections.
            </div>
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

      {tradeUpOffer && (
        <TradeUpOverlay 
          offer={tradeUpOffer}
          onAccept={executeTradeUp}
          onCancel={() => { setTradeUpOffer(null); gsm.draftEngine?.resume(); }}
        />
      )}

      {viewProspect && (
        <ScoutingReportModal
          prospect={viewProspect}
          onClose={() => setViewProspect(null)}
          onScout={() => handleScout(viewProspect.id)}
          scoutPts={scoutPtsLeft}
          isOnClock={gsm.isDraftActive && gsm.draftOrder.length > 0 && gsm.draftOrder[gsm.currentDraftPick - 1] === gsm.userTeamId}
          onDraft={() => {
            gsm.draftEngine?.submitUserPick(viewProspect.id);
            refresh();
          }}
        />
      )}

      {activeTradeInterrupt && (
        <PhoneCallOverlay
          offer={activeTradeInterrupt.payload}
          onAccept={() => { gsm.resolveEngineInterrupt({ reason: HardStopReason.TRADE_OFFER_RECEIVED, accepted: true }); refresh(); }}
          onDecline={() => { gsm.resolveEngineInterrupt({ reason: HardStopReason.TRADE_OFFER_RECEIVED, accepted: false }); refresh(); }}
          onNegotiate={() => { gsm.resolveEngineInterrupt({ reason: HardStopReason.TRADE_OFFER_RECEIVED, accepted: false, navigate: true }); refresh(); }}
        />
      )}

      {roundRecapData && (
        <DraftRoundRecapModal
          round={roundRecapData.round}
          picks={roundRecapData.picks}
          userTeamId={gsm.userTeamId}
          onClose={() => setRoundRecapData(null)}
        />
      )}
    </div>
  );
}
