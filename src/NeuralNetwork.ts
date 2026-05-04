/**
 * A Multi-Layer Perceptron (MLP) implementation.
 * Optimized for the MowerAI project with Xavier initialization and ReLU hidden layers.
 */
export class NeuralNetwork {
    layers: number[];
    weights: number[][][];
    biases: number[][];
    learningRate: number;

    constructor(layers: number[], learningRate: number = 0.01) {
        this.layers = layers;
        this.learningRate = learningRate;
        this.weights = [];
        this.biases = [];

        for (let i = 0; i < layers.length - 1; i++) {
            const inputNodes = layers[i];
            const outputNodes = layers[i + 1];
            
            // Xavier/Glorot Initialization
            const variance = 2.0 / (inputNodes + outputNodes);
            const stdDev = Math.sqrt(variance);

            const layerWeights: number[][] = [];
            for (let j = 0; j < outputNodes; j++) {
                const nodeWeights: number[] = [];
                for (let k = 0; k < inputNodes; k++) {
                    // Normal distribution approximation
                    nodeWeights.push(this.gaussianRandom(0, stdDev));
                }
                layerWeights.push(nodeWeights);
            }
            this.weights.push(layerWeights);

            const layerBiases: number[] = [];
            for (let j = 0; j < outputNodes; j++) {
                layerBiases.push(0); // Initialize biases to 0
            }
            this.biases.push(layerBiases);
        }
    }

    private gaussianRandom(mean: number, stdDev: number): number {
        const u = 1 - Math.random();
        const v = 1 - Math.random();
        const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        return mean + z * stdDev;
    }

    // ReLU for hidden layers, Sigmoid for output
    private activate(x: number, isOutput: boolean): number {
        if (isOutput) {
            return 1 / (1 + Math.exp(-x));
        }
        return Math.max(0.01 * x, x); // Leaky ReLU
    }

    private activateDeriv(x: number, isOutput: boolean): number {
        if (isOutput) {
            return x * (1 - x); // Sigmoid derivative
        }
        return x > 0 ? 1 : 0.01; // Leaky ReLU derivative
    }

    feedForward(inputs: number[]): number[][] {
        let current = inputs;
        const activations: number[][] = [inputs];

        for (let i = 0; i < this.weights.length; i++) {
            const next: number[] = [];
            const isOutput = i === this.weights.length - 1;
            
            for (let j = 0; j < this.weights[i].length; j++) {
                let sum = this.biases[i][j];
                for (let k = 0; k < this.weights[i][j].length; k++) {
                    sum += current[k] * this.weights[i][j][k];
                }
                next.push(this.activate(sum, isOutput));
            }
            current = next;
            activations.push(current);
        }
        return activations;
    }

    train(inputs: number[], targets: number[]): number {
        const activations = this.feedForward(inputs);
        const outputActivations = activations[activations.length - 1];
        let errors = targets.map((t, i) => t - outputActivations[i]);
        
        const stepError = errors.reduce((sum, e) => sum + e * e, 0) / errors.length;

        for (let i = this.weights.length - 1; i >= 0; i--) {
            const isOutput = i === this.weights.length - 1;
            const nextErrors: number[] = new Array(this.layers[i]).fill(0);
            const currentActivations = activations[i + 1];
            const prevActivations = activations[i];

            for (let j = 0; j < this.weights[i].length; j++) {
                const delta = errors[j] * this.activateDeriv(currentActivations[j], isOutput);
                
                for (let k = 0; k < this.weights[i][j].length; k++) {
                    nextErrors[k] += this.weights[i][j][k] * delta;
                    this.weights[i][j][k] += this.learningRate * delta * prevActivations[k];
                }
                this.biases[i][j] += this.learningRate * delta;
            }
            errors = nextErrors;
        }
        return stepError;
    }

    predict(inputs: number[]): number[] {
        const activations = this.feedForward(inputs);
        return activations[activations.length - 1];
    }

    getWeights(): number[] {
        const flat: number[] = [];
        this.weights.forEach(layer => {
            layer.forEach(node => {
                node.forEach(w => flat.push(w));
            });
        });
        this.biases.forEach(layer => {
            layer.forEach(b => flat.push(b));
        });
        return flat;
    }

    setWeights(flat: number[]) {
        let idx = 0;
        for (let i = 0; i < this.weights.length; i++) {
            for (let j = 0; j < this.weights[i].length; j++) {
                for (let k = 0; k < this.weights[i][j].length; k++) {
                    if (idx < flat.length) this.weights[i][j][k] = flat[idx++];
                }
            }
        }
        for (let i = 0; i < this.biases.length; i++) {
            for (let j = 0; j < this.biases[i].length; j++) {
                if (idx < flat.length) this.biases[i][j] = flat[idx++];
            }
        }
    }

    mutate(rate: number, amount: number = 0.1) {
        for (let i = 0; i < this.weights.length; i++) {
            for (let j = 0; j < this.weights[i].length; j++) {
                for (let k = 0; k < this.weights[i][j].length; k++) {
                    if (Math.random() < rate) {
                        this.weights[i][j][k] += this.gaussianRandom(0, amount);
                    }
                }
            }
        }
        for (let i = 0; i < this.biases.length; i++) {
            for (let j = 0; j < this.biases[i].length; j++) {
                if (Math.random() < rate) {
                    this.biases[i][j] += this.gaussianRandom(0, amount);
                }
            }
        }
    }

    static crossover(parentA: NeuralNetwork, parentB: NeuralNetwork): NeuralNetwork {
        const child = parentA.copy();
        const weightsA = parentA.getWeights();
        const weightsB = parentB.getWeights();
        const childWeights = weightsA.map((w, i) => Math.random() < 0.5 ? w : weightsB[i]);
        child.setWeights(childWeights);
        return child;
    }

    copy(): NeuralNetwork {
        const nn = new NeuralNetwork(this.layers, this.learningRate);
        nn.setWeights(this.getWeights());
        return nn;
    }

    save(): string {
        return JSON.stringify({
            layers: this.layers,
            weights: this.weights,
            biases: this.biases,
            learningRate: this.learningRate
        });
    }

    static load(json: string): NeuralNetwork {
        const data = JSON.parse(json);
        const nn = new NeuralNetwork(data.layers, data.learningRate);
        nn.weights = data.weights;
        nn.biases = data.biases;
        return nn;
    }
}
