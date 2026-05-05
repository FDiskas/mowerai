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
        return Math.max(0.01 * x, x); // Leaky ReLU
    }

    private softmax(arr: number[]): number[] {
        const maxLogit = Math.max(...arr);
        const exps = arr.map(x => Math.exp(x - maxLogit));
        const sumExps = exps.reduce((a, b) => a + b, 0);
        return exps.map(x => x / sumExps);
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
                next.push(isOutput ? sum : this.activate(sum));
            }
            
            // Output layer uses softmax with temperature scaling
            const layerOutput = isOutput ? this.softmax(next.map(x => x * 2.0)) : next;
            current = layerOutput;
            activations.push(current);
        }
        return activations;
    }


    private activateDeriv(x: number): number {
        return x > 0 ? 1 : 0.01;
    }

    train(inputs: number[], targets: number[]): number {
        this.t++; // Increment Adam timestep
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
                const delta = errors[j] * (isOutput ? 1 : this.activateDeriv(currentActivations[j]));
                
                for (let k = 0; k < this.weights[i][j].length; k++) {
                    const gradient = delta * prevActivations[k] - 0.0001 * this.weights[i][j][k]; // Include L2 Reg
                    nextErrors[k] += this.weights[i][j][k] * delta;
                    
                    // Adam Weight Update
                    this.mWeights[i][j][k] = this.beta1 * this.mWeights[i][j][k] + (1 - this.beta1) * gradient;
                    this.vWeights[i][j][k] = this.beta2 * this.vWeights[i][j][k] + (1 - this.beta2) * (gradient * gradient);
                    
                    const mHat = this.mWeights[i][j][k] / (1 - Math.pow(this.beta1, this.t));
                    const vHat = this.vWeights[i][j][k] / (1 - Math.pow(this.beta2, this.t));
                    
                    this.weights[i][j][k] += (this.learningRate * mHat) / (Math.sqrt(vHat) + this.epsilon);
                }
                
                // Adam Bias Update
                this.mBiases[i][j] = this.beta1 * this.mBiases[i][j] + (1 - this.beta1) * delta;
                this.vBiases[i][j] = this.beta2 * this.vBiases[i][j] + (1 - this.beta2) * (delta * delta);
                
                const mbHat = this.mBiases[i][j] / (1 - Math.pow(this.beta1, this.t));
                const vbHat = this.vBiases[i][j] / (1 - Math.pow(this.beta2, this.t));
                
                this.biases[i][j] += (this.learningRate * mbHat) / (Math.sqrt(vbHat) + this.epsilon);
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
                        if (Math.random() < 0.05) {
                            const stdDev = Math.sqrt(2.0 / this.layers[i]);
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
        
        // Deep copy Adam state
        nn.mWeights = JSON.parse(JSON.stringify(this.mWeights));
        nn.vWeights = JSON.parse(JSON.stringify(this.vWeights));
        nn.mBiases = JSON.parse(JSON.stringify(this.mBiases));
        nn.vBiases = JSON.parse(JSON.stringify(this.vBiases));
        nn.t = this.t;
        
        return nn;
    }


    save(): string {
        return JSON.stringify({
            layers: this.layers,
            weights: this.weights,
            biases: this.biases,
            learningRate: this.learningRate,
            // Save Adam state for perfect resumption
            mWeights: this.mWeights,
            vWeights: this.vWeights,
            mBiases: this.mBiases,
            vBiases: this.vBiases,
            t: this.t
        }, null, 2);
    }

    static load(json: string): NeuralNetwork {
        const data = JSON.parse(json);
        const nn = new NeuralNetwork(data.layers, data.learningRate);
        nn.weights = data.weights;
        nn.biases = data.biases;
        
        // Load Adam state if exists
        if (data.mWeights) nn.mWeights = data.mWeights;
        if (data.vWeights) nn.vWeights = data.vWeights;
        if (data.mBiases) nn.mBiases = data.mBiases;
        if (data.vBiases) nn.vBiases = data.vBiases;
        if (data.t) nn.t = data.t;
        
        return nn;
    }

}

