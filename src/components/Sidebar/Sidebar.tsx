import React, { useState, memo } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { AlgorithmSelector } from './AlgorithmSelector';
import type { TrainingStatus, FitnessConfig } from '../../types';

interface SidebarProps {
    onRandomizeMap: () => void;
    onClearMap: () => void;
    onOpenSaveModal: () => void;
    onOpenLoadModal: () => void;
    
    selectedAlgo: string;
    setAlgo: (val: string) => void;
    speed: number;
    setSpeed: (val: number) => void;

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
    onStopSimulation: () => void;
    onTestAll: () => void;
    onResetMap: () => void;
    onFullReset: () => void;

    hasNn?: boolean;
    onReplayWithNN?: () => void;
}

export const Sidebar = memo<SidebarProps>((props) => {
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
    }) => {
        const rowId = `fitness-${cfgKey}`;
        return (
            <div className="flex items-center justify-between gap-2">
                <label htmlFor={rowId} className="text-[9px] text-slate-400 flex-1 truncate cursor-pointer" title={label}>{label}</label>
                <input
                    id={rowId}
                    name={rowId}
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
    };

    return (
        <div className="w-full lg:w-80 flex flex-col gap-6">
            <Card variant="glass" className="text-left">
                {/* Header */}
                <div className="mb-6">
                    <h2 className="font-display text-sm font-semibold text-white tracking-wide">Simulation Setup</h2>
                    <div className="h-0.5 w-10 bg-cyan-400/50 rounded-full mt-2" />
                </div>

                <div className="space-y-6">
                    {/* Map Layout Section */}
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50 space-y-3">
                        <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block text-left ml-1">Map Layout</label>
                        
                        <div className="grid grid-cols-2 gap-2">
                            <Button 
                                variant="primary" 
                                size="sm" 
                                onClick={props.onRandomizeMap} 
                                disabled={props.isRunning || props.isTesting}
                            >
                                RANDOMIZE
                            </Button>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={props.onClearMap} 
                                disabled={props.isRunning || props.isTesting}
                            >
                                CLEAR MAP
                            </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <Button 
                                variant="secondary" 
                                size="sm" 
                                onClick={props.onOpenSaveModal}
                                disabled={props.isRunning || props.isTesting}
                            >
                                SAVE MAP
                            </Button>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={props.onOpenLoadModal}
                                disabled={props.isRunning || props.isTesting}
                            >
                                LOAD MAP
                            </Button>
                        </div>
                    </div>


                    {/* Algorithm Selector */}
                    <AlgorithmSelector
                        selectedAlgo={props.selectedAlgo}
                        onSelect={props.setAlgo}
                        isRunning={props.isRunning}
                    />

                    {/* Speed control */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                            <label htmlFor="simulation-speed" className="text-[11px] font-medium text-slate-400 tracking-wide cursor-pointer">Speed</label>
                            <span className="text-[11px] font-semibold text-cyan-400 font-display tabular-nums">
                                {((1000 / Math.max(10, 140 - props.speed)) * 0.045).toFixed(1)} m/s
                            </span>
                        </div>
                        <input
                            id="simulation-speed"
                            name="simulation-speed"
                            type="range"
                            min={10}
                            max={135}
                            step={5}
                            value={props.speed}
                            onChange={(e) => props.setSpeed(Number(e.target.value))}
                            disabled={props.isRunning}
                            className="range-cyan w-full disabled:opacity-50"
                        />
                        <div className="flex justify-between text-[9px] font-medium text-slate-600 px-0.5">
                            <span>1x</span>
                            <span>2x</span>
                            <span>5x</span>
                        </div>
                    </div>
                </div>

                {/* Primary Actions */}
                <div className="mt-10 space-y-3 pt-6 border-t border-slate-800/50">
                    <Button
                        variant={props.isRunning || props.isTesting ? 'danger' : 'primary'}
                        size="lg"
                        fullWidth
                        onClick={props.isRunning || props.isTesting ? props.onStopSimulation : props.onRunSimulation}
                        className="text-sm py-4"
                    >
                        {props.isTesting ? 'STOP TEST ALL' : props.isRunning ? 'STOP' : 'START WORK'}
                    </Button>

                    {props.hasNn && props.selectedAlgo !== 'neural_network' && !props.isRunning && !props.isTesting && (
                        <Button
                            variant="indigo"
                            size="md"
                            fullWidth
                            onClick={props.onReplayWithNN}
                            className="text-xs py-3 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)] hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all font-bold animate-pulse"
                        >
                            ⚡ REPLAY WITH EVOLVED NN
                        </Button>
                    )}
                    
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        fullWidth 
                        onClick={props.onTestAll} 
                        disabled={props.isRunning || props.isTesting}
                    >
                        TEST ALL
                    </Button>
                    
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" fullWidth onClick={props.onResetMap}>
                            CLEAR PATH
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
                    <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block text-left ml-1">Neural Network (NN)</label>

                    {props.trainingStatus.isTraining ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-tight">Gen {props.trainingStatus.epoch}</span>
                                    <span className="text-[9px] text-indigo-500 font-mono">Fitness: {Math.round(props.trainingStatus.bestFitness)}</span>
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
                                    ↑ Best AI is shown on the main map
                                </div>
                            )}

                            <Button variant="danger" size="sm" fullWidth onClick={props.onStopTrainNN}>
                                STOP TRAINING
                            </Button>
                        </div>
                    ) : (
                        <Button variant="indigo" size="sm" fullWidth onClick={props.onTrainNN}>
                            START EVOLUTION
                        </Button>
                    )}


                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" fullWidth onClick={props.onDownloadModel} disabled={props.trainingStatus.isTraining}>
                            EXPORT
                        </Button>
                        <label htmlFor="import-model" className={`flex-1 bg-transparent border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white py-2 rounded-xl text-[10px] font-black tracking-widest cursor-pointer text-center flex items-center justify-center transition-all ${props.trainingStatus.isTraining ? 'opacity-50 pointer-events-none' : ''}`}>
                            IMPORT
                            <input id="import-model" name="import-model" type="file" className="hidden" onChange={props.onUploadModel} accept=".json" />
                        </label>
                    </div>

                    {/* Fitness Config Toggle */}
                    <button
                        onClick={() => setShowFitness(v => !v)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition-all"
                    >
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">⚙ Training Parameters</span>
                        <span className="text-[10px] text-slate-600">{showFitness ? '▲' : '▼'}</span>
                    </button>

                    {showFitness && (
                        <div className="space-y-3 bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
                            {/* Rewards */}
                            <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">✦ Rewards</p>
                            <div className="space-y-2">
                                <FitnessRow label="New Cell" cfgKey="discoveryReward" />
                                <FitnessRow label="Correct Direction Step" cfgKey="orientationBonus" step={10} />
                                <FitnessRow label="Straight Line Step" cfgKey="straightLineBonus" step={50} />
                                <FitnessRow label="Completion + Return" cfgKey="completionBonus" />
                                <FitnessRow label="Battery Efficiency ×" cfgKey="batteryEfficiencyWeight" />
                            </div>

                            {/* Penalties */}
                            <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest mt-2">✦ Penalties</p>
                            <div className="space-y-2">
                                <FitnessRow label="Mowed Grass Revisit" cfgKey="mowedRevisitPenalty" step={10} />
                                <FitnessRow label="Cyclic Movement" cfgKey="oscillationPenalty" />
                                <FitnessRow label="Turn" cfgKey="turnPenalty" step={10} />
                                <FitnessRow label="Out of Battery Outside Dock" cfgKey="batteryOutPenalty" />
                                <FitnessRow label="Grass Damage ×" cfgKey="damageWeight" />
                                <FitnessRow label="Charge Cycle ×" cfgKey="chargeCycleWeight" />
                            </div>

                            {/* Hard limits */}
                            <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest mt-2">✦ Hard Limits</p>
                            <div className="space-y-2">
                                <FitnessRow label="Visit Limit (Disqual.)" cfgKey="visitLimit" step={1} min={2} max={20} />
                                <FitnessRow label="Max Revisit Ratio" cfgKey="maxMowedRevisitRatio" step={0.05} min={0.05} max={1} />
                            </div>
                        </div>
                    )}
                </div>
            </Card>

        </div>
    );
});
Sidebar.displayName = 'Sidebar';
