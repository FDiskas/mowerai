import { useState, useRef, useEffect, useCallback } from 'react';
import { NeuralNetwork } from '../NeuralNetwork';
import type { Direction, Grid, Point, FitnessConfig, Orientation, TrainingStatus } from '../types';
import { DEFAULT_FITNESS_CONFIG } from '../types';
import { CELL_TYPES } from '../constants';
import { getNeuralNetworkMove, turnCostInSteps } from '../algorithms';
import { advanceMower, startEpisode } from '../utils/episode';
import { idealFitness, type FitnessOptions } from '../utils/fitness';
import { generateTrainingMaps } from '../utils/trainingMaps';
import { stepDelayMs } from '../utils/speed';
import {
    breedNextGeneration,
    crownChampion,
    INITIAL_MUTATION_STRENGTH,
    nextMutationStrength,
    seedPopulation,
    type Champion,
    type Individual,
    type ScoredIndividual,
} from '../utils/evolution';
import type { ImitationRequest, ImitationResponse } from '../utils/imitation';
import {
    clearTrainingProgress,
    loadTrainingProgress,
    saveTrainingProgress,
    type BreedingState,
    type TrainingProgress,
} from '../utils/trainingStore';
import type { TrainingRequest, TrainingResponse } from '../training.worker';

/** Network shape: 47 sensor inputs (see `prepareNNInputs`), two hidden layers, 4 move outputs. */
const NN_LAYERS = [47, 64, 32, 4];
const NN_INPUTS = NN_LAYERS[0];
const PREVIEW_BATTERY = 100;
const PREVIEW_DRAIN_PER_STEP = 0.2;
const PREVIEW_LOOP_VISITS = 5;
const POPULATION_SIZE = 60;
const MAX_STEPS = 800;
const MAP_WIDTH = 25;
const MAP_HEIGHT = 20;
const NEW_MAPS_EVERY = 25;
/** Map sets the expert drives for the warm start (each set holds every layout). */
const WARM_START_MAP_SETS = 3;
const WARM_START_EPOCHS = 8;
/** Battery drain used when the caller gives none; harsher than the live defaults. */
const TRAINING_DRAIN_MOVE = 0.5;
const TRAINING_DRAIN_TURN = 0.3;

interface PreviewFrame {
    grid: Grid;
    mowerPos: Point;
    mowerDir: Direction;
}

const INITIAL_TRAINING_STATUS: TrainingStatus = { isTraining: false, epoch: 0, bestFitness: -Infinity, idealFitness: 0 };

/** The workers average fitness over the maps, so the ideal is averaged the same way. */
const averageIdealFitness = (maps: Grid[], options: FitnessOptions): number =>
    maps.reduce((sum, map) => sum + idealFitness(map, options), 0) / maps.length;

const runWorker = <Request, Response>(worker: Worker, request: Request): Promise<Response> =>
    new Promise((resolve, reject) => {
        worker.onmessage = (e: MessageEvent<Response>) => resolve(e.data);
        worker.onerror = reject;
        worker.postMessage(request);
    });

/** Splits the population over the workers and returns it ranked by fitness, best first. */
const scorePopulation = async (
    workers: Worker[],
    population: Individual[],
    trainingMaps: Grid[],
    fitnessOptions: FitnessOptions,
): Promise<ScoredIndividual[]> => {
    const chunkSize = Math.ceil(population.length / workers.length);
    const responses = await Promise.all(workers.flatMap((worker, workerId) => {
        const slice = population.slice(workerId * chunkSize, (workerId + 1) * chunkSize);
        if (slice.length === 0) return [];
        return [runWorker<TrainingRequest, TrainingResponse>(worker, {
            workerId,
            populationData: slice.map(p => ({ id: p.id, weights: p.nn.getWeights(), layers: p.nn.layers })),
            trainingMaps,
            fitnessOptions,
        })];
    }));
    const byId = new Map(population.map(p => [p.id, p.nn]));
    return responses
        .flatMap(r => r.results)
        .map(({ id, fitness }) => ({ id, fitness, nn: byId.get(id) ?? new NeuralNetwork(NN_LAYERS) }))
        .sort((a, b) => b.fitness - a.fitness);
};

/** Fire and forget: a failed save must not stop training. */
const persistProgress = (progress: TrainingProgress) => {
    saveTrainingProgress(progress).catch(err => console.error('Failed to save training progress', err));
};

/** Behaviour cloning of the Snake Fill expert in a worker; returns the trained weights. */
const runWarmStart = async (request: ImitationRequest): Promise<ImitationResponse> => {
    const worker = new Worker(new URL('../imitation.worker.ts', import.meta.url), { type: 'module' });
    try {
        return await runWorker<ImitationRequest, ImitationResponse>(worker, request);
    } finally {
        worker.terminate();
    }
};

export const useNeuralNetwork = (
    dockPos: Point,
    setStatusMessage: (msg: string) => void,
    orientation: Orientation = 'horizontal',
    speed: number = 85
) => {

    const [nn, setNn] = useState(() => new NeuralNetwork(NN_LAYERS));
    const [trainingStatus, setTrainingStatus] = useState<TrainingStatus>(INITIAL_TRAINING_STATUS);
    const [showVisualTraining, setShowVisualTraining] = useState(false);
    const [preview, setPreview] = useState<PreviewFrame | null>(null);
    const [previewShownFor, setPreviewShownFor] = useState(showVisualTraining);
    const [fitnessConfig, setFitnessConfig] = useState<FitnessConfig>(DEFAULT_FITNESS_CONFIG);
    const turnCost = turnCostInSteps(fitnessConfig);

    // Hiding the preview drops its last frame.
    if (previewShownFor !== showVisualTraining) {
        setPreviewShownFor(showVisualTraining);
        if (!showVisualTraining) setPreview(null);
    }

    const isTrainingRef = useRef(false);
    /** True until the network has learned anything: a warm start, a training run or an imported model. */
    const isUntrainedRef = useRef(true);
    const bestNnRef = useRef<NeuralNetwork | null>(null);
    const currentNnRef = useRef(nn);
    /** The population of the last generation, so the next training run continues it. */
    const breedingRef = useRef<BreedingState | null>(null);
    const userGridRef = useRef<Grid | null>(null);

    useEffect(() => {
        currentNnRef.current = nn;
    }, [nn]);

    useEffect(() => {
        let isCancelled = false;
        loadTrainingProgress(NN_LAYERS, POPULATION_SIZE)
            .then(progress => {
                if (isCancelled || !progress || isTrainingRef.current) return;
                breedingRef.current = progress.breeding;
                isUntrainedRef.current = false;
                setNn(progress.champion.nn);
                setFitnessConfig(progress.fitnessConfig);
                setTrainingStatus(prev => ({
                    ...prev,
                    epoch: progress.generation,
                    bestFitness: progress.champion.fitness,
                    idealFitness: progress.idealFitness,
                }));
                setStatusMessage(`Training restored: generation ${progress.generation}`);
            })
            .catch(err => console.error('Failed to load training progress', err));
        return () => {
            isCancelled = true;
        };
    }, [setStatusMessage]);

    // Preview loop on the main map
    useEffect(() => {
        // Animate only while evolution runs; stopping training also hides the preview.
        if (!showVisualTraining || !trainingStatus.isTraining) return;

        const lawn = userGridRef.current;
        if (!lawn || !bestNnRef.current) return;

        /** Each run drives one network from start to end: the best one when the run starts. */
        let runNn = bestNnRef.current;
        const restartPreview = () => {
            runNn = bestNnRef.current ?? runNn;
            const state = startEpisode(lawn, dockPos, { battery: PREVIEW_BATTERY, orientation, turnCost });
            setPreview({ grid: state.grid.map(r => [...r]), mowerPos: { ...dockPos }, mowerDir: state.prevDir });
            return state;
        };

        let state = restartPreview();

        const interval = setInterval(() => {
            const move = getNeuralNetworkMove(state, state.grid, state.prevDir, CELL_TYPES, runNn);
            const isLawnDone = !move;
            if (isLawnDone) {
                state = restartPreview();
                return;
            }

            // Same step rule as the live simulation and the fitness function.
            const { heading, visitCount } = advanceMower(state, move);
            state.battery -= PREVIEW_DRAIN_PER_STEP;

            const isDock = move.x === dockPos.x && move.y === dockPos.y;
            const isSpinning = !isDock && visitCount >= PREVIEW_LOOP_VISITS;
            if (state.battery <= 0 || isSpinning) {
                state = restartPreview();
                return;
            }

            setPreview({ grid: state.grid.map(r => [...r]), mowerPos: { ...move }, mowerDir: heading });
        }, stepDelayMs(speed));

        return () => clearInterval(interval);
    }, [showVisualTraining, trainingStatus.isTraining, dockPos, orientation, speed, turnCost]);

    const trainNN = useCallback(async (userGrid?: Grid, drainMove?: number, drainTurn?: number) => {
        // Store user grid for preview simulation
        if (userGrid) userGridRef.current = userGrid;

        if (isTrainingRef.current) {
            isTrainingRef.current = false;
            return;
        }

        isTrainingRef.current = true;
        bestNnRef.current = currentNnRef.current;
        setTrainingStatus(prev => ({ ...prev, isTraining: true }));

        const lawnsWithUserGrid = (mapSets: number) => [
            ...Array.from({ length: mapSets }, () => generateTrainingMaps(MAP_WIDTH, MAP_HEIGHT, dockPos)).flat(),
            ...(userGrid ? [userGrid] : []),
        ];
        const fitnessOptions: FitnessOptions = {
            dockPos,
            maxSteps: MAX_STEPS,
            orientation,
            drainMove: drainMove ?? TRAINING_DRAIN_MOVE,
            drainTurn: drainTurn ?? TRAINING_DRAIN_TURN,
            fitnessConfig,
        };
        const numWorkers = navigator.hardwareConcurrency || 4;
        const workers = Array.from({ length: numWorkers }, () =>
            new Worker(new URL('../training.worker.ts', import.meta.url), { type: 'module' })
        );

        try {
            let parent = currentNnRef.current;

            if (isUntrainedRef.current) {
                setStatusMessage('Warm start: learning from Snake Fill...');
                const warmStart = await runWarmStart({
                    layers: parent.layers,
                    weights: parent.getWeights(),
                    lawns: lawnsWithUserGrid(WARM_START_MAP_SETS),
                    dockPos,
                    turnCost,
                    epochs: WARM_START_EPOCHS,
                });
                parent = new NeuralNetwork(NN_LAYERS);
                parent.setWeights(warmStart.weights);
                isUntrainedRef.current = false;
                bestNnRef.current = parent;
                setNn(parent);
                setStatusMessage(`Warm start done: copies Snake Fill on ${Math.round(warmStart.accuracy * 100)}% of ${warmStart.samples} moves`);
            }

            setStatusMessage(`Training with ${numWorkers} CPU cores...`);
            let generation = trainingStatus.epoch;
            let trainingMaps = lawnsWithUserGrid(1);
            let mapsIdealFitness = averageIdealFitness(trainingMaps, fitnessOptions);
            let mapsChanged = true;
            let champion: Champion = { nn: parent, fitness: trainingStatus.bestFitness };
            const breeding = breedingRef.current;
            let population = breeding?.population ?? seedPopulation(POPULATION_SIZE, NN_LAYERS, parent);
            let stagnantGenerations = breeding?.stagnantGenerations ?? 0;
            let mutationStrength = breeding?.mutationStrength ?? INITIAL_MUTATION_STRENGTH;

            while (isTrainingRef.current) {
                generation++;
                const ranked = await scorePopulation(workers, population, trainingMaps, fitnessOptions);
                const crowned = crownChampion(champion, ranked, mapsChanged);
                champion = crowned.champion;
                mapsChanged = false;

                if (crowned.improved) {
                    bestNnRef.current = champion.nn;
                    setNn(champion.nn);
                    stagnantGenerations = 0;
                } else {
                    stagnantGenerations++;
                }
                mutationStrength = nextMutationStrength(mutationStrength, crowned.improved, stagnantGenerations);
                setTrainingStatus(prev => ({ ...prev, epoch: generation, bestFitness: champion.fitness, idealFitness: mapsIdealFitness }));

                population = breedNextGeneration(ranked, champion.nn, POPULATION_SIZE, mutationStrength);
                breedingRef.current = { population, mutationStrength, stagnantGenerations };
                persistProgress({ champion, breeding: breedingRef.current, generation, idealFitness: mapsIdealFitness, fitnessConfig });

                if (generation % NEW_MAPS_EVERY === 0) {
                    trainingMaps = lawnsWithUserGrid(1);
                    mapsIdealFitness = averageIdealFitness(trainingMaps, fitnessOptions);
                    mapsChanged = true;
                }

                await new Promise(r => setTimeout(r, 10));
            }
        } catch (err) {
            console.error(err);
            setStatusMessage('ERROR: Training worker failed.');
        } finally {
            isTrainingRef.current = false;
            workers.forEach(w => w.terminate());
            setTrainingStatus(prev => ({ ...prev, isTraining: false }));
            setShowVisualTraining(false);
            setStatusMessage("NN Optimization stopped.");
        }
    }, [dockPos, orientation, fitnessConfig, turnCost, trainingStatus.epoch, trainingStatus.bestFitness, setStatusMessage]);

    /** Exports only the best network: no population and no optimizer state. */
    const downloadModel = useCallback(() => {
        try {
            const { layers, weights, biases, learningRate } = nn;
            const { epoch, bestFitness } = trainingStatus;
            const data = JSON.stringify({ layers, weights, biases, learningRate, epoch, bestFitness }, null, 2);

            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `mower_model_${new Date().toISOString().slice(0, 10)}.json`;

            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            setStatusMessage("Model successfully exported!");
        } catch (err) {
            console.error(err);
            setStatusMessage("ERROR: Failed to generate file.");
        }
    }, [nn, trainingStatus, setStatusMessage]);

    const uploadModel = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const contents = reader.result as string;
                const data = JSON.parse(contents);

                if (data.layers?.[0] !== NN_INPUTS) {
                    setStatusMessage(`ERROR: Model incompatible! Expected ${NN_INPUTS} sensors (8-way mowed rays added), found ${data.layers?.[0] ?? 'unknown'}.`);
                    return;
                }

                const importedNn = NeuralNetwork.load(contents);
                const hasStats = typeof data.epoch === 'number' || typeof data.bestFitness === 'number';
                const epoch: number = hasStats ? data.epoch ?? 0 : trainingStatus.epoch;
                const bestFitness: number = hasStats ? data.bestFitness ?? -Infinity : trainingStatus.bestFitness;

                setNn(importedNn);
                isUntrainedRef.current = false;
                breedingRef.current = null;
                setTrainingStatus(prev => ({ ...prev, epoch, bestFitness }));
                persistProgress({
                    champion: { nn: importedNn, fitness: bestFitness },
                    breeding: null,
                    generation: epoch,
                    idealFitness: trainingStatus.idealFitness,
                    fitnessConfig,
                });

                setStatusMessage("Model successfully loaded!");
            } catch {
                setStatusMessage("ERROR: Failed to read file.");
            }
        };
        reader.readAsText(file);
    }, [trainingStatus, fitnessConfig, setStatusMessage]);

    const clearModel = useCallback(() => {
        if (isTrainingRef.current) return;
        breedingRef.current = null;
        bestNnRef.current = null;
        isUntrainedRef.current = true;
        setNn(new NeuralNetwork(NN_LAYERS));
        setTrainingStatus(INITIAL_TRAINING_STATUS);
        clearTrainingProgress()
            .then(() => setStatusMessage('Training data cleared.'))
            .catch(err => {
                console.error(err);
                setStatusMessage('ERROR: Failed to clear training data.');
            });
    }, [setStatusMessage]);

    const stopTraining = useCallback(() => {
        isTrainingRef.current = false;
    }, []);

    return {
        nn,
        trainingStatus,
        trainNN,
        stopTraining,
        downloadModel,
        uploadModel,
        clearModel,
        showVisualTraining,
        setShowVisualTraining,
        previewGrid: preview?.grid ?? null,
        previewMowerPos: preview?.mowerPos ?? null,
        previewMowerDir: preview?.mowerDir ?? null,
        fitnessConfig,
        setFitnessConfig
    };
};
