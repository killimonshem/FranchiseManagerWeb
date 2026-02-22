import React from "react";
import { COLORS } from "./theme";

interface DraftClockProps {
  secondsLeft: number;
  maxSeconds?: number;
}

export function DraftClock({ secondsLeft, maxSeconds = 300 }: DraftClockProps) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  // Color intensity based on time remaining
  let bgColor = COLORS.lime;
  let textColor = COLORS.bg;

  if (secondsLeft <= 30) {
    bgColor = COLORS.coral; // Red when < 30 seconds
  } else if (secondsLeft <= 90) {
    bgColor = COLORS.gold; // Gold when < 90 seconds
  }

  // Progress bar fill percentage
  const fillPercent = (secondsLeft / maxSeconds) * 100;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8,
    }}>
      <div style={{
        fontSize: 32,
        fontWeight: 900,
        fontVariantNumeric: "tabular-nums",
        color: bgColor,
      }}>
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </div>
      <div style={{
        width: 80,
        height: 6,
        background: "rgba(255,255,255,0.1)",
        borderRadius: 3,
        overflow: "hidden",
      }}>
        <div
          style={{
            width: `${fillPercent}%`,
            height: "100%",
            background: bgColor,
            transition: "width 0.1s linear, background 0.2s",
          }}
        />
      </div>
    </div>
  );
}
