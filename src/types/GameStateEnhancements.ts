/**
 * Game State Manager Enhancements: Enhanced Draft System with Mandatory Completion Validation
 * Converted from Swift GameStateManager+DraftEnhancements.swift
 * Extends game state with advanced draft validation, week advancement control, and season lifecycle
 */

import { Position, DraftProspect, ALL_POSITIONS } from "./nfl-types";
import { Player, PlayerStatus } from "./player";
import { Team } from "./team";
import { DraftCompletionManager } from "./DraftCompletionSystem";

// ============================================================================
// SEASON PHASE ENUM
// ============================================================================

export enum SeasonPhase {
  OFFSEASON = "Offseason",
  DRAFT = "Draft",
  FREE_AGENCY = "Free Agency",
  REGULAR_SEASON = "Regular Season",
  PLAYOFFS = "Playoffs",
}

// ============================================================================
// ENHANCED GAME STATE INTERFACE
// ============================================================================

export interface EnhancedGameState {
  // Core state
  teams: Team[];
  allPlayers: Player[];
  freeAgents: Player[];
  draftPicks: Array<{
    year: number;
    round: number;
    originalTeamId: string;
    currentTeamId: string;
  }>;
  draftProspects: DraftProspect[];

  // Draft state
  isDraftActive: boolean;
  isDraftOrderLocked: boolean;
  currentDraftRound: number;
  currentDraftPick: number;
  draftOrder: string[]; // Team IDs in draft order

  // Season state
  currentSeason: number;
  currentWeek: number;
  currentPhase: SeasonPhase;
  currentGameDate: GameDate;

  // User
  userTeamId?: string;

  // Managers
  draftCompletionManager: DraftCompletionManager;
  socialTimelineManager?: {
    inbox: Array<{ requiresAction: boolean }>;
  };

  // Methods
  addNotification: (options: any) => void;
}

// ============================================================================
// GAME DATE UTILITIES
// ============================================================================

export interface GameDate {
  day: number;
  month: number;
  year: number;
  seasonPhase: SeasonPhase;

  skipDays: (days: number) => void;
}

/**
 * Create a game date
 */
export function createGameDate(year: number): GameDate {
  return {
    day: 1,
    month: 1,
    year,
    seasonPhase: SeasonPhase.OFFSEASON,
    skipDays: function(days: number) {
      // Simple simulation - just update month based on days
      // In real app, would track actual calendar
      const currentDayOfYear = this.month * 30 + this.day;
      const newDayOfYear = currentDayOfYear + days;
      this.month = Math.floor(newDayOfYear / 30);
      this.day = newDayOfYear % 30;

      // Update season phase based on month
      if (this.month <= 3) {
        this.seasonPhase = SeasonPhase.OFFSEASON;
      } else if (this.month === 4) {
        this.seasonPhase = SeasonPhase.DRAFT;
      } else if (this.month === 5) {
        this.seasonPhase = SeasonPhase.FREE_AGENCY;
      } else if (this.month <= 10) {
        this.seasonPhase = SeasonPhase.REGULAR_SEASON;
      } else {
        this.seasonPhase = SeasonPhase.PLAYOFFS;
      }

      // Handle season rollover
      if (this.month > 12) {
        this.year++;
        this.month = this.month % 12;
      }
    },
  };
}

// ============================================================================
// ENHANCED GAME STATE FUNCTIONS
// ============================================================================

/**
 * Check if user can advance week
 * Blocks advancement if:
 * 1. Critical inbox messages require response
 * 2. Draft completed but summary not viewed
 */
export function canAdvanceWeek(gameState: EnhancedGameState): boolean {
  // Check for pending inbox actions
  if (
    gameState.socialTimelineManager &&
    gameState.socialTimelineManager.inbox.some((m) => m.requiresAction)
  ) {
    return false;
  }

  // Block if draft complete but summary not viewed
  const draftState = gameState.draftCompletionManager.getState();
  if (draftState.isDraftCompleted && !draftState.canAdvanceWeek) {
    return false;
  }

  return true;
}

/**
 * Validate draft state before advancement
 */
export function validateDraftStateBeforeAdvancement(
  gameState: EnhancedGameState
): void {
  // Validate draft is active
  if (!gameState.isDraftActive) {
    throw new Error("🚨 VALIDATION FAILED: Attempting to advance inactive draft");
  }

  // Validate draft order is locked
  if (!gameState.isDraftOrderLocked) {
    throw new Error("🚨 VALIDATION FAILED: Draft order not locked");
  }

  // Validate current pick is within bounds
  if (
    gameState.currentDraftRound < 1 ||
    gameState.currentDraftRound > 7
  ) {
    throw new Error(
      `🚨 VALIDATION FAILED: Invalid draft round: ${gameState.currentDraftRound}`
    );
  }

  if (gameState.currentDraftPick < 1 || gameState.currentDraftPick > 32) {
    throw new Error(
      `🚨 VALIDATION FAILED: Invalid draft pick: ${gameState.currentDraftPick}`
    );
  }

  // Validate we have teams
  if (gameState.teams.length < 32) {
    throw new Error(
      `🚨 VALIDATION FAILED: Insufficient teams (${gameState.teams.length}/32)`
    );
  }

  console.log("✅ Pre-advancement validation passed");
}

/**
 * Start draft with enhanced validation
 * FAIL-SAFE: All validations before draft begins
 */
export function startDraftWithValidation(gameState: EnhancedGameState): void {
  console.log("🚀 Starting draft with enhanced validation...");

  // Pre-start validation
  if (gameState.isDraftActive) {
    console.log("⚠️ Draft already active - cannot start");
    return;
  }

  const draftState = gameState.draftCompletionManager.getState();
  if (draftState.isDraftCompleted) {
    console.log("⚠️ Draft already completed - cannot restart");
    gameState.addNotification({
      title: "Draft Already Complete",
      message: "The 2025 NFL Draft has already been completed.",
      type: "milestone",
      priority: "medium",
    });
    return;
  }

  // Establish draft order if needed
  if (!gameState.isDraftOrderLocked) {
    establishDraftOrder(gameState);
  }

  // Final safety checks
  if (!gameState.isDraftOrderLocked || gameState.draftOrder.length < 32) {
    throw new Error(
      "🚨 DRAFT START FAILED: Cannot start draft without proper order"
    );
  }

  // Generate prospects if needed
  if (gameState.draftProspects.length === 0) {
    generateDraftProspectsForSeason(gameState);
  }

  // Initialize draft state
  gameState.currentDraftRound = 1;
  gameState.currentDraftPick = 1;
  gameState.isDraftActive = true;

  // Reset completion manager
  const state = gameState.draftCompletionManager.getState();
  state.isDraftCompleted = false;
  state.draftIsLocked = false;
  state.canAdvanceWeek = true;

  // Announce draft start
  const firstTeam = getCurrentDraftingTeam(gameState);
  if (firstTeam) {
    gameState.addNotification({
      title: "🏈 Draft Has Begun!",
      message: `${firstTeam.name} is on the clock with the #1 pick`,
      type: "draft",
      priority: "high",
    });
  }

  console.log("✅ Draft started successfully!");
}

/**
 * Advance week with mandatory draft completion checks
 * CRITICAL: Prevents week advancement if draft incomplete
 */
export function advanceWeekWithValidation(
  gameState: EnhancedGameState
): { success: boolean; blockingReason?: string } {
  console.log("⏭️ Attempting to advance week...");

  // **CRITICAL CHECK**: Ensure draft completion workflow is finished
  const draftState = gameState.draftCompletionManager.getState();
  if (draftState.isDraftCompleted && !draftState.canAdvanceWeek) {
    return {
      success: false,
      blockingReason: "Draft completed - view summary screen to continue",
    };
  }

  // **VALIDATION**: Check if draft is active and shouldn't be
  if (gameState.isDraftActive) {
    const currentOverallPick = getCurrentOverallPick(gameState);
    if (currentOverallPick >= 224) {
      console.log(
        "🚨 EMERGENCY: Draft still active after 224 picks - forcing completion"
      );
      gameState.draftCompletionManager.validateDraftCompletion(
        currentOverallPick,
        gameState.currentDraftRound,
        gameState.currentDraftPick
      );
      return {
        success: false,
        blockingReason:
          "Draft completion in progress - try again in a moment",
      };
    }

    return { success: false, blockingReason: "Cannot advance during active draft" };
  }

  // Standard week advancement
  incrementWeek(gameState);

  console.log("✅ Week advanced successfully");
  return { success: true };
}

/**
 * Standard week advancement (internal)
 */
function incrementWeek(gameState: EnhancedGameState): void {
  // Advance to next week
  gameState.currentGameDate.skipDays(7);
  gameState.currentWeek++;

  // NEW: Auto-cleanup prospects at Week 22
  if (gameState.currentWeek === 22) {
    console.log(
      "🧹 Week 22 Auto-Cleanup: Converting remaining prospects to Free Agents"
    );
    gameState.draftCompletionManager.finalizePostDraft(gameState, gameState.allPlayers);
  }

  // Handle season transitions
  if (gameState.currentWeek === 1 && gameState.currentSeason > 2025) {
    console.log(
      `🏈 Season ${gameState.currentSeason - 1} complete! Transitioning to Season ${gameState.currentSeason}...`
    );

    // Regenerate draft picks for new season
    regenerateDraftPicksForNewSeason(gameState);

    // Reset team records
    for (const team of gameState.teams) {
      team.wins = 0;
      team.losses = 0;
      team.ties = 0;
    }

    // Unlock draft for next season
    gameState.isDraftOrderLocked = false;
    gameState.isDraftActive = false;
    const state = gameState.draftCompletionManager.getState();
    state.isDraftCompleted = false;
    state.draftIsLocked = false;
    state.canAdvanceWeek = true;

    gameState.addNotification({
      title: "New Season Begins",
      message: `Welcome to the ${gameState.currentSeason} NFL Season!`,
      type: "milestone",
      priority: "high",
    });
  }

  // Week 1: Generate draft prospects early
  if (gameState.currentWeek === 1 && gameState.draftProspects.length === 0) {
    console.log(
      `🏗️ Week 1: Generating draft class for ${gameState.currentSeason} Draft`
    );
    generateDraftProspectsForSeason(gameState);
  }

  gameState.addNotification({
    title: "Week Advanced",
    message: `Now in Week ${gameState.currentWeek} of the ${gameState.currentSeason} season (${gameState.currentPhase})`,
    type: "milestone",
    priority: "low",
  });
}

// ============================================================================
// DRAFT MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Get current overall pick number (1-224)
 */
export function getCurrentOverallPick(gameState: EnhancedGameState): number {
  return (gameState.currentDraftRound - 1) * 32 + gameState.currentDraftPick;
}

/**
 * Get the team currently drafting
 */
export function getCurrentDraftingTeam(
  gameState: EnhancedGameState
): Team | undefined {
  if (gameState.currentDraftPick < 1 || gameState.currentDraftPick > 32) {
    return undefined;
  }

  const teamId = gameState.draftOrder[gameState.currentDraftPick - 1];
  return gameState.teams.find((t) => t.id === teamId);
}

/**
 * Establish draft order (inverse standings)
 */
function establishDraftOrder(gameState: EnhancedGameState): void {
  console.log("📋 Establishing draft order...");

  // Sort teams by win percentage (ascending = worst first)
  const orderedTeams = [...gameState.teams].sort((a, b) => {
    const aWinPct = a.wins / Math.max(a.wins + a.losses, 1);
    const bWinPct = b.wins / Math.max(b.wins + b.losses, 1);
    return aWinPct - bWinPct;
  });

  // Create 7-round draft order
  const draftOrder: string[] = [];
  for (let round = 0; round < 7; round++) {
    for (const team of orderedTeams) {
      draftOrder.push(team.id);
    }
  }

  gameState.draftOrder = draftOrder;
  gameState.isDraftOrderLocked = true;

  console.log("✅ Draft order established");
}

/**
 * Regenerate draft picks for new season
 */
function regenerateDraftPicksForNewSeason(gameState: EnhancedGameState): void {
  const newYear = gameState.currentSeason + 1;
  console.log(`📋 Regenerating draft picks for ${newYear} season...`);

  // Remove old current year picks
  gameState.draftPicks = gameState.draftPicks.filter(
    (p) => p.year !== gameState.currentSeason
  );

  // Generate fresh picks
  for (let round = 1; round <= 7; round++) {
    for (const team of gameState.teams) {
      gameState.draftPicks.push({
        year: newYear,
        round,
        originalTeamId: team.id,
        currentTeamId: team.id,
      });
    }
  }

  console.log(`✅ Generated ${7 * 32} draft picks for ${newYear} season`);
}

/**
 * Generate draft prospects for upcoming draft class
 */
function generateDraftProspectsForSeason(gameState: EnhancedGameState): void {
  if (gameState.draftProspects.length > 0) {
    console.log("⚠️ Draft prospects already exist for this season");
    return;
  }

  console.log(`🏗️ Generating ${gameState.currentSeason} draft class prospects...`);

  for (let i = 1; i <= 300; i++) {
    const position = ALL_POSITIONS[Math.floor(Math.random() * ALL_POSITIONS.length)];

    const prospect: DraftProspect = {
      id: Math.random().toString(36).substr(2, 9),
      firstName: generateRandomFirstName(),
      lastName: generateRandomLastName(),
      position: position as Position,
      college: generateRandomCollege(),
      height: generateHeight(position as Position),
      weight: generateWeight(position as Position),
      age: Math.floor(Math.random() * 5) + 20,
      overallRank: i,
      positionRank: Math.floor(i / 11) + 1,
      projectedRound: calculateProjectedRound(i),
      scoutingGrade: generateScoutingGrade(i),
      bigBoard: i,
      attributes: generateAttributes(position as Position),
      personality: {
        leadership: Math.floor(Math.random() * 100),
        coachability: Math.floor(Math.random() * 100),
        motivation: Math.floor(Math.random() * 100),
        teamOrientation: Math.floor(Math.random() * 100),
        workEthic: Math.floor(Math.random() * 100),
        intelligence: Math.floor(Math.random() * 100),
      },
      combineResults: undefined,
      medicalGrade: generateMedicalGrade(),
      characterGrade: generateCharacterGrade(),
      workEthic: Math.floor(Math.random() * 100),
      coachability: Math.floor(Math.random() * 100),
      overall: 0,
      potential: 0,
      trueOverall: Math.floor(Math.random() * 40) + 50, // Placeholder for generation logic
      truePotential: Math.floor(Math.random() * 40) + 60,
    };

    gameState.draftProspects.push(prospect);
  }

  console.log(
    `✅ Generated ${gameState.draftProspects.length} draft prospects for ${gameState.currentSeason} draft class`
  );
}

// ============================================================================
// PROSPECT GENERATION HELPERS
// ============================================================================

function generateRandomFirstName(): string {
  const names = [
    "Jayden",
    "Aiden",
    "Mason",
    "Logan",
    "Lucas",
    "Jackson",
    "Noah",
    "Ethan",
    "Carter",
    "Owen",
    "Connor",
    "Caleb",
    "Blake",
    "Carson",
    "Tyler",
  ];
  return names[Math.floor(Math.random() * names.length)];
}

function generateRandomLastName(): string {
  const names = [
    "Johnson",
    "Williams",
    "Brown",
    "Jones",
    "Garcia",
    "Miller",
    "Davis",
    "Rodriguez",
    "Martinez",
    "Hernandez",
    "Lopez",
    "Gonzalez",
    "Wilson",
    "Anderson",
    "Thomas",
  ];
  return names[Math.floor(Math.random() * names.length)];
}

function generateRandomCollege(): string {
  const colleges = [
    "Alabama",
    "Georgia",
    "Ohio State",
    "Clemson",
    "LSU",
    "Oklahoma",
    "Texas",
    "Notre Dame",
    "Penn State",
    "Michigan",
    "Florida",
    "Auburn",
    "Tennessee",
    "USC",
    "Oregon",
    "Miami",
    "Florida State",
    "Texas A&M",
    "Wisconsin",
    "Iowa",
  ];
  return colleges[Math.floor(Math.random() * colleges.length)];
}

function generateHeight(position: Position): string {
  let heightInches: number;

  switch (position) {
    case "QB":
      heightInches = Math.floor(Math.random() * 7) + 72;
      break;
    case "RB":
      heightInches = Math.floor(Math.random() * 7) + 66;
      break;
    case "WR":
      heightInches = Math.floor(Math.random() * 9) + 68;
      break;
    case "TE":
      heightInches = Math.floor(Math.random() * 7) + 74;
      break;
    case "OL":
      heightInches = Math.floor(Math.random() * 7) + 76;
      break;
    case "DL":
      heightInches = Math.floor(Math.random() * 7) + 74;
      break;
    case "LB":
      heightInches = Math.floor(Math.random() * 7) + 70;
      break;
    case "CB":
      heightInches = Math.floor(Math.random() * 7) + 68;
      break;
    case "S":
      heightInches = Math.floor(Math.random() * 5) + 70;
      break;
    case "K":
    case "P":
      heightInches = Math.floor(Math.random() * 7) + 70;
      break;
    default:
      heightInches = 72;
  }

  return `${Math.floor(heightInches / 12)}'${heightInches % 12}"`;
}

function generateWeight(position: Position): number {
  switch (position) {
    case "QB":
      return Math.floor(Math.random() * 41) + 200;
    case "RB":
      return Math.floor(Math.random() * 41) + 180;
    case "WR":
      return Math.floor(Math.random() * 41) + 170;
    case "TE":
      return Math.floor(Math.random() * 31) + 240;
    case "OL":
      return Math.floor(Math.random() * 41) + 300;
    case "DL":
      return Math.floor(Math.random() * 61) + 260;
    case "LB":
      return Math.floor(Math.random() * 41) + 220;
    case "CB":
      return Math.floor(Math.random() * 31) + 170;
    case "S":
      return Math.floor(Math.random() * 31) + 190;
    case "K":
    case "P":
      return Math.floor(Math.random() * 31) + 180;
    default:
      return 220;
  }
}

function generateAttributes(position: Position) {
  const attr: any = {};

  // Base values
  attr.stamina = Math.floor(Math.random() * 31) + 60;
  attr.awareness = Math.floor(Math.random() * 31) + 50;
  attr.discipline = Math.floor(Math.random() * 46) + 50;
  attr.speed = Math.floor(Math.random() * 31) + 60;
  attr.strength = Math.floor(Math.random() * 31) + 60;
  attr.agility = Math.floor(Math.random() * 31) + 60;
  attr.jumping = Math.floor(Math.random() * 31) + 60;
  attr.hands = Math.floor(Math.random() * 31) + 60;
  attr.footwork = Math.floor(Math.random() * 31) + 60;
  attr.fieldVision = Math.floor(Math.random() * 31) + 60;
  attr.competitiveness = Math.floor(Math.random() * 31) + 60;
  attr.decisionMaking = Math.floor(Math.random() * 31) + 60;

  return attr;
}

function calculateProjectedRound(rank: number): number {
  if (rank <= 32) return 1;
  if (rank <= 64) return 2;
  if (rank <= 96) return 3;
  if (rank <= 128) return 4;
  if (rank <= 160) return 5;
  if (rank <= 192) return 6;
  return 7;
}

function generateScoutingGrade(rank: number): string {
  if (rank <= 10) return "A+";
  if (rank <= 30) return "A";
  if (rank <= 60) return "B+";
  if (rank <= 100) return "B";
  if (rank <= 150) return "C+";
  if (rank <= 200) return "C";
  if (rank <= 250) return "D+";
  return "D";
}

function generateMedicalGrade(): string {
  const grades = ["A", "B", "C", "D"];
  return grades[Math.floor(Math.random() * grades.length)];
}

function generateCharacterGrade(): string {
  const grades = ["A", "B", "C", "D"];
  return grades[Math.floor(Math.random() * grades.length)];
}
