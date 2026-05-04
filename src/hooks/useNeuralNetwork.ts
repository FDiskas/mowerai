import { useState, useRef, useEffect } from 'react';
import { NeuralNetwork } from '../NeuralNetwork';
import { FitnessEvaluator } from '../utils/fitness';
import type { Grid, Point } from '../types';
import { CELL_TYPES, DEFAULT_MAX_BATTERY } from '../constants';

export const useNeuralNetwork = (grid: Grid, dockPos: Point, setStatusMessage: (msg: string) => void, orientation: 'horizontal' | 'vertical' = 'horizontal') => {

    const [nn, setNn] = useState<NeuralNetwork | null>(null);
    const [trainingStatus, setTrainingStatus] = useState({
        isTraining: false,
        epoch: 0,
        totalEpochs: 0,
        avgError: 0,
        bestFitness: -Infinity
    });
    const isTrainingRef = useRef(false);
    const bestFitnessRef = useRef(-Infinity);
    const bestNnRef = useRef<NeuralNetwork | null>(null);
    const currentNnRef = useRef<NeuralNetwork | null>(null);

    useEffect(() => {
        currentNnRef.current = nn;
    }, [nn]);

    useEffect(() => {
        setNn(new NeuralNetwork([38, 64, 32, 4]));
    }, []);

    const trainOnData = (sessionData: any[]) => {
        if (!nn || !sessionData || sessionData.length === 0) return;

        // Mokome tinklą po vieną žingsnį
        for (let i = 0; i < 5; i++) { // 5 epochos per sesiją
            sessionData.forEach(item => {
                nn.train(item.inputs, item.targets);
            });
        }
        setNn(nn.copy());
        setStatusMessage(`AI pasimokė iš jūsų važiavimo (${sessionData.length} žingsnių)`);
    };


    const generateTrainingMaps = (width: number, height: number, dock: Point): Grid[] => {
        const empty: Grid = Array(height).fill(null).map((_, r) =>
            Array(width).fill(null).map((_, c) => ({
                type: (r === dock.y && c === dock.x) ? CELL_TYPES.DOCK : CELL_TYPES.GRASS,
                damage: 0
            }))
        );

        const obstacles = JSON.parse(JSON.stringify(empty));
        for (let i = 0; i < 30; i++) {
            const r = Math.floor(Math.random() * height);
            const c = Math.floor(Math.random() * width);
            if (r !== dock.y || c !== dock.x) obstacles[r][c].type = CELL_TYPES.OBSTACLE;
        }

        const maze = JSON.parse(JSON.stringify(empty));
        for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
                if (Math.random() > 0.3 && (c !== dock.x || r !== dock.y)) {
                    maze[r][c].type = CELL_TYPES.OBSTACLE;
                }
            }
        }

        const longCorridor: Grid = JSON.parse(JSON.stringify(empty));
        for (let c = 5; c < width - 5; c++) {
            longCorridor[7][c].type = CELL_TYPES.OBSTACLE;
            longCorridor[12][c].type = CELL_TYPES.OBSTACLE;
        }

        const cluttered: Grid = JSON.parse(JSON.stringify(empty));
        for (let i = 0; i < 60; i++) {
            const r = Math.floor(Math.random() * height);
            const c = Math.floor(Math.random() * width);
            if (r !== dock.y || c !== dock.x) cluttered[r][c].type = CELL_TYPES.OBSTACLE;
        }

        return [empty, obstacles, maze, longCorridor, cluttered];
    };

    const trainNN = async () => {
        if (isTrainingRef.current) {
            isTrainingRef.current = false;
            return;
        }

        isTrainingRef.current = true;
        const numWorkers = navigator.hardwareConcurrency || 4;
        setStatusMessage(`Mokymas su ${numWorkers} CPU branduoliais...`);

        const popSize = 40;
        const maxSteps = 800;
        let gen = trainingStatus.epoch;

        bestFitnessRef.current = trainingStatus.bestFitness;
        bestNnRef.current = currentNnRef.current;

        const trainingMaps = generateTrainingMaps(25, 20, dockPos);

        let population = Array(popSize).fill(null).map((_, i) => {
            const n = new NeuralNetwork([38, 64, 32, 4]);
            if (bestNnRef.current && bestNnRef.current.layers[0] === 38) {
                n.setWeights(bestNnRef.current.getWeights());
            }
            n.mutate(0.2, 0.4);
            return { id: i, nn: n };
        });

        setTrainingStatus(prev => ({ ...prev, isTraining: true }));

        // Sukuriame darbininkų „baseiną“ vieną kartą
        const workers = Array(numWorkers).fill(null).map(() => 
            new Worker(new URL('../training.worker.ts', import.meta.url), { type: 'module' })
        );

        let currentTrainingMaps = trainingMaps;
        let stagnationCount = 0;
        let mutationStrength = 0.1;

        try {
            while (isTrainingRef.current) {
                gen++;
                const results: { nn: NeuralNetwork, fitness: number }[] = [];

                const chunkSize = Math.ceil(popSize / numWorkers);
                const workerPromises = [];

                for (let w = 0; w < numWorkers; w++) {
                    const workerData = population.slice(w * chunkSize, (w + 1) * chunkSize);
                    if (workerData.length === 0) continue;

                    workerPromises.push(new Promise((resolve) => {
                        const worker = workers[w];
                        
                        worker.onmessage = (e) => {
                            const workerResults = e.data.results.map(res => ({
                                nn: population.find(p => p.id === res.id).nn,
                                fitness: res.fitness
                            }));
                            resolve(workerResults);
                        };

                        worker.postMessage({
                            workerId: w,
                            populationData: workerData.map(p => ({ 
                                id: p.id, 
                                weights: p.nn.getWeights(),
                                layers: p.nn.layers 
                            })),
                            trainingMaps: currentTrainingMaps,
                            dockPos,
                            maxSteps,
                            orientation
                        });
                    }));
                }

                const allResults = await Promise.all(workerPromises);
                results.push(...allResults.flat());

                results.sort((a, b) => b.fitness - a.fitness);
                const bestInGen = results[0];
                const avgFitness = results.reduce((sum, r) => sum + r.fitness, 0) / popSize;

                if (bestInGen.fitness > bestFitnessRef.current) {
                    bestFitnessRef.current = bestInGen.fitness;
                    bestNnRef.current = bestInGen.nn;
                    setNn(bestInGen.nn);
                    stagnationCount = 0;
                    mutationStrength = 0.1;
                } else {
                    stagnationCount++;
                    if (stagnationCount > 10) {
                        mutationStrength = Math.min(0.5, mutationStrength + 0.05);
                    }
                }

                // Dinamiškai keičiame žemėlapius kas 20 kartų, kad AI būtų universalus
                if (gen % 20 === 0) {
                    currentTrainingMaps = generateTrainingMaps(25, 20, dockPos);
                }

                // Selection and Breeding
                const survivors = results.slice(0, 10).map(r => r.nn);
                const nextPop: {id: number, nn: NeuralNetwork}[] = [{ id: 0, nn: (bestNnRef.current || survivors[0]).copy() }]; // Elitism

                while (nextPop.length < popSize) {
                    let childNn: NeuralNetwork;
                    if (Math.random() < 0.4) {
                        const p1 = survivors[Math.floor(Math.random() * survivors.length)];
                        const p2 = survivors[Math.floor(Math.random() * survivors.length)];
                        childNn = NeuralNetwork.crossover(p1, p2);
                        childNn.mutate(0.05, mutationStrength / 2); 
                    } else {
                        const parent = survivors[Math.floor(Math.random() * survivors.length)];
                        childNn = parent.copy();
                        const mutRate = 0.1 + Math.random() * 0.1;
                        childNn.mutate(mutRate, mutationStrength);
                    }
                    nextPop.push({ id: nextPop.length, nn: childNn });
                }
                population = nextPop;

                setTrainingStatus(prev => ({
                    ...prev,
                    epoch: gen,
                    avgError: avgFitness,
                    bestFitness: bestFitnessRef.current
                }));

                await new Promise(r => setTimeout(r, 10));
            }
        } finally {
            workers.forEach(w => w.terminate());
            setTrainingStatus(prev => ({ ...prev, isTraining: false }));
            setStatusMessage("NN Optimizavimas sustabdytas.");
        }
    };

    const downloadModel = () => {
        if (!nn) return;
        const data = nn.save();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mower_nn_model.json';
        a.click();
    };

    const uploadModel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const contents = event.target?.result as string;
                const data = JSON.parse(contents);
                
                // Ar modelis tinka dabartiniam kodui (38 įėjimai)?
                if (!data.layers || data.layers[0] !== 38) {
                    setStatusMessage(`KLAIDA: Modelis nesuderinamas! Tikimasi 38 jutiklių (8-krypčių + orientacija), o rasta ${data.layers ? data.layers[0] : 'nežinoma'}.`);
                    return;
                }

                const loadedNn = NeuralNetwork.load(contents);
                setNn(loadedNn);
                setStatusMessage("Modelis sėkmingai įkeltas!");
            } catch (err) {
                setStatusMessage("KLAIDA: Nepavyko perskaityti failo.");
            }
        };
        reader.readAsText(file);
    };


    const stopTraining = () => {
        isTrainingRef.current = false;
    };

    return {
        nn,
        trainingStatus,
        trainNN,
        trainOnData,
        stopTraining,
        downloadModel,
        uploadModel
    };
};
