import React from 'react';
import { Card } from '../ui/Card';

interface StatusBarProps {
    statusMessage: string;
    battery: number;
    maxBattery: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({ statusMessage, battery, maxBattery }) => {
    const batteryPercentage = (battery / maxBattery) * 100;
    const isLowBattery = batteryPercentage < 20;

    return (
        <Card variant="glass" className="w-full mb-6 py-5 px-8 flex flex-col gap-4">
            <div className="flex justify-between items-end">
                <div className="flex flex-col items-start gap-1">
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">System Status</span>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${statusMessage.toLowerCase().includes('low') || statusMessage.toLowerCase().includes('empty') ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                        <span className={`text-sm font-bold tracking-tight ${statusMessage.toLowerCase().includes('low') || statusMessage.toLowerCase().includes('empty') ? 'text-rose-400' : 'text-slate-200'}`}>
                            {statusMessage}
                        </span>
                    </div>
                </div>
                
                <div className="text-right flex flex-col items-end gap-1">
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Energy Reserve</span>
                    <div className="flex items-baseline gap-2">
                        <span className={`font-mono text-2xl font-black ${isLowBattery ? 'text-rose-500 animate-pulse' : 'text-emerald-400'}`}>
                            {batteryPercentage.toFixed(1)}%
                        </span>
                        <span className="text-[10px] text-slate-600 font-bold uppercase">{battery.toFixed(0)} / {maxBattery} units</span>
                    </div>
                </div>
            </div>

            <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden p-[2px] border border-slate-800 shadow-inner">
                <div 
                    className={`h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_15px_rgba(16,185,129,0.3)]
                        ${isLowBattery ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                    style={{ width: `${Math.max(2, batteryPercentage)}%` }}
                >
                    <div className="w-full h-full bg-white/20 animate-[shimmer_2s_infinite]"></div>
                </div>
            </div>
        </Card>
    );
};
