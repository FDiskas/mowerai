import React from 'react';
import { Card } from '../ui/Card';
import type { Stats as StatsType } from '../../types';
import { ALGORITHMS_NAMES } from '../../constants';

interface StatsPanelProps {
    stats: StatsType;
    duration: number;
    winnerId: number | null;
    currentDamage: number;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats, duration, winnerId, currentDamage }) => {
    const coverage = stats.totalGrass > 0 ? ((stats.mowedCount / stats.totalGrass) * 100).toFixed(1) : "0";
    const efficiency = stats.distance > 0 ? (stats.mowedCount / stats.distance).toFixed(2) : "0";

    const StatCard = ({ label, value, subvalue, colorClass = "text-white" }: any) => (
        <div className="bg-slate-950/40 p-5 rounded-[2rem] border border-slate-800/50 flex flex-col items-center justify-center gap-1 group hover:border-slate-700 transition-all">
            <span className="text-[8px] text-slate-500 font-black uppercase tracking-[0.2em]">{label}</span>
            <span className={`text-2xl font-black leading-none ${colorClass}`}>{value}</span>
            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-tight">{subvalue}</span>
        </div>
    );

    return (
        <Card variant="glass" className="w-full mt-8 p-10">
            <div className="flex flex-col items-center mb-10">
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-2">Darbo Analitika</h2>
                <div className="h-1 w-12 bg-emerald-500/30 rounded-full"></div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard label="Padengimas" value={`${coverage}%`} subvalue={`${stats.mowedCount} / ${stats.totalGrass} lang.`} colorClass="text-emerald-400" />
                <StatCard label="Atstumas" value={`${stats.distance}m`} subvalue={`${duration} sek. darbo`} colorClass="text-cyan-400" />
                <StatCard label="Manevrai" value={stats.turns} subvalue="Posūkiai" colorClass="text-amber-500" />
                <StatCard label="Ciklai" value={stats.chargeCycles} subvalue="Įkrovimai" colorClass="text-blue-400" />
                <StatCard label="Pažeidimai" value={currentDamage} subvalue="Lauko žala" colorClass="text-rose-400" />
            </div>

            <div className="mt-10 flex justify-center gap-12 pt-8 border-t border-slate-800/30">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Efektyvumas: <span className="text-slate-200">{efficiency} p/m</span></span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Baterijos Panaudojimas: <span className="text-slate-200">{stats.chargeCycles}x</span></span>
                </div>
            </div>

            {/* History Section */}
            {stats.history && stats.history.length > 0 && (
                <div className="mt-16 space-y-6">
                    <div className="flex items-center gap-4">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Sesijų Istorija</h3>
                        <div className="h-[1px] flex-1 bg-slate-800"></div>
                    </div>

                    <div className="space-y-3">
                        {[...stats.history].reverse().map((record, i) => (
                            <div 
                                key={record.id} 
                                className={`p-5 rounded-[1.5rem] border transition-all duration-300 flex flex-col md:flex-row gap-6 md:items-center justify-between
                                    ${record.id === winnerId 
                                        ? 'border-amber-500/50 bg-amber-500/5 shadow-[0_0_30px_rgba(245,158,11,0.1)]' 
                                        : 'bg-slate-950/30 border-slate-800/50 hover:border-slate-700'
                                    }`}
                            >
                                <div className="flex items-center gap-5 min-w-[200px]">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs
                                        ${record.id === winnerId ? 'bg-amber-500 text-amber-950' : 'bg-slate-800 text-slate-400'}`}>
                                        #{stats.history.length - i}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className={`text-[11px] font-black uppercase tracking-wider ${record.id === winnerId ? 'text-amber-400' : 'text-emerald-400'}`}>
                                            {ALGORITHMS_NAMES[record.algo as keyof typeof ALGORITHMS_NAMES] || record.algo}
                                        </span>
                                        {record.id === winnerId && (
                                            <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1">
                                                <span>👑</span> Geriausias Rezultatas
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 md:flex md:gap-8 flex-1 text-right md:text-center">
                                    <div className="flex flex-col"><span className="text-slate-500 text-[7px] font-black uppercase">Veikimas</span><span className="text-slate-200 text-xs font-mono">{record.duration}s</span></div>
                                    <div className="flex flex-col"><span className="text-slate-500 text-[7px] font-black uppercase">Mow</span><span className="text-slate-200 text-xs font-mono">{record.mowedCount}</span></div>
                                    <div className="flex flex-col"><span className="text-slate-500 text-[7px] font-black uppercase">Metrai</span><span className="text-slate-200 text-xs font-mono">{record.distance}m</span></div>
                                    <div className="flex flex-col"><span className="text-slate-500 text-[7px] font-black uppercase">Pasūk.</span><span className="text-slate-200 text-xs font-mono">{record.turns}</span></div>
                                    <div className="flex flex-col"><span className="text-rose-500 text-[7px] font-black uppercase">Žala</span><span className="text-rose-400 text-xs font-mono">{record.damagedGrass}</span></div>
                                    <div className="flex flex-col bg-slate-900/50 px-3 py-1 rounded-lg border border-slate-800"><span className="text-amber-500 text-[7px] font-black uppercase">Taškai</span><span className="text-amber-400 text-xs font-black font-mono">{record.penalty}</span></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </Card>
    );
};
