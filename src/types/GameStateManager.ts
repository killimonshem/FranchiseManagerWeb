// GameStateManager.ts
// Core game state hub managing all league, team, player, and simulation data

const uuidv4 = () => crypto.randomUUID();
import { Team } from './team';
import { Player, PlayerStatus } from './player';
import { calculatePlayerMarketValue } from './player';
import { Position, NFLDivision, NFLConference } from './nfl-types';
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
} from './engine-types';
import { hasMajorEventThisWeek, getScheduledEvent } from './scheduled-events';
import { AgentPersonalitySystem } from '../systems/AgentPersonalitySystem';
import { TradeSystem } from '../systems/TradeSystem';
import { FinanceSystem } from '../systems/FinanceSystem';
import { DraftEngine } from '../systems/DraftEngine';
import type { DraftPickResult } from '../systems/DraftEngine';

// Re-export engine types so existing imports from this file still work
export type { Interrupt, InterruptResolution, EngineGameDate, EngineSnapshot };
export { EnginePhase, HardStopReason, SoftStopReason, EngineSimulationState, PHASE_LABELS };

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
  name: string;
  position: Position;
  college: string;
  height: number;
  weight: number;
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

export const TRADE_SYSTEM_DEADLINE_WEEK = 39;
const PLAYOFF_BRACKET_KEY = 'NFL_PlayoffBracket';

// MARK: - Core GameStateManager Class

export class GameStateManager {
  // Time & Simulation Properties
  currentGameDate: GameDate;
  simulationState: SimulationState = SimulationState.IDLE;
  currentProcessingDescription: string = '';
  currentProcessingProgress: number = 0;
  interruptQueue: ProcessingInterrupt[] = [];
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
  leagueTradeBlock: Set<string> = new Set();

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

  // Compensatory Pick System
  offseasonTransactions: FreeAgencyTransaction[] = [];
  compPicks: CompPick[] = [];
  compensatoryPickSystem: CompensatoryPickSystem = new CompensatoryPickSystem();

  // ── Injected sub-systems (PRD §5 — pure TS classes, zero React) ────────────
  agentPersonalitySystem: AgentPersonalitySystem = new AgentPersonalitySystem();
  tradeSystem: TradeSystem = new TradeSystem();
  financeSystem: FinanceSystem = new FinanceSystem();
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

  savePlayoffBracket(bracket: PlayoffBracket): void {
    try {
      const data = JSON.stringify(bracket);
      localStorage.setItem(PLAYOFF_BRACKET_KEY, data);
      console.log(`💾 [Persistence] Playoff bracket saved for season ${bracket.season}`);
    } catch (error) {
      console.error('❌ [Persistence] Failed to save playoff bracket:', error);
    }
  }

  loadPlayoffBracket(): PlayoffBracket | null {
    try {
      const data = localStorage.getItem(PLAYOFF_BRACKET_KEY);
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

  clearSavedPlayoffBracket(): void {
    localStorage.removeItem(PLAYOFF_BRACKET_KEY);
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
      console.log(`ℹ️ [CompPicks] Skipping ${playerId} - not from another team`);
      return;
    }

    const player = this.allPlayers.find(p => p.id === playerId);
    if (!player) {
      console.log(`❌ [CompPicks] Player not found: ${playerId}`);
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
    console.log(`✅ [CompPicks] Recorded signing: ${player.firstName} ${player.lastName} (${player.position}) ${oldTeamId} -> ${newTeamId} for $${(apy / 1_000_000).toFixed(1)}M APY`);
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
      playerNames
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

    // End of regular season: persist the playoff bracket
    if (newWeek === 46) {
      const existing = this.loadPlayoffBracket();
      if (existing) {
        this.savePlayoffBracket(existing);
        console.log('🏆 Playoff bracket persisted at regular season end');
      }
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
        return { reason, expiringContracts: [] };
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
      case HardStopReason.TRADE_OFFER_RECEIVED:
        if (resolution.accepted) {
          const offer = this.receivedTradeOffers.find(o => o.id === (this.engineActiveInterrupt?.payload as any)?.offerId);
          if (offer) offer.status = 'accepted';
        } else {
          const offer = this.receivedTradeOffers.find(o => o.id === (this.engineActiveInterrupt?.payload as any)?.offerId);
          if (offer) offer.status = 'rejected';
        }
        break;

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
    this._engineProcessedEvents = new Set(snapshot.processedEvents);
    this._engineTargetWeek = snapshot.targetWeek;
    this.simulationState = SimulationState.IDLE;
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
}

/**
 * Global singleton — import this everywhere instead of constructing
 * a new GameStateManager. App.tsx registers onAutoSave on startup.
 */
export const gameStateManager = new GameStateManager();
