/**
 * Franchise Manager — Main App Shell
 *
 * Architecture rules (Observer Pattern):
 *  - The GameStateManager is the single source of truth for ALL game data.
 *  - This shell owns zero game state. It holds only UI/nav state.
 *  - `refresh()` is registered as `gameStateManager.onEngineStateChange` so any
 *    engine mutation (advance, interrupt, auto-save) triggers a React re-render.
 *  - Components read data from the manager via props or direct import; they never
 *    own a copy.
 */

import { useState, useCallback, useEffect } from "react";
import { COLORS, FONT } from "./ui/theme";
import { LayoutDashboard, Users, Briefcase, Trophy, Mail, FinancialHealthBadge, RatingBadge, PosTag, Toast } from "./ui/components";
import { HoldoutModal, BlackMondayModal } from "./ui/Overlays";
import { TransactionTicker } from "./ui/TransactionTicker";
import { RESPONSIVE_CSS } from "./constants/responsive-css";

import { TeamSelectScreen, GameStartData, TeamMeta, GMProfile, NFL_TEAMS } from "./screens/TeamSelectScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { RosterScreen } from "./screens/RosterScreen";
import { PlayerProfileScreen } from "./screens/PlayerProfileScreen";
import { LoadGameScreen } from "./screens/LoadGameScreen";
import { DraftScreen } from "./screens/DraftScreen";
import { DraftEntryScreen } from "./screens/DraftEntryScreen";
import { FinancesScreen } from "./screens/FinancesScreen";
import { InboxScreen } from "./screens/InboxScreen";
import { ReviewTradeOfferScreen } from "./screens/ReviewTradeOfferScreen";
import { OffseasonGradeScreen } from "./screens/OffseasonGradeScreen";
import { ScheduleScreen } from "./screens/ScheduleScreen";
import { FrontOfficeScreen } from "./screens/FrontOfficeScreen";
import { FreeAgencyScreen } from "./screens/FreeAgencyScreen";
import { ContractNegotiationScreen } from "./screens/ContractNegotiationScreen";
import { TradeScreen } from "./screens/TradeScreen";
import { TradeHistoryScreen } from "./screens/TradeHistoryScreen";
import { TrophyScreen } from "./screens/TrophyScreen";
import { PlayoffBracketScreen } from "./screens/PlayoffBracketScreen";
import { PostDraftSummaryScreen } from "./screens/PostDraftSummaryScreen";
import { DraftLeadUpScreen } from "./screens/DraftLeadUpScreen";
import { RFATenderingScreen } from "./screens/RFATenderingScreen";
import { gameStateManager } from "./types/GameStateManager";
import { SimulationState } from "./types/GameStateManager";
import { HardStopReason } from "./types/engine-types";
import { establishDraftOrder } from "./types/DraftSystem";
import { gameStore } from "./stores/GameStore";

// ─── Navigation Architecture ───────────────────────────────────────
const ARCHITECTURE = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, defaultScreen: "dashboard" },
  {
    id: "team", label: "Team", icon: Users, defaultScreen: "roster",
    subs: [
      { id: "roster", label: "Roster" },
      { id: "staff", label: "Front Office" },
    ]
  },
  {
    id: "office", label: "Office", icon: Briefcase, defaultScreen: "trade",
    subs: [
      { id: "trade", label: "Trade Center" },
      { id: "freeAgency", label: "Free Agency" },
      { id: "rfa", label: "RFA Tenders" },
      { id: "draft", label: "Draft Board" },
      { id: "finances", label: "Finances" },
    ]
  },
  {
    id: "league", label: "League", icon: Trophy, defaultScreen: "schedule",
    subs: [
      { id: "schedule", label: "Schedule" },
      { id: "bracket", label: "Playoff Bracket" },
      { id: "trophies", label: "Trophies" },
    ]
  },
];

export default function App() {
  // ── UI-only state (no game data here) ─────────────────────────────
  const [phase, setPhase]               = useState<"setup" | "load" | "playing">("setup");
  const [userTeamMeta, setUserTeamMeta] = useState<TeamMeta | null>(null);
  const [gm, setGm]                     = useState<GMProfile | null>(null);

  // Version counter: increment to re-read manager state after mutations
  const [, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(v => v + 1), []);

  // ── Nav state ─────────────────────────────────────────────────────
  const [primaryTab, setPrimaryTab] = useState("dashboard");
  const [screen, setScreen]         = useState("dashboard");
  const [detail, setDetail]         = useState<any>(null);
  const [isMobile, setIsMobile]     = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Local state for modal-based negotiation (League Year Reset)
  const [negotiatingPlayerId, setNegotiatingPlayerId] = useState<string | null>(null);

  // State for narrative overlays
  const [holdoutPlayer, setHoldoutPlayer] = useState<any>(null);
  const [showBlackMonday, setShowBlackMonday] = useState(false);

  // ── Asset Resilience: Fetch Logo ──────────────────────────────────
  const [teamLogo, setTeamLogo] = useState<string | null>(null);
  useEffect(() => {
    const fetchLogo = async () => {
      if (!gameStateManager.userTeamId) return;
      try {
        // Try local path first (relative to public root)
        const response = await fetch("/data/teams_colors_logos.json");
        if (!response.ok) throw new Error("Local not found");
        const data = await response.json();
        const teamData = data.find((t: any) => t.team_abbr === gameStateManager.userTeamId);
        if (teamData) setTeamLogo(teamData.team_logo_espn);
      } catch {
        try {
          // Fallback to GitHub if local fails
          const response = await fetch("https://github.com/nflverse/nflverse-data/releases/download/manually_updated/teams_colors_logos.json");
          const data = await response.json();
          const teamData = data.find((t: any) => t.team_abbr === gameStateManager.userTeamId);
          if (teamData) setTeamLogo(teamData.team_logo_espn);
        } catch (e) {
          console.warn("Failed to fetch team logo from local or GitHub", e);
        }
      }
    };
    fetchLogo();
  }, [gameStateManager.userTeamId]);

  // ── Engine-derived values (read from manager, not local state) ────
  // These are re-evaluated on every render triggered by refresh()
  const WEEK    = gameStateManager.currentGameDate.week;
  const SEASON  = gameStateManager.currentGameDate.season;
  const PHASE_LABEL = gameStateManager.enginePhaseLabel;
  const simState    = gameStateManager.simulationState;
  const isSimulating = simState === SimulationState.SIMULATING;
  const hasCriticalError = simState === SimulationState.CRITICAL_ERROR;
  const activeInterrupt  = gameStateManager.engineActiveInterrupt;
  const unreadInbox = gameStateManager.inbox.filter(m => !m.isRead).length;

  const userTeam = gameStateManager.userTeam;
  const capSpace = userTeam ? gameStateManager.getCapSpace(userTeam.id) : 0;

  const handleScreenChange = (s: string) => {
    const parent = ARCHITECTURE.find(a => a.id === s || a.subs?.find(sub => sub.id === s));
    if (parent) setPrimaryTab(parent.id);
    setScreen(s);
    setDetail(null);
  };

  // ── Franchise start callback ──────────────────────────────────────
  function handleGameStart(data: GameStartData) {
    // The manager is the single source of truth
    gameStateManager.initializeGM(data.gm.firstName, data.gm.lastName);

    // Populate teams from static metadata
    gameStateManager.teams = NFL_TEAMS.map(t => ({
      id: t.abbr,
      abbreviation: t.abbr,
      city: t.city,
      name: t.name,
      conference: t.conf,
      division: t.div,
      wins: 0,
      losses: 0,
      ties: 0,
      capSpace: 255_000_000,
      cashReserves: 100_000_000,
      offenseRating: 75,
      defenseRating: 75,
      specialTeamsRating: 75,
      prestige: 75,
      marketSize: "Medium",
      ownerPatience: 50,
      fanLoyalty: 50,
      coachingStaff: [],
      frontOffice: [],
    } as any));

    gameStateManager.selectUserTeam(data.teamAbbr);
    gameStateManager.allPlayers = data.players;
    gameStateManager.generateInitialDraftPicks();
    // Generate initial draft prospects for the current season
    gameStateManager.initializeDraftProspects();
    // Establish draft order based on team records
    gameStateManager.draftOrder = establishDraftOrder(gameStateManager.teams);
    gameStateManager.updateAllTeamRatings();

    // Wire both callbacks to refresh so engine mutations trigger re-renders
    gameStateManager.onAutoSave = () => {
      gameStateManager.syncToStore(gameStore);
      gameStore.saveGame("AutoSave");
    };
    gameStateManager.onEngineStateChange = refresh;

    // Seed the store for saveGame
    gameStore.initializeNewGame(data.gm.firstName, data.gm.lastName, data.teamAbbr);
    gameStore.allPlayers = data.players;
    gameStore.draftPicks = gameStateManager.draftPicks;

    setUserTeamMeta(data.teamMeta);
    setGm(data.gm);
    setPhase("playing");
  }

  // ── Load Game callback ────────────────────────────────────────────
  function handleLoadGame() {
    // 1. Hydrate manager from store (which was populated by LoadGameScreen calling gameStore.loadGame)
    gameStateManager.hydrateFromStore(gameStore);

    // 2. Ensure draft prospects are loaded (for saves that might not have them)
    if (!gameStateManager.draftProspects || gameStateManager.draftProspects.length === 0) {
      gameStateManager.initializeDraftProspects();
    }

    // 2b. Ensure draft order is established (for saves that might not have it)
    if (!gameStateManager.draftOrder || gameStateManager.draftOrder.length === 0) {
      gameStateManager.draftOrder = establishDraftOrder(gameStateManager.teams);
    }

    // 3. Wire callbacks
    gameStateManager.onAutoSave = () => {
      gameStateManager.syncToStore(gameStore);
      gameStore.saveGame("AutoSave");
    };
    gameStateManager.onEngineStateChange = refresh;

    // 4. Restore UI state
    const teamId = gameStateManager.userTeamId;
    const teamMeta = NFL_TEAMS.find(t => t.abbr === teamId);
    if (teamMeta) setUserTeamMeta(teamMeta);

    if (gameStateManager.userProfile) {
      setGm({
        firstName: gameStateManager.userProfile.firstName,
        lastName: gameStateManager.userProfile.lastName,
        age: 35, // Default (not persisted in SaveData/UserProfile)
        style: "analytics", // Default
      });
    }

    // 5. Start game
    setPhase("playing");
  }

  // ── Advance Week handler ──────────────────────────────────────────
  async function handleAdvance() {
    await gameStateManager.advance();
    refresh(); // final re-render after loop exits (catches any state missed by onEngineStateChange)
  }

  // ── AI Trade Offer response ───────────────────────────────────────
  function handleTradeResponse(action: "accept" | "reject" | "negotiate") {
    gameStateManager.resolveEngineInterrupt({
      reason:   HardStopReason.TRADE_OFFER_RECEIVED,
      accepted: action === "accept",
      navigate: action === "negotiate" ? true : undefined,
    });
    if (action === "negotiate") {
      handleScreenChange("trade"); // navigate to trade screen; pendingAITradeOffer stays set
    }
    refresh();
  }

  // ── Show setup until franchise is configured ──────────────────────
  if (phase === "setup") {
    return <TeamSelectScreen onStart={handleGameStart} onLoadGame={() => setPhase("load")} />;
  }

  if (phase === "load") {
    return <LoadGameScreen onLoad={handleLoadGame} onBack={() => setPhase("setup")} />;
  }

  // ── Derived data — always from the manager ────────────────────────
  const teamPlayers   = gameStateManager.userRoster; // engine-owned, position-filtered getter
  const currentPillar = ARCHITECTURE.find(a => a.id === primaryTab);

  // Force show Post-Draft Summary if triggered
  if (gameStateManager.draftCompletionManager.showingSummaryScreen) {
    return <PostDraftSummaryScreen gsm={gameStateManager} onDismiss={refresh} />;
  }

  // Force show Offseason Grade after draft summary is dismissed
  if (gameStateManager.draftCompletionManager.showOffseasonGradeScreen) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 30 }}>
        <OffseasonGradeScreen
          gsm={gameStateManager}
          refresh={refresh}
        />
        <button
          onClick={() => {
            gameStateManager.draftCompletionManager.showOffseasonGradeScreen = false;
            gameStateManager.draftCompletionManager.canAdvanceWeek = true;
            refresh();
          }}
          style={{
            marginTop: "auto", padding: "12px 24px", borderRadius: 8,
            background: COLORS.lime, color: COLORS.bg, border: "none",
            fontSize: 12, fontWeight: 700, cursor: "pointer", alignSelf: "flex-start"
          }}
        >
          Advance to Season
        </button>
      </div>
    );
  }

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
            gsm={gameStateManager}
          />
        );
      case "roster":
        return <RosterScreen setScreen={setScreen} setDetail={setDetail} players={teamPlayers} />;
      case "playerProfile":
        return <PlayerProfileScreen player={detail} setScreen={setScreen} />;
      case "draft":
        // Week 15 is Draft Day
        if (gameStateManager.currentGameDate.week === 15) {
          // Before Thursday (Day 4): Show Lead-Up screen
          if (gameStateManager.currentGameDate.dayOfWeek < 4) {
            return <DraftLeadUpScreen gsm={gameStateManager} onAdvance={() => { gameStateManager.currentGameDate.dayOfWeek = 4; refresh(); }} />;
          }
          // Thursday onwards: Show Draft Entry or Active Draft
          if (!gameStateManager.isDraftActive) {
            return (
              <DraftEntryScreen
                season={gameStateManager.currentGameDate.season}
                gsm={gameStateManager}
                onStart={() => {
                  gameStateManager.startDraft();
                  refresh();
                }}
              />
            );
          }
          return <DraftScreen userTeamAbbr={userTeamMeta?.abbr ?? ""} gsm={gameStateManager} refresh={refresh} isMobile={isMobile} />;
        }
        // All other weeks: Show regular Draft Screen (draft board for prep/trading)
        return <DraftScreen userTeamAbbr={userTeamMeta?.abbr ?? ""} gsm={gameStateManager} refresh={refresh} isMobile={isMobile} />;
      case "finances":   return <FinancesScreen gsm={gameStateManager} />;
      case "inbox":      return <InboxScreen gsm={gameStateManager} isMobile={isMobile} onNavigate={(s,d) => { setScreen(s); setDetail(d); }} refresh={refresh} />;
      case "tradeReview": return <ReviewTradeOfferScreen gsm={gameStateManager} onNavigate={(s,d) => { setScreen(s); setDetail(d); }} refresh={refresh} />;
      case "offseasonGrade": return <OffseasonGradeScreen gsm={gameStateManager} refresh={refresh} />;
      case "schedule":   return <ScheduleScreen gsm={gameStateManager} />;
      case "staff":      return <FrontOfficeScreen />;
      case "freeAgency": return <FreeAgencyScreen gsm={gameStateManager} onRosterChange={refresh} onNavigate={(s, d) => { setScreen(s); setDetail(d); }} />;
      case "rfa":        return <RFATenderingScreen gsm={gameStateManager} />;
      case "contractNegotiation": 
        return (
          <ContractNegotiationScreen 
            playerId={detail?.playerId} 
            negotiationContext={detail?.context || 'freeAgency'}
            onDone={() => { 
              setScreen(detail?.context === 'extension' ? 'roster' : 'freeAgency'); 
              setDetail(null); 
            }} 
            onRosterChange={refresh} 
          />
        );
      case "trade":      return <TradeScreen gsm={gameStateManager} refresh={refresh} />;
      case "tradeHistory": return <TradeHistoryScreen gsm={gameStateManager} />;
      case "bracket":    return <PlayoffBracketScreen gsm={gameStateManager} refresh={refresh} />;
      case "trophies":   return <TrophyScreen teamAbbr={userTeamMeta?.abbr ?? ""} />;
      default:
        return (
          <DashboardScreen
            week={WEEK} season={SEASON}
            setScreen={setScreen} setDetail={setDetail}
            players={teamPlayers}
            userTeam={userTeamMeta!}
            gm={gm!}
            gsm={gameStateManager}
          />
        );
    }
  };

  // ── Advance button label / state ──────────────────────────────────
  const advanceBtnLabel = hasCriticalError
    ? "Critical Error"
    : activeInterrupt
    ? "Resolve"
    : isSimulating
    ? gameStateManager.processingLabel || "Simulating…"
    : "Advance Week";

  const advanceBtnDisabled = isSimulating || hasCriticalError || !!activeInterrupt;

  return (
    <div style={{
      display: "flex", flexDirection: "row", height: "100dvh", overflow: "hidden",
      background: COLORS.bg, fontFamily: FONT.system, color: COLORS.light,
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { max-width: 100%; overflow-x: hidden; background: ${COLORS.bg}; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: ${COLORS.bg}; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.darkMagenta}; border-radius: 3px; }
        select { outline: none; }
        select:focus-visible { outline: 2px solid ${COLORS.lime}; outline-offset: 2px; }
        button:focus-visible { outline: 2px solid ${COLORS.lime}; outline-offset: 2px; }
        button { transition: all 0.12s; }
        button:not(:disabled):hover { filter: brightness(1.15); }
        input { font-family: inherit; }
        ${RESPONSIVE_CSS}
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
        height: "100%", overflow: "hidden",
      }}>
        {/* ── Persistent Top Nav ─────────────────────────────────────── */}
        <header style={{
          flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: isMobile ? "10px 16px" : "0 24px",
          height: isMobile ? "auto" : 48,
          background: COLORS.bg,
          borderBottom: `1px solid ${COLORS.darkMagenta}`,
          zIndex: 100,
        }}>
          {/* Left: clock info */}
          <div role="status" aria-label={`Current time: Week ${WEEK}, ${PHASE_LABEL}, Season ${SEASON}`} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {isMobile && (
              <span style={{ fontSize: 13, fontWeight: 800, color: COLORS.light }}>FM 2025</span>
            )}
            {teamLogo && (
              <img src={teamLogo} alt="Team Logo" style={{ width: 24, height: 24, objectFit: "contain" }} />
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {userTeam && (
                <span style={{ fontSize: 11, fontWeight: 800, color: COLORS.light, marginRight: 4 }}>
                  {userTeam.wins}-{userTeam.losses}-{userTeam.ties}
                </span>
              )}
              <FinancialHealthBadge capSpace={capSpace} />
              <div style={{ width: 1, height: 16, background: COLORS.darkMagenta, margin: "0 4px" }} />
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                background: "rgba(215,241,113,0.1)", color: COLORS.lime,
                borderRadius: 4, padding: "2px 7px",
                border: `1px solid rgba(215,241,113,0.25)`,
              }}>
                Week {WEEK}
              </span>
              <span style={{ fontSize: 10, color: COLORS.muted }}>
                {PHASE_LABEL} · {SEASON}
              </span>
              {isSimulating && (
                <span style={{
                  fontSize: 9, color: COLORS.magenta, fontWeight: 700,
                  animation: "pulse 1s ease-in-out infinite",
                }}>
                  ●
                </span>
              )}
            </div>
          </div>

          {/* Right: advance controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {activeInterrupt && (
              <span style={{
                fontSize: 9, fontWeight: 700, color: COLORS.light,
                background: COLORS.magenta, borderRadius: 4, padding: "2px 7px",
              }}>
                {activeInterrupt.title}
              </span>
            )}
            {isSimulating ? (
              <button
                onClick={() => { gameStateManager.enginePause(); refresh(); }}
                style={{
                  background: "rgba(141,36,110,0.3)",
                  border: `1px solid ${COLORS.darkMagenta}`,
                  borderRadius: 6, padding: "5px 14px",
                  color: COLORS.muted, fontSize: 11, fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Pause
              </button>
            ) : null}
            <button
              onClick={handleAdvance}
              aria-busy={isSimulating}
              disabled={advanceBtnDisabled}
              style={{
                background: hasCriticalError
                  ? "rgba(255,50,50,0.2)"
                  : advanceBtnDisabled
                  ? "rgba(116,0,86,0.2)"
                  : `linear-gradient(135deg, ${COLORS.magenta}, ${COLORS.darkMagenta})`,
                border: `1px solid ${hasCriticalError ? "#ff3232" : COLORS.magenta}`,
                borderRadius: 6, padding: "5px 16px",
                color: advanceBtnDisabled ? COLORS.muted : COLORS.light,
                fontSize: 11, fontWeight: 700,
                cursor: advanceBtnDisabled ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                minWidth: 110,
              }}
            >
              {advanceBtnLabel}
            </button>
          </div>
        </header>

        {/* ── Mobile sub-tab bar (below header on mobile) ─────────────── */}
        {isMobile && currentPillar?.subs && (
          <div style={{
            background: COLORS.bg, borderBottom: `1px solid ${COLORS.darkMagenta}`,
            zIndex: 99, flexShrink: 0,
          }}>
            <div style={{ display: "flex", overflowX: "auto", padding: "8px 16px", gap: 8 }}>
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
          </div>
        )}

        {/* ── Screen content ───────────────────────────────────────────── */}
        <div style={{
          flex: 1, overflowY: "auto",
          padding: isMobile ? 16 : 30,
          paddingBottom: isMobile ? "calc(100px + env(safe-area-inset-bottom))" : 60,
          WebkitOverflowScrolling: "touch",
        }}>
          {renderScreen()}
        </div>

        {/* Transaction Ticker — Fixed at bottom (above mobile nav) */}
        <TransactionTicker gsm={gameStateManager} />
      </main>

      {/* ── Toast Notifications ── */}
      {gameStateManager.latestToast && (
        <Toast 
          data={gameStateManager.latestToast} 
          onClose={() => { gameStateManager.clearToast(); refresh(); }} 
        />
      )}

      {/* ── GENERIC EVENT OVERLAY (Catches unhandled interrupts like Free Agency Open so game doesn't freeze) ── */}
      {activeInterrupt && 
       activeInterrupt.reason !== HardStopReason.TRADE_OFFER_RECEIVED && 
       activeInterrupt.reason !== HardStopReason.LEAGUE_YEAR_RESET && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 500,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20
        }}>
          <div style={{
            background: COLORS.bg, border: `1px solid ${COLORS.darkMagenta}`, borderRadius: 12, padding: 28,
            maxWidth: 400, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", textAlign: "center"
          }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 800, color: COLORS.light }}>
              {activeInterrupt.title}
            </h3>
            <p style={{ fontSize: 13, color: COLORS.muted, marginBottom: 24, lineHeight: 1.5 }}>
              {activeInterrupt.description}
            </p>
            <button
              onClick={() => {
                const isRosterCut = activeInterrupt.reason === HardStopReason.ROSTER_CUTS_REQUIRED;
                if (isRosterCut) {
                  gameStateManager.resolveEngineInterrupt({ reason: activeInterrupt.reason, releasedPlayerIds: [] } as any);
                  setPrimaryTab("team");
                  setScreen("roster");
                } else {
                  gameStateManager.resolveEngineInterrupt({ reason: activeInterrupt.reason } as any);
                }
                refresh();
              }}
              style={{
                width: "100%", padding: "12px", borderRadius: 8, background: COLORS.lime, color: COLORS.bg,
                border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer"
              }}
            >
              {activeInterrupt.reason === HardStopReason.ROSTER_CUTS_REQUIRED ? "Manage Roster" : "Acknowledge & Continue"}
            </button>
          </div>
        </div>
      )}

      {/* ── TRADE_OFFER_RECEIVED modal overlay ───────────────────────────── */}
      {activeInterrupt?.reason === HardStopReason.TRADE_OFFER_RECEIVED && (() => {
        const pending    = gameStateManager.pendingAITradeOffer;
        const offeringTeam = pending ? gameStateManager.teams.find(t => t.id === pending.offeringTeamId) : null;
        const wantedPlayers = (pending?.receivingPlayerIds ?? [])
          .map(id => gameStateManager.allPlayers.find(p => p.id === id))
          .filter(Boolean) as { firstName: string; lastName: string; overall: number }[];
        const offeredPickIds = pending?.offeringPickIds ?? [];

        const formatPickId = (id: string) => {
          const parts = id.split('-');
          if (parts.length === 3) return `${parts[0]} Round ${parts[1]} (${parts[2]})`;
          return id;
        };

        return (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
            zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              background: COLORS.bg, border: `1px solid ${COLORS.darkMagenta}`,
              borderRadius: 12, padding: 28, maxWidth: 420, width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            }}>
              <div style={{ fontSize: 10, color: COLORS.magenta, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>
                Incoming Trade Offer
              </div>
              <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: COLORS.light }}>
                {offeringTeam ? `${offeringTeam.city} ${offeringTeam.name}` : "Unknown Team"}
              </h3>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>They want</div>
                {wantedPlayers.length > 0 ? wantedPlayers.map((p, i) => (
                  <div key={i} style={{ fontSize: 12, color: COLORS.light, padding: "3px 0" }}>
                    {p.firstName} {p.lastName} <span style={{ color: COLORS.muted, fontSize: 10 }}>({p.overall} OVR)</span>
                  </div>
                )) : <div style={{ fontSize: 11, color: COLORS.muted }}>No players requested</div>}
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 9, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>They offer</div>
                {offeredPickIds.length > 0 ? offeredPickIds.map((pid, i) => (
                  <div key={i} style={{ fontSize: 12, color: COLORS.lime, fontFamily: "monospace", padding: "2px 0" }}>{formatPickId(pid)}</div>
                )) : <div style={{ fontSize: 11, color: COLORS.muted }}>No picks offered</div>}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => handleTradeResponse("accept")}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: `linear-gradient(135deg, ${COLORS.magenta}, rgba(116,0,86,0.8))`,
                    border: `1px solid ${COLORS.magenta}`, color: COLORS.light, cursor: "pointer",
                  }}
                >
                  Accept
                </button>
                <button
                  onClick={() => handleTradeResponse("negotiate")}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: "rgba(245,166,35,0.15)", border: "1px solid rgba(245,166,35,0.4)",
                    color: "#f5a623", cursor: "pointer",
                  }}
                >
                  Counter Offer
                </button>
                <button
                  onClick={() => handleTradeResponse("reject")}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: "transparent", border: `1px solid ${COLORS.darkMagenta}`,
                    color: COLORS.muted, cursor: "pointer",
                  }}
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── LEAGUE_YEAR_RESET modal overlay ──────────────────────────────── */}
      {activeInterrupt?.reason === HardStopReason.LEAGUE_YEAR_RESET && (() => {
        const payload = activeInterrupt.payload as any;
        const expiringIds = (payload.expiringContracts as string[]) || [];
        // Filter to only show those who STILL have 0 years (in case user extended some)
        const expiringPlayers = expiringIds
          .map(id => gameStateManager.allPlayers.find(p => p.id === id))
          .filter(p => p && p.contract && p.contract.yearsRemaining === 0) as any[];

        if (negotiatingPlayerId) {
          return (
            <div style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)",
              zIndex: 500, display: "flex", flexDirection: "column", padding: 20
            }}>
              <div style={{ flex: 1, overflowY: "auto", background: COLORS.bg, borderRadius: 12, border: `1px solid ${COLORS.darkMagenta}`, padding: 20, maxWidth: 800, margin: "0 auto", width: "100%" }}>
                <button 
                  onClick={() => setNegotiatingPlayerId(null)}
                  style={{ marginBottom: 10, background: "transparent", border: "none", color: COLORS.muted, cursor: "pointer" }}
                >
                  ← Back to List
                </button>
                <ContractNegotiationScreen 
                  playerId={negotiatingPlayerId} 
                  onDone={() => { setNegotiatingPlayerId(null); refresh(); }} 
                  onRosterChange={refresh}
                />
              </div>
            </div>
          );
        }

        return (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
            zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              background: COLORS.bg, border: `1px solid ${COLORS.darkMagenta}`,
              borderRadius: 12, padding: 28, maxWidth: 500, width: "90%", maxHeight: "80vh", display: "flex", flexDirection: "column",
              boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            }}>
              <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: COLORS.light }}>Expiring Contracts</h3>
              <p style={{ fontSize: 12, color: COLORS.muted, marginBottom: 20 }}>
                The following players are about to become free agents. Negotiate now or they will be released.
              </p>

              <div style={{ flex: 1, overflowY: "auto", marginBottom: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                {expiringPlayers.length === 0 ? (
                  <div style={{ padding: 20, textAlign: "center", color: COLORS.lime, fontSize: 12 }}>All contracts resolved!</div>
                ) : (
                  expiringPlayers.map(p => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <PosTag pos={p.position} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.light }}>{p.firstName} {p.lastName}</div>
                          <div style={{ fontSize: 10, color: COLORS.muted }}>{p.age} yo · {p.overall} OVR</div>
                        </div>
                      </div>
                      <button onClick={() => setNegotiatingPlayerId(p.id)} style={{ padding: "6px 12px", borderRadius: 4, background: COLORS.magenta, color: COLORS.light, border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Negotiate</button>
                    </div>
                  ))
                )}
              </div>

              <button onClick={() => { gameStateManager.resolveEngineInterrupt({ reason: HardStopReason.LEAGUE_YEAR_RESET, acknowledged: true }); refresh(); }} style={{ width: "100%", padding: "12px", borderRadius: 8, background: COLORS.lime, color: COLORS.bg, border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                {expiringPlayers.length > 0 ? `Release ${expiringPlayers.length} Players & Advance` : "Finalize Season"}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Narrative Overlays (Triggered by engine events) ── */}
      {holdoutPlayer && (
        <HoldoutModal
          player={holdoutPlayer}
          onResolve={(_resolution) => setHoldoutPlayer(null)}
        />
      )}

      {showBlackMonday && (
        <BlackMondayModal
          firedCoaches={[]}
          vacancies={gameStateManager.userTeam?.coachingStaff.length === 0 ? ["Head Coach", "Offensive Coordinator", "Defensive Coordinator"] : []}
          onDismiss={() => setShowBlackMonday(false)}
        />
      )}

      {/* Mobile Bottom Nav */}
      {isMobile && (
        <nav style={{
          width: "100%", background: COLORS.bg, borderTop: `1px solid ${COLORS.darkMagenta}`,
          display: "flex", flexDirection: "row", flexShrink: 0,
          position: "fixed", bottom: 0, left: 0, zIndex: 200,
          height: "calc(65px + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)",
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
          {/* Mobile Inbox Item (Manually added to match Desktop Sidebar) */}
          <button onClick={() => { setScreen("inbox"); setDetail(null); }} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
            background: screen === "inbox" ? "rgba(141,36,110,0.15)" : "transparent",
            border: "none", borderTop: screen === "inbox" ? `3px solid ${COLORS.magenta}` : "3px solid transparent",
            color: screen === "inbox" ? COLORS.light : COLORS.muted,
            cursor: "pointer",
          }}>
            <Mail size={20} color={screen === "inbox" ? COLORS.lime : COLORS.muted} />
            <span style={{ fontSize: 9, fontWeight: screen === "inbox" ? 700 : 500 }}>Inbox</span>
          </button>
        </nav>
      )}
    </div>
  );
}
