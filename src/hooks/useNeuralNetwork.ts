import { useState, useRef, useEffect } from 'react';
import { NeuralNetwork } from '../NeuralNetwork';
import { FitnessEvaluator } from '../utils/fitness';
import type { Grid, Point } from '../types';
import { CELL_TYPES, DEFAULT_MAX_BATTERY } from '../constants';

export const useNeuralNetwork = (grid: Grid, dockPos: Point, setStatusMessage: (msg: string) => void) => {

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
        setNn(new NeuralNetwork([28, 64, 32, 4]));
    }, []);

    const trainOnData = (sessionData: any[]) => {
        if (!nn || !sessionData || sessionData.length === 0) return;

        let totalError = 0;
        for (let i = 0; i < 10; i++) {
            sessionData.forEach(item => {
                totalError += nn.train(item.inputs, item.targets);
            });
        }

        const avgErr = totalError / (sessionData.length * 10);
        setTrainingStatus(prev => ({ ...prev, avgError: avgErr }));
        setStatusMessage(`Modelis apmokytas pagal jūsų pavyzdį (Error: ${avgErr.toFixed(4)})`);
    };


    const generateTrainingMaps = (width: number, height: number, dock: Point): Grid[] => {
        const createBase = () => Array(height).fill(null).map((_, r) =>
            Array(width).fill(null).map((_, c) => ({
                type: (r === dock.y && c === dock.x) ? CELL_TYPES.DOCK : CELL_TYPES.GRASS,
                damage: 0,
                direction: null
            }))
        );

        // 1. Empty Map
        const empty = createBase();

        // 2. Standard Obstacles
        const obstacles = createBase();
        for (let i = 0; i < 15; i++) {
            const rx = Math.floor(Math.random() * width);
            const ry = Math.floor(Math.random() * height);
            if (rx !== dock.x || ry !== dock.y) obstacles[ry][rx].type = CELL_TYPES.OBSTACLE;
        }

        // 3. Labyrinth/Maze
        const maze = createBase();
        for (let r = 0; r < height; r += 2) {
            for (let c = 0; c < width; c++) {
                if (Math.random() > 0.3 && (c !== dock.x || r !== dock.y)) {
                    maze[r][c].type = CELL_TYPES.OBSTACLE;
                }
            }
        }

        return [empty, obstacles, maze];
    };

    const trainNN = async () => {
        if (isTrainingRef.current) {
            isTrainingRef.current = false;
            return;
        }

        isTrainingRef.current = true;
        setStatusMessage("Vykdomas UNIVERSALUS mokymas (3 aplinkos)...");

        const popSize = 40;
        const maxSteps = 800;
        let gen = trainingStatus.epoch;

        bestFitnessRef.current = trainingStatus.bestFitness;
        bestNnRef.current = currentNnRef.current;

        const trainingMaps = generateTrainingMaps(25, 20, dockPos);

        let population = Array(popSize).fill(null).map(() => {
            const n = new NeuralNetwork([28, 64, 32, 4]);
            if (bestNnRef.current) n.setWeights(bestNnRef.current.getWeights());
            n.mutate(0.2, 0.2);
            return n;
        });

        setTrainingStatus(prev => ({ ...prev, isTraining: true }));

        while (isTrainingRef.current) {
            gen++;
            const results: { nn: NeuralNetwork, fitness: number }[] = [];

            // Lygiagretus vertinimas (Parallel Evaluation in chunks)
            const chunkSize = 10;
            for (let i = 0; i < popSize; i += chunkSize) {
                if (!isTrainingRef.current) break;
                
                const chunk = population.slice(i, i + chunkSize);
                const chunkPromises = chunk.map(async (individual) => {
                    let totalFitness = 0;
                    for (const map of trainingMaps) {
                        totalFitness += await FitnessEvaluator.evaluate(individual, map, dockPos, maxSteps);
                    }
                    return { nn: individual, fitness: totalFitness / trainingMaps.length };
                });

                const chunkResults = await Promise.all(chunkPromises);
                results.push(...chunkResults);

                // Leidžiame UI „atsikvėpti“ tarp grupių
                await new Promise(r => setTimeout(r, 0));
            }

            if (!isTrainingRef.current) break;

            results.sort((a, b) => b.fitness - a.fitness);
            const bestInGen = results[0];
            const avgFitness = results.reduce((sum, r) => sum + r.fitness, 0) / popSize;

            if (bestInGen.fitness > bestFitnessRef.current) {
                bestFitnessRef.current = bestInGen.fitness;
                bestNnRef.current = bestInGen.nn;
                setNn(bestInGen.nn);
            }

            // Selection and Breeding
            const survivors = results.slice(0, 10).map(r => r.nn);
            const nextPop = [bestNnRef.current || survivors[0]]; // Elitism

            while (nextPop.length < popSize) {
                if (Math.random() < 0.4) {
                    // Crossover
                    const p1 = survivors[Math.floor(Math.random() * survivors.length)];
                    const p2 = survivors[Math.floor(Math.random() * survivors.length)];
                    const child = NeuralNetwork.crossover(p1, p2);
                    child.mutate(0.05, 0.1); 
                    nextPop.push(child);
                } else {
                    // Mutation
                    const parent = survivors[Math.floor(Math.random() * survivors.length)];
                    const child = parent.copy();
                    const mutRate = 0.1 + Math.random() * 0.1;
                    child.mutate(mutRate, 0.2);
                    nextPop.push(child);
                }
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

        setTrainingStatus(prev => ({ ...prev, isTraining: false }));
        setStatusMessage("NN Optimizavimas sustabdytas.");
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
                
                // Ar modelis tinka dabartiniam kodui (28 įėjimai)?
                if (!data.layers || data.layers[0] !== 28) {
                    setStatusMessage(`KLAIDA: Modelis nesuderinamas! Tikimasi 28 jutiklių, o rasta ${data.layers ? data.layers[0] : 'nežinoma'}.`);
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
