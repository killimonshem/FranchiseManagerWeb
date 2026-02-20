import { COLORS } from "../ui/theme";
import { Section, RatingBadge, DataRow, PosTag, Pill } from "../ui/components";
import { useState } from "react";

export function DraftScreen() {
  const [tab, setTab] = useState("board");
  const PROSPECTS = [
    { id: 1, name: "Cam Ward", pos: "QB", college: "Alabama", overall: 90, projRound: 1 },
    { id: 2, name: "Travis Hunter", pos: "DL", college: "Georgia", overall: 88, projRound: 1 },
  ];

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: COLORS.light, marginBottom: 8 }}>2025 NFL Draft</h2>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <Pill active={tab === "board"} onClick={() => setTab("board")}>Big Board</Pill>
        <Pill active={tab === "needs"} onClick={() => setTab("needs")}>Team Needs</Pill>
      </div>
      
      <Section title="Prospect Board" pad={false}>
        <DataRow header>
          {["#", "Name", "Pos", "College", "Rating", "Proj"].map(h =>
            <span key={h} style={{ fontSize: 8, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700, flex: h === "Name" ? 2 : 1 }}>
              {h}
            </span>
          )}
        </DataRow>
        {PROSPECTS.map((p, i) => (
          <DataRow key={p.id} even={i % 2 === 0} hover>
            <span style={{ flex: 1, fontSize: 10, fontFamily: "monospace", color: COLORS.muted }}>{i + 1}</span>
            <span style={{ flex: 2, fontSize: 11, fontWeight: 600, color: COLORS.light }}>{p.name}</span>
            <span style={{ flex: 1 }}><PosTag pos={p.pos} /></span>
            <span style={{ flex: 1.5, fontSize: 10, color: COLORS.muted }}>{p.college}</span>
            <span style={{ flex: 1 }}><RatingBadge value={p.overall} size="sm" /></span>
            <span style={{ flex: 1, fontSize: 10, color: COLORS.muted }}>Rd {p.projRound}</span>
          </DataRow>
        ))}
      </Section>
    </div>
  );
}
