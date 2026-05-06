"use client";

import { motion } from "framer-motion";
import { Activity, CheckCircle2, Info, RotateCcw, Save } from "lucide-react";

export function ControlDock({
    dataMode,
    onDataMode,
    discipline,
    onDiscipline,
    onCalculate,
    onReset,
    snapshot,
    onHelp,
}) {
    return (
        <div className="control-dock">
            <div className="control-dock-rail">
                <div className="control-mode-group">
                    <div
                        className="control-mode-switch"
                        aria-label="Data mode"
                        data-tutorial="mode"
                    >
                        {[
                            ["simulation", "Simulator"],
                            ["real", "Real Data"],
                        ].map(([mode, label]) => (
                            <button
                                key={mode}
                                className={`control-mode-button ${dataMode === mode ? "is-active" : ""}`}
                                onClick={() => onDataMode(mode)}
                            >
                                {dataMode === mode ? (
                                    <motion.span
                                        className="control-mode-active"
                                        layoutId="control-mode-active"
                                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                                    />
                                ) : null}
                                <span className="control-mode-label">{label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="control-discipline-group" data-tutorial="discipline">
                    <div className="control-discipline-heading">
                        <span className="control-label">Discipline</span>
                        <span className="control-value">{discipline}</span>
                    </div>
                    <label className="control-slider-wrap">
                        <input
                            aria-label="Discipline slider"
                            className="control-slider accent-mint"
                            type="range"
                            min="0"
                            max="100"
                            value={discipline}
                            onChange={(event) => onDiscipline(Number(event.target.value))}
                        />
                    </label>
                </div>

                <div className="control-actions" aria-label="Scenario actions">
                    <button
                        className="control-action-primary"
                        data-tutorial="calculate"
                        onClick={onCalculate}
                    >
                        <Activity size={17} /> Calculate
                    </button>
                    <button
                        className="control-action-secondary"
                        data-tutorial="reset"
                        onClick={onReset}
                    >
                        <RotateCcw size={16} /> Reset
                    </button>
                    <div className="control-status" data-tutorial="draft">
                        {snapshot?.snapshotId ? <CheckCircle2 size={16} /> : <Save size={16} />}
                        {snapshot?.snapshotId ? "Saved" : "Draft"}
                    </div>
                </div>

                <button className="control-help-btn" onClick={onHelp}>
                    <Info size={15} /> Guide
                </button>
            </div>
        </div>
    );
}
