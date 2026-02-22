/**
 * InboxIntegrationExample.ts
 *
 * Practical examples of how to integrate the Inbox Narrative System into
 * existing game engine systems (AgentPersonalitySystem, TradeSystem, etc.)
 *
 * Copy-paste these patterns into your actual systems.
 */

import type { GameStateManager } from '../types/GameStateManager';
import type { Player } from '../types/player';
import type { Team } from '../types/team';
import InboxMessageRenderer, {
  buildContractRejectionTrigger,
  buildTradeOfferTrigger,
  buildCapMandateTrigger
} from './InboxMessageRenderer';
import type { AgentArchetype } from './AgentPersonalitySystem';

// ============================================================================
// EXAMPLE 1: Agent Rejects Contract (AgentPersonalitySystem context)
// ============================================================================

/**
 * Scenario: Player's agent rejects a contract offer because the guarantee is too low.
 * This should be called in AgentPersonalitySystem.evaluateOffer() or similar.
 *
 * LOCATION: src/systems/AgentPersonalitySystem.ts
 */
export function exampleAgentRejectsContract(
  gsm: GameStateManager,
  player: Player,
  agentArchetype: AgentArchetype,
  offeredGuarantee: number
): void {
  const renderer = new InboxMessageRenderer();

  // Calculate market baseline (you'd have this in calculatePlayerMarketValue)
  const marketGuarantee = 95; // Simplified; use real calculation
  const percentageBelowMarket = Math.round(
    ((marketGuarantee - offeredGuarantee) / marketGuarantee) * 100
  );

  // Build the trigger
  const trigger = buildContractRejectionTrigger(
    player.firstName,
    player.lastName,
    offeredGuarantee,
    marketGuarantee,
    player.position,
    agentArchetype,
    {
      GuaranteeWeeks: 52,
      ComparableWeeks: 78
    }
  );

  // Render into an inbox item
  const inboxItem = renderer.render(trigger);

  // Add to game state
  gsm.addInboxMessage(
    inboxItem.subject,
    inboxItem.body,
    inboxItem.sender,
    inboxItem.category,
    inboxItem.requiresAction
  );

  console.log(`[Agent] ${agentArchetype} rejected offer for ${player.firstName} ${player.lastName}`);
}

// ============================================================================
// EXAMPLE 2: Incoming Trade Offer (TradeSystem context)
// ============================================================================

/**
 * Scenario: Another GM offers a trade for one of your players.
 * This should be called in TradeSystem.receiveTradeOffer() or similar.
 *
 * LOCATION: src/systems/TradeSystem.ts
 */
export function exampleReceiveTradeOffer(
  gsm: GameStateManager,
  offeringTeam: Team,
  offeringGMName: string,
  targetPlayer: Player,
  offeredPlayerNames: string[],
  offeredTradeValue: number,
  playerMarketValue: number
): void {
  const renderer = new InboxMessageRenderer();

  const percentageOfValue = Math.round((offeredTradeValue / playerMarketValue) * 100);

  const trigger = buildTradeOfferTrigger(
    offeringTeam.name,
    offeringGMName,
    targetPlayer.firstName,
    targetPlayer.lastName,
    offeredPlayerNames.join(', '),
    offeredTradeValue,
    playerMarketValue,
    25, // Simplified player age
    targetPlayer.capHit,
    targetPlayer.position,
    {
      ReceiverCompensation: `${offeredPlayerNames.join(', ')}`
    }
  );

  const inboxItem = renderer.render(trigger);

  gsm.addInboxMessage(
    inboxItem.subject,
    inboxItem.body,
    inboxItem.sender,
    inboxItem.category,
    inboxItem.requiresAction
  );

  console.log(`[Trade] Received offer from ${offeringTeam.name} for ${targetPlayer.firstName}`);
}

// ============================================================================
// EXAMPLE 3: Owner Cap Mandate (FinanceSystem context)
// ============================================================================

/**
 * Scenario: You're over the cap and ownership demands immediate action.
 * This is a hard stop that blocks advance() until resolved.
 *
 * LOCATION: src/systems/FinanceSystem.ts or GameStateManager.ts
 */
export function exampleOwnerCapMandate(
  gsm: GameStateManager,
  capOverage: number,
  totalCommitments: number,
  capCeiling: number,
  releasablePlayer: Player
): void {
  const renderer = new InboxMessageRenderer();

  const trigger = buildCapMandateTrigger(
    capOverage,
    totalCommitments,
    capCeiling,
    `${releasablePlayer.firstName} ${releasablePlayer.lastName}`,
    releasablePlayer.capHit,
    {
      RestructureOptionName: 'Senior Veteran Contract',
      RestructureCap: 2.5,
      DeadCapPenalty: 1.2,
      DeadCapYear: 2,
      TradeValue: 1.8
    }
  );

  const inboxItem = renderer.render(trigger);

  gsm.addInboxMessage(
    inboxItem.subject,
    inboxItem.body,
    inboxItem.sender,
    inboxItem.category,
    true // This REQUIRES action and should block advance
  );

  console.log(`[Ownership] Cap mandate issued: ${capOverage}M over the ceiling`);
}

// ============================================================================
// EXAMPLE 4: Coach Demands Trade (AITeamManager context)
// ============================================================================

/**
 * Scenario: Your head coach demands a position upgrade before trade deadline.
 * This is a soft stop (just creates message, doesn't block).
 *
 * LOCATION: src/systems/AITeamManager.ts or similar
 */
export function exampleCoachTradeRequest(
  gsm: GameStateManager,
  position: string,
  unitRating: number,
  leagueRank: number,
  competitorRating: number,
  availableCapSpace: number,
  marketCost: number
): void {
  const renderer = new InboxMessageRenderer();

  // This doesn't have a pre-built trigger, so construct manually
  const trigger = {
    triggerId: 'Head_Coach_Demands_Upgrade' as const,
    archetype: 'headcoach' as const,
    senderName: 'Head Coach',
    variables: {
      Position: position,
      CapabilityAssessment: 'severely undersized',
      UnitRating: unitRating,
      LeagueRank: leagueRank,
      CompetitorRating: competitorRating,
      TargetGrade: 'A-',
      AvailableCapSpace: availableCapSpace,
      MarketCost: marketCost
    }
  };

  const inboxItem = renderer.render(trigger);

  gsm.addInboxMessage(
    inboxItem.subject,
    inboxItem.body,
    inboxItem.sender,
    inboxItem.category,
    false // Coach request is soft stop, doesn't require immediate action
  );

  console.log(`[Coach] Demanding upgrade at ${position}`);
}

// ============================================================================
// EXAMPLE 5: Roster Violation (GameStateManager context)
// ============================================================================

/**
 * Scenario: You're over the 54-man active roster limit.
 * This is a compliance hard stop that blocks advance.
 *
 * LOCATION: src/types/GameStateManager.ts
 */
export function exampleRosterViolation(
  gsm: GameStateManager,
  activeRosterCount: number,
  rosterLimit: number,
  releasablePlayers: Player[]
): void {
  const renderer = new InboxMessageRenderer();

  const excess = activeRosterCount - rosterLimit;

  const trigger = {
    triggerId: 'Roster_Violation_Too_Many_Players' as const,
    archetype: 'league_office' as const,
    senderName: 'NFL Operations',
    variables: {
      ActiveRosterCount: activeRosterCount,
      RosterLimit: rosterLimit,
      PlayersToRelease: excess,
      Excess: excess,
      CheapestRelease: releasablePlayers.slice(0, 3).map(p => `${p.firstName} ${p.lastName}`).join(', '),
      ReleaseSalaryTotal: releasablePlayers
        .slice(0, excess)
        .reduce((sum, p) => sum + (p.salary / 1_000_000), 0),
      PlayerCountToPracticeSquad: 2,
      PSTransitionSavings: 0.8,
      TradeCount: 1,
      ComplianceDeadline: 'end of business tomorrow'
    }
  };

  const inboxItem = renderer.render(trigger);

  gsm.addInboxMessage(
    inboxItem.subject,
    inboxItem.body,
    inboxItem.sender,
    inboxItem.category,
    true // REQUIRED action - blocks advance
  );

  console.log(`[League] Roster violation: ${excess} players over limit`);
}

// ============================================================================
// EXAMPLE 6: Rival Free Agent Signing (Media alert)
// ============================================================================

/**
 * Scenario: A free agent you were targeting signed with a rival team.
 * This is informational (no action required) but teaches market baselines.
 *
 * LOCATION: Could be in free agency system or AI team manager
 */
export function exampleRivalFreeAgentSigning(
  gsm: GameStateManager,
  playerFirstName: string,
  playerLastName: string,
  position: string,
  rivalTeam: Team,
  contractLength: number,
  totalValue: number,
  guaranteedValue: number,
  yourOffer: number,
  yourGuarantee: number
): void {
  const renderer = new InboxMessageRenderer();

  const aav = totalValue / contractLength;
  const guaranteePercent = Math.round((guaranteedValue / totalValue) * 100);
  const yourAAV = yourOffer;
  const yourGuaranteePercent = Math.round((yourGuarantee / yourOffer) * 100);

  const trigger = {
    triggerId: 'Free_Agency_Rival_Signing' as const,
    archetype: 'media' as const,
    senderName: 'Sports Media',
    variables: {
      PlayerName: `${playerFirstName} ${playerLastName}`,
      RivalTeamName: rivalTeam.name,
      ContractLength: contractLength,
      TotalValue: totalValue,
      GuaranteedValue: guaranteedValue,
      Position: position,
      AAV: aav,
      GuaranteePercent: guaranteePercent,
      YourOffer: yourAAV,
      YourGuaranteePercent: yourGuaranteePercent,
      Gap: Math.round(aav - yourAAV),
      GuaranteeGap: guaranteePercent - yourGuaranteePercent,
      NewBaseline: Math.round(aav),
      NewGuaranteeBaseline: guaranteePercent
    }
  };

  const inboxItem = renderer.render(trigger);

  gsm.addInboxMessage(
    inboxItem.subject,
    inboxItem.body,
    inboxItem.sender,
    inboxItem.category,
    false // Informational, no action required
  );

  console.log(`[Media] ${playerFirstName} signed with ${rivalTeam.name}`);
}

// ============================================================================
// EXAMPLE 7: Injury Report (Medical)
// ============================================================================

/**
 * Scenario: A key player gets injured during a game.
 * This requires roster action (IR, call up backup).
 *
 * LOCATION: Game simulation, injury system
 */
export function exampleInjuryReport(
  gsm: GameStateManager,
  injuredPlayer: Player,
  injuryType: string,
  severityGrade: 'A' | 'B' | 'C' | 'D',
  weeksOut: number,
  backup: Player | null
): void {
  const renderer = new InboxMessageRenderer();

  const worstCaseWeeks = Math.ceil(weeksOut * 1.5);

  const trigger = {
    triggerId: 'Injury_Report_Star_Player' as const,
    archetype: 'medical_staff' as const,
    senderName: 'Medical Staff',
    variables: {
      PlayerName: `${injuredPlayer.firstName} ${injuredPlayer.lastName}`,
      InjuryType: injuryType,
      InitialStatus: severityGrade === 'A' ? 'Questionable' : severityGrade === 'B' ? 'Doubtful' : 'Out',
      SeverityGrade: severityGrade,
      WeeksOut: weeksOut,
      WorstCaseWeeks: worstCaseWeeks,
      PlayerCap: injuredPlayer.capHit,
      BackupName: backup ? `${backup.firstName} ${backup.lastName}` : 'None available',
      BackupCap: backup ? backup.capHit : 0,
      FAMaxSalary: 1.2 // Simplified
    }
  };

  const inboxItem = renderer.render(trigger);

  gsm.addInboxMessage(
    inboxItem.subject,
    inboxItem.body,
    inboxItem.sender,
    inboxItem.category,
    true // Requires immediate roster action
  );

  console.log(`[Medical] ${injuredPlayer.firstName} injured: ${injuryType}`);
}

// ============================================================================
// INTEGRATION CHECKLIST FOR YOUR CODE
// ============================================================================

/**
 * Copy these into your actual systems:
 *
 * 1. AgentPersonalitySystem.ts
 *    - evaluateOffer() → calls exampleAgentRejectsContract()
 *    - evaluateContractStructure() → calls exampleAgentRejectsContract()
 *
 * 2. TradeSystem.ts
 *    - receiveTradeOffer() → calls exampleReceiveTradeOffer()
 *
 * 3. FinanceSystem.ts
 *    - validateCapCompliance() → calls exampleOwnerCapMandate() if over
 *
 * 4. GameStateManager.ts
 *    - _processEngineTimeSlot() → calls exampleRosterViolation() if roster > 54
 *    - advance() → calls exampleRivalFreeAgentSigning() on FA day
 *
 * 5. GameSimulation.ts (or wherever injuries happen)
 *    - applyGameResult() → calls exampleInjuryReport() on injury
 *
 * 6. AITeamManager.ts
 *    - evaluateRosters() → calls exampleCoachTradeRequest() near deadline
 */

export default {
  exampleAgentRejectsContract,
  exampleReceiveTradeOffer,
  exampleOwnerCapMandate,
  exampleCoachTradeRequest,
  exampleRosterViolation,
  exampleRivalFreeAgentSigning,
  exampleInjuryReport
};
