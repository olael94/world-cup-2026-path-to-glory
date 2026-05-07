"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
    {
        icon: "✦",
        text: "Let AI guide your predictions.",
        bg: "rgba(113, 229, 183, 0.10)",
        color: "#71e5b7",
    },
    {
        icon: "📡",
        text: "Live news, real injuries, and how every team is performing right now.",
        bg: "rgba(76, 132, 255, 0.10)",
        color: "#7eb4ff",
    },
    {
        icon: "🏆",
        text: "Analyzed so you know who's truly on a path to glory.",
        bg: "rgba(255, 177, 64, 0.10)",
        color: "#ffcf7b",
    },
];

// Must match the height set in .ai-scoreboard-wrap in globals.css.
// Both slides are rendered stacked — the container slides up by exactly this amount
// to reveal the next message, then the index updates and sliding resets invisibly.
const SLIDE_H = "3.2rem";

export function AiScoreboard() {
    const [index, setIndex] = useState(0);
    // true while the slide-up animation is playing, false once the swap is done.
    const [sliding, setSliding] = useState(false);
    const nextIndex = (index + 1) % MESSAGES.length;

    useEffect(() => {
        const interval = setInterval(() => {
            // Start the CSS slide-up animation.
            setSliding(true);
            // After 650ms (matching the CSS transition duration), swap the message
            // and reset the position so the next cycle starts clean from the top.
            setTimeout(() => {
                setIndex((prev) => (prev + 1) % MESSAGES.length);
                setSliding(false);
            }, 650);
        }, 8000);
        // Clear the interval when the component unmounts to avoid memory leaks.
        return () => clearInterval(interval);
    }, []);

    const current = MESSAGES[index];
    const next = MESSAGES[nextIndex];

    // aria-live="polite" tells screen readers to announce the new message
    // when it changes, without interrupting whatever the user is doing.
    return (
        <div className="ai-scoreboard-wrap" aria-live="polite">
            {/*
             * Two slides stacked vertically inside a clipped container.
             * When sliding=true, the whole column shifts up by one slide height,
             * making the next message appear to scroll in from below.
             * Once the animation finishes, the index updates and transition is
             * removed so the reset back to position 0 happens invisibly.
             */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                    transform: sliding ? `translateY(-${SLIDE_H})` : "translateY(0)",
                    transition: sliding ? "transform 0.65s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
                }}
            >
                <div
                    className="ai-scoreboard-slide"
                    style={{ height: SLIDE_H, background: current.bg }}
                >
                    <span className="ai-scoreboard-icon">{current.icon}</span>
                    <span className="ai-scoreboard-text" style={{ color: current.color }}>
                        {current.text}
                    </span>
                </div>
                <div
                    className="ai-scoreboard-slide"
                    style={{ height: SLIDE_H, background: next.bg }}
                >
                    <span className="ai-scoreboard-icon">{next.icon}</span>
                    <span className="ai-scoreboard-text" style={{ color: next.color }}>
                        {next.text}
                    </span>
                </div>
            </div>
        </div>
    );
}
