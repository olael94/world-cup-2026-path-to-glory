"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Trophy } from "lucide-react";

const STEPS = [
  {
    target: null,
    title: "Welcome to Path to Glory 🏆",
    body: "Your personal 2026 World Cup simulator. Drag teams, set scores, and watch the bracket build itself. Let's walk through how it works.",
  },
  {
    target: "[data-tutorial='groups'] .group-panel:first-child",
    title: "Shape the Groups",
    body: "Each panel is a group. Drag teams up or down to set your predicted finishing order. Positions 1 and 2 advance automatically, position 3 enters the wildcard race for the best third-place spots, and position 4 goes home.",
    padding: 12,
  },
  {
    target: "[data-tutorial='groups'] .group-panel .team-flip-button",
    title: "Team Elo and Form",
    body: "Every team has an Elo rating (historical strength) and a Form score (recent momentum). Tap the info icon on any team to see how they stack up going into the tournament.",
    padding: 10,
  },
  {
    target: "[data-tutorial='focus'] .focus-chip-row",
    title: "Group Focus",
    body: "Too many groups at once? Click any letter to isolate just those groups on the board. Mix and match to focus on the matchups you care about.",
    padding: 8,
  },
  {
    target: "[data-tutorial='mode']",
    title: "Simulator vs Real Data",
    body: "Simulator uses Elo ratings to predict every unplayed match. Switch to Real Data once live results are available and it takes over automatically.",
    padding: 8,
  },
  {
    target: "[data-tutorial='discipline']",
    title: "Discipline Slider",
    body: "When teams are level on points, FIFA uses fair-play tiebreakers. This slider controls how much that matters. Slide right to weight it more heavily.",
    padding: 8,
  },
  {
    target: "[data-tutorial='calculate']",
    title: "Hit Calculate",
    body: "Runs the full simulation in one shot. Group standings, wildcards, bracket seedings, Elo shifts and momentum for every team. Hit it again anytime you change something.",
    padding: 8,
  },
  {
    target: "[data-tutorial='reset']",
    title: "Reset",
    body: "Clears all your group orders and scores back to the default FIFA rankings. Use this to start a fresh scenario from scratch.",
    padding: 8,
  },
  {
    target: "[data-tutorial='draft']",
    title: "Draft and Saved",
    body: "Tracks whether your simulation has been calculated. Draft means you have unsaved changes. Once you hit Calculate it becomes Saved with a timestamp so you know exactly when your last snapshot was run.",
    padding: 8,
  },
];

const STORAGE_KEY = "ptg_tutorial_done";
const TOOLTIP_W = 340;
const TOOLTIP_H = 200;

export function Tutorial({ forceOpen = false, onClose }) {
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [spotlight, setSpotlight] = useState(null); // viewport coords for SVG
  const [tooltip, setTooltip] = useState({ top: 0, left: 0, place: "center" });
  const rafRef = useRef(null);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  // Only run on client
  useEffect(() => {
    setMounted(true);
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setActive(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (forceOpen) {
      setStep(0);
      setActive(true);
    }
  }, [forceOpen]);

  const measure = useCallback(() => {
    if (!current.target) {
      setSpotlight(null);
      setTooltip({ place: "center" });
      return;
    }
    const el = document.querySelector(current.target);
    if (!el) return;
    const pad = current.padding ?? 10;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Spotlight in viewport coords
    const sx = r.left - pad;
    const sy = r.top - pad;
    const sw = r.width + pad * 2;
    const sh = r.height + pad * 2;
    setSpotlight({ x: sx, y: sy, w: sw, h: sh });

    // Scroll element into view if needed
    const midY = r.top + r.height / 2;
    if (r.top < 80 || r.bottom > vh - 80) {
      window.scrollTo({ top: window.scrollY + midY - vh / 2, behavior: "smooth" });
    }

    // Tooltip in viewport coords
    const spaceBelow = vh - (r.bottom + pad) - 16;
    const spaceAbove = (r.top - pad) - 16;
    let top, left;
    left = Math.max(16, Math.min(r.left + r.width / 2 - TOOLTIP_W / 2, vw - TOOLTIP_W - 16));
    if (spaceBelow >= TOOLTIP_H || spaceBelow >= spaceAbove) {
      top = r.bottom + pad + 12;
    } else {
      top = r.top - pad - TOOLTIP_H - 12;
    }
    setTooltip({ top, left, place: "near" });
  }, [current]);

  useEffect(() => {
    if (!active) return;
    // Small delay to let scroll settle
    const t = setTimeout(measure, 100);
    const onScroll = () => { cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(measure); };
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll);
    return () => { clearTimeout(t); window.removeEventListener("resize", onScroll); window.removeEventListener("scroll", onScroll); };
  }, [active, step, measure]);

  function dismiss() {
    setActive(false);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    if (onClose) onClose();
  }

  function next() {
    if (isLast) { dismiss(); return; }
    setStep(s => s + 1);
  }

  function back() {
    if (!isFirst) setStep(s => s - 1);
  }

  if (!mounted || !active) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, pointerEvents: "none" }}>
      {/* Dark overlay with spotlight cutout */}
      <svg
        style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "all" }}
        onClick={next}
      >
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
      {spotlight && (
        <motion.div
          key={`glow-${step}`}
          style={{
            position: "fixed",
            left: spotlight.x,
            top: spotlight.y,
            width: spotlight.w,
            height: spotlight.h,
            borderRadius: 10,
            border: "1.5px solid rgba(113,229,183,0.65)",
            boxShadow: "0 0 0 3px rgba(113,229,183,0.1), 0 0 28px rgba(113,229,183,0.22)",
            pointerEvents: "none",
            zIndex: 9001,
          }}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
        />
      )}

      {/* Tooltip */}
      <motion.div
        key={`tip-${step}`}
        style={{
          position: "fixed",
          zIndex: 9002,
          width: TOOLTIP_W,
          pointerEvents: "all",
          ...(tooltip.place === "center"
            ? { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
            : { top: tooltip.top, left: tooltip.left }),
          background: "linear-gradient(135deg, rgba(10,18,26,0.98), rgba(6,12,18,0.98))",
          border: "1px solid rgba(113,229,183,0.2)",
          borderRadius: "1rem",
          padding: "1.25rem 1.4rem",
          boxShadow: "0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)",
        }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
        onClick={e => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div style={{ display: "flex", gap: "0.3rem", marginBottom: "1rem" }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              height: 3, borderRadius: 999, flex: i <= step ? 2 : 1,
              background: i <= step ? "#71e5b7" : "rgba(255,255,255,0.12)",
              transition: "all 0.3s ease",
            }} />
          ))}
        </div>

        <p style={{ fontSize: "0.62rem", fontWeight: 900, letterSpacing: "0.1em", color: "#71e5b7", textTransform: "uppercase", marginBottom: "0.35rem" }}>
          {isFirst ? "Quick tour" : `Step ${step} of ${STEPS.length - 1}`}
        </p>
        <h3 style={{ fontSize: "1.05rem", fontWeight: 900, color: "#fff", marginBottom: "0.45rem", lineHeight: 1.2 }}>
          {current.title}
        </h3>
        <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.62)", lineHeight: 1.5, marginBottom: "1.1rem" }}>
          {current.body}
        </p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={dismiss} style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            Skip tour
          </button>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {!isFirst && (
              <button onClick={back} style={{
                display: "flex", alignItems: "center", gap: "0.25rem",
                padding: "0.4rem 0.85rem", borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.65)", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
              }}>
                <ChevronLeft size={14} /> Back
              </button>
            )}
            <button onClick={next} style={{
              display: "flex", alignItems: "center", gap: "0.3rem",
              padding: "0.4rem 1rem", borderRadius: 999,
              background: "#71e5b7", border: "none",
              color: "#020504", fontSize: "0.78rem", fontWeight: 900, cursor: "pointer",
            }}>
              {isLast ? <><Trophy size={13} /> Done</> : <>Next <ChevronRight size={14} /></>}
            </button>
          </div>
        </div>
      </motion.div>

      {/* X button */}
      <button onClick={dismiss} style={{
        position: "fixed", top: 16, right: 16, zIndex: 9003,
        background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 999, width: 36, height: 36,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", color: "rgba(255,255,255,0.55)", pointerEvents: "all",
      }}>
        <X size={16} />
      </button>
    </div>
  );
}
