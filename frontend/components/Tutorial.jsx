"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Trophy } from "lucide-react";

// Each step targets a CSS selector on the page to spotlight.
// target: null means the tooltip is centered with no highlight (used for the welcome screen).
// padding: controls how much space is added around the highlighted element.
const STEPS = [
    {
        target: null,
        title: "Welcome to Path to Glory 🏆",
        body: "Your personal 2026 World Cup simulator. Rank the groups, optionally set scores, and let AI calculate who truly earns a path to glory. Let's walk through how it works.",
    },
    {
        target: "[data-tutorial='groups'] .group-panel:first-child",
        title: "Shape the Groups",
        body: "Each panel is a group. Drag teams up or down to set your predicted finishing order. Positions 1 and 2 advance automatically, position 3 enters the wildcard race, and position 4 goes home.",
        padding: 12,
    },
    {
        target: "[data-tutorial='groups'] .group-panel .team-flip-button",
        title: "Team Intel",
        body: "Tap the arrow on any team card to open the intel panel — Elo ratings, form, AI-powered news signals, injuries, player availability, and coach notes.",
        padding: 10,
    },
    {
        target: "[data-tutorial='focus'] .focus-chip-row",
        title: "Filter Groups",
        body: "Pick the groups you want to work on. Click any letter to isolate those groups on the board. Hide the rest and keep your focus.",
        padding: 8,
    },
    {
        target: "[data-tutorial='scores-toggle']",
        title: "Fine-tune Match Scores",
        body: "Want to go deeper? Expand this to set specific goals for any match. The AI simulator fills in everything you leave blank.",
        padding: 10,
    },
    {
        target: "[data-tutorial='mode']",
        title: "Simulator vs Real Data",
        body: "Simulator uses Elo ratings to predict every unplayed match. Switch to Real Data once live results are available and it takes over automatically.",
        padding: 8,
    },
    {
        target: "[data-tutorial='discipline']",
        title: "Card Impact",
        body: "Controls how much yellow and red cards affect team performance in the simulation. Higher = cards hurt more when teams are level on points.",
        padding: 8,
    },
    {
        target: "[data-tutorial='calculate']",
        title: "Calculate the Path",
        body: "Runs the full simulation — group standings, wildcards, bracket seedings, Elo shifts, and momentum for every team. A second Calculate button also sits below the match scores for convenience.",
        padding: 8,
    },
    {
        target: "[data-tutorial='reset']",
        title: "Reset the Board",
        body: "Clears everything back to default FIFA rankings so you can start a fresh scenario. You'll also find a Reset button at the bracket section once results are shown.",
        padding: 8,
    },
    {
        target: null,
        title: "Share Your Prediction",
        body: "Once you calculate, a Share button appears in the control bar. Click it to copy a link — anyone with the URL can view your full bracket and group predictions.",
    },
];

// localStorage key used to remember that the user has already seen the tutorial.
const STORAGE_KEY = "ptg_tutorial_done";
// Fixed dimensions used to calculate where to position the tooltip without it going off-screen.
const TOOLTIP_W = 340;
const TOOLTIP_H = 200;

// Step-by-step spotlight tutorial that highlights elements on the page.
// Shows automatically on first visit. Can be reopened via forceOpen (from the Guide button).
export function Tutorial({ forceOpen = false, onClose }) {
    const [mounted, setMounted] = useState(false);
    const [active, setActive] = useState(false);
    const [step, setStep] = useState(0);
    // Bounding box of the currently highlighted element (x, y, w, h).
    const [spotlight, setSpotlight] = useState(null);
    // Position of the tooltip card. place: "center" = centered on screen, "near" = next to the element.
    const [tooltip, setTooltip] = useState({ top: 0, left: 0, place: "center" });
    // Ref used to cancel in-flight requestAnimationFrame calls when scroll/resize fires rapidly.
    const rafRef = useRef(null);

    const current = STEPS[step];
    const isLast = step === STEPS.length - 1;
    const isFirst = step === 0;

    /* eslint-disable react-hooks/set-state-in-effect */
    // On first mount: mark as mounted (needed for SSR safety) and auto-start
    // the tutorial if the user hasn't seen it before. The try/catch handles
    // browsers where localStorage is blocked (private mode, strict settings).
    useEffect(() => {
        setMounted(true);
        try {
            if (!localStorage.getItem(STORAGE_KEY)) setActive(true);
        } catch {}
    }, []);

    // When the Guide button is clicked, reset to step 0 and reopen.
    useEffect(() => {
        if (forceOpen) {
            setStep(0);
            setActive(true);
        }
    }, [forceOpen]);
    /* eslint-enable react-hooks/set-state-in-effect */

    // Measures the target element's position and calculates where to place the
    // spotlight cutout and tooltip card. Called on every step change, scroll, and resize.
    const measure = useCallback(() => {
        if (!current.target) {
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const w = Math.min(TOOLTIP_W, vw - 32);
            setSpotlight(null);
            setTooltip({ place: "center", top: vh / 2 - 110, left: (vw - w) / 2 });
            return;
        }
        const el = document.querySelector(current.target);
        if (!el) return;
        const pad = current.padding ?? 10;
        const r = el.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Spotlight box = element bounds expanded by the padding on all sides.
        setSpotlight({
            x: r.left - pad,
            y: r.top - pad,
            w: r.width + pad * 2,
            h: r.height + pad * 2,
        });

        // If the target element is near the top or bottom edge, scroll it into the center.
        const midY = r.top + r.height / 2;
        if (r.top < 80 || r.bottom > vh - 80) {
            window.scrollTo({ top: window.scrollY + midY - vh / 2, behavior: "smooth" });
        }

        // Prefer placing the tooltip below the element. Fall back to above if there's more room.
        const spaceBelow = vh - (r.bottom + pad) - 16;
        const spaceAbove = r.top - pad - 16;
        // Center the tooltip horizontally on the element, clamped to stay within the viewport.
        const left = Math.max(
            16,
            Math.min(r.left + r.width / 2 - TOOLTIP_W / 2, vw - TOOLTIP_W - 16)
        );
        const top =
            spaceBelow >= TOOLTIP_H || spaceBelow >= spaceAbove
                ? r.bottom + pad + 12
                : r.top - pad - TOOLTIP_H - 12;

        setTooltip({ top, left, place: "near" });
    }, [current]);

    useEffect(() => {
        if (!active) return;
        // Small delay before measuring so the page has time to scroll or render
        // before we read the target element's position.
        const t = setTimeout(measure, 100);
        // On scroll/resize, cancel any pending frame and schedule a fresh measurement.
        // This prevents the spotlight from lagging behind on fast scrolls.
        const onScroll = () => {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(measure);
        };
        window.addEventListener("resize", onScroll);
        window.addEventListener("scroll", onScroll);
        return () => {
            clearTimeout(t);
            window.removeEventListener("resize", onScroll);
            window.removeEventListener("scroll", onScroll);
        };
    }, [active, step, measure]);

    // Closes the tutorial and marks it as done in localStorage so it
    // doesn't auto-open again on the next visit.
    function dismiss() {
        setActive(false);
        try {
            localStorage.setItem(STORAGE_KEY, "1");
        } catch {}
        if (onClose) onClose();
    }

    function next() {
        if (isLast) {
            dismiss();
            return;
        }
        setStep((s) => s + 1);
    }

    function back() {
        if (!isFirst) setStep((s) => s - 1);
    }

    if (!mounted || !active) return null;

    return (
        <div className="pointer-events-none fixed inset-0 z-[9000]">
            {/*
             * The dark overlay is an SVG with an SVG mask applied.
             * The mask is white everywhere (opaque) except for the spotlight area,
             * which is black (transparent). This punches a clear hole through the
             * dark overlay so the highlighted element shows through.
             * Clicking anywhere on the overlay advances to the next step.
             */}
            <svg className="pointer-events-auto fixed inset-0 h-screen w-screen" onClick={next}>
                <defs>
                    <mask id="ptg-mask">
                        <rect width="100%" height="100%" fill="white" />
                        {spotlight && (
                            <motion.rect
                                key={`spot-${step}`}
                                x={spotlight.x}
                                y={spotlight.y}
                                width={spotlight.w}
                                height={spotlight.h}
                                rx="10"
                                fill="black"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.25 }}
                            />
                        )}
                    </mask>
                </defs>
                <rect width="100%" height="100%" fill="rgba(0,0,0,0.78)" mask="url(#ptg-mask)" />
            </svg>

            {/* Spotlight glow border */}
            <AnimatePresence>
                {spotlight && (
                    <motion.div
                        key={`glow-${step}`}
                        className="pointer-events-none fixed z-[9001] rounded-[10px]"
                        style={{
                            left: spotlight.x,
                            top: spotlight.y,
                            width: spotlight.w,
                            height: spotlight.h,
                            border: "1.5px solid rgba(113,229,183,0.65)",
                            boxShadow:
                                "0 0 0 3px rgba(113,229,183,0.1), 0 0 28px rgba(113,229,183,0.22)",
                        }}
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.25 }}
                    />
                )}
            </AnimatePresence>

            {/* Tooltip */}
            <motion.div
                key={`tip-${step}`}
                className="pointer-events-auto fixed z-[9002] rounded-2xl border border-mint/20 py-5 px-[1.4rem]"
                style={{
                    width: TOOLTIP_W,
                    maxWidth: "calc(100vw - 2rem)",
                    top: tooltip.top,
                    left: tooltip.left,
                    background: "linear-gradient(135deg, rgba(10,18,26,0.98), rgba(6,12,18,0.98))",
                    boxShadow: "0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)",
                }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
                // Prevent clicks inside the tooltip from bubbling up to the SVG overlay,
                // which would skip to the next step unintentionally.
                onClick={(e) => e.stopPropagation()}
            >
                {/* Progress bar — completed steps are wider (flex: 2) and mint-colored,
                    upcoming steps are narrower (flex: 1) and dim. */}
                <div className="mb-4 flex gap-1.5">
                    {STEPS.map((_, i) => (
                        <div
                            key={i}
                            className="h-[3px] rounded-full transition-all duration-300"
                            style={{
                                flex: i <= step ? 2 : 1,
                                background: i <= step ? "#71e5b7" : "rgba(255,255,255,0.12)",
                            }}
                        />
                    ))}
                </div>

                <p className="mb-1.5 text-[0.62rem] font-black uppercase tracking-[0.1em] text-mint">
                    {isFirst ? "Quick tour" : `Step ${step} of ${STEPS.length - 1}`}
                </p>
                <h3 className="mb-2 text-[1.05rem] font-black leading-tight text-white">
                    {current.title}
                </h3>
                <p className="mb-4 text-[0.82rem] leading-relaxed text-white/60">{current.body}</p>

                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={dismiss}
                        className="cursor-pointer border-none bg-transparent p-0 text-[0.72rem] text-white/30"
                    >
                        Skip tour
                    </button>
                    <div className="flex gap-2">
                        {!isFirst && (
                            <button
                                type="button"
                                onClick={back}
                                className="flex cursor-pointer items-center gap-1 rounded-full border border-white/[0.12] bg-white/5 px-3.5 py-1.5 text-[0.78rem] font-bold text-white/65"
                            >
                                <ChevronLeft size={14} /> Back
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={next}
                            className="flex cursor-pointer items-center gap-1.5 rounded-full border-none bg-mint px-4 py-1.5 text-[0.78rem] font-black text-[#020504]"
                        >
                            {isLast ? (
                                <>
                                    <Trophy size={13} /> Done
                                </>
                            ) : (
                                <>
                                    Next <ChevronRight size={14} />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Close button */}
            <button
                type="button"
                onClick={dismiss}
                className="pointer-events-auto fixed right-4 top-4 z-[9003] flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/[0.07] text-white/55"
            >
                <X size={16} />
            </button>
        </div>
    );
}
