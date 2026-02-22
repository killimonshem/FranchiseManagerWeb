/**
 * Draft Board UI System: Enhanced Draft Board with Prospect Details
 * Converted from Swift EnhancedDraftBoardView.swift
 * Provides draft board management, prospect analysis, and mock draft simulation
 */

import { Position, ALL_POSITIONS } from "./nfl-types";
import { Player, PlayerStatus } from "./player";
import { Team } from "./team";

// ============================================================================
// DRAFT PROSPECT MODEL (EXTENDED)
// ============================================================================

export interface CombineResults {
  fortyYard?: number; // seconds
  benchPress?: number; // reps
  verticalJump?: number; // inches
  broadJump?: number; // inches
  shuttle?: number; // seconds
  cone?: number; // seconds
  nflComparables?: string[];
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
  overallRank?: number;
  positionRank?: number;
  projectedRound?: number;
  scoutingGrade: string; // "A+", "A", "B+", etc.
  bigBoard: number; // 1-300+
  attributes: ProspectAttributes;
  personality: ProspectPersonality;
  combineResults?: CombineResults;
  medicalGrade: string;
  characterGrade: string;
  workEthic: number; // 0-100
  coachability: number; // 0-100
  productionMetrics?: {
    gamesPlayed: number;
    careerStats: string;
    awards: string[];
  };
}

export interface ProspectAttributes {
  speed: number; // 0-100
  strength: number;
  awareness: number;
  agility: number;
  jumping: number;
  hands: number;
  footwork: number;
  fieldVision: number;
  competitiveness: number;
  decisionMaking: number;
}

export interface ProspectPersonality {
  leadership: number; // 0-100
  coachability: number;
  motivation: number;
  teamOrientation: number;
  workEthic: number;
  intelligence: number;
}

// ============================================================================
// DRAFT BOARD VIEW MODEL STATE
// ============================================================================

export interface DraftBoardUIState {
  userBoard: DraftProspect[];
  searchText: string;
  filterPosition?: Position;
  showOnlyTopProspects: boolean;
  showingMockDraft: boolean;
  isEditingBoard: boolean;
  selectedProspect?: DraftProspect;
  showingProspectDetail: boolean;
}

/**
 * Initialize draft board UI state
 */
export function initializeDraftBoardUI(): DraftBoardUIState {
  return {
    userBoard: [],
    searchText: "",
    filterPosition: undefined,
    showOnlyTopProspects: false,
    showingMockDraft: false,
    isEditingBoard: false,
    selectedProspect: undefined,
    showingProspectDetail: false,
  };
}

// ============================================================================
// DRAFT BOARD VIEW MODEL
// ============================================================================

export class DraftBoardViewModel {
  private gameState: {
    draftProspects: DraftProspect[];
    allPlayers: Player[];
    draftPicks: Array<{ year: number; round: number; currentTeamId: string }>;
    userTeamId?: string;
    currentSeason: number;
  };

  private state: DraftBoardUIState;

  constructor(gameState: any) {
    this.gameState = gameState;
    this.state = initializeDraftBoardUI();
    this.loadUserBoard();
  }

  /**
   * Get filtered prospects based on search and filters
   */
  getFilteredProspects(): DraftProspect[] {
    let prospects = this.state.userBoard.length > 0
      ? this.state.userBoard
      : this.gameState.draftProspects;

    return prospects.filter((prospect) => {
      // Search filter
      if (this.state.searchText) {
        const searchLower = this.state.searchText.toLowerCase();
        const fullName = `${prospect.firstName} ${prospect.lastName}`.toLowerCase();
        if (
          !fullName.includes(searchLower) &&
          !prospect.college.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      // Position filter
      if (
        this.state.filterPosition &&
        prospect.position !== this.state.filterPosition
      ) {
        return false;
      }

      // Top prospects only filter
      if (
        this.state.showOnlyTopProspects &&
        (prospect.projectedRound ?? 4) > 3
      ) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get user's draft picks for current season
   */
  getUserDraftPicks(): Array<{
    year: number;
    round: number;
    currentTeamId: string;
  }> {
    return this.gameState.draftPicks
      .filter((p) => p.currentTeamId === this.gameState.userTeamId)
      .sort((p1, p2) => {
        if (p1.year !== p2.year) return p1.year - p2.year;
        return p1.round - p2.round;
      });
  }

  /**
   * Check if user has a pick coming at approximately this rank
   */
  isUserPickComing(rank: number): boolean {
    const currentYear = this.gameState.currentSeason;
    const userPicks = this.getUserDraftPicks().filter((p) => p.year === currentYear);

    for (const pick of userPicks) {
      const estimatedPick = (pick.round - 1) * 32 + 16; // Mid-round estimate
      if (Math.abs(estimatedPick - rank) <= 5) {
        return true;
      }
    }

    return false;
  }

  /**
   * Load user's saved draft board or use default
   */
  loadUserBoard(): void {
    if (this.state.userBoard.length === 0) {
      this.state.userBoard = this.gameState.draftProspects.sort(
        (a, b) => a.bigBoard - b.bigBoard
      );
    }
  }

  /**
   * Auto-rank board by team needs
   */
  autoRankByNeeds(): void {
    const needs = this.analyzeTeamNeeds();

    this.state.userBoard = this.gameState.draftProspects.sort((p1, p2) => {
      const p1NeedScore = needs[p1.position] ?? 0;
      const p2NeedScore = needs[p2.position] ?? 0;

      const p1Score = p1.bigBoard - p1NeedScore * 10;
      const p2Score = p2.bigBoard - p2NeedScore * 10;

      return p1Score - p2Score;
    });
  }

  /**
   * Auto-rank board by best available (BPA)
   */
  autoRankByBestAvailable(): void {
    this.state.userBoard = this.gameState.draftProspects.sort(
      (a, b) => a.bigBoard - b.bigBoard
    );
  }

  /**
   * Move prospect in board (drag/drop reordering)
   */
  moveProspect(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= this.state.userBoard.length) return;
    if (toIndex < 0 || toIndex >= this.state.userBoard.length) return;

    const [prospect] = this.state.userBoard.splice(fromIndex, 1);
    this.state.userBoard.splice(toIndex, 0, prospect);
  }

  /**
   * Remove prospect from board
   */
  removeProspect(index: number): void {
    if (index >= 0 && index < this.state.userBoard.length) {
      this.state.userBoard.splice(index, 1);
    }
  }

  /**
   * Import big board from external source
   */
  importBigBoard(): void {
    this.state.userBoard = this.gameState.draftProspects.sort(
      (a, b) => a.bigBoard - b.bigBoard
    );
  }

  /**
   * Export current board (in real app, saves to file)
   */
  exportBoard(): string {
    return JSON.stringify(
      this.state.userBoard.map((p, idx) => ({
        rank: idx + 1,
        name: `${p.firstName} ${p.lastName}`,
        position: p.position,
        college: p.college,
        grade: p.scoutingGrade,
      })),
      null,
      2
    );
  }

  /**
   * Update search text
   */
  setSearchText(text: string): void {
    this.state.searchText = text;
  }

  /**
   * Update position filter
   */
  setPositionFilter(position?: Position): void {
    this.state.filterPosition = position;
  }

  /**
   * Toggle top prospects filter
   */
  toggleTopProspectsOnly(): void {
    this.state.showOnlyTopProspects = !this.state.showOnlyTopProspects;
  }

  /**
   * Toggle mock draft simulator
   */
  toggleMockDraft(): void {
    this.state.showingMockDraft = !this.state.showingMockDraft;
  }

  /**
   * Toggle editing mode
   */
  toggleEditingBoard(): void {
    this.state.isEditingBoard = !this.state.isEditingBoard;
  }

  /**
   * Select prospect for detail view
   */
  selectProspect(prospect: DraftProspect): void {
    this.state.selectedProspect = prospect;
    this.state.showingProspectDetail = true;
  }

  /**
   * Close prospect detail
   */
  closeProspectDetail(): void {
    this.state.showingProspectDetail = false;
  }

  /**
   * Get current state
   */
  getState(): DraftBoardUIState {
    return this.state;
  }

  /**
   * Analyze team needs by position
   */
  private analyzeTeamNeeds(): Record<Position, number> {
    const roster = this.gameState.allPlayers.filter(
      (p) => p.teamId === this.gameState.userTeamId
    );
    const needs: Record<Position, number> = {} as Record<Position, number>;

    for (const position of ALL_POSITIONS) {
      const players = roster.filter((p) => p.position === position);
      const avgOverall =
        players.length > 0
          ? players.reduce((sum, p) => sum + p.overall, 0) / players.length
          : 0;
      const count = players.length;

      let needScore = 0;

      // Quantity need
      const minCount = this.getMinPositionCount(position);
      if (count < minCount) {
        needScore += 50;
      } else if (count === minCount) {
        needScore += 25;
      }

      // Quality need
      if (avgOverall < 70) {
        needScore += 30;
      } else if (avgOverall < 80) {
        needScore += 15;
      }

      // Age factor
      const avgAge =
        players.length > 0
          ? players.reduce((sum, p) => sum + p.age, 0) / players.length
          : 30;
      if (avgAge > 30) {
        needScore += 10;
      }

      needs[position] = needScore;
    }

    return needs;
  }

  /**
   * Get minimum roster count for position
   */
  private getMinPositionCount(position: Position): number {
    const minimums: Record<Position, number> = {
      QB: 2,
      RB: 3,
      WR: 5,
      TE: 2,
      OL: 7,
      DL: 6,
      LB: 5,
      CB: 5,
      S: 3,
      K: 1,
      P: 1,
    };
    return minimums[position] ?? 1;
  }
}

// ============================================================================
// PROSPECT DETAIL VIEW MODELS
// ============================================================================

/**
 * Calculate athletic score from combine/attributes
 */
export function calculateAthleticScore(prospect: DraftProspect): number {
  const weights = {
    speed: 0.25,
    strength: 0.25,
    agility: 0.25,
    jumping: 0.25,
  };

  const score =
    prospect.attributes.speed * weights.speed +
    prospect.attributes.strength * weights.strength +
    prospect.attributes.agility * weights.agility +
    prospect.attributes.jumping * weights.jumping;

  return Math.round(score);
}

/**
 * Get prospect strengths based on attributes
 */
export function getProspectStrengths(prospect: DraftProspect): string[] {
  const strengths: string[] = [];

  if (prospect.attributes.speed > 85) {
    strengths.push("Elite speed for the position");
  }
  if (prospect.attributes.strength > 85) {
    strengths.push("Exceptional strength and power");
  }
  if (prospect.attributes.awareness > 85) {
    strengths.push("High football IQ and field awareness");
  }
  if (prospect.attributes.hands > 85) {
    strengths.push("Outstanding hand placement and catching ability");
  }
  if (prospect.workEthic > 85) {
    strengths.push("Exceptional work ethic and dedication");
  }

  return strengths.length > 0 ? strengths : ["Well-rounded skill set"];
}

/**
 * Get prospect weaknesses based on attributes
 */
export function getProspectWeaknesses(prospect: DraftProspect): string[] {
  const weaknesses: string[] = [];

  if (prospect.attributes.speed < 70) {
    weaknesses.push("Lacks elite speed at the position");
  }
  if (prospect.attributes.strength < 70) {
    weaknesses.push("Below-average strength concerns");
  }
  if (prospect.age > 23) {
    weaknesses.push("Older prospect with limited upside");
  }
  if (prospect.coachability < 70) {
    weaknesses.push("Coachability concerns");
  }
  if (prospect.medicalGrade === "D" || prospect.medicalGrade === "F") {
    weaknesses.push("Significant medical red flags");
  }

  return weaknesses.length > 0 ? weaknesses : ["Few notable weaknesses"];
}

/**
 * Get similar players from roster for comparison
 */
export function getSimilarPlayers(
  prospect: DraftProspect,
  allPlayers: Player[]
): Player[] {
  return allPlayers
    .filter((p) => p.position === prospect.position)
    .sort((a, b) => Math.abs(a.overall - 85) - Math.abs(b.overall - 85))
    .slice(0, 10);
}

/**
 * Compare prospect to an existing player
 */
export interface ProspectComparison {
  attribute: string;
  prospectValue: number;
  playerValue: number;
  difference: number;
  prospectAdvantage: boolean;
}

export function compareProspectToPlayer(
  prospect: DraftProspect,
  player: Player
): ProspectComparison[] {
  return [
    {
      attribute: "Speed",
      prospectValue: prospect.attributes.speed,
      playerValue: player.attributes.speed,
      difference: prospect.attributes.speed - player.attributes.speed,
      prospectAdvantage: prospect.attributes.speed > player.attributes.speed,
    },
    {
      attribute: "Strength",
      prospectValue: prospect.attributes.strength,
      playerValue: player.attributes.strength,
      difference: prospect.attributes.strength - player.attributes.strength,
      prospectAdvantage: prospect.attributes.strength > player.attributes.strength,
    },
    {
      attribute: "Awareness",
      prospectValue: prospect.attributes.awareness,
      playerValue: player.attributes.awareness,
      difference: prospect.attributes.awareness - player.attributes.awareness,
      prospectAdvantage: prospect.attributes.awareness > player.attributes.awareness,
    },
    {
      attribute: "Agility",
      prospectValue: prospect.attributes.agility,
      playerValue: player.attributes.agility,
      difference: prospect.attributes.agility - player.attributes.agility,
      prospectAdvantage: prospect.attributes.agility > player.attributes.agility,
    },
  ];
}

// ============================================================================
// DRAFT PROJECTION MODEL
// ============================================================================

export interface DraftProjection {
  round: number;
  pickRange: { start: number; end: number };
  confidence: "High" | "Medium" | "Low";
  nflProjection: {
    rookieYear: string;
    year2to3: string;
    ceiling: string;
    floor: string;
  };
}

/**
 * Generate draft projection for prospect
 */
export function generateDraftProjection(
  prospect: DraftProspect
): DraftProjection {
  const round = prospect.projectedRound ?? 3;
  const pickStart = (round - 1) * 32 + 1;
  const pickEnd = round * 32;

  let confidence: "High" | "Medium" | "Low" = "Medium";
  if (round <= 2) confidence = "High";
  if (round >= 6) confidence = "Low";

  return {
    round,
    pickRange: { start: pickStart, end: pickEnd },
    confidence,
    nflProjection: {
      rookieYear: "Rotational player, special teams contributor",
      year2to3: "Competing for starting role",
      ceiling:
        prospect.attributes.speed > 85 && prospect.attributes.strength > 80
          ? "Pro Bowl potential with development"
          : "All-Pro candidate if development continues",
      floor: "Quality backup, special teams",
    },
  };
}

// ============================================================================
// MOCK DRAFT SIMULATOR
// ============================================================================

export interface MockDraftResult {
  overallPick: number;
  round: number;
  pick: number;
  team: Team;
  prospect: DraftProspect;
}

export interface MockDraftSimulatorState {
  isSimulating: boolean;
  results: MockDraftResult[];
  progress: number; // 0-100
}

/**
 * Initialize mock draft simulator
 */
export function initializeMockDraftSimulator(): MockDraftSimulatorState {
  return {
    isSimulating: false,
    results: [],
    progress: 0,
  };
}

/**
 * Simulate a mock draft
 */
export function simulateMockDraft(
  teams: Team[],
  prospects: DraftProspect[],
  draftRounds: number = 7
): MockDraftResult[] {
  const results: MockDraftResult[] = [];
  const availableProspects = [...prospects];
  let overallPick = 1;

  // Simple mock: shuffle teams for each round and pick best available
  for (let round = 1; round <= draftRounds; round++) {
    const shuffledTeams = teams.sort(() => Math.random() - 0.5);

    for (const team of shuffledTeams) {
      if (availableProspects.length === 0) break;

      // Simple AI: pick best available
      const picked = availableProspects.splice(0, 1)[0];

      results.push({
        overallPick,
        round,
        pick: ((overallPick - 1) % 32) + 1,
        team,
        prospect: picked,
      });

      overallPick++;
    }

    if (availableProspects.length === 0) break;
  }

  return results;
}

// ============================================================================
// GRADE UTILITIES
// ============================================================================

/**
 * Get color for scouting grade
 */
export function getGradeColor(grade: string): string {
  const firstLetter = grade.charAt(0);

  switch (firstLetter) {
    case "A":
      return "#8B5CF6"; // Purple
    case "B":
      return "#3B82F6"; // Blue
    case "C":
      return "#10B981"; // Green
    default:
      return "#F97316"; // Orange
  }
}

/**
 * Get position color
 */
export function getPositionColor(position: Position): string {
  const colors: Record<Position, string> = {
    QB: "#1E40AF",
    RB: "#7C2D12",
    WR: "#B91C1C",
    TE: "#9333EA",
    OL: "#0369A1",
    DL: "#4B5563",
    LB: "#92400E",
    CB: "#15803D",
    S: "#0F766E",
    K: "#6366F1",
    P: "#4F46E5",
  };

  return colors[position] ?? "#6B7280";
}

// ============================================================================
// ATTRIBUTE UTILITIES
// ============================================================================

/**
 * Format prospect attributes for display
 */
export interface AttributeDisplay {
  name: string;
  value: number;
  color: string;
  tier: "Elite" | "Very Good" | "Good" | "Average" | "Below Average";
}

export function getAttributeDisplays(
  prospect: DraftProspect
): AttributeDisplay[] {
  const getTier = (value: number): AttributeDisplay["tier"] => {
    if (value >= 90) return "Elite";
    if (value >= 80) return "Very Good";
    if (value >= 70) return "Good";
    if (value >= 60) return "Average";
    return "Below Average";
  };

  const getColor = (value: number): string => {
    if (value >= 90) return "#8B5CF6"; // Purple
    if (value >= 80) return "#3B82F6"; // Blue
    if (value >= 70) return "#10B981"; // Green
    if (value >= 60) return "#F59E0B"; // Yellow
    return "#EF4444"; // Red
  };

  return [
    {
      name: "Speed",
      value: prospect.attributes.speed,
      color: getColor(prospect.attributes.speed),
      tier: getTier(prospect.attributes.speed),
    },
    {
      name: "Strength",
      value: prospect.attributes.strength,
      color: getColor(prospect.attributes.strength),
      tier: getTier(prospect.attributes.strength),
    },
    {
      name: "Awareness",
      value: prospect.attributes.awareness,
      color: getColor(prospect.attributes.awareness),
      tier: getTier(prospect.attributes.awareness),
    },
    {
      name: "Agility",
      value: prospect.attributes.agility,
      color: getColor(prospect.attributes.agility),
      tier: getTier(prospect.attributes.agility),
    },
    {
      name: "Jumping",
      value: prospect.attributes.jumping,
      color: getColor(prospect.attributes.jumping),
      tier: getTier(prospect.attributes.jumping),
    },
    {
      name: "Hands",
      value: prospect.attributes.hands,
      color: getColor(prospect.attributes.hands),
      tier: getTier(prospect.attributes.hands),
    },
    {
      name: "Footwork",
      value: prospect.attributes.footwork,
      color: getColor(prospect.attributes.footwork),
      tier: getTier(prospect.attributes.footwork),
    },
    {
      name: "Field Vision",
      value: prospect.attributes.fieldVision,
      color: getColor(prospect.attributes.fieldVision),
      tier: getTier(prospect.attributes.fieldVision),
    },
  ];
}

// ============================================================================
// PRODUCTION METRICS
// ============================================================================

export interface ProductionMetricsDisplay {
  gamesPlayed: number;
  careerStats: string;
  awards: string[];
  productionScore: number; // 0-100
}

/**
 * Calculate production score from metrics
 */
export function calculateProductionScore(
  prospect: DraftProspect
): ProductionMetricsDisplay {
  const metrics = prospect.productionMetrics || {
    gamesPlayed: 0,
    careerStats: "",
    awards: [],
  };

  let score = 50; // Base score

  // Games played (up to 50 games = up to +30)
  score += Math.min(30, (metrics.gamesPlayed / 50) * 30);

  // Awards (2 awards = +20)
  score += Math.min(20, metrics.awards.length * 10);

  return {
    gamesPlayed: metrics.gamesPlayed,
    careerStats: metrics.careerStats,
    awards: metrics.awards,
    productionScore: Math.min(100, Math.round(score)),
  };
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

export interface DraftBoardUIManager {
  viewModel: DraftBoardViewModel;
  simulatorState: MockDraftSimulatorState;
}

/**
 * Initialize complete draft board UI system
 */
export function initializeDraftBoardUISystem(gameState: any): DraftBoardUIManager {
  return {
    viewModel: new DraftBoardViewModel(gameState),
    simulatorState: initializeMockDraftSimulator(),
  };
}

/**
 * Run mock draft simulation
 */
export function runMockDraftSimulation(
  manager: DraftBoardUIManager,
  teams: Team[],
  prospects: DraftProspect[]
): void {
  manager.simulatorState.isSimulating = true;
  manager.simulatorState.progress = 0;

  // Simulate with progress updates
  setTimeout(() => {
    manager.simulatorState.results = simulateMockDraft(teams, prospects);
    manager.simulatorState.isSimulating = false;
    manager.simulatorState.progress = 100;
  }, 2000);
}
