import { createRandom, gaussian } from './random';

/** A network as plain data, so it can be posted to workers and saved as JSON. */
export interface NetworkData {
    layers: number[];
    params: Float32Array;
}

/** Weights of a layer are stored row by row (one row per output), followed by its biases. */
export const parameterCount = (layers: number[]): number =>
    layers.slice(1).reduce((sum, outputs, i) => sum + outputs * layers[i] + outputs, 0);

/** Normal weights scaled by 1/√inputs, zero biases: the usual start for tanh layers. */
export const initialParameters = (layers: number[], seed: number): Float32Array => {
    const random = createRandom(seed);
    const params = new Float32Array(parameterCount(layers));
    let offset = 0;
    for (let i = 1; i < layers.length; i++) {
        const inputs = layers[i - 1];
        const scale = 1 / Math.sqrt(inputs);
        for (let w = 0; w < layers[i] * inputs; w++) params[offset + w] = gaussian(random) * scale;
        offset += layers[i] * inputs + layers[i];
    }
    return params;
};

/**
 * Multi-layer perceptron with tanh hidden layers and a linear output layer.
 * It only runs forward: evolution strategies change the parameters from outside.
 */
export class PolicyNetwork {
    readonly layers: number[];
    readonly params: Float32Array;
    private readonly activations: Float32Array[];

    constructor({ layers, params }: NetworkData) {
        if (params.length !== parameterCount(layers)) {
            throw new Error(`Expected ${parameterCount(layers)} parameters for layers ${layers.join('-')}, got ${params.length}`);
        }
        this.layers = layers;
        this.params = params;
        this.activations = layers.slice(1).map(size => new Float32Array(size));
    }

    /** Output values for `input`; the returned array is reused by the next call. */
    forward(input: Float32Array): Float32Array {
        const { layers, params, activations } = this;
        let current = input;
        let offset = 0;
        for (let layer = 1; layer < layers.length; layer++) {
            const inputs = layers[layer - 1];
            const outputs = layers[layer];
            const next = activations[layer - 1];
            const biasOffset = offset + outputs * inputs;
            const isOutput = layer === layers.length - 1;
            for (let o = 0; o < outputs; o++) {
                let sum = params[biasOffset + o];
                const row = offset + o * inputs;
                for (let i = 0; i < inputs; i++) sum += params[row + i] * current[i];
                next[o] = isOutput ? sum : Math.tanh(sum);
            }
            offset = biasOffset + outputs;
            current = next;
        }
        return current;
    }
}
