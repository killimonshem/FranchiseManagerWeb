/**
 * AI Team Manager: Advanced AI Logic for Trades, Cuts, and Signings
 * Converted from Swift AITeamManager.swift
 * Handles AI-driven team decisions across all non-user teams
 */

import { Position } from "./nfl-types";
import { Player, PlayerStatus } from "./player";
import { Team } from "./team";

// ============================================================================
// TEAM STATE & CUT REASON ENUMS
// ============================================================================

export enum AITeamState {
  CONTENDER = "Contender",
  BUYER = "Buyer",
  SELLER = "Seller",
  REBUILDING = "Rebuilding",
  NEUTRAL = "Neutral",
}

export enum CutReason {
  CAP_CASUALTY = "Cap Casualty",
  ROSTER_TRIM = "Roster Cuts",
  PERFORMANCE = "Performance",
}

// ============================================================================
// TRADE RELATED MODELS
// ============================================================================

export interface TradePick {
  year: number;
  round: number;
  originalTeamId: string;
  currentTeamId?: string;
}

// ============================================================================
// HEADLINE & SOCIAL POST MODELS
// ============================================================================

export interface Headline {
  id: string;
  title: string;
  body: string;
  category: string; // "trade", "signing", "injury", etc.
  importance: string; // "low", "medium", "high"
  timestamp: Date;
}

export interface PostAuthor {
  name: string;
  handle: string;
  accountType: "insider" | "analyst" | "beat_reporter" | "fan";
  verified: boolean;
  avatar: string;
}

export interface SocialPost {
  id: string;
  author: PostAuthor;
  content: string;
  timestamp: Date;
  type: "news" | "rumor" | "analysis";
  archetype: "leak" | "speculation" | "official";
  likes: number;
  retweets: number;
  replies: number;
  heatScore: number; // 0-100
  relatedPlayerId?: string;
  relatedTeamId?: string;
}

// ============================================================================
// GAME STATE INTERFACE (MINIMAL)
// ============================================================================

export interface GameStateForAI {
  teams: Team[];
  allPlayers: Player[];
  freeAgents: Player[];
  draftPicks: TradePick[];
  userTeamId?: string;
  currentSeason: number;
  currentWeek: number;
  currentPhase: string; // "preseason", "regularSeason", "freeAgency", etc.
  leagueTradeBlock: Set<string>; // Player IDs on trade block

  // Methods
  addHeadline: (headline: Headline) => void;
  addSocialPost: (post: SocialPost) => void;
}

// ============================================================================
// AI TEAM MANAGER
// ============================================================================

/**
 * Advanced AI logic for all non-user teams
 * Manages trades, cuts, signings, and roster construction
 */
export class AITeamManager {
  private gameState: GameStateForAI;

  constructor(gameState: GameStateForAI) {
    this.gameState = gameState;
  }

  /**
   * Main simulation loop - process all AI team decisions
   */
  simulateAITeamDecisions(): void {
    // 1. Process trading (only during active trade window)
    if (this.isTradeWindowOpen()) {
      this.processAITradingBlock();
      this.manageLeagueTradeBlock();
    }

    // 2-4. Process each AI team
    for (const team of this.gameState.teams) {
      if (team.id === this.gameState.userTeamId) {
        continue; // Skip user team
      }

      // 2. Financial Compliance (must be under cap)
      this.manageCapCompliance(team);

      // 3. Roster Construction
      this.manageRosterComposition(team);

      // 4. Free Agency (if phase allows)
      if (
        this.gameState.currentPhase === "freeAgency" ||
        this.gameState.currentPhase === "regularSeason"
      ) {
        this.lookForUpgrades(team);
      }
    }
  }

  // ============================================================================
  // TRADE BLOCK MANAGEMENT
  // ============================================================================

  /**
   * Manage league-wide trade block
   * AI teams add/remove players based on franchise state
   */
  private manageLeagueTradeBlock(): void {
    // Run less frequently (10% chance per call)
    if (Math.random() > 0.1) {
      return;
    }

    for (const team of this.gameState.teams) {
      if (team.id === this.gameState.userTeamId) {
        continue;
      }

      const state = this.analyzeTeamState(team);
      const roster = this.gameState.allPlayers.filter((p) => p.teamId === team.id);

      // Rebuilders/sellers: Trade away veterans and expiring contracts
      if (state === AITeamState.REBUILDING || state === AITeamState.SELLER) {
        const sellCandidates = roster.filter((player) => {
          const isVet = player.age > 28 && player.overall > 75;
          const isExpiring =
            (player.contract?.yearsRemaining ?? 0) <= 1 && player.overall > 70;
          const isFranchisePlayer = player.overall >= 85; // Elite players keep

          return (isVet || isExpiring) && !isFranchisePlayer;
        });

        for (const player of sellCandidates) {
          if (!this.gameState.leagueTradeBlock.has(player.id)) {
            this.gameState.leagueTradeBlock.add(player.id);

            // Headline for big names
            if (player.overall > 85) {
              this.gameState.addHeadline({
                id: Math.random().toString(36).substr(2, 9),
                title: "Trade Block Update",
                body: `SOURCES: ${team.name} have made ${player.position} ${player.lastName} available for trade.`,
                category: "trade",
                importance: "medium",
                timestamp: new Date(),
              });
            }
          }
        }
      }
      // Contenders: Trade depth for picks
      else if (state === AITeamState.CONTENDER) {
        for (const pos of this.getAllPositions()) {
          const playersAtPos = roster
            .filter((p) => p.position === pos)
            .sort((a, b) => b.overall - a.overall);

          if (playersAtPos.length > 3) {
            const depthPlayer = playersAtPos[playersAtPos.length - 1];
            if (depthPlayer.overall > 65) {
              this.gameState.leagueTradeBlock.add(depthPlayer.id);
            }
          }
        }
      }
    }
  }

  /**
   * AI-to-AI trading system
   * Identify buyers and sellers, execute trades
   */
  private processAITradingBlock(): void {
    // Run less frequently (5% chance per call)
    if (Math.random() > 0.05) {
      return;
    }

    const nonUserTeams = this.gameState.teams.filter(
      (t) => t.id !== this.gameState.userTeamId
    );

    let buyers: Team[] = [];
    let sellers: Team[] = [];

    // 1. Identify Buyers and Sellers
    for (const team of nonUserTeams) {
      const state = this.analyzeTeamState(team);
      if (state === AITeamState.CONTENDER || state === AITeamState.BUYER) {
        buyers.push(team);
      } else if (
        state === AITeamState.REBUILDING ||
        state === AITeamState.SELLER
      ) {
        sellers.push(team);
      }
    }

    // 2. Sellers list players and attempt trades
    for (const seller of this.shuffle(sellers)) {
      const tradeBlock = this.gameState.allPlayers.filter(
        (p) =>
          p.teamId === seller.id &&
          p.age > 27 &&
          p.overall > 75 &&
          (p.contract?.yearsRemaining ?? 0) <= 2
      );

      for (const player of tradeBlock) {
        this.attemptToTradePlayer(player, seller, buyers);
      }
    }
  }

  /**
   * Attempt to trade a player from seller to buyers
   */
  private attemptToTradePlayer(
    player: Player,
    seller: Team,
    buyers: Team[]
  ): void {
    for (const buyer of this.shuffle(buyers)) {
      // Check if buyer needs this position
      if (this.hasNeed(player.position, buyer)) {
        // Check if buyer can afford (cap space)
        const capHit = player.contract?.currentYearCap ?? 0;
        if (buyer.capSpace > capHit) {
          // Execute trade
          this.executeBlockbusterTrade(player, seller, buyer);
          return; // Trade completed
        }
      }
    }
  }

  /**
   * Execute a trade between two AI teams
   */
  private executeBlockbusterTrade(
    player: Player,
    seller: Team,
    buyer: Team
  ): void {
    // 1. Calculate fair return (draft picks)
    const picksGiven: TradePick[] = [];
    const playerValue = this.calculatePlayerMarketValue(player);

    // Simple logic: higher value = higher pick
    if (playerValue > 25_000_000) {
      picksGiven.push({
        year: this.gameState.currentSeason + 1,
        round: 1,
        originalTeamId: buyer.id,
        currentTeamId: seller.id,
      });
    } else if (playerValue > 15_000_000) {
      picksGiven.push({
        year: this.gameState.currentSeason + 1,
        round: 2,
        originalTeamId: buyer.id,
        currentTeamId: seller.id,
      });
    } else {
      picksGiven.push({
        year: this.gameState.currentSeason + 1,
        round: 4,
        originalTeamId: buyer.id,
        currentTeamId: seller.id,
      });
    }

    // 2. Move Player
    const playerIndex = this.gameState.allPlayers.findIndex(
      (p) => p.id === player.id
    );
    if (playerIndex >= 0) {
      this.gameState.allPlayers[playerIndex].teamId = buyer.id;
    }

    // 3. Move Draft Picks
    for (const pick of picksGiven) {
      const pickIndex = this.gameState.draftPicks.findIndex(
        (p) =>
          p.year === pick.year &&
          p.round === pick.round &&
          p.originalTeamId === pick.originalTeamId
      );
      if (pickIndex >= 0) {
        this.gameState.draftPicks[pickIndex].currentTeamId = seller.id;
      }
    }

    // 4. Publish News
    const headline = `BLOCKBUSTER: ${buyer.name} acquire ${player.position} ${player.lastName} from ${seller.name} for draft picks.`;

    this.gameState.addHeadline({
      id: Math.random().toString(36).substr(2, 9),
      title: "Trade Alert",
      body: headline,
      category: "trade",
      importance: "high",
      timestamp: new Date(),
    });

    // 5. Add Social Post
    const socialPost: SocialPost = {
      id: Math.random().toString(36).substr(2, 9),
      author: {
        name: "Schefter",
        handle: "@AdamSchefter",
        accountType: "insider",
        verified: true,
        avatar: "insider_avatar",
      },
      content: `Sources: ${player.lastName} is headed to ${buyer.name}. ${seller.name} loading up on picks. #NFLTrades`,
      timestamp: new Date(),
      type: "news",
      archetype: "leak",
      likes: Math.floor(Math.random() * 49000) + 1000,
      retweets: Math.floor(Math.random() * 9500) + 500,
      replies: Math.floor(Math.random() * 4900) + 100,
      heatScore: 90,
      relatedPlayerId: player.id,
      relatedTeamId: buyer.id,
    };

    this.gameState.addSocialPost(socialPost);

    console.log(
      `✅ Trade: ${player.lastName} from ${seller.abbreviation} to ${buyer.abbreviation}`
    );
  }

  // ============================================================================
  // ROSTER & CAP MANAGEMENT (CUTS)
  // ============================================================================

  /**
   * Ensure team stays under salary cap
   * Cut players if over cap
   */
  private manageCapCompliance(team: Team): void {
    const roster = this.gameState.allPlayers.filter((p) => p.teamId === team.id);
    const currentCapUsage = roster.reduce(
      (sum, p) => sum + (p.contract?.currentYearCap ?? 0),
      0
    );

    if (currentCapUsage > team.salaryCap) {
      // Find cut candidates: high cap hit, low dead money, older/lower OVR
      const cutCandidates = roster
        .filter((player) => {
          const savings =
            (player.contract?.currentYearCap ?? 0) -
            (player.contract?.deadCap ?? 0);
          return savings > 1_000_000; // Must save at least 1M
        })
        .sort((p1, p2) => {
          // Sort by efficiency (OVR per Dollar) ascending - cut worst value
          const p1Cap = p1.contract?.currentYearCap ?? 0;
          const p2Cap = p2.contract?.currentYearCap ?? 0;
          const p1Val = p1Cap > 0 ? p1.overall / p1Cap : 0;
          const p2Val = p2Cap > 0 ? p2.overall / p2Cap : 0;
          return p1Val - p2Val;
        });

      if (cutCandidates.length > 0) {
        this.cutPlayer(cutCandidates[0], team, CutReason.CAP_CASUALTY);
      }
    }
  }

  /**
   * Manage roster composition (cuts and minimum roster requirements)
   */
  private manageRosterComposition(team: Team): void {
    const roster = this.gameState.allPlayers.filter((p) => p.teamId === team.id);

    // 1. Cut Logic (too many players)
    if (roster.length > 53) {
      // Regular season has 53 man roster
      const sortedRoster = roster.sort((a, b) => a.overall - b.overall); // Ascending (worst first)

      // Protect high potential rookies even if low OVR
      const toCut = sortedRoster.find(
        (p) => !(p.draft.year === this.gameState.currentSeason && p.potential > 70)
      );

      if (toCut) {
        this.cutPlayer(toCut, team, CutReason.ROSTER_TRIM);
      }
    }

    // 2. Sign Logic (too few players / position minimums)
    const minRosterRequirements: Record<Position, number> = {
      QB: 2,
      RB: 3,
      WR: 4,
      TE: 2,
      OL: 7,
      DL: 6,
      LB: 4,
      CB: 4,
      S: 2,
      K: 1,
      P: 1,
    };

    for (const [pos, minCount] of Object.entries(minRosterRequirements)) {
      const count = roster.filter((p) => p.position === (pos as Position)).length;
      if (count < minCount) {
        // Emergency sign
        const freeAgent = this.findBestFreeAgent(pos as Position, team.capSpace);
        if (freeAgent) {
          this.signPlayer(freeAgent, team);
        }
      }
    }
  }

  /**
   * Look for free agent upgrades in weak positions
   */
  private lookForUpgrades(team: Team): void {
    if (team.capSpace < 2_000_000) {
      return; // Not enough space
    }

    const roster = this.gameState.allPlayers.filter((p) => p.teamId === team.id);
    let weakestPos: Position | undefined;
    let lowestAvg = 100;

    // Find weakest position
    for (const pos of this.getAllPositions()) {
      const players = roster.filter((p) => p.position === pos);
      if (players.length === 0) {
        continue;
      }

      const avg =
        players.reduce((sum, p) => sum + p.overall, 0) / players.length;
      if (avg < lowestAvg) {
        lowestAvg = avg;
        weakestPos = pos;
      }
    }

    // Try to upgrade weakest position
    if (weakestPos) {
      const upgrade = this.findBestFreeAgent(weakestPos, team.capSpace);
      if (upgrade) {
        const currentBest = Math.max(
          0,
          ...roster
            .filter((p) => p.position === weakestPos)
            .map((p) => p.overall)
        );
        if (upgrade.overall > currentBest) {
          this.signPlayer(upgrade, team);
        }
      }
    }
  }

  // ============================================================================
  // PLAYER ACTIONS
  // ============================================================================

  /**
   * Cut a player from team to free agency
   */
  private cutPlayer(player: Player, team: Team, reason: CutReason): void {
    const playerIndex = this.gameState.allPlayers.findIndex(
      (p) => p.id === player.id
    );

    if (playerIndex >= 0) {
      this.gameState.allPlayers[playerIndex].teamId = undefined;
      this.gameState.allPlayers[playerIndex].status = PlayerStatus.FREE_AGENT;
      this.gameState.freeAgents.push(this.gameState.allPlayers[playerIndex]);

      // Notify user only for notable players
      if (player.overall > 80) {
        this.gameState.addHeadline({
          id: Math.random().toString(36).substr(2, 9),
          title: "Roster Move",
          body: `${team.name} released ${player.position} ${player.lastName}. (${reason})`,
          category: "signing",
          importance: "medium",
          timestamp: new Date(),
        });
      }

      console.log(
        `✂️ Cut: ${player.firstName} ${player.lastName} from ${team.abbreviation} (${reason})`
      );
    }
  }

  /**
   * Sign a free agent to a team
   */
  private signPlayer(player: Player, team: Team): void {
    const freeAgentIndex = this.gameState.freeAgents.findIndex(
      (p) => p.id === player.id
    );

    if (freeAgentIndex >= 0) {
      const signed = this.gameState.freeAgents.splice(freeAgentIndex, 1)[0];
      signed.teamId = team.id;
      signed.status = PlayerStatus.ACTIVE;

      // Give 1-year minimum deal for emergency signings
      signed.contract = {
        totalValue: 1_000_000,
        yearsRemaining: 1,
        guaranteedMoney: 0,
        currentYearCap: 1_000_000,
        signingBonus: 0,
        incentives: 0,
        canRestructure: false,
        canCut: true,
        deadCap: 0,
        hasNoTradeClause: false,
        approvedTradeDestinations: [],
      };

      this.gameState.allPlayers.push(signed);

      console.log(
        `✍️ Signed: ${player.firstName} ${player.lastName} to ${team.abbreviation}`
      );
    }
  }

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Check if trade window is open (before deadline Week 42)
   */
  private isTradeWindowOpen(): boolean {
    return this.gameState.currentWeek <= 42;
  }

  /**
   * Analyze team state to determine role (contender, rebuilder, etc)
   */
  private analyzeTeamState(team: Team): AITeamState {
    // Assuming 17-game season with ~8.5 average wins
    if (team.wins > 9) {
      return AITeamState.CONTENDER;
    }
    if (team.wins < 4 && this.gameState.currentWeek > 10) {
      return AITeamState.REBUILDING;
    }
    if (team.wins > 6) {
      return AITeamState.BUYER;
    }
    if (team.wins < 6) {
      return AITeamState.SELLER;
    }
    return AITeamState.NEUTRAL;
  }

  /**
   * Check if team needs a specific position
   */
  private hasNeed(position: Position, team: Team): boolean {
    const roster = this.gameState.allPlayers.filter(
      (p) => p.teamId === team.id && p.position === position
    );

    const minRequirements: Record<Position, number> = {
      QB: 2,
      RB: 3,
      WR: 4,
      TE: 2,
      OL: 7,
      DL: 6,
      LB: 4,
      CB: 4,
      S: 2,
      K: 1,
      P: 1,
    };

    const minRequired = minRequirements[position] ?? 0;

    // Need if below minimum
    if (roster.length < minRequired) {
      return true;
    }

    // Need if best starter is weak (<75 OVR)
    const bestOverall = Math.max(0, ...roster.map((p) => p.overall));
    if (bestOverall < 75) {
      return true;
    }

    return false;
  }

  /**
   * Find best available free agent at a position within budget
   */
  private findBestFreeAgent(position: Position, maxCost: number): Player | undefined {
    return this.gameState.freeAgents
      .filter(
        (p) =>
          p.position === position &&
          (this.calculatePlayerMarketValue(p) <= maxCost)
      )
      .sort((a, b) => b.overall - a.overall)[0];
  }

  /**
   * Calculate player's market value
   */
  private calculatePlayerMarketValue(player: Player): number {
    // Base: overall rating * 500k
    let value = player.overall * 500_000;

    // Age factor
    if (player.age < 25) {
      value *= 1.2; // Young players premium
    } else if (player.age > 32) {
      value *= 0.6; // Older players discount
    }

    // Contract remaining
    const yearsLeft = player.contract?.yearsRemaining ?? 0;
    if (yearsLeft <= 1) {
      value *= 0.7; // Expiring contracts less valuable
    }

    return value;
  }

  /**
   * Get all positions
   */
  private getAllPositions(): Position[] {
    return ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K", "P"];
  }

  /**
   * Fisher-Yates shuffle
   */
  private shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

// ============================================================================
// STATE MANAGEMENT EXPORTS
// ============================================================================

export interface AIManagerState {
  manager: AITeamManager;
  lastProcessedTick: number;
}

/**
 * Initialize AI Team Manager
 */
export function initializeAITeamManager(gameState: GameStateForAI): AITeamManager {
  return new AITeamManager(gameState);
}

/**
 * Process AI team decisions (call every game tick)
 */
export function processAIDecisions(manager: AITeamManager): void {
  manager.simulateAITeamDecisions();
}
