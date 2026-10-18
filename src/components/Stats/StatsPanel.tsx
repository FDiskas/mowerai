import { memo } from 'react';
import { Card } from '../ui/Card';
import type { HistoryRecord, Stats as StatsType } from '../../types';
import { ALGORITHMS_NAMES } from '../../constants';
import { compareRuns } from '../../domain/SimulationHistory';

interface StatsPanelProps {
    stats: StatsType;
    coverage: number;
    duration: number;
    winnerId: number | null;
    currentDamage: number;
    onClearHistory: () => void;
}

interface HistoryListProps {
    history: HistoryRecord[];
    winnerId: number | null;
    onClearHistory: () => void;
}

type RunTone = 'latest' | 'winner' | 'default';

const RUN_TONE_CLASSES: Record<RunTone, { row: string; rank: string; name: string }> = {
    latest: {
        row: 'border-blue-500 bg-blue-950/15 shadow-[0_0_20px_rgba(59,130,246,0.35)] animate-pulse-subtle',
        rank: 'bg-blue-500 text-blue-950 shadow-[0_0_12px_rgba(59,130,246,0.5)]',
        name: 'text-blue-400',
    },
    winner: {
        row: 'border-amber-500/50 bg-amber-500/5 shadow-[0_0_30px_rgba(245,158,11,0.1)]',
        rank: 'bg-amber-500 text-amber-950',
        name: 'text-amber-400',
    },
    default: {
        row: 'bg-slate-950/30 border-slate-800/50 hover:border-slate-700',
        rank: 'bg-slate-800 text-slate-400',
        name: 'text-emerald-400',
    },
};

interface RunMetricProps {
    label: string;
    value: string | number;
    labelClass?: string;
    valueClass?: string;
}

const RunMetric = ({ label, value, labelClass = 'text-slate-500', valueClass = 'text-slate-200' }: RunMetricProps) => (
    <div className="flex flex-col"><span className={`${labelClass} text-[7px] font-black uppercase`}>{label}</span><span className={`${valueClass} text-xs font-mono`}>{value}</span></div>
);

const HistoryList = memo<HistoryListProps>(({ history, winnerId, onClearHistory }) => {
    const latestId = history.length > 0 ? Math.max(...history.map(r => r.id)) : null;
    const toneOf = (id: number): RunTone => id === latestId ? 'latest' : id === winnerId ? 'winner' : 'default';

    return (
        <div className="mt-16 space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Session History</h3>
                    <div className="h-px flex-1 bg-slate-800"></div>
                </div>
                <button
                    onClick={onClearHistory}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 hover:text-rose-400 hover:border-rose-500/30 transition-all text-[9px] font-black tracking-widest uppercase select-none"
                >
                    Clear Logs
                </button>
            </div>

            <div className="space-y-3">
                {[...history].sort(compareRuns).map((record, index) => {
                    const tone = RUN_TONE_CLASSES[toneOf(record.id)];
                    return (
                        <div
                            key={record.id}
                            className={`p-5 rounded-3xl border transition-all duration-300 flex flex-col md:flex-row gap-6 md:items-center justify-between
                                ${tone.row}`}
                        >
                            <div className="flex items-center gap-5 min-w-50">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs
                                    ${tone.rank}`}>
                                    #{index + 1}
                                </div>
                                <div className="flex flex-col">
                                    <span className={`text-[11px] font-black uppercase tracking-wider ${tone.name}`}>
                                        {ALGORITHMS_NAMES[record.algo as keyof typeof ALGORITHMS_NAMES] ?? record.algo}
                                    </span>
                                    {record.id === winnerId && (
                                        <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1">
                                            <span>👑</span> Best Result
                                        </span>
                                    )}
                                    {record.id === latestId && (
                                        <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1">
                                            <span>⚡</span> Latest Run
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-3 md:flex md:gap-8 flex-1 text-right md:text-center">
                                <RunMetric label="Runtime" value={`${record.duration}s`} />
                                <RunMetric label="Mow" value={record.mowedCount} />
                                <RunMetric label="Cover" value={`${record.coverage.toFixed(1)}%`} labelClass="text-emerald-500" valueClass="text-emerald-400" />
                                <RunMetric label="Meters" value={`${record.distance}m`} />
                                <RunMetric label="Turns" value={record.turns} />
                                <RunMetric label="Damage" value={record.damagedGrass} labelClass="text-rose-500" valueClass="text-rose-400" />
                                <div className="flex flex-col bg-slate-900/50 px-3 py-1 rounded-lg border border-slate-800"><span className="text-amber-500 text-[7px] font-black uppercase" title="Benchmark cost per reachable tile; lower is better">Cost / tile</span><span className="text-amber-400 text-xs font-black font-mono">{record.cost?.toFixed(3) ?? '—'}</span></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
HistoryList.displayName = 'HistoryList';

interface StatCardProps {
    label: string;
    value: string | number;
    subvalue: string;
    colorClass: string;
}

const StatCard = ({ label, value, subvalue, colorClass }: StatCardProps) => (
    <div className="bg-slate-950/40 p-5 rounded-4xl border border-slate-800/50 flex flex-col items-center justify-center gap-1 group hover:border-slate-700 transition-all">
        <span className="text-[8px] text-slate-500 font-black uppercase tracking-[0.2em]">{label}</span>
        <span className={`text-2xl font-black leading-none ${colorClass}`}>{value}</span>
        <span className="text-[9px] text-slate-600 font-bold uppercase tracking-tight">{subvalue}</span>
    </div>
);

export const StatsPanel = memo<StatsPanelProps>(({ stats, coverage, duration, winnerId, currentDamage, onClearHistory }) => {
    const efficiency = stats.distance > 0 ? (stats.mowedCount / stats.distance).toFixed(2) : "0";

    return (
        <Card variant="glass" className="w-full mt-8 p-10">
            <div className="flex flex-col items-center mb-10">
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-2">Work Analytics</h2>
                <div className="h-1 w-12 bg-emerald-500/30 rounded-full"></div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard label="Coverage" value={`${coverage.toFixed(1)}%`} subvalue={`${stats.mowedCount} / ${stats.totalGrass} cells`} colorClass="text-emerald-400" />
                <StatCard label="Distance" value={`${stats.distance}m`} subvalue={`${duration} sec. work`} colorClass="text-cyan-400" />
                <StatCard label="Maneuvers" value={stats.turns} subvalue="Turns" colorClass="text-amber-500" />
                <StatCard label="Cycles" value={stats.chargeCycles} subvalue="Charges" colorClass="text-blue-400" />
                <StatCard label="Damage" value={currentDamage} subvalue="Field Damage" colorClass="text-rose-400" />
            </div>

            <div className="mt-10 flex justify-center gap-12 pt-8 border-t border-slate-800/30">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Efficiency: <span className="text-slate-200">{efficiency} p/m</span></span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Battery Usage: <span className="text-slate-200">{stats.chargeCycles}x</span></span>
                </div>
            </div>

            {stats.history.length > 0 && (
                <HistoryList
                    history={stats.history}
                    winnerId={winnerId}
                    onClearHistory={onClearHistory}
                />
            )}
        </Card>
    );
});
StatsPanel.displayName = 'StatsPanel';
