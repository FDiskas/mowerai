import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useGeminiAI } from './hooks/useGeminiAI';
import { useNeuralNetwork } from './hooks/useNeuralNetwork';
import {
    CELL_TYPES,
    ALGORITHMS_LIST,
} from './constants';
import type { Grid as GridType, Stats } from './types';
import { resetLawn } from './utils/simUtils';

// UI Components
import { Sidebar } from './components/Sidebar/Sidebar';
import { SimulationGrid } from './components/Grid/SimulationGrid';
import { MapToolbar } from './components/Grid/MapToolbar';
import { SettingsModal } from './components/Sidebar/SettingsModal';
import { StatsPanel } from './components/Stats/StatsPanel';
import { TopBar } from './components/Layout/TopBar';
import { Footer } from './components/Layout/Footer';
import { TelemetryPanel } from './components/Stats/TelemetryPanel';
import { Button } from './components/ui/Button';
import { ALGORITHMS_NAMES } from './constants';

// Domain
import { useSimulation } from './hooks/useSimulation';
import { Position } from './domain/Position';
import { SimulationGrid as DomainGrid } from './domain/SimulationGrid';
import { SimulationStats, EfficiencyMetrics } from './domain/SimulationStats';
import { SimulationHistory } from './domain/SimulationHistory';

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

    // Persist Grid Layout in localStorage
    useEffect(() => {
        if (env && env.grid && env.grid.cells && env.grid.cells.length > 0) {
            try {
                const layout = {
                    cols: gridSize.cols,
                    rows: gridSize.rows,
                    dockPos: env.dockPos.toObject(),
                    cells: env.grid.cells.map(row => row.map(cell => ({
                        type: cell.type === CELL_TYPES.MOWED ? CELL_TYPES.GRASS : cell.type,
                        damage: 0,
                        direction: null
                    })))
                };
                localStorage.setItem('mowerai_saved_map', JSON.stringify(layout));
            } catch (e) {
                console.error("Failed to save map to localStorage", e);
            }
        }
    }, [env.grid.cells, env.dockPos, gridSize]);

    const initGrid = useCallback(() => {
        const saved = localStorage.getItem('mowerai_saved_map');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setGridSize({ cols: parsed.cols, rows: parsed.rows });
                const cleanGrid = resetLawn(parsed.cells);
                prepareSimulationState(cleanGrid, parsed.dockPos);
                setStatusMessage("Ready for work");
                return;
            } catch (e) {
                console.error("Failed to load saved map", e);
            }
        }
        const newGrid = buildGrid(gridSize.cols, gridSize.rows, dockPos);
        prepareSimulationState(newGrid);
        setStatusMessage("Ready for work");
    }, [gridSize.cols, gridSize.rows, dockPos, prepareSimulationState, setStatusMessage]);

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

    // Keep refs of frequently changing states so callbacks can remain reference-stable
    const envRef = useRef(env);
    const gridRef = useRef(grid);
    const brushTypeRef = useRef(brushType);
    const isRunningRef = useRef(isRunning);
    const maxBatteryRef = useRef(maxBattery);
    const isDrawingRef = useRef(isDrawing);
    const showVisualTrainingRef = useRef(showVisualTraining);
    const drainMoveRef = useRef(drainMove);
    const drainTurnRef = useRef(drainTurn);

    useEffect(() => {
        envRef.current = env;
        gridRef.current = grid;
        brushTypeRef.current = brushType;
        isRunningRef.current = isRunning;
        maxBatteryRef.current = maxBattery;
        isDrawingRef.current = isDrawing;
        showVisualTrainingRef.current = showVisualTraining;
        drainMoveRef.current = drainMove;
        drainTurnRef.current = drainTurn;
    }, [env, grid, brushType, isRunning, maxBattery, isDrawing, showVisualTraining, drainMove, drainTurn]);

    const handleGenerateAiPattern = useCallback(() => {
        generateAiPattern(dockPos, (newGrid) => {
            const cleanGrid = prepareSimulationState(newGrid);
            setEnv(prev => prev.withGrid(new DomainGrid(cleanGrid)));
        });
    }, [dockPos, generateAiPattern, prepareSimulationState, setEnv]);

    const handleAnalyzeTerrain = useCallback(() => {
        analyzeTerrain(gridRef.current);
        setIsAnalysisOpen(true);
    }, [analyzeTerrain, setIsAnalysisOpen]);

    const resetMowedOnly = useCallback(() => {
        stopSimulation(true);
        prepareSimulationState(gridRef.current);
        showToast("Map cleared");
    }, [stopSimulation, prepareSimulationState, showToast]);

    const resetFull = useCallback(() => {
        stopSimulation(true);
        // Clear localStorage on full reset so it returns to initial seeded obstacles
        localStorage.removeItem('mowerai_saved_map');
        initGrid();
        showToast("System reboot successful", 'indigo');
    }, [stopSimulation, initGrid, showToast]);

    const handleSetAlgo = useCallback((newAlgo: string) => {
        setAlgo(newAlgo);
        if (!isRunningRef.current) {
            stopSimulation(true);
            prepareSimulationState(gridRef.current);
            showToast(`Switched to ${ALGORITHMS_NAMES[newAlgo as keyof typeof ALGORITHMS_NAMES] || newAlgo}. Lawn cleared.`);
        }
    }, [setAlgo, stopSimulation, prepareSimulationState, showToast]);

    const handleReplayWithNN = useCallback(() => {
        setAlgo('neural_network');
        stopSimulation(true);
        prepareSimulationState(gridRef.current);
        setTimeout(() => {
            runSimulation();
        }, 50);
    }, [setAlgo, stopSimulation, prepareSimulationState, runSimulation]);

    const handleCellClick = useCallback((r: number, c: number) => {
        if (isRunningRef.current) return;

        const currentEnv = envRef.current;
        const currentBrushType = brushTypeRef.current;
        const pos = new Position(c, r);
        const currentCell = currentEnv.grid.getCell(pos.toObject());

        if (currentBrushType === CELL_TYPES.DOCK) {
            if (currentCell.type === CELL_TYPES.OBSTACLE) return;

            const newGridCells = currentEnv.grid.cells.map((row: any, rIdx: number) => row.map((cell: any, cIdx: number) => {
                if (cell.type === CELL_TYPES.DOCK) return { ...cell, type: CELL_TYPES.GRASS };
                if (rIdx === r && cIdx === c) return { ...cell, type: CELL_TYPES.DOCK, damage: 0 };
                return cell;
            }));

            resetSimulation(newGridCells, { x: c, y: r }, maxBatteryRef.current);
            return;
        }

        const newType = currentCell.type === currentBrushType ? CELL_TYPES.GRASS : currentBrushType as any;
        const nextGrid = currentEnv.grid.updateCell(pos.toObject(), { type: newType, damage: 0, direction: null });

        setEnv(prev => prev.withGrid(nextGrid));
        setDomainStats(s => new SimulationStats(s.movement, new EfficiencyMetrics(s.efficiency.mowedCount, nextGrid.countGrass()), s.impact));
    }, [resetSimulation, setEnv, setDomainStats]);

    const handleCellMouseEnter = useCallback((r: number, c: number) => {
        if (!showVisualTrainingRef.current && isDrawingRef.current) {
            handleCellClick(r, c);
        }
    }, [handleCellClick]);

    const handleToggleVisualTraining = useCallback(() => {
        setShowVisualTraining(v => !v);
    }, [setShowVisualTraining]);

    const handleTrainNN = useCallback(() => {
        trainNN(gridRef.current, drainMoveRef.current, drainTurnRef.current);
    }, [trainNN]);

    const handleStopSimulation = useCallback(() => {
        stopSimulation(true);
    }, [stopSimulation]);

    const handleTestAll = useCallback(() => {
        testAll(ALGORITHMS_LIST as string[], gridRef.current);
    }, [testAll]);

    const handleOpenSettings = useCallback(() => {
        setIsSettingsOpen(true);
    }, [setIsSettingsOpen]);

    const handleCloseSettings = useCallback(() => {
        setIsSettingsOpen(false);
    }, [setIsSettingsOpen]);

    const handleClearHistory = useCallback(() => {
        setHistory(new SimulationHistory([]));
    }, [setHistory]);

    const handleMouseDown = useCallback(() => {
        setIsDrawing(true);
    }, []);

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
                        setAlgo={handleSetAlgo}
                        speed={speed}
                        setSpeed={setSpeed}
                        brushType={brushType}
                        setBrushType={setBrushType}
                        cellTypes={CELL_TYPES}
                        trainingStatus={trainingStatus}
                        fitnessConfig={fitnessConfig}
                        setFitnessConfig={setFitnessConfig}
                        showVisualTraining={showVisualTraining}
                        onToggleVisualTraining={handleToggleVisualTraining}
                        onTrainNN={handleTrainNN}
                        onStopTrainNN={stopTraining}
                        onDownloadModel={downloadModel}
                        onUploadModel={uploadModel}
                        isRunning={isRunning}
                        isTesting={isTesting}
                        onRunSimulation={runSimulation}
                        onStopSimulation={handleStopSimulation}
                        onTestAll={handleTestAll}
                        onResetMap={resetMowedOnly}
                        onFullReset={resetFull}
                        hasNn={!!nn}
                        onReplayWithNN={handleReplayWithNN}
                    />

                    <div className="flex flex-col items-center min-w-0 shrink-0 mt-2 lg:mt-0 mr-0 lg:mr-12">
                        <div className="relative">
                            <SimulationGrid
                                grid={showVisualTraining && previewGrid ? previewGrid : grid}
                                mowerPos={showVisualTraining && previewMowerPos ? previewMowerPos : mowerPos}
                                mowerDir={showVisualTraining && previewMowerDir ? previewMowerDir : env.mower.nav.dir}
                                isAiLoading={isAiLoading}
                                onMouseDown={handleMouseDown}
                                onCellClick={showVisualTraining ? undefined : handleCellClick}
                                onCellMouseEnter={handleCellMouseEnter}
                                onResize={isRunning || showVisualTraining ? undefined : handleResize}
                            />

                            <MapToolbar
                                brushType={brushType}
                                setBrushType={setBrushType}
                                cellTypes={CELL_TYPES}
                                onOpenSettings={handleOpenSettings}
                            />
                        </div>

                        <SettingsModal
                            isOpen={isSettingsOpen}
                            onClose={handleCloseSettings}
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
                    onClearHistory={handleClearHistory}
                />

                <Footer />
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