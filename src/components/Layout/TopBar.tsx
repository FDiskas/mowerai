import React from 'react';

interface Chip {
    label: string;
    value: string;
    accent?: boolean;
}

interface TopBarProps {
    lawnName: string;
    algorithmName: string;
    status: string;
    isActive: boolean;
    time: string;
}

const InfoChip: React.FC<Chip> = ({ label, value, accent }) => (
    <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/60 border border-white/5 backdrop-blur">
        <span className="text-[11px] font-medium text-slate-500">{label}:</span>
        <span className={`text-[12px] font-semibold ${accent ? 'text-emerald-400' : 'text-slate-200'}`}>
            {value}
        </span>
    </div>
);

export const TopBar: React.FC<TopBarProps> = ({ lawnName, algorithmName, status, isActive, time }) => {
    return (
        <header className="w-full flex items-center justify-between gap-4 px-5 py-3 mb-6
            rounded-[1.5rem] bg-slate-900/50 border border-white/5 backdrop-blur-xl
            shadow-[0_10px_40px_-15px_rgba(0,0,0,0.7)]">

            {/* Brand */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center
                    shadow-[0_0_18px_rgba(16,185,129,0.35)]">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="7" cy="17" r="2" />
                        <circle cx="17" cy="17" r="2" />
                        <path d="M5 17H3v-4l3-5h7l4 5h2a2 2 0 0 1 2 2v2h-2" />
                        <path d="M9 17h6" />
                    </svg>
                </div>
                <div className="leading-none">
                    <h1 className="font-display text-lg font-bold text-white tracking-tight">
                        MowBot <span className="text-emerald-400">Sim</span>
                    </h1>
                    <span className="text-[10px] font-medium text-slate-500 tracking-widest">v2.5</span>
                </div>
            </div>

            {/* Status chips */}
            <div className="flex items-center gap-2.5">
                <InfoChip label="Lawn" value={lawnName} />
                <InfoChip label="Algorithm" value={algorithmName} />
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/60 border border-white/5 backdrop-blur">
                    <span className="text-[11px] font-medium text-slate-500">Status:</span>
                    <span className={`flex items-center gap-1.5 text-[12px] font-semibold ${isActive ? 'text-emerald-400' : 'text-slate-300'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-500'}`} />
                        {status}
                    </span>
                </div>
                <InfoChip label="Time" value={time} />
            </div>

            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-white/10
                flex items-center justify-center text-[11px] font-bold text-slate-300 shrink-0">
                JS
            </div>
        </header>
    );
};
