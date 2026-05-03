"use client";

import {motion} from "framer-motion";
import {ChevronRight, GripVertical, Zap} from "lucide-react";
import {FlagMark} from "./CountryLabel";
import {groupStyle, groupTheme} from "../lib/seedData";

export function TeamCard({team, momentum = 0, draggable, onDragStart, onBadgeClick}) {
    const inMomentum = momentum > 0;
    const highMomentum = momentum >= 12;
    const theme = groupTheme(team.group);
    const glowAlpha = Math.min(0.42, 0.14 + momentum / 70);
    const glowSize = Math.min(38, 14 + momentum);

    return (
        <motion.div
            draggable={draggable}
            onDragStartCapture={onDragStart}
            animate={inMomentum ? "powered" : "idle"}
            variants={{
                idle: {scale: 1, boxShadow: "0 0 0 rgba(0, 0, 0, 0)"},
                powered: {
                    scale: highMomentum ? [1, 1.025, 1] : 1,
                    boxShadow: `0 0 0 1px rgba(${theme.rgb}, ${glowAlpha}), 0 0 ${glowSize}px rgba(${theme.rgb}, ${glowAlpha})`,
                },
            }}
            transition={highMomentum ? {duration: 0.7, repeat: Infinity, repeatDelay: 1.8} : {duration: 0.16}}
            className={`team-card flex min-h-16 items-center justify-between rounded-md border px-3 py-2 ${
                inMomentum ? "is-momentum" : ""
            } ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
            style={groupStyle(team.group)}
        >
            <div className="flex min-w-0 items-center gap-3">
                {draggable ? <GripVertical className="shrink-0 text-white/35" size={16} aria-hidden="true"/> : null}
                <FlagMark team={team} size="lg"/>
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
                    <Zap size={14}/>
                    {momentum > 0 ? "+" : ""}{momentum.toFixed(1)}
                </div>
                <button
                    type="button"
                    className="team-flip-button"
                    aria-label={`View ${team.name} intel`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onBadgeClick?.(team);
                    }}
                >
                    <ChevronRight size={14}/>
                </button>
            </div>
        </motion.div>
    );
}