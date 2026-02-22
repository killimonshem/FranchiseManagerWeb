import { useState, useEffect } from "react";
import { COLORS, FONT } from "../ui/theme";
import { gameStore, SaveData } from "../stores/GameStore";
import { Trash2, Play, ArrowLeft, Clock, Calendar } from "lucide-react";

interface Props {
  onLoad: () => void;
  onBack: () => void;
}

interface SaveSlotDisplay {
  id: string;
  data: SaveData;
}

export function LoadGameScreen({ onLoad, onBack }: Props) {
  const [slots, setSlots] = useState<SaveSlotDisplay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSlots();
  }, []);

  async function loadSlots() {
    setLoading(true);
    const names = await gameStore.getAllSaveSlots();
    const loaded: SaveSlotDisplay[] = [];
    for (const name of names) {
      const data = await gameStore.getSaveSlotMetadata(name);
      if (data) {
        loaded.push({ id: name, data });
      }
    }
    // Sort by save timestamp descending (newest first)
    loaded.sort((a, b) => new Date(b.data.saveTimestamp).getTime() - new Date(a.data.saveTimestamp).getTime());
    setSlots(loaded);
    setLoading(false);
  }

  async function handleLoad(id: string) {
    const success = await gameStore.loadGame(id);
    if (success) {
      onLoad();
    }
  }

  async function handleDelete(id: string) {
    if (confirm(`Are you sure you want to delete "${id}"?`)) {
      await gameStore.deleteSave(id);
      loadSlots();
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: COLORS.bg, display: "flex", flexDirection: "column",
      alignItems: "center", padding: 40, fontFamily: FONT.system, color: COLORS.light
    }}>
      <div style={{ width: "100%", maxWidth: 600 }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", color: COLORS.muted, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6, marginBottom: 20, fontSize: 12
        }}>
          <ArrowLeft size={14} /> Back to Menu
        </button>

        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 30 }}>Load Game</h1>

        {loading ? (
          <div style={{ color: COLORS.muted, textAlign: "center" }}>Loading saves...</div>
        ) : slots.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, background: "rgba(255,255,255,0.05)", borderRadius: 12 }}>
            <div style={{ color: COLORS.muted, marginBottom: 10 }}>No saved games found.</div>
            <button onClick={onBack} style={{ color: COLORS.lime, background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>
              Start New Career
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {slots.map(({ id, data }) => (
              <div key={id} style={{
                background: "rgba(116,0,86,0.15)", border: `1px solid ${COLORS.darkMagenta}`,
                borderRadius: 10, padding: 16, display: "flex", alignItems: "center", gap: 16,
                transition: "background 0.2s"
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: COLORS.light }}>
                      {data.userProfile.firstName} {data.userProfile.lastName}
                    </span>
                    <span style={{ fontSize: 11, color: COLORS.lime, fontWeight: 600 }}>
                      {data.userTeamId}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 11, color: COLORS.muted }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Calendar size={12} /> Week {data.currentDate.week}, Year {data.currentDate.year}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={12} /> {data.playtimeMins}m played
                    </span>
                    <span>
                      {new Date(data.saveTimestamp).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => handleLoad(id)} style={{
                    background: COLORS.lime, color: COLORS.bg, border: "none",
                    borderRadius: 6, padding: "8px 16px", fontSize: 11, fontWeight: 700,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 6
                  }}>
                    <Play size={12} /> Load
                  </button>
                  <button onClick={() => handleDelete(id)} style={{
                    background: "rgba(255,50,50,0.1)", color: "#ff5555", border: "1px solid rgba(255,50,50,0.3)",
                    borderRadius: 6, padding: "8px", cursor: "pointer", display: "flex", alignItems: "center"
                  }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}