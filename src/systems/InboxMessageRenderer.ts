/**
 * InboxMessageRenderer.ts
 *
 * Transforms narrative matrix JSON triggers into immersive, mechanically transparent inbox messages.
 * This system acts as a "narrative engine" that:
 * 1. Looks up trigger definitions from inbox-narrative-matrix.json
 * 2. Validates required variables are present
 * 3. Injects dynamic values into templates
 * 4. Applies archetype-specific flavor to narrative body
 * 5. Returns fully-formed InboxItem ready for UI rendering
 */

import { InboxItem } from '../types/GameStateManager';
import narrativeMatrixData from '../data/inbox-narrative-matrix.json';
import type { AgentArchetype } from './AgentPersonalitySystem';

// ============================================================================
// TYPES
// ============================================================================

export interface InboxMessageTrigger {
  triggerId: string;
  variables: Record<string, string | number>;
  archetype?: AgentArchetype | 'owner' | 'headcoach' | 'media' | 'league_office' | 'medical_staff' | 'competitor_gm';
  senderName?: string;
  linkedEntities?: {
    [displayName: string]: {
      type: 'player' | 'team';
      id: string;
    };
  };
}

export interface InboxMessageTemplate {
  triggerId: string;
  displayName: string;
  senderArchetype: string;
  senderPersonality: AgentArchetype[] | null;
  category: 'trade' | 'contract' | 'media' | 'league' | 'staff' | 'owner' | 'fan';
  requiresAction: boolean;
  subjectTemplate: string;
  narrativeBody: string;
  mechanicalTruth: string;
  requiredVariables: string[];
  actionRouting: string;
  actionButtons: Array<{ label: string; action: string }>;
}

interface NarrativeMatrixFile {
  inboxMessages: InboxMessageTemplate[];
  metadata: {
    version: string;
    description: string;
    instructions: string;
    architectureNotes: string;
  };
}

// ============================================================================
// ARCHETYPE FLAVOR SYSTEM
// ============================================================================

/**
 * Archetype-specific narrative modifiers
 * These get interpolated into the narrative body based on sender personality
 */
const ARCHETYPE_MODIFIERS: Record<string, { tone: string; phrase_prefix: string; phrase_suffix: string }> = {
  Shark: {
    tone: 'aggressive',
    phrase_prefix: 'Look, ',
    phrase_suffix: ' No sentiment here—just business.'
  },
  Uncle: {
    tone: 'mentoring',
    phrase_prefix: 'Listen, ',
    phrase_suffix: " I'm looking out for you because I believe in you."
  },
  BrandBuilder: {
    tone: 'professional',
    phrase_prefix: 'In terms of positioning, ',
    phrase_suffix: ' This elevates both our brands.'
  },
  SelfRepresented: {
    tone: 'direct',
    phrase_prefix: 'I gotta be honest—',
    phrase_suffix: ' That's the reality of the market.'
  }
};

// ============================================================================
// MAIN RENDERER
// ============================================================================

export class InboxMessageRenderer {
  private narrativeMatrix: NarrativeMatrixFile;

  constructor() {
    this.narrativeMatrix = narrativeMatrixData as NarrativeMatrixFile;
  }

  /**
   * Core method: Transform a trigger into a complete InboxItem
   * @throws Error if template not found or required variables missing
   */
  render(trigger: InboxMessageTrigger): InboxItem {
    const template = this.findTemplate(trigger.triggerId);

    // Validate required variables are present
    this.validateVariables(template, trigger.variables);

    // Resolve sender based on archetype
    const sender = this.resolveSender(template, trigger.archetype, trigger.senderName);

    // Inject variables into templates
    const subject = this.injectVariables(template.subjectTemplate, trigger.variables);
    const narrativeBody = this.applyArchetypeFlavor(
      this.injectVariables(template.narrativeBody, trigger.variables),
      trigger.archetype || template.senderArchetype
    );
    const mechanicalTruth = this.injectVariables(template.mechanicalTruth, trigger.variables);

    // Combine narrative body with mechanical truth
    const fullBody = this.assembleFinalBody(narrativeBody, mechanicalTruth);

    return {
      id: this.generateId(),
      subject,
      body: fullBody,
      sender,
      date: new Date(),
      category: template.category,
      isRead: false,
      requiresAction: template.requiresAction,
      linkedEntities: trigger.linkedEntities
    };
  }

  /**
   * Look up a template by triggerId
   */
  private findTemplate(triggerId: string): InboxMessageTemplate {
    const template = this.narrativeMatrix.inboxMessages.find(
      m => m.triggerId === triggerId
    );
    if (!template) {
      throw new Error(
        `[InboxMessageRenderer] Template not found: ${triggerId}\n` +
        `Available triggers: ${this.narrativeMatrix.inboxMessages.map(m => m.triggerId).join(', ')}`
      );
    }
    return template;
  }

  /**
   * Validate all required variables are provided
   */
  private validateVariables(
    template: InboxMessageTemplate,
    provided: Record<string, string | number>
  ): void {
    const missing = template.requiredVariables.filter(v => !(v in provided));
    if (missing.length > 0) {
      throw new Error(
        `[InboxMessageRenderer] Missing required variables for ${template.triggerId}:\n` +
        `Expected: ${template.requiredVariables.join(', ')}\n` +
        `Missing: ${missing.join(', ')}`
      );
    }
  }

  /**
   * Determine who is sending this message
   * Prefers explicit senderName, falls back to archetype default
   */
  private resolveSender(
    template: InboxMessageTemplate,
    archetype?: string,
    senderName?: string
  ): string {
    if (senderName) return senderName;

    const archetypeDefaults: Record<string, string> = {
      Shark: 'Agent (High Pressure)',
      Uncle: 'Agent (Mentor)',
      BrandBuilder: 'Agent (Brand Strategy)',
      SelfRepresented: 'Player (Self Rep)',
      owner: 'Team Ownership',
      headcoach: 'Head Coach',
      media: 'Sports Media',
      league_office: 'NFL Operations',
      medical_staff: 'Medical Staff',
      competitor_gm: 'Competing GM'
    };

    return archetypeDefaults[archetype || template.senderArchetype] || 'League Update';
  }

  /**
   * Inject variables into a template string
   * Replaces [VariableName] with the actual value
   */
  private injectVariables(
    template: string,
    variables: Record<string, string | number>
  ): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `[${key}]`;
      result = result.split(placeholder).join(String(value));
    }
    return result;
  }

  /**
   * Apply archetype-specific flavor to narrative body
   * Modulates tone and adds personality-specific phrasing
   */
  private applyArchetypeFlavor(
    narrativeBody: string,
    archetype: string
  ): string {
    const modifier = ARCHETYPE_MODIFIERS[archetype as AgentArchetype];
    if (!modifier) return narrativeBody;

    // Wrap opening and closing for tone
    // This is a simple approach; could be expanded for more sophisticated modulation
    return `${modifier.phrase_prefix}${narrativeBody} ${modifier.phrase_suffix}`;
  }

  /**
   * Assemble final body: narrative + mechanical truth section
   * The mechanical truth is clearly separated so it stands out
   */
  private assembleFinalBody(narrativeBody: string, mechanicalTruth: string): string {
    return (
      `${narrativeBody}\n\n` +
      `---\n\n` +
      `**System Analysis (Mechanical Truth):**\n` +
      `${mechanicalTruth}`
    );
  }

  /**
   * Generate a unique ID for the inbox message
   */
  private generateId(): string {
    return `inbox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// TRIGGER BUILDERS (Convenience methods for engine)
// ============================================================================

/**
 * Build a contract rejection trigger with common variables
 */
export function buildContractRejectionTrigger(
  playerFirstName: string,
  playerLastName: string,
  playerId: string,
  offeredGuarantee: number,
  marketGuarantee: number,
  position: string,
  archetype: AgentArchetype,
  additionalVars: Record<string, string | number> = {}
): InboxMessageTrigger {
  const percentageBelowMarket = Math.round(((marketGuarantee - offeredGuarantee) / marketGuarantee) * 100);
  const playerDisplayName = `${playerFirstName} ${playerLastName}`;

  return {
    triggerId: 'Contract_Rejected_Low_Guarantee',
    archetype,
    senderName: undefined,
    variables: {
      PlayerFirstName: playerFirstName,
      PlayerLastName: playerLastName,
      OfferedGuarantee: offeredGuarantee,
      MarketGuarantee: marketGuarantee,
      PercentageBelowMarket: percentageBelowMarket,
      GuaranteeWeeks: 52,
      ComparableWeeks: 78,
      Position: position,
      ...additionalVars
    },
    linkedEntities: {
      [playerDisplayName]: {
        type: 'player',
        id: playerId
      }
    }
  };
}

/**
 * Build a trade offer received trigger
 */
export function buildTradeOfferTrigger(
  offeringTeamName: string,
  offeringTeamId: string,
  senderGM: string,
  playerFirstName: string,
  playerLastName: string,
  playerId: string,
  offeringAssets: string,
  offeringValue: number,
  playerTradeValue: number,
  playerAge: number,
  playerCap: number,
  playerPosition: string,
  additionalVars: Record<string, string | number> = {}
): InboxMessageTrigger {
  const percentageOfValue = Math.round((offeringValue / playerTradeValue) * 100);
  const playerDisplayName = `${playerFirstName} ${playerLastName}`;

  return {
    triggerId: 'Trade_Offer_Received',
    senderName: `${senderGM} (${offeringTeamName} GM)`,
    variables: {
      OfferingTeamName: offeringTeamName,
      SenderGM: senderGM,
      PlayerFirstName: playerFirstName,
      PlayerLastName: playerLastName,
      OfferingAssets: offeringAssets,
      OfferingValue: offeringValue,
      PlayerTradeValue: playerTradeValue,
      PlayerAge: playerAge,
      PlayerCap: playerCap,
      PlayerPosition: playerPosition,
      PercentageOfValue: percentageOfValue,
      ReceiverCompensation: 'TBD',
      ...additionalVars
    },
    linkedEntities: {
      [playerDisplayName]: {
        type: 'player',
        id: playerId
      },
      [offeringTeamName]: {
        type: 'team',
        id: offeringTeamId
      }
    }
  };
}

/**
 * Build a cap mandate trigger (owner intervention)
 */
export function buildCapMandateTrigger(
  capOverage: number,
  totalCommitments: number,
  capCeiling: number,
  releaseOptionName: string,
  releaseOptionId: string,
  releaseCap: number,
  additionalVars: Record<string, string | number> = {}
): InboxMessageTrigger {
  const requiredRelief = capOverage;

  return {
    triggerId: 'Owner_Cap_Mandate_Immediate_Action',
    senderName: 'Team Ownership',
    variables: {
      CapOverage: capOverage,
      TotalCommitments: totalCommitments,
      CapCeiling: capCeiling,
      RequiredRelief: requiredRelief,
      ReleaseOptionName: releaseOptionName,
      ReleaseCap: releaseCap,
      RestructureOptionName: 'TBD',
      RestructureCap: 0,
      DeadCapPenalty: 0,
      DeadCapYear: 0,
      TradeValue: 0,
      ...additionalVars
    },
    linkedEntities: {
      [releaseOptionName]: {
        type: 'player',
        id: releaseOptionId
      }
    }
  };
}

export default InboxMessageRenderer;
