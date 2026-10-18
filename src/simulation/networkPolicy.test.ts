import { describe, it, expect } from 'vitest';
import { CELL_TYPES } from '../constants';
import { buildLawn } from '../algorithms/testSupport';
import { DEFAULT_EPISODE_CONFIG, Episode } from './episode';
import { applyGeneration, centeredRanks, createEsState, perturb, type EsSettings } from './evolutionStrategy';
import { generateLawn, lawnSet } from './lawnGenerator';
import { parseModelFile, toModelFile } from './modelFile';
import { ImitationTrainer } from './imitationTrainer';
import { ACTION_COUNT, NETWORK_LAYERS, networkPolicy, OBSERVATION_SIZE, observe } from './networkPolicy';
import { initialParameters, parameterCount, PolicyNetwork } from './policyNetwork';

describe('PolicyNetwork', () => {
    it('counts weights and biases of every layer', () => {
        expect(parameterCount([3, 2, 1])).toBe(3 * 2 + 2 + 2 * 1 + 1);
    });

    it('computes a tanh hidden layer and a linear output', () => {
        // Hidden: one unit with weights [1, 1], bias 0. Output: weight 2, bias 1.
        const network = new PolicyNetwork({ layers: [2, 1, 1], params: Float32Array.from([1, 1, 0, 2, 1]) });
        expect(network.forward(Float32Array.from([0.5, 0.25]))[0]).toBeCloseTo(2 * Math.tanh(0.75) + 1, 5);
    });

    it('rejects parameters of the wrong length', () => {
        expect(() => new PolicyNetwork({ layers: [2, 1], params: new Float32Array(2) })).toThrow(/Expected 3/);
    });
});

describe('observe', () => {
    it('turns the view with the mower, so the same scene gives the same input', () => {
        const dock = { x: 5, y: 5 };
        const lawn = { grid: buildLawn(11, 11, dock), dock };
        lawn.grid[3][5] = { ...lawn.grid[3][5], type: CELL_TYPES.OBSTACLE }; // two tiles north
        lawn.grid[5][7] = { ...lawn.grid[5][7], type: CELL_TYPES.OBSTACLE }; // two tiles east

        const facingNorth = new Episode(lawn);
        facingNorth.state.prevDir = { dx: 0, dy: -1 };
        const facingEast = new Episode(lawn);
        facingEast.state.prevDir = { dx: 1, dy: 0 };

        const north = observe(facingNorth.state, facingNorth.known, new Float32Array(OBSERVATION_SIZE));
        const east = observe(facingEast.state, facingEast.known, new Float32Array(OBSERVATION_SIZE));
        // Blocked channel, window row 2 (two ahead), centre column 4.
        expect(north[2 * 9 + 4]).toBe(1);
        expect(east[2 * 9 + 4]).toBe(1);
    });
});

describe('distance inputs', () => {
    it('tell which move gets closer to the nearest grass', () => {
        const dock = { x: 0, y: 0 };
        const episode = new Episode({ grid: buildLawn(8, 1, dock), dock }, { ...DEFAULT_EPISODE_CONFIG, sensorRange: 10 });
        for (let x = 1; x <= 3; x++) episode.known.grid[0][x] = { ...episode.known.grid[0][x], type: CELL_TYPES.MOWED };
        episode.state.pos = { x: 2, y: 0 };
        episode.state.prevDir = { dx: 1, dy: 0 };

        const input = observe(episode.state, episode.known, new Float32Array(OBSERVATION_SIZE));
        const nearness = input.slice(OBSERVATION_SIZE - 8, OBSERVATION_SIZE - 4);
        const gradient = input.slice(OBSERVATION_SIZE - 4);
        // Ahead (east) is one step from grass at x = 4; back (west) leads to the dock and away.
        expect(nearness[0]).toBeCloseTo(1 / 2);
        expect(gradient[0]).toBe(-1);
        expect(gradient[2]).toBe(1);
        // Right and left are off the lawn.
        expect(nearness[1]).toBe(0);
        expect(gradient[3]).toBe(1);
    });
});

describe('ImitationTrainer', () => {
    it('learns to copy a simple teacher', async () => {
        const layers = [3, 8, ACTION_COUNT];
        const network = { layers, params: initialParameters(layers, 5) };
        const data = Array.from({ length: 60 }, (_, i) => ({ input: Float32Array.from([0, 1, 2].map(k => (k === i % 3 ? 1 : 0))), action: (i % 3) + 1 }));
        await new ImitationTrainer(network).trainEpochs(data, 60, 8, 0.02, 1);
        const policy = new PolicyNetwork(network);
        for (const { input, action } of data.slice(0, 3)) {
            const outputs = Array.from(policy.forward(input));
            expect(outputs.indexOf(Math.max(...outputs))).toBe(action);
        }
    });
});

describe('networkPolicy', () => {
    it('never picks a blocked move', () => {
        const dock = { x: 0, y: 0 };
        const grid = buildLawn(3, 3, dock);
        grid[1][0] = { ...grid[1][0], type: CELL_TYPES.OBSTACLE };
        const episode = new Episode({ grid, dock });
        for (let seed = 1; seed <= 20; seed++) {
            const move = networkPolicy({ layers: NETWORK_LAYERS, params: initialParameters(NETWORK_LAYERS, seed) })(episode.state, episode.known);
            expect(move).toEqual({ x: 1, y: 0 });
        }
    });
});

describe('evolution strategies', () => {
    it('ranks to the range −0.5 … 0.5', () => {
        expect(centeredRanks([10, -3, 4])).toEqual([0.5, -0.5, 0]);
    });

    it('climbs a simple objective', () => {
        const target = 0.7;
        const state = createEsState([1, 1], 3);
        const settings: EsSettings = { pairs: 16, sigma: 0.1, learningRate: 0.05, weightDecay: 0, lawnsPerGeneration: 1 };
        const buffer = new Float32Array(state.params.length);
        const score = (params: Float32Array) => -params.reduce((sum, p) => sum + (p - target) ** 2, 0);
        for (let generation = 0; generation < 150; generation++) {
            const results = Array.from({ length: settings.pairs }, (_, pair) => {
                const noiseSeed = generation * 100 + pair;
                return {
                    noiseSeed,
                    plus: score(perturb(state.params, noiseSeed, 1, settings.sigma, buffer)),
                    minus: score(perturb(state.params, noiseSeed, -1, settings.sigma, buffer)),
                };
            });
            applyGeneration(state, settings, results);
        }
        expect(score(state.params)).toBeGreaterThan(-0.01);
    });
});

describe('model files', () => {
    it('round-trip and refuse other shapes', () => {
        const network = { layers: NETWORK_LAYERS, params: initialParameters(NETWORK_LAYERS, 1) };
        const json = JSON.stringify(toModelFile({ network, generation: 7, validationCost: 2.5 }));
        const loaded = parseModelFile(json);
        expect(loaded.generation).toBe(7);
        expect(Array.from(loaded.network.params)).toEqual(Array.from(network.params));
        expect(() => parseModelFile(JSON.stringify({ ...JSON.parse(json), layers: [1, 2] }))).toThrow(/does not match/);
    });
});

describe('generateLawn', () => {
    it('gives the same lawn for the same seed and keeps the dock free', () => {
        expect(generateLawn(42)).toEqual(generateLawn(42));
        for (const { grid, dock } of lawnSet('test', 30)) {
            expect(grid[dock.y][dock.x].type).toBe(CELL_TYPES.DOCK);
            const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => grid[dock.y + dy]?.[dock.x + dx]);
            expect(neighbours.some(cell => cell && cell.type !== CELL_TYPES.OBSTACLE)).toBe(true);
        }
    });
});
