import { COLORS } from "../ui/theme";
import { Section } from "../ui/components";
import { CategoryIcon } from "../ui/components";
import { useState } from "react";
import type { GameStateManager } from "../types/GameStateManager";

export function InboxScreen({ gsm, onNavigate, refresh, isMobile = false }: { gsm: GameStateManager; onNavigate: (s: string, d?: any) => void; refresh: () => void; isMobile?: boolean }) {
  const [sel, setSel] = useState<any>(null);

  const inbox = gsm.inbox;

  function handleClick(item: any) {
    setSel(item);
    if (item.category === 'trade' && item.requiresAction) {
      // Mark as read before navigating
      if (!item.isRead) {
        item.isRead = true;
      }
      // Open the dedicated review screen for trade offers
      onNavigate('tradeReview', { inboxId: item.id });
    }
  }

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: COLORS.light, marginBottom: 12 }}>Inbox</h2>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
        <Section pad={false}>
          {inbox.map((item: any) => (
            <div key={item.id} onClick={() => handleClick(item)} style={{ display: "flex", gap: 10, padding: "12px 14px", borderBottom: `1px solid rgba(116,0,86,0.4)`, cursor: "pointer", background: sel?.id === item.id ? "rgba(141,36,110,0.2)" : "transparent" }}>
              <div style={{ fontSize: 18 }}>
                <CategoryIcon category={item.category} size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.light }}>{item.subject}</div>
                <div style={{ fontSize: 10, color: COLORS.muted }}>{item.sender}</div>
              </div>
            </div>
          ))}
        </Section>

        <Section title={sel ? "Message" : "Select a message"}>
          {sel ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.light, marginBottom: 8 }}>{sel.subject}</div>
              <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.6 }}>{sel.body}</div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: 40, color: COLORS.muted, fontSize: 11 }}>Select a message</div>
          )}
        </Section>
      </div>
    </div>
  );
}
