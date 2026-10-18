import { CELL_TYPES, DEFAULT_MAX_BATTERY, DEFAULT_DRAIN_MOVE, DEFAULT_DRAIN_TURN, DAMAGE_PER_PASS, DAMAGE_PER_TURN } from '../constants';
import type { Grid, Point, State, FitnessConfig } from '../types';
import { DEFAULT_FITNESS_CONFIG } from '../types';
import { findFullPathToTarget, findPathToTarget, getNeuralNetworkMove, hasAdjacentGrass, turnCostInSteps } from '../algorithms';
import type { NeuralNetwork } from '../NeuralNetwork';
import { advanceMower, countReachableGrass, startEpisode } from './episode';
import { resetLawn } from './simUtils';

/** Chooses the next tile while the mower is mowing (not on its way home). */
export type MovePolicy = (state: State) => Point | null;

export interface FitnessOptions {
    dockPos: Point;
    maxSteps: number;
    orientation?: 'horizontal' | 'vertical';
    drainMove?: number;
    drainTurn?: number;
    fitnessConfig?: FitnessConfig;
}

export interface EpisodeReport {
    fitness: number;
    mowed: number;
    reachableGrass: number;
    steps: number;
    turns: number;
    chargeCycles: number;
    /** All reachable grass was cut and the mower is back at the dock. */
    completed: boolean;
}

/** The live simulation sends the mower home below this battery share... */
const LOW_BATTERY_SHARE = 0.2;
/** ...and lets it leave the dock again once charged to this share. */
const RECHARGED_SHARE = 0.8;
const OSCILLATION_WINDOW = 8;
const OSCILLATION_MAX_UNIQUE = 3;
const VISIT_LIMIT_PENALTY = 10000;
const REVISIT_LIMIT_PENALTY = 50000;

const scoreOf = (report: Omit<EpisodeReport, 'fitness'>, terms: {
    distance: number;
    totalDamage: number;
    penaltyPoints: number;
    discoveryReward: number;
    straightLineSteps: number;
    orientationBonus: number;
    batteryUsed: number;
    distToDock: number;
}, drainMove: number, drainTurn: number, cfg: FitnessConfig): number => {
    const { mowed, reachableGrass, turns, chargeCycles, completed } = report;
    const coverageScore = (mowed / reachableGrass) * 50000;
    const efficiencyScore = terms.distance > 0 ? (mowed / terms.distance) * 20000 : 0;
    const straightLineBonus = terms.straightLineSteps * cfg.straightLineBonus;
    const batteryEfficiencyBonus = mowed > 0
        ? Math.min(2, drainMove / (terms.batteryUsed / mowed)) * cfg.batteryEfficiencyWeight
        : 0;
    const turnPenaltyWeight = cfg.turnPenalty + (drainTurn / drainMove) * 10;
    const totalPenalty = turns * turnPenaltyWeight +
        terms.totalDamage * cfg.damageWeight +
        chargeCycles * cfg.chargeCycleWeight +
        terms.penaltyPoints -
        (completed ? cfg.completionBonus : 0);
    const dockBonus = terms.distToDock === 0 ? 10000 : (1 / (terms.distToDock + 1)) * 2000;

    const fitness = coverageScore + efficiencyScore + dockBonus + terms.discoveryReward +
        straightLineBonus + terms.orientationBonus + batteryEfficiencyBonus - totalPenalty;
    return isNaN(fitness) ? -1000000 : fitness;
};

/**
 * Runs a policy on one lawn under the live simulation's rules: the tile being left is cut,
 * a low battery or a finished lawn sends the mower home along a planned route, and
 * charging happens at the dock. Rewards and penalties for choices (visits, overlaps, wear,
 * straight lines) only see decision steps: the policy moves while fresh grass is next to
 * the mower. Trips home and transits to the next grass would otherwise pile up wear on the
 * same corridors; they still cost turns, distance and battery.
 */
export const runFitnessEpisode = (policy: MovePolicy, lawn: Grid, options: FitnessOptions): EpisodeReport => {
    const {
        dockPos,
        maxSteps,
        orientation = 'horizontal',
        drainMove = DEFAULT_DRAIN_MOVE,
        drainTurn = DEFAULT_DRAIN_TURN,
        fitnessConfig: cfg = DEFAULT_FITNESS_CONFIG,
    } = options;
    const state: State = startEpisode(lawn, dockPos, {
        battery: DEFAULT_MAX_BATTERY,
        orientation,
        turnCost: turnCostInSteps(cfg),
    });
    const grid = state.grid;
    const cols = grid[0].length;
    const decisionVisits = new Uint16Array(grid.length * cols);
    const decisionWear = new Float64Array(grid.length * cols);
    const reachableGrass = countReachableGrass(grid, dockPos);
    const isDock = (p: Point) => p.x === dockPos.x && p.y === dockPos.y;
    const isBatteryLow = () => state.battery / DEFAULT_MAX_BATTERY < LOW_BATTERY_SHARE;
    const maxAllowedRevisits = Math.floor(maxSteps * cfg.maxMowedRevisitRatio);

    let mowed = 0;
    let turns = 0;
    let distance = 0;
    let totalDamage = 0;
    let chargeCycles = 0;
    let penaltyPoints = 0;
    let discoveryReward = 0;
    let straightLineSteps = 0;
    let orientationBonus = 0;
    let mowedRevisits = 0;
    let batteryUsed = 0;
    let completed = false;
    let routeHome: Point[] = [];
    const posHistory: string[] = [];

    const planRouteHome = () => {
        routeHome = findFullPathToTarget(state.pos, grid, state.prevDir, isDock, state.turnCost) ?? [];
    };
    const followRouteHome = () =>
        routeHome.shift() ?? findPathToTarget(state.pos, grid, state.prevDir, isDock, state.turnCost);

    for (let step = 0; step < maxSteps; step++) {
        const atDock = isDock(state.pos);
        const lawnDone = mowed >= reachableGrass;

        if (lawnDone && atDock) {
            completed = true;
            break;
        }
        if (atDock && (state.isReturningForCharge || isBatteryLow())) {
            state.battery = Math.max(state.battery, DEFAULT_MAX_BATTERY * RECHARGED_SHARE);
            state.isReturningForCharge = false;
            chargeCycles++;
        }

        let move: Point | null;
        let isDecision = false;
        if (lawnDone) {
            if (routeHome.length === 0) planRouteHome();
            move = followRouteHome();
        } else if (state.isReturningForCharge || isBatteryLow()) {
            if (!state.isReturningForCharge) {
                state.isReturningForCharge = true;
                planRouteHome();
            }
            move = followRouteHome();
        } else {
            isDecision = hasAdjacentGrass(state.pos, grid, CELL_TYPES);
            move = policy(state);
            // Only unreachable grass is left in the policy's view: head home like the live simulation.
            move ??= atDock ? null : followRouteHome();
        }
        if (!move) break;

        const leftTile = state.pos.y * cols + state.pos.x;
        const { isTurn, outcome } = advanceMower(state, move);
        distance++;
        if (isTurn) turns++;
        if (outcome.cutFreshGrass) mowed++;

        const stepDrain = drainMove + (isTurn ? drainTurn : 0);
        state.battery -= stepDrain;
        batteryUsed += stepDrain;

        if (isDecision) {
            const enteredTile = move.y * cols + move.x;
            const visitCount = ++decisionVisits[enteredTile];
            if (!isTurn) straightLineSteps++;
            if (visitCount === 1) discoveryReward += cfg.discoveryReward;

            if (visitCount >= cfg.visitLimit && !isDock(move)) {
                penaltyPoints += VISIT_LIMIT_PENALTY;
                break;
            }
            if (outcome.overlapped) {
                // Wear compounds on tiles the policy keeps driving over.
                const wear = isTurn ? DAMAGE_PER_TURN : DAMAGE_PER_PASS;
                totalDamage += wear * (1 + decisionWear[leftTile] * 200);
                decisionWear[leftTile] += wear;

                mowedRevisits++;
                // Grows with every overlap to push the network towards the shortest path.
                penaltyPoints += cfg.mowedRevisitPenalty * (1 + mowedRevisits * 0.5);
                if (mowedRevisits > maxAllowedRevisits) {
                    penaltyPoints += REVISIT_LIMIT_PENALTY;
                    break;
                }
            }

            const isAligned = orientation === 'horizontal' ? state.prevDir.dx !== 0 : state.prevDir.dy !== 0;
            // Only reward orientation on fresh grass, so zigzags over mowed tiles earn nothing.
            if (isAligned && !isTurn && outcome.cutFreshGrass) orientationBonus += cfg.orientationBonus;
        }

        posHistory.push(`${move.x},${move.y}`);
        if (posHistory.length > OSCILLATION_WINDOW) {
            posHistory.shift();
            if (new Set(posHistory).size <= OSCILLATION_MAX_UNIQUE) penaltyPoints += cfg.oscillationPenalty;
        }

        if (state.battery <= 0 && !isDock(state.pos)) {
            penaltyPoints += cfg.batteryOutPenalty;
            break;
        }
    }

    const report = { mowed, reachableGrass, steps: distance, turns, chargeCycles, completed };
    if (reachableGrass === 0) return { ...report, fitness: 0 };

    const distToDock = Math.abs(state.pos.x - dockPos.x) + Math.abs(state.pos.y - dockPos.y);
    const fitness = scoreOf(report, {
        distance,
        totalDamage,
        penaltyPoints,
        discoveryReward,
        straightLineSteps,
        orientationBonus,
        batteryUsed,
        distToDock,
    }, drainMove, drainTurn, cfg);
    return { ...report, fitness };
};

/**
 * Score of a perfect run, as if the lawn had no obstacles in the way: every reachable tile
 * is cut once in straight lanes along `orientation`, each lane change costs the minimum two
 * turns, nothing is damaged, the battery never needs a charge and the mower ends at the dock.
 * Real runs stay below it, so it is the 100 % mark for training progress.
 */
export const idealFitness = (lawn: Grid, options: FitnessOptions): number => {
    const {
        dockPos,
        orientation = 'horizontal',
        drainMove = DEFAULT_DRAIN_MOVE,
        drainTurn = DEFAULT_DRAIN_TURN,
        fitnessConfig: cfg = DEFAULT_FITNESS_CONFIG,
    } = options;
    const grass = countReachableGrass(resetLawn(lawn), dockPos);
    if (grass === 0) return 0;

    const lanes = orientation === 'horizontal' ? lawn.length : lawn[0].length;
    const turns = Math.min(grass, 2 * (lanes - 1));
    const straightSteps = grass - turns;
    const report = { mowed: grass, reachableGrass: grass, steps: grass, turns, chargeCycles: 0, completed: true };
    return scoreOf(report, {
        distance: grass,
        totalDamage: 0,
        penaltyPoints: 0,
        discoveryReward: grass * cfg.discoveryReward,
        straightLineSteps: straightSteps,
        orientationBonus: straightSteps * cfg.orientationBonus,
        batteryUsed: grass * drainMove + turns * drainTurn,
        distToDock: 0,
    }, drainMove, drainTurn, cfg);
};

/** How close `fitness` is to `ideal`, from 0 to 1. */
export const shareOfIdeal = (fitness: number, ideal: number): number =>
    ideal > 0 ? Math.min(1, Math.max(0, fitness / ideal)) : 0;

export const networkPolicy = (nn: NeuralNetwork): MovePolicy =>
    state => getNeuralNetworkMove(state, state.grid, state.prevDir, CELL_TYPES, nn);

export const evaluateFitness = (nn: NeuralNetwork, lawn: Grid, options: FitnessOptions): number =>
    runFitnessEpisode(networkPolicy(nn), lawn, options).fitness;
