/**
 * engine-types.ts — Single source of truth for the event-driven logic engine.
 * All new engine code imports types from here. Existing GameStateManager legacy
 * types are kept in GameStateManager.ts for backward compat with screens.
 */

// ─── Season Phase ─────────────────────────────────────────────────────────────

export enum SeasonPhase {
  SUPER_BOWL      = 'SUPER_BOWL',       // Week 1–2   (Championship + offseason begins)
  LEAGUE_YEAR_END = 'LEAGUE_YEAR_END',  // Week 3–4   (Franchise tags, contract expirations)
  FREE_AGENCY     = 'FREE_AGENCY',      // Week 5–8   (FA opens, signings, cuts)
  DRAFT_PREP      = 'DRAFT_PREP',       // Week 9–20  (Combine, pro days, pre-draft trades)
  NFL_DRAFT       = 'NFL_DRAFT',        // Week 21    (Draft rounds 1–7)
  POST_DRAFT      = 'POST_DRAFT',       // Week 22–24 (UDFA, rookie signings, mini-camp)
  PRESEASON       = 'PRESEASON',        // Week 25–28 (Games, depth chart battles)
  REGULAR_SEASON  = 'REGULAR_SEASON',   // Week 29–46 (17 games + bye weeks)
  TRADE_DEADLINE  = 'TRADE_DEADLINE',   // Week 42    (Embedded within regular season)
  PLAYOFFS        = 'PLAYOFFS',         // Week 47–51 (Wild Card through Super Bowl)
}

/** Maps each SeasonPhase to its week range for boundary checks. */
export const PHASE_WEEK_MAP: Record<SeasonPhase, { start: number; end: number }> = {
  [SeasonPhase.SUPER_BOWL]:      { start: 1,  end: 2  },
  [SeasonPhase.LEAGUE_YEAR_END]: { start: 3,  end: 4  },
  [SeasonPhase.FREE_AGENCY]:     { start: 5,  end: 8  },
  [SeasonPhase.DRAFT_PREP]:      { start: 9,  end: 20 },
  [SeasonPhase.NFL_DRAFT]:       { start: 21, end: 21 },
  [SeasonPhase.POST_DRAFT]:      { start: 22, end: 24 },
  [SeasonPhase.PRESEASON]:       { start: 25, end: 28 },
  [SeasonPhase.REGULAR_SEASON]:  { start: 29, end: 46 },
  [SeasonPhase.TRADE_DEADLINE]:  { start: 42, end: 42 },
  [SeasonPhase.PLAYOFFS]:        { start: 47, end: 51 },
};

/** Derive the engine SeasonPhase from a week number. */
export function getEnginePhaseForWeek(week: number): SeasonPhase {
  for (const [phase, range] of Object.entries(PHASE_WEEK_MAP) as [SeasonPhase, { start: number; end: number }][]) {
    if (week >= range.start && week <= range.end) return phase;
  }
  return SeasonPhase.SUPER_BOWL;
}

/** Human-readable label for display. */
export const PHASE_LABELS: Record<SeasonPhase, string> = {
  [SeasonPhase.SUPER_BOWL]:      'Super Bowl / Offseason Begins',
  [SeasonPhase.LEAGUE_YEAR_END]: 'League Year End',
  [SeasonPhase.FREE_AGENCY]:     'Free Agency',
  [SeasonPhase.DRAFT_PREP]:      'Draft Prep',
  [SeasonPhase.NFL_DRAFT]:       'NFL Draft',
  [SeasonPhase.POST_DRAFT]:      'Post-Draft',
  [SeasonPhase.PRESEASON]:       'Preseason',
  [SeasonPhase.REGULAR_SEASON]:  'Regular Season',
  [SeasonPhase.TRADE_DEADLINE]:  'Trade Deadline',
  [SeasonPhase.PLAYOFFS]:        'Playoffs',
};

// ─── Time Slot ────────────────────────────────────────────────────────────────

export enum TimeSlot {
  EARLY_MORNING    = 'EARLY_MORNING',    // Injuries, practice reports
  MID_MORNING      = 'MID_MORNING',      // AI roster evaluation
  AFTERNOON        = 'AFTERNOON',        // Player development, AI trades (non-game days)
  EVENING          = 'EVENING',          // News generation, soft recap
  GAME_PREP        = 'GAME_PREP',        // Lock lineups, generate predictions
  GAME_IN_PROGRESS = 'GAME_IN_PROGRESS', // Simulate game
  GAME_COMPLETE    = 'GAME_COMPLETE',    // Process stats, post-game injuries
  RECAP            = 'RECAP',            // Weekly summary, power rankings
}

/** Normal (non-game) day slot progression */
export const TIME_SLOT_ORDER: TimeSlot[] = [
  TimeSlot.EARLY_MORNING,
  TimeSlot.MID_MORNING,
  TimeSlot.AFTERNOON,
  TimeSlot.EVENING,
  TimeSlot.RECAP,
];

/** Game-day slot progression */
export const GAME_DAY_SLOT_ORDER: TimeSlot[] = [
  TimeSlot.EARLY_MORNING,
  TimeSlot.GAME_PREP,
  TimeSlot.GAME_IN_PROGRESS,
  TimeSlot.GAME_COMPLETE,
  TimeSlot.RECAP,
];

// ─── Engine Game Date ─────────────────────────────────────────────────────────

/** The authoritative clock used by the new engine. */
export interface EngineGameDate {
  season: number;
  week: number;       // 1–52
  dayOfWeek: number;  // 1 (Monday) – 7 (Sunday)
  timeSlot: TimeSlot;
  phase: SeasonPhase; // Derived — computed from week
}

/** Construct an EngineGameDate with a derived phase. */
export function makeEngineDate(
  season: number,
  week: number,
  dayOfWeek: number,
  timeSlot: TimeSlot,
): EngineGameDate {
  return { season, week, dayOfWeek, timeSlot, phase: getEnginePhaseForWeek(week) };
}

// ─── Simulation State ─────────────────────────────────────────────────────────

/**
 * The engine's state machine. The UI renders entirely from this value.
 * Exported from here so the new engine + store can share one definition.
 */
export enum EngineSimulationState {
  IDLE                 = 'IDLE',                 // User has control; engine is stopped
  SIMULATING           = 'SIMULATING',           // Engine is running the advance() loop
  PAUSED_FOR_INTERRUPT = 'PAUSED_FOR_INTERRUPT', // Hard stop; blocked until resolved
  PROCESSING_INTERRUPT = 'PROCESSING_INTERRUPT', // User is actively resolving an interrupt
  CRITICAL_ERROR       = 'CRITICAL_ERROR',       // Unrecoverable — only Save & Reset available
}

// ─── Interrupt Reasons ────────────────────────────────────────────────────────

export enum HardStopReason {
  TRADE_OFFER_RECEIVED        = 'TRADE_OFFER_RECEIVED',
  STARTER_INJURED             = 'STARTER_INJURED',
  ROSTER_CUTS_REQUIRED        = 'ROSTER_CUTS_REQUIRED',
  DRAFT_PICK_READY            = 'DRAFT_PICK_READY',
  CONTRACT_EXTENSION_EXPIRING = 'CONTRACT_EXTENSION_EXPIRING',
  LEAGUE_YEAR_RESET           = 'LEAGUE_YEAR_RESET',
  FREE_AGENCY_OPEN            = 'FREE_AGENCY_OPEN',
}

export enum SoftStopReason {
  NEWS_HEADLINE     = 'NEWS_HEADLINE',    // Auto-dismissed after 2 seconds
  SEASON_TRANSITION = 'SEASON_TRANSITION', // New phase begins
  AI_BLOCKBUSTER    = 'AI_BLOCKBUSTER',   // Notable AI trade — dismiss or read
}

// ─── Interrupt Contract ───────────────────────────────────────────────────────

/**
 * Discriminated payload union. The UI uses `reason` to pick the right modal;
 * `payload` populates it. No casting required.
 */
export type InterruptPayload =
  | { reason: HardStopReason.TRADE_OFFER_RECEIVED;        offerId: string }
  | { reason: HardStopReason.STARTER_INJURED;             playerId: string; injuryType: string; weeksOut: number }
  | { reason: HardStopReason.ROSTER_CUTS_REQUIRED;        currentCount: number; targetCount: number }
  | { reason: HardStopReason.DRAFT_PICK_READY;            pickNumber: number; round: number; draftedBy: string }
  | { reason: HardStopReason.CONTRACT_EXTENSION_EXPIRING; playerId: string; daysRemaining: number }
  | { reason: HardStopReason.LEAGUE_YEAR_RESET;           expiringContracts: string[] }
  | { reason: HardStopReason.FREE_AGENCY_OPEN;            topFreeAgents: string[] }
  | { reason: SoftStopReason.NEWS_HEADLINE;               headline: string }
  | { reason: SoftStopReason.SEASON_TRANSITION;           newPhase: SeasonPhase }
  | { reason: SoftStopReason.AI_BLOCKBUSTER;              tradeDescription: string };

/** The core contract between the engine and the UI. */
export interface Interrupt {
  id: string;                              // uuid — for deduplication
  kind: 'HARD' | 'SOFT';
  reason: HardStopReason | SoftStopReason;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;                           // e.g. "Trade Offer from Dallas Cowboys"
  description: string;                     // Human-readable body for the modal
  timestamp: EngineGameDate;               // When in the sim this occurred
  payload: InterruptPayload;
  autoDismissMs?: number;                  // Only set on SOFT stops; defaults to 2000
}

// ─── Resolution Contract ──────────────────────────────────────────────────────

/**
 * What the UI returns when the user completes an action.
 * The engine uses this to mutate game state before resuming.
 */
export type InterruptResolution =
  | { reason: HardStopReason.TRADE_OFFER_RECEIVED;        accepted: boolean; counterOffer?: Record<string, unknown> }
  | { reason: HardStopReason.STARTER_INJURED;             acknowledged: true }
  | { reason: HardStopReason.ROSTER_CUTS_REQUIRED;        releasedPlayerIds: string[] }
  | { reason: HardStopReason.DRAFT_PICK_READY;            selectedPlayerId: string }
  | { reason: HardStopReason.CONTRACT_EXTENSION_EXPIRING; signedContract?: Record<string, unknown>; released?: boolean }
  | { reason: HardStopReason.LEAGUE_YEAR_RESET;           acknowledged: true }
  | { reason: HardStopReason.FREE_AGENCY_OPEN;            acknowledged: true };

// ─── Snapshot ─────────────────────────────────────────────────────────────────

/** Fully serializable engine state for save/load and crash recovery. */
export interface EngineSnapshot {
  version: number;                   // Increment on breaking schema changes
  currentGameDate: EngineGameDate;
  simulationState: EngineSimulationState;
  interruptQueue: Interrupt[];
  processedEvents: string[];         // Names of calendar events already fired this season
  targetWeek: number;
}
