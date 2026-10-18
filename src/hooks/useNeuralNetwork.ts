import { useState, useRef, useEffect, useCallback } from 'react';
import { createBrowserPool } from '../simulation/browserPool';
import { Episode } from '../simulation/episode';
import { DEFAULT_ES_SETTINGS, networkOf, type EsState } from '../simulation/evolutionStrategy';
import { DEFAULT_WARM_START_SETTINGS } from '../simulation/imitation';
import { parseModelFile, toModelFile, type LoadedModel } from '../simulation/modelFile';
import { NETWORK_LAYERS, networkPolicy } from '../simulation/networkPolicy';
import { initialParameters } from '../simulation/policyNetwork';
import { bestAlgorithmCosts, runWarmStart, summarizeValidation, trainGeneration, validationCosts, type ValidationSummary } from '../simulation/trainer';
import type { Direction, Grid, Point } from '../types';
import { clearTrainingProgress, loadTrainingProgress, saveTrainingProgress } from '../utils/trainingStore';
import { stepDelayMs } from '../utils/speed';

export interface TrainingStatus {
    isTraining: boolean;
    generation: number;
    /** Mean cost per tile of the last generation on its training lawns. */
    trainingCost: number | null;
    /** The last validation of the current network against the best algorithm on each lawn. */
    validation: ValidationSummary | null;
}

interface PreviewFrame {
    grid: Grid;
    mowerPos: Point;
    mowerDir: Direction;
}

/** The trained network that ships with the app (`npm run train` writes it). */
const SHIPPED_MODEL_URL = '/models/policy.json';
const VALIDATE_EVERY = 10;
const RANDOM_SEED = 1;

const INITIAL_TRAINING_STATUS: TrainingStatus = { isTraining: false, generation: 0, trainingCost: null, validation: null };

const untrainedModel = (): LoadedModel => ({
    network: { layers: NETWORK_LAYERS, params: initialParameters(NETWORK_LAYERS, RANDOM_SEED) },
    generation: 0,
    validationCost: null,
});

/** A network nothing has trained yet: training starts it with the imitation warm start. */
const isUntrained = (model: LoadedModel) => model.generation === 0 && model.validationCost === null;

/** Training continues from the model in use when there is no saved strategy state. */
const strategyFrom = ({ network, generation }: LoadedModel): EsState => ({
    layers: network.layers,
    params: network.params.slice(),
    m: new Float32Array(network.params.length),
    v: new Float32Array(network.params.length),
    generation,
});

const snapshotOf = (es: EsState, validationCost: number): LoadedModel =>
    ({ network: { ...networkOf(es), params: es.params.slice() }, generation: es.generation, validationCost });

const loadShippedModel = async (): Promise<LoadedModel | null> => {
    const response = await fetch(SHIPPED_MODEL_URL);
    // A dev server answers a missing file with the app's HTML page.
    const isJson = response.headers.get('content-type')?.includes('json') ?? false;
    return response.ok && isJson ? parseModelFile(await response.text()) : null;
};

/** Fire and forget: a failed save must not stop training. */
const persist = (es: EsState, best: LoadedModel) => {
    saveTrainingProgress({ es, best }).catch(err => console.error('Failed to save training progress', err));
};

export const useNeuralNetwork = (
    dockPos: Point,
    setStatusMessage: (msg: string) => void,
    speed: number,
) => {
    const [model, setModel] = useState<LoadedModel>(untrainedModel);
    const [trainingStatus, setTrainingStatus] = useState<TrainingStatus>(INITIAL_TRAINING_STATUS);
    const [showVisualTraining, setShowVisualTraining] = useState(false);
    const [preview, setPreview] = useState<PreviewFrame | null>(null);
    const [previewShownFor, setPreviewShownFor] = useState(showVisualTraining);

    // Hiding the preview drops its last frame.
    if (previewShownFor !== showVisualTraining) {
        setPreviewShownFor(showVisualTraining);
        if (!showVisualTraining) setPreview(null);
    }

    const isTrainingRef = useRef(false);
    const modelRef = useRef(model);
    const strategyRef = useRef<EsState | null>(null);
    const bestCostsRef = useRef<number[] | null>(null);
    const userGridRef = useRef<Grid | null>(null);

    useEffect(() => {
        modelRef.current = model;
    }, [model]);

    useEffect(() => {
        let isCancelled = false;
        const restore = async () => {
            const progress = await loadTrainingProgress(NETWORK_LAYERS);
            if (isCancelled || isTrainingRef.current) return;
            if (progress) {
                strategyRef.current = progress.es;
                setModel(progress.best);
                setTrainingStatus(prev => ({ ...prev, generation: progress.es.generation }));
                setStatusMessage(`Training restored: generation ${progress.es.generation}`);
                return;
            }
            const shipped = await loadShippedModel();
            if (shipped && !isCancelled && !isTrainingRef.current) setModel(shipped);
        };
        restore().catch(err => console.error('Failed to load the network', err));
        return () => {
            isCancelled = true;
        };
    }, [setStatusMessage]);

    // The best network so far drives the user's lawn while training runs.
    useEffect(() => {
        if (!showVisualTraining || !trainingStatus.isTraining) return;
        const lawn = userGridRef.current;
        if (!lawn) return;

        const startPreview = () => {
            const episode = new Episode({ grid: lawn, dock: dockPos });
            return { episode, policy: networkPolicy(modelRef.current.network) };
        };
        let run = startPreview();
        const interval = setInterval(() => {
            if (run.episode.isFinished) run = startPreview();
            run.episode.step(run.policy);
            const { state } = run.episode;
            setPreview({ grid: [...run.episode.lawn], mowerPos: { ...state.pos }, mowerDir: state.prevDir });
        }, stepDelayMs(speed));
        return () => clearInterval(interval);
    }, [showVisualTraining, trainingStatus.isTraining, dockPos, speed]);

    const trainNN = useCallback(async (userGrid: Grid) => {
        userGridRef.current = userGrid;
        if (isTrainingRef.current) {
            isTrainingRef.current = false;
            return;
        }
        isTrainingRef.current = true;
        setTrainingStatus(prev => ({ ...prev, isTraining: true }));
        const pool = createBrowserPool();

        try {
            const es = strategyRef.current ?? strategyFrom(modelRef.current);
            strategyRef.current = es;
            setStatusMessage('Measuring the best algorithm on the validation lawns...');
            const bestCosts = bestCostsRef.current ?? await bestAlgorithmCosts(pool);
            bestCostsRef.current = bestCosts;

            const validate = async () => {
                const validation = summarizeValidation(await validationCosts(es, pool), bestCosts);
                setTrainingStatus(prev => ({ ...prev, validation }));
                const best = modelRef.current;
                if (best.validationCost === null || validation.meanCost < best.validationCost) {
                    const improved = snapshotOf(es, validation.meanCost);
                    modelRef.current = improved;
                    setModel(improved);
                }
                persist(es, modelRef.current);
            };

            if (isUntrained(modelRef.current)) {
                setStatusMessage('Warm start: learning from the rollout teacher...');
                const { samples } = await runWarmStart(es, pool, ({ round }) =>
                    setStatusMessage(`Warm start: round ${round} of ${DEFAULT_WARM_START_SETTINGS.rounds} done...`));
                await validate();
                setStatusMessage(`Warm start done on ${samples} states. Evolving with ${pool.size} workers...`);
            } else {
                setStatusMessage(`Evolving with ${pool.size} workers...`);
            }

            while (isTrainingRef.current) {
                const trainingCost = await trainGeneration(es, DEFAULT_ES_SETTINGS, pool);
                setTrainingStatus(prev => ({ ...prev, generation: es.generation, trainingCost }));
                if (es.generation % VALIDATE_EVERY === 0) await validate();
            }
        } catch (err) {
            console.error(err);
            setStatusMessage('ERROR: Training worker failed.');
        } finally {
            isTrainingRef.current = false;
            pool.close();
            setTrainingStatus(prev => ({ ...prev, isTraining: false }));
            setShowVisualTraining(false);
            setStatusMessage('NN training stopped.');
        }
    }, [setStatusMessage]);

    const downloadModel = useCallback(() => {
        const data = JSON.stringify(toModelFile(model));
        const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `mower_model_${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        // Revoking at once can cancel the download in some browsers.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setStatusMessage('Model successfully exported!');
    }, [model, setStatusMessage]);

    const uploadModel = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        file.text()
            .then(contents => {
                const imported = parseModelFile(contents);
                strategyRef.current = null;
                setModel(imported);
                setTrainingStatus(prev => ({ ...prev, generation: imported.generation, validation: null }));
                persist(strategyFrom(imported), imported);
                setStatusMessage('Model successfully loaded!');
            })
            .catch((err: Error) => setStatusMessage(`ERROR: ${err.message}`));
    }, [setStatusMessage]);

    const clearModel = useCallback(() => {
        if (isTrainingRef.current) return;
        strategyRef.current = null;
        setModel(untrainedModel());
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
        model,
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
    };
};
