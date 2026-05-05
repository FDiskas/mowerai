import React, { useState } from 'react';
import { ALGORITHMS_NAMES } from '../../constants';

interface AlgorithmSelectorProps {
    selectedAlgo: string;
    onSelect: (algo: string) => void;
    isRunning?: boolean;
}

export const AlgorithmSelector: React.FC<AlgorithmSelectorProps> = ({
    selectedAlgo,
    onSelect,
    isRunning = false
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Group algorithms for better UX
    const groups = {
        'AI & Learning': ['smart_ai', 'neural_network', 'custom_mower'],
        'Boustrophedon': ['cellular_boustrophedon', 'slam_boustrophedon', 'zigzag', 'u_shape'],
        'Pathfinding': ['a_star', 'dijkstra', 'bfs', 'greedy_bfs', 'jps', 'd_star_lite'],
    };

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Algoritmas
                </label>
                <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-[9px] font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase"
                >
                    {isExpanded ? 'Suskleisti' : 'Rodyti visus'}
                </button>
            </div>

            <div className="space-y-4">
                {Object.entries(groups).map(([groupName, algos]) => {
                    const isAnyInGroupSelected = algos.includes(selectedAlgo);
                    if (!isExpanded && !isAnyInGroupSelected) return null;

                    return (
                        <div key={groupName} className="space-y-2">
                            <h4 className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">
                                {groupName}
                            </h4>
                            <div className="grid grid-cols-1 gap-1.5">
                                {algos.map(a => (
                                    <button
                                        key={a}
                                        onClick={() => onSelect(a)}
                                        disabled={isRunning}
                                        className={`w-full p-2.5 rounded-xl text-[10px] font-bold transition-all border text-left flex justify-between items-center group
                                            ${selectedAlgo === a 
                                                ? 'bg-emerald-500 text-emerald-950 border-emerald-400 shadow-lg shadow-emerald-500/20' 
                                                : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800'
                                            }`}
                                    >
                                        <span>{ALGORITHMS_NAMES[a as keyof typeof ALGORITHMS_NAMES]}</span>
                                        {selectedAlgo === a && (
                                            <div className="w-1.5 h-1.5 bg-emerald-950 rounded-full animate-pulse"></div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
