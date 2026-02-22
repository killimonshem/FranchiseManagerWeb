# Inbox Linked Entities Guide

## Overview

Transform static text player and team names into clickable links that navigate to profiles.

Instead of:
```
"Patrick Mahomes has agreed to a 3-year deal with the Kansas City Chiefs"
```

Get:
```
[Patrick Mahomes] has agreed to a 3-year deal with the [Kansas City Chiefs]
  (clickable links → player profile / team profile)
```

---

## How It Works

### Data Flow

```
Engine passes playerId/teamId in trigger
      ↓
Trigger builder creates linkedEntities map
      ↓
{
  "Patrick Mahomes": { type: "player", id: "player_123" },
  "Kansas City Chiefs": { type: "team", id: "team_456" }
}
      ↓
Renderer includes linkedEntities in InboxItem
      ↓
InboxMessageBody component renders body + identifies linked names
      ↓
Matching names become clickable spans with color/underline
      ↓
onClick → onNavigate('playerProfile', {playerId}) or ('teamProfile', {teamId})
```

---

## Implementation Steps

### 1. Update Trigger Builders (InboxMessageRenderer.ts)

**Before:**
```typescript
export function buildContractRejectionTrigger(
  playerFirstName: string,
  playerLastName: string,
  offeredGuarantee: number,
  // ...
): InboxMessageTrigger {
  return {
    triggerId: 'Contract_Rejected_Low_Guarantee',
    variables: { ... }
  };
}
```

**After:**
```typescript
export function buildContractRejectionTrigger(
  playerFirstName: string,
  playerLastName: string,
  playerId: string,  // ← ADD THIS
  offeredGuarantee: number,
  // ...
): InboxMessageTrigger {
  const playerDisplayName = `${playerFirstName} ${playerLastName}`;

  return {
    triggerId: 'Contract_Rejected_Low_Guarantee',
    variables: { ... },
    linkedEntities: {  // ← ADD THIS
      [playerDisplayName]: {
        type: 'player',
        id: playerId
      }
    }
  };
}
```

### 2. Update InboxItem Type (GameStateManager.ts)

```typescript
export interface InboxItem {
  // ... existing fields
  linkedEntities?: {
    [displayName: string]: {
      type: 'player' | 'team';
      id: string;
    };
  };
}
```

### 3. Update Renderer to Pass linkedEntities (InboxMessageRenderer.ts)

In the `render()` method:

```typescript
render(trigger: InboxMessageTrigger): InboxItem {
  // ... existing code

  return {
    id: this.generateId(),
    subject,
    body: fullBody,
    sender,
    date: new Date(),
    category: template.category,
    isRead: false,
    requiresAction: template.requiresAction,
    linkedEntities: trigger.linkedEntities  // ← ADD THIS
  };
}
```

### 4. Create InboxMessageBody Component

Already created: `src/ui/components/InboxMessageBody.tsx`

This component:
- Takes `body`, `linkedEntities`, and `onNavigate` callback
- Splits body by entity display names
- Renders matching names as clickable links (styled in accent/link color)
- Handles onClick to navigate to player/team profile

### 5. Update InboxScreen to Use Component

```typescript
import { InboxMessageBody } from "../ui/components/InboxMessageBody";

export function InboxScreen({ gsm, onNavigate, refresh, isMobile = false }) {
  const [sel, setSel] = useState<any>(null);

  return (
    // ...
    <Section title={sel ? "Message" : "Select a message"}>
      {sel ? (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.light, marginBottom: 8 }}>
            {sel.subject}
          </div>
          <InboxMessageBody
            body={sel.body}
            linkedEntities={sel.linkedEntities}
            onNavigate={onNavigate}
          />
        </>
      ) : (
        <div>Select a message</div>
      )}
    </Section>
  );
}
```

### 6. Wire Into Your Systems

**Example: AgentPersonalitySystem**

```typescript
import { buildContractRejectionTrigger } from '../systems/InboxMessageRenderer';

// When rejecting a contract:
const trigger = buildContractRejectionTrigger(
  player.firstName,
  player.lastName,
  player.id,  // ← PASS THE ID
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
```

---

## For Custom Triggers

If you're not using a pre-built trigger builder, manually create linkedEntities:

```typescript
const trigger = {
  triggerId: 'Custom_Message',
  archetype: 'media',
  variables: {
    PlayerName: `${player.firstName} ${player.lastName}`,
    TeamName: team.name,
    // ... other variables
  },
  linkedEntities: {
    [`${player.firstName} ${player.lastName}`]: {
      type: 'player',
      id: player.id
    },
    [team.name]: {
      type: 'team',
      id: team.id
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
```

---

## Design Details

### Display Name Matching

The component matches display names **exactly** as they appear in the body:

```
Message: "Patrick Mahomes has agreed..."
linkedEntities: {
  "Patrick Mahomes": { type: "player", id: "..." }
}
```

✅ "Patrick Mahomes" → matched and clickable

```
linkedEntities: {
  "patrick mahomes": { type: "player", id: "..." }  // lowercase
}
```

❌ "Patrick Mahomes" → NOT matched (case mismatch)

**Best Practice:** In your variables, use the exact capitalization:

```typescript
variables: {
  PlayerFirstName: player.firstName,  // "Patrick"
  PlayerLastName: player.lastName,    // "Mahomes"
}

linkedEntities: {
  [`${player.firstName} ${player.lastName}`]: {  // "Patrick Mahomes"
    type: 'player',
    id: player.id
  }
}
```

### Sorting by Length

The component sorts entity names by length (longest first) before matching:

```
linkedEntities: {
  "Kansas City Chiefs": { ... },
  "Chiefs": { ... }
}
```

Matching order:
1. "Kansas City Chiefs" (length 19)
2. "Chiefs" (length 6)

This prevents "Chiefs" from matching inside "Kansas City Chiefs".

### Styling

**Player names:** Accent color (usually pink/purple) with underline
**Team names:** Link color (usually blue) with underline

Both:
- Cursor changes to pointer on hover
- Slight opacity change (80%) on hover for feedback
- Font-weight: 600 (semibold)

---

## Special Cases

### Multiple Occurrences of Same Entity

```
Message: "Patrick Mahomes is a great QB. Patrick Mahomes should..."
linkedEntities: {
  "Patrick Mahomes": { type: "player", id: "..." }
}
```

All occurrences of "Patrick Mahomes" become clickable.

### Entity Name Appears Multiple Times in Different Contexts

```
linkedEntities: {
  "Patrick Mahomes": { type: "player", id: "player_123" },
  "Patrick Mahomes": { type: "team", id: "team_456" }  // ← Invalid: duplicate key!
}
```

This is **not possible** in JavaScript objects. If you have ambiguity (e.g., a person and a team with the same name), use a different display name in the message:

```
Message: "Patrick Mahomes (QB) and Patrick Mahomes (Team)..."
linkedEntities: {
  "Patrick Mahomes (QB)": { type: "player", id: "..." },
  "Patrick Mahomes (Team)": { type: "team", id: "..." }
}
```

### No linkedEntities Provided

If `linkedEntities` is undefined or empty, InboxMessageBody renders the body as plain text (no links).

---

## Extending to Other Entities

The system supports `type: 'player' | 'team'`. To add more entity types (coaches, staff, etc.):

1. Update `InboxItem` type:
```typescript
linkedEntities?: {
  [displayName: string]: {
    type: 'player' | 'team' | 'coach' | 'staff';  // ← ADD TYPES
    id: string;
  };
};
```

2. Update `InboxMessageBody` component:
```typescript
if (entity.type === 'player') {
  onNavigate('playerProfile', { playerId: entity.id });
} else if (entity.type === 'team') {
  onNavigate('teamProfile', { teamId: entity.id });
} else if (entity.type === 'coach') {  // ← NEW
  onNavigate('coachProfile', { coachId: entity.id });
}
```

---

## Testing Checklist

- [ ] Pass IDs to trigger builders
- [ ] linkedEntities included in trigger
- [ ] linkedEntities passed through to InboxItem
- [ ] InboxScreen imports and uses InboxMessageBody
- [ ] OnNavigate callback passed to InboxMessageBody
- [ ] Click a player name → navigates to playerProfile with correct playerId
- [ ] Click a team name → navigates to teamProfile with correct teamId
- [ ] Multiple entities in same message → all clickable
- [ ] No linkedEntities provided → falls back to plain text (no errors)
- [ ] Entity name with special characters (e.g., "D'Brickashaw") → matches correctly

---

## Common Mistakes

### ❌ Forgetting playerId in Trigger Builder Call

```typescript
const trigger = buildContractRejectionTrigger(
  player.firstName,
  player.lastName,
  // player.id is missing!
  offeredGuarantee,
  marketGuarantee,
  player.position,
  archetype
);
```

### ✅ Correct

```typescript
const trigger = buildContractRejectionTrigger(
  player.firstName,
  player.lastName,
  player.id,  // ← Include this
  offeredGuarantee,
  marketGuarantee,
  player.position,
  archetype
);
```

### ❌ Inconsistent Display Name

```typescript
variables: {
  PlayerFirstName: "patrick",  // lowercase
  PlayerLastName: "mahomes"    // lowercase
}

linkedEntities: {
  "Patrick Mahomes": { ... }  // Title case mismatch
}
```

### ✅ Correct

```typescript
variables: {
  PlayerFirstName: "Patrick",
  PlayerLastName: "Mahomes"
}

linkedEntities: {
  [`${player.firstName} ${player.lastName}`]: { ... }  // Auto-match
}
```

---

## Summary

1. **Pass IDs** to trigger builders
2. **Create linkedEntities** map in trigger
3. **Update types** to include linkedEntities
4. **Use InboxMessageBody** component to render with links
5. **Test** clicking on names and confirming navigation

Result: Inbox messages become interactive portals into player/team details, instead of read-only walls of text.
