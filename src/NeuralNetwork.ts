/**
 * A Multi-Layer Perceptron (MLP) implementation.
 * Optimized for the MowerAI project with Adam Optimizer, He initialization, and L2 regularization.
 */
export class NeuralNetwork {
    layers: number[];
    weights: number[][][];
    biases: number[][];
    learningRate: number;
    
    // Adam Optimizer state
    mWeights: number[][][];
    vWeights: number[][][];
    mBiases: number[][];
    vBiases: number[][];
    t: number = 0; // Timestep
    beta1: number = 0.9;
    beta2: number = 0.999;
    epsilon: number = 1e-8;

    constructor(layers: number[], learningRate: number = 0.001) {
        this.layers = layers;
        this.learningRate = learningRate;
        
        this.weights = [];
        this.biases = [];
        this.mWeights = [];
        this.vWeights = [];
        this.mBiases = [];
        this.vBiases = [];

        this.initializeNetwork(layers);
    }

    private initializeNetwork(layers: number[]) {
        for (let i = 0; i < layers.length - 1; i++) {
            const inputNodes = layers[i];
            const outputNodes = layers[i + 1];
            
            // He Initialization (Better for ReLU/Leaky ReLU)
            const stdDev = Math.sqrt(2.0 / inputNodes);

            const layerWeights: number[][] = [];
            const layerMWeights: number[][] = [];
            const layerVWeights: number[][] = [];
            
            for (let j = 0; j < outputNodes; j++) {
                const nodeWeights: number[] = [];
                const nodeM: number[] = [];
                const nodeV: number[] = [];
                for (let k = 0; k < inputNodes; k++) {
                    nodeWeights.push(this.gaussianRandom(0, stdDev));
                    nodeM.push(0);
                    nodeV.push(0);
                }
                layerWeights.push(nodeWeights);
                layerMWeights.push(nodeM);
                layerVWeights.push(nodeV);
            }
            this.weights.push(layerWeights);
            this.mWeights.push(layerMWeights);
            this.vWeights.push(layerVWeights);

            const layerBiases: number[] = [];
            const layerMBiases: number[] = [];
            const layerVBiases: number[] = [];
            for (let j = 0; j < outputNodes; j++) {
                layerBiases.push(0);
                layerMBiases.push(0);
                layerVBiases.push(0);
            }
            this.biases.push(layerBiases);
            this.mBiases.push(layerMBiases);
            this.vBiases.push(layerVBiases);
        }
    }

    private gaussianRandom(mean: number, stdDev: number): number {
        const u = 1 - Math.random();
        const v = 1 - Math.random();
        const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        return mean + z * stdDev;
    }

    private activate(x: number): number {
        return x > 0 ? x : 0.01 * x; // Leaky ReLU
    }

    private activateDeriv(x: number): number {
        return x > 0 ? 1 : 0.01;
    }

    private softmax(arr: number[]): number[] {
        const maxLogit = Math.max(...arr);
        const exps = arr.map(x => Math.exp(x - maxLogit));
        const sumExps = exps.reduce((a, b) => a + b, 0);
        return exps.map(x => x / (sumExps + 1e-10));
    }

    /**
     * Standard feedforward pass.
     * Returns all activations (including input layer) for backpropagation.
     */
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
                next.push(isOutput ? sum : this.activate(sum));
            }
            
            // Output layer uses softmax (on raw logits for training stability)
            const layerOutput = isOutput ? this.softmax(next) : next;
            current = layerOutput;
            activations.push(current);
        }
        return activations;
    }

    /**
     * Train using Supervised Learning (Backpropagation).
     * Assumes Cross-Entropy Loss + Softmax Output Layer.
     */
    train(inputs: number[], targets: number[]): number {
        this.t++;
        const activations = this.feedForward(inputs);
        const outputActivations = activations[activations.length - 1];
        
        // Loss: Cross-Entropy. Gradient w.r.t. output logits (before softmax) is (P - Y)
        // Since we want to MINIMIZE loss, and we use += below, we'll calculate (Y - P)
        let deltas = targets.map((y, i) => y - outputActivations[i]);
        
        const mse = deltas.reduce((sum, d) => sum + d * d, 0) / deltas.length;

        for (let i = this.weights.length - 1; i >= 0; i--) {
            const isOutput = i === this.weights.length - 1;
            const prevActivations = activations[i];
            const nextDeltas: number[] = new Array(this.layers[i]).fill(0);

            for (let j = 0; j < this.weights[i].length; j++) {
                // If it's a hidden layer, we need the derivative of activation
                const error = isOutput ? deltas[j] : deltas[j] * this.activateDeriv(activations[i + 1][j]);
                
                for (let k = 0; k < this.weights[i][j].length; k++) {
                    // Gradient calculation with L2 Regularization (Weight Decay)
                    const gradient = error * prevActivations[k] - 0.0001 * this.weights[i][j][k];
                    
                    // Backpropagate error to next layer
                    nextDeltas[k] += this.weights[i][j][k] * error;
                    
                    // Adam Optimizer: Update Weights
                    this.mWeights[i][j][k] = this.beta1 * this.mWeights[i][j][k] + (1 - this.beta1) * gradient;
                    this.vWeights[i][j][k] = this.beta2 * this.vWeights[i][j][k] + (1 - this.beta2) * (gradient * gradient);
                    
                    const mHat = this.mWeights[i][j][k] / (1 - Math.pow(this.beta1, this.t));
                    const vHat = this.vWeights[i][j][k] / (1 - Math.pow(this.beta2, this.t));
                    
                    this.weights[i][j][k] += (this.learningRate * mHat) / (Math.sqrt(vHat) + this.epsilon);
                }
                
                // Adam Optimizer: Update Biases
                this.mBiases[i][j] = this.beta1 * this.mBiases[i][j] + (1 - this.beta1) * error;
                this.vBiases[i][j] = this.beta2 * this.vBiases[i][j] + (1 - this.beta2) * (error * error);
                
                const mbHat = this.mBiases[i][j] / (1 - Math.pow(this.beta1, this.t));
                const vbHat = this.vBiases[i][j] / (1 - Math.pow(this.beta2, this.t));
                
                this.biases[i][j] += (this.learningRate * mbHat) / (Math.sqrt(vbHat) + this.epsilon);
            }
            deltas = nextDeltas;
        }
        return mse;
    }

    predict(inputs: number[]): number[] {
        const activations = this.feedForward(inputs);
        return activations[activations.length - 1];
    }

    getWeights(): number[] {
        const flat: number[] = [];
        for (const layer of this.weights) {
            for (const node of layer) {
                for (const w of node) flat.push(w);
            }
        }
        for (const layer of this.biases) {
            for (const b of layer) flat.push(b);
        }
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
            const stdDev = Math.sqrt(2.0 / this.layers[i]);
            for (let j = 0; j < this.weights[i].length; j++) {
                for (let k = 0; k < this.weights[i][j].length; k++) {
                    if (Math.random() < rate) {
                        // 5% chance of complete reset to encourage exploration
                        if (Math.random() < 0.05) {
                            this.weights[i][j][k] = this.gaussianRandom(0, stdDev);
                        } else {
                            this.weights[i][j][k] += this.gaussianRandom(0, amount);
                        }
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
        
        // Fast deep copy for Adam state
        nn.mWeights = this.deepCopy3D(this.mWeights);
        nn.vWeights = this.deepCopy3D(this.vWeights);
        nn.mBiases = this.deepCopy2D(this.mBiases);
        nn.vBiases = this.deepCopy2D(this.vBiases);
        nn.t = this.t;
        
        return nn;
    }

    private deepCopy3D(arr: number[][][]): number[][][] {
        return arr.map(layer => layer.map(node => [...node]));
    }

    private deepCopy2D(arr: number[][]): number[][] {
        return arr.map(layer => [...layer]);
    }

    save(): string {
        return JSON.stringify({
            layers: this.layers,
            weights: this.weights,
            biases: this.biases,
            learningRate: this.learningRate,
            mWeights: this.mWeights,
            vWeights: this.vWeights,
            mBiases: this.mBiases,
            vBiases: this.vBiases,
            t: this.t
        });
    }

    static load(json: string): NeuralNetwork {
        const data = JSON.parse(json);
        const nn = new NeuralNetwork(data.layers, data.learningRate);
        nn.weights = data.weights;
        nn.biases = data.biases;
        nn.mWeights = data.mWeights || nn.mWeights;
        nn.vWeights = data.vWeights || nn.vWeights;
        nn.mBiases = data.mBiases || nn.mBiases;
        nn.vBiases = data.vBiases || nn.vBiases;
        nn.t = data.t || 0;
        return nn;
    }
}

