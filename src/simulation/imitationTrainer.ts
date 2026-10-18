import { ACTION_COUNT } from './networkPolicy';
import type { NetworkData } from './policyNetwork';
import { createRandom } from './random';

/** One labelled state: what the network saw and which move the teacher chose. */
export interface Demonstration {
    input: Float32Array;
    action: number;
}

/** Mini-batches between two yields to the event loop, so a page stays responsive while it trains. */
const BATCHES_PER_YIELD = 40;

const yieldToEventLoop = () => new Promise(resolve => setTimeout(resolve, 0));

const BETA1 = 0.9;
const BETA2 = 0.999;
const EPSILON = 1e-8;

/** Supervised training of a network on demonstrations: softmax cross-entropy, Adam. */
export class ImitationTrainer {
    private readonly network: NetworkData;
    private readonly gradient: Float32Array;
    private readonly m: Float32Array;
    private readonly v: Float32Array;
    private readonly activations: Float32Array[];
    private readonly deltas: Float32Array[];
    private step = 0;

    constructor(network: NetworkData) {
        this.network = network;
        const size = network.params.length;
        this.gradient = new Float32Array(size);
        this.m = new Float32Array(size);
        this.v = new Float32Array(size);
        this.activations = network.layers.map(n => new Float32Array(n));
        this.deltas = network.layers.map(n => new Float32Array(n));
    }

    /** Adds the gradient of one sample; returns its loss. */
    private accumulate({ input, action }: Demonstration): number {
        const { layers, params } = this.network;
        const { activations, deltas, gradient } = this;
        activations[0].set(input);

        let offset = 0;
        for (let layer = 1; layer < layers.length; layer++) {
            const inputs = layers[layer - 1];
            const outputs = layers[layer];
            const biasOffset = offset + outputs * inputs;
            const isOutput = layer === layers.length - 1;
            for (let o = 0; o < outputs; o++) {
                let sum = params[biasOffset + o];
                const row = offset + o * inputs;
                for (let i = 0; i < inputs; i++) sum += params[row + i] * activations[layer - 1][i];
                activations[layer][o] = isOutput ? sum : Math.tanh(sum);
            }
            offset = biasOffset + outputs;
        }

        const last = layers.length - 1;
        const logits = activations[last];
        const max = Math.max(...logits);
        let total = 0;
        for (let a = 0; a < ACTION_COUNT; a++) total += Math.exp(logits[a] - max);
        for (let a = 0; a < ACTION_COUNT; a++) deltas[last][a] = Math.exp(logits[a] - max) / total - (a === action ? 1 : 0);
        const loss = -(logits[action] - max - Math.log(total));

        for (let layer = last; layer >= 1; layer--) {
            const inputs = layers[layer - 1];
            const outputs = layers[layer];
            offset -= outputs * inputs + outputs;
            const biasOffset = offset + outputs * inputs;
            const below = deltas[layer - 1];
            below.fill(0);
            for (let o = 0; o < outputs; o++) {
                const delta = deltas[layer][o];
                gradient[biasOffset + o] += delta;
                const row = offset + o * inputs;
                for (let i = 0; i < inputs; i++) {
                    gradient[row + i] += delta * activations[layer - 1][i];
                    below[i] += delta * params[row + i];
                }
            }
            if (layer > 1) {
                const hidden = activations[layer - 1];
                for (let i = 0; i < inputs; i++) below[i] *= 1 - hidden[i] * hidden[i];
            }
        }
        return loss;
    }

    /** One Adam step on a mini-batch; returns the mean loss. */
    trainBatch(batch: Demonstration[], learningRate: number): number {
        this.gradient.fill(0);
        const loss = batch.reduce((sum, sample) => sum + this.accumulate(sample), 0) / batch.length;
        const { params } = this.network;
        const { gradient, m, v } = this;
        this.step++;
        const correction1 = 1 - BETA1 ** this.step;
        const correction2 = 1 - BETA2 ** this.step;
        for (let p = 0; p < params.length; p++) {
            const g = gradient[p] / batch.length;
            m[p] = BETA1 * m[p] + (1 - BETA1) * g;
            v[p] = BETA2 * v[p] + (1 - BETA2) * g * g;
            params[p] -= learningRate * (m[p] / correction1) / (Math.sqrt(v[p] / correction2) + EPSILON);
        }
        return loss;
    }

    /** Shuffled mini-batch epochs over `data`; returns the mean loss of the last epoch. */
    async trainEpochs(data: Demonstration[], epochs: number, batchSize: number, learningRate: number, seed: number): Promise<number> {
        const random = createRandom(seed);
        let lastLoss = 0;
        for (let epoch = 0; epoch < epochs; epoch++) {
            const order = data.map((_, i) => i);
            for (let i = order.length - 1; i > 0; i--) {
                const j = Math.floor(random() * (i + 1));
                [order[i], order[j]] = [order[j], order[i]];
            }
            let lossSum = 0;
            let batches = 0;
            for (let start = 0; start < order.length; start += batchSize) {
                lossSum += this.trainBatch(order.slice(start, start + batchSize).map(i => data[i]), learningRate);
                batches++;
                if (batches % BATCHES_PER_YIELD === 0) await yieldToEventLoop();
            }
            lastLoss = lossSum / batches;
        }
        return lastLoss;
    }
}
