import { COLORS, fmtCurrency } from "../ui/theme";
import { Section, DataRow, RatingBadge } from "../ui/components";

export function StaffScreen() {
  const STAFF = [
    { name: "Andy Reid", role: "Head Coach", eff: 96, sal: 18000000 },
    { name: "Steve Spagnuolo", role: "Defensive Coordinator", eff: 92, sal: 4500000 },
    { name: "Dave Toub", role: "Special Teams Coach", eff: 88, sal: 2800000 },
  ];

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: COLORS.light, marginBottom: 12 }}>Coaching Staff</h2>
      
      <Section pad={false}>
        <DataRow header>
          {["Name", "Role", "Effectiveness", "Salary"].map(h =>
            <span key={h} style={{ fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, flex: h === "Name" ? 1.5 : 1 }}>
              {h}
            </span>
          )}
        </DataRow>
        
        {STAFF.map((s, i) => (
          <DataRow key={s.name} even={i % 2 === 0}>
            <span style={{ flex: 1.5, fontSize: 12, fontWeight: 600, color: COLORS.light }}>{s.name}</span>
            <span style={{ flex: 1, fontSize: 10, color: COLORS.muted }}>{s.role}</span>
            <span style={{ flex: 1 }}><RatingBadge value={s.eff} size="sm" /></span>
            <span style={{ flex: 1, fontSize: 11, color: COLORS.lime, fontFamily: "monospace" }}>{fmtCurrency(s.sal)}</span>
          </DataRow>
        ))}
      </Section>
    </div>
  );
}
