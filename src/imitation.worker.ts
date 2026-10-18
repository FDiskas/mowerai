import { NeuralNetwork } from './NeuralNetwork';
import { collectDemonstrations, imitateExpert, type ImitationRequest, type ImitationResponse } from './utils/imitation';

// Warm start: teaches a network the Snake Fill expert's moves off the UI thread.
self.onmessage = (e: MessageEvent<ImitationRequest>) => {
    const { layers, weights, lawns, dockPos, turnCost, epochs } = e.data;
    const nn = new NeuralNetwork(layers);
    nn.setWeights(weights);

    const demonstrations = collectDemonstrations(lawns, dockPos, turnCost);
    const result = imitateExpert(nn, demonstrations, epochs);
    const response: ImitationResponse = { ...result, weights: nn.getWeights(), samples: demonstrations.length };
    self.postMessage(response);
};
