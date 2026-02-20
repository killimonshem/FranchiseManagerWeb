import { COLORS, FONT, fmtCurrency } from "../ui/theme";
import { RatingBadge, PosTag, Section, StatBar, MoraleMeter, IconBtn, TabBtn } from "../ui/components";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Player } from "../types/player";

export function PlayerProfileScreen({ player, setScreen }: { player: Player | null; setScreen: (s: string) => void }) {
  if (!player) return null;
  const [attrTab, setAttrTab] = useState("physical");

  // Derive clean values from actual Player interface
  const fullName = `${player.firstName} ${player.lastName}`;
  const jersey   = player.jerseyNumber;
  const pos      = player.position;
  const ovr      = player.overall;
  const pot      = player.potential;
  const sal      = player.contract?.currentYearCap ?? 0;
  const yrs      = player.contract?.yearsRemaining ?? 0;
  const morale   = player.morale ?? 50;

  const ATTRIBUTE_GROUPS: Record<string, { key: string; label: string }[]> = {
    physical: [
      { key: "spd", label: "Speed" },
      { key: "str", label: "Strength" },
      { key: "agi", label: "Agility" },
    ],
    mental: [
      { key: "aw", label: "Awareness" },
    ],
  };

  // Derive rough attribute values from overall (placeholder until real attrs are wired)
  const attrValues: Record<string, number> = {
    spd: ovr > 90 ? 92 : ovr > 80 ? 84 : 75,
    str: ovr > 80 ? 88 : 72,
    agi: ovr > 85 ? 90 : 78,
    aw:  Math.min(99, Math.round(ovr * 0.9)),
  };

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <button onClick={() => setScreen("roster")} style={{ background: "none", border: "none", color: COLORS.lime, fontSize: 11, cursor: "pointer", padding: 0, fontWeight: 600, marginBottom: 12 }}>
        <ArrowLeft size={14} style={{ marginRight: 4, display: "inline" }} /> Back to Roster
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Header */}
        <div style={{ gridColumn: "1/-1", background: `linear-gradient(135deg, ${COLORS.darkMagenta}, ${COLORS.bg})`, borderRadius: 12, padding: 22, border: `1px solid ${COLORS.magenta}`, display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
          <RatingBadge value={ovr} size="lg" />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: COLORS.light }}>
                {jersey != null ? `#${jersey} ` : ""}{fullName}
              </h2>
              <PosTag pos={pos} />
              {pot > ovr && <span title="Developing"><TrendingUp size={14} color={COLORS.lime} /></span>}
            </div>
            <div style={{ color: COLORS.muted, fontSize: 12 }}>Age {player.age}</div>
            <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 10, color: COLORS.muted }}>
              <span>Potential: <RatingBadge value={pot} size="sm" /></span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>Morale: <MoraleMeter value={morale} /></span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.lime, fontFamily: FONT.mono }}>
              {sal > 0 ? fmtCurrency(sal) : "—"}
              {sal > 0 && <span style={{ fontSize: 10, color: COLORS.muted, fontWeight: 400 }}>/yr</span>}
            </div>
            <div style={{ fontSize: 10, color: COLORS.muted }}>
              {yrs > 0 ? `${yrs} year${yrs !== 1 ? "s" : ""}` : "Free Agent"}
            </div>
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
            {sal > 0 ? [
              { l: "Annual Salary",  v: fmtCurrency(sal) },
              { l: "Guaranteed",     v: fmtCurrency(Math.floor(sal * 0.6)) },
              { l: "Cap Hit",        v: fmtCurrency(Math.floor(sal * 0.85)) },
              { l: "Years Remaining", v: `${yrs}` },
            ].map(d => (
              <div key={d.l} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(116,0,86,0.4)" }}>
                <span style={{ fontSize: 11, color: COLORS.muted }}>{d.l}</span>
                <span style={{ fontSize: 11, color: COLORS.light, fontWeight: 600, fontFamily: FONT.mono }}>{d.v}</span>
              </div>
            )) : (
              <div style={{ fontSize: 11, color: COLORS.muted }}>No active contract — Free Agent</div>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
