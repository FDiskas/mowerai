import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as algos from '../algorithms';
import { countGrass, resetLawn } from '../utils/simUtils';
import { CELL_TYPES } from '../constants';
import { Position } from '../domain/Position';
import { SimulationService, type SimulationConfig } from '../services/SimulationService';
import { SimulationStats } from '../domain/SimulationStats';
import type { Grid as GridType, HistoryRecord, State } from '../types';

export const useAppSimulation = (
    env: any,
    setEnv: React.Dispatch<React.SetStateAction<any>>,
    domainStats: SimulationStats,
    setDomainStats: React.Dispatch<React.SetStateAction<SimulationStats>>,
    setHistory: React.Dispatch<React.SetStateAction<any>>,
    resetSimulation: (grid: GridType, dockPos: { x: number; y: number }, batteryVal: number) => void,
    setAlgo: (algo: string) => void,
    config: {
        algo: string;
        orientation: string;
        speed: number;
        maxBattery: number;
        drainMove: number;
        drainTurn: number;
    },
    nn: any,
    showToast: (msg: string, type?: string) => void,
    setStatusMessage: (msg: string) => void
) => {
    const [isRunning, setIsRunning] = useState(false);
    const isRunningRef = useRef(false);
    const [isTesting, setIsTesting] = useState(false);

    const simulationRef = useRef<any>(null);
    const sessionStartTime = useRef<number | null>(null);
    const sessionStartStats = useRef<any>(null);
    const pendingAlgosRef = useRef<string[]>([]);
    const isTestingAllRef = useRef(false);
    const currentSessionMoves = useRef<any[]>([]);
    // Pristine lawn captured at the start of a "Test All" run; each algorithm is
    // replayed against it so the map and stats reset between models.
    const testGridRef = useRef<GridType | null>(null);
    // Handle for the delayed start of the next "Test All" model, so a manual
    // stop can cancel it instead of letting the next model fire anyway.
    const pendingRunTimeoutRef = useRef<any>(null);
    // Watchdog: detect a run that stalls (robot spinning in place) or overruns.
    const idleStepsRef = useRef(0);
    const lastMowedRef = useRef(0);
    const totalStepsRef = useRef(0);

    const simState = useRef({
        pos: { x: 0, y: 0 },
        prevDir: { dx: 0, dy: 1 },
        battery: config.maxBattery,
        grid: [] as GridType,
        zigzagIdx: 0,
        uShapeIdx: 0,
        dockPos: { x: 0, y: 0 },
        isCharging: false,
        isReturningForCharge: false,
        visitCounts: {} as Record<string, number>,
        hasNotifiedFinished: false,
        orientation: config.orientation as 'horizontal' | 'vertical',
        maxBattery: config.maxBattery,
        returnPath: [] as any[],
        cellData: undefined as State['cellData'],
        spiralStep: undefined as number | undefined,
        spiralCenter: undefined as { x: number; y: number } | undefined,
        stcPath: undefined as any[] | undefined,
    });

    const configRef = useRef(config);
    const domainStatsRef = useRef(domainStats);
    const envRef = useRef(env);

    useEffect(() => { configRef.current = config; }, [config]);
    useEffect(() => { domainStatsRef.current = domainStats; }, [domainStats]);
    useEffect(() => { envRef.current = env; }, [env]);

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
        const currentGrid = envRef.current.grid.cells;
        const damagedGrassCount = currentGrid.flat().filter((c: any) => c.type === CELL_TYPES.MOWED && c.damage > 0).length;
        const startDamaged = sessionStartStats.current?.damagedGrassSnapshot || 0;

        const record: HistoryRecord = {
            id: Date.now(),
            algo: configRef.current.algo,
            distance: domainStatsRef.current.movement.distance - (sessionStartStats.current?.distance || 0),
            turns: domainStatsRef.current.movement.turns - (sessionStartStats.current?.turns || 0),
            mowedCount: domainStatsRef.current.efficiency.mowedCount - (sessionStartStats.current?.mowedCount || 0),
            duration: duration,
            damagedGrass: damagedGrassCount - startDamaged,
            chargeCycles: domainStatsRef.current.impact.chargeCycles - (sessionStartStats.current?.chargeCycles || 0),
            penalty: 0,
            moves: [...currentSessionMoves.current]
        };

        record.penalty = (record.damagedGrass * 100) + (record.chargeCycles * 5000) + (record.turns * 10);
        setHistory((prev: any) => prev.addRecord(record));

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

    const getNextStep = useCallback((state: any) => {
        const { pos, grid: curGrid, prevDir, dockPos: currentDock, battery, isReturningForCharge } = state;
        const grassRemaining = countGrass(curGrid);
        const { maxBattery, algo } = configRef.current;

        if (((battery / maxBattery) * 100 < 20 || isReturningForCharge) && grassRemaining > 0) {
            if (pos.x === currentDock.x && pos.y === currentDock.y) return null;
            if (!simState.current.isReturningForCharge) {
                showToast("Battery low - returning to charge", 'indigo');
                simState.current.isReturningForCharge = true;
                simState.current.returnPath = algos.findFullPathToTarget(pos, curGrid, prevDir, (p) => p.x === currentDock.x && p.y === currentDock.y) || [];
            }
            if (simState.current.returnPath && simState.current.returnPath.length > 0) {
                return simState.current.returnPath.shift();
            }
            return algos.findPathToTarget(pos, curGrid, prevDir, (p) => p.x === currentDock.x && p.y === currentDock.y);
        }

        if (grassRemaining === 0) {
            if (pos.x === currentDock.x && pos.y === currentDock.y) return null;
            if (!simState.current.hasNotifiedFinished) {
                showToast("Mowing finished - returning to dock", 'success');
                simState.current.hasNotifiedFinished = true;
                simState.current.returnPath = algos.findFullPathToTarget(pos, curGrid, prevDir, (p) => p.x === currentDock.x && p.y === currentDock.y) || [];
            }
            if (simState.current.returnPath && simState.current.returnPath.length > 0) {
                return simState.current.returnPath.shift();
            }
            return algos.findPathToTarget(pos, curGrid, prevDir, (p) => p.x === currentDock.x && p.y === currentDock.y);
        }

        setStatusMessage("Mowing grass...");

        let move = null;
        const fns: any = {
            boustrophedon: (s: any, g: any, d: any) => algos.getBoustrophedonMove(s, g, d, CELL_TYPES),
            potential_field: (s: any, g: any) => algos.getPotentialFieldMove(s, g, CELL_TYPES),
            spiral: (s: any, g: any) => algos.getSpiralMove(s, g, CELL_TYPES),
            dfs_coverage: (s: any, g: any, d: any) => algos.getDFSCoverageMove(s, g, d, CELL_TYPES),
            rrt: (s: any, g: any, d: any) => algos.getRRTMove(s, g, d, CELL_TYPES),
            a_star: (s: any, g: any, d: any) => algos.aStarSearch(s.pos, (algos as any).getClosestGrass(s.pos, g, CELL_TYPES) || s.pos, g, d),
            smart_ai: (s: any, g: any, d: any) => algos.getSmartAIMove(s, g, d, CELL_TYPES),
            neural_network: (s: any, g: any, d: any) => algos.getNeuralNetworkMove(s, g, d, CELL_TYPES, nn),
            energy_conservative_sweep: (s: any, g: any, d: any) => algos.getEnergyConservativeSweepMove(s, g, d, CELL_TYPES)
        };

        if (fns[algo]) {
            move = fns[algo](simState.current, curGrid, prevDir);
        } else {
            // Legacy/removed algorithm ids (e.g. a persisted 'stc' or old sweep
            // names) fall back to the closest surviving behaviour.
            if (['stc', 'zigzag', 'u_shape', 'slam_boustrophedon', 'cellular_boustrophedon'].includes(algo)) {
                move = algos.getBoustrophedonMove(simState.current, curGrid, prevDir, CELL_TYPES);
            } else {
                move = algos.getSmartAIMove(simState.current, curGrid, prevDir, CELL_TYPES);
            }
        }


        if (!move && algo !== 'smart_ai' && grassRemaining > 0) {
            move = algos.getSmartAIMove(simState.current, curGrid, prevDir, CELL_TYPES);
        }

        if (!move) {
            if (pos.x === currentDock.x && pos.y === currentDock.y) return null;
            setStatusMessage("No grass found - returning home");
            return algos.findPathToTarget(pos, curGrid, prevDir, (p) => p.x === currentDock.x && p.y === currentDock.y);
        }

        return move;
    }, [nn, showToast, setStatusMessage]);

    const runSimulation = useCallback(() => {
        if (isRunningRef.current) { stopSimulation(true); return; }

        setIsRunning(true);
        isRunningRef.current = true;
        sessionStartTime.current = Date.now();
        sessionStartStats.current = {
            distance: domainStatsRef.current.movement.distance,
            turns: domainStatsRef.current.movement.turns,
            mowedCount: domainStatsRef.current.efficiency.mowedCount,
            chargeCycles: domainStatsRef.current.impact.chargeCycles,
            damagedGrassSnapshot: envRef.current.grid.cells.flat().filter((c: any) => c.type === CELL_TYPES.MOWED && c.damage > 0).length
        };

        currentSessionMoves.current = [];

        // Start each session with a clean algorithm state so the contour/sweep
        // and spiral phases restart instead of resuming a previous run.
        simState.current.orientation = configRef.current.orientation as 'horizontal' | 'vertical';
        simState.current.cellData = undefined;
        simState.current.spiralStep = undefined;
        simState.current.spiralCenter = undefined;
        simState.current.stcPath = undefined;
        simState.current.hasNotifiedFinished = false;
        simState.current.isReturningForCharge = false;
        simState.current.returnPath = [];

        idleStepsRef.current = 0;
        lastMowedRef.current = sessionStartStats.current.mowedCount;
        totalStepsRef.current = 0;

        simulationRef.current = setInterval(() => {
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

            const legacyState = {
                ...simState.current,
                pos: mower.pos.toObject(),
                prevDir: mower.nav.dir,
                battery: mower.battery.current,
                grid: domainGrid.cells,
                dockPos: dPos.toObject()
            };

            const nextMoveObj = getNextStep(legacyState);

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
            simState.current.visitCounts[visitKey] = (simState.current.visitCounts[visitKey] || 0) + 1;

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

            const inputs = algos.prepareNNInputs(legacyState, domainGrid.cells, CELL_TYPES);
            const targets = [0, 0, 0, 0];
            const dir = result.env.mower.nav.dir;
            if (dir.dy === -1) targets[0] = 1;
            if (dir.dy === 1) targets[1] = 1;
            if (dir.dx === -1) targets[2] = 1;
            if (dir.dx === 1) targets[3] = 1;
            currentSessionMoves.current.push({ inputs, targets });

        }, Math.max(10, 140 - configRef.current.speed));
    }, [stopSimulation, getNextStep, setEnv, setDomainStats, setStatusMessage]);

    const prepareSimulationState = useCallback((sourceGrid: GridType) => {
        const dockPos = envRef.current.dockPos.toObject();
        const cleanGrid: GridType = resetLawn(sourceGrid);

        resetSimulation(cleanGrid, dockPos, configRef.current.maxBattery);

        simState.current = {
            ...simState.current,
            pos: { ...dockPos },
            prevDir: { dx: 0, dy: 1 },
            battery: configRef.current.maxBattery,
            grid: cleanGrid,
            zigzagIdx: 0,
            uShapeIdx: 0,
            dockPos: { ...dockPos },
            isCharging: false,
            isReturningForCharge: false,
            visitCounts: {},
            hasNotifiedFinished: false,
            orientation: configRef.current.orientation as 'horizontal' | 'vertical',
            maxBattery: configRef.current.maxBattery,
            returnPath: [],
            // Clear per-algorithm state so it cannot leak across runs.
            cellData: undefined,
            spiralStep: undefined,
            spiralCenter: undefined,
            stcPath: undefined,
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
