import React, { useState, useRef, useCallback, useEffect } from 'react';
import { CELL_TYPES } from '../constants';
import { Battery } from '../domain/Battery';
import { Mower } from '../domain/Mower';
import { NavigationState } from '../domain/NavigationState';
import { Position } from '../domain/Position';
import { SimulationEnvironment } from '../domain/SimulationEnvironment';
import { SimulationGrid } from '../domain/SimulationGrid';
import { EfficiencyMetrics, ImpactMetrics, MovementMetrics, SimulationStats } from '../domain/SimulationStats';
import type { SimulationHistory } from '../domain/SimulationHistory';
import { algorithmPolicy } from '../simulation/algorithmPolicies';
import { DEFAULT_EPISODE_CONFIG, Episode, type EndReason, type EpisodeNotice, type MovePolicy } from '../simulation/episode';
import { networkPolicy } from '../simulation/networkPolicy';
import type { NetworkData } from '../simulation/policyNetwork';
import { costPerTile } from '../simulation/score';
import { NETWORK_ID } from '../simulation/tasks';
import type { Grid as GridType, HistoryRecord, Orientation, PositionType as Point } from '../types';
import { resetLawn } from '../utils/simUtils';
import { stepDelayMs } from '../utils/speed';

interface SimulationConfig {
    algo: string;
    orientation: Orientation;
    speed: number;
    maxBattery: number;
    drainMove: number;
    drainTurn: number;
}

const END_MESSAGES: Record<EndReason, string> = {
    'completed': 'Work finished successfully!',
    'stranded': 'Battery ran out!',
    'stalled': 'Stopped: no progress (stuck)',
    'step-limit': 'Stopped: step limit reached',
    'no-way-home': 'Error: Dock unreachable!',
};

const roundTo = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;

const policyFor = (algo: string, network: NetworkData): MovePolicy =>
    algo === NETWORK_ID ? networkPolicy(network) : algorithmPolicy(algo);

const countDamaged = (grid: GridType) =>
    grid.reduce((sum, row) => sum + row.filter(cell => cell.type === CELL_TYPES.MOWED && cell.damage > 0).length, 0);

/** Drives the shared `Episode` engine one step per tick and shows its state in the UI. */
export const useAppSimulation = (
    env: SimulationEnvironment,
    setEnv: React.Dispatch<React.SetStateAction<SimulationEnvironment>>,
    setDomainStats: React.Dispatch<React.SetStateAction<SimulationStats>>,
    setWorkTimeMs: React.Dispatch<React.SetStateAction<number>>,
    setHistory: React.Dispatch<React.SetStateAction<SimulationHistory>>,
    resetSimulation: (grid: GridType, dockPos: Point, batteryVal: number) => void,
    setAlgo: (algo: string) => void,
    config: SimulationConfig,
    network: NetworkData,
    showToast: (msg: string, type?: string) => void,
    setStatusMessage: (msg: string) => void
) => {
    const [isRunning, setIsRunning] = useState(false);
    const isRunningRef = useRef(false);
    const [isTesting, setIsTesting] = useState(false);
    /** Tiles the mower's sensor has seen in the current job; null before a job starts. */
    const [seenTiles, setSeenTiles] = useState<Uint8Array | null>(null);

    const simulationRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const sessionStartTime = useRef<number | null>(null);
    const lastTickAtRef = useRef(0);
    const pendingAlgosRef = useRef<string[]>([]);
    const isTestingAllRef = useRef(false);
    // Pristine lawn captured at the start of a "Test All" run; each algorithm is
    // replayed against it so the map and stats reset between models.
    const testGridRef = useRef<GridType | null>(null);
    // Handle for the delayed start of the next "Test All" model, so a manual
    // stop can cancel it instead of letting the next model fire anyway.
    const pendingRunTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const episodeRef = useRef<Episode | null>(null);
    const policyRef = useRef<MovePolicy | null>(null);
    /** The grid the episode last showed; any other grid means the user edited the lawn. */
    const shownGridRef = useRef<GridType | null>(null);

    const configRef = useRef(config);
    const networkRef = useRef(network);
    const envRef = useRef(env);

    useEffect(() => { configRef.current = config; }, [config]);
    useEffect(() => { networkRef.current = network; }, [network]);
    useEffect(() => { envRef.current = env; }, [env]);

    useEffect(() => () => {
        if (simulationRef.current) clearInterval(simulationRef.current);
        if (pendingRunTimeoutRef.current) clearTimeout(pendingRunTimeoutRef.current);
    }, []);

    const prepareSimulationState = useCallback((sourceGrid: GridType, dockPosOverride?: Point) => {
        const dockPos = dockPosOverride ?? envRef.current.dockPos.toObject();
        const cleanGrid: GridType = resetLawn(sourceGrid);
        resetSimulation(cleanGrid, dockPos, configRef.current.maxBattery);
        episodeRef.current = null;
        setSeenTiles(null);
        return cleanGrid;
    }, [resetSimulation]);

    const showEpisode = useCallback((episode: Episode) => {
        const { state, tally } = episode;
        const grid = [...episode.lawn];
        shownGridRef.current = grid;
        const mower = new Mower(
            new Battery(Math.max(0, state.battery), configRef.current.maxBattery),
            new NavigationState(Position.fromObject(state.pos), state.prevDir),
        );
        setEnv(new SimulationEnvironment(mower, new SimulationGrid(grid), Position.fromObject(state.dockPos)));
        setDomainStats(new SimulationStats(
            new MovementMetrics(tally.steps, tally.turns),
            new EfficiencyMetrics(tally.mowed, tally.reachableGrass),
            new ImpactMetrics(tally.chargeTrips),
        ));
        setSeenTiles(new Uint8Array(episode.known.seen));
    }, [setEnv, setDomainStats]);

    /** Latest `runSimulation`, so a "Test All" model started from `stopSimulation` uses current callbacks. */
    const runSimulationRef = useRef<() => void>(() => {});

    /** Runs that ended on their own are logged; Test All then starts the next model. */
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

        const episode = episodeRef.current;
        if (episode) {
            const { tally } = episode;
            const record: HistoryRecord = {
                id: Date.now(),
                algo: configRef.current.algo,
                distance: tally.steps,
                turns: tally.turns,
                mowedCount: tally.mowed,
                coverage: roundTo(new EfficiencyMetrics(tally.mowed, tally.reachableGrass).coveragePercentage, 1),
                duration: sessionStartTime.current ? Math.round((Date.now() - sessionStartTime.current) / 1000) : 0,
                damagedGrass: countDamaged(episode.lawn),
                chargeCycles: tally.chargeTrips,
                cost: roundTo(costPerTile(tally), 3),
            };
            setHistory(prev => prev.addRecord(record));
        }

        if (isTestingAllRef.current && pendingAlgosRef.current.length > 0) {
            const nextAlgo = pendingAlgosRef.current.shift()!;
            setAlgo(nextAlgo);
            configRef.current = { ...configRef.current, algo: nextAlgo };
            // Regrow the lawn and reset stats before the next model runs.
            if (testGridRef.current) prepareSimulationState(testGridRef.current);
            pendingRunTimeoutRef.current = setTimeout(() => runSimulationRef.current(), 500);
        } else {
            setIsTesting(false);
            isTestingAllRef.current = false;
            testGridRef.current = null;
        }
    }, [prepareSimulationState, setHistory, setAlgo]);

    const announce = useCallback((notice: EpisodeNotice | undefined) => {
        if (notice === 'battery-low') showToast('Battery low - returning to charge', 'indigo');
        else if (notice === 'lawn-done') showToast('Mowing finished - returning to dock', 'success');
        else if (notice === 'charged') setStatusMessage('Battery charged. Continuing...');
    }, [showToast, setStatusMessage]);

    /** The job to continue: the paused one, unless it ended or the lawn was edited since. */
    const currentEpisode = useCallback((): Episode => {
        const paused = episodeRef.current;
        if (paused && !paused.isFinished && envRef.current.grid.cells === shownGridRef.current) return paused;
        const { maxBattery, drainMove, drainTurn, orientation } = configRef.current;
        const episode = new Episode(
            { grid: envRef.current.grid.cells, dock: envRef.current.dockPos.toObject() },
            { ...DEFAULT_EPISODE_CONFIG, maxBattery, drainMove, drainTurn, orientation },
        );
        setWorkTimeMs(0);
        return episode;
    }, [setWorkTimeMs]);

    const runSimulation = useCallback(() => {
        if (isRunningRef.current) { stopSimulation(true); return; }

        const episode = currentEpisode();
        episodeRef.current = episode;
        policyRef.current = policyFor(configRef.current.algo, networkRef.current);
        showEpisode(episode);

        setIsRunning(true);
        isRunningRef.current = true;
        setStatusMessage('Mowing grass...');
        sessionStartTime.current = Date.now();
        lastTickAtRef.current = sessionStartTime.current;

        simulationRef.current = setInterval(() => {
            const now = Date.now();
            const sinceLastTick = now - lastTickAtRef.current;
            lastTickAtRef.current = now;
            setWorkTimeMs(t => t + sinceLastTick);

            announce(episode.step(policyRef.current!).notice);
            showEpisode(episode);
            if (episode.isFinished) {
                const isTestingAll = isTestingAllRef.current;
                setStatusMessage(isTestingAll && episode.endReason !== 'completed' ? 'Model stuck — skipping to next' : END_MESSAGES[episode.endReason!]);
                stopSimulation();
            }
        }, stepDelayMs(configRef.current.speed));
    }, [stopSimulation, currentEpisode, showEpisode, announce, setWorkTimeMs, setStatusMessage]);

    useEffect(() => { runSimulationRef.current = runSimulation; }, [runSimulation]);

    const testAll = useCallback((algosList: readonly string[], currentGrid: GridType) => {
        if (isRunningRef.current) stopSimulation(true);
        setIsTesting(true);
        // Keep a pristine copy so every model is scored on the same fresh lawn.
        testGridRef.current = resetLawn(currentGrid);
        prepareSimulationState(currentGrid);
        pendingAlgosRef.current = [...algosList];
        isTestingAllRef.current = true;

        const firstAlgo = pendingAlgosRef.current.shift()!;
        setAlgo(firstAlgo);
        configRef.current = { ...configRef.current, algo: firstAlgo };
        pendingRunTimeoutRef.current = setTimeout(() => runSimulationRef.current(), 500);
    }, [prepareSimulationState, setAlgo, stopSimulation]);

    return {
        isRunning,
        isTesting,
        seenTiles,
        prepareSimulationState,
        runSimulation,
        stopSimulation,
        testAll,
    };
};
