import React from 'react';

interface TelemetryPanelProps {
    coverage: number;       // 0-100
    durationSec: number;
    batteryPct: number;     // 0-100
    speedLabel: string;     // e.g. "0.8 m/s"
    complexity: number;     // 0-100, path complexity index
}

const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
};

const MetricBar: React.FC<{ pct: number; from: string; to: string }> = ({ pct, from, to }) => (
    <div className="w-full h-1.5 rounded-full bg-slate-800/80 overflow-hidden mt-2">
        <div
            className={`h-full rounded-full bg-gradient-to-r ${from} ${to} transition-all duration-500 ease-out`}
            style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
        />
    </div>
);

const Metric: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="pb-5 mb-5 border-b border-white/5 last:border-0 last:pb-0 last:mb-0">
        <p className="text-[11px] font-medium text-slate-500 tracking-wide">{label}</p>
        {children}
    </div>
);

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({
    coverage, durationSec, batteryPct, speedLabel, complexity
}) => {
    return (
        <aside className="w-full lg:w-64 shrink-0 rounded-[1.75rem] bg-slate-900/50 border border-white/5
            backdrop-blur-xl p-6 shadow-[0_20px_60px_-25px_rgba(0,0,0,0.8)]">
            <h2 className="text-[12px] font-semibold text-slate-300 tracking-wide mb-6">
                Stats & Telemetry
            </h2>

            <Metric label="Coverage">
                <p className="font-display text-2xl font-bold text-white mt-1">{coverage.toFixed(0)}%</p>
                <MetricBar pct={coverage} from="from-cyan-400" to="to-emerald-400" />
            </Metric>

            <Metric label="Time Elapsed">
                <p className="font-display text-2xl font-bold text-white mt-1 tabular-nums">{formatTime(durationSec)}</p>
            </Metric>

            <Metric label="Battery">
                <p className="font-display text-2xl font-bold text-white mt-1">{batteryPct.toFixed(0)}%</p>
                <MetricBar pct={batteryPct} from={batteryPct < 20 ? 'from-rose-500' : 'from-emerald-500'} to={batteryPct < 20 ? 'to-rose-400' : 'to-lime-400'} />
            </Metric>

            <Metric label="Current Speed">
                <p className="font-display text-2xl font-bold text-white mt-1 tabular-nums">{speedLabel}</p>
            </Metric>

            <Metric label="Path Complexity">
                <div className="flex items-center gap-2 mt-2">
                    <MetricBar pct={complexity} from="from-violet-500" to="to-cyan-400" />
                </div>
            </Metric>
        </aside>
    );
};
