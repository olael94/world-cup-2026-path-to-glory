"use client";

import { motion } from "framer-motion";
import { GripVertical, Info, RotateCcw, Zap } from "lucide-react";
import { useState } from "react";
import { FlagMark } from "./CountryLabel";
import { groupStyle, groupTheme } from "../lib/seedData";

export function TeamCard({ team, momentum = 0, draggable, onDragStart }) {
  const [flipped, setFlipped] = useState(false);
  const inMomentum = momentum > 0;
  const highMomentum = momentum >= 12;
  const elo = Math.round(team.elo);
  const form = Math.round(team.form ?? 50);
  const eloTier = eloLabel(elo);
  const formTier = formLabel(form);
  const eloPosition = rangePercent(elo, 1450, 1950);
  const formPosition = rangePercent(form, 0, 100);
  const theme = groupTheme(team.group);
  const glowAlpha = Math.min(0.42, 0.14 + momentum / 70);
  const glowSize = Math.min(38, 14 + momentum);

  return (
    <motion.div
      draggable={draggable}
      onDragStartCapture={onDragStart}
      animate={inMomentum ? "powered" : "idle"}
      variants={{
        idle: {
          scale: 1,
          boxShadow: "0 0 0 rgba(0, 0, 0, 0)",
        },
        powered: {
          scale: highMomentum ? [1, 1.025, 1] : 1,
          boxShadow: `0 0 0 1px rgba(${theme.rgb}, ${glowAlpha}), 0 0 ${glowSize}px rgba(${theme.rgb}, ${glowAlpha})`,
        },
      }}
      transition={highMomentum ? { duration: 0.7, repeat: Infinity, repeatDelay: 1.8 } : { duration: 0.16 }}
      className={`team-card flex min-h-16 items-center justify-between rounded-md border px-3 py-2 ${
        inMomentum ? "is-momentum" : ""
      } ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={groupStyle(team.group)}
    >
      {flipped ? (
        <div className="team-card-back grid w-full gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-white">{team.name}</div>
              <div className="text-[0.68rem] leading-snug text-white/52">Elo is strength. Form is recent condition.</div>
            </div>
            <button className="team-flip-button" type="button" aria-label={`Show ${team.name} tile`} onClick={() => setFlipped(false)}>
              <RotateCcw size={13} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <Stat label="FIFA" value={`#${team.ranking}`} />
            <Stat label="Elo" value={elo} />
            <Stat label="Form" value={form} />
          </div>
          <div className="grid gap-1.5">
            <RangeStat label="Elo" value={elo} min="1450" max="1950+" position={eloPosition} note={eloTier} />
            <RangeStat label="Form" value={form} min="0" max="100" position={formPosition} note={formTier} />
          </div>
          {team.aiAdjusted ? (
            <div className="truncate text-[0.68rem] text-white/45">{team.newsCount} news signals in latest AI refresh</div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="flex min-w-0 items-center gap-3">
            {draggable ? <GripVertical className="shrink-0 text-white/35" size={16} aria-hidden="true" /> : null}
            <FlagMark team={team} size="lg" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{team.name}</div>
              <div className="text-xs text-white/50">FIFA #{team.ranking}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div
              className={`team-momentum flex items-center gap-1 text-xs ${momentum > 0 ? "text-mint" : momentum < 0 ? "text-coral" : "text-white/45"}`}
              title="Momentum is the Elo shift from calculated or entered results."
              aria-label={`Momentum ${momentum.toFixed(1)}`}
            >
              <Zap size={14} />
              {momentum > 0 ? "+" : ""}{momentum.toFixed(1)}
            </div>
            <button className="team-flip-button" type="button" aria-label={`Show ${team.name} Elo and form`} onClick={() => setFlipped(true)}>
              <Info size={13} />
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="team-stat rounded border px-1.5 py-1">
      <div className="text-[0.62rem] uppercase text-white/42">{label}</div>
      <div className="text-xs font-black text-white">{value}</div>
    </div>
  );
}

function RangeStat({ label, value, min, max, position, note }) {
  return (
    <div className="team-range-stat">
      <div className="mb-0.5 flex items-center justify-between gap-2 text-[0.66rem] leading-tight">
        <span className="font-bold text-white/72">{label}: {note}</span>
        <span className="text-white/48">{value}</span>
      </div>
      <div className="team-range-track" aria-hidden="true">
        <span className="team-range-pin" style={{ left: `${position}%` }} />
      </div>
      <div className="mt-0.5 flex justify-between text-[0.58rem] leading-none text-white/34">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function rangePercent(value, min, max) {
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function eloLabel(elo) {
  if (elo >= 1850) return "elite / very strong";
  if (elo >= 1750) return "strong";
  if (elo >= 1650) return "competitive";
  if (elo >= 1550) return "weaker but dangerous";
  return "underdog";
}

function formLabel(form) {
  if (form >= 80) return "excellent recent run";
  if (form >= 65) return "strong recent form";
  if (form >= 50) return "steady / average";
  if (form >= 35) return "shaky lately";
  return "poor recent form";
}
