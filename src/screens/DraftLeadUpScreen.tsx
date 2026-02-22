import { useState } from "react";
import { COLORS } from "../ui/theme";
import { Section, DataRow, CategoryIcon, Pill, RatingBadge, PosTag } from "../ui/components";
import { Calendar, MessageCircle, AlertTriangle, ArrowRight, ListOrdered } from "lucide-react";
import type { GameStateManager } from "../types/GameStateManager";

export function DraftLeadUpScreen({ gsm, onAdvance }: { gsm: GameStateManager; onAdvance: () => void }) {
  const [day, setDay] = useState(1); // 1=Mon, 2=Tue, 3=Wed
  const [tab, setTab] = useState<"rumors" | "mock">("rumors");
  const [leakModal, setLeakModal] = useState(false);
  const [workoutModal, setWorkoutModal] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<string | null>(null);

  const days = ["Monday", "Tuesday", "Wednesday"];
  const currentDayName = days[day - 1];

  // Mock rumors based on top prospects
  const topProspects = gsm.draftProspects.slice(0, 5);
  const rumors = topProspects.map((p, i) => ({
    id: `rumor-${i}`,
    text: `Sources say the ${i % 2 === 0 ? "Raiders" : "Giants"} are heavily scouting ${p.name}.`,
    reliability: i % 2 === 0 ? "High" : "Low",
    day: (i % 3) + 1
  })).filter(r => r.day <= day);

  const redFlags = day >= 2 ? [
    { id: "rf1", text: "Medical re-check flagged a potential knee issue for a top QB prospect.", severity: "moderate" }
  ] : [];

  function handleNextDay() {
    if (day < 3) {
      setDay(day + 1);
    } else {
      onAdvance(); // Go to Draft
    }
  }

  function handleLeakInterest(prospectId: string) {
    // Create a leak rumor that other teams will be interested in this prospect
    const prospect = gsm.draftProspects.find(p => p.id === prospectId);
    if (!prospect) return;

    // Add to trade rumors (simulating leaked interest)
    const leakRumor = `Your interest in ${prospect.name} has been leaked to rival teams. This could affect his draft stock.`;
    if (!gsm.tradeRumors.some(r => r.includes(prospect.name))) {
      gsm.tradeRumors.push(leakRumor);
    }

    // Show toast notification
    gsm.latestToast = {
      id: `leak-${prospectId}`,
      type: "info",
      title: "Interest Leaked",
      message: `Scouts are buzzing about your interest in ${prospect.name}. Other teams may trade up ahead of you.`
    };

    setLeakModal(false);
    setSelectedProspect(null);
  }

  function handleScheduleWorkout(prospectId: string) {
    // Spend scouting points to improve evaluation of this prospect
    const prospect = gsm.draftProspects.find(p => p.id === prospectId);
    if (!prospect || gsm.scoutingPointsAvailable < 1) return;

    // Spend a scouting point on the prospect for improved evaluation
    gsm.spendScoutingPoints(prospectId, 1);

    // Show toast notification
    gsm.latestToast = {
      id: `workout-${prospectId}`,
      type: "success",
      title: "Workout Scheduled",
      message: `Private workout scheduled with ${prospect.name}. Scouting intel updated.`
    };

    setWorkoutModal(false);
    setSelectedProspect(null);
  }

  // Mock Draft Simulation
  const mockDraft = (() => {
    if (tab !== "mock") return [];
    const order = gsm.draftOrder.slice(0, 32); // Round 1
    const available = [...gsm.draftProspects].sort((a, b) => b.overall - a.overall);
    
    return order.map((teamId, i) => {
      const team = gsm.teams.find(t => t.id === teamId);
      const pick = available[i];
      return {
        pickNo: i + 1,
        team,
        player: pick
      };
    });
  })();

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Calendar size={18} color={COLORS.lime} />
            <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.lime, textTransform: "uppercase", letterSpacing: 1 }}>
              Draft Week
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: COLORS.light }}>
            {currentDayName}
          </h1>
        </div>
        <button
          onClick={handleNextDay}
          style={{
            background: COLORS.magenta, color: COLORS.light, border: "none",
            padding: "12px 24px", borderRadius: 8, fontSize: 13, fontWeight: 700,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 8
          }}
        >
          {day < 3 ? "Advance Day" : "Enter Draft Room"} <ArrowRight size={16} />
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <Pill active={tab === "rumors"} onClick={() => setTab("rumors")}>Rumors & Alerts</Pill>
        <Pill active={tab === "mock"} onClick={() => setTab("mock")}>Mock Draft 1.0</Pill>
      </div>

      {tab === "rumors" ? (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
          {/* Rumor Mill */}
          <Section title="Draft Rumor Mill">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {rumors.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: COLORS.muted, fontSize: 12 }}>
                  Quiet day on the wire...
                </div>
              ) : (
                rumors.map(r => (
                  <div key={r.id} style={{ display: "flex", gap: 12, padding: "10px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                    <MessageCircle size={16} color={COLORS.sky} style={{ marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: 12, color: COLORS.light, marginBottom: 4 }}>{r.text}</div>
                      <div style={{ fontSize: 10, color: COLORS.muted }}>
                        Reliability: <span style={{ color: r.reliability === "High" ? COLORS.lime : COLORS.coral }}>{r.reliability}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Section>

          {/* Red Flags & Alerts */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Section title="Red Flag Alerts">
              {redFlags.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: COLORS.muted, fontSize: 12 }}>
                  No medical or character flags reported.
                </div>
              ) : (
                redFlags.map(f => (
                  <div key={f.id} style={{ display: "flex", gap: 10, padding: "10px", background: "rgba(220, 38, 38, 0.1)", borderRadius: 8, border: "1px solid rgba(220, 38, 38, 0.3)" }}>
                    <AlertTriangle size={16} color={COLORS.coral} style={{ marginTop: 2 }} />
                    <div style={{ fontSize: 11, color: COLORS.light }}>{f.text}</div>
                  </div>
                ))
              )}
            </Section>

            <Section title="Actions">
              <button onClick={() => setLeakModal(true)} style={{ width: "100%", padding: "10px", marginBottom: 8, background: "rgba(255,255,255,0.05)", border: `1px solid ${COLORS.darkMagenta}`, color: COLORS.light, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Leak Interest in Prospect
              </button>
              <button onClick={() => setWorkoutModal(true)} style={{ width: "100%", padding: "10px", background: "rgba(255,255,255,0.05)", border: `1px solid ${COLORS.darkMagenta}`, color: COLORS.light, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Schedule Private Workout
              </button>
            </Section>
          </div>
        </div>
      ) : (
        <Section title="Projected Round 1" pad={false}>
          <DataRow header>
            <span style={{ flex: 0.5, fontSize: 8, color: COLORS.muted, fontWeight: 700 }}>Pick</span>
            <span style={{ flex: 1, fontSize: 8, color: COLORS.muted, fontWeight: 700 }}>Team</span>
            <span style={{ flex: 2, fontSize: 8, color: COLORS.muted, fontWeight: 700 }}>Player</span>
            <span style={{ flex: 1, fontSize: 8, color: COLORS.muted, fontWeight: 700 }}>Pos</span>
            <span style={{ flex: 1, fontSize: 8, color: COLORS.muted, fontWeight: 700 }}>OVR</span>
          </DataRow>
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {mockDraft.map((row) => (
              <DataRow key={row.pickNo} even={row.pickNo % 2 === 0}>
                <span style={{ flex: 0.5, fontSize: 11, color: COLORS.muted, fontFamily: "monospace" }}>
                  {row.pickNo}
                </span>
                <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: row.team?.id === gsm.userTeamId ? COLORS.lime : COLORS.light }}>
                  {row.team?.abbreviation ?? "UNK"}
                </span>
                <span style={{ flex: 2, fontSize: 11, color: COLORS.light }}>
                  {row.player?.name ?? "Unknown"}
                </span>
                <span style={{ flex: 1 }}><PosTag pos={row.player?.position} /></span>
                <span style={{ flex: 1 }}><RatingBadge value={row.player?.overall} size="sm" /></span>
              </DataRow>
            ))}
          </div>
        </Section>
      )}

      {/* Leak Interest Modal */}
      {leakModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div style={{
            background: COLORS.bg, border: `1px solid ${COLORS.darkMagenta}`, borderRadius: 12, padding: 24, width: 400,
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
          }}>
            <h3 style={{ margin: "0 0 16px", color: COLORS.light }}>Leak Interest in Prospect</h3>
            <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              {gsm.draftProspects.slice(0, 10).map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    handleLeakInterest(p.id);
                  }}
                  style={{
                    textAlign: "left", padding: "12px", background: "rgba(255,255,255,0.05)", border: `1px solid ${COLORS.darkMagenta}`,
                    color: COLORS.light, borderRadius: 6, fontSize: 12, cursor: "pointer", transition: "all 0.15s"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                >
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>{p.position} · {p.college}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setLeakModal(false)} style={{
              width: "100%", padding: "10px", background: "transparent", color: COLORS.muted, border: `1px solid ${COLORS.muted}`, borderRadius: 6, fontWeight: 600, cursor: "pointer"
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Schedule Workout Modal */}
      {workoutModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div style={{
            background: COLORS.bg, border: `1px solid ${COLORS.darkMagenta}`, borderRadius: 12, padding: 24, width: 400,
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
          }}>
            <h3 style={{ margin: "0 0 16px", color: COLORS.light }}>Schedule Private Workout</h3>
            <div style={{ marginBottom: 16, padding: 12, background: "rgba(215,241,113,0.1)", borderRadius: 6, border: `1px solid ${COLORS.lime}` }}>
              <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>Scouting Points Available</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.lime }}>{gsm.scoutingPointsAvailable} points</div>
            </div>
            <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              {gsm.draftProspects.slice(0, 10).map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    if (gsm.scoutingPointsAvailable >= 1) {
                      handleScheduleWorkout(p.id);
                    }
                  }}
                  disabled={gsm.scoutingPointsAvailable < 1}
                  style={{
                    textAlign: "left", padding: "12px", background: gsm.scoutingPointsAvailable < 1 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${COLORS.darkMagenta}`,
                    color: gsm.scoutingPointsAvailable < 1 ? COLORS.muted : COLORS.light, borderRadius: 6, fontSize: 12, cursor: gsm.scoutingPointsAvailable < 1 ? "default" : "pointer", transition: "all 0.15s"
                  }}
                  onMouseEnter={(e) => { if (gsm.scoutingPointsAvailable >= 1) e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = gsm.scoutingPointsAvailable < 1 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)"; }}
                >
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>{p.position} · {p.college}</div>
                </button>
              ))}
            </div>
            {gsm.scoutingPointsAvailable < 1 && (
              <div style={{ fontSize: 11, color: COLORS.coral, marginBottom: 12, textAlign: "center" }}>Out of scouting points</div>
            )}
            <button onClick={() => setWorkoutModal(false)} style={{
              width: "100%", padding: "10px", background: "transparent", color: COLORS.muted, border: `1px solid ${COLORS.muted}`, borderRadius: 6, fontWeight: 600, cursor: "pointer"
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}