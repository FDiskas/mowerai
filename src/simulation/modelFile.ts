import { NETWORK_LAYERS } from './networkPolicy';
import { parameterCount, type NetworkData } from './policyNetwork';

/** A trained network as saved to disk or downloaded from the app. */
export interface ModelFile {
    format: 'mowerai-policy';
    layers: number[];
    params: number[];
    generation: number;
    /** Mean cost per tile on the validation lawns when it was saved. */
    validationCost: number | null;
}

export interface LoadedModel {
    network: NetworkData;
    generation: number;
    validationCost: number | null;
}

export const toModelFile = ({ network, generation, validationCost }: LoadedModel): ModelFile => ({
    format: 'mowerai-policy',
    layers: network.layers,
    params: Array.from(network.params),
    generation,
    validationCost,
});

const sameLayers = (a: number[], b: number[]) => a.length === b.length && a.every((size, i) => size === b[i]);

/** Reads a model file; throws with a readable message when it does not fit the current network shape. */
export const parseModelFile = (json: string): LoadedModel => {
    const data = JSON.parse(json) as Partial<ModelFile>;
    if (data.format !== 'mowerai-policy' || !Array.isArray(data.layers) || !Array.isArray(data.params)) {
        throw new Error('Not a MowerAI policy model file');
    }
    if (!sameLayers(data.layers, NETWORK_LAYERS)) {
        throw new Error(`Model shape ${data.layers.join('-')} does not match ${NETWORK_LAYERS.join('-')}`);
    }
    if (data.params.length !== parameterCount(data.layers)) {
        throw new Error(`Model has ${data.params.length} parameters, expected ${parameterCount(data.layers)}`);
    }
    return {
        network: { layers: data.layers, params: Float32Array.from(data.params) },
        generation: data.generation ?? 0,
        validationCost: data.validationCost ?? null,
    };
};
