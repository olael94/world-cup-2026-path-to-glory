"use client";

import { motion } from "framer-motion";
import { ChevronRight, GripVertical, Zap } from "lucide-react";
import { FlagMark } from "./CountryLabel";
import { groupStyle, groupTheme } from "../lib/seedData";

// Displays a team as a draggable card with its flag, name, FIFA ranking, and momentum.
// Used in the group boards before and after simulation.
export function TeamCard({ team, momentum = 0, draggable, onDragStart, onBadgeClick }) {
    const inMomentum = momentum > 0;
    // High momentum (12+) triggers a pulsing scale animation to make surging teams stand out.
    const highMomentum = momentum >= 12;
    const theme = groupTheme(team.group);
    // Glow intensity and size both scale up with momentum, capped so they don't get too extreme.
    const glowAlpha = Math.min(0.42, 0.14 + momentum / 70);
    const glowSize = Math.min(38, 14 + momentum);

    return (
        <motion.div
            draggable={draggable}
            // onDragStartCapture fires before React's synthetic onDragStart,
            // which ensures the drag data is set before any parent handlers run.
            onDragStartCapture={onDragStart}
            // Switch between two named animation variants based on momentum state.
            animate={inMomentum ? "powered" : "idle"}
            variants={{
                idle: { scale: 1, boxShadow: "0 0 0 rgba(0, 0, 0, 0)" },
                powered: {
                    // High momentum: loop a subtle pulse. Normal momentum: just apply the glow.
                    scale: highMomentum ? [1, 1.025, 1] : 1,
                    boxShadow: `0 0 0 1px rgba(${theme.rgb}, ${glowAlpha}), 0 0 ${glowSize}px rgba(${theme.rgb}, ${glowAlpha})`,
                },
            }}
            transition={
                highMomentum
                    ? { duration: 0.7, repeat: Infinity, repeatDelay: 1.8 }
                    : { duration: 0.16 }
            }
            className={`team-card flex min-h-16 items-center justify-between rounded-md border px-3 py-2 ${
                inMomentum ? "is-momentum" : ""
            } ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
            style={groupStyle(team.group)}
        >
            <div className="flex min-w-0 items-center gap-3">
                {draggable ? (
                    <GripVertical className="shrink-0 text-white/35" size={16} aria-hidden="true" />
                ) : null}
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
                    {momentum > 0 ? "+" : ""}
                    {momentum.toFixed(1)}
                </div>
                <button
                    type="button"
                    className="team-flip-button"
                    aria-label={`View ${team.name} intel`}
                    onClick={(e) => {
                        // stopPropagation prevents the click from also triggering
                        // the drag handler on the parent motion.div.
                        e.stopPropagation();
                        // Optional chaining (?.) means nothing happens if no handler was passed.
                        onBadgeClick?.(team);
                    }}
                >
                    <ChevronRight size={14} />
                </button>
            </div>
        </motion.div>
    );
}
