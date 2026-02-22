import { useState } from "react";
import { COLORS, fmtCurrency } from "../ui/theme";
import { Section, DataRow, RatingBadge, Pill, IconBtn } from "../ui/components";
import { gameStateManager } from "../types/GameStateManager";
import { UserPlus } from "lucide-react";
import frontOfficeData from "../../frontoffice.json";

export function FrontOfficeScreen() {
  const [tab, setTab] = useState<"coaching" | "frontOffice">("coaching");
  const [showHire, setShowHire] = useState(false);
  const userTeam = gameStateManager.userTeam;

  // Fallback mock data if game state is empty
  const MOCK_COACHING = [
    { name: "Andy Reid", role: "Head Coach", overallRating: 96, salary: 18000000 },
    { name: "Steve Spagnuolo", role: "Defensive Coordinator", overallRating: 92, salary: 4500000 },
    { name: "Dave Toub", role: "Special Teams Coach", overallRating: 88, salary: 2800000 },
  ];

  // Get real data from JSON
  const teamData = userTeam ? (frontOfficeData.teams as any)[userTeam.id] : null;
  
  // Map JSON structure to UI structure
  const frontOffice = (teamData?.front_office || []).map((s: any) => ({
    name: s.name,
    role: s.role,
    overallRating: s.effectiveness,
    salary: s.contract?.salary || 0,
    years: s.contract?.years_remaining || 0,
  }));

  const coaching = userTeam?.coachingStaff?.length 
    ? userTeam.coachingStaff 
    : (teamData?.coaching_staff?.length ? teamData.coaching_staff : MOCK_COACHING);

  const list = tab === "coaching" ? coaching : frontOffice;
  const freeAgents = frontOfficeData.free_agents || [];

  if (showHire) {
    return (
      <div style={{ animation: "fadeIn .4s" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: COLORS.light }}>Hire Staff</h2>
          <button 
            onClick={() => setShowHire(false)}
            style={{ background: "transparent", border: "none", color: COLORS.muted, cursor: "pointer", fontSize: 11 }}
          >
            Cancel
          </button>
        </div>
        <Section pad={false}>
          <DataRow header>
            {["Name", "Role", "Rating", "Last Team", "Note"].map(h => (
              <span key={h} style={{ flex: h === "Name" ? 1.5 : h === "Note" ? 2 : 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700 }}>{h}</span>
            ))}
          </DataRow>
          {freeAgents.map((s: any, i: number) => (
            <DataRow key={i} even={i % 2 === 0}>
              <span style={{ flex: 1.5, fontSize: 12, fontWeight: 600, color: COLORS.light }}>{s.name}</span>
              <span style={{ flex: 1, fontSize: 10, color: COLORS.muted }}>{s.role}</span>
              <span style={{ flex: 1 }}><RatingBadge value={s.effectiveness} size="sm" /></span>
              <span style={{ flex: 1, fontSize: 10, color: COLORS.muted }}>{s.last_team}</span>
              <span style={{ flex: 2, fontSize: 10, color: COLORS.muted, fontStyle: "italic" }}>{s.note}</span>
              <span style={{ width: 60, display: "flex", justifyContent: "flex-end" }}>
                 <button style={{
                   background: COLORS.lime, color: COLORS.bg, border: "none", borderRadius: 4,
                   padding: "4px 8px", fontSize: 9, fontWeight: 700, cursor: "pointer"
                 }}>Offer</button>
              </span>
            </DataRow>
          ))}
        </Section>
      </div>
    );
  }

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: COLORS.light }}>Front Office & Staff</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <Pill active={tab === "coaching"} onClick={() => setTab("coaching")}>Coaching Staff</Pill>
            <Pill active={tab === "frontOffice"} onClick={() => setTab("frontOffice")}>Front Office</Pill>
          </div>
          <IconBtn 
            icon={UserPlus} 
            label="Hire Staff" 
            variant="primary"
            onClick={() => setShowHire(true)}
            style={{ padding: "4px 10px", fontSize: 10, height: 24 }}
          />
        </div>
      </div>

      <Section pad={false}>
        <DataRow header>
          {["Name", "Role", "Rating", "Salary"].map(h => (
            <span key={h} style={{ flex: h === "Name" ? 1.5 : 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700 }}>{h}</span>
          ))}
        </DataRow>
        {list.map((s: any, i: number) => (
          <DataRow key={i} even={i % 2 === 0}>
            <span style={{ flex: 1.5, fontSize: 12, fontWeight: 600, color: COLORS.light }}>{s.name}</span>
            <span style={{ flex: 1, fontSize: 10, color: COLORS.muted }}>{s.role || s.position}</span>
            <span style={{ flex: 1 }}><RatingBadge value={s.overallRating || s.effectiveness || 75} size="sm" /></span>
            <span style={{ flex: 1, fontSize: 11, color: COLORS.lime, fontFamily: "monospace" }}>{fmtCurrency(s.salary || 0)}</span>
          </DataRow>
        ))}
      </Section>
    </div>
  );
}