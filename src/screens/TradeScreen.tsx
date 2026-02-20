import { COLORS } from "../ui/theme";
import { Section } from "../ui/components";
import { ArrowLeftRight } from "lucide-react";

export function TradeScreen() {
  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: COLORS.light, marginBottom: 12 }}>Trade Center</h2>
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 1fr", gap: 14 }}>
        <Section title="Your Assets">
          <div style={{ border: "2px dashed #811765", borderRadius: 8, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 6 }}>Add players or picks</div>
            <button style={{ padding: "6px 14px", borderRadius: 5, background: "rgba(116,0,86,0.2)", color: COLORS.muted, border: "1px solid #740056", fontSize: 10, cursor: "pointer" }}>
              + Add Asset
            </button>
          </div>
        </Section>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ArrowLeftRight size={24} color={COLORS.magenta} />
        </div>

        <Section title="Trade Partner">
          <select style={{ width: "100%", background: "rgba(116,0,86,0.2)", color: COLORS.light, border: `1px solid ${COLORS.darkMagenta}`, borderRadius: 6, padding: "6px 10px", fontSize: 11, marginBottom: 10 }}>
            <option>Select Team...</option>
          </select>
        </Section>
      </div>
    </div>
  );
}
