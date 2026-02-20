import { COLORS, FONT, fmtCurrency } from "../ui/theme";
import { RatingBadge, PosTag, Section, StatBar, MoraleMeter, IconBtn, TabBtn } from "../ui/components";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { useState } from "react";

export function PlayerProfileScreen({ player, setScreen }: { player: any; setScreen: (s: string) => void }) {
  if (!player) return null;
  const [attrTab, setAttrTab] = useState("physical");

  const ATTRIBUTE_GROUPS: Record<string, any[]> = {
    physical: [
      { key: "spd", label: "Speed" },
      { key: "str", label: "Strength" },
      { key: "agi", label: "Agility" },
    ],
    mental: [
      { key: "aw", label: "Awareness" },
    ],
  };

  const attrValues: Record<string, number> = {
    spd: player.ovr > 90 ? 92 : 75,
    str: player.ovr > 80 ? 88 : 72,
    agi: player.ovr > 85 ? 90 : 78,
    aw: 85,
  };

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <button onClick={() => setScreen("roster")} style={{ background: "none", border: "none", color: COLORS.lime, fontSize: 11, cursor: "pointer", padding: 0, fontWeight: 600, marginBottom: 12 }}>
        <ArrowLeft size={14} style={{ marginRight: 4, display: "inline" }} /> Back to Roster
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Header */}
        <div style={{ gridColumn: "1/-1", background: `linear-gradient(135deg, ${COLORS.darkMagenta}, ${COLORS.bg})`, borderRadius: 12, padding: 22, border: `1px solid ${COLORS.magenta}`, display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
          <RatingBadge value={player.ovr} size="lg" />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: COLORS.light }}>#{player.jersey} {player.name}</h2>
              <PosTag pos={player.pos} />
              {player.pot > player.ovr && <TrendingUp size={14} color={COLORS.lime} title="Developing" />}
            </div>
            <div style={{ color: COLORS.muted, fontSize: 12 }}>Age {player.age}</div>
            <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 10, color: COLORS.muted }}>
              <span>Potential: <span style={{ color: COLORS.light, fontWeight: 700 }}>{player.pot}</span></span>
              <span>Morale: <span style={{ color: moraleColor(player.morale), fontWeight: 700 }}>{player.morale}</span></span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.lime, fontFamily: FONT.mono }}>{fmtCurrency(player.sal)}<span style={{ fontSize: 10, color: COLORS.muted, fontWeight: 400 }}>/yr</span></div>
            <div style={{ fontSize: 10, color: COLORS.muted }}>{player.yrs} years</div>
          </div>
        </div>

        {/* Attributes */}
        <Section title={`Attributes · ${attrTab.charAt(0).toUpperCase() + attrTab.slice(1)}`} right={
          <div style={{ display: "flex", gap: 4 }}>
            {Object.keys(ATTRIBUTE_GROUPS).map(g => <TabBtn key={g} active={attrTab === g} onClick={() => setAttrTab(g)}>{g}</TabBtn>)}
          </div>
        }>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ATTRIBUTE_GROUPS[attrTab]?.map(a => <StatBar key={a.key} label={a.label} value={attrValues[a.key] || 70} />)}
          </div>
        </Section>

        {/* Contract */}
        <Section title="Contract Details">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { l: "Annual Salary", v: fmtCurrency(player.sal) },
              { l: "Guaranteed", v: fmtCurrency(Math.floor(player.sal * 0.6)) },
              { l: "Cap Hit", v: fmtCurrency(Math.floor(player.sal * 0.85)) },
            ].map(d => (
              <div key={d.l} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(116,0,86,0.4)" }}>
                <span style={{ fontSize: 11, color: COLORS.muted }}>{d.l}</span>
                <span style={{ fontSize: 11, color: COLORS.light, fontWeight: 600, fontFamily: FONT.mono }}>{d.v}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function moraleColor(v: number): string {
  if (v > 80) return "#D7F171";
  if (v > 60) return "#F0EEF2";
  return "#8D246E";
}
