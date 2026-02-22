import { COLORS } from "./theme";
import { Section, DataRow, CategoryIcon } from "./components";
import type { GameStateManager, NewsHeadline } from "../types/GameStateManager";
import { PHASE_LABELS, getEnginePhaseForWeek } from "../types/engine-types";

export function LeagueNewsFeed({ gsm }: { gsm: GameStateManager }) {
  const headlines = gsm.recentHeadlines;

  return (
    <Section title="League News" pad={false}>
      <div style={{ maxHeight: 320, overflowY: "auto", scrollbarWidth: "thin" }}>
        {headlines.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: COLORS.muted, fontSize: 11, fontStyle: "italic" }}>
            No news to report yet.
          </div>
        ) : (
          headlines.map(h => (
            <NewsItem key={h.id} headline={h} />
          ))
        )}
      </div>
    </Section>
  );
}

function NewsItem({ headline }: { headline: NewsHeadline }) {
  const phase = getEnginePhaseForWeek(headline.timestamp.week);
  const phaseLabel = PHASE_LABELS[phase] || "Season";
  
  return (
    <DataRow hover={false} even={false}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "2px 0" }}>
        <div style={{ 
          marginTop: 3,
          color: getCategoryColor(headline.category),
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `${getCategoryColor(headline.category)}15`,
          width: 28, height: 28, borderRadius: 6, flexShrink: 0
        }}>
          <CategoryIcon category={headline.category} size={14} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.light }}>{headline.title}</span>
            <span style={{ fontSize: 9, color: COLORS.muted, fontFamily: "monospace" }}>
              Wk {headline.timestamp.week}
            </span>
          </div>
          <div style={{ fontSize: 10, color: COLORS.muted, lineHeight: 1.4 }}>
            {headline.body}
          </div>
        </div>
      </div>
    </DataRow>
  );
}

function getCategoryColor(cat: string): string {
  switch (cat) {
    case 'injury':      return COLORS.coral;
    case 'trade':       return COLORS.lime;
    case 'signing':     return COLORS.gold;
    case 'performance': return COLORS.sky;
    case 'rumors':      return "#d65db1";
    case 'standings':   return COLORS.light;
    default:            return COLORS.muted;
  }
}