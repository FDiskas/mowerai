import { useState, useRef, useEffect, useCallback } from 'react';
import { NeuralNetwork } from '../NeuralNetwork';
import type { Grid, Point, FitnessConfig } from '../types';
import { DEFAULT_FITNESS_CONFIG } from '../types';
import { CELL_TYPES } from '../constants';
import { getNeuralNetworkMove } from '../algorithms';
import { mowTile, headingBetween } from '../domain/MowingStep';
import { resetLawn } from '../utils/simUtils';

export const useNeuralNetwork = (
    dockPos: Point,
    setStatusMessage: (msg: string) => void,
    orientation: 'horizontal' | 'vertical' = 'horizontal',
    speed: number = 85
) => {

    const [nn, setNn] = useState<NeuralNetwork | null>(null);
    const [trainingStatus, setTrainingStatus] = useState({
        isTraining: false,
        epoch: 0,
        totalEpochs: 0,
        avgError: 0,
        bestFitness: -Infinity
    });
    const [showVisualTraining, setShowVisualTraining] = useState(false);
    const [previewGrid, setPreviewGrid] = useState<Grid | null>(null);
    const [previewMowerPos, setPreviewMowerPos] = useState<Point | null>(null);
    const [previewMowerDir, setPreviewMowerDir] = useState<{ dx: number; dy: number } | null>(null);
    const [fitnessConfig, setFitnessConfig] = useState<FitnessConfig>(DEFAULT_FITNESS_CONFIG);

    const isTrainingRef = useRef(false);
    const bestFitnessRef = useRef(-Infinity);
    const bestNnRef = useRef<NeuralNetwork | null>(null);
    const currentNnRef = useRef<NeuralNetwork | null>(null);
    const previewIntervalRef = useRef<any>(null);
    const previewStateRef = useRef<any>(null);
    const userGridRef = useRef<Grid | null>(null);

    useEffect(() => {
        currentNnRef.current = nn;
    }, [nn]);

    useEffect(() => {
        setNn(new NeuralNetwork([47, 64, 32, 4]));
    }, []);

    // Start/stop preview loop on the main map
    useEffect(() => {
        if (previewIntervalRef.current) {
            clearInterval(previewIntervalRef.current);
            previewIntervalRef.current = null;
        }

        if (!showVisualTraining) {
            setPreviewGrid(null);
            setPreviewMowerPos(null);
            setPreviewMowerDir(null);
            return;
        }

        // Animate only while evolution is actually running; once it stops the
        // last frame stays frozen instead of looping forever.
        if (!trainingStatus.isTraining) return;

        const sourceGrid = userGridRef.current;
        const previewNn = bestNnRef.current;
        if (!sourceGrid || !previewNn) return;

        // Reset preview state
        const cleanGrid: Grid = resetLawn(sourceGrid);

        previewStateRef.current = {
            pos: { ...dockPos },
            prevDir: { dx: 0, dy: 1 },
            battery: 100,
            grid: cleanGrid,
            dockPos: { ...dockPos },
            isCharging: false,
            isReturningForCharge: false,
            visitCounts: {},
            orientation,
            maxBattery: 100
        };

        setPreviewGrid(cleanGrid.map(r => [...r]));
        setPreviewMowerPos({ ...dockPos });
        setPreviewMowerDir({ dx: 0, dy: 1 });

        previewIntervalRef.current = setInterval(() => {
            const state = previewStateRef.current;
            const currentNn = bestNnRef.current;
            if (!state || !currentNn) return;

            const move = getNeuralNetworkMove(state, state.grid, state.prevDir, CELL_TYPES, currentNn);
            if (!move) return;

            const heading = headingBetween(state.pos, move);
            const isTurn = heading.dx !== state.prevDir.dx || heading.dy !== state.prevDir.dy;

            // Cut the tile being left with the shared rule so the preview records
            // heading, wear and overlap exactly like the live simulation.
            state.grid[state.pos.y][state.pos.x] =
                mowTile(state.grid[state.pos.y][state.pos.x], heading, isTurn).cell;

            // Updating visit count – same as in the fitness function
            const posKey = `${move.x},${move.y}`;
            const visitCount = (state.visitCounts[posKey] || 0) + 1;
            state.visitCounts[posKey] = visitCount;

            state.pos = move;
            state.prevDir = heading;
            state.battery -= 0.2;

            const isDock = move.x === dockPos.x && move.y === dockPos.y;
            const isLooping = !isDock && visitCount >= 5;

            if (state.battery <= 0 || isLooping) {
                // Reset – battery ran out or robot was spinning in one place
                const src = userGridRef.current;
                if (!src) return;
                const fresh: Grid = resetLawn(src);
                previewStateRef.current = {
                    pos: { ...dockPos },
                    prevDir: { dx: 0, dy: 1 },
                    battery: 100,
                    grid: fresh,
                    dockPos: { ...dockPos },
                    isCharging: false,
                    isReturningForCharge: false,
                    visitCounts: {},
                    orientation,
                    maxBattery: 100
                };
                setPreviewGrid(fresh.map(r => [...r]));
                setPreviewMowerPos({ ...dockPos });
                setPreviewMowerDir({ dx: 0, dy: 1 });
                return;
            }

            setPreviewMowerPos({ ...move });
            setPreviewMowerDir(heading);
            setPreviewGrid([...state.grid.map((r: any) => [...r])]);
        }, Math.max(10, 140 - speed));


        return () => {
            if (previewIntervalRef.current) clearInterval(previewIntervalRef.current);
        };
    }, [showVisualTraining, trainingStatus.isTraining, dockPos, orientation, speed]);

    const trainOnData = useCallback((sessionData: any[]) => {
        if (!nn || !sessionData || sessionData.length === 0) return;

        // Copying data so we can shuffle
        const data = [...sessionData];
        
        // Training the network with Adam optimizer
        for (let i = 0; i < 10; i++) { // 10 epochs
            // Random shuffle (Fisher-Yates)
            for (let j = data.length - 1; j > 0; j--) {
                const k = Math.floor(Math.random() * (j + 1));
                [data[j], data[k]] = [data[k], data[j]];
            }

            data.forEach(item => {
                nn.train(item.inputs, item.targets);
            });
        }
        
        setNn(nn.copy());
        setStatusMessage(`AI learned from your drive (${sessionData.length} steps)`);
    }, [nn, setNn, setStatusMessage]);


    const generateTrainingMaps = (width: number, height: number, dock: Point): Grid[] => {
        const empty: Grid = Array(height).fill(null).map((_, r) =>
            Array(width).fill(null).map((_, c) => ({
                type: (r === dock.y && c === dock.x) ? CELL_TYPES.DOCK : CELL_TYPES.GRASS,
                damage: 0,
                direction: null
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

    const trainNN = useCallback(async (userGrid?: Grid, drainMove?: number, drainTurn?: number) => {
        // Store user grid for preview simulation
        if (userGrid) userGridRef.current = userGrid;

        if (isTrainingRef.current) {
            isTrainingRef.current = false;
            return;
        }

        isTrainingRef.current = true;
        const numWorkers = navigator.hardwareConcurrency || 4;
        setStatusMessage(`Training with ${numWorkers} CPU cores...`);

        const popSize = 60; // Increased for better genetic diversity
        const maxSteps = 800;
        let gen = trainingStatus.epoch;

        bestFitnessRef.current = trainingStatus.bestFitness;
        bestNnRef.current = currentNnRef.current;

        const trainingDockPos = dockPos;
        let currentTrainingMaps = generateTrainingMaps(25, 20, trainingDockPos);
        
        if (userGrid) {
            currentTrainingMaps.push(userGrid);
        }

        let population = Array(popSize).fill(null).map((_, i) => {
            const n = new NeuralNetwork([47, 64, 32, 4]);
            if (bestNnRef.current && bestNnRef.current.layers[0] === 47) {
                n.setWeights(bestNnRef.current.getWeights());
                // Keep the original best NN intact at index 0 without initial mutation
                if (i === 0) {
                    return { id: i, nn: n };
                }
            }
            // More aggressive initial mutation for diversity
            n.mutate(0.3, 0.5);
            return { id: i, nn: n };
        });

        setTrainingStatus(prev => ({ ...prev, isTraining: true }));

        const workers = Array(numWorkers).fill(null).map(() => 
            new Worker(new URL('../training.worker.ts', import.meta.url), { type: 'module' })
        );

        let stagnationCount = 0;
        let mutationStrength = 0.1;

        try {
            while (isTrainingRef.current) {
                gen++;
                const results: { nn: NeuralNetwork, fitness: number }[] = [];

                const chunkSize = Math.ceil(popSize / numWorkers);
                const workerPromises: Promise<{nn: NeuralNetwork, fitness: number}[]>[] = [];

                for (let w = 0; w < numWorkers; w++) {
                    const workerData = population.slice(w * chunkSize, (w + 1) * chunkSize);
                    if (workerData.length === 0) continue;

                    workerPromises.push(new Promise((resolve) => {
                        const worker = workers[w];
                        
                        worker.onmessage = (e) => {
                            const workerResults = e.data.results.map((res: any) => {
                                const parent = population.find(p => p.id === res.id);
                                return {
                                    nn: parent ? parent.nn : new NeuralNetwork([47, 64, 32, 4]),
                                    fitness: res.fitness
                                };
                            });
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
                            orientation,
                            drainMove: drainMove ?? 0.5,
                            drainTurn: drainTurn ?? 0.3,
                            fitnessConfig
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
                        mutationStrength = Math.min(0.6, mutationStrength + 0.05);
                    }
                }

                if (gen % 25 === 0) {
                    currentTrainingMaps = generateTrainingMaps(25, 20, trainingDockPos);
                    if (userGrid) currentTrainingMaps.push(userGrid);
                }

                // --- BREEDING NEXT POPULATION ---
                const nextPop: {id: number, nn: NeuralNetwork}[] = [];
                
                // 1. Elitism: Keep top 2 individuals
                nextPop.push({ id: 0, nn: (bestNnRef.current || results[0].nn).copy() });
                if (results.length > 1) {
                    nextPop.push({ id: 1, nn: results[1].nn.copy() });
                }

                // Tournament Selection
                const tournamentSelection = (size: number) => {
                    const poolSize = results.length;
                    let best: {nn: NeuralNetwork, fitness: number} | null = null;
                    for (let i = 0; i < size; i++) {
                        const randomInd = results[Math.floor(Math.random() * poolSize)];
                        if (!best || randomInd.fitness > best.fitness) {
                            best = randomInd;
                        }
                    }
                    return best!.nn;
                };

                while (nextPop.length < popSize) {
                    let childNn: NeuralNetwork;
                    const rand = Math.random();

                    if (rand < 0.1) {
                        // 10% Random Immigrants for diversity
                        childNn = new NeuralNetwork([47, 64, 32, 4], 0.001);
                    } else if (rand < 0.6) {
                        // 50% Crossover
                        const p1 = tournamentSelection(4);
                        const p2 = tournamentSelection(4);
                        childNn = NeuralNetwork.crossover(p1, p2);
                        childNn.mutate(0.05, mutationStrength / 2); 
                    } else {
                        // 40% Asexual Mutation
                        const parent = tournamentSelection(4);
                        childNn = parent.copy();
                        childNn.mutate(0.15, mutationStrength);
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
            setStatusMessage("NN Optimization stopped.");
        }
    }, [dockPos, orientation, fitnessConfig, trainingStatus.epoch, trainingStatus.bestFitness, setStatusMessage, setTrainingStatus, setNn]);

    const downloadModel = useCallback(() => {
        if (!nn) return;
        try {
            // Save the model with metadata (epoch and bestFitness)
            const modelObj = JSON.parse(nn.save());
            modelObj.epoch = trainingStatus.epoch;
            modelObj.bestFitness = trainingStatus.bestFitness;
            const data = JSON.stringify(modelObj, null, 2);
            
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `mower_model_${new Date().toISOString().slice(0, 10)}.json`;
            
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            
            setStatusMessage("Model successfully exported!");
        } catch (err) {
            console.error(err);
            setStatusMessage("ERROR: Failed to generate file.");
        }
    }, [nn, trainingStatus.epoch, trainingStatus.bestFitness, setStatusMessage]);


    const uploadModel = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const contents = event.target?.result as string;
                const data = JSON.parse(contents);
                
                // Does the model fit current code (47 inputs)?
                if (!data.layers || data.layers[0] !== 47) {
                    setStatusMessage(`ERROR: Model incompatible! Expected 47 sensors (8-way mowed rays added), found ${data.layers ? data.layers[0] : 'unknown'}.`);
                    return;
                }

                const loadedNn = NeuralNetwork.load(contents);
                setNn(loadedNn);

                // Update training status if metadata is present in the imported file
                if (typeof data.epoch === 'number' || typeof data.bestFitness === 'number') {
                    setTrainingStatus(prev => ({
                        ...prev,
                        epoch: data.epoch ?? 0,
                        bestFitness: data.bestFitness ?? -Infinity
                    }));
                }

                setStatusMessage("Model successfully loaded!");
            } catch (err) {
                setStatusMessage("ERROR: Failed to read file.");
            }
        };
        reader.readAsText(file);
    }, [setNn, setTrainingStatus, setStatusMessage]);


    const stopTraining = useCallback(() => {
        isTrainingRef.current = false;
    }, []);

    return {
        nn,
        trainingStatus,
        trainNN,
        trainOnData,
        stopTraining,
        downloadModel,
        uploadModel,
        showVisualTraining,
        setShowVisualTraining,
        previewGrid,
        previewMowerPos,
        previewMowerDir,
        fitnessConfig,
        setFitnessConfig
    };
};
