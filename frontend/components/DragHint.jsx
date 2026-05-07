"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

function HandOpen() {
    return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
                d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10V6a2 2 0 0 0-4 0v8l-1.6-1.6a2 2 0 0 0-2.77 2.88L5 19a6 6 0 0 0 6 5h2a6 6 0 0 0 6-6v-3a2 2 0 0 0-2-2h-3Z"
                stroke="white"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function HandGrab() {
    return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
                d="M8 11 C8 9.3 9.3 8 11 8 L14 8 C15.7 8 17 9.3 17 11"
                stroke="white"
                strokeWidth="1.6"
                strokeLinecap="round"
            />
            <path d="M10 8 L10 6 C10 5.2 10.9 4.5 11.5 5" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M12.5 8 L12.5 5 C12.5 4.2 13.4 3.8 14 4.2" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M15 8 L15 6.5 C15 5.7 15.9 5.2 16.5 5.6" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
            <path
                d="M8 11 L8 15 C8 17.2 9.8 19 12 19 L13 19 C15.2 19 17 17.2 17 15 L17 11"
                stroke="white"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M8 12.5 C6.5 12.5 5.5 13.5 5.5 15 C5.5 16.5 6.5 17.5 8 17.5"
                stroke="white"
                strokeWidth="1.6"
                strokeLinecap="round"
            />
        </svg>
    );
}

// Measures the center of the GripVertical icon on the 2nd team row of the first group
// relative to the parent .relative wrapper, so the hint lands exactly on the drag handle.
function useGripPosition() {
    const [pos, setPos] = useState(null);

    useLayoutEffect(() => {
        function measure() {
            const groupsSection = document.querySelector(".groups-section");
            if (!groupsSection) return;

            const wrapper = groupsSection.parentElement;
            const firstGroup = groupsSection.querySelector(".grid.gap-2");
            const row2 = firstGroup?.children[1];
            const grip = row2?.querySelector("svg");

            if (!grip || !wrapper) return;

            const gripRect = grip.getBoundingClientRect();
            const wrapperRect = wrapper.getBoundingClientRect();

            setPos({
                x: Math.round(gripRect.left - wrapperRect.left + gripRect.width / 2),
                y: Math.round(gripRect.top - wrapperRect.top + gripRect.height / 2),
            });
        }

        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, []);

    return pos;
}

export function DragHint() {
    const pos = useGripPosition();

    // Ghost height (2.8rem) + hand-group negative margin (-0.3rem) + half SVG (14px)
    // = offset from .drag-hint top to hand center
    const HAND_OFFSET_Y = 2.8 * 16 - 0.3 * 16 + 14; // ~54px
    // hand-group margin-left (1.4rem) + half SVG (14px)
    const HAND_OFFSET_X = 1.4 * 16 + 14; // ~36px

    const style = pos
        ? {
              left: `${pos.x - HAND_OFFSET_X}px`,
              top: `${pos.y - HAND_OFFSET_Y}px`,
              opacity: 1,
          }
        : { opacity: 0 }; // hidden until measured

    return (
        <div className="drag-hint" aria-hidden="true" style={style}>
            <div className="drag-hint-ghost">
                <span className="drag-hint-ghost-rank">2</span>
                <span className="drag-hint-ghost-bar" />
            </div>

            <div className="drag-hint-hand-group">
                <div className="drag-hint-hand">
                    <div className="drag-hint-hand-open"><HandOpen /></div>
                    <div className="drag-hint-hand-grab"><HandGrab /></div>
                </div>
                <div className="drag-hint-label">
                    <span className="drag-hint-label-primary">Drag to rank your groups</span>
                    <span className="drag-hint-label-secondary">Optionally enter scores, then calculate</span>
                </div>
            </div>
        </div>
    );
}
