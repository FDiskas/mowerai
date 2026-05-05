import { useState, useRef, useEffect, useCallback } from 'react';
import { NeuralNetwork } from '../NeuralNetwork';
import type { Grid, Point, FitnessConfig } from '../types';
import { DEFAULT_FITNESS_CONFIG } from '../types';
import { CELL_TYPES } from '../constants';
import { getNeuralNetworkMove } from '../algorithms';

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
        setNn(new NeuralNetwork([46, 64, 32, 4]));
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
            return;
        }

        const sourceGrid = userGridRef.current;
        const previewNn = bestNnRef.current;
        if (!sourceGrid || !previewNn) return;

        // Reset preview state
        const cleanGrid: Grid = sourceGrid.map(row => row.map(cell => ({
            ...cell,
            type: cell.type === CELL_TYPES.MOWED ? CELL_TYPES.GRASS : cell.type,
            damage: 0
        })));

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

        previewIntervalRef.current = setInterval(() => {
            const state = previewStateRef.current;
            const currentNn = bestNnRef.current;
            if (!state || !currentNn) return;

            const move = getNeuralNetworkMove(state, state.grid, state.prevDir, CELL_TYPES, currentNn);
            if (!move) return;

            // Atnaujinamas vizitų skaičius – tas pats kaip fitneso funkcijoje
            const posKey = `${move.x},${move.y}`;
            const visitCount = (state.visitCounts[posKey] || 0) + 1;
            state.visitCounts[posKey] = visitCount;

            const cell = state.grid[move.y][move.x];
            if (cell.type === CELL_TYPES.GRASS) cell.type = CELL_TYPES.MOWED;

            const dx = move.x - state.pos.x;
            const dy = move.y - state.pos.y;
            state.pos = move;
            state.prevDir = { dx, dy };
            state.battery -= 0.2;

            const isDock = move.x === dockPos.x && move.y === dockPos.y;
            const isLooping = !isDock && visitCount >= 5;

            if (state.battery <= 0 || isLooping) {
                // Reset – baterija baigėsi arba robotas sukosi vienoje vietoje
                const src = userGridRef.current;
                if (!src) return;
                const fresh: Grid = src.map(row => row.map(c => ({
                    ...c,
                    type: c.type === CELL_TYPES.MOWED ? CELL_TYPES.GRASS : c.type,
                    damage: 0
                })));
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
                return;
            }

            setPreviewMowerPos({ ...move });
            setPreviewGrid([...state.grid.map((r: any) => [...r])]);
        }, Math.max(10, 140 - speed));


        return () => {
            if (previewIntervalRef.current) clearInterval(previewIntervalRef.current);
        };
    }, [showVisualTraining, dockPos, orientation, speed]);

    const trainOnData = (sessionData: any[]) => {
        if (!nn || !sessionData || sessionData.length === 0) return;

        // Kopijuojame duomenis, kad galėtume maišyti
        const data = [...sessionData];
        
        // Mokome tinklą su Adam optimizatoriumi
        for (let i = 0; i < 10; i++) { // 10 epochų
            // Atsitiktinis maišymas (Fisher-Yates)
            for (let j = data.length - 1; j > 0; j--) {
                const k = Math.floor(Math.random() * (j + 1));
                [data[j], data[k]] = [data[k], data[j]];
            }

            data.forEach(item => {
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

    const trainNN = async (userGrid?: Grid, drainMove?: number, drainTurn?: number) => {
        // Store user grid for preview simulation
        if (userGrid) userGridRef.current = userGrid;

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

        const trainingDockPos = dockPos;
        let currentTrainingMaps = generateTrainingMaps(25, 20, trainingDockPos);
        
        // Pridedame vartotojo nupieštą žemėlapį prie mokymo rinkinio
        if (userGrid) {
            currentTrainingMaps.push(userGrid);
        }

        let population = Array(popSize).fill(null).map((_, i) => {
            const n = new NeuralNetwork([46, 64, 32, 4]);
            if (bestNnRef.current && bestNnRef.current.layers[0] === 46) {
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
                                    nn: parent ? parent.nn : new NeuralNetwork([46, 64, 32, 4]),
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
                        mutationStrength = Math.min(0.5, mutationStrength + 0.05);
                    }
                }

                // Dinamiškai keičiame žemėlapius kas 20 kartų, kad AI būtų universalus
                if (gen % 20 === 0) {
                    currentTrainingMaps = generateTrainingMaps(25, 20, trainingDockPos);
                    if (userGrid) {
                        currentTrainingMaps.push(userGrid);
                    }
                }

                // Selection and Breeding
                const nextPop: {id: number, nn: NeuralNetwork}[] = [];
                
                // 1. Elitism: Keep the best one unchanged
                nextPop.push({ id: 0, nn: (bestNnRef.current || results[0].nn).copy() });

                // Tournament Selection — excludes fully disqualified individuals
                const tournamentSelection = (size: number) => {
                    const eligible = results.filter(r => r.fitness > -999999998);
                    const pool = eligible.length > 0 ? eligible : results;
                    let best: {nn: NeuralNetwork, fitness: number} | null = null;
                    for (let i = 0; i < size; i++) {
                        const randomInd = pool[Math.floor(Math.random() * pool.length)];
                        if (!best || randomInd.fitness > best.fitness) {
                            best = randomInd;
                        }
                    }
                    return best!.nn;
                };

                while (nextPop.length < popSize) {
                    let childNn: NeuralNetwork;
                    
                    if (nextPop.length > popSize * 0.9) {
                        // 2. Random Immigrants: 10% of population are fresh starts to prevent stagnation
                        childNn = new NeuralNetwork([46, 64, 32, 4], 0.001);
                    } else if (Math.random() < 0.6) {
                        // 3. Crossover: Combine two parents from tournament
                        const p1 = tournamentSelection(3);
                        const p2 = tournamentSelection(3);
                        childNn = NeuralNetwork.crossover(p1, p2);
                        
                        // Small mutation after crossover
                        const mutRate = 0.05 + Math.random() * 0.05;
                        childNn.mutate(mutRate, mutationStrength / 2); 
                    } else {
                        // 4. Asexual reproduction (Mutation only)
                        const parent = tournamentSelection(3);
                        childNn = parent.copy();
                        const mutRate = 0.1 + Math.random() * 0.15;
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
        try {
            const data = nn.save();
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
            
            setStatusMessage("Modelis sėkmingai eksportuotas!");
        } catch (err) {
            console.error(err);
            setStatusMessage("KLAIDA: Nepavyko sugeneruoti failo.");
        }
    };


    const uploadModel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const contents = event.target?.result as string;
                const data = JSON.parse(contents);
                
                // Ar modelis tinka dabartiniam kodui (46 įėjimai)?
                if (!data.layers || data.layers[0] !== 46) {
                    setStatusMessage(`KLAIDA: Modelis nesuderinamas! Tikimasi 46 jutiklių (8-krypčių mowed rays pridėta), o rasta ${data.layers ? data.layers[0] : 'nežinoma'}.`);
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
        uploadModel,
        showVisualTraining,
        setShowVisualTraining,
        previewGrid,
        previewMowerPos,
        fitnessConfig,
        setFitnessConfig
    };
};
