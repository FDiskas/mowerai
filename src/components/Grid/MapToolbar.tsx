import { memo } from 'react';
import { CELL_TYPES } from '../../constants';

interface MapToolbarProps {
    brushType: string;
    setBrushType: (val: string) => void;
    cellTypes: typeof CELL_TYPES;
}

export const MapToolbar = memo<MapToolbarProps>(({ brushType, setBrushType, cellTypes }) => {
    return (
        <div className="absolute -right-16 top-1/2 -translate-y-1/2 flex flex-col gap-3 bg-slate-950/60 backdrop-blur-2xl p-2.5 rounded-[2rem] border border-slate-800/50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-30 ring-1 ring-white/5">
            <div className="text-[7px] font-black text-slate-600 uppercase tracking-[0.2em] text-center mb-1 select-none">Edit</div>
            
            <button 
                onClick={() => setBrushType(cellTypes.OBSTACLE)}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-500 group relative ${
                    brushType === cellTypes.OBSTACLE 
                    ? 'bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.5)] scale-110 z-10' 
                    : 'bg-slate-900/50 text-slate-500 hover:text-slate-300 hover:bg-slate-800/80 hover:scale-105'
                }`}
            >
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-current group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L5 12h3v8h8v-8h3L12 2z" />
                </svg>
                <span className="absolute left-full ml-4 px-2 py-1 bg-slate-900 text-slate-200 text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-slate-800 shadow-xl">
                    OBSTACLE
                </span>
            </button>

            <button 
                onClick={() => setBrushType(cellTypes.GRASS) }
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-500 group relative ${
                    brushType === cellTypes.GRASS 
                    ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.5)] scale-110 z-10' 
                    : 'bg-slate-900/50 text-slate-500 hover:text-slate-300 hover:bg-slate-800/80 hover:scale-105'
                }`}
            >
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-current group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 22c.5-4.5 2.5-8.5 6-11" />
                    <path d="M12 22c0-5.5 1.5-10.5 4-13.5" />
                    <path d="M18 22c-1-3.5-3-6.5-6-8.5" />
                </svg>
                <span className="absolute left-full ml-4 px-2 py-1 bg-slate-900 text-slate-200 text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-slate-800 shadow-xl">
                    GRASS
                </span>
            </button>

            <button 
                onClick={() => setBrushType(cellTypes.DOCK)}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-500 group relative ${
                    brushType === cellTypes.DOCK 
                    ? 'bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.5)] scale-110 z-10' 
                    : 'bg-slate-900/50 text-slate-500 hover:text-slate-300 hover:bg-slate-800/80 hover:scale-105'
                }`}
            >
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-current group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="17" width="14" height="4" rx="1" />
                    <path d="M11 3L7 11h4l-1 6 5-8h-4l1-6z" fill="currentColor" />
                </svg>
                <span className="absolute left-full ml-4 px-2 py-1 bg-slate-900 text-slate-200 text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-slate-800 shadow-xl">
                    DOCK
                </span>
            </button>
        </div>
    );
});
MapToolbar.displayName = 'MapToolbar';

