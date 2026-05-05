import React from 'react';
import { Button } from '../ui/Button';
import { Slider } from '../ui/Slider';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    
    maxBattery: number;
    setMaxBattery: (val: number) => void;
    drainMove: number;
    setDrainMove: (val: number) => void;
    drainTurn: number;
    setDrainTurn: (val: number) => void;
    speed: number;
    setSpeed: (val: number) => void;
    
    orientation: string;
    setOrientation: (val: string) => void;
    
    isRunning: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = (props) => {
    if (!props.isOpen) return null;

    return (
        <div className="modal-backdrop" onClick={props.onClose}>
            <div className="modal-content border border-slate-700/50 max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Simuliacijos Nustatymai</h2>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Konfigūruokite roboto parametrus</p>
                    </div>
                    <button onClick={props.onClose} className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 text-slate-500 hover:text-white transition-colors text-2xl flex items-center justify-center">&times;</button>
                </div>

                <div className="space-y-8 bg-slate-950/50 p-8 rounded-[2rem] border border-slate-800 shadow-inner">
                    <div className="space-y-6">
                        <Slider label="Baterijos talpa" value={props.maxBattery} min={10} max={200} step={10} onChange={props.setMaxBattery} disabled={props.isRunning} suffix="%" />
                        <Slider label="Energijos sąnaudos (judesys)" value={props.drainMove} min={0.01} max={1.0} step={0.01} onChange={props.setDrainMove} disabled={props.isRunning} />
                        <Slider label="Energijos sąnaudos (posūkis)" value={props.drainTurn} min={0} max={2.0} step={0.1} onChange={props.setDrainTurn} disabled={props.isRunning} />
                        <Slider label="Simuliacijos Greitis" value={props.speed} min={10} max={135} step={5} onChange={props.setSpeed} disabled={props.isRunning} />
                        
                        <div className="space-y-3 pt-2">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block text-left">Pjovimo Kryptis</label>
                            <div className="flex gap-2 p-1.5 bg-slate-950 rounded-2xl border border-slate-800/50">
                                <button 
                                    onClick={() => props.setOrientation('vertical')} 
                                    className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${props.orientation === 'vertical' ? 'bg-emerald-500 text-emerald-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    VERTIKALIAI
                                </button>
                                <button 
                                    onClick={() => props.setOrientation('horizontal')} 
                                    className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${props.orientation === 'horizontal' ? 'bg-emerald-500 text-emerald-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    HORIZONTALIAI
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8">
                    <Button variant="primary" size="lg" fullWidth onClick={props.onClose}>
                        UŽDARYTI IR IŠSAUGOTI
                    </Button>
                </div>
            </div>
        </div>
    );
};
