/**
 * Core NFL data types, enums, and utility functions
 * Converted from Swift NFL-core-types.swift
 */

// ============================================================================
// NARRATIVE IMPACT MODEL
// ============================================================================

export interface NarrativeImpact {
  fanSupportChange: number;
  ownerPatienceChange: number;
  teamMoraleChange: number;
  mediaPressure: string;
}

export function isNarrativeImpactEmpty(impact: NarrativeImpact): boolean {
  return (
    impact.fanSupportChange === 0 &&
    impact.ownerPatienceChange === 0 &&
    impact.teamMoraleChange === 0
  );
}

// ============================================================================
// POSITION ENUM & HELPERS
// ============================================================================

export enum Position {
  QB = "QB", // Quarterback
  RB = "RB", // Running Back
  WR = "WR", // Wide Receiver
  TE = "TE", // Tight End
  OL = "OL", // Offensive Line
  DL = "DL", // Defensive Line
  LB = "LB", // Linebacker
  CB = "CB", // Cornerback
  S = "S", // Safety
  K = "K", // Kicker
  P = "P", // Punter
}

export const ALL_POSITIONS = [
  Position.QB,
  Position.RB,
  Position.WR,
  Position.TE,
  Position.OL,
  Position.DL,
  Position.LB,
  Position.CB,
  Position.S,
  Position.K,
  Position.P,
];

/**
 * Check if position is offensive
 */
export function isOffensivePosition(position: Position): boolean {
  return [Position.QB, Position.RB, Position.WR, Position.TE, Position.OL].includes(
    position
  );
}

/**
 * Check if position is defensive
 */
export function isDefensivePosition(position: Position): boolean {
  return [Position.DL, Position.LB, Position.CB, Position.S].includes(position);
}

/**
 * Get display name for position
 */
export function getPositionDisplayName(position: Position): string {
  const names: Record<Position, string> = {
    [Position.QB]: "Quarterback",
    [Position.RB]: "Running Back",
    [Position.WR]: "Wide Receiver",
    [Position.TE]: "Tight End",
    [Position.OL]: "Offensive Line",
    [Position.DL]: "Defensive Line",
    [Position.LB]: "Linebacker",
    [Position.CB]: "Cornerback",
    [Position.S]: "Safety",
    [Position.K]: "Kicker",
    [Position.P]: "Punter",
  };
  return names[position];
}

/**
 * Get color hex for position
 */
export function getPositionColor(position: Position): string {
  const colors: Record<Position, string> = {
    [Position.QB]: "#FF6B6B",
    [Position.RB]: "#4ECDC4",
    [Position.WR]: "#45B7D1",
    [Position.TE]: "#F7DC6F",
    [Position.OL]: "#52C41A",
    [Position.DL]: "#FA8C16",
    [Position.LB]: "#722ED1",
    [Position.CB]: "#13C2C2",
    [Position.S]: "#EB2F96",
    [Position.K]: "#8C8C8C",
    [Position.P]: "#8C8C8C",
  };
  return colors[position];
}

/**
 * Get market multiplier for position (affects contract value)
 * FIXED: Increased multipliers for realistic superstar salaries
 */
export function getPositionMarketMultiplier(position: Position): number {
  const multipliers: Record<Position, number> = {
    [Position.QB]: 5.0, // Elite QBs command premium ($40M-$50M/year)
    [Position.WR]: 3.5, // Top WRs get $25M-$30M/year
    [Position.CB]: 3.0, // Elite CBs get $20M-$25M/year
    [Position.OL]: 2.5, // Premium O-Line get $15M-$20M/year
    [Position.DL]: 3.0, // Elite pass rushers get $20M-$25M/year
    [Position.LB]: 2.0, // Top LBs get $15M-$18M/year
    [Position.RB]: 1.8, // Elite RBs get $12M-$15M/year (devalued position)
    [Position.TE]: 2.2, // Elite TEs get $15M-$18M/year
    [Position.S]: 2.0, // Top safeties get $12M-$15M/year
    [Position.K]: 0.8, // Specialists
    [Position.P]: 0.8, // Specialists
  };
  return multipliers[position];
}

/**
 * Get scarcity factor for position (how rare elite players are)
 */
export function getPositionScarcity(position: Position): number {
  const scarcity: Record<Position, number> = {
    [Position.QB]: 0.9, // Very scarce
    [Position.WR]: 0.7, // Moderately scarce
    [Position.CB]: 0.7, // Moderately scarce
    [Position.OL]: 0.6, // Less scarce
    [Position.DL]: 0.6, // Less scarce
    [Position.LB]: 0.5, // Common
    [Position.RB]: 0.4, // Very common
    [Position.TE]: 0.5, // Common
    [Position.S]: 0.5, // Common
    [Position.K]: 0.3, // Very common
    [Position.P]: 0.3, // Very common
  };
  return scarcity[position];
}

// ============================================================================
// NFL DIVISION & CONFERENCE
// ============================================================================

export enum NFLDivision {
  AFC_EAST = "AFC East",
  AFC_NORTH = "AFC North",
  AFC_SOUTH = "AFC South",
  AFC_WEST = "AFC West",
  NFC_EAST = "NFC East",
  NFC_NORTH = "NFC North",
  NFC_SOUTH = "NFC South",
  NFC_WEST = "NFC West",
}

export enum NFLConference {
  AFC = "AFC",
  NFC = "NFC",
}

/**
 * Get conference from division
 */
export function getDivisionConference(division: NFLDivision): NFLConference {
  if (division.startsWith("AFC")) {
    return NFLConference.AFC;
  }
  return NFLConference.NFC;
}

// ============================================================================
// INJURY STATUS
// ============================================================================

export enum InjuryStatus {
  HEALTHY = "Healthy",
  QUESTIONABLE = "Questionable",
  DOUBTFUL = "Doubtful",
  OUT = "Out",
  INJURED_RESERVE = "IR",
}

/**
 * Get games out for injury status
 */
export function getInjuryGamesOut(status: InjuryStatus): number {
  const gamesOut: Record<InjuryStatus, number> = {
    [InjuryStatus.HEALTHY]: 0,
    [InjuryStatus.QUESTIONABLE]: 0,
    [InjuryStatus.DOUBTFUL]: 0,
    [InjuryStatus.OUT]: 1,
    [InjuryStatus.INJURED_RESERVE]: 8,
  };
  return gamesOut[status];
}

/**
 * Get play probability for injury status
 */
export function getInjuryPlayProbability(status: InjuryStatus): number {
  const probabilities: Record<InjuryStatus, number> = {
    [InjuryStatus.HEALTHY]: 1.0,
    [InjuryStatus.QUESTIONABLE]: 0.75,
    [InjuryStatus.DOUBTFUL]: 0.25,
    [InjuryStatus.OUT]: 0.0,
    [InjuryStatus.INJURED_RESERVE]: 0.0,
  };
  return probabilities[status];
}

// ============================================================================
// PLAYER ATTRIBUTES
// ============================================================================

export interface PlayerAttributes {
  // Physical
  speed: number;
  strength: number;
  agility: number;
  jumping: number;
  stamina: number;
  acceleration: number;
  changeOfDirection: number;

  // Mental
  awareness: number;
  playRecognition: number;
  leadership: number;
  discipline: number;

  // Technical - Offensive
  throwPower: number;
  throwAccuracy: number; // aggregate of SAC/MAC/DAC
  shortAccuracy: number;
  mediumAccuracy: number;
  deepAccuracy: number;
  playAction: number;
  throwOnTheRun: number;
  throwUnderPressure: number;
  carrying: number;
  trucking: number;
  ballCarrierVision: number;
  stiffArm: number;
  spinMove: number;
  jukeMove: number;
  catching: number;
  shortRouteRunning: number;
  mediumRouteRunning: number;
  deepRouteRunning: number;
  release: number;
  spectacularCatch: number;
  catchInTraffic: number;
  runBlock: number;
  runBlockPower: number;
  runBlockFinesse: number;
  passBlock: number;
  passBlockPower: number;
  passBlockFinesse: number;
  impactBlocking: number;
  leadBlock: number;

  // Technical - Defensive
  tackle: number;
  hitPower: number;
  blockShedding: number;
  pursuit: number;
  powerMoves: number;
  finesseMoves: number;
  playRecognitionDef: number;
  manCoverage: number;
  zoneCoverage: number;
  press: number;

  // Durability
  injury: number;
  toughness: number;

  // Special Teams
  kickPower: number;
  kickAccuracy: number;
  puntPower: number;
  puntAccuracy: number;
  kickReturn: number;
}

/**
 * Create empty player attributes (all set to 50)
 */
export function createEmptyPlayerAttributes(): PlayerAttributes {
  return {
    speed: 50,
    strength: 50,
    agility: 50,
    jumping: 50,
    stamina: 50,
    acceleration: 50,
    changeOfDirection: 50,
    awareness: 50,
    playRecognition: 50,
    leadership: 50,
    discipline: 50,
    throwPower: 50,
    throwAccuracy: 50,
    shortAccuracy: 50,
    mediumAccuracy: 50,
    deepAccuracy: 50,
    playAction: 50,
    throwOnTheRun: 50,
    throwUnderPressure: 50,
    carrying: 50,
    trucking: 50,
    ballCarrierVision: 50,
    stiffArm: 50,
    spinMove: 50,
    jukeMove: 50,
    catching: 50,
    shortRouteRunning: 50,
    mediumRouteRunning: 50,
    deepRouteRunning: 50,
    release: 50,
    spectacularCatch: 50,
    catchInTraffic: 50,
    runBlock: 50,
    runBlockPower: 50,
    runBlockFinesse: 50,
    passBlock: 50,
    passBlockPower: 50,
    passBlockFinesse: 50,
    impactBlocking: 50,
    leadBlock: 50,
    tackle: 50,
    hitPower: 50,
    blockShedding: 50,
    pursuit: 50,
    powerMoves: 50,
    finesseMoves: 50,
    playRecognitionDef: 50,
    manCoverage: 50,
    zoneCoverage: 50,
    press: 50,
    injury: 50,
    toughness: 50,
    kickPower: 50,
    kickAccuracy: 50,
    puntPower: 50,
    puntAccuracy: 50,
    kickReturn: 50,
  };
}

// ============================================================================
// PLAYER PERSONALITY
// ============================================================================

export interface PlayerPersonality {
  leadership: number; // 0-100
  workEthic: number; // 0-100
  teamPlayer: number; // 0-100
  motivation: number; // 0-100
  consistency: number; // 0-100
  clutch: number; // 0-100
  loyalty: number; // 0-100
  marketability: number; // 0-100
  discipline: number; // 0-100
  ego: number; // 0 (Humble) - 100 (Diva)
  mediaSensitivity: number; // 0 (Offline) - 100 (Online/Reactive)
}

/**
 * Create random player personality
 */
export function createRandomPlayerPersonality(): PlayerPersonality {
  const random = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  return {
    leadership: random(20, 100),
    workEthic: random(20, 100),
    teamPlayer: random(20, 100),
    motivation: random(20, 100),
    consistency: random(20, 100),
    clutch: random(20, 100),
    loyalty: random(20, 100),
    marketability: random(20, 100),
    discipline: random(10, 95),
    ego: random(20, 80),
    mediaSensitivity: random(10, 70),
  };
}

// ============================================================================
// PLAYER CONTRACT
// ============================================================================

export interface PlayerContract {
  totalValue: number;
  yearsRemaining: number;
  guaranteedMoney: number;
  currentYearCap: number;
  signingBonus: number;
  incentives: number;
  canRestructure: boolean;
  canCut: boolean;
  deadCap: number;
  hasNoTradeClause: boolean;
  approvedTradeDestinations: string[]; // Team UUIDs
}

/**
 * Determine if No-Trade Clause would block a trade
 */
export function wouldNTCBlockTrade(
  contract: PlayerContract,
  toTeamId: string
): boolean {
  if (!contract.hasNoTradeClause) return false;

  if (contract.approvedTradeDestinations.length === 0) {
    return true; // Full NTC blocks all trades
  }

  return !contract.approvedTradeDestinations.includes(toTeamId);
}

/**
 * Create rookie contract based on draft round
 */
export function createRookieContract(draftRound: number): PlayerContract {
  const baseValues: Record<number, number> = {
    1: 8_000_000,
    2: 4_000_000,
    3: 2_500_000,
    4: 1_800_000,
    5: 1_200_000,
    6: 900_000,
    7: 750_000,
  };

  const baseValue = baseValues[draftRound] || 600_000;

  return {
    totalValue: baseValue,
    yearsRemaining: 4,
    guaranteedMoney: baseValue * 0.6,
    currentYearCap: baseValue / 4,
    signingBonus: baseValue * 0.3,
    incentives: baseValue * 0.1,
    canRestructure: false,
    canCut: true,
    deadCap: baseValue * 0.2,
    hasNoTradeClause: false,
    approvedTradeDestinations: [],
  };
}

// ============================================================================
// PLAYER DEPTH CHART
// ============================================================================

export interface PlayerDepthChart {
  position: Position;
  depth: number; // 1 = starter, 2 = backup, etc.
  scheme: string;
}

// ============================================================================
// TEAM REVENUE & EXPENSES
// ============================================================================

export interface TeamRevenue {
  ticketSales: number;
  merchandise: number;
  tvDeal: number;
  concessions: number;
  parking: number;
  sponsorships: number;
  luxuryBoxes: number;
}

export function getTeamRevenueTotal(revenue: TeamRevenue): number {
  return (
    revenue.ticketSales +
    revenue.merchandise +
    revenue.tvDeal +
    revenue.concessions +
    revenue.parking +
    revenue.sponsorships +
    revenue.luxuryBoxes
  );
}

export interface TeamExpenses {
  playerSalaries: number;
  coachingSalaries: number;
  staffSalaries: number;
  facilities: number;
  travel: number;
  scouting: number;
  medical: number;
  marketing: number;
}

export function getTeamExpensesTotal(expenses: TeamExpenses): number {
  return (
    expenses.playerSalaries +
    expenses.coachingSalaries +
    expenses.staffSalaries +
    expenses.facilities +
    expenses.travel +
    expenses.scouting +
    expenses.medical +
    expenses.marketing
  );
}

// ============================================================================
// PROSPECT EVALUATION
// ============================================================================

export interface ProspectChip {
  id: string;
  label: string; // e.g., "40 Time", "Ball Skills", "Character"
  value: string; // e.g., "4.42s", "Elite", "High"
  isPositive: boolean;
}

/**
 * Convert letter grade to numeric tier (A+ = 13, F = 1)
 */
export function gradeToTier(grade: string): number {
  const tierMap: Record<string, number> = {
    "A+": 13,
    A: 12,
    "A-": 11,
    "B+": 10,
    B: 9,
    "B-": 8,
    "C+": 7,
    C: 6,
    "C-": 5,
    "D+": 4,
    D: 3,
    "D-": 2,
    F: 1,
  };
  return tierMap[grade.toUpperCase()] || 6; // Default to C
}

/**
 * Convert numeric tier back to letter grade
 */
export function tierToGrade(tier: number): string {
  const gradeMap: Record<number, string> = {
    13: "A+",
    12: "A",
    11: "A-",
    10: "B+",
    9: "B",
    8: "B-",
    7: "C+",
    6: "C",
    5: "C-",
    4: "D+",
    3: "D",
    2: "D-",
    1: "F",
  };
  return gradeMap[tier] || "C";
}

/**
 * Get color hex for grade
 */
export function getGradeColor(grade: string): string {
  const tier = gradeToTier(grade);
  if (tier >= 12) return "#22C55E"; // Green (A+, A)
  if (tier >= 10) return "#3B82F6"; // Blue (A-, B+)
  if (tier >= 7) return "#F59E0B"; // Orange (B, B-, C+)
  if (tier >= 5) return "#EF4444"; // Red (C, C-)
  return "#991B1B"; // Dark Red (D, F)
}

export interface DraftProspect {
  id: string;
  firstName: string;
  lastName: string;
  position: Position;
  college: string;
  height: string;
  weight: number;
  age: number;
  attributes: PlayerAttributes;
  personality: PlayerPersonality;
  projectedRound: number;
  overallRank: number;
  positionRank: number;
  scoutingGrade: string;
  combineResults?: {
    fortyYard?: number;
    benchPress?: number;
    verticalJump?: number;
    broadJump?: number;
    threeCone?: number;
    twentyYardShuttle?: number;
  };
  medicalGrade: string;
  characterGrade: string;
  bigBoard: number;
  pffGrade: string;
  pffPercentile: number;
  clubGrade: string;
  scoutingConfidence: number;
  evaluationChips: ProspectChip[];
  trueOverall?: number;
  truePotential?: number;
}

/**
 * Calculate tier delta between club grade and PFF grade
 */
export function calculateTierDelta(clubGrade: string, pffGrade: string): number {
  return gradeToTier(clubGrade) - gradeToTier(pffGrade);
}

/**
 * Get human-readable tier delta description
 */
export function getTierDeltaDescription(tierDelta: number): string {
  if (tierDelta > 0) {
    return `+${tierDelta} tier${tierDelta > 1 ? "s" : ""} higher than PFF`;
  }
  if (tierDelta < 0) {
    return `${tierDelta} tier${Math.abs(tierDelta) > 1 ? "s" : ""} lower than PFF`;
  }
  return "Matches PFF consensus";
}

// ============================================================================
// TRADE TYPES
// ============================================================================

export enum TradeStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
  COUNTERED = "countered",
  EXPIRED = "expired",
}

export interface TradePick {
  year: number;
  round: number;
  originalTeamId: string;
}

export interface UnifiedTradeOffer {
  id: string;
  offeringTeamId: string;
  receivingTeamId: string;
  offeringPlayers: string[]; // Player UUIDs
  receivingPlayers: string[]; // Player UUIDs
  offeringPicks: TradePick[];
  receivingPicks: TradePick[];
  status: TradeStatus;
  createdDate: Date;
  expirationDate: Date;
  isPlayerInitiated: boolean;
  season?: number;
  week?: number;
}

export type TradeOffer = UnifiedTradeOffer; // Alias for compatibility

export enum PlayerTradeBehavior {
  RING_CHASER = "Ring Chaser",
  MERCENARY = "Mercenary",
  LOYALIST = "Loyalist",
}

// ============================================================================
// TRADE REQUEST STATE & SHOPPING STATUS
// ============================================================================

export enum TradeRequestState {
  NONE = "None",
  PRIVATE_RUMBLINGS = "Private Rumblings",
  FORMAL_REQUEST = "Formal Request",
  PUBLIC_DEMAND = "Public Demand",
}

/**
 * Get description for trade request state
 */
export function getTradeRequestStateDescription(
  state: TradeRequestState
): string {
  const descriptions: Record<TradeRequestState, string> = {
    [TradeRequestState.NONE]: "Player is content with the team",
    [TradeRequestState.PRIVATE_RUMBLINGS]:
      "Player is unhappy but keeping it internal",
    [TradeRequestState.FORMAL_REQUEST]: "Player has formally requested a trade",
    [TradeRequestState.PUBLIC_DEMAND]: "Player has gone public with trade demand",
  };
  return descriptions[state];
}

/**
 * Get severity level for trade request state (0-3)
 */
export function getTradeRequestSeverity(state: TradeRequestState): number {
  const severities: Record<TradeRequestState, number> = {
    [TradeRequestState.NONE]: 0,
    [TradeRequestState.PRIVATE_RUMBLINGS]: 1,
    [TradeRequestState.FORMAL_REQUEST]: 2,
    [TradeRequestState.PUBLIC_DEMAND]: 3,
  };
  return severities[state];
}

/**
 * Get morale impact for trade request state
 */
export function getTradeRequestMoraleImpact(state: TradeRequestState): number {
  const impacts: Record<TradeRequestState, number> = {
    [TradeRequestState.NONE]: 0,
    [TradeRequestState.PRIVATE_RUMBLINGS]: -5,
    [TradeRequestState.FORMAL_REQUEST]: -10,
    [TradeRequestState.PUBLIC_DEMAND]: -20,
  };
  return impacts[state];
}

/**
 * Get team chemistry impact for trade request state
 */
export function getTradeRequestTeamChemistryImpact(
  state: TradeRequestState
): number {
  const impacts: Record<TradeRequestState, number> = {
    [TradeRequestState.NONE]: 0,
    [TradeRequestState.PRIVATE_RUMBLINGS]: 0,
    [TradeRequestState.FORMAL_REQUEST]: -5,
    [TradeRequestState.PUBLIC_DEMAND]: -15,
  };
  return impacts[state];
}

/**
 * Get next escalation state if unaddressed
 */
export function getEscalatedTradeRequestState(
  state: TradeRequestState
): TradeRequestState | null {
  const escalations: Record<TradeRequestState, TradeRequestState | null> = {
    [TradeRequestState.NONE]: null,
    [TradeRequestState.PRIVATE_RUMBLINGS]: TradeRequestState.FORMAL_REQUEST,
    [TradeRequestState.FORMAL_REQUEST]: TradeRequestState.PUBLIC_DEMAND,
    [TradeRequestState.PUBLIC_DEMAND]: null,
  };
  return escalations[state];
}

/**
 * Get severity color hex for trade request state
 */
export function getTradeRequestSeverityColor(state: TradeRequestState): string {
  const colors: Record<TradeRequestState, string> = {
    [TradeRequestState.NONE]: "#9CA3AF", // Gray
    [TradeRequestState.PRIVATE_RUMBLINGS]: "#FBBF24", // Yellow
    [TradeRequestState.FORMAL_REQUEST]: "#F97316", // Orange
    [TradeRequestState.PUBLIC_DEMAND]: "#EF4444", // Red
  };
  return colors[state];
}

export enum ShoppingStatus {
  OFF_BLOCK = "Off Block",
  QUIET_SHOPPING = "Quiet Shopping",
  PUBLIC_BLOCK = "On The Block",
}

/**
 * Get description for shopping status
 */
export function getShoppingStatusDescription(status: ShoppingStatus): string {
  const descriptions: Record<ShoppingStatus, string> = {
    [ShoppingStatus.OFF_BLOCK]: "Not available for trade",
    [ShoppingStatus.QUIET_SHOPPING]: "Quietly exploring trade options",
    [ShoppingStatus.PUBLIC_BLOCK]: "Actively shopping this player",
  };
  return descriptions[status];
}

/**
 * Get trade value modifier for shopping status
 */
export function getShoppingStatusTradeValueModifier(
  status: ShoppingStatus
): number {
  const modifiers: Record<ShoppingStatus, number> = {
    [ShoppingStatus.OFF_BLOCK]: 1.0,
    [ShoppingStatus.QUIET_SHOPPING]: 0.95,
    [ShoppingStatus.PUBLIC_BLOCK]: 0.85,
  };
  return modifiers[status];
}

/**
 * Get AI interest multiplier for shopping status
 */
export function getShoppingStatusAIInterestMultiplier(
  status: ShoppingStatus
): number {
  const multipliers: Record<ShoppingStatus, number> = {
    [ShoppingStatus.OFF_BLOCK]: 0.3,
    [ShoppingStatus.QUIET_SHOPPING]: 1.0,
    [ShoppingStatus.PUBLIC_BLOCK]: 1.5,
  };
  return multipliers[status];
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export enum NotificationType {
  TRADE = "trade",
  INJURY = "injury",
  CONTRACT = "contract",
  DRAFT = "draft",
  MEDIA = "media",
  MILESTONE = "milestone",
  FINANCIAL = "financial",
  PSYCHOLOGY = "psychology",
  ROSTER = "roster",
  TEAM_UPDATE = "teamUpdate",
  PERFORMANCE = "performance",
  CONTRACT_DEADLINE = "contractDeadline",
}

export enum NotificationPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

export interface GameNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  date: Date;
  isRead: boolean;
  priority: NotificationPriority;
  impact?: NarrativeImpact;
  socialReactions?: string[];
  relatedPlayerIds: string[];
  relatedTeamIds: string[];
}

// ============================================================================
// GAME RESULT
// ============================================================================

export interface WeeklyResult {
  id: string;
  week: number;
  season: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  isPlayoff: boolean;
  attendance: number;
  weather: string;
}

export function getWeeklyResultWinnerId(result: WeeklyResult): string | null {
  if (result.homeScore > result.awayScore) return result.homeTeamId;
  if (result.awayScore > result.homeScore) return result.awayTeamId;
  return null;
}

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export enum MessageCategory {
  TRADE = "trade",
  CONTRACT = "contract",
  MEDIA = "media",
  LEAGUE = "league",
  STAFF = "staff",
  OWNER = "owner",
  FAN = "fan",
}

export enum MessagePriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

export interface InboxItem {
  id: string;
  subject: string;
  body: string;
  sender: string;
  date: Date;
  category: MessageCategory;
  isRead: boolean;
  requiresAction: boolean;
  impact?: NarrativeImpact;
  socialReactions?: string[];
  priority: MessagePriority;
}

// ============================================================================
// STAFF MEMBER
// ============================================================================

export enum StaffRole {
  HEAD_COACH = "Head Coach",
  OFFENSIVE_COORDINATOR = "Offensive Coordinator",
  DEFENSIVE_COORDINATOR = "Defensive Coordinator",
  SPECIAL_TEAMS = "Special Teams Coach",
  POSITION_COACH = "Position Coach",
  SCOUT = "Scout",
  ASSISTANT_GM = "Assistant GM",
  TRAINER = "Trainer",
  DOCTOR = "Team Doctor",
}

export enum CoachSpecialty {
  OFFENSE = "Offense",
  DEFENSE = "Defense",
  SPECIAL_TEAMS = "Special Teams",
}

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  effectiveness: number; // 0-100
  salary: number;
  yearsRemaining: number;
  specialties: string[];
  specialty?: CoachSpecialty;
  preferredScheme?: string;
}

/**
 * Get last name from staff member
 */
export function getStaffLastName(staff: StaffMember): string {
  const parts = staff.name.split(" ");
  return parts[parts.length - 1];
}

// ============================================================================
// TRADE RUMOR
// ============================================================================

export interface GameTradeRumor {
  id: string;
  playerId: string;
  interestedTeamIds: string[];
  likelihood: number; // 0.0 to 1.0
  source: string;
  createdDate: Date;
}

// ============================================================================
// TEAM DRAFT PICK
// ============================================================================

export interface TeamDraftPick {
  id: string;
  year: number;
  round: number;
  originalTeamId: string;
  currentTeamId: string;
  overallPick?: number;
}

// ============================================================================
// TROPHY
// ============================================================================

export enum TrophyRarity {
  COMMON = "common",
  UNCOMMON = "uncommon",
  RARE = "rare",
  EPIC = "epic",
  LEGENDARY = "legendary",
}

export interface Trophy {
  id: string;
  name: string;
  description: string;
  dateEarned: Date;
  season: number;
  iconName: string;
  rarity: TrophyRarity;
}

// ============================================================================
// OWNER & FAN PROFILES
// ============================================================================

export enum OwnerArchetype {
  THE_GHOST = "The Ghost",
  THE_TITAN = "The Titan",
  THE_MEDDLER = "The Meddler",
  THE_PENNY_PINCHER = "The Penny Pincher",
  THE_TRUST_FUND_BABY = "The Trust Fund Baby",
}

export interface OwnerProfile {
  name: string;
  archetype: OwnerArchetype;
  patience: number; // 0-100
  spendingMood: number; // 0-100
  interferenceLevel: number; // 0-100
}

export enum FanBaseArchetype {
  DIE_HARD = "Die Hard",
  HOSTILE = "Hostile",
  FAIR_WEATHER = "Fair Weather",
  CASUAL = "Casual",
}

export enum MarketSize {
  SMALL = "small",
  MEDIUM = "medium",
  LARGE = "large",
}

export interface FanBaseProfile {
  archetype: FanBaseArchetype;
  marketSize: MarketSize;
  mood: number; // 0-100
  expectations: number; // 0-100
  loyalty: number; // 0-100
  passion: number; // 0-100
}

// ============================================================================
// NAME GENERATOR
// ============================================================================

export class NameGenerator {
  private static instance: NameGenerator;

  private firstNames = [
    "James",
    "John",
    "Robert",
    "Michael",
    "David",
    "Richard",
    "Joseph",
    "Charles",
    "Thomas",
    "Christopher",
    "Daniel",
    "Matthew",
    "Anthony",
    "Joshua",
    "Donald",
    "Kenneth",
    "Steven",
    "Brian",
    "Edward",
    "Ronald",
  ];

  private lastNames = [
    "Smith",
    "Johnson",
    "Williams",
    "Jones",
    "Brown",
    "Davis",
    "Miller",
    "Wilson",
    "Moore",
    "Taylor",
    "Anderson",
    "Thomas",
    "Jackson",
    "White",
    "Harris",
    "Martin",
    "Thompson",
    "Garcia",
    "Martinez",
    "Robinson",
  ];

  private colleges = [
    "Alabama",
    "Ohio State",
    "LSU",
    "Clemson",
    "Georgia",
    "Oklahoma",
    "Texas",
    "USC",
    "Florida",
    "Michigan",
    "Penn State",
    "Notre Dame",
    "Stanford",
    "Oregon",
    "Tennessee",
  ];

  static getInstance(): NameGenerator {
    if (!NameGenerator.instance) {
      NameGenerator.instance = new NameGenerator();
    }
    return NameGenerator.instance;
  }

  firstName(): string {
    return this.firstNames[Math.floor(Math.random() * this.firstNames.length)];
  }

  lastName(): string {
    return this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
  }

  college(): string {
    return this.colleges[Math.floor(Math.random() * this.colleges.length)];
  }
}
