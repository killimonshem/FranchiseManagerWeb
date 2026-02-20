/**
 * Franchise Manager — Main App Shell
 *
 * - Phase: "setup" shows TeamSelectScreen, "playing" shows the main UI
 * - Real player data from CSV is passed down to each screen
 * - Navigation architecture: 4 pillars (Dashboard, Team, Office, League)
 */

import { useState } from "react";
import { COLORS, FONT } from "./ui/theme";
import { LayoutDashboard, Users, Briefcase, Trophy, Mail } from "./ui/components";

import { TeamSelectScreen, GameStartData, TeamMeta, GMProfile } from "./screens/TeamSelectScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { RosterScreen } from "./screens/RosterScreen";
import { PlayerProfileScreen } from "./screens/PlayerProfileScreen";
import { DraftScreen } from "./screens/DraftScreen";
import { FinancesScreen } from "./screens/FinancesScreen";
import { InboxScreen } from "./screens/InboxScreen";
import { ScheduleScreen } from "./screens/ScheduleScreen";
import { StaffScreen } from "./screens/StaffScreen";
import { FreeAgencyScreen } from "./screens/FreeAgencyScreen";
import { TradeScreen } from "./screens/TradeScreen";
import { TrophyScreen } from "./screens/TrophyScreen";
import { Player } from "./types/player";

// ─── Navigation Architecture ───────────────────────────────────────
const ARCHITECTURE = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, defaultScreen: "dashboard" },
  {
    id: "team", label: "Team", icon: Users, defaultScreen: "roster",
    subs: [
      { id: "roster", label: "Roster" },
      { id: "staff", label: "Coaching Staff" },
    ]
  },
  {
    id: "office", label: "Office", icon: Briefcase, defaultScreen: "trade",
    subs: [
      { id: "trade", label: "Trade Center" },
      { id: "freeAgency", label: "Free Agency" },
      { id: "draft", label: "Draft Board" },
      { id: "finances", label: "Finances" },
    ]
  },
  {
    id: "league", label: "League", icon: Trophy, defaultScreen: "schedule",
    subs: [
      { id: "schedule", label: "Schedule" },
      { id: "trophies", label: "Trophies" },
    ]
  },
];

export default function App() {
  // ── Game phase ────────────────────────────────────────────────────
  const [phase, setPhase]               = useState<"setup" | "playing">("setup");
  const [allPlayers, setAllPlayers]     = useState<Player[]>([]);
  const [userTeamAbbr, setUserTeamAbbr] = useState<string>("");
  const [userTeamMeta, setUserTeamMeta] = useState<TeamMeta | null>(null);
  const [gm, setGm]                     = useState<GMProfile | null>(null);

  // ── Nav state ─────────────────────────────────────────────────────
  const [primaryTab, setPrimaryTab] = useState("dashboard");
  const [screen, setScreen]         = useState("dashboard");
  const [detail, setDetail]         = useState<any>(null);
  const [isMobile, setIsMobile]     = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  const WEEK   = 1;
  const SEASON = 2025;

  const handleScreenChange = (s: string) => {
    const parent = ARCHITECTURE.find(a => a.id === s || a.subs?.find(sub => sub.id === s));
    if (parent) setPrimaryTab(parent.id);
    setScreen(s);
    setDetail(null);
  };

  if (typeof window !== "undefined") {
    window.addEventListener("resize", () => setIsMobile(window.innerWidth < 768));
  }

  // ── Franchise start callback ──────────────────────────────────────
  function handleGameStart(data: GameStartData) {
    setAllPlayers(data.players);
    setUserTeamAbbr(data.teamAbbr);
    setUserTeamMeta(data.teamMeta);
    setGm(data.gm);
    setPhase("playing");
  }

  // ── Show setup until franchise is configured ──────────────────────
  if (phase === "setup") {
    return <TeamSelectScreen onStart={handleGameStart} />;
  }

  // ── Derived data ──────────────────────────────────────────────────
  const teamPlayers   = allPlayers.filter(p => p.teamId === userTeamAbbr);
  const currentPillar = ARCHITECTURE.find(a => a.id === primaryTab);
  const unreadInbox   = 0;

  const renderScreen = () => {
    switch (screen) {
      case "dashboard":
        return (
          <DashboardScreen
            week={WEEK} season={SEASON}
            setScreen={setScreen} setDetail={setDetail}
            players={teamPlayers}
            userTeam={userTeamMeta!}
            gm={gm!}
          />
        );
      case "roster":
        return <RosterScreen setScreen={setScreen} setDetail={setDetail} players={teamPlayers} />;
      case "playerProfile":
        return <PlayerProfileScreen player={detail} setScreen={setScreen} />;
      case "draft":      return <DraftScreen />;
      case "finances":   return <FinancesScreen />;
      case "inbox":      return <InboxScreen />;
      case "schedule":   return <ScheduleScreen />;
      case "staff":      return <StaffScreen />;
      case "freeAgency": return <FreeAgencyScreen />;
      case "trade":      return <TradeScreen />;
      case "trophies":   return <TrophyScreen />;
      default:
        return (
          <DashboardScreen
            week={WEEK} season={SEASON}
            setScreen={setScreen} setDetail={setDetail}
            players={teamPlayers}
            userTeam={userTeamMeta!}
            gm={gm!}
          />
        );
    }
  };

  return (
    <div style={{
      display: "flex", flexDirection: "row", height: "100vh", overflow: "hidden",
      background: COLORS.bg, fontFamily: FONT.system, color: COLORS.light,
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { max-width: 100%; overflow-x: hidden; background: ${COLORS.bg}; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: ${COLORS.bg}; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.darkMagenta}; border-radius: 3px; }
        select { outline: none; }
        button { transition: all 0.12s; }
        button:not(:disabled):hover { filter: brightness(1.15); }
        input { font-family: inherit; }
      `}</style>

      {/* Desktop Sidebar */}
      {!isMobile && (
        <nav style={{
          width: 240, background: COLORS.bg, borderRight: `1px solid ${COLORS.darkMagenta}`,
          display: "flex", flexDirection: "column", flexShrink: 0,
          height: "100vh", overflowY: "auto", zIndex: 200,
        }}>
          <div style={{ padding: "20px 16px", borderBottom: `1px solid ${COLORS.darkMagenta}` }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.light, letterSpacing: -0.3 }}>FM 2025</div>
            <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 3 }}>
              {userTeamMeta ? `${userTeamMeta.city} ${userTeamMeta.name}` : ""} · GM {gm?.lastName}
            </div>
          </div>

          <div style={{ flex: 1, padding: "12px 0", overflowY: "auto", display: "flex", flexDirection: "column", gap: 1 }}>
            {ARCHITECTURE.map(item => {
              const Icon = item.icon;
              return (
                <div key={item.id}>
                  <button onClick={() => { setPrimaryTab(item.id); setScreen(item.defaultScreen); setDetail(null); }} style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 16px",
                    background: primaryTab === item.id ? "rgba(141,36,110,0.4)" : "transparent",
                    border: "none", borderLeft: primaryTab === item.id ? `4px solid ${COLORS.lime}` : "4px solid transparent",
                    color: primaryTab === item.id ? COLORS.lime : COLORS.muted,
                    fontSize: 13, fontWeight: primaryTab === item.id ? 700 : 500,
                    cursor: "pointer", transition: "all 0.15s",
                  }}>
                    <Icon size={16} />
                    <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
                  </button>

                  {primaryTab === item.id && item.subs && (
                    <div style={{ padding: "0 12px 8px 12px", display: "flex", flexDirection: "column", gap: 3 }}>
                      {item.subs.map(sub => (
                        <button key={sub.id} onClick={() => handleScreenChange(sub.id)} style={{
                          padding: "6px 10px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                          background: screen === sub.id ? "rgba(141,36,110,0.3)" : "transparent",
                          color: screen === sub.id ? COLORS.lime : COLORS.muted,
                          border: `1px solid ${screen === sub.id ? COLORS.magenta : "transparent"}`,
                          cursor: "pointer", transition: "all 0.15s", width: "100%", textAlign: "left",
                        }}>
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ marginTop: 16, padding: "0 12px" }}>
              <button onClick={() => handleScreenChange("inbox")} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 16px",
                background: screen === "inbox" ? "rgba(141,36,110,0.4)" : "transparent",
                border: "none", borderLeft: screen === "inbox" ? `4px solid ${COLORS.lime}` : "4px solid transparent",
                color: screen === "inbox" ? COLORS.lime : COLORS.muted,
                fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s", position: "relative",
              }}>
                <Mail size={16} />
                <span style={{ flex: 1, textAlign: "left" }}>Inbox</span>
                {unreadInbox > 0 && (
                  <span style={{
                    background: COLORS.magenta, color: COLORS.light,
                    borderRadius: 10, padding: "2px 6px", fontSize: 8, fontWeight: 800,
                  }}>{unreadInbox}</span>
                )}
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main style={{
        flex: 1, display: "flex", flexDirection: "column",
        height: "100vh", overflow: "hidden",
      }}>
        {isMobile && (
          <div style={{ background: COLORS.bg, borderBottom: `1px solid ${COLORS.darkMagenta}`, zIndex: 100, flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.light }}>FM 2025</div>
              <button onClick={() => handleScreenChange("inbox")} style={{
                background: "rgba(141,36,110,0.2)", border: `1px solid ${COLORS.darkMagenta}`,
                borderRadius: 8, padding: "6px 10px", color: COLORS.lime, fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}>Inbox</button>
            </div>
            {currentPillar?.subs && (
              <div style={{ display: "flex", overflowX: "auto", padding: "0 16px 12px 16px", gap: 8 }}>
                {currentPillar.subs.map(sub => (
                  <button key={sub.id} onClick={() => setScreen(sub.id)} style={{
                    padding: "6px 16px", borderRadius: 16, fontSize: 11, fontWeight: 700,
                    whiteSpace: "nowrap", border: "none", cursor: "pointer",
                    background: screen === sub.id ? COLORS.lime : "rgba(116,0,86,0.4)",
                    color: screen === sub.id ? COLORS.bg : COLORS.light,
                  }}>
                    {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? 16 : 30 }}>
          {renderScreen()}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      {isMobile && (
        <nav style={{
          width: "100%", background: COLORS.bg, borderTop: `1px solid ${COLORS.darkMagenta}`,
          display: "flex", flexDirection: "row", flexShrink: 0,
          position: "fixed", bottom: 0, left: 0, height: 65, zIndex: 200,
        }}>
          {ARCHITECTURE.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => { setPrimaryTab(item.id); setScreen(item.defaultScreen); setDetail(null); }} style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                background: primaryTab === item.id ? "rgba(141,36,110,0.15)" : "transparent",
                border: "none", borderTop: primaryTab === item.id ? `3px solid ${COLORS.magenta}` : "3px solid transparent",
                color: primaryTab === item.id ? COLORS.light : COLORS.muted,
                cursor: "pointer",
              }}>
                <Icon size={20} color={primaryTab === item.id ? COLORS.lime : COLORS.muted} />
                <span style={{ fontSize: 9, fontWeight: primaryTab === item.id ? 700 : 500 }}>{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
