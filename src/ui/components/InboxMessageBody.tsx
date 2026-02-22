/**
 * InboxMessageBody.tsx
 *
 * Renders inbox message body with clickable player/team links.
 * Converts entity display names to links based on linkedEntities metadata.
 */

import React from 'react';
import { COLORS } from '../theme';

interface InboxMessageBodyProps {
  body: string;
  linkedEntities?: Record<
    string,
    {
      type: 'player' | 'team';
      id: string;
    }
  >;
  onNavigate?: (screen: string, data?: any) => void;
}

/**
 * Renders message body with clickable links for players/teams
 * Splits the body by linkedEntities and creates clickable spans
 */
export function InboxMessageBody({
  body,
  linkedEntities = {},
  onNavigate
}: InboxMessageBodyProps) {
  if (!onNavigate || Object.keys(linkedEntities).length === 0) {
    // If no callback or no entities, render as plain text with markdown formatting
    return <PlainTextBody text={body} />;
  }

  // Sort entity names by length (longest first) to avoid partial replacements
  const entities = Object.entries(linkedEntities).sort(
    (a, b) => b[0].length - a[0].length
  );

  // Build regex to match any entity name (case-sensitive)
  const entityNames = entities.map(([name]) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${entityNames})`, 'g');

  // Split body by entity matches
  const parts = body.split(regex);

  return (
    <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.6 }}>
      {parts.map((part, idx) => {
        // Check if this part is an entity
        const entity = linkedEntities[part];
        if (entity) {
          return (
            <span
              key={idx}
              onClick={() => {
                if (onNavigate) {
                  if (entity.type === 'player') {
                    onNavigate('playerProfile', { playerId: entity.id });
                  } else if (entity.type === 'team') {
                    onNavigate('teamProfile', { teamId: entity.id });
                  }
                }
              }}
              style={{
                color: entity.type === 'player' ? COLORS.accent : COLORS.link,
                textDecoration: 'underline',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              {part}
            </span>
          );
        }

        // Regular text (possibly with markdown formatting)
        return <TextWithMarkdown key={idx} text={part} />;
      })}
    </div>
  );
}

/**
 * Renders plain text body with markdown-style formatting
 */
function PlainTextBody({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
      {text}
    </div>
  );
}

/**
 * Renders text with basic markdown support (bold, code blocks)
 */
function TextWithMarkdown({ text }: { text: string }) {
  // Handle **bold** → bold
  const parts = text.split(/(\*\*[^*]+\*\*)/);

  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <span key={idx} style={{ fontWeight: 700 }}>
              {part.slice(2, -2)}
            </span>
          );
        }
        return part;
      })}
    </>
  );
}

export default InboxMessageBody;
