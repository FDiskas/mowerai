import { NeuralNetwork } from '../NeuralNetwork';

export interface Individual {
    id: number;
    nn: NeuralNetwork;
}

export interface ScoredIndividual extends Individual {
    fitness: number;
}

/** The best network found so far and its score on the current training maps. */
export interface Champion {
    nn: NeuralNetwork;
    fitness: number;
}

/** Id of the unchanged copy of the champion in every population. */
export const CHAMPION_ID = 0;

const IMMIGRANT_SHARE = 0.1;
const CROSSOVER_SHARE = 0.5;
const TOURNAMENT_SIZE = 4;
const CROSSOVER_MUTATION_RATE = 0.05;
const ASEXUAL_MUTATION_RATE = 0.15;
const BASE_MUTATION_STRENGTH = 0.1;
const MAX_MUTATION_STRENGTH = 0.6;
const STAGNATION_PATIENCE = 10;

export const INITIAL_MUTATION_STRENGTH = BASE_MUTATION_STRENGTH;

/**
 * First generation. With a parent, slot 0 keeps it unchanged and the rest are small
 * mutations of it, so a trained (or warm-started) network is refined, not scrambled.
 */
export const seedPopulation = (size: number, layers: number[], parent: NeuralNetwork | null): Individual[] =>
    Array.from({ length: size }, (_, id) => {
        if (!parent) return { id, nn: new NeuralNetwork(layers) };
        const nn = parent.copy();
        if (id !== CHAMPION_ID) nn.mutate(ASEXUAL_MUTATION_RATE, BASE_MUTATION_STRENGTH);
        return { id, nn };
    });

/**
 * Keeps the champion honest: after the maps change, its old score is replaced by the
 * score its copy (`CHAMPION_ID`) just earned on the new maps. Returns the champion
 * after this generation and whether a better network replaced it.
 */
export const crownChampion = (
    champion: Champion | null,
    ranked: ScoredIndividual[],
    mapsChanged: boolean,
): { champion: Champion; improved: boolean } => {
    const rescored = champion && mapsChanged
        ? { ...champion, fitness: ranked.find(r => r.id === CHAMPION_ID)?.fitness ?? champion.fitness }
        : champion;
    const best = ranked[0];
    if (!rescored || best.fitness > rescored.fitness) {
        return { champion: { nn: best.nn, fitness: best.fitness }, improved: true };
    }
    return { champion: rescored, improved: false };
};

/** Mutation grows after `STAGNATION_PATIENCE` generations without a new champion and resets on progress. */
export const nextMutationStrength = (strength: number, improved: boolean, stagnantGenerations: number): number => {
    if (improved) return BASE_MUTATION_STRENGTH;
    if (stagnantGenerations > STAGNATION_PATIENCE) return Math.min(MAX_MUTATION_STRENGTH, strength + 0.05);
    return strength;
};

const tournamentWinner = (ranked: ScoredIndividual[]): NeuralNetwork => {
    let best = ranked[Math.floor(Math.random() * ranked.length)];
    for (let i = 1; i < TOURNAMENT_SIZE; i++) {
        const contender = ranked[Math.floor(Math.random() * ranked.length)];
        if (contender.fitness > best.fitness) best = contender;
    }
    return best.nn;
};

/** Next population: the champion and the runner-up, then immigrants, crossover and mutated children. */
export const breedNextGeneration = (
    ranked: ScoredIndividual[],
    champion: NeuralNetwork,
    size: number,
    mutationStrength: number,
): Individual[] => {
    const next: Individual[] = [{ id: CHAMPION_ID, nn: champion.copy() }];
    if (ranked.length > 1) next.push({ id: 1, nn: ranked[1].nn.copy() });

    while (next.length < size) {
        const roll = Math.random();
        let child: NeuralNetwork;
        if (roll < IMMIGRANT_SHARE) {
            child = new NeuralNetwork(champion.layers);
        } else if (roll < IMMIGRANT_SHARE + CROSSOVER_SHARE) {
            child = NeuralNetwork.crossover(tournamentWinner(ranked), tournamentWinner(ranked));
            child.mutate(CROSSOVER_MUTATION_RATE, mutationStrength / 2);
        } else {
            child = tournamentWinner(ranked).copy();
            child.mutate(ASEXUAL_MUTATION_RATE, mutationStrength);
        }
        next.push({ id: next.length, nn: child });
    }
    return next;
};
