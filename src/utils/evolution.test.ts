import { describe, it, expect } from 'vitest';
import { NeuralNetwork } from '../NeuralNetwork';
import { breedNextGeneration, CHAMPION_ID, crownChampion, seedPopulation, type ScoredIndividual } from './evolution';

const LAYERS = [3, 4, 4];
const scored = (id: number, fitness: number): ScoredIndividual => ({ id, fitness, nn: new NeuralNetwork(LAYERS) });

describe('crownChampion', () => {
    it('replaces the champion only with a better network', () => {
        const champion = { nn: new NeuralNetwork(LAYERS), fitness: 100 };
        expect(crownChampion(champion, [scored(3, 90)], false)).toEqual({ champion, improved: false });
        expect(crownChampion(champion, [scored(3, 110)], false).improved).toBe(true);
    });

    it('rescores the champion on new maps, so an old lucky score does not block progress', () => {
        const champion = { nn: new NeuralNetwork(LAYERS), fitness: 1000 };
        const ranked = [scored(5, 400), scored(CHAMPION_ID, 300)];
        const result = crownChampion(champion, ranked, true);
        expect(result.improved).toBe(true);
        expect(result.champion.fitness).toBe(400);
    });

    it('keeps the rescored value when the champion is still best', () => {
        const champion = { nn: new NeuralNetwork(LAYERS), fitness: 1000 };
        const result = crownChampion(champion, [scored(CHAMPION_ID, 300), scored(5, 200)], true);
        expect(result).toMatchObject({ improved: false, champion: { fitness: 300 } });
    });
});

describe('population', () => {
    it('keeps an unchanged copy of the parent at the champion slot', () => {
        const parent = new NeuralNetwork(LAYERS);
        const population = seedPopulation(10, LAYERS, parent);
        expect(population).toHaveLength(10);
        expect(population[CHAMPION_ID].nn.getWeights()).toEqual(parent.getWeights());
        expect(population[CHAMPION_ID].nn).not.toBe(parent);
    });

    it('breeds a full generation with unique ids and the champion first', () => {
        const ranked = [scored(0, 3), scored(1, 2), scored(2, 1)];
        const next = breedNextGeneration(ranked, ranked[0].nn, 12, 0.1);
        expect(next.map(i => i.id)).toEqual([...Array(12).keys()]);
        expect(next[CHAMPION_ID].nn.getWeights()).toEqual(ranked[0].nn.getWeights());
    });
});
