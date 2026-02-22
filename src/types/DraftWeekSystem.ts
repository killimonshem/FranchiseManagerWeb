/**
 * Draft Week System: Comprehensive Draft Week Experience
 * Converted from Swift DraftWeekSystem.swift
 * Three phases: Lead-Up (Mon-Wed), War Room (Draft Day), Post-Draft
 */

import { Position, DraftProspect } from "./nfl-types";
import { Player, PlayerStatus } from "./player";
import { Team } from "./team";

// ============================================================================
// DRAFT WEEK PHASE & DAY ENUMS
// ============================================================================

export enum DraftPhase {
  LEAD_UP = "Lead-Up (Mon-Wed)",
  WAR_ROOM = "War Room (Draft Day)",
  POST_DRAFT = "Post-Draft",
}

export enum DraftDay {
  MONDAY = "Monday",
  TUESDAY = "Tuesday",
  WEDNESDAY = "Wednesday",
  THURSDAY = "Thursday (Draft Day)",
}

// ============================================================================
// RED FLAG SYSTEM
// ============================================================================

export enum RedFlagType {
  MEDICAL = "Medical Concern",
  CHARACTER = "Character Issue",
  PERFORMANCE = "Performance Red Flag",
}

export enum RedFlagSeverity {
  MINOR = "Minor",
  MODERATE = "Moderate",
  MAJOR = "Major",
}

export interface RedFlagEvent {
  id: string;
  prospectId: string;
  prospectName: string;
  type: RedFlagType;
  severity: RedFlagSeverity;
  description: string;
  date: DraftDay;
}

// ============================================================================
// DRAFT RUMOR SYSTEM
// ============================================================================

export interface DraftRumor {
  id: string;
  teamId: string;
  teamName: string;
  prospectId: string;
  prospectName: string;
  message: string;
  isTrue: boolean; // 60% true, 40% smokescreen
  confidence: number; // 0-100
  day: DraftDay;
}

/**
 * Generate realistic draft day rumor message
 */
function generateRumorMessage(teamName: string, prospectName: string, position: string): string {
  const templates = [
    `Sources say ${teamName} are "very interested" in ${prospectName}`,
    `${teamName} scouts were spotted at ${prospectName}'s pro day`,
    `Insider: ${prospectName} to ${teamName} "gaining momentum"`,
    `${teamName} GM reportedly "in love with" ${position} ${prospectName}`,
    `Multiple sources confirm ${teamName} targeting ${prospectName}`,
    `${teamName} may trade up to secure ${prospectName}`,
    `Don't be surprised if ${teamName} drafts ${prospectName} early`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Generate realistic red flag descriptions
 */
function generateRedFlagDescription(): string {
  const templates = [
    "Medical staff flagged a concerning knee issue during physical",
    "Character concern: Missed multiple team meetings at combine",
    "Reports of undisclosed shoulder injury from college career",
    "Failed drug test at combine - awaiting NFL review",
    "Multiple scouts question work ethic and coachability",
    "Inconsistent wonderlic scores raise questions about football IQ",
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

// ============================================================================
// DRAFT BOARD & TIER SYSTEM
// ============================================================================

export interface DraftBoardEntry {
  id: string;
  prospectId: string;
  prospectName: string;
  position: Position;
  userRank: number;
  tier: number;
}

export interface DraftTier {
  id: string;
  number: number;
  name: string; // e.g. "1st Round Grade"
  prospectIds: string[];
}

// ============================================================================
// ADVISOR & DEBATE SYSTEM
// ============================================================================

export enum AdvisorConfidence {
  LOW = "Low",
  MEDIUM = "Medium",
  HIGH = "High",
}

export interface AdvisorRecommendation {
  prospectId: string;
  prospectName: string;
  position: Position;
  reasoning: string;
  confidence: AdvisorConfidence;
}

export interface AdvisorDebate {
  id: string;
  scoutRecommendation: AdvisorRecommendation;
  coachRecommendation: AdvisorRecommendation;
}

// ============================================================================
// DRAFT TRADE OFFERS
// ============================================================================

export enum TradeUrgency {
  LOW = "Low",
  MEDIUM = "Medium",
  HIGH = "High",
}

export interface DraftPickAsset {
  year: number;
  round: number;
  pick: number;
}

export interface TradePackage {
  picks: DraftPickAsset[];
  playerIds: string[];
}

export interface DraftTradeOffer {
  id: string;
  offeringTeamId: string;
  offeringTeamName: string;
  wantsUserPick: boolean;
  offering: TradePackage;
  reasoning: string;
  urgency: TradeUrgency;
  timestamp: Date;
}

// ============================================================================
// DRAFT WEEK MANAGER STATE
// ============================================================================

export interface DraftWeekManagerState {
  // Phase & Day Tracking
  currentPhase: DraftPhase;
  currentDay: DraftDay;

  // Phase I: Lead-Up
  rumors: DraftRumor[];
  redFlags: RedFlagEvent[];
  userBoard: DraftBoardEntry[];
  userTiers: DraftTier[];
  boardLocked: boolean;

  // Phase II: War Room
  onTheClock: boolean;
  clockTimeRemaining: number; // In seconds
  incomingTradeOffers: DraftTradeOffer[];
  targetedPlayerIds: Set<string>;
  snipedPlayerIds: string[];
  scrambleMode: boolean;
  advisorDebate?: AdvisorDebate;

  // Tension System
  warRoomTension: number; // 0.0-1.0
  viableTargetsInTier: number;
  recentSnipes: number;

  // Phase III: Post-Draft
  postDraftComplete: boolean;

  // UI State
  showingPhoneCall: boolean;
  currentTradeOffer?: DraftTradeOffer;
}

/**
 * Initialize draft week manager state
 */
export function initializeDraftWeekManager(): DraftWeekManagerState {
  return {
    currentPhase: DraftPhase.LEAD_UP,
    currentDay: DraftDay.MONDAY,
    rumors: [],
    redFlags: [],
    userBoard: [],
    userTiers: [],
    boardLocked: false,
    onTheClock: false,
    clockTimeRemaining: 600, // 10 minutes
    incomingTradeOffers: [],
    targetedPlayerIds: new Set(),
    snipedPlayerIds: [],
    scrambleMode: false,
    warRoomTension: 0,
    viableTargetsInTier: 0,
    recentSnipes: 0,
    postDraftComplete: false,
    showingPhoneCall: false,
  };
}

// ============================================================================
// PHASE I: LEAD-UP (MON-WED)
// ============================================================================

/**
 * Initialize lead-up phase
 */
export function initializeLeadUp(
  state: DraftWeekManagerState,
  allTeams: Team[],
  allProspects: DraftProspect[]
): DraftWeekManagerState {
  const updated = { ...state };
  updated.rumors = [];
  updated.redFlags = [];
  updated.userBoard = [];
  updated.userTiers = [];

  // Generate initial rumors
  updated.rumors = generateInitialRumors(allTeams, allProspects);

  // Generate red flags
  updated.redFlags = generateRedFlags(allProspects);

  // Initialize user's draft board
  updated.userBoard = initializeUserBoard(allProspects);

  return updated;
}

/**
 * Generate initial rumors for lead-up period
 */
function generateInitialRumors(
  allTeams: Team[],
  allProspects: DraftProspect[]
): DraftRumor[] {
  const rumors: DraftRumor[] = [];
  const rumorCount = Math.floor(Math.random() * 6) + 15; // 15-20 rumors

  for (let i = 0; i < rumorCount; i++) {
    const randomTeam = allTeams[Math.floor(Math.random() * allTeams.length)];
    const randomProspect = allProspects[Math.floor(Math.random() * allProspects.length)];

    const isTrue = Math.random() < 0.6; // 60% true, 40% smokescreen
    const rumor: DraftRumor = {
      id: Math.random().toString(36).substr(2, 9),
      teamId: randomTeam.id,
      teamName: randomTeam.name,
      prospectId: randomProspect.id,
      prospectName: `${randomProspect.firstName} ${randomProspect.lastName}`,
      message: generateRumorMessage(randomTeam.name, `${randomProspect.firstName} ${randomProspect.lastName}`, randomProspect.position),
      isTrue,
      confidence: isTrue ? Math.floor(Math.random() * 31) + 60 : Math.floor(Math.random() * 41) + 30, // True: 60-90, False: 30-70
      day: DraftDay.MONDAY,
    };

    rumors.push(rumor);
  }

  return rumors;
}

/**
 * Generate daily rumors for each day of lead-up
 */
export function generateDailyRumors(
  state: DraftWeekManagerState,
  allTeams: Team[],
  allProspects: DraftProspect[]
): DraftWeekManagerState {
  const newRumorCount = Math.floor(Math.random() * 4) + 5; // 5-8 new rumors
  const newRumors: DraftRumor[] = [];

  for (let i = 0; i < newRumorCount; i++) {
    const randomTeam = allTeams[Math.floor(Math.random() * allTeams.length)];
    const randomProspect = allProspects[Math.floor(Math.random() * allProspects.length)];

    const isTrue = Math.random() < 0.6;
    const rumor: DraftRumor = {
      id: Math.random().toString(36).substr(2, 9),
      teamId: randomTeam.id,
      teamName: randomTeam.name,
      prospectId: randomProspect.id,
      prospectName: `${randomProspect.firstName} ${randomProspect.lastName}`,
      message: generateRumorMessage(randomTeam.name, `${randomProspect.firstName} ${randomProspect.lastName}`, randomProspect.position),
      isTrue,
      confidence: isTrue ? Math.floor(Math.random() * 31) + 60 : Math.floor(Math.random() * 41) + 30,
      day: state.currentDay,
    };

    newRumors.push(rumor);
  }

  return {
    ...state,
    rumors: [...state.rumors, ...newRumors],
  };
}

/**
 * Generate red flags for top prospects
 */
function generateRedFlags(allProspects: DraftProspect[]): RedFlagEvent[] {
  const redFlags: RedFlagEvent[] = [];

  // Get top 32 prospects
  const topProspects = allProspects
    .sort((a, b) => (a.overallRank ?? 999) - (b.overallRank ?? 999))
    .slice(0, 32);

  // Generate 1-2 red flags
  const flagCount = Math.floor(Math.random() * 2) + 1;

  for (let i = 0; i < flagCount; i++) {
    const randomProspect = topProspects[Math.floor(Math.random() * topProspects.length)];
    const types = Object.values(RedFlagType);
    const severities = Object.values(RedFlagSeverity);

    const flag: RedFlagEvent = {
      id: Math.random().toString(36).substr(2, 9),
      prospectId: randomProspect.id,
      prospectName: `${randomProspect.firstName} ${randomProspect.lastName}`,
      type: types[Math.floor(Math.random() * types.length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      description: generateRedFlagDescription(),
      date: DraftDay.MONDAY,
    };

    redFlags.push(flag);
  }

  return redFlags;
}

/**
 * Initialize user's draft board with all prospects ranked
 */
function initializeUserBoard(allProspects: DraftProspect[]): DraftBoardEntry[] {
  return allProspects.slice(0, 100).map((prospect, index) => ({
    id: Math.random().toString(36).substr(2, 9),
    prospectId: prospect.id,
    prospectName: `${prospect.firstName} ${prospect.lastName}`,
    position: prospect.position,
    userRank: prospect.overallRank ?? index + 1,
    tier: 0,
  }));
}

/**
 * Leak interest in a prospect (smokescreen)
 */
export function leakInterest(
  state: DraftWeekManagerState,
  prospectId: string,
  prospectName: string,
  userTeamId: string,
  userTeamName: string
): DraftWeekManagerState {
  const smokescreenRumor: DraftRumor = {
    id: Math.random().toString(36).substr(2, 9),
    teamId: userTeamId,
    teamName: userTeamName,
    prospectId,
    prospectName,
    message: `BREAKING: Sources confirm user team "locked in" on ${prospectName}`,
    isTrue: false,
    confidence: 85,
    day: state.currentDay,
  };

  return {
    ...state,
    rumors: [...state.rumors, smokescreenRumor],
  };
}

/**
 * Lock draft board before draft day
 */
export function lockBoard(state: DraftWeekManagerState): DraftWeekManagerState {
  return {
    ...state,
    boardLocked: true,
  };
}

/**
 * Set draft tiers
 */
export function setDraftTiers(
  state: DraftWeekManagerState,
  tiers: DraftTier[]
): DraftWeekManagerState {
  const updated = {
    ...state,
    userTiers: tiers,
  };

  return updateViableTargetsInCurrentTier(updated);
}

// ============================================================================
// PHASE PROGRESSION
// ============================================================================

/**
 * Advance to next day
 */
export function advanceDay(
  state: DraftWeekManagerState,
  allTeams: Team[],
  allProspects: DraftProspect[]
): DraftWeekManagerState {
  let updated = { ...state };

  switch (state.currentDay) {
    case DraftDay.MONDAY:
      updated.currentDay = DraftDay.TUESDAY;
      updated = generateDailyRumors(updated, allTeams, allProspects);
      break;
    case DraftDay.TUESDAY:
      updated.currentDay = DraftDay.WEDNESDAY;
      updated = generateDailyRumors(updated, allTeams, allProspects);
      break;
    case DraftDay.WEDNESDAY:
      updated.currentDay = DraftDay.THURSDAY;
      updated = transitionToWarRoom(updated);
      break;
    case DraftDay.THURSDAY:
      updated = transitionToPostDraft(updated);
      break;
  }

  return updated;
}

/**
 * Transition to war room phase (draft day)
 */
export function transitionToWarRoom(
  state: DraftWeekManagerState
): DraftWeekManagerState {
  return {
    ...state,
    currentPhase: DraftPhase.WAR_ROOM,
    currentDay: DraftDay.THURSDAY,
    onTheClock: false,
    clockTimeRemaining: 600,
    incomingTradeOffers: [],
    snipedPlayerIds: [],
    scrambleMode: false,
    warRoomTension: 0,
    viableTargetsInTier: 0,
    recentSnipes: 0,
    advisorDebate: generateInitialAdvisorDebate(state),
  };
}

/**
 * Transition to post-draft phase
 */
export function transitionToPostDraft(
  state: DraftWeekManagerState
): DraftWeekManagerState {
  return {
    ...state,
    currentPhase: DraftPhase.POST_DRAFT,
    postDraftComplete: true,
    onTheClock: false,
    incomingTradeOffers: [],
  };
}

// ============================================================================
// PHASE II: WAR ROOM (DRAFT DAY)
// ============================================================================

/**
 * Start the clock for user's pick
 */
export function startClock(state: DraftWeekManagerState): DraftWeekManagerState {
  return {
    ...state,
    onTheClock: true,
    clockTimeRemaining: 600,
  };
}

/**
 * Decrement clock and generate trade offers as time runs out
 */
export function updateClock(
  state: DraftWeekManagerState,
  allTeams: Team[],
  allProspects: DraftProspect[]
): DraftWeekManagerState {
  let updated = {
    ...state,
    clockTimeRemaining: Math.max(0, state.clockTimeRemaining - 1),
  };

  // Generate trade offers as clock runs down (last 2 minutes)
  if (updated.clockTimeRemaining < 120 && Math.random() < 0.3) {
    updated = generateContextAwareTradeOffer(updated, allTeams, allProspects);
  }

  updated = updateWarRoomTension(updated);

  return updated;
}

/**
 * Update war room tension based on time, targets, and snipes
 */
function updateWarRoomTension(state: DraftWeekManagerState): DraftWeekManagerState {
  const timePressure = 1.0 - state.clockTimeRemaining / 600;

  let targetPressure: number;
  switch (state.viableTargetsInTier) {
    case 0:
      targetPressure = 1.0;
      break;
    case 1:
      targetPressure = 0.8;
      break;
    case 2:
      targetPressure = 0.6;
      break;
    default:
      targetPressure = 0.3;
  }

  const snipePressure = Math.min(state.recentSnipes * 0.3, 1.0);

  const combined = timePressure * 0.5 + targetPressure * 0.3 + snipePressure * 0.2;
  const newTension = Math.max(0.0, Math.min(1.0, combined));

  return {
    ...state,
    warRoomTension: newTension,
  };
}

/**
 * Generate trade offers based on context (QB sliding, time pressure, etc)
 */
function generateContextAwareTradeOffer(
  state: DraftWeekManagerState,
  allTeams: Team[],
  allProspects: DraftProspect[]
): DraftWeekManagerState {
  if (allTeams.length === 0 || allProspects.length === 0) {
    return state;
  }

  // Scenario A: Team wants to trade up for sliding QB
  const slidingQB = detectSlidingQB(allProspects);
  if (slidingQB) {
    const aggressiveTeam = allTeams[Math.floor(Math.random() * allTeams.length)];
    const offer = generateTradePackage(true);

    const tradeOffer: DraftTradeOffer = {
      id: Math.random().toString(36).substr(2, 9),
      offeringTeamId: aggressiveTeam.id,
      offeringTeamName: aggressiveTeam.name,
      wantsUserPick: true,
      offering: offer,
      reasoning: `We need to move up for ${slidingQB.firstName} ${slidingQB.lastName}!`,
      urgency: TradeUrgency.HIGH,
      timestamp: new Date(),
    };

    return enqueueTradeOffer(state, tradeOffer);
  }

  // Scenario B: Opportunistic offer if user hesitating
  if (state.clockTimeRemaining < 120 && allTeams.length > 0) {
    const opportunisticTeam = allTeams[Math.floor(Math.random() * allTeams.length)];
    const isAggressive = state.warRoomTension >= 0.5;
    const offer = generateTradePackage(isAggressive);

    let reasoning: string;
    let urgency: TradeUrgency;

    if (state.warRoomTension > 0.7) {
      reasoning = "We know the clock is stressing you. Here's our offer.";
      urgency = TradeUrgency.HIGH;
    } else {
      reasoning = "Sensing indecision - let's make a move.";
      urgency = TradeUrgency.MEDIUM;
    }

    const tradeOffer: DraftTradeOffer = {
      id: Math.random().toString(36).substr(2, 9),
      offeringTeamId: opportunisticTeam.id,
      offeringTeamName: opportunisticTeam.name,
      wantsUserPick: true,
      offering: offer,
      reasoning,
      urgency,
      timestamp: new Date(),
    };

    return enqueueTradeOffer(state, tradeOffer);
  }

  return state;
}

/**
 * Detect if a first-round QB prospect is still available
 */
function detectSlidingQB(allProspects: DraftProspect[]): DraftProspect | undefined {
  return allProspects.find(
    (p) => p.position === "QB" && (p.projectedRound ?? 1) === 1
  );
}

/**
 * Generate trade package (aggressive overpay or low-ball)
 */
function generateTradePackage(aggressive: boolean): TradePackage {
  if (aggressive) {
    // Overpay scenario: multiple picks including future capital
    return {
      picks: [
        { year: 2025, round: 2, pick: 15 },
        { year: 2025, round: 3, pick: 15 },
        { year: 2026, round: 2, pick: 20 },
      ],
      playerIds: [],
    };
  } else {
    // Low-ball / opportunistic
    return {
      picks: [{ year: 2025, round: 3, pick: 20 }],
      playerIds: [],
    };
  }
}

/**
 * Enqueue incoming trade offer and show phone call UI
 */
function enqueueTradeOffer(
  state: DraftWeekManagerState,
  offer: DraftTradeOffer
): DraftWeekManagerState {
  return {
    ...state,
    incomingTradeOffers: [...state.incomingTradeOffers, offer],
    currentTradeOffer: offer,
    showingPhoneCall: true,
  };
}

/**
 * Add targeted player to draft board
 */
export function addTargetedPlayer(
  state: DraftWeekManagerState,
  prospectId: string
): DraftWeekManagerState {
  const updated = {
    ...state,
    targetedPlayerIds: new Set([...state.targetedPlayerIds, prospectId]),
  };

  return updateViableTargetsInCurrentTier(updated);
}

/**
 * Remove targeted player from draft board
 */
export function removeTargetedPlayer(
  state: DraftWeekManagerState,
  prospectId: string
): DraftWeekManagerState {
  const updated = {
    ...state,
    targetedPlayerIds: new Set(
      [...state.targetedPlayerIds].filter((id) => id !== prospectId)
    ),
  };

  return updateViableTargetsInCurrentTier(updated);
}

/**
 * Update viable targets in current tier
 */
function updateViableTargetsInCurrentTier(
  state: DraftWeekManagerState
): DraftWeekManagerState {
  // Count how many targeted players are still available
  let targetCount = 0;
  for (const prospectId of state.targetedPlayerIds) {
    if (!state.snipedPlayerIds.includes(prospectId)) {
      targetCount++;
    }
  }

  return {
    ...state,
    viableTargetsInTier: targetCount,
  };
}

/**
 * Check for snipe - mark targeted player as picked by someone else
 */
export function checkForSnipe(
  state: DraftWeekManagerState,
  pickedProspectId: string
): DraftWeekManagerState {
  if (!state.targetedPlayerIds.has(pickedProspectId)) {
    return state; // Not one of our targets
  }

  let updated = {
    ...state,
    snipedPlayerIds: [...state.snipedPlayerIds, pickedProspectId],
    recentSnipes: state.recentSnipes + 1,
    scrambleMode: true,
    warRoomTension: 1.0,
  };

  // Disable scramble mode after 5 seconds
  setTimeout(() => {
    // In a real implementation, would update state after delay
  }, 5000);

  updated = updateViableTargetsInCurrentTier(updated);
  return updated;
}

/**
 * Auto-pick best available player when clock expires
 */
export function autoPickBestAvailable(
  state: DraftWeekManagerState,
  bestAvailableProspectId: string
): DraftWeekManagerState {
  return {
    ...state,
    onTheClock: false,
    clockTimeRemaining: 0,
  };
}

// ============================================================================
// ADVISOR SYSTEM
// ============================================================================

/**
 * Generate initial advisor debate for war room
 */
function generateInitialAdvisorDebate(
  state: DraftWeekManagerState
): AdvisorDebate | undefined {
  // Would need access to actual prospects/team data
  // For now, return undefined as placeholder
  return undefined;
}

/**
 * Generate advisor debate comparing two prospects
 */
export function generateAdvisorDebate(
  bestProspectId: string,
  bestProspectName: string,
  bestProspectPosition: Position,
  needProspectId: string,
  needProspectName: string,
  needProspectPosition: Position
): AdvisorDebate {
  return {
    id: Math.random().toString(36).substr(2, 9),
    scoutRecommendation: {
      prospectId: bestProspectId,
      prospectName: bestProspectName,
      position: bestProspectPosition,
      reasoning: `${bestProspectName} is a generational talent! Ignore that we already have depth at ${bestProspectPosition}.`,
      confidence: AdvisorConfidence.HIGH,
    },
    coachRecommendation: {
      prospectId: needProspectId,
      prospectName: needProspectName,
      position: needProspectPosition,
      reasoning: `We need a ${needProspectPosition} to save our QB's life. Don't get cute.`,
      confidence:
        needProspectId === bestProspectId
          ? AdvisorConfidence.HIGH
          : AdvisorConfidence.MEDIUM,
    },
  };
}

// ============================================================================
// PHASE III: POST-DRAFT UDFA CONVERSION
// ============================================================================

/**
 * Convert undrafted prospects to free agents
 */
export function convertUndraftedToFreeAgents(
  undraftedProspects: DraftProspect[],
  allPlayers: Player[]
): { updatedPlayers: Player[]; convertedCount: number } {
  let convertedCount = 0;
  let updatedPlayers = [...allPlayers];

  for (const prospect of undraftedProspects) {
    const freeAgentPlayer: Player = {
      id: prospect.id,
      firstName: prospect.firstName,
      lastName: prospect.lastName,
      position: prospect.position,
      jerseyNumber: 0,
      age: prospect.age,
      height: prospect.height,
      weight: prospect.weight,
      college: prospect.college,
      teamId: undefined,
      status: PlayerStatus.FREE_AGENT,
      overall: Math.max(
        50,
        Math.round((prospect.overallRank ?? 250) * 0.4) - 15
      ),
      potential: Math.floor(Math.random() * 21) + 60, // 60-80
      attributes: prospect.attributes,
      personality: prospect.personality,
      contract: {
        totalValue: 750_000,
        yearsRemaining: 1,
        guaranteedMoney: 0,
        currentYearCap: 750_000,
        signingBonus: 0,
        incentives: 50_000,
        canRestructure: false,
        canCut: true,
        deadCap: 0,
        hasNoTradeClause: false,
        approvedTradeDestinations: [],
      },
      stats: {
        gamesPlayed: 0,
        // ... other stats default to 0
      } as any,
      draft: {
        year: 2025,
        round: 0,
        pick: 0,
        overall: 0,
      },
      morale: 50,
      tradeRequestState: "none",
      tradeRequestWeek: undefined,
      shoppingStatus: "offBlock",
      isAwareOfShopping: false,
      yearsWithTeamSinceLastRookie: 0,
      yearsLastActuallyPlayed: 0,
    };

    updatedPlayers.push(freeAgentPlayer);
    convertedCount++;
  }

  console.log(`📋 Converted ${convertedCount} undrafted prospects to free agents`);

  return {
    updatedPlayers,
    convertedCount,
  };
}

// ============================================================================
// DEPRECATED UDFA FRENZY FUNCTIONS (Backwards Compatibility)
// ============================================================================

/**
 * @deprecated UDFA Frenzy has been removed. Use convertUndraftedToFreeAgents() instead.
 */
export function startUDFATimer(state: DraftWeekManagerState): DraftWeekManagerState {
  console.warn("startUDFATimer is deprecated. Undrafted players are now immediately converted.");
  return transitionToPostDraft(state);
}

/**
 * @deprecated UDFA Frenzy has been removed.
 */
export function bidOnUDFA(
  prospectId: string,
  amount: number
): boolean {
  console.warn("bidOnUDFA is deprecated.");
  return false;
}

/**
 * @deprecated UDFA Frenzy has been removed.
 */
export function generateAIUDFABid(): void {
  console.warn("generateAIUDFABid is deprecated.");
}

/**
 * @deprecated UDFA Frenzy has been removed. Use convertUndraftedToFreeAgents() instead.
 */
export function finalizeUDFAFrenzy(
  state: DraftWeekManagerState,
  undraftedProspects: DraftProspect[],
  allPlayers: Player[]
): { updatedState: DraftWeekManagerState; updatedPlayers: Player[] } {
  console.warn(
    "finalizeUDFAFrenzy is deprecated. Use convertUndraftedToFreeAgents() instead."
  );
  const { updatedPlayers } = convertUndraftedToFreeAgents(
    undraftedProspects,
    allPlayers
  );
  return {
    updatedState: transitionToPostDraft(state),
    updatedPlayers,
  };
}

/**
 * @deprecated UDFA Frenzy has been removed.
 */
export function signUDFA(
  prospectId: string,
  teamId: string,
  bonus: number
): void {
  console.warn("signUDFA is deprecated.");
}

// ============================================================================
// TEAM NEEDS ANALYSIS
// ============================================================================

/**
 * Analyze team's draft needs
 */
export function analyzeTeamNeeds(team: Team, allPlayers: Player[]): Position[] {
  const roster = allPlayers.filter(
    (p) => p.teamId === team.id && p.status === PlayerStatus.ACTIVE
  );

  const positionCounts: Record<Position, number> = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    OL: 0,
    DL: 0,
    LB: 0,
    CB: 0,
    S: 0,
    K: 0,
    P: 0,
  };

  for (const player of roster) {
    positionCounts[player.position]++;
  }

  const needs: Position[] = [];

  if (positionCounts[Position.QB] < 2) needs.push(Position.QB);
  if (positionCounts[Position.RB] < 3) needs.push(Position.RB);
  if (positionCounts[Position.WR] < 4) needs.push(Position.WR);
  if (positionCounts[Position.TE] < 2) needs.push(Position.TE);
  if (positionCounts[Position.OL] < 6) needs.push(Position.OL);
  if (positionCounts[Position.DL] < 5) needs.push(Position.DL);
  if (positionCounts[Position.LB] < 4) needs.push(Position.LB);
  if (positionCounts[Position.CB] < 4) needs.push(Position.CB);
  if (positionCounts[Position.S] < 2) needs.push(Position.S);

  return needs.shuffle().slice(0, 3);
}

// ============================================================================
// UTILITY EXTENSIONS
// ============================================================================

declare global {
  interface Array<T> {
    shuffle(): Array<T>;
  }
}

/**
 * Shuffle array (Fisher-Yates)
 */
if (!Array.prototype.shuffle) {
  Array.prototype.shuffle = function <T>(this: T[]): T[] {
    const array = [...this];
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };
}
