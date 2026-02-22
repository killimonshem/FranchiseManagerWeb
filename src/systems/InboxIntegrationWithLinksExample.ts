/**
 * InboxIntegrationWithLinksExample.ts
 *
 * Updated examples showing how to pass player/team IDs to create clickable links in inbox messages.
 *
 * The key difference: include playerId and teamId in the trigger builder calls.
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
// EXAMPLE 1: Contract Rejection with Clickable Player Link
// ============================================================================

/**
 * When an agent rejects a contract, include the player ID so the user can click
 * the player name in the inbox and jump to their profile.
 */
export function exampleContractRejectionWithLink(
  gsm: GameStateManager,
  player: Player,
  agentArchetype: AgentArchetype,
  offeredGuarantee: number
): void {
  const renderer = new InboxMessageRenderer();

  const marketGuarantee = 95;

  // NEW: Pass playerId as 3rd parameter
  const trigger = buildContractRejectionTrigger(
    player.firstName,
    player.lastName,
    player.id,  // ← NEW: Player ID for clickable link
    offeredGuarantee,
    marketGuarantee,
    player.position,
    agentArchetype
  );

  const inboxItem = renderer.render(trigger);

  gsm.addInboxMessage(
    inboxItem.subject,
    inboxItem.body,
    inboxItem.sender,
    inboxItem.category,
    inboxItem.requiresAction
  );

  console.log(`[Agent] ${player.firstName} ${player.lastName}'s name is now clickable in the inbox`);
}

// ============================================================================
// EXAMPLE 2: Trade Offer with Clickable Player & Team Links
// ============================================================================

/**
 * When receiving a trade offer, include both the target player ID and offering team ID.
 * Now clicking either name in the inbox will navigate to that entity's profile.
 */
export function exampleTradeOfferWithLinks(
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

  // NEW: Pass playerId and teamId
  const trigger = buildTradeOfferTrigger(
    offeringTeam.name,
    offeringTeam.id,  // ← NEW: Team ID for clickable link
    offeringGMName,
    targetPlayer.firstName,
    targetPlayer.lastName,
    targetPlayer.id,  // ← NEW: Player ID for clickable link
    offeredPlayerNames.join(', '),
    offeredTradeValue,
    playerMarketValue,
    25,
    targetPlayer.capHit,
    targetPlayer.position
  );

  const inboxItem = renderer.render(trigger);

  gsm.addInboxMessage(
    inboxItem.subject,
    inboxItem.body,
    inboxItem.sender,
    inboxItem.category,
    inboxItem.requiresAction
  );

  console.log(`[Trade] ${offeringTeam.name} and ${targetPlayer.firstName} names are now clickable`);
}

// ============================================================================
// EXAMPLE 3: Manual Trigger Construction with Linked Entities
// ============================================================================

/**
 * For custom triggers not covered by the builder functions,
 * manually construct the trigger with linkedEntities.
 */
export function exampleManualLinkedEntitiesTrigger(
  gsm: GameStateManager,
  player: Player,
  rivalTeam: Team
): void {
  const renderer = new InboxMessageRenderer();

  const trigger = {
    triggerId: 'Free_Agency_Rival_Signing',
    archetype: 'media' as const,
    senderName: 'Sports Media',
    variables: {
      PlayerName: `${player.firstName} ${player.lastName}`,
      RivalTeamName: rivalTeam.name,
      ContractLength: 3,
      TotalValue: 45,
      GuaranteedValue: 27,
      Position: player.position,
      AAV: 15,
      GuaranteePercent: 60,
      YourOffer: 12,
      YourGuaranteePercent: 50,
      Gap: 3,
      GuaranteeGap: 10,
      NewBaseline: 15,
      NewGuaranteeBaseline: 60
    },
    // ← NEW: Add linkedEntities mapping display names to IDs
    linkedEntities: {
      [`${player.firstName} ${player.lastName}`]: {
        type: 'player',
        id: player.id
      },
      [rivalTeam.name]: {
        type: 'team',
        id: rivalTeam.id
      }
    }
  };

  const inboxItem = renderer.render(trigger);

  gsm.addInboxMessage(
    inboxItem.subject,
    inboxItem.body,
    inboxItem.sender,
    inboxItem.category,
    inboxItem.requiresAction
  );

  console.log(`[Free Agency] ${player.firstName} and ${rivalTeam.name} are now clickable`);
}

// ============================================================================
// INTEGRATION CHECKLIST
// ============================================================================

/**
 * To implement clickable links in your inbox:
 *
 * STEP 1: Update trigger builders to accept IDs
 *   - buildContractRejectionTrigger(playerFirstName, playerLastName, playerId, ...)
 *   - buildTradeOfferTrigger(offeringTeamName, offeringTeamId, ..., targetPlayer, playerId, ...)
 *   - buildCapMandateTrigger(...) - add as needed
 *
 * STEP 2: Add linkedEntities to trigger in builders
 *   linkedEntities: {
 *     [displayName]: {
 *       type: 'player' | 'team',
 *       id: entityId
 *     }
 *   }
 *
 * STEP 3: Update InboxItem type to include linkedEntities field
 *   linkedEntities?: Record<string, { type: 'player' | 'team'; id: string }>;
 *
 * STEP 4: Create InboxMessageBody component
 *   - Renders body with clickable links for named entities
 *   - Calls onNavigate('playerProfile', {playerId}) or onNavigate('teamProfile', {teamId})
 *
 * STEP 5: Update InboxScreen
 *   - Import InboxMessageBody
 *   - Replace plain body div with <InboxMessageBody ... />
 *   - Pass linkedEntities and onNavigate callback
 *
 * STEP 6: Wire into your systems
 *   - AgentPersonalitySystem → exampleContractRejectionWithLink()
 *   - TradeSystem → exampleTradeOfferWithLinks()
 *   - Any trigger → exampleManualLinkedEntitiesTrigger()
 */

export default {
  exampleContractRejectionWithLink,
  exampleTradeOfferWithLinks,
  exampleManualLinkedEntitiesTrigger
};
