import { CELL_TYPES, DEFAULT_DRAIN_MOVE, DEFAULT_DRAIN_TURN, DEFAULT_MAX_BATTERY } from '../constants';
import { findFullPathToTarget } from '../algorithms/pathfinding';
import { headingBetween, mowTile } from '../domain/MowingStep';
import type { Direction, Grid, Orientation, Point, State } from '../types';
import { createKnownMap, sense, syncTile, type KnownMap } from './knownMap';
import type { Lawn } from './lawnGenerator';
import { SCORE_WEIGHTS, type RunTally } from './score';
import { resetLawn } from '../utils/simUtils';

/** Chooses the next tile while the mower is mowing; `null` means it sees no work it can reach. */
export type MovePolicy = (state: State, known: KnownMap) => Point | null;

export interface EpisodeConfig {
    maxBattery: number;
    drainMove: number;
    drainTurn: number;
    /** Tiles the sensor sees in each direction (a square around the mower). */
    sensorRange: number;
    orientation: Orientation;
    /** Turn price in steps for every path search. */
    turnCost: number;
    /** Hard limit on steps, as a multiple of the lawn area. */
    maxStepsPerTile: number;
    /** The run ends when the mower cuts nothing for this many mowing steps, as a multiple of the lawn area. */
    stallStepsPerTile: number;
}

export const DEFAULT_EPISODE_CONFIG: EpisodeConfig = {
    maxBattery: DEFAULT_MAX_BATTERY,
    drainMove: DEFAULT_DRAIN_MOVE,
    drainTurn: DEFAULT_DRAIN_TURN,
    sensorRange: 2,
    orientation: 'horizontal',
    turnCost: SCORE_WEIGHTS.turn / SCORE_WEIGHTS.step,
    maxStepsPerTile: 6,
    stallStepsPerTile: 1,
};

/** Below this battery share the mower drives home to charge... */
export const LOW_BATTERY_SHARE = 0.2;
/** ...and it leaves the dock again at this share. */
export const RECHARGED_SHARE = 0.8;

export type EpisodePhase = 'mowing' | 'charging-trip' | 'homing' | 'finished';
export type EndReason = 'completed' | 'stranded' | 'stalled' | 'step-limit' | 'no-way-home';
export type EpisodeNotice = 'battery-low' | 'charged' | 'lawn-done';

export interface StepResult {
    moved: boolean;
    notice?: EpisodeNotice;
}

const NEIGHBOURS: Direction[] = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
];

/**
 * Grass tiles the mower can drive to from `from` without crossing obstacles.
 * `skipFrom` leaves out the start tile: the mower cuts it on its way out anyway.
 */
export const countReachableGrass = (grid: Grid, from: Point, skipFrom = false): number => {
    const rows = grid.length;
    const cols = grid[0].length;
    const seen = new Uint8Array(rows * cols);
    const queue: Point[] = [from];
    seen[from.y * cols + from.x] = 1;
    let grass = 0;

    for (let i = 0; i < queue.length; i++) {
        const { x, y } = queue[i];
        if (grid[y][x].type === CELL_TYPES.GRASS && !(skipFrom && i === 0)) grass++;
        for (const { dx, dy } of NEIGHBOURS) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
            if (seen[ny * cols + nx] || grid[ny][nx].type === CELL_TYPES.OBSTACLE) continue;
            seen[ny * cols + nx] = 1;
            queue.push({ x: nx, y: ny });
        }
    }
    return grass;
};

/** Copies the parts of `state` that a step changes; maps that are only ever replaced are shared. */
const copyState = (state: State, grid: Grid): State => ({
    ...state,
    pos: { ...state.pos },
    prevDir: { ...state.prevDir },
    dockPos: { ...state.dockPos },
    grid,
    goal: state.goal && { ...state.goal },
    spiralCenter: state.spiralCenter && { ...state.spiralCenter },
    cellData: state.cellData && { ...state.cellData },
});

const isNextTo = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

/**
 * One mowing job under the same rules for every model: the mower starts at the
 * dock knowing only what its sensor sees, cuts the tile it leaves, drives home
 * to charge below `LOW_BATTERY_SHARE`, and drives home when its known map holds
 * no reachable grass. The policy only decides moves while mowing; the trips home
 * use the same planner for every model.
 */
export class Episode {
    /** The real lawn. Rows are replaced, not edited, when a tile changes. */
    readonly lawn: Grid;
    readonly known: KnownMap;
    readonly state: State;
    readonly tally: RunTally;
    readonly config: EpisodeConfig;
    phase: EpisodePhase = 'mowing';
    endReason: EndReason | null = null;

    private route: Point[] = [];
    private stepsSinceCut = 0;
    private readonly maxSteps: number;
    private readonly stallSteps: number;

    constructor(lawn: Lawn, config: EpisodeConfig = DEFAULT_EPISODE_CONFIG) {
        this.config = config;
        this.lawn = resetLawn(lawn.grid);
        this.known = createKnownMap(this.lawn, lawn.dock, config.sensorRange);
        this.state = {
            pos: { ...lawn.dock },
            prevDir: { dx: 0, dy: 1 },
            battery: config.maxBattery,
            maxBattery: config.maxBattery,
            grid: this.known.grid,
            dockPos: { ...lawn.dock },
            orientation: config.orientation,
            turnCost: config.turnCost,
            mapVersion: 0,
        };
        const area = this.lawn.length * this.lawn[0].length;
        this.maxSteps = Math.ceil(area * config.maxStepsPerTile);
        this.stallSteps = Math.ceil(area * config.stallStepsPerTile);
        this.tally = {
            steps: 0,
            turns: 0,
            overlaps: 0,
            chargeTrips: 0,
            mowed: 0,
            reachableGrass: countReachableGrass(this.lawn, lawn.dock),
            endedAtDock: true,
        };
    }

    /** An independent copy, so a planner can try moves without changing this job. */
    clone(): Episode {
        const known: KnownMap = { grid: [...this.known.grid], seen: this.known.seen.slice(), cols: this.known.cols };
        return Object.assign(Object.create(Episode.prototype) as Episode, {
            config: this.config,
            lawn: [...this.lawn],
            known,
            state: copyState(this.state, known.grid),
            tally: { ...this.tally },
            phase: this.phase,
            endReason: this.endReason,
            route: [...this.route],
            stepsSinceCut: this.stepsSinceCut,
            maxSteps: this.maxSteps,
            stallSteps: this.stallSteps,
        });
    }

    get isFinished(): boolean {
        return this.phase === 'finished';
    }

    private get isAtDock(): boolean {
        const { pos, dockPos } = this.state;
        return pos.x === dockPos.x && pos.y === dockPos.y;
    }

    private finish(reason: EndReason): StepResult {
        this.phase = 'finished';
        this.endReason = reason;
        this.tally.endedAtDock = this.isAtDock;
        return { moved: false };
    }

    private planRouteHome(): void {
        const { pos, prevDir, dockPos, turnCost } = this.state;
        const isDock = (p: Point) => p.x === dockPos.x && p.y === dockPos.y;
        this.route = findFullPathToTarget(pos, this.known.grid, prevDir, isDock, turnCost) ?? [];
    }

    private knowsNoMoreWork(): boolean {
        return countReachableGrass(this.known.grid, this.state.pos, true) === 0;
    }

    private charge(): StepResult {
        this.state.battery = Math.max(this.state.battery, this.config.maxBattery * RECHARGED_SHARE);
        this.tally.chargeTrips++;
        this.phase = 'mowing';
        return { moved: false, notice: 'charged' };
    }

    private goHome(): EpisodeNotice {
        this.phase = 'homing';
        this.planRouteHome();
        return 'lawn-done';
    }

    /** Sends the mower home when its map shows no more work, or to charge when the battery is low. */
    private checkMowingPhase(): EpisodeNotice | undefined {
        if (this.phase !== 'mowing') return undefined;
        if (this.knowsNoMoreWork()) return this.goHome();
        if (this.state.battery >= this.config.maxBattery * LOW_BATTERY_SHARE) return undefined;
        this.phase = 'charging-trip';
        this.planRouteHome();
        return 'battery-low';
    }

    /** Advances the job by one step: a move, a charge, or the end. */
    step(policy: MovePolicy): StepResult {
        if (this.phase === 'finished') return { moved: false };

        let notice = this.checkMowingPhase();
        if (this.phase === 'charging-trip' && this.isAtDock) return this.charge();
        let move = this.phase === 'mowing' ? policy(this.state, this.known) : null;
        if (this.phase === 'mowing' && !move) notice = this.goHome();
        if (this.phase === 'homing' && this.isAtDock) return this.finish('completed');

        move ??= this.route.shift() ?? null;
        if (!move) return this.finish('no-way-home');
        this.advance(move);
        return { moved: true, notice };
    }

    private advance(move: Point): void {
        const { state, lawn, config, tally } = this;
        const target = lawn[move.y]?.[move.x];
        if (!isNextTo(state.pos, move) || !target || target.type === CELL_TYPES.OBSTACLE) {
            throw new Error(`Illegal move from ${state.pos.x},${state.pos.y} to ${move.x},${move.y}`);
        }

        const heading = headingBetween(state.pos, move);
        const isTurn = heading.dx !== state.prevDir.dx || heading.dy !== state.prevDir.dy;
        const left = state.pos;
        const outcome = mowTile(lawn[left.y][left.x], heading, isTurn);
        const row = [...lawn[left.y]];
        row[left.x] = outcome.cell;
        lawn[left.y] = row;
        syncTile(this.known, lawn, left);

        tally.steps++;
        if (isTurn) tally.turns++;
        if (outcome.overlapped) tally.overlaps++;
        if (outcome.cutFreshGrass) tally.mowed++;
        state.battery -= config.drainMove + (isTurn ? config.drainTurn : 0);
        state.pos = move;
        state.prevDir = heading;

        if (sense(this.known, lawn, move, config.sensorRange)) {
            state.mapVersion = (state.mapVersion ?? 0) + 1;
            if (this.route.some(p => this.known.grid[p.y][p.x].type === CELL_TYPES.OBSTACLE)) this.planRouteHome();
        }

        const isMowing = this.phase === 'mowing';
        this.stepsSinceCut = outcome.cutFreshGrass || !isMowing ? 0 : this.stepsSinceCut + 1;

        if (state.battery <= 0 && !this.isAtDock) this.finish('stranded');
        else if (this.stepsSinceCut > this.stallSteps) this.finish('stalled');
        else if (tally.steps >= this.maxSteps) this.finish('step-limit');
    }
}

/** Runs a whole job and returns its tally. */
export const runEpisode = (lawn: Lawn, policy: MovePolicy, config?: EpisodeConfig): Episode => {
    const episode = new Episode(lawn, config);
    while (!episode.isFinished) episode.step(policy);
    return episode;
};
