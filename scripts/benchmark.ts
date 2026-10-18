import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { ALGORITHM_IDS } from '../src/simulation/algorithmPolicies';
import { compareToBestOther, meanCosts, type Comparison, type MapResult } from '../src/simulation/benchmark';
import { SEED_RANGES } from '../src/simulation/lawnGenerator';
import { parseModelFile } from '../src/simulation/modelFile';
import { SCORE_WEIGHTS } from '../src/simulation/score';
import { NETWORK_ID } from '../src/simulation/tasks';
import { runBenchmark, seedsOf, TEST_LAWNS } from '../src/simulation/trainer';
import { createWorkerPool } from './workerPool';

const { values: args } = parseArgs({
    options: {
        set: { type: 'string', default: 'test' },
        maps: { type: 'string', default: String(TEST_LAWNS) },
        model: { type: 'string', default: 'public/models/policy.json' },
        out: { type: 'string', default: 'results' },
    },
});

const set = args.set as keyof typeof SEED_RANGES;
if (!(set in SEED_RANGES)) throw new Error(`--set must be one of ${Object.keys(SEED_RANGES).join(', ')}`);
const mapCount = Number(args.maps);
const seeds = seedsOf(set, mapCount);
const model = existsSync(args.model) ? parseModelFile(readFileSync(args.model, 'utf8')) : null;

const formatComparison = (c: Comparison): string => [
    `- **${c.challenger}** vs best other model per map: ${c.wins} wins, ${c.ties} ties, ${c.losses} losses of ${c.maps} maps`,
    `  - mean difference ${c.meanDifference.toFixed(3)} cost/tile (95 % CI ${c.confidenceInterval[0].toFixed(3)} … ${c.confidenceInterval[1].toFixed(3)}), sign test p = ${c.signTestP.toPrecision(3)}`,
    `  - best other model per map: ${Object.entries(c.bestOtherCounts).map(([id, n]) => `${id} ${n}`).join(', ')}`,
].join('\n');

const report = (results: MapResult[], seconds: number): string => {
    const models = Object.keys(results[0].runs);
    const means = Object.entries(meanCosts(results)).sort((a, b) => a[1] - b[1]);
    const completed = (id: string) => results.filter(r => r.runs[id].endReason === 'completed').length;
    const lines = [
        `# Benchmark: ${set} set, ${results.length} lawns (seeds ${seeds[0]}–${seeds[seeds.length - 1]})`,
        '',
        `Score weights: ${JSON.stringify(SCORE_WEIGHTS)}. Lower cost per tile is better.`,
        model ? `Network: generation ${model.generation}, validation cost ${model.validationCost?.toFixed(3) ?? 'n/a'}.` : 'Network: none (no model file).',
        `Run time: ${seconds.toFixed(0)} s.`,
        '',
        '| Model | Mean cost / tile | Completed runs |',
        '| --- | ---: | ---: |',
        ...means.map(([id, mean]) => `| ${id} | ${mean.toFixed(3)} | ${completed(id)}/${results.length} |`),
        '',
        '## Head to head',
        '',
    ];
    const challengers = models.includes(NETWORK_ID) ? [NETWORK_ID] : [];
    for (const challenger of [...challengers, ...ALGORITHM_IDS]) {
        lines.push(formatComparison(compareToBestOther(results, challenger, models.filter(id => id !== challenger))));
    }
    return lines.join('\n') + '\n';
};

const main = async () => {
    const pool = createWorkerPool();
    const started = Date.now();
    try {
        console.log(`Benchmarking ${seeds.length} ${set} lawns on ${pool.size} threads${model ? ' with the network' : ''}...`);
        const results = await runBenchmark(pool, seeds, model?.network);
        const markdown = report(results, (Date.now() - started) / 1000);
        mkdirSync(args.out, { recursive: true });
        writeFileSync(`${args.out}/benchmark-${set}.json`, JSON.stringify(results, null, 1));
        writeFileSync(`${args.out}/benchmark-${set}.md`, markdown);
        console.log(markdown);
    } finally {
        pool.close();
    }
};

await main();
