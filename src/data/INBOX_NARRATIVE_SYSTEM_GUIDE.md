# Inbox Narrative System Guide

## Overview

The Inbox Narrative System bridges the gap between **mechanical game state** and **immersive storytelling**. Instead of telling the player "Contract rejected," the system shows them:

1. **The Story** (narrative body): An agent explains their reasoning in character
2. **The Math** (mechanical truth): The exact mathematical boundary they failed to cross
3. **The Path Forward** (action routing): Clear buttons to revise, negotiate, or pivot strategy

This prevents the game from feeling arbitrary. Players don't wonder *why* things happen—they learn the precise rules through the natural friction of reading their inbox.

---

## Architecture

### Files

- **`src/data/inbox-narrative-matrix.json`** — Registry of all message types with templates
- **`src/systems/InboxMessageRenderer.ts`** — Transformation engine (variables → finished inbox item)
- **`src/types/GameStateManager.ts`** — Existing `addInboxMessage()` method (no changes needed)

### Data Flow

```
Engine detects condition
      ↓
Calls InboxMessageRenderer.render(trigger)
      ↓
Renderer looks up triggerId in JSON
      ↓
Validates required variables present
      ↓
Injects variables into templates
      ↓
Applies archetype flavor (if agent)
      ↓
Combines narrative + mechanical truth
      ↓
Returns fully-formed InboxItem
      ↓
Engine calls gsm.addInboxMessage(...)
      ↓
Message appears in UI
```

---

## How to Use It

### 1. From the Engine: Detect a Condition and Render

```typescript
import InboxMessageRenderer, { buildContractRejectionTrigger } from '../systems/InboxMessageRenderer';

// Somewhere in AgentPersonalitySystem or TradeSystem:
const renderer = new InboxMessageRenderer();

const trigger = buildContractRejectionTrigger(
  player.firstName,      // "Patrick"
  player.lastName,       // "Mahomes"
  75,                    // Offered guarantee in millions
  95,                    // Market guarantee in millions
  'QB',                  // Position
  agent.archetype        // 'Shark' | 'Uncle' | 'BrandBuilder' | 'SelfRepresented'
);

const inboxItem = renderer.render(trigger);
gsm.addInboxMessage(
  inboxItem.subject,
  inboxItem.body,
  inboxItem.sender,
  inboxItem.category,
  inboxItem.requiresAction
);
```

### 2. Add a New Message Type

#### Step 1: Add JSON template to `inbox-narrative-matrix.json`

```json
{
  "triggerId": "Free_Agent_Interest_Received",
  "displayName": "Free Agent Inquiry",
  "senderArchetype": "agent",
  "senderPersonality": ["Shark", "Uncle"],
  "category": "contract",
  "requiresAction": true,
  "subjectTemplate": "[PlayerFirstName] [PlayerLastName] - Free Agent Interest",
  "narrativeBody": "Multiple teams are showing interest in [PlayerFirstName] as we approach the open market. The [InterestLevel] level of interest suggests he'll command [ProjectedAAV]M AAV and around [ProjectedGuarantee]M guaranteed.",
  "mechanicalTruth": "Market Projection: Based on comp analysis and his profile (age [PlayerAge], [Position], overall [Overall]), scouts estimate he'll fetch $[ProjectedAAV]M in AAV with $[ProjectedGuarantee]M guaranteed (avg [GuaranteePercent]% guaranteed). Your current franchise tag number would be $[FranchiseTagValue]M. Decision point: franchise tag saves $[SavingsVsFreeMarket]M but signals non-commitment.",
  "requiredVariables": [
    "PlayerFirstName",
    "PlayerLastName",
    "InterestLevel",
    "ProjectedAAV",
    "ProjectedGuarantee",
    "PlayerAge",
    "Position",
    "Overall",
    "GuaranteePercent",
    "FranchiseTagValue",
    "SavingsVsFreeMarket"
  ],
  "actionRouting": "Route_To_Contract_Negotiation",
  "actionButtons": [
    { "label": "Offer Contract", "action": "onNavigate('contractNegotiation', {playerId})" },
    { "label": "Franchise Tag", "action": "handleFranchiseTag(playerId)" },
    { "label": "Let Walk", "action": "handleReleasePlayer(playerId)" }
  ]
}
```

#### Step 2: Create a trigger builder (optional but recommended)

```typescript
// In InboxMessageRenderer.ts, add:

export function buildFreeAgentInterestTrigger(
  playerFirstName: string,
  playerLastName: string,
  playerAge: number,
  position: string,
  overall: number,
  projectedAAV: number,
  franchiseTagValue: number,
  additionalVars: Record<string, string | number> = {}
): InboxMessageTrigger {
  const projectedGuarantee = Math.round(projectedAAV * 0.60); // 60% guaranteed average
  const savingsVsFreeMarket = franchiseTagValue - projectedAAV;

  return {
    triggerId: 'Free_Agent_Interest_Received',
    archetype: 'agent',
    variables: {
      PlayerFirstName: playerFirstName,
      PlayerLastName: playerLastName,
      InterestLevel: 'High',
      ProjectedAAV: projectedAAV,
      ProjectedGuarantee: projectedGuarantee,
      PlayerAge: playerAge,
      Position: position,
      Overall: overall,
      GuaranteePercent: 60,
      FranchiseTagValue: franchiseTagValue,
      SavingsVsFreeMarket: savingsVsFreeMarket,
      ...additionalVars
    }
  };
}
```

#### Step 3: Call it from your system

```typescript
// In RFATenderingScreen or wherever RFA logic lives:
import InboxMessageRenderer, { buildFreeAgentInterestTrigger } from '../systems/InboxMessageRenderer';

const renderer = new InboxMessageRenderer();
const trigger = buildFreeAgentInterestTrigger(
  player.firstName,
  player.lastName,
  calculatePlayerAge(player.birthYear),
  player.position,
  player.overall,
  calculateProjectedMarketValue(player),
  calculateFranchiseTagValue(player.position, player.overall)
);

const inboxItem = renderer.render(trigger);
gsm.addInboxMessage(
  inboxItem.subject,
  inboxItem.body,
  inboxItem.sender,
  inboxItem.category,
  inboxItem.requiresAction
);
```

---

## Message Template Reference

### Required Fields for Every Template

| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| `triggerId` | string | Unique identifier for this message type | `"Contract_Rejected_Low_Guarantee"` |
| `displayName` | string | Human-readable name (for debugging/admin) | `"Agent Rejects Offer - Low Guarantee"` |
| `senderArchetype` | string | Who is sending (`agent`, `owner`, `headcoach`, etc.) | `"agent"` |
| `senderPersonality` | AgentArchetype[] or null | Which personality types can send this | `["Shark", "Uncle"]` or `null` |
| `category` | string | Inbox category (filters UI) | `"contract"` |
| `requiresAction` | boolean | Does this block advance? | `true` |
| `subjectTemplate` | string | Email subject line with `[Variable]` placeholders | `"[PlayerFirstName] Offer Rejected"` |
| `narrativeBody` | string | In-universe roleplay text with `[Variable]` placeholders | `"I reviewed the offer and..."` |
| `mechanicalTruth` | string | The mathematical explanation with `[Variable]` placeholders | `"Offer: $[Amount]M vs Market: $[Market]M"` |
| `requiredVariables` | string[] | Exact list of variables the engine MUST provide | `["PlayerFirstName", "OfferedAmount"]` |
| `actionRouting` | string | Where to navigate (for future automation) | `"Route_To_Negotiation"` |
| `actionButtons` | object[] | Buttons shown in UI detail view | `[{ label: "Revise", action: "..." }]` |

### Sender Archetypes

**For Agents:**
- `Shark` — High pressure, no-nonsense, market-focused
- `Uncle` — Mentoring, relationship-focused, believes in you
- `BrandBuilder` — Professional, positioning-focused, image-conscious
- `SelfRepresented` — Direct, transparent, player-centric

**For Others:**
- `owner` — Blunt, financially focused
- `headcoach` — Strategically focused, team-first
- `media` — Sensationalist, public-facing
- `league_office` — Formal, rules-focused
- `medical_staff` — Clinical, timeline-focused
- `competitor_gm` — Business-like, competitive

---

## Variable Injection Rules

### Syntax

Variables are marked with square brackets: `[VariableName]`

```
Subject: "[PlayerFirstName] [PlayerLastName] - Offer Rejected"
Body:    "Your offer of $[OfferedGuarantee]M is [PercentageBelowMarket]% below market."
```

### Type Coercion

Numbers are automatically stringified. No manual conversion needed:

```typescript
variables: {
  OfferedGuarantee: 75,    // Will be replaced as "75"
  PlayerFirstName: "Patrick" // Will be replaced as "Patrick"
}
```

### Missing Variables

If a required variable is missing, the renderer throws an error with clear diagnostics:

```
[InboxMessageRenderer] Missing required variables for Contract_Rejected_Low_Guarantee:
Expected: PlayerFirstName, PlayerLastName, OfferedGuarantee, MarketGuarantee, ...
Missing: PercentageBelowMarket
```

---

## Mechanical Truth Section

This is the **core teaching element**. It separates from the narrative so the player can easily find the math.

### Structure

**Good Mechanical Truth:**
```
"Guarantee Analysis: You offered $[OfferedGuarantee]M, but [PlayerFirstName]'s market
baseline is $[MarketGuarantee]M ([PercentageBelowMarket]% below market). Your guarantee
covers [GuaranteeWeeks] weeks; comparable [Position] players are securing
[ComparableWeeks] weeks guaranteed."
```

**Why this works:**
1. **Specific numbers** — Not "too low," but "$75M vs. $95M"
2. **Comparison anchors** — "% below market" and "comparable players"
3. **Clear threshold** — Shows what would be acceptable
4. **Learning moment** — Player now knows the rule for next time

### Anti-Pattern: Vague Mechanical Truth

```
❌ "The market is competitive right now."
❌ "Other agents are asking for more."
❌ "We have other options."
```

These don't teach. Use specific numbers and formulas.

---

## Archetype Flavor System

The renderer applies personality-specific phrasing based on `senderArchetype`:

```typescript
// In InboxMessageRenderer.ts
const ARCHETYPE_MODIFIERS = {
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
  // ... etc
};
```

**Input:**
```
"I've reviewed your offer and it doesn't reflect his market value. We need to find common ground."
```

**Output (as Shark):**
```
"Look, I've reviewed your offer and it doesn't reflect his market value. We need to find common ground. No sentiment here—just business."
```

**Output (as Uncle):**
```
"Listen, I've reviewed your offer and it doesn't reflect his market value. We need to find common ground. I'm looking out for you because I believe in you."
```

This is a simple approach. More sophisticated modulation (sentiment analysis, synonym swapping) could be added.

---

## Action Routing & Buttons

Each message can include action buttons that guide the player to the right screen:

```json
"actionButtons": [
  { "label": "Revise Offer", "action": "onNavigate('contractNegotiation', {playerId})" },
  { "label": "Draft List", "action": "onNavigate('draftBoard', {})" }
]
```

These are hints for UI implementation. The InboxScreen can render these as buttons that call the actions.

---

## Extending the System

### Add a New Category

If you need a new sender type (e.g., "social media influencer"), add to `ARCHETYPE_MODIFIERS` and the `senderArchetype` union type:

```typescript
// In InboxMessageRenderer.ts
const ARCHETYPE_MODIFIERS: Record<string, { ... }> = {
  // ... existing
  Influencer: {
    tone: 'aspirational',
    phrase_prefix: 'Yo, ',
    phrase_suffix: ' Your brand is fire right now.'
  }
};

// In inbox-narrative-matrix.json
{
  "senderArchetype": "influencer",
  // ... rest of template
}
```

### Add Conditional Logic

For simple if/else logic, add conditional variables:

```json
"narrativeBody": "We've had [InterestCount] teams reach out. If you're serious about competing, you'll need to move quickly. [InterestCount] > 3 means 'multiple offers' language; add agent urgency."
```

For complex branching, create variant triggers:

```
Contract_Rejected_Low_Guarantee
Contract_Rejected_Short_Guarantee
Contract_Rejected_Insulting_APY  ← Branch on specific condition
```

---

## Integration Checklist

- [ ] Copy `inbox-narrative-matrix.json` to `src/data/`
- [ ] Copy `InboxMessageRenderer.ts` to `src/systems/`
- [ ] In your engine trigger point (e.g., `AgentPersonalitySystem.rejectContract()`):
  - [ ] Import `InboxMessageRenderer` and trigger builders
  - [ ] Create trigger object with required variables
  - [ ] Call `renderer.render(trigger)` to get InboxItem
  - [ ] Call `gsm.addInboxMessage(...)` with the result
- [ ] Test variable injection by intentionally omitting a variable → confirm error message
- [ ] Create 3–5 new message templates to practice extending the system
- [ ] Update `InboxScreen.tsx` to render action buttons from template

---

## Example: Full Integration

**Scenario:** A Shark agent rejects a contract offer because the guarantee is too low.

**Code:**

```typescript
// In AgentPersonalitySystem.ts, when evaluating contract:

import InboxMessageRenderer, { buildContractRejectionTrigger } from '../systems/InboxMessageRenderer';

const renderer = new InboxMessageRenderer();

const marketGuarantee = calculatePlayerMarketValue(player) * 0.65; // 65% guaranteed
const offeredGuarantee = contract.guaranteedMoney;

if (offeredGuarantee < marketGuarantee * 0.85) {  // Reject if < 85% of market
  const trigger = buildContractRejectionTrigger(
    player.firstName,
    player.lastName,
    offeredGuarantee,
    marketGuarantee,
    player.position,
    agent.archetype
  );

  const inboxItem = renderer.render(trigger);
  gsm.addInboxMessage(
    inboxItem.subject,
    inboxItem.body,
    inboxItem.sender,
    inboxItem.category,
    inboxItem.requiresAction
  );

  agent.awareness.push({
    type: 'contract_rejected',
    reason: 'low_guarantee',
    player: player.id
  });
}
```

**Result in Inbox:**

**Subject:** "RE: Patrick Mahomes - Offer Rejected"

**Body:**

> Look, I've reviewed your contract proposal for Patrick, and frankly, the guarantee structure doesn't reflect his market value. We've had interest from three other clubs willing to commit real money upfront. Until you can match the level of security he deserves, we can't move forward. No sentiment here—just business.
>
> ---
>
> **System Analysis (Mechanical Truth):**
> Guarantee Analysis: You offered $75M, but Patrick's market baseline is $95M (21% below market). Your guarantee covers 52 weeks of the contract, while comparable QB players are securing 78 weeks guaranteed.

**Buttons:**
- "Revise Offer"
- "Draft List"

---

## Future Enhancements

1. **Multi-language support** — Templates become keys; locale-specific strings loaded from separate files
2. **Conditional templates** — Same triggerId, different narratives based on team tier or difficulty
3. **Sentiment analysis** — Automatically modulate tone based on team morale or owner approval
4. **Branching narratives** — Player choice in one message triggers follow-up sequence
5. **Audio narration** — Mechanical truth section read aloud by AI voice (matches archetype tone)
6. **Analytics** — Track which messages cause players to take action vs. dismiss

---

## FAQ

**Q: Why separate narrative from mechanical truth?**
A: The narrative is emotional and contextual. The mechanical truth is the rule. By separating them, the player can choose: enjoy the story, OR focus on the math. Both pathways teach.

**Q: Can I use this for non-inbox messages (social media, radio, etc.)?**
A: Absolutely. The system is generic. Copy the JSON structure and renderer, rename them for your use case.

**Q: What if the math changes season-to-season?**
A: The template structure stays the same. Update `requiredVariables` to pass in new inputs (e.g., "CapInflationFactor2026"). The narrative and mechanical truth update accordingly.

**Q: How do I test this?**
A: Create a unit test that:
1. Creates a trigger with intentionally wrong variables
2. Confirms the renderer throws the expected error
3. Fixes the variables and confirms the render succeeds
4. Validates the output contains all injected values

Example test file: `src/systems/__tests__/InboxMessageRenderer.test.ts`

---

## Summary

This system transforms the inbox from a **dumb message log** into a **teaching engine**. Every rejection, offer, and demand comes with an explanation of the rule that triggered it. Over the course of a season, players internalize the cap mechanics, trade valuation formulas, and agent psychology through the natural friction of reading their email.

The game stops hiding behind randomness. The inbox becomes the **rulebook written as fiction**.
