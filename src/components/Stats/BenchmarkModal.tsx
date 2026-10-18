import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { ALGORITHMS_NAMES } from '../../constants';
import { ALGORITHM_IDS } from '../../simulation/algorithmPolicies';
import { compareToBestOther, meanCosts, type Comparison, type MapResult } from '../../simulation/benchmark';
import { createBrowserPool } from '../../simulation/browserPool';
import type { NetworkData } from '../../simulation/policyNetwork';
import { NETWORK_ID } from '../../simulation/tasks';
import { runBenchmark, seedsOf, TEST_LAWNS } from '../../simulation/trainer';

interface BenchmarkModalProps {
    isOpen: boolean;
    onClose: () => void;
    network: NetworkData;
}

interface BenchmarkOutcome {
    results: MapResult[];
    comparison: Comparison;
}

const nameOf = (id: string) => ALGORITHMS_NAMES[id as keyof typeof ALGORITHMS_NAMES] ?? id;

const testSeeds = seedsOf('test', TEST_LAWNS);

const runProof = async (network: NetworkData): Promise<BenchmarkOutcome> => {
    const pool = createBrowserPool();
    try {
        const results = await runBenchmark(pool, testSeeds, network);
        return { results, comparison: compareToBestOther(results, NETWORK_ID, ALGORITHM_IDS) };
    } finally {
        pool.close();
    }
};

const Verdict = ({ comparison }: { comparison: Comparison }) => {
    const { wins, ties, losses, maps, meanDifference, confidenceInterval, signTestP } = comparison;
    const isProven = wins > losses && signTestP < 0.05 && confidenceInterval[1] < 0;
    return (
        <div className={`p-5 rounded-2xl border ${isProven ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-rose-500/40 bg-rose-500/5'}`}>
            <p className={`text-sm font-black uppercase tracking-wide ${isProven ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isProven ? 'Proven: the network beats the best algorithm on each lawn' : 'Not proven against the best algorithm on each lawn'}
            </p>
            <p className="text-xs text-slate-300 mt-2">
                Against the best algorithm on each lawn: <b>{wins}</b> wins, {ties} ties, <b>{losses}</b> losses of {maps} lawns.
            </p>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
                Mean difference {meanDifference.toFixed(3)} cost/tile (95% CI {confidenceInterval[0].toFixed(3)} … {confidenceInterval[1].toFixed(3)}), sign test p = {signTestP.toPrecision(2)}
            </p>
        </div>
    );
};

export const BenchmarkModal: React.FC<BenchmarkModalProps> = ({ isOpen, onClose, network }) => {
    const [outcome, setOutcome] = useState<BenchmarkOutcome | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const start = () => {
        setIsRunning(true);
        setError(null);
        runProof(network)
            .then(setOutcome)
            .catch((err: Error) => setError(err.message))
            .finally(() => setIsRunning(false));
    };

    const ranking = outcome ? Object.entries(meanCosts(outcome.results)).sort((a, b) => a[1] - b[1]) : [];

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content border border-slate-700/50 max-w-xl" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Proof Benchmark</h2>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">
                            {TEST_LAWNS} held-out lawns · unknown map · fixed score
                        </p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 text-slate-500 hover:text-white transition-colors text-2xl flex items-center justify-center">&times;</button>
                </div>

                <div className="space-y-5">
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Every model mows the same {TEST_LAWNS} test lawns (seeds {testSeeds[0]}–{testSeeds[testSeeds.length - 1]}), which training never uses.
                        Each model starts knowing only what its sensor sees. The cost per tile counts steps, turns (×2), overlaps, charge trips and missed tiles; lower is better.
                    </p>

                    {outcome && <Verdict comparison={outcome.comparison} />}
                    {error && <p className="text-xs text-rose-400">ERROR: {error}</p>}

                    {ranking.length > 0 && (
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-[9px] text-slate-500 uppercase tracking-widest">
                                    <th className="text-left py-1">Model</th>
                                    <th className="text-right py-1">Mean cost / tile</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ranking.map(([id, cost]) => (
                                    <tr key={id} className={id === NETWORK_ID ? 'text-indigo-300 font-bold' : 'text-slate-300'}>
                                        <td className="py-1">{nameOf(id)}</td>
                                        <td className="py-1 text-right font-mono">{cost.toFixed(3)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    <Button variant="indigo" size="lg" fullWidth onClick={start} disabled={isRunning}>
                        {isRunning ? 'RUNNING…' : outcome ? 'RUN AGAIN' : 'RUN BENCHMARK'}
                    </Button>
                </div>
            </div>
        </div>
    );
};
