import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as algos from '../algorithms';
import { countGrass } from '../utils/simUtils';
import { CELL_TYPES, DEFAULT_MAX_BATTERY } from '../constants';
import { Position } from '../domain/Position';
import { SimulationService, type SimulationConfig } from '../services/SimulationService';
import { SimulationStats, EfficiencyMetrics } from '../domain/SimulationStats';
import type { Grid as GridType, HistoryRecord } from '../types';

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
        returnPath: [] as any[]
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
            setIsTesting(false);
            isTestingAllRef.current = false;
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
            setTimeout(() => runSimulation(), 500);
        } else {
            setIsTesting(false);
            isTestingAllRef.current = false;
        }
    }, [setHistory, setAlgo]);

    const getNextStep = useCallback((state: any) => {
        const { pos, grid: curGrid, prevDir, dockPos: currentDock, battery, isReturningForCharge } = state;
        const rows = curGrid.length;
        const cols = curGrid[0].length;
        const grassRemaining = countGrass(curGrid);
        const { maxBattery, algo, orientation } = configRef.current;

        if (((battery / maxBattery) * 100 < 20 || isReturningForCharge) && grassRemaining > 0) {
            if (pos.x === currentDock.x && pos.y === currentDock.y) return null;
            if (!simState.current.isReturningForCharge) {
                showToast("Baterija senka - grįžtama krautis", 'indigo');
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
                showToast("Pjovimas baigtas - grįžtama į bazę", 'success');
                simState.current.hasNotifiedFinished = true;
                simState.current.returnPath = algos.findFullPathToTarget(pos, curGrid, prevDir, (p) => p.x === currentDock.x && p.y === currentDock.y) || [];
            }
            if (simState.current.returnPath && simState.current.returnPath.length > 0) {
                return simState.current.returnPath.shift();
            }
            return algos.findPathToTarget(pos, curGrid, prevDir, (p) => p.x === currentDock.x && p.y === currentDock.y);
        }

        setStatusMessage("Pjaunama veja...");

        let move = null;
        if (['zigzag', 'u_shape', 'slam_boustrophedon', 'cellular_boustrophedon'].includes(algo)) {
            const fns: any = {
                zigzag: algos.getZigzagMove,
                u_shape: algos.getUShapeMove,
                slam_boustrophedon: algos.getSLAMBoustrophedonMove,
                cellular_boustrophedon: algos.getCellularBoustrophedonMove
            };
            move = fns[algo](simState.current, curGrid, prevDir, rows, cols, CELL_TYPES, orientation);
        } else {
            const fns: any = {
                a_star: algos.getAStarMove,
                dijkstra: algos.getDijkstraMove,
                bfs: algos.getBFSMove,
                greedy_bfs: algos.getGreedyBestFirstMove,
                jps: algos.getJPSMove,
                d_star_lite: algos.getDStarLiteMove,
                custom_mower: algos.getCustomMove,
                smart_ai: algos.getSmartAIMove,
                neural_network: (s: any, g: any, d: any, c: any) => algos.getNeuralNetworkMove(s, g, d, c, nn)
            };
            move = (fns[algo] || algos.getSmartAIMove)(simState.current, curGrid, prevDir, CELL_TYPES);
        }

        if (!move && algo !== 'smart_ai' && grassRemaining > 0) {
            move = algos.getSmartAIMove(simState.current, curGrid, prevDir, CELL_TYPES);
        }

        if (!move) {
            if (pos.x === currentDock.x && pos.y === currentDock.y) return null;
            setStatusMessage("Nerasta vejos - grįžtama namo");
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
                    setStatusMessage("Baterija įkrauta. Tęsiame...");
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
                setStatusMessage("Baterija išseko!");
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
                setStatusMessage(isAtDock ? (domainGrid.countGrass() === 0 ? "Darbas baigtas sėkmingai!" : "Baigta (yra nepasiekiamos vejos)") : "Klaida: Baza nepasiekiama!");
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
        const cleanGrid: GridType = sourceGrid.map(row => row.map(cell => ({
            ...cell,
            type: (cell.type === CELL_TYPES.MOWED) ? CELL_TYPES.GRASS : cell.type,
            damage: 0,
            direction: null
        })));

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
            returnPath: []
        };
        return cleanGrid;
    }, [resetSimulation]);

    const testAll = useCallback((algosList: string[], currentGrid: GridType) => {
        if (isRunningRef.current) stopSimulation(true);
        setIsTesting(true);
        prepareSimulationState(currentGrid);
        pendingAlgosRef.current = [...algosList];
        isTestingAllRef.current = true;

        const firstAlgo = pendingAlgosRef.current.shift()!;
        setAlgo(firstAlgo);
        setTimeout(() => runSimulation(), 500);
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
