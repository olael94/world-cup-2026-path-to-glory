"use client";

import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, Newspaper, UserMinus, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FlagMark } from "./CountryLabel";
import { groupStyle } from "../lib/seedData";

const RELEVANCE = {
    injury: { label: "Injury", color: "text-coral" },
    form: { label: "Form", color: "text-mint" },
    tactical: { label: "Tactical", color: "text-sky-400" },
    morale: { label: "Morale", color: "text-amber-400" },
    availability: { label: "Availability", color: "text-purple-400" },
};

export function TeamIntelDrawer({ team, onClose }) {
    const [mounted, setMounted] = useState(false);
    const [isMobile, setIsMobile] = useState(true);

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        setMounted(true);
        const mq = window.matchMedia("(min-width: 768px)");
        setIsMobile(!mq.matches);
        const handler = (e) => setIsMobile(!e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);
    /* eslint-enable react-hooks/set-state-in-effect */

    useEffect(() => {
        if (!team) return;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "";
        };
    }, [team]);

    if (!mounted) return null;

    const panelVariants = {
        hidden: isMobile ? { y: "100%" } : { x: "100%" },
        visible: isMobile ? { y: 0 } : { x: 0 },
        exit: isMobile ? { y: "100%" } : { x: "100%" },
    };

    return createPortal(
        <AnimatePresence>
            {team && (
                <>
                    <motion.div
                        key="intel-overlay"
                        className="fixed inset-0 z-40 bg-black/60"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                    />

                    <motion.aside
                        key="intel-panel"
                        aria-label={`${team.name} intelligence panel`}
                        className="fixed z-50 flex flex-col overflow-hidden bg-panel border-line bottom-0 left-0 right-0 max-h-[82vh] rounded-t-2xl border-t md:inset-y-0 md:right-0 md:bottom-auto md:left-auto md:w-[400px] md:max-h-screen md:rounded-none md:rounded-l-2xl md:border-t-0 md:border-l"
                        style={groupStyle(team.group)}
                        variants={panelVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={{ type: "spring", stiffness: 380, damping: 38 }}
                        drag={isMobile ? "y" : false}
                        dragConstraints={{ top: 0 }}
                        dragElastic={{ top: 0, bottom: 0.4 }}
                        onDragEnd={(_, info) => {
                            if (info.offset.y > 80 || info.velocity.y > 500) onClose();
                        }}
                    >
                        {/* Drag handle — mobile only */}
                        <div className="flex justify-center pt-3 pb-1 md:hidden">
                            <div className="h-1 w-10 rounded-full bg-white/20" />
                        </div>

                        {/* Header */}
                        <div className="sticky top-0 flex items-center gap-3 px-5 py-4 border-b border-white/8 bg-panel/95 backdrop-blur-sm shrink-0">
                            <div className="shrink-0">
                                <FlagMark team={team} size="lg" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="truncate text-base font-bold text-white">
                                    {team.name}
                                </div>
                                <div className="text-xs text-white/50">
                                    Group {team.group} · FIFA #{team.ranking}
                                </div>
                            </div>
                            {team.aiAdjusted && (
                                <span className="hidden shrink-0 rounded-full border border-mint/30 bg-mint/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-mint sm:inline-block">
                                    AI Intel
                                </span>
                            )}
                            <button
                                className="shrink-0 rounded-full p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                                onClick={onClose}
                                aria-label="Close intel panel"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
                            {/* Elo & Form — always shown */}
                            <Section title="Strength & Form">
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    <StatBox label="FIFA" value={`#${team.ranking}`} />
                                    <StatBox label="Elo" value={Math.round(team.elo)} />
                                    <StatBox label="Form" value={Math.round(team.form ?? 50)} />
                                </div>
                                <RangeStat
                                    label="Elo"
                                    value={Math.round(team.elo)}
                                    min="1450"
                                    max="1950+"
                                    position={rangePercent(team.elo, 1450, 1950)}
                                    note={eloLabel(Math.round(team.elo))}
                                />
                                <div className="mt-2">
                                    <RangeStat
                                        label="Form"
                                        value={Math.round(team.form ?? 50)}
                                        min="0"
                                        max="100"
                                        position={rangePercent(team.form ?? 50, 0, 100)}
                                        note={formLabel(Math.round(team.form ?? 50))}
                                    />
                                </div>
                                {team.aiAdjusted && team.newsCount > 0 && (
                                    <div className="mt-2 text-[10px] text-white/35">
                                        Elo and form adjusted from {team.newsCount} AI news signals
                                    </div>
                                )}
                            </Section>

                            {/* AI Intel sections */}
                            {team.aiAdjusted ? (
                                <>
                                    {team.intelligenceUpdatedAt && (
                                        <div className="text-[10px] text-white/30 -mt-2">
                                            Last refreshed{" "}
                                            {new Date(
                                                team.intelligenceUpdatedAt
                                            ).toLocaleDateString(undefined, {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric",
                                            })}
                                        </div>
                                    )}

                                    {team.intelligenceSummary && (
                                        <p className="text-sm leading-relaxed text-white/80">
                                            {team.intelligenceSummary}
                                        </p>
                                    )}

                                    {team.newsItems?.length > 0 && (
                                        <Section
                                            icon={<Newspaper size={12} />}
                                            title="Latest Intel"
                                        >
                                            <div className="space-y-2">
                                                {team.newsItems.map((item, i) => (
                                                    <NewsItemCard key={i} item={item} />
                                                ))}
                                            </div>
                                        </Section>
                                    )}

                                    {team.keyPlayersOut?.length > 0 && (
                                        <Section
                                            icon={<UserMinus size={12} />}
                                            title="Players Out"
                                            titleColor="text-coral"
                                        >
                                            <ul className="space-y-1.5">
                                                {team.keyPlayersOut.map((p, i) => (
                                                    <li
                                                        key={i}
                                                        className="flex items-start gap-2 text-xs text-white/70"
                                                    >
                                                        <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />
                                                        {p}
                                                    </li>
                                                ))}
                                            </ul>
                                        </Section>
                                    )}

                                    {team.keyPlayersIn?.length > 0 && (
                                        <Section
                                            icon={<UserPlus size={12} />}
                                            title="Players In"
                                            titleColor="text-mint"
                                        >
                                            <ul className="space-y-1.5">
                                                {team.keyPlayersIn.map((p, i) => (
                                                    <li
                                                        key={i}
                                                        className="flex items-start gap-2 text-xs text-white/70"
                                                    >
                                                        <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-mint" />
                                                        {p}
                                                    </li>
                                                ))}
                                            </ul>
                                        </Section>
                                    )}

                                    {team.coachNotes && (
                                        <Section
                                            icon={<MessageSquare size={12} />}
                                            title="Coach & Tactics"
                                        >
                                            <p className="text-xs leading-relaxed text-white/65">
                                                {team.coachNotes}
                                            </p>
                                        </Section>
                                    )}
                                </>
                            ) : (
                                <div className="rounded-lg border border-white/8 bg-white/5 px-4 py-5 text-center">
                                    <div className="mb-1 text-xl opacity-30">📡</div>
                                    <div className="text-xs font-medium text-white/40">
                                        AI intelligence not available yet
                                    </div>
                                    <div className="mt-1 text-[10px] text-white/25">
                                        Stats above are based on historical match records.
                                    </div>
                                </div>
                            )}

                            <div className="h-4 md:hidden" />
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>,
        document.body
    );
}

function NewsItemCard({ item }) {
    const rel = RELEVANCE[item.relevance] ?? { label: item.relevance, color: "text-white/50" };
    const inner = (
        <>
            <div className="flex items-start justify-between gap-2">
                <p className="text-xs leading-snug text-white/85">{item.headline}</p>
                <span
                    className={`shrink-0 text-[9px] font-bold uppercase tracking-wide ${rel.color}`}
                >
                    {rel.label}
                </span>
            </div>
            {item.source && (
                <div className="mt-1 text-[10px] text-white/35">
                    {item.source}
                    {item.url ? " ↗" : ""}
                </div>
            )}
        </>
    );

    if (item.url) {
        return (
            <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border border-white/8 bg-white/5 px-3 py-2.5 transition-colors hover:border-white/20 hover:bg-white/10"
            >
                {inner}
            </a>
        );
    }

    return <div className="rounded-lg border border-white/8 bg-white/5 px-3 py-2.5">{inner}</div>;
}

function Section({ icon, title, titleColor = "text-white/40", children }) {
    return (
        <div>
            <div
                className={`mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${titleColor}`}
            >
                {icon}
                {title}
            </div>
            {children}
        </div>
    );
}

function StatBox({ label, value }) {
    return (
        <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-center">
            <div className="text-[9px] uppercase tracking-wider text-white/40">{label}</div>
            <div className="mt-0.5 text-sm font-bold text-white">{value}</div>
        </div>
    );
}

function RangeStat({ label, value, min, max, position, note }) {
    return (
        <div>
            <div className="mb-1 flex items-center justify-between text-[10px] leading-tight">
                <span className="font-semibold text-white/60">
                    {label} — {note}
                </span>
                <span className="text-white/40">{value}</span>
            </div>
            <div className="team-range-track" aria-hidden="true">
                <span className="team-range-pin" style={{ left: `${position}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[9px] text-white/25">
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
    if (elo >= 1850) return "elite";
    if (elo >= 1750) return "strong";
    if (elo >= 1650) return "competitive";
    if (elo >= 1550) return "dangerous";
    return "underdog";
}

function formLabel(form) {
    if (form >= 80) return "excellent";
    if (form >= 65) return "strong";
    if (form >= 50) return "steady";
    if (form >= 35) return "shaky";
    return "poor";
}
