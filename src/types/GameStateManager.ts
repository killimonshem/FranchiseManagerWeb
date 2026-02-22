// GameStateManager.ts
// Core game state hub managing all league, team, player, and simulation data

const uuidv4 = () => crypto.randomUUID();
import { Team } from './team';
import { Player, PlayerStatus } from './player';
import { calculatePlayerMarketValue } from './player';
import { Position, NFLDivision, NFLConference } from './nfl-types';
import { calculateFranchiseTagValue } from './FranchiseTagSystem';
import { FreeAgencyTransaction, CompensatoryPickSystem, CompPick } from './CompensatoryPickSystem';
import { UserProfile, createUserProfile } from './UserProfile';
import { AITeamManager, GameStateForAI } from './AITeamManager';

// Engine v2 imports — types live in engine-types.ts, calendar in scheduled-events.ts
import {
  SeasonPhase as EnginePhase,
  PHASE_WEEK_MAP,
  TimeSlot as EngineTimeSlot,
  TIME_SLOT_ORDER,
  GAME_DAY_SLOT_ORDER,
  makeEngineDate,
  getEnginePhaseForWeek,
  PHASE_LABELS,
  HardStopReason,
  SoftStopReason,
  Interrupt,
  InterruptResolution,
  EngineGameDate,
  EngineSnapshot,
  EngineSimulationState,
  ActionItem,
  ActionItemType,
} from './engine-types';
import { hasMajorEventThisWeek, getScheduledEvent } from './scheduled-events';
import { AgentPersonalitySystem } from '../systems/AgentPersonalitySystem';
import type { PlayerNegotiationState } from '../systems/AgentPersonalitySystem';
import { TradeSystem } from '../systems/TradeSystem';
import { FinanceSystem } from '../systems/FinanceSystem';
import type { RestructureResult } from '../systems/FinanceSystem';
import { DraftEngine, generateDraftClass } from '../systems/DraftEngine';
import type { DraftPickResult } from '../systems/DraftEngine';
import type { TradeOfferPayloadUI, TradeEvaluation } from '../systems/TradeSystem';
import { FranchiseTier } from '../systems/TradeSystem';
import { storage } from '../services/StorageService';
import draftTradeData from '../../drafttrade.json';

// Re-export engine types so existing imports from this file still work
export type { Interrupt, InterruptResolution, EngineGameDate, EngineSnapshot, ActionItem };
export { EnginePhase, HardStopReason, SoftStopReason, EngineSimulationState, PHASE_LABELS, ActionItemType };

// MARK: - Placeholder Types & Enums

// Game simulation execution state tracking (idle, simulating, or paused)
export enum SimulationState {
  IDLE                 = 'idle',
  SIMULATING           = 'simulating',
  PAUSED_FOR_INTERRUPT = 'pausedForInterrupt',
  PROCESSING_INTERRUPT = 'processingInterrupt', // User is actively resolving an interrupt
  CRITICAL_ERROR       = 'criticalError',       // Unrecoverable — only Save & Reset available
}

export enum SimulationSpeed {
  SLOW = 'Slow',
  NORMAL = 'Normal',
  FAST = 'Fast',
  INSTANT = 'Instant'
}

export enum GameDifficulty {
  EASY = 'Easy',
  NORMAL = 'Normal',
  HARD = 'Hard',
  LEGENDARY = 'Legendary'
}

export enum SeasonPhase {
  OFFSEASON = 'Offseason',
  SCOUTING_COMBINE = 'Scouting Combine',
  FREE_AGENCY = 'Free Agency',
  POST_FREE_AGENCY = 'Draft Preparation',
  DRAFT = 'NFL Draft',
  POST_DRAFT = 'Post-Draft',
  TRAINING_CAMP = 'Training Camp',
  PRESEASON = 'Preseason',
  REGULAR_SEASON = 'Regular Season',
  PLAYOFFS = 'Playoffs',
  SUPER_BOWL = 'Super Bowl'
}

export enum SeasonEvent {
  SCOUTING_COMBINE = 'Scouting Combine',
  FREE_AGENCY_START = 'Free Agency Opens',
  FREE_AGENCY_END = 'Free Agency Ends',
  DRAFT = 'NFL Draft',
  TRAINING_CAMP_START = 'Training Camp Begins',
  PRESEASON_START = 'Preseason Begins',
  ROSTER_CUTS = 'Final Roster Cuts',
  REGULAR_SEASON_START = 'Regular Season Begins',
  TRADE_DEADLINE = 'Trade Deadline',
  REGULAR_SEASON_END = 'Regular Season Ends',
  PLAYOFFS_START = 'Playoffs Begin',
  SUPER_BOWL = 'Super Bowl',
  SEASON_END = 'Season Ends'
}

export enum NewsCategory {
  PERFORMANCE = 'performance',
  INJURY = 'injury',
  TRADE = 'trade',
  SIGNING = 'signing',
  RUMORS = 'rumors',
  STANDINGS = 'standings'
}

export enum NewsImportance {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum NotificationType {
  TRADE = 'trade',
  INJURY = 'injury',
  CONTRACT = 'contract',
  DRAFT = 'draft',
  MEDIA = 'media',
  MILESTONE = 'milestone',
  FINANCIAL = 'financial',
  PSYCHOLOGY = 'psychology',
  ROSTER = 'roster',
  TEAM_UPDATE = 'teamUpdate',
  PERFORMANCE = 'performance'
}

export enum RFATenderType {
  ROFR = 'Right of First Refusal',
  ORIGINAL_ROUND = 'Original Round',
  TRANSITION = 'Transition Tag',
  FRANCHISE = 'Franchise Tag',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

// Current game date with season, week, day, and time slot progression
export interface GameDate {
  season: number;
  week: number;
  dayOfWeek: number;
  timeSlot: TimeSlot;
}

export interface TimeSlot {
  rawValue: string;
  baseDuration: number;
  shouldProcessAIActions: boolean;
}

export const TimeSlots: Record<string, TimeSlot> = {
  earlyMorning: {
    rawValue: 'Early Morning',
    baseDuration: 1.0,
    shouldProcessAIActions: true
  },
  midMorning: {
    rawValue: 'Mid Morning',
    baseDuration: 1.0,
    shouldProcessAIActions: true
  },
  afternoon: {
    rawValue: 'Afternoon',
    baseDuration: 1.0,
    shouldProcessAIActions: true
  },
  evening: {
    rawValue: 'Evening',
    baseDuration: 1.0,
    shouldProcessAIActions: false
  },
  gamePrep: {
    rawValue: 'Game Prep',
    baseDuration: 1.0,
    shouldProcessAIActions: false
  },
  gameInProgress: {
    rawValue: 'Game In Progress',
    baseDuration: 1.0,
    shouldProcessAIActions: false
  },
  gameComplete: {
    rawValue: 'Game Complete',
    baseDuration: 1.0,
    shouldProcessAIActions: false
  },
  recap: {
    rawValue: 'Recap',
    baseDuration: 1.0,
    shouldProcessAIActions: true
  },
  restDay: {
    rawValue: 'Rest Day',
    baseDuration: 1.0,
    shouldProcessAIActions: false
  },
  draftRound: {
    rawValue: 'Draft Round',
    baseDuration: 1.0,
    shouldProcessAIActions: false
  },
  freeAgencyWindow: {
    rawValue: 'Free Agency Window',
    baseDuration: 1.0,
    shouldProcessAIActions: true
  },
  tradeDeadlineRush: {
    rawValue: 'Trade Deadline Rush',
    baseDuration: 1.0,
    shouldProcessAIActions: true
  }

  /**
   * Compute an offseason grade for the user across cap health, roster improvement,
   * draft haul quality, and free agent acquisitions. Returns normalized 0-100
   * scores for each pillar and an aggregated grade.
   */
  computeOffseasonGrade(): {
    capHealth: number;
    rosterImprovement: number;
    draftHaul: number;
    faAcquisitions: number;
    overall: number;
    summaryText: string;
  } {
    const result = {
      capHealth: 0,
      rosterImprovement: 0,
      draftHaul: 0,
      faAcquisitions: 0,
      overall: 0,
      summaryText: ''
    };

    if (!this.userTeamId) return result;

    const teamId = this.userTeamId;

    // Cap health: proportion of cap space to salary cap, scaled to 0-100
    const capSpace = this.getCapSpace(teamId);
    result.capHealth = Math.round(Math.max(0, Math.min(1, capSpace / this.salaryCap)) * 100);

    // Roster improvement: compare current active roster average OVR to a simple baseline (75)
    const roster = this.allPlayers.filter(p => p.teamId === teamId && p.status === PlayerStatus.ACTIVE);
    const avgOvr = roster.length ? Math.round(roster.reduce((s, p) => s + p.overall, 0) / roster.length) : 75;
    // Baseline of 75 -> map difference of -10..+10 to 0..100
    const delta = Math.max(-10, Math.min(10, avgOvr - 75));
    result.rosterImprovement = Math.round(((delta + 10) / 20) * 100);

    // Draft haul: inspect draft picks assigned to user this season and weight earlier rounds higher
    const draftedThisSeason = this.allPlayers.filter(p => p.draftYear === this.currentSeason && p.teamId === teamId);
    if (draftedThisSeason.length === 0) {
      result.draftHaul = 40; // conservative baseline
    } else {
      // Score by average potential (higher is better) and give weight to round (if available)
      const avgPotential = draftedThisSeason.reduce((s, p) => s + (p.potential || p.overall), 0) / draftedThisSeason.length;
      const normalized = Math.max(40, Math.min(99, avgPotential));
      result.draftHaul = Math.round(((normalized - 40) / (99 - 40)) * 100);
    }

    // Free agent acquisitions: count meaningful acquisitions for user team last offseason
    const faForUser = this.offseasonTransactions.filter(t => t.newTeamId === teamId);
    if (faForUser.length === 0) {
      result.faAcquisitions = 35;
    } else {
      // Score by average APY (clamp and map to 0-100)
      const avgApy = faForUser.reduce((s, t) => s + (t.averageYearlyValue || 0), 0) / faForUser.length;
      // Map avgApy (0..30M) to 30..90
      const apyScore = Math.max(30, Math.min(90, Math.round((avgApy / 30_000_000) * 60 + 30)));
      result.faAcquisitions = Math.round(((apyScore - 30) / 60) * 100);
    }

    // Overall: simple average
    result.overall = Math.round((result.capHealth + result.rosterImprovement + result.draftHaul + result.faAcquisitions) / 4);

    // Summary text for sharing
    result.summaryText = `${this.userProfile?.firstName ?? 'GM'}'s Offseason Grade — ${result.overall}/100\n` +
      `Cap Health: ${result.capHealth}/100, Roster: ${result.rosterImprovement}/100, Draft: ${result.draftHaul}/100, FA: ${result.faAcquisitions}/100`;

    return result;
  }
};

export const TimeSlotProgression = [
  TimeSlots.earlyMorning,
  TimeSlots.midMorning,
  TimeSlots.afternoon,
  TimeSlots.evening,
  TimeSlots.gamePrep,
  TimeSlots.gameInProgress,
  TimeSlots.gameComplete,
  TimeSlots.recap
];

export function getNextTimeSlot(currentSlot: TimeSlot): TimeSlot {
  const currentIndex = TimeSlotProgression.findIndex(s => s.rawValue === currentSlot.rawValue);
  if (currentIndex === -1 || currentIndex + 1 >= TimeSlotProgression.length) {
    return TimeSlots.earlyMorning;
  }
  return TimeSlotProgression[currentIndex + 1];
}

// Simulation interrupt requiring user action
export interface ProcessingInterrupt {
  id: string;
  type: InterruptType;
  timestamp: GameDate;
  isResolved: boolean;
}

export type InterruptType =
  | { type: 'hardStop'; reason: HardStopReason }
  | { type: 'userPause' };

export interface NewsHeadline {
  id: string;
  title: string;
  body: string;
  timestamp: GameDate;
  category: NewsCategory;
  importance: NewsImportance;
}

export interface AutoPauseSettings {
  pauseOnInjuries: boolean;
  pauseOnTradeOffers: boolean;
}

export enum SimVisualState {
  IDLE = 'idle',
  SCOREBOARD = 'scoreboard',
  TRANSACTION_TICKER = 'transactionTicker',
  PRO_DAY_MAP = 'proDayMap',
  NEWSPAPER_SPIN = 'newspaperSpin',
  DRAFT_ROOM = 'draftRoom'
}

export interface GameSchedule {
  id: string;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  gameTime: Date;
  isNationalTV: boolean;
  isPlayed: boolean;
}

export interface GameNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  date: Date;
  priority: NotificationPriority;
  isRead: boolean;
  relatedPlayerIds?: string[];
  relatedTeamIds?: string[];
}

export interface InboxItem {
  id: string;
  subject: string;
  body: string;
  sender: string;
  date: Date;
  category: 'trade' | 'contract' | 'media' | 'league' | 'staff' | 'owner' | 'fan';
  isRead: boolean;
  requiresAction: boolean;
}


export interface DevelopmentState {
  lastProcessedWeek: number;
  lastProcessedSlot: string;
  reports: Record<string, any>[];
}

export interface WeeklyResult {
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

export interface PlayerRelationship {
  playerId1: string;
  playerId2: string;
  relationshipType: string;
  strength: number;
}

export interface SocialClique {
  id: string;
  members: string[];
  teamId: string;
  cliqueType: string;
}

export interface TeamDraftPick {
  year: number;
  round: number;
  originalTeamId: string;
  currentTeamId: string;
  overallPick?: number;
  notes?: string;
}

export interface PlayoffBracket {
  season: number;
  afcSeeds: PlayoffSeed[];
  nfcSeeds: PlayoffSeed[];
  wildCardMatchups: PlayoffMatchup[];
  divisionalMatchups: PlayoffMatchup[];
  conferenceMatchups: PlayoffMatchup[];
  superBowlMatchup?: PlayoffMatchup;
  isComplete: boolean;
  createdAt: Date;
}

export interface PlayoffSeed {
  id: string;
  seed: number;
  teamId: string;
  teamName: string;
  teamAbbreviation: string;
  conference: string;
  wins: number;
  losses: number;
  isEliminated: boolean;
  eliminationRound?: number;
}

export interface PlayoffMatchup {
  id: string;
  round: 'Wild Card' | 'Divisional' | 'Conference Championship' | 'Super Bowl';
  higherSeedId: string;
  lowerSeedId: string;
  higherSeedName: string;
  lowerSeedName: string;
  week: number;
  winnerId?: string;
  higherSeedScore?: number;
  lowerSeedScore?: number;
  isComplete: boolean;
}

export interface StaffMember {
  id: string;
  name: string;
  position: string;
  teamId?: string;
  overallRating: number;
}

export interface TradeOffer {
  id: string;
  offeringTeamId: string;
  receivingTeamId: string;
  offeringPlayers: string[];
  receivingPlayers: string[];
  offeringPicks: TradePickInfo[];
  receivingPicks: TradePickInfo[];
  status: 'pending' | 'accepted' | 'rejected';
  createdDate: Date;
  expirationDate: Date;
  isPlayerInitiated: boolean;
  season: number;
  week: number;
}

export interface TradePickInfo {
  year: number;
  round: number;
  originalTeamId: string;
}

export interface DraftProspect {
  id: string;
  // Identity
  firstName: string;
  lastName: string;
  name: string;             // "First Last" — for legacy callers
  position: Position;
  college: string;
  // Hidden truth (never exposed directly in draft UI before scouting)
  overall: number;
  potential: number;
  projectedRound: number;   // 1–7; 8 = UDFA
  // Scouting fog-of-war
  scoutingRange: { min: number; max: number };
  scoutingPointsSpent: number; // 0 = full fog, 1 = narrowed, 2+ = revealed
  medicalGrade: 'A' | 'B' | 'C' | 'D';
  // Optional legacy combine fields
  height?: number;
  weight?: number;
  fortyYardDash?: number;
  benchPress?: number;
  verticalJump?: number;
  broadJump?: number;
  threeConeDrill?: number;
  shutouteDrill?: number;
}

export interface DraftCompletionManager {
  isDraftCompleted: boolean;
  draftIsLocked: boolean;
  showingSummaryScreen: boolean;
  draftSummary?: any;
  canAdvanceWeek: boolean;
}

export interface TrophyManager {
  trophies: Record<string, boolean>;
}

export interface CompletedTrade {
  id: string;
  season: number;
  week: number;
  team1Id: string; // Offering Team
  team2Id: string; // Receiving Team
  team1Assets: string[]; // Descriptions of what Team 1 gave
  team2Assets: string[]; // Descriptions of what Team 2 gave
}

export const TRADE_SYSTEM_DEADLINE_WEEK = 39;
const PLAYOFF_BRACKET_KEY = 'NFL_PlayoffBracket';

interface TradedPick {
  year: number;
  round: number;
  original_team: string;
  new_owner: string;
  notes: string;
}

// MARK: - Core GameStateManager Class

export class GameStateManager {
  // Time & Simulation Properties
  currentGameDate: GameDate;
  simulationState: SimulationState = SimulationState.IDLE;
  currentProcessingDescription: string = '';
  currentProcessingProgress: number = 0;
  interruptQueue: ProcessingInterrupt[] = [];
  actionItemQueue: ActionItem[] = []; // Progression blockers (roster, cap, etc.)
  activeInterrupt: ProcessingInterrupt | null = null;
  recentHeadlines: NewsHeadline[] = [];
  simulationSpeedMultiplier: number = 1.0;
  autoPauseSettings: AutoPauseSettings = { pauseOnInjuries: false, pauseOnTradeOffers: false };
  acknowledgedInterrupts: Set<string> = new Set();
  simulationDigest: NewsHeadline[] = [];
  maxHeadlinesHistory: number = 50;
  simulationTask: any = null;

  // GM Profile & Game Data
  userProfile: UserProfile | null = null;
  userTeamId: string | null = null;
  difficulty: GameDifficulty = GameDifficulty.NORMAL;
  teams: Team[] = [];
  allPlayers: Player[] = [];
  freeAgents: Player[] = [];
  schedule: GameSchedule[] = [];
  scheduleIsValid: boolean = true;
  weeklyResults: WeeklyResult[] = [];

  // Notifications & Communications
  notifications: GameNotification[] = [];
  inbox: InboxItem[] = [];
  tradeRumors: any[] = [];
  playerRelationships: PlayerRelationship[] = [];
  socialCliques: SocialClique[] = [];

  // Staff & Trading
  availableStaff: StaffMember[] = [];
  tradeOffers: TradeOffer[] = [];
  sentTradeOffers: TradeOffer[] = [];
  receivedTradeOffers: TradeOffer[] = [];
  completedTrades: CompletedTrade[] = [];
  leagueTradeBlock: Set<string> = new Set();

  debugMode: boolean = false;

  // Draft Properties
  draftOrder: string[] = [];
  isDraftOrderLocked: boolean = false;
  draftProspects: DraftProspect[] = [];
  draftBoard: DraftProspect[] = [];
  draftPicks: TeamDraftPick[] = [];
  isDraftActive: boolean = false;
  currentDraftRound: number = 1;
  currentDraftPick: number = 1;
  draftCompletionManager: DraftCompletionManager = {
    isDraftCompleted: false,
    draftIsLocked: false,
    showingSummaryScreen: false,
    canAdvanceWeek: false
  };

  // Financial & UI
  salaryCap: number = 255_000_000;
  leagueMinimumSalary: number = 750_000;
  selectedTab: number = 0;
  isSimulating: boolean = false;
  simulationSpeed: SimulationSpeed = SimulationSpeed.NORMAL;
  trophyManager: TrophyManager = { trophies: {} };
  completedEvents: Set<SeasonEvent> = new Set();

  // Offseason Development
  developmentState: DevelopmentState = {
    lastProcessedWeek: 0,
    lastProcessedSlot: '',
    reports: []
  };

  // Scouting
  scoutingPointsAvailable: number = 15;

  // Compensatory Pick System
  offseasonTransactions: FreeAgencyTransaction[] = [];
  compPicks: CompPick[] = [];
  compensatoryPickSystem: CompensatoryPickSystem = new CompensatoryPickSystem();

  // ── Injected sub-systems (PRD §5 — pure TS classes, zero React) ────────────
  agentPersonalitySystem: AgentPersonalitySystem = new AgentPersonalitySystem();
  tradeSystem: TradeSystem = new TradeSystem();
  financeSystem: FinanceSystem = new FinanceSystem();
  /** Populated by AI initiative; TradeScreen reads this on mount for Negotiate flow. */
  pendingAITradeOffer: TradeOfferPayloadUI | null = null;
  private _negotiationAttempts = new Map<string, number>();
  draftEngine: DraftEngine | null = null; // Created when a draft begins

  // Constants
  static readonly MAX_PRACTICE_SQUAD_SIZE = 16;
  static readonly MAX_PS_PROTECTIONS = 4;
  static readonly MIN_WEEKS_ON_IR = 4;

  constructor() {
    this.currentGameDate = {
      season: 2025,
      week: 1,
      dayOfWeek: 1,
      timeSlot: TimeSlots.earlyMorning
    };
  }

  // MARK: - Debugging

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    console.log(`🛠️ Debug Mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  logDebug(message: string): void {
    if (this.debugMode) console.log(`🛠️ ${message}`);
  }

  // ── Draft Pick Initialization ──────────────────────────────────────────────

  generateInitialDraftPicks(): void {
    const DRAFT_YEARS = [2026, 2027, 2028];
    const TOTAL_ROUNDS = 7;
    // All 32 teams
    const TEAMS = [
      "ARI","ATL","BAL","BUF","CAR","CHI","CIN","CLE","DAL","DEN",
      "DET","GB","HOU","IND","JAX","KC","LAC","LAR","LV","MIA",
      "MIN","NE","NO","NYG","NYJ","PHI","PIT","SEA","SF","TB","TEN","WAS"
    ];

    const picks: TeamDraftPick[] = [];
    const tradedPicks = (draftTradeData as any).traded_picks as TradedPick[];
    const tradeMap = new Map<string, { owner: string, notes: string }>();

    for (const tp of tradedPicks) {
      const key = `${tp.year}-${tp.round}-${tp.original_team}`;
      tradeMap.set(key, { owner: tp.new_owner, notes: tp.notes });
    }

    for (const year of DRAFT_YEARS) {
      for (let round = 1; round <= TOTAL_ROUNDS; round++) {
        for (const team of TEAMS) {
          const key = `${year}-${round}-${team}`;
          const tradeInfo = tradeMap.get(key);
          
          picks.push({
            year,
            round,
            originalTeamId: team,
            currentTeamId: tradeInfo ? tradeInfo.owner : team,
            notes: tradeInfo ? tradeInfo.notes : undefined,
          });
        }
      }
    }
    this.draftPicks = picks;
    console.log(`✅ [GameStateManager] Generated ${picks.length} initial draft picks`);
  }

  // ── Draft engine factory ────────────────────────────────────────────────────

  /**
   * Initialise the DraftEngine just before the draft begins.
   * The engine is created fresh each draft so its pick history is clean.
   */
  initDraftEngine(): DraftEngine {
    const self = this;
    this.draftEngine = new DraftEngine({
      get allPlayers()    { return self.allPlayers; },
      get teams()         { return self.teams; },
      get userTeamId()    { return self.userTeamId; },
      get draftProspects(){ return self.draftProspects; },
      get draftOrder()    { return self.draftOrder; },
      get currentDraftRound() { return self.currentDraftRound; },
      get currentDraftPick()  { return self.currentDraftPick; },
      get isDraftActive() { return self.isDraftActive; },
      pushEngineInterrupt(reason, payload, title, description) {
        self._handleEngineInterrupt(self._buildEngineInterrupt(reason, payload as any, title, description));
      },
      onDraftPickMade(result: DraftPickResult) {
        self.currentDraftPick = result.pickNumber + 1;
        if ((result.pickNumber) % self.draftOrder.length === 0) {
          self.currentDraftRound = result.round + 1;
        }
        self.onEngineStateChange?.();
        self.onAutoSave?.();
      },
      onDraftComplete() {
        self.isDraftActive = false;
        self.draftCompletionManager.isDraftCompleted = true;
        self.draftCompletionManager.canAdvanceWeek = true;
        self.addNotification('Draft Complete', 'All rounds of the NFL Draft are complete.', 'draft' as any, 'high' as any);
        self.onEngineStateChange?.();
      },
      addHeadline(title, body, category, importance) {
        self.addHeadline(title, body, category as any, importance as any);
      },
    });
    return this.draftEngine;
  }

  // MARK: - Computed Properties

  get currentSeason(): number {
    return this.currentGameDate.season;
  }

  get currentWeek(): number {
    return this.currentGameDate.week;
  }

  get currentPhase(): SeasonPhase {
    return this.getSeasonPhase(this.currentGameDate.week);
  }

  get userTeam(): Team | undefined {
    return this.teams.find(t => t.id === this.userTeamId);
  }

  get userRoster(): Player[] {
    return this.allPlayers.filter(p => p.teamId === this.userTeamId);
  }

  get userPracticeSquad(): Player[] {
    return this.allPlayers.filter(p => p.teamId === this.userTeamId && p.status === PlayerStatus.PRACTICE_SQUAD);
  }

  get userInjuredReserve(): Player[] {
    return this.allPlayers.filter(p => p.teamId === this.userTeamId && p.status === PlayerStatus.INJURED_RESERVE);
  }

  get unreadNotifications(): number {
    return this.notifications.filter(n => !n.isRead).length;
  }

  get unreadMessages(): number {
    return this.inbox.filter(m => !m.isRead).length;
  }

  get pendingTradeOffers(): number {
    return this.receivedTradeOffers.filter(o => o.status === 'pending').length;
  }

  get isOffseason(): boolean {
    return this.currentPhase === SeasonPhase.OFFSEASON;
  }

  get hasGamesThisWeek(): boolean {
    if (this.currentWeek < 25) return false;
    return this.schedule.some(g => g.week === this.currentWeek);
  }

  get maxRosterSize(): number {
    switch (this.currentPhase) {
      case SeasonPhase.REGULAR_SEASON:
      case SeasonPhase.PLAYOFFS:
      case SeasonPhase.SUPER_BOWL:
        return 53;
      case SeasonPhase.PRESEASON:
      default:
        return 90;
    }
  }

  get phaseDescription(): string {
    const descriptions: Record<SeasonPhase, string> = {
      [SeasonPhase.OFFSEASON]: 'Teams prepare for the upcoming season.',
      [SeasonPhase.SCOUTING_COMBINE]: 'College prospects showcase their abilities.',
      [SeasonPhase.FREE_AGENCY]: 'Free agents can sign with new teams.',
      [SeasonPhase.POST_FREE_AGENCY]: 'Prepare your draft board.',
      [SeasonPhase.DRAFT]: 'Select new talent in the NFL Draft.',
      [SeasonPhase.POST_DRAFT]: 'Integrate rookies and finalize roster.',
      [SeasonPhase.TRAINING_CAMP]: 'Teams begin intensive preparation.',
      [SeasonPhase.PRESEASON]: 'Exhibition games.',
      [SeasonPhase.REGULAR_SEASON]: 'The official NFL season is underway.',
      [SeasonPhase.PLAYOFFS]: 'Win-or-go-home elimination games.',
      [SeasonPhase.SUPER_BOWL]: 'The ultimate championship game.'
    };
    return descriptions[this.currentPhase];
  }

  // MARK: - Helper Methods

  getCapSpace(teamId: string): number {
    const roster = this.allPlayers.filter(p => p.teamId === teamId);
    const totalCapHit = roster.reduce((sum, p) => sum + (p.contract?.currentYearCap || 0), 0);
    return this.salaryCap - totalCapHit;
  }

  get userTeamCapSpace(): number {
    return this.userTeamId ? this.getCapSpace(this.userTeamId) : 0;
  }

  getCapHit(teamId: string): number {
    const roster = this.allPlayers.filter(p => p.teamId === teamId);
    return roster.reduce((sum, p) => sum + (p.contract?.currentYearCap || 0), 0);
  }

  private getSeasonPhase(week: number): SeasonPhase {
    switch (true) {
      case week >= 1 && week <= 4:
        return SeasonPhase.OFFSEASON;
      case week >= 5 && week <= 10:
        return SeasonPhase.FREE_AGENCY;
      case week >= 11 && week <= 14:
        return SeasonPhase.POST_FREE_AGENCY;
      case week === 15:
        return SeasonPhase.DRAFT;
      case week >= 16 && week <= 20:
        return SeasonPhase.POST_DRAFT;
      case week >= 21 && week <= 24:
        return SeasonPhase.TRAINING_CAMP;
      case week >= 25 && week <= 28:
        return SeasonPhase.PRESEASON;
      case week >= 29 && week <= 46:
        return SeasonPhase.REGULAR_SEASON;
      case week >= 47 && week <= 51:
        return SeasonPhase.PLAYOFFS;
      case week === 52:
        return SeasonPhase.SUPER_BOWL;
      default:
        return SeasonPhase.OFFSEASON;
    }
  }

  // MARK: - Initialization & Setup

  setupGame(): void {
    // Generate teams, players, schedule
    // This would integrate with Team.createNFLTeams() and related functions
    console.log('🏈 Setting up game...');
  }

  initializeGM(firstName: string, lastName: string): void {
    this.userProfile = createUserProfile(firstName, lastName);
    console.log(`👤 [GameStateManager] GM initialized: ${firstName} ${lastName}`);
  }

  selectUserTeam(teamId: string): void {
    this.userTeamId = teamId;
    this.addNotification(
      'Team Selected',
      `GM of ${this.userTeam ? `${this.userTeam.city} ${this.userTeam.name}` : 'Team'}`,
      NotificationType.MILESTONE,
      NotificationPriority.HIGH
    );
  }

  // MARK: - Notification & Communication Methods

  addNotification(
    title: string,
    message: string,
    type: NotificationType,
    priority: NotificationPriority,
    relatedPlayerIds: string[] = [],
    relatedTeamIds: string[] = []
  ): void {
    const notification: GameNotification = {
      id: uuidv4(),
      title,
      message,
      type,
      date: new Date(),
      priority,
      isRead: false,
      relatedPlayerIds,
      relatedTeamIds
    };
    this.notifications.unshift(notification);
    if (this.notifications.length > 50) {
      this.notifications = this.notifications.slice(0, 50);
    }
  }

  addHeadline(
    title: string,
    body: string,
    category: NewsCategory,
    importance: NewsImportance
  ): void {
    const headline: NewsHeadline = {
      id: uuidv4(),
      title,
      body,
      timestamp: this.currentGameDate,
      category,
      importance
    };
    this.recentHeadlines.unshift(headline);
    if (this.recentHeadlines.length > 100) {
      this.recentHeadlines = this.recentHeadlines.slice(0, 100);
    }
  }

  addInboxMessage(
    subject: string,
    body: string,
    sender: string,
    category: InboxItem['category'],
    requiresAction: boolean = false
  ): void {
    const message: InboxItem = {
      id: uuidv4(),
      subject,
      body,
      sender,
      date: new Date(),
      category,
      isRead: false,
      requiresAction
    };
    this.inbox.unshift(message);
  }

  // MARK: - Team Rating Updates

  updateTeamRatings(teamId: string): void {
    const teamIndex = this.teams.findIndex(t => t.id === teamId);
    if (teamIndex === -1) return;

    const teamRoster = this.allPlayers.filter(p => p.teamId === teamId && p.status === PlayerStatus.ACTIVE);
    const offensivePlayers = teamRoster.filter(p => this.isOffensivePosition(p.position));
    const defensivePlayers = teamRoster.filter(p => !this.isOffensivePosition(p.position));

    const offenseRating = this.calculateUnitRating(offensivePlayers);
    const defenseRating = this.calculateUnitRating(defensivePlayers);

    this.teams[teamIndex].offenseRating = offenseRating;
    this.teams[teamIndex].defenseRating = defenseRating;
  }

  updateAllTeamRatings(): void {
    for (const team of this.teams) {
      this.updateTeamRatings(team.id);
    }
  }

  private calculateUnitRating(players: Player[]): number {
    if (players.length === 0) return 70;
    const sorted = players.sort((a, b) => b.overall - a.overall);
    const topContributors = sorted.slice(0, 11);
    const total = topContributors.reduce((sum, p) => sum + p.overall, 0);
    return Math.floor(total / topContributors.length);
  }

  private isOffensivePosition(position: Position): boolean {
    const offensivePositions = [
      Position.QB,
      Position.RB,
      Position.WR,
      Position.TE,
      Position.OL,
    ];
    return offensivePositions.includes(position);
  }

  // MARK: - Simulation Control

  stopSimulation(): void {
    console.log('🛑 [USER] Requested Stop Simulation');
    this.isSimulating = false;
    this.simulationState = SimulationState.IDLE;
    this.currentProcessingDescription = 'Stopped by user';
    this.activeInterrupt = null;
  }

  refreshContractViews(): void {
    console.log('🔄 Contract views refreshed');
  }

  ensureSimulationCanStart(): boolean {
    if (this.simulationState !== SimulationState.IDLE && this.simulationState !== SimulationState.PAUSED_FOR_INTERRUPT) {
      console.log(`⚠️ Cannot start simulation - state is ${this.simulationState}`);
      return false;
    }

    if (this.activeInterrupt && !this.activeInterrupt.isResolved) {
      console.log(`⚠️ Cannot start simulation - unresolved interrupt`);
      return false;
    }

    return true;
  }

  // MARK: - Season Events

  nextEvent(): SeasonEvent | undefined {
    for (const event of Object.values(SeasonEvent)) {
      const week = this.getEventWeek(event);
      if (week >= this.currentWeek && !this.isEventCompleted(event)) {
        return event;
      }
    }
    return undefined;
  }

  isEventCompleted(event: SeasonEvent): boolean {
    return this.completedEvents.has(event);
  }

  /**
   * Mark event as completed and handle any associated side effects
   * For DRAFT event, this triggers compensatory pick setup
   */
  markEventCompleted(event: SeasonEvent): void {
    this.completedEvents.add(event);
    console.log(`✅ Completed event: ${event}`);

    if (event === SeasonEvent.DRAFT) {
      console.log('📋 Draft phase completed');
    }

    // Auto-save after every completed event
    this.onAutoSave?.();
    console.log(`💾 [markEventCompleted] Auto-save triggered after: ${event}`);
  }

  /**
   * Handle phase transition to DRAFT
   * Sets up compensatory picks before draft begins
   * Should be called when currentPhase transitions to DRAFT
   */
  onEnterDraftPhase(): Map<number, number> {
    console.log('\n🏈 Entering Draft Phase...');

    // Generate the draft class for this season (real data 2026, procedural 2027+)
    this.draftProspects = generateDraftClass(this.currentGameDate.season);
    this.draftBoard = [...this.draftProspects];
    this.scoutingPointsAvailable = 15;
    console.log(`[Draft] Generated ${this.draftProspects.length} prospects for season ${this.currentGameDate.season}`);

    // Setup draft with compensatory picks
    const compPicksPerRound = this.setupDraftWithCompensatoryPicks();

    return compPicksPerRound;
  }

  private getEventWeek(event: SeasonEvent): number {
    const eventWeeks: Record<SeasonEvent, number> = {
      [SeasonEvent.SCOUTING_COMBINE]: 5,
      [SeasonEvent.FREE_AGENCY_START]: 5,
      [SeasonEvent.FREE_AGENCY_END]: 10,
      [SeasonEvent.DRAFT]: 15,
      [SeasonEvent.TRAINING_CAMP_START]: 21,
      [SeasonEvent.PRESEASON_START]: 25,
      [SeasonEvent.ROSTER_CUTS]: 28,
      [SeasonEvent.REGULAR_SEASON_START]: 29,
      [SeasonEvent.TRADE_DEADLINE]: 37,
      [SeasonEvent.REGULAR_SEASON_END]: 46,
      [SeasonEvent.PLAYOFFS_START]: 47,
      [SeasonEvent.SUPER_BOWL]: 52,
      [SeasonEvent.SEASON_END]: 52
    };
    return eventWeeks[event] || 52;
  }

  // MARK: - Playoff Bracket Persistence

  async savePlayoffBracket(bracket: PlayoffBracket): Promise<void> {
    try {
      const data = JSON.stringify(bracket);
      await storage.savePlayoffBracket(bracket.season, data);
      console.log(`💾 [Persistence] Playoff bracket saved for season ${bracket.season}`);
    } catch (error) {
      console.error('❌ [Persistence] Failed to save playoff bracket:', error);
    }
  }

  async loadPlayoffBracket(): Promise<PlayoffBracket | null> {
    try {
      const season = this.currentGameDate.season;
      const data = await storage.loadPlayoffBracket(season);
      if (!data) {
        console.log('📂 [Persistence] No saved playoff bracket found');
        return null;
      }
      const bracket = JSON.parse(data) as PlayoffBracket;
      console.log(`✅ [Persistence] Loaded playoff bracket for season ${bracket.season}`);
      return bracket;
    } catch (error) {
      console.error('❌ [Persistence] Failed to load playoff bracket:', error);
      return null;
    }
  }

  async clearSavedPlayoffBracket(): Promise<void> {
    const season = this.currentGameDate.season;
    await storage.deletePlayoffBracket(season);
    console.log('🗑️ [Persistence] Cleared saved playoff bracket');
  }

  // MARK: - Practice Squad Management

  addToPracticeSquad(playerId: string, teamId: string): boolean {
    const playerIndex = this.allPlayers.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      console.log(`❌ [PS] Player not found: ${playerId}`);
      return false;
    }

    const player = this.allPlayers[playerIndex];
    const currentPSSize = this.allPlayers.filter(
      p => p.teamId === teamId && p.status === PlayerStatus.PRACTICE_SQUAD
    ).length;

    if (currentPSSize >= GameStateManager.MAX_PRACTICE_SQUAD_SIZE) {
      console.log(`❌ [PS] Practice Squad full (${currentPSSize}/${GameStateManager.MAX_PRACTICE_SQUAD_SIZE})`);
      return false;
    }

    this.allPlayers[playerIndex].status = PlayerStatus.PRACTICE_SQUAD;
    this.allPlayers[playerIndex].teamId = teamId;

    console.log(`✅ [PS] Added ${player.firstName} ${player.lastName} to Practice Squad`);
    return true;
  }

  promoteFromPracticeSquadToActive(playerId: string): boolean {
    const playerIndex = this.allPlayers.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      console.log(`❌ [PS] Player not found: ${playerId}`);
      return false;
    }

    if (this.allPlayers[playerIndex].status !== PlayerStatus.PRACTICE_SQUAD) {
      console.log('❌ [PS] Player not on Practice Squad');
      return false;
    }

    this.allPlayers[playerIndex].status = PlayerStatus.ACTIVE;

    const player = this.allPlayers[playerIndex];
    this.addNotification(
      'Practice Squad Promotion',
      `${player.firstName} ${player.lastName} promoted from Practice Squad to active roster`,
      NotificationType.ROSTER,
      NotificationPriority.MEDIUM,
      [playerId]
    );

    console.log(`✅ [PS] Promoted ${player.firstName} ${player.lastName} to active roster`);
    return true;
  }

  // MARK: - Injured Reserve Management

  moveToInjuredReserve(playerId: string): boolean {
    const playerIndex = this.allPlayers.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      console.log(`❌ [IR] Player not found: ${playerId}`);
      return false;
    }

    const player = this.allPlayers[playerIndex];
    this.allPlayers[playerIndex].status = PlayerStatus.INJURED_RESERVE;

    this.addNotification(
      'Placed on IR',
      `${player.firstName} ${player.lastName} has been placed on Injured Reserve`,
      NotificationType.INJURY,
      NotificationPriority.HIGH,
      [playerId]
    );

    console.log(`✅ [IR] Moved ${player.firstName} ${player.lastName} to Injured Reserve (Week ${this.currentWeek})`);
    return true;
  }

  activateFromInjuredReserve(playerId: string): boolean {
    const playerIndex = this.allPlayers.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      console.log(`❌ [IR] Player not found: ${playerId}`);
      return false;
    }

    if (this.allPlayers[playerIndex].status !== PlayerStatus.INJURED_RESERVE) {
      console.log('❌ [IR] Player is not on IR');
      return false;
    }

    this.allPlayers[playerIndex].status = PlayerStatus.ACTIVE;

    const player = this.allPlayers[playerIndex];
    this.addNotification(
      'Activated from IR',
      `${player.firstName} ${player.lastName} has been activated from Injured Reserve`,
      NotificationType.ROSTER,
      NotificationPriority.HIGH,
      [playerId]
    );

    console.log(`✅ [IR] Activated ${player.firstName} ${player.lastName} from Injured Reserve`);
    return true;
  }

  // MARK: - Debug Utilities

  printRosterDebugInfo(): void {
    if (!this.userTeam) {
      console.log('❌ [Debug] No user team selected');
      return;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 ROSTER DEBUG INFO - ${this.userTeam.city} ${this.userTeam.name} - Week ${this.currentWeek}`);
    console.log(`${'='.repeat(60)}`);

    const teamPlayers = this.allPlayers.filter(p => p.teamId === this.userTeamId);
    const active = teamPlayers.filter(p => p.status === PlayerStatus.ACTIVE);
    const ps = teamPlayers.filter(p => p.status === PlayerStatus.PRACTICE_SQUAD);
    const ir = teamPlayers.filter(p => p.status === PlayerStatus.INJURED_RESERVE);

    console.log('\n📊 ROSTER COUNTS:');
    console.log(`   Active: ${active.length} / 53`);
    console.log(`   Practice Squad: ${ps.length} / 16`);
    console.log(`   Injured Reserve: ${ir.length}`);
    console.log(`   Total: ${teamPlayers.length}`);

    console.log(`\n${'='.repeat(60)}\n`);
  }

  printSeasonDebugInfo(): void {
    console.log(`\n${'='.repeat(60)}`);
    console.log('📅 SEASON DEBUG INFO');
    console.log(`${'='.repeat(60)}`);
    console.log(`   Season: ${this.currentSeason}`);
    console.log(`   Week: ${this.currentWeek}`);
    console.log(`   Phase: ${this.currentPhase}`);
    console.log(`   Is Regular Season: ${this.currentPhase === SeasonPhase.REGULAR_SEASON}`);
    console.log(`   Is Playoffs: ${this.currentPhase === SeasonPhase.PLAYOFFS || this.currentPhase === SeasonPhase.SUPER_BOWL}`);

    const gamesThisWeek = this.schedule.filter(g => g.week === this.currentWeek);
    console.log(`   Games This Week: ${gamesThisWeek.length}`);
    console.log(`   Games Played: ${gamesThisWeek.filter(g => g.isPlayed).length}`);

    console.log(`${'='.repeat(60)}\n`);
  }

  // MARK: - Compensatory Pick System Integration

  /**
   * Track a free agent signing for compensatory pick calculation
   * Called whenever a player signs with a team during free agency
   *
   * Parameters:
   *   - playerId: UUID of the player signing
   *   - oldTeamId: Team the player left (or undefined if they were unemployed)
   *   - newTeamId: Team the player is joining
   *   - contract: The contract details (including APY)
   *   - snapPercentage: Percentage of snaps played last season (0.0-1.0)
   *   - isAllPro: Whether player was All-Pro last year
   *   - isProBowl: Whether player was Pro Bowl last year
   */
  recordFreeAgentSigning(
    playerId: string,
    oldTeamId: string | null,
    newTeamId: string,
    apy: number,
    snapPercentage: number = 0.5,
    isAllPro: boolean = false,
    isProBowl: boolean = false
  ): void {
    // Only track if player left another team (was a true UFA)
    if (!oldTeamId) {
      return;
    }

    const player = this.allPlayers.find(p => p.id === playerId);
    if (!player) {
      return;
    }

    // Create transaction record
    const transaction: FreeAgencyTransaction = {
      id: uuidv4(),
      playerId,
      playerPosition: player.position,
      oldTeamId,
      newTeamId,
      averageYearlyValue: apy,
      snapPercentage,
      isAllPro,
      isProBowl,
      isUnrestrictedFreeAgent: player.accruedSeasons > 3,
      contractExpiredNaturally: true, // Assume contract expiration for now
      signedBeforeDeadline: true, // Assume early signing
      transactionDate: new Date()
    };

    this.offseasonTransactions.push(transaction);
  }

  /**
   * Calculate and inject compensatory picks into the draft
   * Should be called after free agency ends (Week 10) before draft setup
   *
   * Returns: Array of compensatory picks that were generated
   */
  injectCompensatoryPicks(): CompPick[] {
    console.log('\n🏈 [CompPicks] Starting compensatory pick calculation...');

    // Create map of player IDs to names for display
    const playerNames = new Map<string, string>();
    for (const player of this.allPlayers) {
      playerNames.set(player.id, `${player.firstName} ${player.lastName}`);
    }

    // Calculate comp picks using the system
    const newPicks = this.compensatoryPickSystem.calculateCompensatoryPicks(
      this.offseasonTransactions,
      playerNames,
      this.debugMode
    );

    // Store in state
    this.compPicks = newPicks;

    // Log results
    console.log(`✅ [CompPicks] Generated ${newPicks.length} compensatory picks`);
    console.log(`   These picks will be inserted at the end of rounds 3-7`);

    // Clear transactions for next season
    this.offseasonTransactions = [];

    return newPicks;
  }

  /**
   * Get compensatory picks for a specific round
   * Used by draft system to insert comp picks at end of each round
   *
   * Parameters:
   *   - round: Draft round number (3-7)
   *
   * Returns: Array of comp picks for this round, sorted by value
   */
  getCompPicksForRound(round: number): CompPick[] {
    return this.compPicks
      .filter(pick => pick.round === round)
      .sort((a, b) => b.overallRank - a.overallRank);
  }

  /**
   * Get total number of picks in draft (224 base + comp picks)
   * Used for draft validation
   *
   * Returns: Total pick count (max 224 + 32 = 256 with comp picks)
   */
  getTotalDraftPickCount(): number {
    // 224 regular picks (7 rounds × 32 teams)
    // + up to 32 compensatory picks
    return 224 + this.compPicks.length;
  }

  /**
   * Clear all recorded compensatory picks (e.g., when starting a new season)
   */
  clearCompensatoryPicks(): void {
    this.compPicks = [];
    this.offseasonTransactions = [];
    console.log('🗑️ [CompPicks] Cleared all compensatory picks and transactions');
  }

  /**
   * Setup draft with compensatory picks
   * Should be called when transitioning from free agency to draft phase
   *
   * Returns: Map of round number to compensatory pick count
   */
  setupDraftWithCompensatoryPicks(): Map<number, number> {
    console.log('\n🏈 [Draft Setup] Preparing draft with compensatory picks...');

    // Inject compensatory picks
    this.injectCompensatoryPicks();

    // Calculate comp picks per round for draft system
    const compPicksPerRound = new Map<number, number>();
    for (let round = 3; round <= 7; round++) {
      const count = this.getCompPicksForRound(round).length;
      if (count > 0) {
        compPicksPerRound.set(round, count);
        console.log(`   Round ${round}: ${count} compensatory picks`);
      }
    }

    const totalComps = Array.from(compPicksPerRound.values()).reduce((a, b) => a + b, 0);
    console.log(`✅ [Draft Setup] Total compensatory picks: ${totalComps}`);

    return compPicksPerRound;
  }

  /**
   * Print diagnostic information about the compensatory pick system
   */
  printCompensatoryPickDiagnostics(): void {
    this.compensatoryPickSystem.printCompensatoryPickDiagnostics(this.offseasonTransactions);
  }

  // MARK: - Store Sync & Hydration

  /**
   * Hydrate this manager from a loaded GameStore.
   * Call this immediately after gameStore.loadGame() to restore all simulation state.
   */
  hydrateFromStore(store: import('../stores/GameStore').GameStore): void {
    this.userProfile = store.userProfile;
    this.userTeamId = store.userTeamId || null;
    this.allPlayers = store.allPlayers;
    this.teams = store.teams;
    if (store.currentDate) {
      this.currentGameDate = {
        ...this.currentGameDate,
        season: store.currentDate.year,
        week: store.currentDate.week,
      };
    }
    const raw = store as any;
    if (raw.offseasonTransactions) this.offseasonTransactions = raw.offseasonTransactions;
    if (raw.compPicks) this.compPicks = raw.compPicks;
    if (raw.interruptQueue) this.interruptQueue = raw.interruptQueue;
    if (raw.completedEvents) this.completedEvents = new Set(raw.completedEvents);
    if (raw.fullGameDate) this.currentGameDate = raw.fullGameDate;
    if (raw.freeAgents) this.freeAgents = raw.freeAgents;
    if (raw.draftPicks) this.draftPicks = raw.draftPicks;
    if (raw.draftProspects) this.draftProspects = raw.draftProspects;
    if (raw.draftOrder) this.draftOrder = raw.draftOrder;
    if (raw.availableStaff) this.availableStaff = raw.availableStaff;
    if (raw.completedTrades) this.completedTrades = raw.completedTrades;
    if (raw.draftPicks) this.draftPicks = raw.draftPicks;
    if (raw.scoutingPointsAvailable != null) this.scoutingPointsAvailable = raw.scoutingPointsAvailable;
    console.log(`✅ [GameStateManager] Hydrated from store — Week ${this.currentWeek}, Season ${this.currentSeason}`);
  }

  /**
   * Push the manager's authoritative state into the store so saveGame() captures it.
   * Always call this before gameStore.saveGame().
   */
  syncToStore(store: import('../stores/GameStore').GameStore): void {
    store.userProfile = this.userProfile;
    store.userTeamId = this.userTeamId ?? '';
    store.allPlayers = this.allPlayers;
    store.teams = this.teams;
    store.currentDate = { year: this.currentGameDate.season, week: this.currentGameDate.week };
    const raw = store as any;
    raw.offseasonTransactions = this.offseasonTransactions;
    raw.compPicks = this.compPicks;
    raw.interruptQueue = this.interruptQueue;
    raw.completedEvents = Array.from(this.completedEvents);
    raw.fullGameDate = this.currentGameDate;
    raw.freeAgents = this.freeAgents;
    raw.draftPicks = this.draftPicks;
    raw.draftProspects = this.draftProspects;
    raw.draftOrder = this.draftOrder;
    raw.availableStaff = this.availableStaff;
    raw.completedTrades = this.completedTrades;
    raw.scoutingPointsAvailable = this.scoutingPointsAvailable;
  }

  // MARK: - Simulation Tick

  /**
   * Advance one time slot. Called by the UI's "Simulate" button.
   * Checks interrupts first; rolls day/week boundaries as needed.
   */
  tick(): void {
    if (this.simulationState === SimulationState.PAUSED_FOR_INTERRUPT) return;

    const pending = this.interruptQueue.find(i => !i.isResolved);
    if (pending) {
      this.activeInterrupt = pending;
      this.simulationState = SimulationState.PAUSED_FOR_INTERRUPT;
      console.log(`⏸️ [Tick] Paused for interrupt: ${JSON.stringify(pending.type)}`);
      return;
    }

    const next = getNextTimeSlot(this.currentGameDate.timeSlot);
    const wrapping = next.rawValue === TimeSlots.earlyMorning.rawValue;

    if (wrapping) {
      const nextDay = this.currentGameDate.dayOfWeek + 1;
      if (nextDay > 7) {
        this.currentGameDate = { ...this.currentGameDate, dayOfWeek: 1, timeSlot: next };
        this.onWeekBoundary();
      } else {
        this.currentGameDate = { ...this.currentGameDate, dayOfWeek: nextDay, timeSlot: next };
      }
    } else {
      this.currentGameDate = { ...this.currentGameDate, timeSlot: next };
    }
  }

  /**
   * Full async week simulation loop — processes every time slot with gated logic
   * and batch skipping for the offseason dead zone (weeks 1–24).
   */
  async advanceWeekAsync(): Promise<void> {
    const startWeek = this.currentWeek;
    this.isSimulating = true;
    this.simulationState = SimulationState.SIMULATING;

    while (this.currentGameDate.week === startWeek && this.isSimulating) {
      const pending = this.interruptQueue.find(i => !i.isResolved);
      if (pending) {
        this.activeInterrupt = pending;
        this.simulationState = SimulationState.PAUSED_FOR_INTERRUPT;
        break;
      }

      // Dead-zone batch skip: jump to day 7 for weeks 1–24
      if (this.currentGameDate.week < 25 && this.currentGameDate.dayOfWeek < 7) {
        this.currentGameDate = { ...this.currentGameDate, dayOfWeek: 7 };
        continue;
      }

      // Offseason development: gated to Day 2 Early Morning, weeks 16–20
      if (
        this.currentGameDate.week >= 16 && this.currentGameDate.week <= 20 &&
        this.currentGameDate.dayOfWeek === 2 &&
        this.currentGameDate.timeSlot.rawValue === TimeSlots.earlyMorning.rawValue
      ) {
        this.processOffseasonDevelopment();
      }

      // AI decisions during business-hours slots only
      if (this.currentGameDate.timeSlot.shouldProcessAIActions) {
        this.simulateAIDecisions();
      }

      // Advance one slot
      this.advanceTimeSlotClock();
    }

    if (this.simulationState !== SimulationState.PAUSED_FOR_INTERRUPT) {
      this.simulationState = SimulationState.IDLE;
    }
    this.isSimulating = false;
  }

  /** Move the clock forward one slot; rolls day and week as needed. */
  private advanceTimeSlotClock(): void {
    const next = getNextTimeSlot(this.currentGameDate.timeSlot);
    const wrapping = next.rawValue === TimeSlots.earlyMorning.rawValue;
    if (wrapping) {
      const nextDay = this.currentGameDate.dayOfWeek + 1;
      if (nextDay > 7) {
        this.currentGameDate = { ...this.currentGameDate, dayOfWeek: 1, timeSlot: next };
        this.onWeekBoundary();
      } else {
        this.currentGameDate = { ...this.currentGameDate, dayOfWeek: nextDay, timeSlot: next };
      }
    } else {
      this.currentGameDate = { ...this.currentGameDate, timeSlot: next };
    }
  }

  /** Called once when the clock rolls into a new week. */
  private onWeekBoundary(): void {
    const newWeek = this.currentGameDate.week + 1;
    this.currentGameDate = { ...this.currentGameDate, week: newWeek };
    console.log(`📅 [advanceWeek] Week ${newWeek}, Season ${this.currentGameDate.season}`);

    // Annual veteran retirement (start of League Year)
    if (newWeek === 1) {
      this.processAnnualRetirements();
    }

    // UDFA "Dream is Over" purge (end of OTAs / pre-camp)
    if (newWeek === 20) {
      this.processUDFACleanup();
    }

    // Team rating snapshots at Preseason (25) and Trade Deadline (37)
    if (newWeek === 25 || newWeek === 37) {
      this.updateAllTeamRatings();
      console.log(`📊 Team ratings updated at week ${newWeek}`);
    }

    // Weekly cap-hit deduction from cash reserves (regular season only)
    if (newWeek >= 29 && newWeek <= 46 && this.userTeamId) {
      const weeklyExpense = this.getCapHit(this.userTeamId) / 18;
      const teamIdx = this.teams.findIndex(t => t.id === this.userTeamId);
      if (teamIdx !== -1) {
        this.teams[teamIdx].cashReserves = Math.max(0, this.teams[teamIdx].cashReserves - weeklyExpense);
      }
    }

    // End of regular season: persist the playoff bracket (fire-and-forget)
    if (newWeek === 46) {
      this.loadPlayoffBracket().then(existing => {
        if (existing) {
          this.savePlayoffBracket(existing);
          console.log('🏆 Playoff bracket persisted at regular season end');
        }
      }).catch(err => console.error('Failed to persist playoff bracket:', err));
      this.markEventCompleted(SeasonEvent.REGULAR_SEASON_END);
    }

    // Auto-save every week boundary via the registered callback
    this.onAutoSave?.();
  }

  /**
   * Optional callback registered by App.tsx to sync + save without creating
   * a circular import between GameStateManager and GameStore.
   */
  onAutoSave?: () => void;

  // MARK: - Market Value

  /** Calculate a player's market value using the existing formula from player.ts */
  calculateMarketValue(player: Player): number {
    return calculatePlayerMarketValue(player);
  }

  // MARK: - AI Decisions

  /**
   * Delegate AI team decisions to AITeamManager.
   * Builds the GameStateForAI adapter and calls simulateAITeamDecisions().
   */
  private simulateAIDecisions(): void {
    const adapter: GameStateForAI = {
      teams: this.teams,
      allPlayers: this.allPlayers,
      freeAgents: this.freeAgents,
      draftPicks: this.draftPicks.map(p => ({
        year: p.year,
        round: p.round,
        originalTeamId: p.originalTeamId,
        currentTeamId: p.currentTeamId,
      })),
      userTeamId: this.userTeamId ?? undefined,
      currentSeason: this.currentSeason,
      currentWeek: this.currentWeek,
      currentPhase: this.currentPhase.toString(),
      leagueTradeBlock: this.leagueTradeBlock,
      debugMode: this.debugMode,
      addHeadline: (h) => this.addHeadline(h.title, h.body, h.category as any, h.importance as any),
      addSocialPost: (_p) => { /* social posts handled separately */ },
    };
    const aiManager = new AITeamManager(adapter);
    aiManager.simulateAITeamDecisions();
  }

  // MARK: - Engine v2: Event-Driven Loop

  // ── State ──────────────────────────────────────────────────────────────────

  /** The week the current advance() run is targeting (inclusive). */
  private _engineTargetWeek: number = 0;

  /** Whether the engine loop is running (guards against re-entrant calls). */
  private _engineRunning: boolean = false;

  /** Current time slot within the engine's new loop. */
  private _engineSlot: EngineTimeSlot = EngineTimeSlot.EARLY_MORNING;

  /** Current day of week within the engine's loop. */
  private _engineDay: number = 1;

  /** Calendar events that have already fired this season (prevents double-firing). */
  private _engineProcessedEvents: Set<string> = new Set();

  /** New interrupt queue for the v2 engine. */
  engineInterruptQueue: Interrupt[] = [];

  /** The interrupt the UI should currently be displaying, or null. */
  engineActiveInterrupt: Interrupt | null = null;

  /** Short label describing what the engine is currently doing (for progress UI). */
  processingLabel: string = '';

  /**
   * Optional callback invoked every time the engine state changes.
   * App.tsx should set this to its `refresh()` function so the UI stays reactive.
   */
  onEngineStateChange?: () => void;

  // ── Public entry point ────────────────────────────────────────────────────

  /**
   * Advance the simulation.
   *
   *  - No argument  → advance exactly one week and stop.
   *  - With `targetPhase` → run at full speed until the week BEFORE that phase
   *    begins, then stop. Hard interrupts still fully block. Soft interrupts
   *    surface and auto-dismiss.
   *
   * Calling advance() while not IDLE is a silent no-op (concurrency guard).
   */
  async advance(targetPhase?: EnginePhase): Promise<void> {
    if (this.simulationState !== SimulationState.IDLE) return;

    // Check for action item blockers (roster, cap, etc.)
    if (this.actionItemQueue.length > 0) {
      console.warn('[Engine] Progression blocked by action items:', this.actionItemQueue);
      this.onEngineStateChange?.(); // Notify UI to show blockers
      return;
    }

    const currentWeek = this.currentGameDate.week;

    if (targetPhase) {
      // Run until the week BEFORE the phase begins
      this._engineTargetWeek = PHASE_WEEK_MAP[targetPhase].start - 1;
    } else {
      // Advance exactly one week
      this._engineTargetWeek = currentWeek;
    }

    this.simulationState = SimulationState.SIMULATING;
    this._engineRunning = true;
    this.onEngineStateChange?.();

    try {
      await this._advanceWeekLoop();
    } catch (error) {
      console.error('[Engine] Critical error in advance():', error);
      this.simulationState = SimulationState.CRITICAL_ERROR;
      this._engineRunning = false;
      this.onEngineStateChange?.();
      // Do not rethrow — let the UI surface the error state gracefully
    }
  }

  /** Stop a running simulation (user pause). */
  enginePause(): void {
    if (this.simulationState === SimulationState.SIMULATING) {
      this.simulationState = SimulationState.IDLE;
      this._engineRunning = false;
      this.onEngineStateChange?.();
    }
  }

  // ── Core loop ─────────────────────────────────────────────────────────────

  private async _advanceWeekLoop(): Promise<void> {
    // Sync the internal engine day/slot from currentGameDate on first entry
    this._engineDay  = this.currentGameDate.dayOfWeek;
    this._engineSlot = EngineTimeSlot.EARLY_MORNING;

    while (true) {
      // EXIT 1: Target reached — ran past the requested week boundary.
      if (this.currentGameDate.week > this._engineTargetWeek) {
        this.simulationState = SimulationState.IDLE;
        this._engineRunning = false;
        this.onEngineStateChange?.();
        break;
      }

      // EXIT 2: Hard interrupt — blocked until resolved.
      if (this.simulationState === SimulationState.PAUSED_FOR_INTERRUPT) {
        this._engineRunning = false;
        this.onEngineStateChange?.();
        break;
      }

      // EXIT 3: User pause — engine was set to IDLE externally.
      if (this.simulationState === SimulationState.IDLE) {
        this._engineRunning = false;
        this.onEngineStateChange?.();
        break;
      }

      await this._processWeekOrSkip();

      const interrupt = this._checkForEngineInterrupts();
      if (interrupt) {
        this._handleEngineInterrupt(interrupt);
        if (interrupt.kind === 'HARD') continue; // EXIT 2 fires on next iteration
      }

      // Non-blocking yield — keeps the browser paint loop alive
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
  }

  // ── Dead-zone batch skipper ───────────────────────────────────────────────

  private async _processWeekOrSkip(): Promise<void> {
    const week = this.currentGameDate.week;
    const isDead = week < 25 && !hasMajorEventThisWeek(week);

    if (isDead) {
      // Batch-skip: collapse the whole week into one computation unit
      this.processingLabel = `Week ${week} — ${PHASE_LABELS[getEnginePhaseForWeek(week)]}`;
      this._runOffseasonDevelopmentIfGated();
      this.simulateAIDecisionsBatched();
      this._generateWeeklyRecap();
      this._rollToNextWeek();

      // Single yield for the entire dead week
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    } else {
      // Live week: iterate through every time slot of every day
      await this._processLiveWeek();
    }
  }

  private async _processLiveWeek(): Promise<void> {
    const week = this.currentGameDate.week;
    const isGameWeek = week >= 29; // Regular season / playoffs

    for (this._engineDay = 1; this._engineDay <= 7; this._engineDay++) {
      const isGameDay = isGameWeek && this._engineDay === 7; // Sunday game day
      const slots = isGameDay ? GAME_DAY_SLOT_ORDER : TIME_SLOT_ORDER;

      for (const slot of slots) {
        this._engineSlot = slot;

        // Check exits before each slot
        if (this.simulationState !== SimulationState.SIMULATING) return;

        await this._processEngineTimeSlot(slot);
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      }
    }

    this._rollToNextWeek();
  }

  // ── Time slot router ──────────────────────────────────────────────────────

  private async _processEngineTimeSlot(slot: EngineTimeSlot): Promise<void> {
    const { week } = this.currentGameDate;
    const phase = getEnginePhaseForWeek(week);
    this.processingLabel = this._buildProcessingLabel(phase, slot);
    this.onEngineStateChange?.();

    switch (slot) {
      case EngineTimeSlot.EARLY_MORNING:
        // Injuries & practice reports (stub — injury module to be wired here)
        if (week === 4 && this._engineDay === 7) {
          // League Year expiration — will fire LEAGUE_YEAR_RESET interrupt via checkForInterrupts
        }
        break;

      case EngineTimeSlot.MID_MORNING:
        if (!this._isGameDay(this._engineDay) && week < 42) {
          // AI roster evaluation (batch: 8 teams)
          this._runOffseasonDevelopmentIfGated();
        }
        if (!this._isGameDay(this._engineDay) && week >= 29 && week <= 39) {
          this.evaluateTradeOpportunities();
        }
        break;

      case EngineTimeSlot.AFTERNOON:
        if (!this._isGameDay(this._engineDay) && week <= 42) {
          this.simulateAIDecisionsBatched();
        }
        break;

      case EngineTimeSlot.EVENING:
        // News & headlines
        break;

      case EngineTimeSlot.GAME_PREP:
        // Lock lineups
        break;

      case EngineTimeSlot.GAME_IN_PROGRESS:
        // Simulate game (stub — game module to be wired here)
        break;

      case EngineTimeSlot.GAME_COMPLETE:
        // Process stats & post-game injuries
        break;

      case EngineTimeSlot.RECAP:
        this.updateAllTeamRatings();
        this._generateWeeklyRecap();
        this.onAutoSave?.();
        break;
    }
  }

  // ── Clock utilities ───────────────────────────────────────────────────────

  private _rollToNextWeek(): void {
    const newWeek = this.currentGameDate.week + 1;
    this.currentGameDate = {
      ...this.currentGameDate,
      week: newWeek,
      dayOfWeek: 1,
      timeSlot: TimeSlots.earlyMorning,
    };
    this._engineDay = 1;
    this._engineSlot = EngineTimeSlot.EARLY_MORNING;

    if (newWeek === 25 || newWeek === 37) {
      this.updateAllTeamRatings();
    }

    // Weekly cap deduction (regular season)
    if (newWeek >= 29 && newWeek <= 46 && this.userTeamId) {
      const weeklyExpense = this.getCapHit(this.userTeamId) / 18;
      const idx = this.teams.findIndex(t => t.id === this.userTeamId);
      if (idx !== -1) {
        this.teams[idx].cashReserves = Math.max(0, this.teams[idx].cashReserves - weeklyExpense);
      }
    }
  }

  private _isGameDay(dayOfWeek: number): boolean {
    return dayOfWeek === 7; // Sunday
  }

  private _buildProcessingLabel(phase: EnginePhase, slot: EngineTimeSlot): string {
    const phaseLabel = PHASE_LABELS[phase];
    const slotLabel = slot.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    return `${phaseLabel} · ${slotLabel}`;
  }

  // ── Interrupt system ──────────────────────────────────────────────────────

  /**
   * Called after every processed time slot. Returns the highest-priority
   * interrupt found, or null. Checks are ordered critical → low.
   */
  _checkForEngineInterrupts(): Interrupt | null {
    const { week } = this.currentGameDate;

    // 1. Pending AI trade offers targeting the user's team
    const pendingTrade = this.receivedTradeOffers.find(o => o.status === 'pending');
    if (pendingTrade) {
      return this._buildEngineInterrupt(HardStopReason.TRADE_OFFER_RECEIVED, {
        reason: HardStopReason.TRADE_OFFER_RECEIVED,
        offerId: pendingTrade.id,
      }, 'Trade Offer Received', (() => { const t = this.teams.find(t => t.id === pendingTrade.offeringTeamId); return `${t ? `${t.city} ${t.name}` : 'A team'} wants to make a deal.`; })());
    }

    // 2. Roster out of compliance (53-man cutdown, IR, etc.)
    if (this.userTeamId && week >= 28) {
      const activeRoster = this.allPlayers.filter(p => p.teamId === this.userTeamId && p.status === PlayerStatus.ACTIVE);
      if (activeRoster.length > 53) {
        return this._buildEngineInterrupt(HardStopReason.ROSTER_CUTS_REQUIRED, {
          reason: HardStopReason.ROSTER_CUTS_REQUIRED,
          currentCount: activeRoster.length,
          targetCount: 53,
        }, 'Roster Cuts Required', `Your active roster has ${activeRoster.length} players. Cut to 53.`);
      }
    }

    // 3. Scheduled calendar hard stops (fires once per season per event)
    const calendarEvent = getScheduledEvent(week);
    if (calendarEvent?.triggerInterrupt && !this._engineProcessedEvents.has(calendarEvent.name)) {
      this._engineProcessedEvents.add(calendarEvent.name);
      const payload = this._buildCalendarPayload(calendarEvent.triggerInterrupt);
      if (payload) {
        return this._buildEngineInterrupt(
          calendarEvent.triggerInterrupt,
          payload,
          calendarEvent.name,
          `${calendarEvent.name} — action required.`,
        );
      }
    }

    return null;
  }

  private _buildCalendarPayload(reason: HardStopReason): import('./engine-types').InterruptPayload | null {
    switch (reason) {
      case HardStopReason.LEAGUE_YEAR_RESET:
        const expiring = this.allPlayers
          .filter(p => p.teamId === this.userTeamId && p.contract && p.contract.yearsRemaining === 0)
          .map(p => p.id);
        // Only interrupt if there are actually expiring contracts to manage
        return expiring.length > 0 ? { reason, expiringContracts: expiring } : null;
      case HardStopReason.FREE_AGENCY_OPEN:
        return { reason, topFreeAgents: [] };
      case HardStopReason.DRAFT_PICK_READY:
        return { reason, pickNumber: 1, round: 1, draftedBy: '' };
      case HardStopReason.ROSTER_CUTS_REQUIRED:
        return { reason, currentCount: 90, targetCount: 53 };
      default:
        return null;
    }
  }

  private _buildEngineInterrupt(
    reason: HardStopReason | SoftStopReason,
    payload: import('./engine-types').InterruptPayload,
    title: string,
    description: string,
    kind: 'HARD' | 'SOFT' = 'HARD',
  ): Interrupt {
    return {
      id: uuidv4(),
      kind,
      reason,
      priority: kind === 'HARD' ? 'HIGH' : 'LOW',
      title,
      description,
      timestamp: makeEngineDate(
        this.currentGameDate.season,
        this.currentGameDate.week,
        this._engineDay,
        this._engineSlot,
      ),
      payload,
    };
  }

  private _handleEngineInterrupt(interrupt: Interrupt): void {
    if (interrupt.kind === 'HARD') {
      this.engineInterruptQueue.push(interrupt);
      this.engineActiveInterrupt = interrupt;
      this.simulationState = SimulationState.PAUSED_FOR_INTERRUPT;
      this.onEngineStateChange?.();
    } else {
      // Soft stop: surface to UI, auto-dismiss, engine keeps running
      this.engineInterruptQueue.push(interrupt);
      this.engineActiveInterrupt = interrupt;
      this.onEngineStateChange?.();
      setTimeout(() => {
        this._dismissSoftInterrupt(interrupt.id);
      }, interrupt.autoDismissMs ?? 2000);
    }
  }

  private _dismissSoftInterrupt(id: string): void {
    if (this.engineActiveInterrupt?.id === id) {
      this.engineActiveInterrupt = null;
    }
    this.engineInterruptQueue = this.engineInterruptQueue.filter(i => i.id !== id);
    this.onEngineStateChange?.();
  }

  /**
   * Called by the UI when the user completes their decision on a hard stop.
   * Applies the resolution to game state and returns the engine to IDLE.
   * The UI is then responsible for calling advance() again if it wants to resume.
   */
  resolveEngineInterrupt(resolution: InterruptResolution): void {
    switch (resolution.reason) {
      case HardStopReason.TRADE_OFFER_RECEIVED: {
        const offerId = (this.engineActiveInterrupt?.payload as any)?.offerId as string | undefined;
        const offer   = offerId ? this.receivedTradeOffers.find(o => o.id === offerId) : undefined;

        if (resolution.navigate) {
          // User chose "Negotiate" — dismiss interrupt, leave pendingAITradeOffer set
          // so TradeScreen can read it on mount. App.tsx handles the navigation.
          if (offer) offer.status = 'rejected';
        } else if (resolution.accepted && this.pendingAITradeOffer) {
          if (offer) offer.status = 'accepted';
          this.executeTrade(this.pendingAITradeOffer);
          this.pendingAITradeOffer = null;
        } else {
          if (offer) offer.status = 'rejected';
          this.pendingAITradeOffer = null;
        }
        break;
      }

      case HardStopReason.ROSTER_CUTS_REQUIRED:
        for (const id of resolution.releasedPlayerIds) {
          const idx = this.allPlayers.findIndex(p => p.id === id);
          if (idx !== -1) {
            this.allPlayers[idx].teamId = undefined;
            this.allPlayers[idx].status = PlayerStatus.FREE_AGENT;
          }
        }
        break;

      case HardStopReason.DRAFT_PICK_READY:
        // Draft manager will handle player selection — stub for now
        console.log(`[Engine] Draft pick resolved: ${resolution.selectedPlayerId}`);
        break;

      case HardStopReason.LEAGUE_YEAR_RESET:
      case HardStopReason.FREE_AGENCY_OPEN:
        if (resolution.reason === HardStopReason.LEAGUE_YEAR_RESET && this.userTeamId) {
          // Auto-release any players on user team who still have 0 years remaining
          const expiring = this.allPlayers.filter(p =>
            p.teamId === this.userTeamId &&
            p.contract &&
            p.contract.yearsRemaining === 0
          );
          for (const p of expiring) {
            p.teamId = undefined;
            p.status = PlayerStatus.FREE_AGENT;
          }
          if (expiring.length > 0) console.log(`[League Year] Released ${expiring.length} expiring players.`);
        }
        break;
      case HardStopReason.STARTER_INJURED:
        // Acknowledgement-only; no state change needed
        break;

      case HardStopReason.CONTRACT_EXTENSION_EXPIRING:
        if (resolution.released) {
          const payload = this.engineActiveInterrupt?.payload as any;
          if (payload?.playerId) {
            const idx = this.allPlayers.findIndex(p => p.id === payload.playerId);
            if (idx !== -1) {
              this.allPlayers[idx].teamId = undefined;
              this.allPlayers[idx].status = PlayerStatus.FREE_AGENT;
            }
          }
        }
        break;
    }

    // Remove the resolved interrupt
    if (this.engineActiveInterrupt) {
      this.engineInterruptQueue = this.engineInterruptQueue.filter(
        i => i.id !== this.engineActiveInterrupt?.id,
      );
      this.engineActiveInterrupt = null;
    }

    // If more hard interrupts are queued, surface the next one
    const next = this.engineInterruptQueue.find(i => i.kind === 'HARD');
    if (next) {
      this.engineActiveInterrupt = next;
      this.onEngineStateChange?.();
      return; // Stay PAUSED_FOR_INTERRUPT
    }

    // Queue is clear — return to IDLE. The UI decides whether to call advance() again.
    this.simulationState = SimulationState.IDLE;
    this.onEngineStateChange?.();
  }

  // ── Snapshot / persistence ────────────────────────────────────────────────

  serializeEngineSnapshot(): EngineSnapshot {
    return {
      version: 1,
      currentGameDate: makeEngineDate(
        this.currentGameDate.season,
        this.currentGameDate.week,
        this.currentGameDate.dayOfWeek,
        this._engineSlot,
      ),
      simulationState: EngineSimulationState.IDLE, // always serialize as IDLE
      interruptQueue: this.engineInterruptQueue,
      actionItemQueue: this.actionItemQueue,
      processedEvents: Array.from(this._engineProcessedEvents),
      targetWeek: this._engineTargetWeek,
    };
  }

  loadEngineSnapshot(snapshot: EngineSnapshot): void {
    this.currentGameDate = {
      ...this.currentGameDate,
      season: snapshot.currentGameDate.season,
      week: snapshot.currentGameDate.week,
      dayOfWeek: snapshot.currentGameDate.dayOfWeek,
    };
    this._engineSlot = snapshot.currentGameDate.timeSlot;
    this.engineInterruptQueue = snapshot.interruptQueue;
    this.actionItemQueue = snapshot.actionItemQueue ?? [];
    this._engineProcessedEvents = new Set(snapshot.processedEvents);
    this._engineTargetWeek = snapshot.targetWeek;
    this.simulationState = SimulationState.IDLE;
  }

  /**
   * Validates roster constraints and populates actionItemQueue.
   * Called after every roster mutation and before each advance.
   * Prevents Week 4 hard stop by making blockers visible in UI.
   */
  validateRosterConstraints(): void {
    const userTeam = this.userTeam;
    if (!userTeam) return;

    this.actionItemQueue = []; // Clear and rebuild

    const rosterPlayers = this.allPlayers.filter(p => p.teamId === userTeam.id);
    const rosterCount = rosterPlayers.length;

    // Create a proper timestamp for action items
    const timestamp = makeEngineDate(
      this.currentGameDate.season,
      this.currentGameDate.week,
      this.currentGameDate.dayOfWeek,
      this._engineSlot,
    );

    // Check 1: Roster size (max 54 in preseason/regular season)
    if (this.currentGameDate.week >= 25 && rosterCount > 54) {
      this.actionItemQueue.push({
        id: uuidv4(),
        type: ActionItemType.ROSTER_OVER_LIMIT,
        teamId: userTeam.id,
        description: `Roster has ${rosterCount} players; max 54 required. Cut ${rosterCount - 54} player(s) to proceed.`,
        resolution: {
          route: '/roster',
          actionLabel: 'Go to Roster',
        },
        timestamp,
      });
    }

    // Check 2: Salary cap exceeded
    if (userTeam.capSpace < 0) {
      this.actionItemQueue.push({
        id: uuidv4(),
        type: ActionItemType.CAP_EXCEEDED,
        teamId: userTeam.id,
        description: `Team salary exceeds cap by $${Math.abs(userTeam.capSpace).toLocaleString()}. Cut or trade players to get under cap.`,
        resolution: {
          route: '/finances',
          actionLabel: 'View Finances',
        },
        timestamp,
      });
    }

    // Check 3: Invalid lineup (placeholder for future depth chart validation)
    // This would check for missing required positions once depth chart system is added
  }

  // MARK: - Roster Management (Release, Restructure, Extend)

  /**
   * Release a player to free agency.
   * Removes team attachment and sets status to FREE_AGENT.
   */
  releasePlayer(playerId: string): void {
    const player = this.allPlayers.find(p => p.id === playerId);
    if (!player) return;

    const teamId = player.teamId;

    // In a full implementation, we would calculate and accelerate dead cap here.
    // For now, we ensure they are detached from the franchise.
    player.teamId = undefined;
    player.status = PlayerStatus.FREE_AGENT;

    if (teamId) {
      console.log(`✂️ [Roster] Released ${player.firstName} ${player.lastName} from ${teamId}`);
      this.validateRosterConstraints();
      this.onEngineStateChange?.();
      this.onAutoSave?.();
    }
  }

  /**
   * Restructure a player's contract to create immediate cap space.
   * Converts base salary to signing bonus.
   */
  restructureContract(playerId: string, conversionPercent: number): RestructureResult {
    const player = this.allPlayers.find(p => p.id === playerId);
    if (!player || !player.teamId) {
      return { success: false, reason: 'Player not found or not on a team', capSavings: 0, newDeadCap: 0, newCurrentYearCap: 0 };
    }

    const team = this.teams.find(t => t.id === player.teamId);
    if (!team) {
      return { success: false, reason: 'Team not found', capSavings: 0, newDeadCap: 0, newCurrentYearCap: 0 };
    }

    const result = this.financeSystem.executeRestructure(player, team, conversionPercent);

    if (result.success) {
      this.addNotification(
        'Contract Restructured',
        `Restructured ${player.firstName} ${player.lastName} to save $${(result.capSavings / 1_000_000).toFixed(2)}M in cap space.`,
        NotificationType.FINANCIAL,
        NotificationPriority.LOW,
        [player.id]
      );
      this.validateRosterConstraints();
      this.onEngineStateChange?.();
      this.onAutoSave?.();
    }

    return result;
  }

  /**
   * Start extension negotiations for a player.
   * Initializes the agent personality system and returns the negotiation state.
   */
  startExtensionNegotiation(playerId: string): PlayerNegotiationState | null {
    const player = this.allPlayers.find(p => p.id === playerId);
    if (!player || !player.teamId) return null;

    const team = this.teams.find(t => t.id === player.teamId);
    if (!team) return null;

    const capSpace = this.getCapSpace(team.id);
    const positionDepth = this.allPlayers.filter(p => p.teamId === team.id && p.position === player.position).length;
    const isContender = this.tradeSystem.determineFranchiseTier(team, this.currentWeek) === FranchiseTier.CONTENDER;

    const state = this.agentPersonalitySystem.beginPlayerNegotiation(player, capSpace, positionDepth, isContender);
    console.log(`🤝 [Negotiation] Started extension talks with ${player.firstName} ${player.lastName}`);
    return state;
  }

  /**
   * Apply the franchise tag to a player.
   * Updates contract to 1-year fully guaranteed deal based on position/overall.
   */
  applyFranchiseTag(player: Player): void {
    // Calculation matching UI modal in Overlays.tsx
    const tagValue = Math.round(player.overall * 300_000 * (player.position === Position.QB ? 1.5 : 1));

    player.contract = {
      totalValue: tagValue,
      yearsRemaining: 1,
      guaranteedMoney: tagValue,
      currentYearCap: tagValue,
      signingBonus: 0,
      incentives: 0,
      canRestructure: false,
      canCut: false, // Franchise tags are fully guaranteed
      deadCap: tagValue,
      hasNoTradeClause: false,
      approvedTradeDestinations: [],
    };

    // Ensure player stays on team and is active
    player.status = PlayerStatus.ACTIVE;

    this.addNotification(
      'Franchise Tag Applied',
      `${player.firstName} ${player.lastName} has been designated with the Franchise Tag ($${(tagValue / 1_000_000).toFixed(1)}M).`,
      NotificationType.CONTRACT,
      NotificationPriority.HIGH,
      [player.id]
    );

    console.log(`✅ [Contract] Applied Franchise Tag to ${player.firstName} ${player.lastName}`);
    this.validateRosterConstraints();
    this.onEngineStateChange?.();
    this.onAutoSave?.();
  }

  // MARK: - RFA Tendering

  /**
   * Get list of Restricted Free Agent candidates (3 accrued seasons, expiring contract).
   */
  getRFACandidates(): Player[] {
    if (!this.userTeamId) return [];
    return this.allPlayers.filter(p => 
      p.teamId === this.userTeamId &&
      p.contract &&
      p.contract.yearsRemaining === 0 &&
      p.accruedSeasons === 3
    );
  }

  /**
   * Apply a tender to a Restricted Free Agent.
   */
  applyRFATender(playerId: string, type: RFATenderType): void {
    const player = this.allPlayers.find(p => p.id === playerId);
    if (!player) return;

    if (type === RFATenderType.FRANCHISE) {
      this.applyFranchiseTag(player);
      return;
    }

    let amount = 0;
    let guaranteed = false;

    switch (type) {
      case RFATenderType.ROFR:
        amount = 2_700_000;
        break;
      case RFATenderType.ORIGINAL_ROUND:
        amount = 3_100_000;
        break;
      case RFATenderType.TRANSITION:
        amount = Math.round(calculateFranchiseTagValue(player.position, this.allPlayers) * 0.85);
        guaranteed = true;
        break;
    }

    // Apply 1-year tender contract
    player.contract = {
      totalValue: amount,
      yearsRemaining: 1,
      guaranteedMoney: guaranteed ? amount : 0,
      currentYearCap: amount,
      signingBonus: 0,
      incentives: 0,
      canRestructure: false,
      canCut: !guaranteed,
      deadCap: guaranteed ? amount : 0,
      hasNoTradeClause: false,
      approvedTradeDestinations: [],
    };
    
    player.status = PlayerStatus.ACTIVE;
    
    // Deduct tender amount from team cap space immediately
    const team = this.teams.find(t => t.id === player.teamId);
    if (team) {
      team.capSpace -= amount;
    }

    this.addNotification(
      'RFA Tender Applied',
      `Applied ${type} to ${player.firstName} ${player.lastName} ($${(amount/1_000_000).toFixed(2)}M)`,
      NotificationType.CONTRACT,
      NotificationPriority.MEDIUM,
      [player.id]
    );
    
    this.validateRosterConstraints();
    this.onEngineStateChange?.();
    this.onAutoSave?.();
  }

  /**
   * Commit a free agent signing from contract negotiation.
   * Finalizes player contract, updates rosters, records transaction, and triggers constraint validation.
   */
  commitPlayerSigning(
    playerId: string,
    offer: any, // ContractOffer type from ContractSystem.ts
    userTeamId: string
  ): void {
    const playerIdx = this.allPlayers.findIndex(p => p.id === playerId);
    if (playerIdx === -1) return;

    const player = this.allPlayers[playerIdx];
    const { week } = this.currentGameDate;

    // Calculate prorated cap hit if mid-season
    let currentYearCap = offer.baseSalaryPerYear[0] ?? offer.baseSalaryPerYear.reduce((a: number, b: number) => a + b, 0) / offer.years;
    if (week >= 29 && week <= 46) {
      const weeksRemaining = 46 - week + 1;
      const weeksInRegularSeason = 18;
      currentYearCap = Math.round((weeksRemaining / weeksInRegularSeason) * currentYearCap);
    }

    // Build player contract from offer
    player.contract = {
      totalValue: offer.baseSalaryPerYear.reduce((a: number, b: number) => a + b, 0) + offer.signingBonus,
      yearsRemaining: offer.years,
      guaranteedMoney: offer.guaranteedMoney,
      currentYearCap,
      signingBonus: offer.signingBonus,
      incentives: (offer.ltbeIncentives || []).reduce((sum: number, i: any) => sum + i.value, 0),
      canRestructure: false,
      canCut: true,
      deadCap: 0,
      hasNoTradeClause: false,
      approvedTradeDestinations: [],
    };

    // Update player status
    player.teamId = userTeamId;
    player.status = PlayerStatus.ACTIVE;

    // Record for compensatory pick tracking
    const apy = offer.baseSalaryPerYear[0] ?? 0;
    this.recordFreeAgentSigning(playerId, player.teamId ?? null, userTeamId, apy);

    // Remove from free agents
    this.freeAgents = this.freeAgents.filter(p => p.id !== playerId);

    // Validate constraints
    this.validateRosterConstraints();

    // Trigger UI refresh
    this.onEngineStateChange?.();
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _runOffseasonDevelopmentIfGated(): void {
    const { week } = this.currentGameDate;
    if (week >= 16 && week <= 20 && this.developmentState.lastProcessedWeek !== week) {
      this.processOffseasonDevelopmentPublic();
    }
  }

  private simulateAIDecisionsBatched(): void {
    // Lightweight version for dead-zone weeks — same adapter, fewer decisions
    const adapter: GameStateForAI = {
      teams: this.teams,
      allPlayers: this.allPlayers,
      freeAgents: this.freeAgents,
      draftPicks: this.draftPicks.map(p => ({
        year: p.year, round: p.round,
        originalTeamId: p.originalTeamId, currentTeamId: p.currentTeamId,
      })),
      userTeamId: this.userTeamId ?? undefined,
      currentSeason: this.currentSeason,
      currentWeek: this.currentWeek,
      currentPhase: this.currentPhase.toString(),
      leagueTradeBlock: this.leagueTradeBlock,
      debugMode: this.debugMode,
      addHeadline: h => this.addHeadline(h.title, h.body, h.category as any, h.importance as any),
      addSocialPost: _p => {},
    };
    new AITeamManager(adapter).simulateAITeamDecisions();
  }

  private _generateWeeklyRecap(): void {
    const phase = getEnginePhaseForWeek(this.currentGameDate.week);
    this.addHeadline(
      `Week ${this.currentGameDate.week} Recap`,
      `${PHASE_LABELS[phase]} — another week in the books.`,
      'standings' as any,
      'low' as any,
    );
  }

  // MARK: - Offseason Development

  /**
   * Process player development for offseason weeks (16–20).
   * Gated to Day 2 Early Morning inside advanceWeekAsync.
   */
  private processOffseasonDevelopment(): void {
    const currentWeek = this.currentGameDate.week;
    const lastProcessed = this.developmentState.lastProcessedWeek;
    if (lastProcessed === currentWeek) return; // prevent double-processing

    console.log(`🏋️ [OffseasonDev] Processing development — Week ${currentWeek}`);
    let developedCount = 0;

    for (const player of this.allPlayers) {
      if (!player.teamId) continue; // skip free agents
      const ageFactor = player.age < 25 ? 1.5 : player.age < 30 ? 1.0 : 0.5;
      const gap = player.potential - player.overall;
      if (gap <= 0) continue;

      const gain = Math.random() < 0.3 * ageFactor ? 1 : 0;
      if (gain > 0) {
        player.overall = Math.min(player.potential, player.overall + gain);
        developedCount++;
      }
    }

    this.developmentState.lastProcessedWeek = currentWeek;
    this.developmentState.lastProcessedSlot = this.currentGameDate.timeSlot.rawValue;
    console.log(`✅ [OffseasonDev] ${developedCount} players improved`);
  }

  /** Public wrapper used by the new engine's _runOffseasonDevelopmentIfGated(). */
  processOffseasonDevelopmentPublic(): void {
    this.processOffseasonDevelopment();
  }

/** Convenience: current engine phase label for UI display. */
get enginePhaseLabel(): string {
  return PHASE_LABELS[getEnginePhaseForWeek(this.currentGameDate.week)];
}

  // MARK: - Roster Churn Hooks

  /**
   * Annual retirement sweep — fires at Week 1 (start of League Year).
   * Removes aging/declining veterans from the player universe to prevent bloat.
   * If a star (OVR >= 85) on the user's team retires, fires a HARD STOP interrupt.
   */
  private processAnnualRetirements(): void {
    console.log('[Roster Churn] Executing Week 1 annual retirement sweep...');
    const retiringIds = new Set<string>();

    for (const player of this.allPlayers) {
      const isFA = !player.teamId || player.status === PlayerStatus.FREE_AGENT;

      // Unconditional retirement for extreme age
      if (player.age >= 40) {
        retiringIds.add(player.id);
        continue;
      }

      // Free agent probabilistic retirement
      if (isFA) {
        let chance = 0;
        if (player.age >= 38) chance = 0.65;
        else if (player.age >= 36) chance = 0.35;
        else if (player.age >= 34) chance = 0.15;

        if (player.overall < 65) chance += 0.10;
        if (player.overall < 60) chance += 0.10;

        if (chance > 0 && Math.random() < chance) {
          retiringIds.add(player.id);
          continue;
        }
      }

      // Signed veteran voluntary retirement
      if (!isFA && player.age >= 38 && player.overall < 73 && Math.random() < 0.20) {
        retiringIds.add(player.id);
      }
    }

    if (retiringIds.size === 0) return;

    // Check for user-team star retirements before removing
    for (const id of retiringIds) {
      const player = this.allPlayers.find(p => p.id === id);
      if (player && player.teamId === this.userTeamId && player.overall >= 85) {
        this._handleEngineInterrupt(
          this._buildEngineInterrupt(
            HardStopReason.LEAGUE_YEAR_RESET,
            { reason: HardStopReason.LEAGUE_YEAR_RESET } as any,
            `${player.firstName} ${player.lastName} Has Retired`,
            `Your franchise cornerstone has announced retirement. Re-evaluate your offseason strategy.`,
          )
        );
      }
    }

    this.allPlayers = this.allPlayers.filter(p => !retiringIds.has(p.id));
    this.freeAgents  = this.freeAgents.filter(p => !retiringIds.has(p.id));
    // Release from team rosters if teams track player IDs directly
    for (const team of this.teams) {
      if ((team as any).roster) {
        (team as any).roster = (team as any).roster.filter((id: string) => !retiringIds.has(id));
      }
    }

    console.log(`[Roster Churn] ${retiringIds.size} veterans announced retirement.`);
    this.addHeadline(
      'Offseason Retirements',
      `${retiringIds.size} veterans have announced retirement ahead of the new league year.`,
      NewsCategory.RUMORS,
      NewsImportance.LOW,
    );
  }

  // MARK: - Scouting

  /**
   * Spend scouting points to narrow (or fully reveal) a prospect's true OVR.
   * Returns false if insufficient points or prospect not found.
   *
   * Tier system:
   *   0 pts spent → full fog (wide range shown)
   *   1 pt spent  → range halved around midpoint (shown in accent color)
   *   2+ pts spent → true OVR fully revealed (RatingBadge shown)
   */
  public spendScoutingPoints(prospectId: string, points: number): boolean {
    if (this.scoutingPointsAvailable < points) return false;
    const p = this.draftProspects.find(d => d.id === prospectId);
    if (!p) return false;

    this.scoutingPointsAvailable -= points;
    p.scoutingPointsSpent += points;

    if (p.scoutingPointsSpent === 1) {
      const mid = Math.round((p.scoutingRange.min + p.scoutingRange.max) / 2);
      const halfWidth = Math.max(1, Math.round((p.scoutingRange.max - p.scoutingRange.min) / 4));
      p.scoutingRange = {
        min: Math.max(40, mid - halfWidth),
        max: Math.min(99, mid + halfWidth),
      };
    } else if (p.scoutingPointsSpent >= 2) {
      // Fully revealed — collapse range to the true OVR
      p.scoutingRange = { min: p.trueOverall, max: p.trueOverall };
      // Optional: Reveal true overall in UI object if you want to allow it now
      p.overall = p.trueOverall;
      p.potential = p.truePotential;
    }
    return true;
  }

  /** Toggle a player's shopping status (On Block <-> Off Block). */
  public togglePlayerShoppingStatus(playerId: string): void {
    const player = this.allPlayers.find(p => p.id === playerId);
    if (!player) return;

    const isOnBlock = player.shoppingStatus === 'On The Block';
    player.shoppingStatus = isOnBlock ? 'Off Block' : 'On The Block';
    console.log(`🏷️ [Trade] ${player.firstName} ${player.lastName} is now ${player.shoppingStatus}`);
  }

  // MARK: - Trade Negotiation

  /** Fibonacci penalty table indexed by rejection count. 2.5 triggers lockout. */
  private _getFibPenalty(attempts: number): number {
    const FIB = [1.0, 1.05, 1.08, 1.13, 1.21, 2.5];
    return FIB[Math.min(attempts, FIB.length - 1)];
  }

  /** Shared pick ID parser. Compound key: "${year}-${round}-${originalTeamId}" */
  private _findPickById(pickId: string): TeamDraftPick | undefined {
    const parts = pickId.split('-');
    const orig = parts.slice(2).join('-'); // handle team IDs with hyphens
    const y = parseInt(parts[0], 10);
    const r = parseInt(parts[1], 10);
    return this.draftPicks.find(
      dp => dp.year === y && dp.round === r && dp.originalTeamId === orig
    );
  }

  /**
   * Validate and evaluate a trade offer. Does NOT mutate state.
   * TradeScreen calls proposeTrade() first; if accepted, calls executeTrade().
   */
  public proposeTrade(payload: TradeOfferPayloadUI): TradeEvaluation {
    const week = this.currentGameDate.week;

    // 1. Deadline gate
    if (week > 39) {
      return { accepted: false, reason: 'The trade deadline has passed.', fairnessScore: 0, errorState: 'DEADLINE_PASSED' };
    }

    // 2. Asset ownership validation
    for (const id of payload.offeringPlayerIds) {
      const p = this.allPlayers.find(pl => pl.id === id);
      if (!p || p.teamId !== payload.offeringTeamId) {
        return { accepted: false, reason: 'One or more assets are no longer owned by your team.', fairnessScore: 0, errorState: 'ASSET_INVALID' };
      }
    }

    const partnerTeam = this.teams.find(t => t.id === payload.receivingTeamId);
    if (!partnerTeam) {
      return { accepted: false, reason: 'Trade partner team not found.', fairnessScore: 0, errorState: 'ASSET_INVALID' };
    }
    const offeringTeam = this.teams.find(t => t.id === payload.offeringTeamId);
    if (!offeringTeam) {
      return { accepted: false, reason: 'Offering team not found.', fairnessScore: 0, errorState: 'ASSET_INVALID' };
    }

    // 3. Resolve IDs → live references
    const offeringPlayers  = payload.offeringPlayerIds.map(id => this.allPlayers.find(p => p.id === id)).filter(Boolean) as Player[];
    const receivingPlayers = payload.receivingPlayerIds.map(id => this.allPlayers.find(p => p.id === id)).filter(Boolean) as Player[];
    const offeringPicks    = payload.offeringPickIds.map(id => this._findPickById(id)).filter(Boolean) as TeamDraftPick[];
    const receivingPicks   = payload.receivingPickIds.map(id => this._findPickById(id)).filter(Boolean) as TeamDraftPick[];

    // 4. Negotiation fatigue multiplier
    const attempts   = this._negotiationAttempts.get(payload.receivingTeamId) ?? 0;
    const multiplier = this._getFibPenalty(attempts);

    const partnerRoster = this.allPlayers.filter(p => p.teamId === partnerTeam.id);

    // 5. Get live cap space and evaluate
    const offeringTeamCapSpace = this.getCapSpace(offeringTeam.id);
    const receivingTeamCapSpace = this.getCapSpace(partnerTeam.id);
    const result = this.tradeSystem.evaluateTradeOffer(
      payload, offeringPlayers, receivingPlayers, offeringPicks, receivingPicks,
      partnerTeam, partnerRoster, week, offeringTeam, offeringTeamCapSpace, receivingTeamCapSpace, multiplier
    );

    // 6. Track negotiation attempts
    if (!result.accepted && !result.errorState) {
      this._negotiationAttempts.set(payload.receivingTeamId, attempts + 1);
    } else if (result.accepted) {
      this._negotiationAttempts.delete(payload.receivingTeamId);
    }

    // 7. Generate counter-offer if "close" (fairness >= 0.85, not a hard error)
    if (
      !result.accepted &&
      result.fairnessScore >= 0.85 &&
      !result.errorState &&
      result.perceivedValues
    ) {
      const { userValue, aiValue } = result.perceivedValues;
      const deficit = aiValue * 1.05 * multiplier - userValue;
      if (deficit > 0) {
        const offeringPickIdSet = new Set(payload.offeringPickIds);
        const offeringPlayerIdSet = new Set(payload.offeringPlayerIds);
        const availablePicks = this.draftPicks.filter(p =>
          p.currentTeamId === payload.offeringTeamId &&
          !offeringPickIdSet.has(`${p.year}-${p.round}-${p.originalTeamId}`)
        );
        const availablePlayers = this.allPlayers.filter(p =>
          p.teamId === payload.offeringTeamId &&
          p.overall <= 80 &&
          !offeringPlayerIdSet.has(p.id)
        );
        result.counterOffer = this.tradeSystem.generateCounterOffer(
          payload, availablePicks, availablePlayers, deficit
        );
      }
    }

    return result;
  }

  /**
   * Atomically execute a trade. Mutates allPlayers and draftPicks.
   * Rolls back to snapshot on any error to prevent half-state corruption.
   */
  public executeTrade(payload: TradeOfferPayloadUI): void {
    const playerSnapshot = this.allPlayers.map(p => ({ ...p }));
    const pickSnapshot   = this.draftPicks.map(p => ({ ...p }));

    try {
      const playerMap = new Map(this.allPlayers.map(p => [p.id, p]));
      const pickMap   = new Map(this.draftPicks.map(p => [`${p.year}-${p.round}-${p.originalTeamId}`, p]));

      // Snapshot assets for history log before mutation
      const team1Assets: string[] = [];
      const team2Assets: string[] = [];

      // Team 1 (Offering) Assets
      for (const id of payload.offeringPlayerIds) {
        const p = playerMap.get(id);
        if (p) team1Assets.push(`${p.position} ${p.firstName} ${p.lastName} (${p.overall})`);
      }
      for (const id of payload.offeringPickIds) {
        const pick = pickMap.get(id);
        if (pick) team1Assets.push(`${pick.year} Rd ${pick.round} (${pick.originalTeamId})`);
      }

      // Team 2 (Receiving) Assets
      for (const id of payload.receivingPlayerIds) {
        const p = playerMap.get(id);
        if (p) team2Assets.push(`${p.position} ${p.firstName} ${p.lastName} (${p.overall})`);
      }
      for (const id of payload.receivingPickIds) {
        const pick = pickMap.get(id);
        if (pick) team2Assets.push(`${pick.year} Rd ${pick.round} (${pick.originalTeamId})`);
      }

      this.completedTrades.unshift({
        id: uuidv4(),
        season: this.currentGameDate.season,
        week: this.currentGameDate.week,
        team1Id: payload.offeringTeamId,
        team2Id: payload.receivingTeamId,
        team1Assets,
        team2Assets,
      });

      for (const id of payload.offeringPlayerIds) {
        const p = playerMap.get(id);
        if (p) p.teamId = payload.receivingTeamId;
      }
      for (const id of payload.receivingPlayerIds) {
        const p = playerMap.get(id);
        if (p) p.teamId = payload.offeringTeamId;
      }
      for (const pickId of payload.offeringPickIds) {
        const pick = pickMap.get(pickId);
        if (pick) pick.currentTeamId = payload.receivingTeamId;
      }
      for (const pickId of payload.receivingPickIds) {
        const pick = pickMap.get(pickId);
        if (pick) pick.currentTeamId = payload.offeringTeamId;
      }

      this._applyPostTradeMorale(payload, playerMap);

      // Narrative: headline for the highest-OVR moved player
      const allMovedPlayers = [
        ...payload.offeringPlayerIds,
        ...payload.receivingPlayerIds,
      ].map(id => playerMap.get(id)).filter(Boolean) as Player[];

      if (allMovedPlayers.length > 0) {
        const star = allMovedPlayers.sort((a, b) => b.overall - a.overall)[0];
        const dest = this.teams.find(t => t.id === payload.receivingTeamId);
        this.addHeadline(
          'Trade Alert',
          `Blockbuster! ${star.firstName} ${star.lastName} heading to ${dest?.abbreviation ?? '???'} in a major mid-season deal.`,
          NewsCategory.TRADE,
          NewsImportance.HIGH,
        );
      }

      this.updateAllTeamRatings();
      this.onEngineStateChange?.();
      this.onAutoSave?.();
    } catch (error) {
      console.error('[TradeSystem] executeTrade failed — rolling back state.', error);
      playerSnapshot.forEach(snap => {
        const live = this.allPlayers.find(p => p.id === snap.id);
        if (live) Object.assign(live, snap);
      });
      pickSnapshot.forEach(snap => {
        const live = this.draftPicks.find(
          p => p.year === snap.year && p.round === snap.round && p.originalTeamId === snap.originalTeamId
        );
        if (live) Object.assign(live, snap);
      });
      throw error;
    }
  }

  /** Apply Homesick / Ring Chaser morale effects to all moved players. */
  private _applyPostTradeMorale(payload: TradeOfferPayloadUI, playerMap: Map<string, Player>): void {
    const allMovedIds = [...payload.offeringPlayerIds, ...payload.receivingPlayerIds];
    for (const id of allMovedIds) {
      const player = playerMap.get(id);
      if (!player) continue;

      const destTeamId = payload.receivingPlayerIds.includes(id)
        ? payload.offeringTeamId
        : payload.receivingTeamId;
      const destTeam = this.teams.find(t => t.id === destTeamId);
      if (!destTeam) continue;

      // Homesick: veteran with 4+ accrued seasons suffers morale hit
      if (player.accruedSeasons >= 4) {
        player.morale = Math.max(0, player.morale - 15);
      }

      // Ring Chaser: destination team's tier affects morale
      const tier = this.tradeSystem.determineFranchiseTier(destTeam, this.currentGameDate.week);
      if (tier === FranchiseTier.CONTENDER) {
        player.morale = Math.min(100, player.morale + 20);
      } else if (tier === FranchiseTier.REBUILDER) {
        player.morale = Math.max(0, player.morale - 25);
      }
    }
  }

  // MARK: - AI Trade Initiative

  /**
   * Scan for trades that benefit CONTENDER teams. Runs during MID_MORNING on
   * non-game days during the regular season (weeks 29–39).
   * If the target player is on the user's team, fires a HARD STOP interrupt.
   * For AI-to-AI trades, auto-executes if evaluation accepts.
   */
  public evaluateTradeOpportunities(): void {
    const week = this.currentGameDate.week;
    if (week < 29 || week > 39) return;

    for (const team of this.teams) {
      if (team.id === this.userTeamId) continue;

      const tier = this.tradeSystem.determineFranchiseTier(team, week);
      if (tier !== FranchiseTier.CONTENDER) continue;

      // Guard: don't spam offers from the same team
      if (this.receivedTradeOffers.some(o => o.offeringTeamId === team.id && o.status === 'pending')) continue;

      const need = this._findTeamNeed(team);
      if (!need) continue;

      const targetPlayer = this._findTradeTarget(need, team.id);
      if (!targetPlayer || !targetPlayer.teamId) continue;

      const receivingTeam = this.teams.find(t => t.id === targetPlayer.teamId);
      if (!receivingTeam) continue;

      const { players: offerPlayers, picks: offerPicks } = this._buildTradePackage(targetPlayer, team, receivingTeam);
      if (offerPlayers.length === 0 && offerPicks.length === 0) continue;

      const pickIds   = offerPicks.map(p => `${p.year}-${p.round}-${p.originalTeamId}`);
      const playerIds = offerPlayers.map(p => p.id);

      const uiPayload: TradeOfferPayloadUI = {
        offeringTeamId:    team.id,
        receivingTeamId:   targetPlayer.teamId,
        offeringPlayerIds: playerIds,
        receivingPlayerIds:[targetPlayer.id],
        offeringPickIds:   pickIds,
        receivingPickIds:  [],
      };

      if (targetPlayer.teamId === this.userTeamId) {
        const record: TradeOffer = {
          id:               uuidv4(),
          offeringTeamId:   team.id,
          receivingTeamId:  this.userTeamId,
          offeringPlayers:  playerIds,
          receivingPlayers: [targetPlayer.id],
          offeringPicks:    offerPicks.map(p => ({ year: p.year, round: p.round, originalTeamId: p.originalTeamId })),
          receivingPicks:   [],
          status:           'pending',
          createdDate:      new Date(),
          expirationDate:   new Date(),
          isPlayerInitiated: false,
          season:           this.currentGameDate.season,
          week,
        };
        this.receivedTradeOffers.push(record);
        this.pendingAITradeOffer = uiPayload;

        const playerNames = offerPlayers.map(p => `${p.firstName} ${p.lastName}`).join(', ');
        const assetsDesc = playerNames
          ? `${playerNames} and draft capital`
          : 'a package of draft picks';

        this._handleEngineInterrupt(this._buildEngineInterrupt(
          HardStopReason.TRADE_OFFER_RECEIVED,
          { reason: HardStopReason.TRADE_OFFER_RECEIVED, offerId: record.id },
          `Trade Offer from ${team.abbreviation}`,
          `${team.city} ${team.name} wants ${targetPlayer.firstName} ${targetPlayer.lastName} for ${assetsDesc}.`,
        ));
        return; // Surface one AI offer at a time
      } else {
        // AI-to-AI: evaluate and auto-execute if accepted
        const result = this.proposeTrade(uiPayload);
        if (result.accepted) this.executeTrade(uiPayload);
      }
    }
  }

  /** Find the position where the given team's best player is below OVR 74. */
  private _findTeamNeed(team: Team): Position | null {
    const byPosition = new Map<Position, number>();
    for (const player of this.allPlayers) {
      if (player.teamId !== team.id) continue;
      const best = byPosition.get(player.position) ?? 0;
      if (player.overall > best) byPosition.set(player.position, player.overall);
    }
    for (const [pos, best] of byPosition) {
      if (best < 74) return pos;
    }
    return null;
  }

  /**
   * Find a trade target at the given position.
   * Priority: 1. Players explicitly on the block (User or AI).
   *           2. Surplus players on other teams.
   */
  private _findTradeTarget(pos: Position, excludeTeamId: string): Player | null {
    const week = this.currentGameDate.week;
    const teamGroups = new Map<string, Player[]>();
    for (const p of this.allPlayers) {
      if (!p.teamId || p.teamId === excludeTeamId || p.position !== pos) continue;
      if (!teamGroups.has(p.teamId)) teamGroups.set(p.teamId, []);
      teamGroups.get(p.teamId)!.push(p);
    }

    // 1. Check for players explicitly on the block (User or AI)
    const onBlock = this.allPlayers.filter(p => p.position === pos && p.teamId !== excludeTeamId && p.shoppingStatus === 'On The Block');
    if (onBlock.length > 0) {
      return onBlock.sort((a, b) => b.overall - a.overall)[0];
    }

    for (const [teamId, players] of teamGroups) {
      const team = this.teams.find(t => t.id === teamId);
      if (!team) continue;
      const sorted = players.slice().sort((a, b) => b.overall - a.overall);
      const tier = this.tradeSystem.determineFranchiseTier(team, week);

      // Surplus: starter + capable backup
      if (sorted.length >= 2 && sorted[0].overall >= 80 && sorted[1].overall >= 76) {
        return sorted[1]; // Offer the backup
      }
      // Rebuilder offloading expensive aging veteran
      if (tier === FranchiseTier.REBUILDER && sorted[0]?.overall >= 85 && sorted[0].age >= 30) {
        return sorted[0];
      }
    }
    return null;
  }

  /**
   * Build a trade package (players + picks) that matches the receiving team's needs.
   */
  private _buildTradePackage(target: Player, aiTeam: Team, receivingTeam: Team): { players: Player[], picks: TeamDraftPick[] } {
    const targetValue = this.tradeSystem.getBasePlayerValue(target) * 1.1;
    let accumulated = 0;
    const offeredPlayers: Player[] = [];
    const offeredPicks: TeamDraftPick[] = [];

    // 1. Identify receiving team needs
    const needs = this._findAllTeamNeeds(receivingTeam);

    // 2. Find tradeable players on AI team that match needs
    const aiRoster = this.allPlayers.filter(p => p.teamId === aiTeam.id);
    const tradeablePlayers = aiRoster.filter(p => {
      // On block?
      if (p.shoppingStatus === 'On The Block') return true;
      // Depth player? (Not top 1 at position)
      const rankAtPos = aiRoster.filter(tm => tm.position === p.position && tm.overall > p.overall).length;
      return rankAtPos >= 1;
    });

    // Sort candidates by value (best first)
    const candidates = tradeablePlayers
      .filter(p => needs.includes(p.position))
      .sort((a, b) => this.tradeSystem.getBasePlayerValue(b) - this.tradeSystem.getBasePlayerValue(a));

    // 3. Add players to offer
    for (const player of candidates) {
      const val = this.tradeSystem.getBasePlayerValue(player);
      // Don't offer if it alone exceeds target value significantly, unless it's a 1-for-1 swap roughly
      if (accumulated + val <= targetValue * 1.1) {
        offeredPlayers.push(player);
        accumulated += val;
      }
      if (accumulated >= targetValue) break;
    }

    // 4. Fill gap with picks
    if (accumulated < targetValue) {
      const teamPicks = this.draftPicks
        .filter(p => p.currentTeamId === aiTeam.id)
        .sort((a, b) => this.tradeSystem.getBasePickValue(b) - this.tradeSystem.getBasePickValue(a));

      for (const pick of teamPicks) {
        const val = this.tradeSystem.getBasePickValue(pick);
        if (accumulated + val <= targetValue * 1.15) {
          offeredPicks.push(pick);
          accumulated += val;
        }
        if (accumulated >= targetValue) break;
      }
    }

    // If we failed to match value (e.g. AI has no assets), return empty
    if (accumulated < targetValue * 0.85) return { players: [], picks: [] };

    return { players: offeredPlayers, picks: offeredPicks };
  }

  /** Find all positional needs for a team (weak starter or thin depth). */
  private _findAllTeamNeeds(team: Team): Position[] {
    const needs: Position[] = [];
    const roster = this.allPlayers.filter(p => p.teamId === team.id);
    const positions = [Position.QB, Position.RB, Position.WR, Position.TE, Position.OL, Position.DL, Position.LB, Position.CB, Position.S];

    for (const pos of positions) {
      const players = roster.filter(p => p.position === pos).sort((a, b) => b.overall - a.overall);
      // Need if starter is weak (<75) or depth is thin
      if (!players[0] || players[0].overall < 75) {
        needs.push(pos);
      } else if (players.length < (pos === Position.WR || pos === Position.CB ? 4 : 2)) {
        needs.push(pos);
      }
    }
    return needs;
  }

  private processUDFACleanup(): void {
    console.log(`🧹 [Roster Churn] Executing Week 20 UDFA cleanup...`);
    
    let retiredCount = 0;
    const retiringIds = new Set<string>();

    for (const player of this.allPlayers) {
        // Condition: Is a Free Agent, OVR is less than 55, and is young (indicating UDFA)
        if (
            player.status === PlayerStatus.FREE_AGENT && 
            !player.teamId && 
            player.overall < 55 &&
            player.age <= 24 // Ensures we are targeting the UDFA class, not just older vets (who are handled in Week 1)
        ) {
            retiringIds.add(player.id);
            retiredCount++;
        }
    }

    if (retiredCount > 0) {
        // Remove them from the active universe
        this.allPlayers = this.allPlayers.filter(p => !retiringIds.has(p.id));
        this.freeAgents = this.freeAgents.filter(p => !retiringIds.has(p.id));
        
        console.log(`✅ [Roster Churn] ${retiredCount} UDFAs failed to make a roster and have retired from football.`);
        
        // Optional: Notify the user so the world feels alive
        this.addHeadline(
            "Roster Cuts & Retirements",
            `${retiredCount} undrafted free agents have quietly retired from football after failing to secure practice squad invites ahead of Training Camp.`,
            NewsCategory.RUMORS,
            NewsImportance.LOW
        );
    }
  }
}

/**
 * Global singleton — import this everywhere instead of constructing
 * a new GameStateManager. App.tsx registers onAutoSave on startup.
 */
export const gameStateManager = new GameStateManager();
