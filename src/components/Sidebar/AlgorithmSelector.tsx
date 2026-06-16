import React, { useState } from 'react';
import { ALGORITHMS_NAMES } from '../../constants';

interface AlgorithmSelectorProps {
    selectedAlgo: string;
    onSelect: (algo: string) => void;
    isRunning?: boolean;
}

/** Compact stroke icon per algorithm. */
const AlgoIcon: React.FC<{ algo: string }> = ({ algo }) => {
    const common = { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24' };
    switch (algo) {
        case 'neural_network':
            return <svg {...common}><circle cx="12" cy="5" r="2" /><circle cx="5" cy="12" r="2" /><circle cx="19" cy="12" r="2" /><circle cx="12" cy="19" r="2" /><path d="M12 7v10M7 12h10M6.5 10.5l11 3M17.5 10.5l-11 3" /></svg>;
        case 'boustrophedon':
            return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
        case 'energy_conservative_sweep':
            return <svg {...common}><path d="M4 8h16M20 8v8M20 16H4" /></svg>;
        case 'spiral':
            return <svg {...common}><path d="M12 12a1.5 1.5 0 1 0 1.5 1.5M13.5 13.5A3.5 3.5 0 1 0 8.5 12M8.5 12A6 6 0 1 0 18 12" /></svg>;
        case 'dfs_coverage':
            return <svg {...common}><path d="M4 5h10a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h12" /></svg>;
        case 'rrt':
            return <svg {...common}><path d="M12 21v-6M12 15l-5-4M12 15l6-5M7 11V6M18 10V5" /><circle cx="7" cy="5" r="1.4" /><circle cx="18" cy="4" r="1.4" /></svg>;
        case 'smart_ai':
        case 'potential_field':
            return <svg {...common}><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /><circle cx="12" cy="12" r="4" /></svg>;
        default:
            // pathfinding (a_star)
            return <svg {...common}><circle cx="6" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="M8 6h6a2 2 0 0 1 2 2v8" /></svg>;
    }
};

export const AlgorithmSelector: React.FC<AlgorithmSelectorProps> = ({
    selectedAlgo,
    onSelect,
    isRunning = false
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const groups: Record<string, string[]> = {
        'AI & Autonomous': ['smart_ai', 'neural_network', 'potential_field'],
        'Coverage & Sweep': ['boustrophedon', 'energy_conservative_sweep', 'spiral', 'dfs_coverage', 'rrt'],
        'Pathfinding': ['a_star'],
    };

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
                <label className="text-[11px] font-medium text-slate-400 tracking-wide">Algorithm</label>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                    {isExpanded ? 'Collapse' : 'Show all'}
                </button>
            </div>

            <div className="space-y-3">
                {Object.entries(groups).map(([groupName, algos]) => {
                    const isAnyInGroupSelected = algos.includes(selectedAlgo);
                    if (!isExpanded && !isAnyInGroupSelected) return null;

                    return (
                        <div key={groupName} className="space-y-2">
                            {isExpanded && (
                                <h4 className="text-[8px] font-bold text-slate-600 uppercase tracking-[0.2em] ml-1">
                                    {groupName}
                                </h4>
                            )}
                            <div className="grid grid-cols-1 gap-2">
                                {algos.map(a => {
                                    const selected = selectedAlgo === a;
                                    return (
                                        <button
                                            key={a}
                                            onClick={() => onSelect(a)}
                                            disabled={isRunning}
                                            className={`w-full px-3 py-2.5 rounded-xl text-[12px] font-medium transition-all border flex items-center gap-3 text-left
                                                disabled:opacity-50 disabled:cursor-not-allowed
                                                ${selected
                                                    ? 'bg-cyan-500/10 text-white border-cyan-400/60 shadow-[0_0_18px_-4px_rgba(34,211,238,0.6)]'
                                                    : 'bg-slate-800/40 text-slate-400 border-white/5 hover:border-white/10 hover:bg-slate-800/70'
                                                }`}
                                        >
                                            <span className={selected ? 'text-cyan-300' : 'text-slate-500'}>
                                                <AlgoIcon algo={a} />
                                            </span>
                                            <span className="flex-1 truncate">
                                                {ALGORITHMS_NAMES[a as keyof typeof ALGORITHMS_NAMES]}
                                            </span>
                                            {a === 'neural_network' && (
                                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-400/30 tracking-wider">
                                                    AI
                                                </span>
                                            )}
                                            {selected && (
                                                <svg viewBox="0 0 24 24" className="w-4 h-4 text-cyan-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M20 6 9 17l-5-5" />
                                                </svg>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
