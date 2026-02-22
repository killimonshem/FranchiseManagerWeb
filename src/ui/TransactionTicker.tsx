import { COLORS } from "./theme";
import { CategoryIcon } from "./components";
import type { GameStateManager } from "../types/GameStateManager";

export function TransactionTicker({ gsm }: { gsm: GameStateManager }) {
  // Show the 15 most recent headlines
  const headlines = gsm.recentHeadlines.slice(0, 15);

  if (headlines.length === 0) return null;

  return (
    <div className="ticker-bar" style={{
      position: "fixed",
      left: 0,
      right: 0,
      height: 28,
      background: "rgba(20, 5, 20, 0.95)",
      borderTop: `1px solid ${COLORS.darkMagenta}`,
      display: "flex",
      alignItems: "center",
      overflow: "hidden",
      whiteSpace: "nowrap",
      zIndex: 190, // Below mobile nav (200)
      pointerEvents: "none", // Allow clicks to pass through to underlying elements if needed
    }}>
      <style>{`
        .ticker-bar {
          bottom: 0;
        }
        /* On mobile, sit above the bottom nav (65px + safe area) */
        @media (max-width: 767px) {
          .ticker-bar {
            bottom: calc(65px + env(safe-area-inset-bottom));
          }
        }
        /* On desktop, shift right to avoid covering the sidebar */
        @media (min-width: 768px) {
          .ticker-bar {
            left: 240px;
          }
        }

        @keyframes ticker-scroll {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        
        .ticker-track {
          display: inline-flex;
          align-items: center;
          gap: 40px;
          padding-left: 100%; /* Start off-screen right */
          animation: ticker-scroll 60s linear infinite;
        }
        
        .ticker-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
      `}</style>
      
      <div className="ticker-track">
        {headlines.map(h => (
          <div key={h.id} className="ticker-item">
            <span style={{ 
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 16, height: 16, borderRadius: 4, 
              background: "rgba(255,255,255,0.1)" 
            }}>
              <CategoryIcon category={h.category} size={10} />
            </span>
            <span style={{ fontSize: 10, fontWeight: 800, color: COLORS.lime, letterSpacing: 0.5 }}>
              {h.title.toUpperCase()}
            </span>
            <span style={{ fontSize: 10, color: COLORS.light, fontWeight: 500 }}>
              {h.body}
            </span>
            <span style={{ fontSize: 10, color: COLORS.darkMagenta, marginLeft: 10 }}>///</span>
          </div>
        ))}
      </div>
    </div>
  );
}