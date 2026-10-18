/** Adam optimizer moments; only supervised training needs them, so they are created on the first `train` call. */
interface AdamState {
    mWeights: number[][][];
    vWeights: number[][][];
    mBiases: number[][];
    vBiases: number[][];
    t: number;
}

interface Parameters {
    weights: number[][][];
    biases: number[][];
}

const BETA1 = 0.9;
const BETA2 = 0.999;
const EPSILON = 1e-8;
const WEIGHT_DECAY = 0.0001;
const LEAKY_SLOPE = 0.01;
/** Share of mutated weights that are drawn again from scratch instead of nudged. */
const WEIGHT_RESET_CHANCE = 0.05;

const gaussianRandom = (mean: number, stdDev: number): number => {
    const u = 1 - Math.random();
    const v = 1 - Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + z * stdDev;
};

/** He initialization, suited to Leaky ReLU. */
const heStdDev = (inputs: number) => Math.sqrt(2.0 / inputs);

const randomParameters = (layers: number[]): Parameters => ({
    weights: layers.slice(1).map((outputs, i) =>
        Array.from({ length: outputs }, () =>
            Array.from({ length: layers[i] }, () => gaussianRandom(0, heStdDev(layers[i]))))),
    biases: layers.slice(1).map(outputs => new Array<number>(outputs).fill(0)),
});

const copy2D = (arr: number[][]): number[][] => arr.map(row => [...row]);
const copy3D = (arr: number[][][]): number[][][] => arr.map(copy2D);
const zeros2D = (arr: number[][]): number[][] => arr.map(row => row.map(() => 0));

const activate = (x: number): number => (x > 0 ? x : LEAKY_SLOPE * x);
/** Leaky ReLU keeps the sign, so the derivative can be read from the activated value. */
const activateDeriv = (activated: number): number => (activated > 0 ? 1 : LEAKY_SLOPE);

const softmax = (logits: number[]): number[] => {
    const maxLogit = Math.max(...logits);
    const exps = logits.map(x => Math.exp(x - maxLogit));
    const sumExps = exps.reduce((a, b) => a + b, 0);
    return exps.map(x => x / (sumExps + 1e-10));
};

/**
 * A Multi-Layer Perceptron with Leaky ReLU hidden layers and a softmax output.
 * The genetic algorithm only reads and writes its weights; supervised training uses Adam with L2 decay.
 */
export class NeuralNetwork {
    readonly layers: number[];
    weights: number[][][];
    biases: number[][];
    learningRate: number;
    private adam: AdamState | null = null;

    constructor(layers: number[], learningRate: number = 0.001, parameters: Parameters = randomParameters(layers)) {
        this.layers = layers;
        this.learningRate = learningRate;
        this.weights = parameters.weights;
        this.biases = parameters.biases;
    }

    /** All activations, input layer included, for backpropagation. */
    feedForward(inputs: number[]): number[][] {
        const activations: number[][] = [inputs];
        let current = inputs;

        for (let i = 0; i < this.weights.length; i++) {
            const isOutput = i === this.weights.length - 1;
            const next: number[] = [];
            for (let j = 0; j < this.weights[i].length; j++) {
                const nodeWeights = this.weights[i][j];
                let sum = this.biases[i][j];
                for (let k = 0; k < nodeWeights.length; k++) {
                    sum += current[k] * nodeWeights[k];
                }
                next.push(isOutput ? sum : activate(sum));
            }
            current = isOutput ? softmax(next) : next;
            activations.push(current);
        }
        return activations;
    }

    /**
     * One supervised step on one sample with cross-entropy loss over the softmax output.
     * Returns the cross-entropy loss before the update.
     */
    train(inputs: number[], targets: number[]): number {
        const adam = this.adam ??= this.createAdamState();
        adam.t++;
        const mScale = 1 / (1 - BETA1 ** adam.t);
        const vScale = 1 / (1 - BETA2 ** adam.t);
        const adamDelta = (m: number[], v: number[], k: number, gradient: number): number => {
            m[k] = BETA1 * m[k] + (1 - BETA1) * gradient;
            v[k] = BETA2 * v[k] + (1 - BETA2) * gradient * gradient;
            return (this.learningRate * m[k] * mScale) / (Math.sqrt(v[k] * vScale) + EPSILON);
        };

        const activations = this.feedForward(inputs);
        const outputs = activations[activations.length - 1];
        const loss = -targets.reduce((sum, y, i) => sum + y * Math.log(outputs[i] + 1e-10), 0);

        // Gradient ascent on (Y - P), the negative loss gradient w.r.t. the output logits.
        let deltas = targets.map((y, i) => y - outputs[i]);

        for (let i = this.weights.length - 1; i >= 0; i--) {
            const isOutput = i === this.weights.length - 1;
            const prevActivations = activations[i];
            const nextDeltas = new Array<number>(this.layers[i]).fill(0);

            for (let j = 0; j < this.weights[i].length; j++) {
                const nodeWeights = this.weights[i][j];
                const error = isOutput ? deltas[j] : deltas[j] * activateDeriv(activations[i + 1][j]);

                for (let k = 0; k < nodeWeights.length; k++) {
                    nextDeltas[k] += nodeWeights[k] * error;
                    const gradient = error * prevActivations[k] - WEIGHT_DECAY * nodeWeights[k];
                    nodeWeights[k] += adamDelta(adam.mWeights[i][j], adam.vWeights[i][j], k, gradient);
                }
                this.biases[i][j] += adamDelta(adam.mBiases[i], adam.vBiases[i], j, error);
            }
            deltas = nextDeltas;
        }
        return loss;
    }

    predict(inputs: number[]): number[] {
        const activations = this.feedForward(inputs);
        return activations[activations.length - 1];
    }

    getWeights(): number[] {
        return [...this.weights.flat(2), ...this.biases.flat()];
    }

    setWeights(flat: number[]) {
        let idx = 0;
        for (const layer of this.weights) {
            for (const node of layer) {
                for (let k = 0; k < node.length && idx < flat.length; k++) node[k] = flat[idx++];
            }
        }
        for (const layer of this.biases) {
            for (let j = 0; j < layer.length && idx < flat.length; j++) layer[j] = flat[idx++];
        }
    }

    mutate(rate: number, amount: number = 0.1) {
        this.weights.forEach((layer, i) => {
            const stdDev = heStdDev(this.layers[i]);
            for (const node of layer) {
                for (let k = 0; k < node.length; k++) {
                    if (Math.random() >= rate) continue;
                    node[k] = Math.random() < WEIGHT_RESET_CHANCE
                        ? gaussianRandom(0, stdDev)
                        : node[k] + gaussianRandom(0, amount);
                }
            }
        });
        for (const layer of this.biases) {
            for (let j = 0; j < layer.length; j++) {
                if (Math.random() < rate) layer[j] += gaussianRandom(0, amount);
            }
        }
    }

    static crossover(parentA: NeuralNetwork, parentB: NeuralNetwork): NeuralNetwork {
        const child = parentA.copy();
        const weightsB = parentB.getWeights();
        child.setWeights(parentA.getWeights().map((w, i) => (Math.random() < 0.5 ? w : weightsB[i])));
        return child;
    }

    copy(): NeuralNetwork {
        const nn = new NeuralNetwork(this.layers, this.learningRate, {
            weights: copy3D(this.weights),
            biases: copy2D(this.biases),
        });
        if (this.adam) {
            nn.adam = {
                mWeights: copy3D(this.adam.mWeights),
                vWeights: copy3D(this.adam.vWeights),
                mBiases: copy2D(this.adam.mBiases),
                vBiases: copy2D(this.adam.vBiases),
                t: this.adam.t,
            };
        }
        return nn;
    }

    save(): string {
        return JSON.stringify({
            layers: this.layers,
            weights: this.weights,
            biases: this.biases,
            learningRate: this.learningRate,
            ...this.adam,
        });
    }

    static load(json: string): NeuralNetwork {
        const data = JSON.parse(json);
        const nn = new NeuralNetwork(data.layers, data.learningRate, { weights: data.weights, biases: data.biases });
        if (data.mWeights && data.vWeights && data.mBiases && data.vBiases) {
            nn.adam = {
                mWeights: data.mWeights,
                vWeights: data.vWeights,
                mBiases: data.mBiases,
                vBiases: data.vBiases,
                t: data.t ?? 0,
            };
        }
        return nn;
    }

    private createAdamState(): AdamState {
        return {
            mWeights: this.weights.map(zeros2D),
            vWeights: this.weights.map(zeros2D),
            mBiases: zeros2D(this.biases),
            vBiases: zeros2D(this.biases),
            t: 0,
        };
    }
}
