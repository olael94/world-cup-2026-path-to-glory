"use client";

import {GripVertical} from "lucide-react";
import {TeamCard} from "./TeamCard";
import {groupStyle} from "../lib/seedData";

export function GroupBoard({order, result, onDropTeam, onIntelClick}) {
    const momentum = new Map(result?.standings.map((row) => [row.teamId, row.momentumShift]) ?? []);
    const teamById = new Map(order.slots.map((slot) => [slot.team.id, slot.team]));
    const displaySlots = result?.standings?.length
        ? result.standings.map((row) => ({
            position: row.position,
            team: teamById.get(row.teamId) ?? {
                id: row.teamId,
                name: row.teamName,
                group: row.group,
                ranking: 0,
                elo: row.elo,
                form: 50,
                historicalMatches: 0,
            },
        }))
        : order.slots;
    const calculated = Boolean(result?.standings?.length);

    return (
        <section className="group-panel rounded-lg border border-line bg-panel/88 p-3" style={groupStyle(order.group)}>
            <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-base font-bold">
                    <span className="group-letter">{order.group}</span>
                    <span>Group {order.group}</span>
                </h2>
                <span
                    className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-black/18 px-2 py-1 text-xs text-white/55">
          {!calculated ? <GripVertical size={13}/> : null}
                    {calculated ? "Calculated" : "Drag to reorder"}
        </span>
            </div>
            <div className="grid gap-2">
                {displaySlots.map((slot, index) => (
                    <div
                        key={slot.team.id}
                        onDragOver={(event) => {
                            if (!calculated) event.preventDefault();
                        }}
                        onDrop={(event) => {
                            if (!calculated) onDropTeam(order.group, Number(event.dataTransfer.getData("text/plain")), index);
                        }}
                        className="ranking-slot grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 rounded-md border p-2"
                    >
                        <div className="rank-badge" aria-label={`${slot.position}${suffix(slot.position)} place`}>
                            {slot.position}
                        </div>
                        <TeamCard
                            team={slot.team}
                            momentum={momentum.get(slot.team.id) ?? 0}
                            draggable={!calculated}
                            onDragStart={eventData(index)}
                            onBadgeClick={onIntelClick}
                        />
                    </div>
                ))}
            </div>
            {result?.matches?.length ? (
                <div className="mt-3 grid grid-cols-2 gap-1 text-xs text-white/60">
                    {result.matches.slice(0, 6).map((match) => (
                        <div key={`${match.homeId}-${match.awayId}`} className="rounded bg-black/18 px-2 py-1">
                            {match.homeId.toUpperCase()} {match.homeGoals}-{match.awayGoals} {match.awayId.toUpperCase()}
                        </div>
                    ))}
                </div>
            ) : null}
        </section>
    );
}

function eventData(index) {
    return (event) => event.dataTransfer.setData("text/plain", String(index));
}

function suffix(position) {
    if (position === 1) return "st";
    if (position === 2) return "nd";
    if (position === 3) return "rd";
    return "th";
}
