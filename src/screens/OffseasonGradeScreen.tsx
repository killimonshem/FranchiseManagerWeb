import { COLORS } from "../ui/theme";
import { Section } from "../ui/components";
import { useState } from "react";
import type { GameStateManager } from "../types/GameStateManager";

export function OffseasonGradeScreen({ gsm, refresh }: { gsm: GameStateManager; refresh: () => void; }) {
  const [copied, setCopied] = useState(false);
  const grade = gsm.computeOffseasonGrade();

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(grade.summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn('Failed to copy to clipboard', e);
    }
  }

  return (
    <div style={{ animation: 'fadeIn .3s' }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: COLORS.light, marginBottom: 12 }}>Offseason Grade</h2>

      <Section pad={false} title="Summary">
        <div style={{ fontSize: 14, color: COLORS.light, fontWeight: 800, marginBottom: 6 }}>{grade.overall}/100</div>
        <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 12 }}>{grade.summaryText}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleShare} style={{ padding: '8px 14px', borderRadius: 8, background: 'linear-gradient(135deg,#b0007a,#6a004f)', color: 'white', border: 'none' }}>{copied ? 'Copied' : 'Copy Shareable Summary'}</button>
          <button onClick={() => { refresh(); }} style={{ padding: '8px 14px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: COLORS.muted }}>Refresh</button>
        </div>
      </Section>

      <Section title="Breakdown">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ fontSize: 11, color: COLORS.muted }}>Cap Health</div>
            <div style={{ fontSize: 20, color: COLORS.lime, fontWeight: 800 }}>{grade.capHealth}/100</div>
          </div>
          <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ fontSize: 11, color: COLORS.muted }}>Roster Improvement</div>
            <div style={{ fontSize: 20, color: COLORS.lime, fontWeight: 800 }}>{grade.rosterImprovement}/100</div>
          </div>
          <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ fontSize: 11, color: COLORS.muted }}>Draft Haul</div>
            <div style={{ fontSize: 20, color: COLORS.lime, fontWeight: 800 }}>{grade.draftHaul}/100</div>
          </div>
          <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ fontSize: 11, color: COLORS.muted }}>Free Agent Acquisitions</div>
            <div style={{ fontSize: 20, color: COLORS.lime, fontWeight: 800 }}>{grade.faAcquisitions}/100</div>
          </div>
        </div>
      </Section>
    </div>
  );
}
