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

const SLIDE_H = "3.2rem";

export function AiScoreboard() {
    const [index, setIndex] = useState(0);
    const [sliding, setSliding] = useState(false);
    const nextIndex = (index + 1) % MESSAGES.length;

    useEffect(() => {
        const interval = setInterval(() => {
            setSliding(true);
            setTimeout(() => {
                setIndex((prev) => (prev + 1) % MESSAGES.length);
                setSliding(false);
            }, 650);
        }, 8000);
        return () => clearInterval(interval);
    }, []);

    const current = MESSAGES[index];
    const next = MESSAGES[nextIndex];

    return (
        <div className="ai-scoreboard-wrap" aria-live="polite">
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
