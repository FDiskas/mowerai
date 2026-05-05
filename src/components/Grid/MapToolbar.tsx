import React from 'react';
import { Button } from '../ui/Button';
import { CELL_TYPES } from '../../constants';

interface MapToolbarProps {
    brushType: string;
    setBrushType: (val: string) => void;
    cellTypes: typeof CELL_TYPES;
    onOpenSettings: () => void;
}

export const MapToolbar: React.FC<MapToolbarProps> = ({ brushType, setBrushType, cellTypes, onOpenSettings }) => {
    return (
        <div className="absolute -right-16 top-1/2 -translate-y-1/2 flex flex-col gap-3 bg-slate-950/60 backdrop-blur-2xl p-2.5 rounded-[2rem] border border-slate-800/50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-30 ring-1 ring-white/5">
            <div className="text-[7px] font-black text-slate-600 uppercase tracking-[0.2em] text-center mb-1 select-none">Map</div>
            
            <button 
                onClick={onOpenSettings}
                className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-500 group relative bg-slate-900/50 text-slate-500 hover:text-white hover:bg-slate-800/80 hover:scale-110 mb-2 border border-slate-800/50 shadow-lg"
            >
                <div className="w-4 h-4 border-2 border-current rounded-full flex items-center justify-center group-hover:rotate-90 transition-transform duration-500">
                    <div className="w-1 h-1 bg-current rounded-full" />
                </div>
                <span className="absolute left-full ml-4 px-2 py-1 bg-slate-900 text-slate-200 text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-slate-800 shadow-xl">
                    NUSTATYMAI
                </span>
            </button>

            <div className="w-full h-px bg-slate-800/50 my-1" />
            <div className="text-[7px] font-black text-slate-600 uppercase tracking-[0.2em] text-center mb-1 select-none">Edit</div>
            
            <button 
                onClick={() => setBrushType(cellTypes.OBSTACLE)}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-500 group relative ${
                    brushType === cellTypes.OBSTACLE 
                    ? 'bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.5)] scale-110 z-10' 
                    : 'bg-slate-900/50 text-slate-500 hover:text-slate-300 hover:bg-slate-800/80 hover:scale-105'
                }`}
            >
                <div className={`w-3.5 h-3.5 bg-current rounded-sm transition-transform duration-500 ${brushType === cellTypes.OBSTACLE ? 'rotate-45' : 'group-hover:rotate-12'}`} />
                <span className="absolute left-full ml-4 px-2 py-1 bg-slate-900 text-slate-200 text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-slate-800 shadow-xl">
                    KLIŪTIS
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
                <div className={`w-3.5 h-3.5 border-2 border-current rounded-sm transition-transform duration-500 ${brushType === cellTypes.GRASS ? 'scale-110' : 'group-hover:scale-90'}`} />
                <span className="absolute left-full ml-4 px-2 py-1 bg-slate-900 text-slate-200 text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-slate-800 shadow-xl">
                    VEJA
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
                <div className={`w-3.5 h-3.5 rounded-full border-2 border-current transition-all duration-500 ${brushType === cellTypes.DOCK ? 'scale-110 border-4' : 'group-hover:scale-125'}`} />
                <span className="absolute left-full ml-4 px-2 py-1 bg-slate-900 text-slate-200 text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-slate-800 shadow-xl">
                    BAZĖ
                </span>
            </button>
        </div>
    );
};
