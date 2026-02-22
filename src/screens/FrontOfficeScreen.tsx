import { useState } from "react";
import { COLORS, fmtCurrency } from "../ui/theme";
import { Section, DataRow, RatingBadge, Pill, IconBtn } from "../ui/components";
import { gameStateManager } from "../types/GameStateManager";
import { hireTeamStaff } from "../types/team";
import { UserPlus, ArrowUp, ArrowDown } from "lucide-react";
import frontOfficeData from "../../frontoffice.json";

export function FrontOfficeScreen() {
  const [tab, setTab] = useState<"coaching" | "frontOffice">("coaching");
  const [showHire, setShowHire] = useState(false);
  const [columnSort, setColumnSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [hireNotification, setHireNotification] = useState<string | null>(null);
  const userTeam = gameStateManager.userTeam;

  const handleOfferStaff = (staffMember: any) => {
    if (!userTeam) return;

    try {
      // Hire the staff member to the user's team
      const updatedTeam = hireTeamStaff(userTeam, staffMember);
      const teamIdx = gameStateManager.teams.findIndex(t => t.id === userTeam.id);
      if (teamIdx !== -1) {
        gameStateManager.teams[teamIdx] = updatedTeam;
      }

      setHireNotification(`${staffMember.name} hired!`);
      setTimeout(() => setHireNotification(null), 2000);
    } catch (e) {
      console.error("Failed to hire staff:", e);
    }
  };

  const requestColumnSort = (key: string) => {
    if (columnSort?.key === key) {
      setColumnSort({ key, direction: columnSort.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      setColumnSort({ key, direction: 'desc' });
    }
  };

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

  let listToDisplay = tab === "coaching" ? coaching : frontOffice;
  
  // Apply sorting
  listToDisplay = [...listToDisplay].sort((a: any, b: any) => {
    if (!columnSort) return 0;
    const { key, direction } = columnSort;
    let aVal: any, bVal: any;
    
    switch (key) {
      case "rating":
        aVal = a.overallRating || a.effectiveness || 75;
        bVal = b.overallRating || b.effectiveness || 75;
        break;
      case "salary":
        aVal = a.salary || 0;
        bVal = b.salary || 0;
        break;
      default:
        return 0;
    }
    
    if (typeof aVal === "number" && typeof bVal === "number") {
      return direction === "asc" ? aVal - bVal : bVal - aVal;
    }
    return 0;
  });

  const list = listToDisplay;
  const freeAgents = frontOfficeData.free_agents || [];

  if (showHire) {
    return (
      <div style={{ animation: "fadeIn .4s" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: COLORS.light }}>Hire Staff</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {hireNotification && (
              <span style={{ fontSize: 11, color: COLORS.lime, fontWeight: 600 }}>{hireNotification}</span>
            )}
            <button
              onClick={() => setShowHire(false)}
              style={{ background: "transparent", border: "none", color: COLORS.muted, cursor: "pointer", fontSize: 11 }}
            >
              Cancel
            </button>
          </div>
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
                 <button
                   onClick={() => handleOfferStaff(s)}
                   style={{
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
          <span style={{ flex: 1.5, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700 }}>Name</span>
          <span style={{ flex: 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700 }}>Role</span>
          <span
            onClick={() => requestColumnSort("rating")}
            style={{
              flex: 1, fontSize: 8, color: columnSort?.key === "rating" ? COLORS.lime : COLORS.muted,
              textTransform: "uppercase", fontWeight: columnSort?.key === "rating" ? 800 : 700,
              cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 4
            }}
          >
            Rating {columnSort?.key === "rating" && (columnSort.direction === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
          </span>
          <span
            onClick={() => requestColumnSort("salary")}
            style={{
              flex: 1, fontSize: 8, color: columnSort?.key === "salary" ? COLORS.lime : COLORS.muted,
              textTransform: "uppercase", fontWeight: columnSort?.key === "salary" ? 800 : 700,
              cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 4
            }}
          >
            Salary {columnSort?.key === "salary" && (columnSort.direction === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
          </span>
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