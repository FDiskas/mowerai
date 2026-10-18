import { describe, it, expect } from 'vitest';
import { CELL_TYPES } from '../constants';
import { NeuralNetwork } from '../NeuralNetwork';
import { buildLawn } from '../algorithms/testSupport';
import { idealFitness, networkPolicy, runFitnessEpisode, shareOfIdeal } from './fitness';
import { generateTrainingMaps } from './trainingMaps';

const LAYERS = [47, 64, 32, 4];

describe('runFitnessEpisode', () => {
    it('earns the completion bonus: it mows a strip and drives back to the dock', () => {
        const dock = { x: 0, y: 0 };
        const report = runFitnessEpisode(networkPolicy(new NeuralNetwork(LAYERS)), buildLawn(6, 1, dock), { dockPos: dock, maxSteps: 100 });
        expect(report).toMatchObject({ mowed: 5, reachableGrass: 5, completed: true, steps: 10 });
    });

    it('counts only grass the mower can reach', () => {
        const dock = { x: 0, y: 0 };
        const lawn = buildLawn(6, 1, dock);
        lawn[0][3] = { ...lawn[0][3], type: CELL_TYPES.OBSTACLE };
        const report = runFitnessEpisode(networkPolicy(new NeuralNetwork(LAYERS)), lawn, { dockPos: dock, maxSteps: 100 });
        expect(report).toMatchObject({ reachableGrass: 2, mowed: 2, completed: true });
    });

    it('goes home to charge and comes back when the battery runs low', () => {
        const dock = { x: 0, y: 0 };
        const report = runFitnessEpisode(networkPolicy(new NeuralNetwork(LAYERS)), buildLawn(10, 10, dock), {
            dockPos: dock,
            maxSteps: 2000,
            drainMove: 1,
            drainTurn: 0,
        });
        expect(report.chargeCycles).toBeGreaterThan(0);
        expect(report.mowed).toBeGreaterThan(80);
    });

    it('keeps penalties of forced trips home out of the score', () => {
        const dock = { x: 0, y: 0 };
        const options = { dockPos: dock, maxSteps: 3000, drainMove: 0.5, drainTurn: 0.3 };
        const report = runFitnessEpisode(networkPolicy(new NeuralNetwork(LAYERS)), buildLawn(20, 15, dock), options);
        expect(report.chargeCycles).toBeGreaterThan(1);
        expect(report.completed).toBe(true);
        expect(report.fitness).toBeGreaterThan(0);
    });

    it('does not change the lawn it is given', () => {
        const dock = { x: 0, y: 0 };
        const lawn = buildLawn(5, 5, dock);
        runFitnessEpisode(networkPolicy(new NeuralNetwork(LAYERS)), lawn, { dockPos: dock, maxSteps: 100 });
        expect(lawn.flat().filter(c => c.type === CELL_TYPES.MOWED)).toHaveLength(0);
    });
});

describe('idealFitness', () => {
    const dock = { x: 0, y: 0 };

    it('is higher than any network scores on the training maps', () => {
        const options = { dockPos: dock, maxSteps: 800, drainMove: 0.5, drainTurn: 0.3 };
        for (const lawn of generateTrainingMaps(25, 20, dock)) {
            const report = runFitnessEpisode(networkPolicy(new NeuralNetwork(LAYERS)), lawn, options);
            expect(report.fitness).toBeLessThan(idealFitness(lawn, options));
        }
    });

    it('drops when the lawn needs more lanes, because every lane change costs two turns', () => {
        const wide = idealFitness(buildLawn(10, 2, dock), { dockPos: dock, maxSteps: 100 });
        const tall = idealFitness(buildLawn(2, 10, dock), { dockPos: dock, maxSteps: 100 });
        expect(wide).toBeGreaterThan(tall);
    });

    it('counts grass that an earlier run already mowed', () => {
        const lawn = buildLawn(6, 1, dock);
        const mowedLawn = lawn.map(row => row.map(cell => cell.type === CELL_TYPES.GRASS ? { ...cell, type: CELL_TYPES.MOWED } : cell));
        expect(idealFitness(mowedLawn, { dockPos: dock, maxSteps: 100 })).toBe(idealFitness(lawn, { dockPos: dock, maxSteps: 100 }));
    });

    it('is 0 when no grass can be reached', () => {
        expect(idealFitness(buildLawn(1, 1, dock), { dockPos: dock, maxSteps: 100 })).toBe(0);
    });
});

describe('shareOfIdeal', () => {
    it.each([
        [50, 100, 0.5],
        [150, 100, 1],
        [-20, 100, 0],
        [-Infinity, 100, 0],
        [50, 0, 0],
    ])('fitness %d of ideal %d is %d', (fitness, ideal, share) => {
        expect(shareOfIdeal(fitness, ideal)).toBe(share);
    });
});
