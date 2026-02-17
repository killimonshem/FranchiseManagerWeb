// GameStateManager.ts
// Core game state hub managing all league, team, player, and simulation data

import { v4 as uuidv4 } from 'uuid';
import { Team } from './team';
import { Player, PlayerStatus } from './player';
import { Position, NFLDivision, NFLConference } from './nfl-types';
import { FreeAgencyTransaction, CompensatoryPickSystem, CompPick } from './CompensatoryPickSystem';

// MARK: - Placeholder Types & Enums

// Game simulation execution state tracking (idle, simulating, or paused)
export enum SimulationState {
  IDLE = 'idle',
  SIMULATING = 'simulating',
  PAUSED_FOR_INTERRUPT = 'pausedForInterrupt'
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

export type HardStopReason =
  | { reason: 'starterInjured'; playerId: string }
  | { reason: 'tradeOfferReceived'; offerId: string }
  | { reason: 'gmFired'; reason: string }
  | { reason: 'rosterCutsRequired'; activeCount: number; required: number }
  | { reason: 'practiceSquadPoached'; playerId: string; poachingTeamId: string }
  | { reason: 'waiverClaimAvailable'; playerId: string }
  | { reason: 'contractDeadlineDay' };

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

export interface UserProfile {
  firstName: string;
  lastName: string;
  joinedDate: Date;
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
    this.userProfile = {
      firstName,
      lastName,
      joinedDate: new Date()
    };
  }

  selectUserTeam(teamId: string): void {
    this.userTeamId = teamId;
    this.addNotification(
      'Team Selected',
      `GM of ${this.userTeam?.fullName || 'Team'}`,
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
      Position.FB,
      Position.WR,
      Position.TE,
      Position.OL,
      Position.C,
      Position.LG,
      Position.RG,
      Position.LT,
      Position.RT
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

    // Trigger compensatory pick setup when draft event is completed
    if (event === SeasonEvent.DRAFT) {
      // The draft setup should have already happened when transitioning to draft phase
      // This is just a marker that draft has been completed
      console.log('📋 Draft phase completed');
    }
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
    console.log(`📋 ROSTER DEBUG INFO - ${this.userTeam.fullName} - Week ${this.currentWeek}`);
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
      isUnrestrictedFreeAgent: player.experience > 3,
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
}
