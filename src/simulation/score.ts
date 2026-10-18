/**
 * The one score every model is judged by, fixed before any network was trained.
 * Lower is better. Units are "steps": a turn costs as much as two steps, a step
 * over grass that is already cut costs one extra step, a charge trip costs the
 * time of 25 steps, and every reachable tile left uncut costs 20 steps, so
 * skipping work never pays.
 */
export const SCORE_WEIGHTS = {
    step: 1,
    turn: 2,
    overlap: 1,
    chargeTrip: 25,
    missedTile: 20,
    notDocked: 100,
} as const;

/** What one run did, counted by the episode engine. */
export interface RunTally {
    steps: number;
    turns: number;
    /** Steps that left a tile which was already cut. */
    overlaps: number;
    chargeTrips: number;
    mowed: number;
    /** Grass the mower could reach from the dock on the real lawn. */
    reachableGrass: number;
    endedAtDock: boolean;
}

export const runCost = (tally: RunTally): number => {
    const missed = Math.max(0, tally.reachableGrass - tally.mowed);
    return tally.steps * SCORE_WEIGHTS.step
        + tally.turns * SCORE_WEIGHTS.turn
        + tally.overlaps * SCORE_WEIGHTS.overlap
        + tally.chargeTrips * SCORE_WEIGHTS.chargeTrip
        + missed * SCORE_WEIGHTS.missedTile
        + (tally.endedAtDock ? 0 : SCORE_WEIGHTS.notDocked);
};

/** Cost per reachable tile, so lawns of different sizes can be compared and averaged. */
export const costPerTile = (tally: RunTally): number => runCost(tally) / Math.max(1, tally.reachableGrass);
