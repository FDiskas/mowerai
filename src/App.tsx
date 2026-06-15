import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useGeminiAI } from './hooks/useGeminiAI';
import { useNeuralNetwork } from './hooks/useNeuralNetwork';
import {
    CELL_TYPES,
    ALGORITHMS_LIST,
} from './constants';
import type { Grid as GridType, Stats } from './types';

// UI Components
import { Sidebar } from './components/Sidebar/Sidebar';
import { SimulationGrid } from './components/Grid/SimulationGrid';
import { MapToolbar } from './components/Grid/MapToolbar';
import { SettingsModal } from './components/Sidebar/SettingsModal';
import { StatsPanel } from './components/Stats/StatsPanel';
import { TopBar } from './components/Layout/TopBar';
import { TelemetryPanel } from './components/Stats/TelemetryPanel';
import { Button } from './components/ui/Button';
import { ALGORITHMS_NAMES } from './constants';

// Domain
import { useSimulation } from './hooks/useSimulation';
import { Position } from './domain/Position';
import { SimulationGrid as DomainGrid } from './domain/SimulationGrid';
import { SimulationStats, EfficiencyMetrics } from './domain/SimulationStats';

// Hooks
import { useAppSettings } from './hooks/useAppSettings';
import { useAppUI } from './hooks/useAppUI';
import { useAppSimulation } from './hooks/useAppSimulation';

/** Seed a natural-looking default scatter of trees / bushes / rocks (obstacles). */
const seedObstacles = (cells: GridType, dock: { x: number; y: number }): GridType => {
    const rows = cells.length;
    const cols = cells[0]?.length ?? 0;
    return cells.map((row, r) => row.map((cell, c) => {
        if (cell.type === CELL_TYPES.DOCK) return cell;
        // keep a clear landing zone around the dock
        if (Math.abs(r - dock.y) <= 1 && Math.abs(c - dock.x) <= 1) return cell;
        const h = Math.abs((r * 928371) ^ (c * 1299721) ^ ((r + c) * 40503));
        const nearEdge = r < 2 || c < 2 || r > rows - 3 || c > cols - 3;
        const make = nearEdge ? h % 5 === 0 : h % 23 === 0;
        return make ? { ...cell, type: CELL_TYPES.OBSTACLE, damage: 0, direction: null } : cell;
    }));
};

/** Build a fresh grass grid of the given size with a dock and a seeded obstacle scatter. */
const buildGrid = (cols: number, rows: number, dock: { x: number; y: number }): GridType => {
    const base: GridType = Array(rows).fill(null).map((_, r) =>
        Array(cols).fill(null).map((_, c) => ({
            type: (r === dock.y && c === dock.x) ? CELL_TYPES.DOCK : CELL_TYPES.GRASS,
            damage: 0,
            direction: null
        }))
    );
    return seedObstacles(base, dock);
};

export const App: React.FC = () => {
    // UI State
    const [isDrawing, setIsDrawing] = useState(false);
    const [clock, setClock] = useState('');
    const [gridSize, setGridSize] = useState({ cols: 25, rows: 20 });

    useEffect(() => {
        const tick = () => setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        tick();
        const id = setInterval(tick, 15000);
        return () => clearInterval(id);
    }, []);

    // Settings & Config
    const settings = useAppSettings();
    const {
        brushType, setBrushType,
        algo, setAlgo,
        orientation, setOrientation,
        speed, setSpeed,
        maxBattery, setMaxBattery,
        drainMove, setDrainMove,
        drainTurn, setDrainTurn
    } = settings;

    const {
        statusMessage, setStatusMessage,
        toasts, showToast,
        isAnalysisOpen, setIsAnalysisOpen,
        isSettingsOpen, setIsSettingsOpen
    } = useAppUI();

    // Domain State
    const { env, setEnv, stats: domainStats, setStats: setDomainStats, history, setHistory, reset: resetSimulation } = useSimulation([], { x: 0, y: 0 }, maxBattery);

    // Derived UI State
    const grid = env.grid.cells;
    const mowerPos = env.mower.pos.toObject();
    const battery = env.mower.battery.current;
    const dockPos = useMemo(() => env.dockPos.toObject(), [env.dockPos.x, env.dockPos.y]);

    const stats: Stats = {
        distance: domainStats.movement.distance,
        mowedCount: domainStats.efficiency.mowedCount,
        totalGrass: domainStats.efficiency.totalGrass,
        turns: domainStats.movement.turns,
        chargeCycles: domainStats.impact.chargeCycles,
        startTime: null,
        endTime: null,
        accumulatedDuration: 0,
        history: history.records
    };

    // AI & NN Hooks
    const { aiPrompt, setAiPrompt, isAiLoading, aiFeedback, generateAiPattern, analyzeTerrain } = useGeminiAI();
    const { nn, trainingStatus, trainNN, stopTraining, downloadModel, uploadModel, showVisualTraining, setShowVisualTraining, previewGrid, previewMowerPos, previewMowerDir, fitnessConfig, setFitnessConfig } = useNeuralNetwork(dockPos, showToast, orientation as 'horizontal' | 'vertical', speed);

    const {
        isRunning,
        isTesting,
        prepareSimulationState,
        runSimulation,
        stopSimulation,
        testAll,
    } = useAppSimulation(
        env, setEnv,
        domainStats, setDomainStats,
        setHistory, resetSimulation,
        setAlgo,
        { algo, orientation, speed, maxBattery, drainMove, drainTurn },
        nn, showToast, setStatusMessage
    );

    const initGrid = useCallback(() => {
        const newGrid = buildGrid(gridSize.cols, gridSize.rows, dockPos);
        prepareSimulationState(newGrid);
        setStatusMessage("Ready for work");
    }, [gridSize, dockPos, prepareSimulationState, setStatusMessage]);

    const handleResize = useCallback((cols: number, rows: number) => {
        stopSimulation(true);
        const dock = { x: Math.min(dockPos.x, cols - 1), y: Math.min(dockPos.y, rows - 1) };
        setGridSize({ cols, rows });
        resetSimulation(buildGrid(cols, rows, dock), dock, maxBattery);
        setStatusMessage("Ready for work");
    }, [dockPos, maxBattery, resetSimulation, stopSimulation, setStatusMessage]);

    useEffect(() => {
        initGrid();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleGenerateAiPattern = () => {
        generateAiPattern(dockPos, (newGrid) => {
            const cleanGrid = prepareSimulationState(newGrid);
            setEnv(prev => prev.withGrid(new DomainGrid(cleanGrid)));
        });
    };

    const handleAnalyzeTerrain = () => {
        analyzeTerrain(grid);
        setIsAnalysisOpen(true);
    };

    const resetMowedOnly = () => {
        stopSimulation(true);
        prepareSimulationState(grid);
        showToast("Map cleared");
    };

    const resetFull = () => {
        stopSimulation(true);
        initGrid();
        showToast("System reboot successful", 'indigo');
    };

    const updateCell = (r: number, c: number) => {
        if (isRunning) return;

        const pos = new Position(c, r);
        const currentCell = env.grid.getCell(pos.toObject());

        if (brushType === CELL_TYPES.DOCK) {
            if (currentCell.type === CELL_TYPES.OBSTACLE) return;

            const newGridCells = env.grid.cells.map((row, rIdx) => row.map((cell, cIdx) => {
                if (cell.type === CELL_TYPES.DOCK) return { ...cell, type: CELL_TYPES.GRASS };
                if (rIdx === r && cIdx === c) return { ...cell, type: CELL_TYPES.DOCK, damage: 0 };
                return cell;
            }));

            resetSimulation(newGridCells, { x: c, y: r }, maxBattery);
            return;
        }

        const newType = currentCell.type === brushType ? CELL_TYPES.GRASS : brushType as any;
        const nextGrid = env.grid.updateCell(pos.toObject(), { type: newType, damage: 0, direction: null });

        setEnv(prev => prev.withGrid(nextGrid));
        setDomainStats(s => new SimulationStats(s.movement, new EfficiencyMetrics(s.efficiency.mowedCount, nextGrid.countGrass()), s.impact));
    };

    // Note: duration is calculated based on accumulated time when session is not running.
    const duration = Math.round((stats.accumulatedDuration || 0) / 1000);
    const winnerId = useMemo(() => history.getWinnerId(), [history]);
    const currentDamage = useMemo(() => {
        return env.grid.cells.flat().filter(c => c.type === CELL_TYPES.MOWED && c.damage > 0).length;
    }, [env.grid.cells]);

    // Telemetry (right panel) derivations
    const coverage = stats.totalGrass > 0 ? (stats.mowedCount / stats.totalGrass) * 100 : 0;
    const batteryPct = (battery / maxBattery) * 100;
    const stepDelay = Math.max(10, 140 - speed);
    const speedLabel = `${((1000 / stepDelay) * 0.045).toFixed(1)} m/s`;
    const complexity = stats.distance > 0 ? Math.min(100, (stats.turns / stats.distance) * 220) : 0;
    const algoName = ALGORITHMS_NAMES[algo as keyof typeof ALGORITHMS_NAMES] || algo;

    return (
        <div className="flex flex-col items-center p-4 md:p-6 min-h-screen text-slate-200 font-sans selection:bg-cyan-500/30" onMouseUp={() => setIsDrawing(false)}>
            <div className="w-full max-w-[1500px]">
                <TopBar
                    lawnName="Maple St. Lot"
                    algorithmName={algoName}
                    status={isRunning ? 'Mowing' : statusMessage}
                    isActive={isRunning && !isTesting}
                    time={clock}
                />

                <div className="flex flex-col lg:flex-row gap-6 items-start justify-center">
                    <Sidebar
                        aiPrompt={aiPrompt}
                        setAiPrompt={setAiPrompt}
                        isAiLoading={isAiLoading}
                        onGenerateAi={handleGenerateAiPattern}
                        onAnalyzeTerrain={handleAnalyzeTerrain}
                        selectedAlgo={algo}
                        setAlgo={setAlgo}
                        speed={speed}
                        setSpeed={setSpeed}
                        brushType={brushType}
                        setBrushType={setBrushType}
                        cellTypes={CELL_TYPES}
                        trainingStatus={trainingStatus}
                        fitnessConfig={fitnessConfig}
                        setFitnessConfig={setFitnessConfig}
                        showVisualTraining={showVisualTraining}
                        onToggleVisualTraining={() => setShowVisualTraining(!showVisualTraining)}
                        onTrainNN={() => trainNN(grid, drainMove, drainTurn)}
                        onStopTrainNN={stopTraining}
                        onDownloadModel={downloadModel}
                        onUploadModel={uploadModel}
                        isRunning={isRunning}
                        isTesting={isTesting}
                        onRunSimulation={runSimulation}
                        onStopSimulation={() => stopSimulation(true)}
                        onTestAll={() => testAll(ALGORITHMS_LIST as string[], grid)}
                        onResetMap={resetMowedOnly}
                        onFullReset={resetFull}
                    />

                    <div className="flex flex-col items-center min-w-0 shrink-0 mt-2 lg:mt-0 mr-0 lg:mr-12">
                        <div className="relative">
                            <SimulationGrid
                                grid={showVisualTraining && previewGrid ? previewGrid : grid}
                                mowerPos={showVisualTraining && previewMowerPos ? previewMowerPos : mowerPos}
                                mowerDir={showVisualTraining && previewMowerDir ? previewMowerDir : env.mower.nav.dir}
                                isAiLoading={isAiLoading}
                                onMouseDown={() => setIsDrawing(true)}
                                onCellClick={showVisualTraining ? undefined : updateCell}
                                onCellMouseEnter={(r, c) => !showVisualTraining && isDrawing && updateCell(r, c)}
                                onResize={isRunning || showVisualTraining ? undefined : handleResize}
                            />

                            <MapToolbar
                                brushType={brushType}
                                setBrushType={setBrushType}
                                cellTypes={CELL_TYPES}
                                onOpenSettings={() => setIsSettingsOpen(true)}
                            />
                        </div>

                        <SettingsModal
                            isOpen={isSettingsOpen}
                            onClose={() => setIsSettingsOpen(false)}
                            maxBattery={maxBattery}
                            setMaxBattery={setMaxBattery}
                            drainMove={drainMove}
                            setDrainMove={setDrainMove}
                            drainTurn={drainTurn}
                            setDrainTurn={setDrainTurn}
                            speed={speed}
                            setSpeed={setSpeed}
                            orientation={orientation}
                            setOrientation={setOrientation}
                            isRunning={isRunning}
                        />
                    </div>

                    <TelemetryPanel
                        coverage={coverage}
                        durationSec={duration}
                        batteryPct={batteryPct}
                        speedLabel={speedLabel}
                        complexity={complexity}
                    />
                </div>

                <StatsPanel
                    stats={stats}
                    duration={duration}
                    winnerId={winnerId}
                    currentDamage={currentDamage}
                />
            </div>

            {isAnalysisOpen && aiFeedback && (
                <div className="modal-backdrop" onClick={() => setIsAnalysisOpen(false)}>
                    <div className="modal-content border border-emerald-500/20" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h2 className="text-2xl font-black text-white uppercase tracking-tight">AI Territory Analysis</h2>
                                <p className="text-emerald-500 text-[10px] font-black uppercase tracking-widest mt-1">Created using Gemini Flash</p>
                            </div>
                            <button onClick={() => setIsAnalysisOpen(false)} className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 text-slate-500 hover:text-white transition-colors text-2xl flex items-center justify-center">&times;</button>
                        </div>
                        <div className="space-y-4 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap bg-slate-950/80 p-8 rounded-[2rem] border border-slate-800 shadow-inner">
                            {String(aiFeedback)}
                        </div>
                        <div className="mt-8">
                            <Button variant="primary" size="lg" fullWidth onClick={() => setIsAnalysisOpen(false)}>
                                UNDERSTAND ANALYSIS
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="toast-container">
                {toasts.map(t => (
                    <div key={t.id} className={`toast ${t.type === 'error' ? 'error' : t.type === 'indigo' ? 'indigo' : ''}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm
                            ${t.type === 'error' ? 'bg-rose-500/20 text-rose-500' : t.type === 'indigo' ? 'bg-indigo-500/20 text-indigo-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                            {t.type === 'error' ? '!' : t.type === 'indigo' ? '⚡' : '✓'}
                        </div>
                        {t.msg}
                    </div>
                ))}
            </div>
        </div>
    );
};