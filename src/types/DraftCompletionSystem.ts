/**
 * Draft Completion System: Enhanced Draft Completion with Mandatory Safeguards
 * Converted from Swift DraftCompletionManager.swift
 * Manages draft finalization, validation, UDFA conversion, and summary generation
 */

import { Position, DraftProspect } from "./nfl-types";
import { Player, PlayerStatus } from "./player";
import { Team } from "./team";

// ============================================================================
// DRAFT COMPLETION CONSTANTS
// ============================================================================

export const TOTAL_DRAFT_PICKS = 224; // 7 rounds × 32 teams
export const MAX_ROUNDS = 7;
export const TEAMS_PER_ROUND = 32;

// ============================================================================
// DRAFT GRADE SYSTEM
// ============================================================================

export enum DraftGrade {
  A_PLUS = "A+",
  A = "A",
  B_PLUS = "B+",
  B = "B",
  C_PLUS = "C+",
  C = "C",
  D_PLUS = "D+",
  D = "D",
  F = "F",
}

/**
 * Get numeric points for grade (for averaging)
 */
export function getGradePoints(grade: DraftGrade): number {
  const points: Record<DraftGrade, number> = {
    [DraftGrade.A_PLUS]: 4.3,
    [DraftGrade.A]: 4.0,
    [DraftGrade.B_PLUS]: 3.3,
    [DraftGrade.B]: 3.0,
    [DraftGrade.C_PLUS]: 2.3,
    [DraftGrade.C]: 2.0,
    [DraftGrade.D_PLUS]: 1.3,
    [DraftGrade.D]: 1.0,
    [DraftGrade.F]: 0.0,
  };
  return points[grade];
}

/**
 * Get color for grade
 */
export function getGradeColor(grade: DraftGrade): string {
  const colors: Record<DraftGrade, string> = {
    [DraftGrade.A_PLUS]: "#22C55E",
    [DraftGrade.A]: "#16A34A",
    [DraftGrade.B_PLUS]: "#3B82F6",
    [DraftGrade.B]: "#1D4ED8",
    [DraftGrade.C_PLUS]: "#F59E0B",
    [DraftGrade.C]: "#D97706",
    [DraftGrade.D_PLUS]: "#EF4444",
    [DraftGrade.D]: "#DC2626",
    [DraftGrade.F]: "#991B1B",
  };
  return colors[grade];
}

// ============================================================================
// STANDOUT PICK SYSTEM
// ============================================================================

export enum StandoutType {
  STEAL = "Steal",
  REACH = "Reach",
  POTENTIAL = "Potential",
}

export interface StandoutPick {
  id: string;
  player: Player;
  type: StandoutType;
  explanation: string;
}

/**
 * Get icon for standout type
 */
export function getStandoutIcon(type: StandoutType): string {
  const icons: Record<StandoutType, string> = {
    [StandoutType.STEAL]: "arrow.down.circle.fill",
    [StandoutType.REACH]: "arrow.up.circle.fill",
    [StandoutType.POTENTIAL]: "star.circle.fill",
  };
  return icons[type];
}

/**
 * Get color for standout type
 */
export function getStandoutColor(type: StandoutType): string {
  const colors: Record<StandoutType, string> = {
    [StandoutType.STEAL]: "#22C55E",
    [StandoutType.REACH]: "#F59E0B",
    [StandoutType.POTENTIAL]: "#3B82F6",
  };
  return colors[type];
}

// ============================================================================
// DRAFT SUMMARY
// ============================================================================

export interface DraftSummary {
  id: string;
  teamName: string;
  totalPicks: number;
  draftedPlayers: Player[];
  needsGrade: DraftGrade;
  valueGrade: DraftGrade;
  futureAssetsGrade: DraftGrade;
  overallGrade: DraftGrade;
  standoutPicks: StandoutPick[];
  timestamp: Date;
}

// ============================================================================
// DRAFT COMPLETION MANAGER STATE
// ============================================================================

export interface DraftCompletionState {
  isDraftCompleted: boolean;
  draftSummary?: DraftSummary;
  showingSummaryScreen: boolean;
  canAdvanceWeek: boolean;
  draftIsLocked: boolean;
  lockReason: string;
}

/**
 * Initialize draft completion state
 */
export function initializeDraftCompletionState(): DraftCompletionState {
  return {
    isDraftCompleted: false,
    draftSummary: undefined,
    showingSummaryScreen: false,
    canAdvanceWeek: true,
    draftIsLocked: false,
    lockReason: "",
  };
}

// ============================================================================
// DRAFT COMPLETION MANAGER
// ============================================================================

export class DraftCompletionManager {
  private state: DraftCompletionState;

  constructor() {
    this.state = initializeDraftCompletionState();
  }

  /**
   * CRITICAL: Validate draft completion after every pick
   * Prevents draft from exceeding 224 total picks
   */
  validateDraftCompletion(
    currentOverallPick: number,
    currentDraftRound: number,
    currentDraftPick: number
  ): void {
    // **FAIL-SAFE #1**: Force crash if draft somehow exceeds 224 picks
    if (currentOverallPick > TOTAL_DRAFT_PICKS) {
      throw new Error(
        `🚨 DRAFT CRASH: Draft exceeded ${TOTAL_DRAFT_PICKS} picks (Current: ${currentOverallPick}). This should be impossible.`
      );
    }

    // **HARD STOP**: Check if we've reached pick 7.32 (224th overall)
    if (currentDraftRound === MAX_ROUNDS && currentDraftPick === TEAMS_PER_ROUND) {
      console.log(
        "🛑 HARD STOP: Draft reached Pick 7.32 - FORCING COMPLETION"
      );
      return; // Signal to caller that draft is complete
    }

    // **FAIL-SAFE #2**: Double-check math doesn't allow progression beyond 7.32
    if (currentDraftRound > MAX_ROUNDS) {
      throw new Error(
        `🚨 EMERGENCY: Draft round exceeded ${MAX_ROUNDS} - FORCING COMPLETION`
      );
    }

    if (
      currentDraftRound === MAX_ROUNDS &&
      currentDraftPick > TEAMS_PER_ROUND
    ) {
      throw new Error(
        `🚨 EMERGENCY: Pick exceeded ${TEAMS_PER_ROUND} in round ${MAX_ROUNDS} - FORCING COMPLETION`
      );
    }
  }

  /**
   * MANDATORY: Execute draft completion with all safeguards
   * Steps:
   * 1. Lock draft permanently
   * 2. Convert undrafted prospects to free agents
   * 3. Generate draft summary
   * 4. Show mandatory summary screen
   */
  forceDraftCompletion(
    gameState: any,
    allPlayers: Player[]
  ): DraftCompletionState {
    console.log(
      "🏁 DRAFT COMPLETE: Locking Draft and Processing Undrafted Players"
    );

    // **STEP 1**: Permanently lock draft
    this.lockDraftPermanently();

    // **STEP 2**: Convert undrafted prospects to free agents
    // (UDFA Frenzy deprecated - no more bidding minigame)
    this.processUndraftedFreeAgents(gameState);

    // **STEP 3**: Generate draft summary
    this.generateDraftSummary(gameState, allPlayers);

    // **STEP 4**: Set completion flag
    this.state.isDraftCompleted = true;

    // **STEP 5**: Show mandatory summary screen
    this.showMandatorySummaryScreen();

    console.log(
      "✅ Draft complete - undrafted players converted to free agents"
    );

    return this.state;
  }

  /**
   * Called after UDFA processing or automatically at Week 22
   * Idempotent - safe to call multiple times
   */
  finalizePostDraft(gameState: any, allPlayers: Player[]): DraftCompletionState {
    // Idempotency check: If prospects are empty, we've already done this
    if (gameState.draftProspects.length === 0) {
      console.log("✅ Post-Draft cleanup already completed.");
      return this.state;
    }

    console.log(
      "🏁 FINALIZING SEASON: Processing remaining UDFAs and Summary"
    );

    // Process remaining undrafted prospects
    this.processUndraftedFreeAgents(gameState);

    // Generate mandatory summary
    this.generateDraftSummary(gameState, allPlayers);

    // Block actions except week advancement
    this.blockAllActionsExceptAdvanceWeek();

    // Show mandatory summary
    this.showMandatorySummaryScreen();

    console.log(
      "✅ Post-Draft sequence finished - user must advance week to continue"
    );

    return this.state;
  }

  // ============================================================================
  // STEP 1: PERMANENT DRAFT LOCK
  // ============================================================================

  /**
   * Lock draft permanently - no re-entry possible
   */
  private lockDraftPermanently(): void {
    this.state.draftIsLocked = true;
    this.state.lockReason =
      "Draft completed - locked until Week 2 of regular season";

    console.log("🔒 Draft permanently locked - no re-entry possible");
  }

  /**
   * Validate draft access based on current game state
   */
  validateDraftAccess(
    draftLocked: boolean,
    currentPhase: string,
    currentWeek: number
  ): boolean {
    if (!draftLocked) {
      return true; // Draft not locked, access allowed
    }

    // Only unlock after Week 2 of regular season
    const isRegularSeason = currentPhase === "regularSeason";
    const isWeek2OrLater = currentWeek >= 2;

    if (!(isRegularSeason && isWeek2OrLater)) {
      console.log(
        `⛔ Draft access denied: ${this.state.lockReason}`
      );
      return false;
    }

    return true;
  }

  // ============================================================================
  // STEP 2: UDFA PROCESSING
  // ============================================================================

  /**
   * Process undrafted prospects - convert to free agents
   * UDFA Frenzy has been deprecated
   */
  private processUndraftedFreeAgents(gameState: any): void {
    console.log("📋 Processing remaining undrafted free agents...");

    // **FAIL-SAFE**: Ensure all undrafted prospects become UDFAs
    if (gameState.draftProspects.length === 0) {
      console.log("⚠️ No undrafted prospects to process");
      return;
    }

    const initialUDFACount = gameState.freeAgents.filter(
      (p: any) => p.isUDFA
    ).length;
    let udfaCount = 0;

    for (const prospect of gameState.draftProspects) {
      // Convert prospect to free agent player
      const udfaPlayer: Player = {
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
        overall: this.calculateUDFAOverall(prospect),
        potential: this.calculateUDFAPotential(),
        attributes: prospect.attributes,
        personality: prospect.personality,
        contract: this.createUDFAContract(),
        stats: {} as any,
        draft: {
          year: 0,
          round: 0,
          pick: 0,
          overall: 0,
        },
        morale: 50,
        tradeRequestState: "none",
        shoppingStatus: "offBlock",
        isAwareOfShopping: false,
        yearsWithTeamSinceLastRookie: 0,
        yearsLastActuallyPlayed: 0,
      };

      gameState.freeAgents.push(udfaPlayer);
      udfaCount++;
    }

    // Clear all prospects
    gameState.draftProspects = [];

    console.log(
      `✅ Processed ${udfaCount} remaining undrafted free agents`
    );

    // **FAIL-SAFE**: Validate processing worked
    this.validateUDFAProcessing(
      gameState,
      udfaCount,
      initialUDFACount
    );
  }

  /**
   * Validate UDFA processing completed successfully
   */
  private validateUDFAProcessing(
    gameState: any,
    expectedCount: number,
    initialCount: number
  ): void {
    const finalCount = gameState.freeAgents.filter(
      (p: any) => p.isUDFA
    ).length;
    const actualAdded = finalCount - initialCount;

    if (actualAdded !== expectedCount) {
      console.warn(
        `⚠️ UDFA WARNING: Added ${actualAdded}, expected ${expectedCount}. (Total in pool: ${finalCount})`
      );
    }

    // CRITICAL: Only crash if prospects weren't cleared
    if (gameState.draftProspects.length > 0) {
      throw new Error(
        `🚨 UDFA PROCESSING FAILED: ${gameState.draftProspects.length} prospects still remain in the draft pool`
      );
    }

    console.log("✅ UDFA processing validation passed");
  }

  /**
   * Calculate UDFA overall rating (typically lower than drafted)
   */
  private calculateUDFAOverall(prospect: DraftProspect): number {
    // Calculate position overall from attributes
    const positionOverall = this.getPositionOverall(prospect);
    return Math.max(50, positionOverall - 15);
  }

  /**
   * Calculate UDFA potential (some UDFAs have hidden potential)
   */
  private calculateUDFAPotential(): number {
    return Math.floor(Math.random() * 21) + 60; // 60-80
  }

  /**
   * Create UDFA contract (league minimum)
   */
  private createUDFAContract() {
    return {
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
    };
  }

  // ============================================================================
  // STEP 3: DRAFT SUMMARY GENERATION
  // ============================================================================

  /**
   * Generate comprehensive draft summary with grades
   */
  private generateDraftSummary(gameState: any, allPlayers: Player[]): void {
    const userTeamId = gameState.userTeamId;
    const userTeam = gameState.teams.find((t: Team) => t.id === userTeamId);

    if (!userTeamId || !userTeam) {
      console.log("⚠️ Cannot generate summary - no user team");
      return;
    }

    const userDraftPicks = allPlayers.filter(
      (p) =>
        p.teamId === userTeamId &&
        p.draft?.year === gameState.currentSeason
    );

    const needsGrade = this.calculateNeedsGrade(userTeam, userDraftPicks);
    const valueGrade = this.calculateValueGrade(userDraftPicks);
    const futureAssetsGrade = this.calculateFutureAssetsGrade(
      gameState,
      userTeamId
    );
    const overallGrade = this.calculateOverallGrade(
      needsGrade,
      valueGrade,
      futureAssetsGrade
    );

    this.state.draftSummary = {
      id: Math.random().toString(36).substr(2, 9),
      teamName: userTeam.name,
      totalPicks: userDraftPicks.length,
      draftedPlayers: userDraftPicks,
      needsGrade,
      valueGrade,
      futureAssetsGrade,
      overallGrade,
      standoutPicks: this.identifyStandoutPicks(userDraftPicks),
      timestamp: new Date(),
    };

    console.log(
      `📊 Draft summary generated with overall grade: ${this.state.draftSummary.overallGrade}`
    );
  }

  /**
   * Calculate how well draft addressed team needs
   */
  private calculateNeedsGrade(team: Team, picks: Player[]): DraftGrade {
    const teamNeeds = this.analyzeTeamNeeds(team);
    const addressedNeeds = picks
      .map((p) => p.position)
      .filter((pos) => teamNeeds.includes(pos));
    const percentage =
      addressedNeeds.length / Math.max(teamNeeds.length, 1);

    if (percentage >= 0.8) return DraftGrade.A;
    if (percentage >= 0.6) return DraftGrade.B;
    if (percentage >= 0.4) return DraftGrade.C;
    if (percentage >= 0.2) return DraftGrade.D;
    return DraftGrade.F;
  }

  /**
   * Calculate value grade - were picks positioned well?
   */
  private calculateValueGrade(picks: Player[]): DraftGrade {
    let valueScore = 0;

    for (const player of picks) {
      const overall = player.overall;
      const round = player.draft?.round ?? 7;
      const expectedRange = this.getExpectedOverallForRound(round);

      if (overall > expectedRange.max + 5) {
        valueScore += 2;
      } else if (overall > expectedRange.max) {
        valueScore += 1;
      } else if (overall < expectedRange.min - 5) {
        valueScore -= 2;
      } else if (overall < expectedRange.min) {
        valueScore -= 1;
      }
    }

    const avgScore = valueScore / Math.max(picks.length, 1);

    if (avgScore >= 1.5) return DraftGrade.A;
    if (avgScore >= 0.5) return DraftGrade.B;
    if (avgScore >= -0.5) return DraftGrade.C;
    if (avgScore >= -1.5) return DraftGrade.D;
    return DraftGrade.F;
  }

  /**
   * Calculate future assets grade - how many picks do we have next year?
   */
  private calculateFutureAssetsGrade(
    gameState: any,
    teamId: string
  ): DraftGrade {
    const nextYearPicks = gameState.draftPicks.filter(
      (p: any) =>
        p.year === gameState.currentSeason + 1 &&
        p.currentTeamId === teamId
    );
    const originalPicks = gameState.draftPicks.filter(
      (p: any) =>
        p.year === gameState.currentSeason + 1 &&
        p.originalTeamId === teamId
    );

    const netChange = nextYearPicks.length - originalPicks.length;

    if (netChange >= 3) return DraftGrade.A;
    if (netChange >= 1) return DraftGrade.B;
    if (netChange >= -1) return DraftGrade.C;
    if (netChange >= -3) return DraftGrade.D;
    return DraftGrade.F;
  }

  /**
   * Calculate overall grade from component grades
   */
  private calculateOverallGrade(
    needs: DraftGrade,
    value: DraftGrade,
    assets: DraftGrade
  ): DraftGrade {
    const totalPoints =
      getGradePoints(needs) +
      getGradePoints(value) +
      getGradePoints(assets);
    const avgPoints = totalPoints / 3;

    if (avgPoints >= 3.5) return DraftGrade.A;
    if (avgPoints >= 2.5) return DraftGrade.B;
    if (avgPoints >= 1.5) return DraftGrade.C;
    if (avgPoints >= 0.5) return DraftGrade.D;
    return DraftGrade.F;
  }

  /**
   * Identify standout picks (steals, reaches, high potential)
   */
  private identifyStandoutPicks(picks: Player[]): StandoutPick[] {
    const standouts: StandoutPick[] = [];

    // Find best value (biggest steal)
    const bestValue = picks.reduce((best, current) => {
      const bestVal =
        best.overall -
        this.getExpectedOverallForRound(best.draft?.round ?? 7).max;
      const currentVal =
        current.overall -
        this.getExpectedOverallForRound(current.draft?.round ?? 7).max;
      return currentVal > bestVal ? current : best;
    });

    if (bestValue) {
      standouts.push({
        id: Math.random().toString(36).substr(2, 9),
        player: bestValue,
        type: StandoutType.STEAL,
        explanation: `Excellent value - ${bestValue.overall} overall in round ${bestValue.draft?.round ?? 0}`,
      });
    }

    // Find biggest reach
    const biggestReach = picks.reduce((worst, current) => {
      const worstVal =
        worst.overall -
        this.getExpectedOverallForRound(worst.draft?.round ?? 7).min;
      const currentVal =
        current.overall -
        this.getExpectedOverallForRound(current.draft?.round ?? 7).min;
      return currentVal < worstVal ? current : worst;
    });

    if (
      biggestReach &&
      biggestReach.overall <
        this.getExpectedOverallForRound(biggestReach.draft?.round ?? 7).min - 3
    ) {
      standouts.push({
        id: Math.random().toString(36).substr(2, 9),
        player: biggestReach,
        type: StandoutType.REACH,
        explanation: `Reached for need - ${biggestReach.overall} overall in round ${biggestReach.draft?.round ?? 0}`,
      });
    }

    // Find highest potential
    const highestPotential = picks.reduce((best, current) =>
      current.potential > best.potential ? current : best
    );

    if (highestPotential) {
      standouts.push({
        id: Math.random().toString(36).substr(2, 9),
        player: highestPotential,
        type: StandoutType.POTENTIAL,
        explanation: `High upside - ${highestPotential.potential} potential ceiling`,
      });
    }

    return standouts.slice(0, 3);
  }

  // ============================================================================
  // STEP 4: BLOCK ACTIONS
  // ============================================================================

  /**
   * Block all actions except week advancement
   */
  private blockAllActionsExceptAdvanceWeek(): void {
    this.state.canAdvanceWeek = false;
    console.log("🚫 All actions blocked except advance week");
  }

  // ============================================================================
  // STEP 5: SHOW SUMMARY
  // ============================================================================

  /**
   * Show mandatory summary screen
   */
  private showMandatorySummaryScreen(): void {
    this.state.showingSummaryScreen = true;
    console.log("📋 Mandatory summary screen triggered");
  }

  /**
   * Dismiss summary and enable week advancement
   */
  dismissSummaryAndEnableAdvancement(): void {
    this.state.showingSummaryScreen = false;
    this.state.canAdvanceWeek = true;
    console.log("✅ User can now advance week");
  }

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Get expected overall rating range for a draft round
   */
  private getExpectedOverallForRound(
    round: number
  ): { min: number; max: number } {
    const ranges: Record<number, { min: number; max: number }> = {
      1: { min: 80, max: 95 },
      2: { min: 75, max: 85 },
      3: { min: 70, max: 80 },
      4: { min: 65, max: 75 },
      5: { min: 60, max: 70 },
      6: { min: 55, max: 65 },
      7: { min: 50, max: 60 },
    };
    return ranges[round] ?? { min: 50, max: 60 };
  }

  /**
   * Analyze team's draft needs
   */
  private analyzeTeamNeeds(team: Team): Position[] {
    // Simplified - in real app would analyze roster
    const positions: Position[] = [Position.QB, Position.WR, Position.OL];
    return positions.sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 3) + 2);
  }

  /**
   * Calculate position-specific overall from attributes
   */
  private getPositionOverall(prospect: DraftProspect): number {
    const attrs = prospect.attributes;

    switch (prospect.position) {
      case "QB":
        return Math.round(
          (attrs.fieldVision +
            attrs.decisionMaking +
            attrs.competitiveness +
            attrs.awareness +
            attrs.hands) /
            5
        );
      case "RB":
        return Math.round(
          (attrs.speed +
            attrs.agility +
            attrs.carrying +
            attrs.hands +
            attrs.competitiveness) /
            5
        );
      case "WR":
        return Math.round(
          (attrs.speed +
            attrs.hands +
            attrs.fieldVision +
            attrs.agility +
            attrs.jumping) /
            5
        );
      default:
        return Math.round(
          (attrs.speed +
            attrs.strength +
            attrs.awareness +
            attrs.agility +
            attrs.competitiveness) /
            5
        );
    }
  }

  /**
   * Get current state
   */
  getState(): DraftCompletionState {
    return this.state;
  }
}

// ============================================================================
// STATE MANAGEMENT EXPORTS
// ============================================================================

/**
 * Initialize draft completion system
 */
export function initializeDraftCompletionSystem(): DraftCompletionManager {
  return new DraftCompletionManager();
}
