import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as algos from '../algorithms';
import { countGrass, resetLawn } from '../utils/simUtils';
import { CELL_TYPES } from '../constants';
import { Position } from '../domain/Position';
import { SimulationService, type SimulationConfig } from '../services/SimulationService';
import { EfficiencyMetrics, SimulationStats } from '../domain/SimulationStats';
import type { SimulationEnvironment } from '../domain/SimulationEnvironment';
import type { SimulationHistory } from '../domain/SimulationHistory';
import type { NeuralNetwork } from '../NeuralNetwork';
import type { Direction, Grid as GridType, HistoryRecord, PositionType as Point, State } from '../types';

type Orientation = 'horizontal' | 'vertical';
type MoveFn = (state: State, grid: GridType, prevDir: Direction) => Point | null;

/** Algorithm state plus the hook's own bookkeeping for the return to the dock. */
interface SimState extends State {
    hasNotifiedFinished: boolean;
    returnPath: Point[];
}

interface SessionStartStats {
    distance: number;
    turns: number;
    mowedCount: number;
    chargeCycles: number;
    damagedGrassSnapshot: number;
}

/** Removed algorithm ids that can still come from saved history; they run as Boustrophedon. */
const LEGACY_SWEEP_IDS = ['stc', 'zigzag', 'u_shape', 'slam_boustrophedon', 'cellular_boustrophedon'];

const roundToTenth = (value: number) => Math.round(value * 10) / 10;

/** Per-run state, cleared so a new run does not resume the phases of an old one. */
const freshRunState = () => ({
    cellData: undefined,
    spiralCenter: undefined,
    goal: undefined,
    activeCellId: undefined,
    cellIdGrid: undefined,
    hasNotifiedFinished: false,
    isReturningForCharge: false,
    returnPath: [],
});

export const useAppSimulation = (
    env: SimulationEnvironment,
    setEnv: React.Dispatch<React.SetStateAction<SimulationEnvironment>>,
    domainStats: SimulationStats,
    setDomainStats: React.Dispatch<React.SetStateAction<SimulationStats>>,
    setWorkTimeMs: React.Dispatch<React.SetStateAction<number>>,
    setHistory: React.Dispatch<React.SetStateAction<SimulationHistory>>,
    resetSimulation: (grid: GridType, dockPos: Point, batteryVal: number) => void,
    setAlgo: (algo: string) => void,
    config: {
        algo: string;
        orientation: string;
        speed: number;
        maxBattery: number;
        drainMove: number;
        drainTurn: number;
        /** Path turn cost in steps, from the training weights (see `turnCostInSteps`). */
        turnCost: number;
    },
    nn: NeuralNetwork | null,
    showToast: (msg: string, type?: string) => void,
    setStatusMessage: (msg: string) => void
) => {
    const [isRunning, setIsRunning] = useState(false);
    const isRunningRef = useRef(false);
    const [isTesting, setIsTesting] = useState(false);

    const simulationRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const sessionStartTime = useRef<number | null>(null);
    const lastTickAtRef = useRef(0);
    const sessionStartStats = useRef<SessionStartStats | null>(null);
    const pendingAlgosRef = useRef<string[]>([]);
    const isTestingAllRef = useRef(false);
    // Pristine lawn captured at the start of a "Test All" run; each algorithm is
    // replayed against it so the map and stats reset between models.
    const testGridRef = useRef<GridType | null>(null);
    // Handle for the delayed start of the next "Test All" model, so a manual
    // stop can cancel it instead of letting the next model fire anyway.
    const pendingRunTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Watchdog: detect a run that stalls (robot spinning in place) or overruns.
    const idleStepsRef = useRef(0);
    const lastMowedRef = useRef(0);
    const totalStepsRef = useRef(0);

    const simState = useRef<SimState>({
        pos: { x: 0, y: 0 },
        prevDir: { dx: 0, dy: 1 },
        battery: config.maxBattery,
        grid: [],
        dockPos: { x: 0, y: 0 },
        isCharging: false,
        visitCounts: {},
        orientation: config.orientation as Orientation,
        maxBattery: config.maxBattery,
        turnCost: config.turnCost,
        ...freshRunState(),
    });

    const configRef = useRef(config);
    const domainStatsRef = useRef(domainStats);
    const envRef = useRef(env);

    useEffect(() => { configRef.current = config; }, [config]);
    useEffect(() => { domainStatsRef.current = domainStats; }, [domainStats]);
    useEffect(() => { envRef.current = env; }, [env]);

    useEffect(() => () => {
        if (simulationRef.current) clearInterval(simulationRef.current);
        if (pendingRunTimeoutRef.current) clearTimeout(pendingRunTimeoutRef.current);
    }, []);

    const stopSimulation = useCallback((isManual = false) => {
        setIsRunning(false);
        isRunningRef.current = false;
        if (simulationRef.current) clearInterval(simulationRef.current);

        if (isManual) {
            // Cancel a pending next-model start and end the whole "Test All".
            if (pendingRunTimeoutRef.current) {
                clearTimeout(pendingRunTimeoutRef.current);
                pendingRunTimeoutRef.current = null;
            }
            setIsTesting(false);
            isTestingAllRef.current = false;
            pendingAlgosRef.current = [];
            testGridRef.current = null;
            return;
        }

        const duration = sessionStartTime.current ? Math.round((Date.now() - sessionStartTime.current) / 1000) : 0;
        const start = sessionStartStats.current;
        const { movement, efficiency, impact } = domainStatsRef.current;

        const turns = movement.turns - (start?.turns ?? 0);
        const mowedCount = efficiency.mowedCount - (start?.mowedCount ?? 0);
        const damagedGrass = envRef.current.grid.countDamaged() - (start?.damagedGrassSnapshot ?? 0);
        const chargeCycles = impact.chargeCycles - (start?.chargeCycles ?? 0);

        const record: HistoryRecord = {
            id: Date.now(),
            algo: configRef.current.algo,
            distance: movement.distance - (start?.distance ?? 0),
            turns,
            mowedCount,
            coverage: roundToTenth(new EfficiencyMetrics(mowedCount, efficiency.totalGrass).coveragePercentage),
            duration,
            damagedGrass,
            chargeCycles,
            penalty: (damagedGrass * 100) + (chargeCycles * 5000) + (turns * 10),
        };
        setHistory(prev => prev.addRecord(record));

        if (isTestingAllRef.current && pendingAlgosRef.current.length > 0) {
            const nextAlgo = pendingAlgosRef.current.shift()!;
            setAlgo(nextAlgo);
            // Regrow the lawn and reset stats before the next model runs.
            if (testGridRef.current) prepareSimulationState(testGridRef.current);
            pendingRunTimeoutRef.current = setTimeout(() => runSimulation(), 500);
        } else {
            setIsTesting(false);
            isTestingAllRef.current = false;
            testGridRef.current = null;
        }
    }, [setHistory, setAlgo]);

    const getNextStep = useCallback((state: State) => {
        const { pos, grid: curGrid, prevDir, dockPos: currentDock, battery, isReturningForCharge } = state;
        const grassRemaining = countGrass(curGrid);
        const { maxBattery, algo } = configRef.current;
        const { turnCost } = simState.current;

        const isDock = (p: Point) => p.x === currentDock.x && p.y === currentDock.y;
        const stepHome = () => algos.findPathToTarget(pos, curGrid, prevDir, isDock, turnCost);
        const planRouteHome = () => {
            simState.current.returnPath = algos.findFullPathToTarget(pos, curGrid, prevDir, isDock, turnCost) ?? [];
        };
        const followRouteHome = () => simState.current.returnPath.shift() ?? stepHome();

        if (((battery / maxBattery) * 100 < 20 || isReturningForCharge) && grassRemaining > 0) {
            if (isDock(pos)) return null;
            if (!simState.current.isReturningForCharge) {
                showToast("Battery low - returning to charge", 'indigo');
                simState.current.isReturningForCharge = true;
                planRouteHome();
            }
            return followRouteHome();
        }

        if (grassRemaining === 0) {
            if (isDock(pos)) return null;
            if (!simState.current.hasNotifiedFinished) {
                showToast("Mowing finished - returning to dock", 'success');
                simState.current.hasNotifiedFinished = true;
                planRouteHome();
            }
            return followRouteHome();
        }

        setStatusMessage("Mowing grass...");

        const fns: Record<string, MoveFn> = {
            boustrophedon: (s, g, d) => algos.getBoustrophedonMove(s, g, d, CELL_TYPES),
            potential_field: (s, g) => algos.getPotentialFieldMove(s, g, CELL_TYPES),
            spiral: (s, g) => algos.getSpiralMove(s, g, CELL_TYPES),
            dfs_coverage: (s, g, d) => algos.getDFSCoverageMove(s, g, d, CELL_TYPES),
            rrt: (s, g, d) => algos.getRRTMove(s, g, d, CELL_TYPES),
            a_star: (s, g, d) => algos.getAStarMove(s, g, d, CELL_TYPES),
            smart_ai: (s, g, d) => algos.getSmartAIMove(s, g, d, CELL_TYPES),
            neural_network: (s, g, d) => algos.getNeuralNetworkMove(s, g, d, CELL_TYPES, nn),
            energy_conservative_sweep: (s, g, d) => algos.getEnergyConservativeSweepMove(s, g, d, CELL_TYPES),
            cellular_decomposition: (s, g, d) => algos.getCellularDecompositionMove(s, g, d, CELL_TYPES)
        };
        // Legacy/removed algorithm ids (e.g. a persisted 'stc' or old sweep
        // names) fall back to the closest surviving behaviour.
        const algoMove = fns[algo] ?? (LEGACY_SWEEP_IDS.includes(algo) ? fns.boustrophedon : fns.smart_ai);

        const move = algoMove(simState.current, curGrid, prevDir)
            ?? (algo !== 'smart_ai' ? fns.smart_ai(simState.current, curGrid, prevDir) : null);
        if (move) return move;

        if (isDock(pos)) return null;
        setStatusMessage("No grass found - returning home");
        return stepHome();
    }, [nn, showToast, setStatusMessage]);

    const runSimulation = useCallback(() => {
        if (isRunningRef.current) { stopSimulation(true); return; }

        setIsRunning(true);
        isRunningRef.current = true;
        sessionStartTime.current = Date.now();
        lastTickAtRef.current = sessionStartTime.current;
        sessionStartStats.current = {
            distance: domainStatsRef.current.movement.distance,
            turns: domainStatsRef.current.movement.turns,
            mowedCount: domainStatsRef.current.efficiency.mowedCount,
            chargeCycles: domainStatsRef.current.impact.chargeCycles,
            damagedGrassSnapshot: envRef.current.grid.countDamaged()
        };

        // Start each session with a clean algorithm state so the contour/sweep
        // and spiral phases restart instead of resuming a previous run.
        Object.assign(simState.current, {
            orientation: configRef.current.orientation as Orientation,
            turnCost: configRef.current.turnCost,
            ...freshRunState(),
        });

        idleStepsRef.current = 0;
        lastMowedRef.current = sessionStartStats.current.mowedCount;
        totalStepsRef.current = 0;

        simulationRef.current = setInterval(() => {
            const now = Date.now();
            const sinceLastTick = now - lastTickAtRef.current;
            lastTickAtRef.current = now;
            setWorkTimeMs(t => t + sinceLastTick);

            const prevEnv = envRef.current;
            const mower = prevEnv.mower;
            const domainGrid = prevEnv.grid;
            const dPos = prevEnv.dockPos;
            const { drainMove, drainTurn, algo, orientation } = configRef.current;

            if (simState.current.isCharging) {
                const updatedMower = mower.charge(drainMove * 4);
                if (updatedMower.battery.percentage >= 80) {
                    simState.current.isCharging = false;
                    simState.current.isReturningForCharge = false;
                    setStatusMessage("Battery charged. Continuing...");
                }
                setEnv(prevEnv.withMower(updatedMower));
                return;
            }

            if (simState.current.isReturningForCharge && mower.pos.equals(dPos)) {
                simState.current.isCharging = true;
                setDomainStats(s => new SimulationStats(s.movement, s.efficiency, s.impact.addChargeCycle()));
                return;
            }

            if (mower.battery.isEmpty) {
                setStatusMessage("Battery ran out!");
                stopSimulation();
                return;
            }

            const nextMoveObj = getNextStep({
                ...simState.current,
                pos: mower.pos.toObject(),
                prevDir: mower.nav.dir,
                battery: mower.battery.current,
                grid: domainGrid.cells,
                dockPos: dPos.toObject()
            });

            if (!nextMoveObj) {
                const isAtDock = mower.pos.equals(dPos);
                setStatusMessage(isAtDock ? (domainGrid.countGrass() === 0 ? "Work finished successfully!" : "Finished (some grass unreachable)") : "Error: Dock unreachable!");
                stopSimulation();
                return;
            }

            const nextPos = Position.fromObject(nextMoveObj);
            const simConfig: SimulationConfig = { drainMove, drainTurn, algo, orientation };

            const currentStats = domainStatsRef.current;
            const result = SimulationService.calculateStep(prevEnv, currentStats, nextPos, simConfig);

            // Update state and refs
            setDomainStats(result.stats);
            setEnv(result.env);

            simState.current.pos = nextMoveObj;
            simState.current.prevDir = result.env.mower.nav.dir;
            simState.current.battery = result.env.mower.battery.current;
            simState.current.grid = result.env.grid.cells;

            // Track cell visits so coverage algorithms (NN, potential field) can
            // penalise revisits exactly like they do during training.
            const visitKey = `${nextMoveObj.x},${nextMoveObj.y}`;
            simState.current.visitCounts[visitKey] = (simState.current.visitCounts[visitKey] ?? 0) + 1;

            // Watchdog: abort a run that stops making progress (robot spinning in
            // place) or overruns a sane step budget, so "Test All" moves on.
            totalStepsRef.current++;
            const mowedNow = result.stats.efficiency.mowedCount;
            if (mowedNow > lastMowedRef.current) {
                lastMowedRef.current = mowedNow;
                idleStepsRef.current = 0;
            } else {
                idleStepsRef.current++;
            }

            const area = result.env.grid.cells.length * result.env.grid.cells[0].length;
            if (idleStepsRef.current > Math.max(300, area) || totalStepsRef.current > area * 6) {
                setStatusMessage(isTestingAllRef.current ? "Model stuck — skipping to next" : "Stopped: no progress (stuck)");
                stopSimulation();
                return;
            }

        }, Math.max(10, 140 - configRef.current.speed));
    }, [stopSimulation, getNextStep, setEnv, setDomainStats, setWorkTimeMs, setStatusMessage]);

    const prepareSimulationState = useCallback((sourceGrid: GridType, dockPosOverride?: Point) => {
        const dockPos = dockPosOverride ?? envRef.current.dockPos.toObject();
        const cleanGrid: GridType = resetLawn(sourceGrid);

        resetSimulation(cleanGrid, dockPos, configRef.current.maxBattery);

        simState.current = {
            ...simState.current,
            pos: { ...dockPos },
            prevDir: { dx: 0, dy: 1 },
            battery: configRef.current.maxBattery,
            grid: cleanGrid,
            dockPos: { ...dockPos },
            isCharging: false,
            visitCounts: {},
            orientation: configRef.current.orientation as Orientation,
            maxBattery: configRef.current.maxBattery,
            ...freshRunState(),
        };
        return cleanGrid;
    }, [resetSimulation]);

    const testAll = useCallback((algosList: string[], currentGrid: GridType) => {
        if (isRunningRef.current) stopSimulation(true);
        setIsTesting(true);
        // Keep a pristine copy so every model is scored on the same fresh lawn.
        testGridRef.current = resetLawn(currentGrid);
        prepareSimulationState(currentGrid);
        pendingAlgosRef.current = [...algosList];
        isTestingAllRef.current = true;

        const firstAlgo = pendingAlgosRef.current.shift()!;
        setAlgo(firstAlgo);
        pendingRunTimeoutRef.current = setTimeout(() => runSimulation(), 500);
    }, [prepareSimulationState, runSimulation, setAlgo, stopSimulation]);

    return {
        isRunning,
        setIsRunning,
        isTesting,
        setIsTesting,
        prepareSimulationState,
        runSimulation,
        stopSimulation,
        testAll,
    };
};
