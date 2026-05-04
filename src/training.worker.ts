import { NeuralNetwork } from './NeuralNetwork';
import { FitnessEvaluator } from './utils/fitness';
import type { Grid, Point } from './types';

// Šis failas veikia atskirame procesoriaus sraute
self.onmessage = async (e: MessageEvent) => {
    const { populationData, trainingMaps, dockPos, maxSteps, workerId, orientation } = e.data;
    
    const results = [];
    
    for (const data of populationData) {
        const nn = new NeuralNetwork(data.layers);
        nn.setWeights(data.weights);
        
        let totalFitness = 0;
        for (const map of trainingMaps) {
            totalFitness += await FitnessEvaluator.evaluate(nn, map, dockPos, maxSteps, orientation);
        }
        
        results.push({
            id: data.id,
            fitness: totalFitness / trainingMaps.length
        });
    }
    
    self.postMessage({ workerId, results });
};
