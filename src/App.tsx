import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MapManagerModal } from './components/Sidebar/MapManagerModal';
import { useNeuralNetwork } from './hooks/useNeuralNetwork';
import { CELL_TYPES, ALGORITHMS_LIST, ALGORITHMS_NAMES } from './constants';
import type { Cell, Grid as GridType, PositionType, Stats } from './types';
import { resetLawn } from './utils/simUtils';
import { turnCostInSteps } from './algorithms';
import { speedLabel } from './utils/speed';

// UI Components
import { Sidebar } from './components/Sidebar/Sidebar';
import { SimulationGrid } from './components/Grid/SimulationGrid';
import { MapToolbar } from './components/Grid/MapToolbar';
import { SettingsModal } from './components/Sidebar/SettingsModal';
import { StatsPanel } from './components/Stats/StatsPanel';
import { TopBar } from './components/Layout/TopBar';
import { Footer } from './components/Layout/Footer';
import { TelemetryPanel } from './components/Stats/TelemetryPanel';

// Domain
import { useSimulation } from './hooks/useSimulation';
import { Position } from './domain/Position';
import { SimulationStats, EfficiencyMetrics } from './domain/SimulationStats';
import { SimulationHistory } from './domain/SimulationHistory';

// Hooks
import { useAppSettings } from './hooks/useAppSettings';
import { useAppUI } from './hooks/useAppUI';
import { useAppSimulation } from './hooks/useAppSimulation';

const isInDockLandingZone = (r: number, c: number, dock: PositionType) =>
    Math.abs(r - dock.y) <= 1 && Math.abs(c - dock.x) <= 1;

const freshCellOfType = (cell: Cell, type: Cell['type']): Cell =>
    ({ ...cell, type, damage: 0, direction: null });

/** Seed a natural-looking default scatter of trees / bushes / rocks (obstacles). */
const seedObstacles = (cells: GridType, dock: PositionType): GridType => {
    const rows = cells.length;
    const cols = cells[0]?.length ?? 0;
    return cells.map((row, r) => row.map((cell, c) => {
        if (cell.type === CELL_TYPES.DOCK || isInDockLandingZone(r, c, dock)) return cell;
        const h = Math.abs((r * 928371) ^ (c * 1299721) ^ ((r + c) * 40503));
        const nearEdge = r < 2 || c < 2 || r > rows - 3 || c > cols - 3;
        const make = nearEdge ? h % 5 === 0 : h % 23 === 0;
        return make ? freshCellOfType(cell, CELL_TYPES.OBSTACLE) : cell;
    }));
};

/** Build a fresh grass grid of the given size with a dock and a seeded obstacle scatter. */
const buildGrid = (cols: number, rows: number, dock: PositionType): GridType => {
    const base: GridType = Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => ({
            type: (r === dock.y && c === dock.x) ? CELL_TYPES.DOCK : CELL_TYPES.GRASS,
            damage: 0,
            direction: null
        }))
    );
    return seedObstacles(base, dock);
};

const SAVED_MAP_KEY = 'mowerai_saved_map';
const DEFAULT_GRID_SIZE = { cols: 25, rows: 20 };
const DEFAULT_DOCK: PositionType = { x: 0, y: 0 };

interface LawnLayout {
    cols: number;
    rows: number;
    dockPos: PositionType;
    cells: GridType;
}

/** The lawn the page starts with: the last saved layout, regrown, or a fresh seeded lawn. */
const loadInitialLayout = (): LawnLayout => {
    try {
        const saved = localStorage.getItem(SAVED_MAP_KEY);
        if (saved) {
            const layout: LawnLayout = JSON.parse(saved);
            return { ...layout, cells: resetLawn(layout.cells) };
        }
    } catch (e) {
        console.error("Failed to load saved map", e);
    }
    const { cols, rows } = DEFAULT_GRID_SIZE;
    return { cols, rows, dockPos: DEFAULT_DOCK, cells: buildGrid(cols, rows, DEFAULT_DOCK) };
};

const randomizeObstacles = (cells: GridType, dock: PositionType): GridType =>
    cells.map((row, r) => row.map((cell, c) => {
        if (cell.type === CELL_TYPES.DOCK || isInDockLandingZone(r, c, dock)) return cell;
        return freshCellOfType(cell, Math.random() < 0.15 ? CELL_TYPES.OBSTACLE : CELL_TYPES.GRASS);
    }));

const algorithmName = (id: string): string => ALGORITHMS_NAMES[id as keyof typeof ALGORITHMS_NAMES] ?? id;

const clearObstacles = (cells: GridType): GridType =>
    cells.map(row => row.map(cell =>
        cell.type === CELL_TYPES.DOCK ? cell : freshCellOfType(cell, CELL_TYPES.GRASS)
    ));

export const App: React.FC = () => {
    // UI State
    const [isDrawing, setIsDrawing] = useState(false);
    const [clock, setClock] = useState('');
    const [initialLayout] = useState(loadInitialLayout);
    const [gridSize, setGridSize] = useState({ cols: initialLayout.cols, rows: initialLayout.rows });

    useEffect(() => {
        const tick = () => setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        tick();
        const id = setInterval(tick, 15000);
        return () => clearInterval(id);
    }, []);

    // Settings & Config
    const {
        brushType, setBrushType,
        algo, setAlgo,
        orientation, setOrientation,
        speed, setSpeed,
        maxBattery, setMaxBattery,
        drainMove, setDrainMove,
        drainTurn, setDrainTurn
    } = useAppSettings();

    const {
        statusMessage, setStatusMessage,
        toasts, showToast,
        isSettingsOpen, setIsSettingsOpen
    } = useAppUI();

    // Domain State
    const { env, setEnv, stats: domainStats, setStats: setDomainStats, workTimeMs, setWorkTimeMs, history, setHistory, reset: resetSimulation } = useSimulation(initialLayout.cells, initialLayout.dockPos, maxBattery);

    // Derived UI State
    const grid = env.grid.cells;
    const mowerPos = env.mower.pos.toObject();
    const battery = env.mower.battery.current;
    const dockPos = useMemo(() => env.dockPos.toObject(), [env.dockPos]);

    const stats: Stats = useMemo(() => ({
        distance: domainStats.movement.distance,
        mowedCount: domainStats.efficiency.mowedCount,
        totalGrass: domainStats.efficiency.totalGrass,
        turns: domainStats.movement.turns,
        chargeCycles: domainStats.impact.chargeCycles,
        history: history.records
    }), [domainStats, history]);

    // Map Manager Modal State
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);
    const [mapModalMode, setMapModalMode] = useState<'save' | 'load'>('save');
    const { nn, trainingStatus, trainNN, stopTraining, downloadModel, uploadModel, clearModel, showVisualTraining, setShowVisualTraining, previewGrid, previewMowerPos, previewMowerDir, fitnessConfig, setFitnessConfig } = useNeuralNetwork(dockPos, showToast, orientation, speed);

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
        setWorkTimeMs,
        setHistory, resetSimulation,
        setAlgo,
        { algo, orientation, speed, maxBattery, drainMove, drainTurn, turnCost: turnCostInSteps(fitnessConfig) },
        nn, showToast, setStatusMessage
    );

    // Persist Grid Layout in localStorage
    useEffect(() => {
        try {
            const layout: LawnLayout = { ...gridSize, dockPos, cells: resetLawn(grid) };
            localStorage.setItem(SAVED_MAP_KEY, JSON.stringify(layout));
        } catch (e) {
            console.error("Failed to save map to localStorage", e);
        }
    }, [grid, dockPos, gridSize]);

    const handleResize = useCallback((cols: number, rows: number) => {
        stopSimulation(true);
        const dock = { x: Math.min(dockPos.x, cols - 1), y: Math.min(dockPos.y, rows - 1) };
        setGridSize({ cols, rows });
        resetSimulation(buildGrid(cols, rows, dock), dock, maxBattery);
        setStatusMessage("Ready for work");
    }, [dockPos, maxBattery, resetSimulation, stopSimulation, setStatusMessage]);

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

    const handleRandomizeMap = useCallback(() => {
        stopSimulation(true);
        const cleanGrid = randomizeObstacles(gridRef.current, dockPos);
        prepareSimulationState(cleanGrid);
        showToast("Map randomized with obstacles");
    }, [dockPos, stopSimulation, prepareSimulationState, showToast]);

    const handleClearMap = useCallback(() => {
        stopSimulation(true);
        const cleanGrid = clearObstacles(gridRef.current);
        prepareSimulationState(cleanGrid);
        showToast("Map cleared of all obstacles");
    }, [stopSimulation, prepareSimulationState, showToast]);

    const handleLoadMap = useCallback((cells: GridType, cols: number, rows: number, dock: PositionType) => {
        stopSimulation(true);
        setGridSize({ cols, rows });
        prepareSimulationState(cells, dock);
    }, [stopSimulation, prepareSimulationState]);

    const handleOpenSaveModal = useCallback(() => {
        setMapModalMode('save');
        setIsMapModalOpen(true);
    }, []);

    const handleOpenLoadModal = useCallback(() => {
        setMapModalMode('load');
        setIsMapModalOpen(true);
    }, []);

    const resetMowedOnly = useCallback(() => {
        stopSimulation(true);
        prepareSimulationState(gridRef.current);
        showToast("Map cleared");
    }, [stopSimulation, prepareSimulationState, showToast]);

    const resetFull = useCallback(() => {
        stopSimulation(true);
        localStorage.removeItem(SAVED_MAP_KEY);
        prepareSimulationState(buildGrid(gridSize.cols, gridSize.rows, dockPos));
        setStatusMessage("Ready for work");
        showToast("System reboot successful", 'indigo');
    }, [stopSimulation, prepareSimulationState, gridSize.cols, gridSize.rows, dockPos, setStatusMessage, showToast]);

    const handleSetAlgo = useCallback((newAlgo: string) => {
        setAlgo(newAlgo);
        if (!isRunningRef.current) {
            stopSimulation(true);
            prepareSimulationState(gridRef.current);
            showToast(`Switched to ${algorithmName(newAlgo)}. Lawn cleared.`);
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

            const newGridCells = currentEnv.grid.cells.map((row, rIdx) => row.map((cell, cIdx) => {
                if (cell.type === CELL_TYPES.DOCK) return { ...cell, type: CELL_TYPES.GRASS };
                if (rIdx === r && cIdx === c) return { ...cell, type: CELL_TYPES.DOCK, damage: 0 };
                return cell;
            }));

            resetSimulation(newGridCells, { x: c, y: r }, maxBatteryRef.current);
            return;
        }

        const newType = currentCell.type === currentBrushType ? CELL_TYPES.GRASS : currentBrushType;
        const nextGrid = currentEnv.grid.updateCell(pos.toObject(), { type: newType, damage: 0, direction: null });

        setEnv(prev => prev.withGrid(nextGrid));
        setDomainStats(s => new SimulationStats(s.movement, EfficiencyMetrics.fromGrid(nextGrid), s.impact));
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
        testAll(ALGORITHMS_LIST, gridRef.current);
    }, [testAll]);

    const handleOpenSettings = useCallback(() => {
        setIsSettingsOpen(true);
    }, [setIsSettingsOpen]);

    const handleCloseSettings = useCallback(() => {
        setIsSettingsOpen(false);
    }, [setIsSettingsOpen]);

    const handleClearHistory = useCallback(() => {
        setHistory(new SimulationHistory());
    }, [setHistory]);

    const handleMouseDown = useCallback(() => {
        setIsDrawing(true);
    }, []);

    const duration = Math.round(workTimeMs / 1000);
    const winnerId = useMemo(() => history.getWinnerId(), [history]);
    const currentDamage = useMemo(() => env.grid.countDamaged(), [env.grid]);

    const coverage = domainStats.efficiency.coveragePercentage;
    const batteryPct = (battery / maxBattery) * 100;
    const complexity = stats.distance > 0 ? Math.min(100, (stats.turns / stats.distance) * 220) : 0;

    return (
        <div className="flex flex-col items-center p-4 md:p-6 min-h-screen text-slate-200 font-sans selection:bg-cyan-500/30" onMouseUp={() => setIsDrawing(false)}>
            <div className="w-full max-w-[1500px]">
                <TopBar
                    lawnName="Maple St. Lot"
                    algorithmName={algorithmName(algo)}
                    status={isRunning ? 'Mowing' : statusMessage}
                    isActive={isRunning && !isTesting}
                    time={clock}
                />

                <div className="flex flex-col lg:flex-row gap-6 items-start justify-center">
                    <Sidebar
                        onRandomizeMap={handleRandomizeMap}
                        onClearMap={handleClearMap}
                        onOpenSaveModal={handleOpenSaveModal}
                        onOpenLoadModal={handleOpenLoadModal}
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
                        onClearModel={clearModel}
                        isRunning={isRunning}
                        isTesting={isTesting}
                        onRunSimulation={runSimulation}
                        onStopSimulation={handleStopSimulation}
                        onTestAll={handleTestAll}
                        onResetMap={resetMowedOnly}
                        onFullReset={resetFull}
                        onReplayWithNN={handleReplayWithNN}
                    />

                    <div className="flex flex-col items-center min-w-0 shrink-0 mt-2 lg:mt-0 mr-0 lg:mr-12">
                        <div className="relative">
                             <SimulationGrid
                                grid={showVisualTraining && previewGrid ? previewGrid : grid}
                                mowerPos={showVisualTraining && previewMowerPos ? previewMowerPos : mowerPos}
                                mowerDir={showVisualTraining && previewMowerDir ? previewMowerDir : env.mower.nav.dir}
                                onMouseDown={handleMouseDown}
                                onCellClick={showVisualTraining ? undefined : handleCellClick}
                                onCellMouseEnter={handleCellMouseEnter}
                                onResize={isRunning || showVisualTraining ? undefined : handleResize}
                                onMowerClick={handleOpenSettings}
                            />

                            <MapToolbar
                                brushType={brushType}
                                setBrushType={setBrushType}
                                cellTypes={CELL_TYPES}
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
                        speedLabel={speedLabel(speed)}
                        complexity={complexity}
                    />
                </div>

                <StatsPanel
                    stats={stats}
                    coverage={coverage}
                    duration={duration}
                    winnerId={winnerId}
                    currentDamage={currentDamage}
                    onClearHistory={handleClearHistory}
                />

                <Footer />
            </div>

            <MapManagerModal
                isOpen={isMapModalOpen}
                mode={mapModalMode}
                onClose={() => setIsMapModalOpen(false)}
                currentGrid={grid}
                gridSize={gridSize}
                dockPos={dockPos}
                onLoadMap={handleLoadMap}
                showToast={showToast}
            />

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