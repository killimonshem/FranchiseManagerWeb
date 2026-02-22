import React from "react";
import { COLORS } from "../ui/theme";
import { Section, RatingBadge, DataRow, PosTag, Pill, StatBar } from "../ui/components";
import { useState, useEffect, useRef, useMemo } from "react";
import type { GameStateManager, DraftProspect } from "../types/GameStateManager";
import { Phone, User, Glasses, AlertOctagon, X, Check, Siren, Gavel, Star, ArrowUp, ArrowDown, FastForward } from "lucide-react";
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

function TradeUpOverlay({ offer, onAccept, onCancel }: { offer: any, onAccept: () => void, onCancel: () => void }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <div style={{
        background: COLORS.bg, border: `1px solid ${COLORS.lime}`, borderRadius: 12, padding: 24, width: 400,
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

function ScoutingReportModal({ prospect, onClose, onScout, scoutPts }: { prospect: DraftProspect, onClose: () => void, onScout: () => void, scoutPts: number }) {
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

        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
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
}: {
  userTeamAbbr: string;
  gsm: GameStateManager;
  refresh: () => void;
}) {
  const [tab, setTab] = useState("board");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [targetedPlayers, setTargetedPlayers] = useState<Set<string>>(new Set());
  const [showSnipeAlert, setShowSnipeAlert] = useState<DraftProspect | null>(null);
  const [showAdvisor, setShowAdvisor] = useState(false);
  const [tradeUpOffer, setTradeUpOffer] = useState<any>(null);
  const [viewProspect, setViewProspect] = useState<DraftProspect | null>(null);
  const lastPickRef = useRef<number>(0);

  const currentSeason = gsm.currentGameDate.season;
  const draftYears = [currentSeason, currentSeason + 1, currentSeason + 2];
  const myPicks = computeTeamPicks(userTeamAbbr, gsm);
  const byYear  = draftYears.map(yr => ({
    year: yr,
    picks: myPicks.filter(p => p.year === yr),
  }));

  const prospects = gsm.draftProspects;
  const scoutPtsLeft = gsm.scoutingPointsAvailable;

  // Filter prospects by search query
  const filteredProspects = useMemo(() => {
    if (!searchQuery.trim()) return prospects;

    const query = searchQuery.toLowerCase();
    return prospects.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.position.toLowerCase().includes(query) ||
      p.college.toLowerCase().includes(query)
    );
  }, [prospects, searchQuery]);

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
    if (next.has(id)) next.delete(id); else next.add(id);
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <Pill active={tab === "board"}  onClick={() => setTab("board")}>Big Board</Pill>
          <Pill active={tab === "picks"}  onClick={() => setTab("picks")}>My Picks</Pill>
          <Pill active={tab === "needs"}  onClick={() => setTab("needs")}>Team Needs</Pill>
        </div>
        {gsm.isDraftActive && (
          <div style={{ display: "flex", gap: 8 }}>
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
              <FastForward size={14} /> Sim to Next Pick
            </button>
          </div>
        )}
      </div>

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
                    color: COLORS.light, fontSize: 12, fontFamily: "inherit",
                  }}
                />
                <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 6 }}>
                  {filteredProspects.length} of {prospects.length} prospects
                </div>
              </div>

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
                const rank = filteredProspects.indexOf(p) + 1;
                return (
                  <DataRow key={p.id} even={i % 2 === 0} hover onClick={() => setViewProspect(p)}>
                    <span style={{ flex: 1, fontSize: 10, fontFamily: "monospace", color: COLORS.muted }}>{rank}</span>
                    <span style={{ flex: 2, fontSize: 11, fontWeight: 600, color: COLORS.light }}>{p.name}</span>
                    <span style={{ flex: 1 }}><PosTag pos={p.position} /></span>
                    <span style={{ flex: 1.5, fontSize: 10, color: COLORS.muted }}>{p.college}</span>
                    <span style={{ flex: 1 }}>{renderOvr(p)}</span>
                    <span style={{ flex: 1, fontSize: 10, color: COLORS.muted }}>Rd {p.projectedRound === 8 ? "UDFA" : p.projectedRound}</span>
                    <span style={{ flex: 1 }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleTarget(p.id); }}
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
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Section title="Identified Weaknesses" pad={false}>
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {teamNeeds.length === 0 ? (
                  <div style={{ fontSize: 11, color: COLORS.lime }}>No critical weaknesses identified.</div>
                ) : (
                  teamNeeds.map((pos: string) => (
                    <div key={pos} style={{ 
                      display: "flex", alignItems: "center", gap: 8, 
                      background: "rgba(255, 85, 85, 0.1)", border: "1px solid rgba(255, 85, 85, 0.25)", 
                      borderRadius: 6, padding: "6px 10px" 
                    }}>
                      <PosTag pos={pos} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.light }}>Need</span>
                    </div>
                  ))
                )}
              </div>
              <p style={{ fontSize: 11, color: COLORS.muted, margin: 0, lineHeight: 1.4 }}>
                Scouts recommend prioritizing these positions in early rounds due to lack of depth or starter quality.
              </p>
            </div>
          </Section>

          <Section title="Positional Depth Chart (Needs)" pad={false}>
            <DataRow header>
              <span style={{ flex: 0.8, fontSize: 8, color: COLORS.muted, fontWeight: 700 }}>Pos</span>
              <span style={{ flex: 0.8, fontSize: 8, color: COLORS.muted, fontWeight: 700 }}>Count</span>
              <span style={{ flex: 0.8, fontSize: 8, color: COLORS.muted, fontWeight: 700 }}>Avg</span>
              <span style={{ flex: 3, fontSize: 8, color: COLORS.muted, fontWeight: 700 }}>Depth (Top 3)</span>
            </DataRow>
            {teamNeeds.map((pos: string) => {
              const playersAtPos = gsm.allPlayers
                .filter((p: any) => p.teamId === userTeamAbbr && p.position === pos)
                .sort((a: any, b: any) => b.overall - a.overall);
              
              const count = playersAtPos.length;
              const avg = count > 0 ? Math.round(playersAtPos.reduce((s: number, p: any) => s + p.overall, 0) / count) : 0;

              return (
                <DataRow key={pos} even={false}>
                  <span style={{ flex: 0.8 }}><PosTag pos={pos} /></span>
                  <span style={{ flex: 0.8, fontSize: 11, color: count < 2 ? COLORS.coral : COLORS.light }}>{count}</span>
                  <span style={{ flex: 0.8 }}><RatingBadge value={avg} size="sm" /></span>
                  <div style={{ flex: 3, display: "flex", gap: 6, overflowX: "auto" }}>
                    {playersAtPos.slice(0, 3).map((p: any) => (
                      <div key={p.id} style={{ 
                        background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "2px 6px", 
                        fontSize: 9, display: "flex", alignItems: "center", gap: 4 
                      }}>
                        <span style={{ color: COLORS.light }}>{p.lastName}</span>
                        <span style={{ color: p.overall >= 80 ? COLORS.lime : p.overall >= 70 ? COLORS.gold : COLORS.muted, fontWeight: 700 }}>{p.overall}</span>
                      </div>
                    ))}
                    {playersAtPos.length === 0 && <span style={{ fontSize: 9, color: COLORS.coral, fontStyle: "italic" }}>Empty</span>}
                  </div>
                </DataRow>
              );
            })}
          </Section>
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
    </div>
  );
}
