import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Slider } from '../ui/Slider';
import { AlgorithmSelector } from './AlgorithmSelector';
import type { TrainingStatus, Grid, Point, FitnessConfig } from '../../types';
import { CELL_TYPES } from '../../constants';

interface SidebarProps {
    aiPrompt: string;
    setAiPrompt: (val: string) => void;
    isAiLoading: boolean;
    onGenerateAi: () => void;
    onAnalyzeTerrain: () => void;
    
    selectedAlgo: string;
    setAlgo: (val: string) => void;
    
    brushType: string;
    setBrushType: (val: string) => void;
    cellTypes: any;
    
    trainingStatus: TrainingStatus;
    fitnessConfig: FitnessConfig;
    setFitnessConfig: (cfg: FitnessConfig) => void;
    showVisualTraining: boolean;
    onToggleVisualTraining: () => void;
    onTrainNN: () => void;
    onStopTrainNN: () => void;
    onDownloadModel: () => void;
    onUploadModel: (e: React.ChangeEvent<HTMLInputElement>) => void;
    
    isRunning: boolean;
    isTesting: boolean;
    onRunSimulation: () => void;
    onTestAll: () => void;
    onResetMap: () => void;
    onFullReset: () => void;
}

export const Sidebar: React.FC<SidebarProps> = (props) => {
    const [showFitness, setShowFitness] = useState(false);

    const updateCfg = (key: keyof FitnessConfig, val: number) => {
        props.setFitnessConfig({ ...props.fitnessConfig, [key]: val });
    };

    const FitnessRow = ({ label, cfgKey, step = 100, min = -50000, max = 50000 }: {
        label: string;
        cfgKey: keyof FitnessConfig;
        step?: number;
        min?: number;
        max?: number;
    }) => (
        <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] text-slate-400 flex-1 truncate" title={label}>{label}</span>
            <input
                type="number"
                step={step}
                min={min}
                max={max}
                value={props.fitnessConfig[cfgKey] as number}
                onChange={e => updateCfg(cfgKey, parseFloat(e.target.value) || 0)}
                className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-right font-mono text-indigo-300 focus:outline-none focus:border-indigo-500"
            />
        </div>
    );

    return (
        <div className="w-full lg:w-85 flex flex-col gap-6">
            <Card variant="glass" className="text-center">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8 justify-center">
                    <div className="p-2.5 bg-emerald-500/20 rounded-xl">
                        <div className="w-4 h-4 bg-emerald-500 rounded-sm rotate-45 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-tight text-white uppercase leading-none">MowerAI</h1>
                        <span className="text-emerald-500 text-[10px] font-bold tracking-widest uppercase">Version 5.2</span>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* AI Generation Section */}
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50 space-y-4">
                        <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block text-left ml-1">AI Parko Dizainas</label>
                        <div className="relative group">
                            <input 
                                type="text" 
                                placeholder="Sukurk parką..." 
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs outline-none focus:border-emerald-500 transition-all text-center pr-10" 
                                value={props.aiPrompt} 
                                onChange={(e) => props.setAiPrompt(e.target.value)} 
                            />
                            {props.isAiLoading && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button 
                                variant="primary" 
                                size="sm" 
                                fullWidth 
                                onClick={props.onGenerateAi} 
                                disabled={props.isAiLoading || !props.aiPrompt}
                            >
                                GENERUOTI
                            </Button>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                fullWidth 
                                onClick={props.onAnalyzeTerrain} 
                                disabled={props.isAiLoading}
                            >
                                ANALIZUOTI
                            </Button>
                        </div>
                    </div>


                    {/* Algorithm Selector */}
                    <AlgorithmSelector 
                        selectedAlgo={props.selectedAlgo} 
                        onSelect={props.setAlgo} 
                        isRunning={props.isRunning} 
                    />
                </div>

                {/* Primary Actions */}
                <div className="mt-10 space-y-3 pt-6 border-t border-slate-800/50">
                    <Button 
                        variant={props.isRunning && !props.isTesting ? 'danger' : 'primary'} 
                        size="lg" 
                        fullWidth 
                        onClick={props.onRunSimulation}
                        className="text-sm py-4"
                    >
                        {props.isRunning && !props.isTesting ? 'STABDYTI' : 'PRADĖTI DARBĄ'}
                    </Button>
                    
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        fullWidth 
                        onClick={props.onTestAll} 
                        disabled={props.isRunning || props.isTesting}
                    >
                        TESTUOTI VISUS
                    </Button>
                    
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" fullWidth onClick={props.onResetMap}>
                            VALYTI
                        </Button>
                        <Button variant="ghost" size="sm" fullWidth onClick={props.onFullReset} className="text-slate-600">
                            RESET
                        </Button>
                    </div>
                </div>
            </Card>

            {/* NN Training Block (Separate) */}
            <Card variant="glass" className="space-y-4">
                <div className="bg-indigo-500/5 border border-indigo-500/20 p-5 rounded-2xl space-y-4">
                    <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block text-left ml-1">Neurotinklas (NN)</label>

                    {props.trainingStatus.isTraining ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-tight">Karta {props.trainingStatus.epoch}</span>
                                    <span className="text-[9px] text-indigo-500 font-mono">Tikslumas: {Math.round(props.trainingStatus.bestFitness)}</span>
                                </div>
                                
                                <button 
                                    onClick={props.onToggleVisualTraining}
                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest transition-all ${
                                        props.showVisualTraining 
                                            ? 'bg-indigo-500 text-white shadow-[0_0_10px_rgba(99,102,241,0.4)]' 
                                            : 'bg-slate-900 text-slate-500 border border-slate-800'
                                    }`}
                                >
                                    {props.showVisualTraining ? '👁 LIVE ON' : '👁 LIVE OFF'}
                                </button>
                            </div>

                            <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-indigo-500/10">
                                <div
                                    className="h-full bg-indigo-500 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                                    style={{ width: `${Math.min(100, Math.max(0, (props.trainingStatus.bestFitness / 400000) * 100))}%` }}
                                ></div>
                            </div>

                            {props.showVisualTraining && (
                                <div className="text-[9px] text-indigo-400/60 text-center animate-pulse">
                                    ↑ Pagrindiniame žemėlapyje matosi geriausias AI
                                </div>
                            )}

                            <Button variant="danger" size="sm" fullWidth onClick={props.onStopTrainNN}>
                                STABDYTI MOKYMĄ
                            </Button>
                        </div>
                    ) : (
                        <Button variant="indigo" size="sm" fullWidth onClick={props.onTrainNN}>
                            PRADĖTI EVOLIUCIJĄ
                        </Button>
                    )}


                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" fullWidth onClick={props.onDownloadModel} disabled={props.trainingStatus.isTraining}>
                            EXPORT
                        </Button>
                        <label className={`flex-1 bg-transparent border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white py-2 rounded-xl text-[10px] font-black tracking-widest cursor-pointer text-center flex items-center justify-center transition-all ${props.trainingStatus.isTraining ? 'opacity-50 pointer-events-none' : ''}`}>
                            IMPORT
                            <input type="file" className="hidden" onChange={props.onUploadModel} accept=".json" />
                        </label>
                    </div>

                    {/* Fitness Config Toggle */}
                    <button
                        onClick={() => setShowFitness(v => !v)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition-all"
                    >
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">⚙ Mokymo parametrai</span>
                        <span className="text-[10px] text-slate-600">{showFitness ? '▲' : '▼'}</span>
                    </button>

                    {showFitness && (
                        <div className="space-y-3 bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
                            {/* Rewards */}
                            <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">✦ Apdovanojimai</p>
                            <div className="space-y-2">
                                <FitnessRow label="Naujas langelis" cfgKey="discoveryReward" />
                                <FitnessRow label="Teisingos krypties žingsnis" cfgKey="orientationBonus" step={10} />
                                <FitnessRow label="Tiesios linijos žingsnis" cfgKey="straightLineBonus" step={50} />
                                <FitnessRow label="Užbaigimas + grįžimas" cfgKey="completionBonus" />
                                <FitnessRow label="Baterijos efektyvumas ×" cfgKey="batteryEfficiencyWeight" />
                            </div>

                            {/* Penalties */}
                            <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest mt-2">✦ Baudos</p>
                            <div className="space-y-2">
                                <FitnessRow label="Nupjautos žolės perriedėjimas" cfgKey="mowedRevisitPenalty" step={10} />
                                <FitnessRow label="Ciklinis judėjimas" cfgKey="oscillationPenalty" />
                                <FitnessRow label="Posūkis" cfgKey="turnPenalty" step={10} />
                                <FitnessRow label="Baterija baigėsi ne doke" cfgKey="batteryOutPenalty" />
                                <FitnessRow label="Žolės pažeidimas ×" cfgKey="damageWeight" />
                                <FitnessRow label="Įkrovimo ciklas ×" cfgKey="chargeCycleWeight" />
                            </div>

                            {/* Hard limits */}
                            <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest mt-2">✦ Kietieji limitai</p>
                            <div className="space-y-2">
                                <FitnessRow label="Vizitų limitas (diskval.)" cfgKey="visitLimit" step={1} min={2} max={20} />
                                <FitnessRow label="Max perriedėjimų dalis" cfgKey="maxMowedRevisitRatio" step={0.05} min={0.05} max={1} />
                            </div>
                        </div>
                    )}
                </div>
            </Card>

        </div>
    );
};
