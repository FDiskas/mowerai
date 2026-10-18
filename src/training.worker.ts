import { NeuralNetwork } from './NeuralNetwork';
import { evaluateFitness, type FitnessOptions } from './utils/fitness';
import type { Grid } from './types';

export interface TrainingRequest {
    workerId: number;
    populationData: { id: number; weights: number[]; layers: number[] }[];
    trainingMaps: Grid[];
    fitnessOptions: FitnessOptions;
}

export interface TrainingResponse {
    workerId: number;
    results: { id: number; fitness: number }[];
}

// Scores a slice of the population on every training map, off the UI thread.
self.onmessage = (e: MessageEvent<TrainingRequest>) => {
    const { populationData, trainingMaps, fitnessOptions, workerId } = e.data;

    const results = populationData.map(({ id, weights, layers }) => {
        const nn = new NeuralNetwork(layers);
        nn.setWeights(weights);
        const totalFitness = trainingMaps.reduce((sum, map) => sum + evaluateFitness(nn, map, fitnessOptions), 0);
        return { id, fitness: totalFitness / trainingMaps.length };
    });

    const response: TrainingResponse = { workerId, results };
    self.postMessage(response);
};
