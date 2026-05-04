import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as algos from './algorithms';
import { useGeminiAI } from './hooks/useGeminiAI';
import { useNeuralNetwork } from './hooks/useNeuralNetwork';
import { countGrass } from './utils/simUtils';
import {
    CELL_TYPES,
    ALGORITHMS_LIST,
    ALGORITHMS_NAMES,
    DEFAULT_MAX_BATTERY,
    DEFAULT_DRAIN_MOVE,
    DEFAULT_DRAIN_TURN,
    DAMAGE_PER_PASS,
    DAMAGE_PER_TURN
} from './constants';

const App = () => {
    const [grid, setGrid] = useState([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [brushType, setBrushType] = useState(CELL_TYPES.OBSTACLE);
    const [dockPos, setDockPos] = useState({ x: 0, y: 0 });
    const [mowerPos, setMowerPos] = useState({ x: 0, y: 0 });
    const [battery, setBattery] = useState(DEFAULT_MAX_BATTERY);

    // Statistika
    const [stats, setStats] = useState({
        distance: 0,
        mowedCount: 0,
        totalGrass: 0,
        turns: 0,
        chargeCycles: 0,
        startTime: null,
        endTime: null,
        accumulatedDuration: 0,
        history: []
    });

    const [isRunning, setIsRunning] = useState(false);
    const [algo, setAlgo] = useState('smart_ai');
    const [orientation, setOrientation] = useState('vertical'); // 'vertical' arba 'horizontal'
    const [speed, setSpeed] = useState(85);

    const [isTesting, setIsTesting] = useState(false);

    // Konfigūracija
    const [maxBattery, setMaxBattery] = useState(DEFAULT_MAX_BATTERY);
    const [drainMove, setDrainMove] = useState(DEFAULT_DRAIN_MOVE);
    const [drainTurn, setDrainTurn] = useState(DEFAULT_DRAIN_TURN);

    // Simuliacijos būsenos
    const [statusMessage, setStatusMessage] = useState("Paruošta");
    const [toasts, setToasts] = useState([]);
    const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);

    const showToast = useCallback((msg, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, msg, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    const simulationRef = useRef(null);
    const sessionStartStats = useRef(null);

    const pendingAlgosRef = useRef([]);
    const isTestingAllRef = useRef(false);
    const runSimulationRef = useRef(null);

    const { aiPrompt, setAiPrompt, isAiLoading, aiFeedback, generateAiPattern, analyzeTerrain } = useGeminiAI();

    const {
        nn,
        trainingStatus,
        trainNN,
        trainOnData,
        stopTraining,
        downloadModel,
        uploadModel
    } = useNeuralNetwork(grid, dockPos, showToast);


    const currentSessionMoves = useRef([]);

    const simState = useRef({
        pos: { x: 0, y: 0 },
        prevDir: { dx: 0, dy: 1 },
        battery: DEFAULT_MAX_BATTERY,
        grid: [],
        zigzagIdx: 0,
        uShapeIdx: 0,
        dockPos: { x: 0, y: 0 },
        isCharging: false,
        isReturningForCharge: false,
        visitCounts: {},
        hasNotifiedFinished: false
    });


    const prepareSimulationState = useCallback((sourceGrid, clearHistory = false) => {
        const cleanGrid = sourceGrid.map(row => row.map(cell => ({
            ...cell,
            type: (cell.type === CELL_TYPES.MOWED) ? CELL_TYPES.GRASS : cell.type,
            damage: 0,
            direction: null
        })));
        setGrid(cleanGrid);
        setMowerPos({ ...dockPos });
        setBattery(maxBattery);
        setStats(prev => ({
            distance: 0,
            mowedCount: 0,
            totalGrass: countGrass(cleanGrid),
            turns: 0,
            chargeCycles: 0,
            startTime: null,
            endTime: null,
            accumulatedDuration: 0,
            history: clearHistory ? [] : prev.history
        }));
        simState.current = {
            pos: { ...dockPos },
            prevDir: { dx: 0, dy: 1 },
            battery: maxBattery,
            grid: cleanGrid,
            zigzagIdx: 0,
            uShapeIdx: 0,
            slamDir: 1,
            dockPos: { ...dockPos },
            isCharging: false,
            isReturningForCharge: false,
            hasNotifiedFinished: false
        };
        return cleanGrid;
    }, [dockPos, maxBattery]);

    const initGrid = useCallback(() => {
        const newGrid = Array(20).fill(null).map((_, r) =>
            Array(25).fill(null).map((_, c) => ({
                type: (r === dockPos.y && c === dockPos.x) ? CELL_TYPES.DOCK : CELL_TYPES.GRASS,
                damage: 0,
                direction: null
            }))
        );
        prepareSimulationState(newGrid, true);
        setStatusMessage("Paruošta");
    }, [dockPos, prepareSimulationState]);

    useEffect(() => {
        initGrid();
    }, [initGrid]);

    const handleGenerateAiPattern = () => {
        generateAiPattern(dockPos, (newGrid) => {
            setGrid(newGrid);
            setStats(prev => ({ ...prev, totalGrass: countGrass(newGrid) }));
            simState.current.grid = newGrid;
        });
    };

    const handleAnalyzeTerrain = () => {
        analyzeTerrain(grid);
        setIsAnalysisOpen(true);
    };

    const stopSimulation = useCallback(() => {
        setIsRunning(false);
        if (simulationRef.current) clearInterval(simulationRef.current);
        setStats(prev => {
            if (!prev.startTime) return prev;
            const currentSessionDuration = Date.now() - prev.startTime;
            const currentGrid = simState.current.grid;
            const damagedGrassCount = currentGrid.flat().filter(c => c.type === CELL_TYPES.MOWED && c.damage > 0).length;

            const startStats = sessionStartStats.current || prev;
            const startDamaged = startStats.damagedGrassSnapshot || 0;

            const newRecord = {
                id: Date.now(),
                algo: algo,
                distance: prev.distance - (startStats.distance || 0),
                turns: prev.turns - (startStats.turns || 0),
                mowedCount: prev.mowedCount - (startStats.mowedCount || 0),
                duration: Math.round(currentSessionDuration / 1000),
                damagedGrass: damagedGrassCount - startDamaged,
                chargeCycles: prev.chargeCycles - (startStats.chargeCycles || 0)
            };

            // Hybrid Learning: Only train from HIGH QUALITY algorithms (avoid learning from itself if it's failing)
            if (currentSessionMoves.current.length > 0 && algo !== 'neural_network') {
                trainOnData(currentSessionMoves.current);
            }

            return {
                ...prev,
                endTime: Date.now(),
                accumulatedDuration: (prev.accumulatedDuration || 0) + currentSessionDuration,
                startTime: null,
                history: [...(prev.history || []), { ...newRecord, moves: [...currentSessionMoves.current] }]
            };
        });


        if (isTestingAllRef.current) {
            setTimeout(() => {
                startNextInQueue();
            }, 1500);
        }
    }, [algo]);

    const testAllAlgorithms = () => {
        if (isRunning) stopSimulation();
        setIsTesting(true);
        prepareSimulationState(grid, true);
        pendingAlgosRef.current = [...ALGORITHMS_LIST];
        isTestingAllRef.current = true;
        setTimeout(() => startNextInQueue(), 500);
    };

    const startNextInQueue = useCallback(() => {
        if (pendingAlgosRef.current.length === 0) {
            isTestingAllRef.current = false;
            setIsTesting(false);
            setStatusMessage("Visų algoritmų testavimas baigtas!");
            return;
        }

        setAlgo(pendingAlgosRef.current.shift());
        prepareSimulationState(simState.current.grid, false);
        setTimeout(() => runSimulationRef.current?.(), 500);
    }, [prepareSimulationState]);

    const getNextStep = (state) => {
        const { pos, grid: curGrid, prevDir, dockPos: currentDock, battery, isReturningForCharge } = state;
        const rows = curGrid.length;
        const cols = curGrid[0].length;
        const grassRemaining = countGrass(curGrid);

        // Baterija senka -> Į stotelę
        if (((battery / maxBattery) * 100 < 20 || isReturningForCharge) && grassRemaining > 0) {
            if (pos.x === currentDock.x && pos.y === currentDock.y) return null;
            if (!state.isReturningForCharge) {
                showToast("Baterija senka - grįžtama krautis", 'indigo');
            }
            state.isReturningForCharge = true;
            return algos.findPathToTarget(pos, curGrid, prevDir, (p) => p.x === currentDock.x && p.y === currentDock.y);
        }

        // Baigta -> Į stotelę
        if (grassRemaining === 0) {
            if (pos.x === currentDock.x && pos.y === currentDock.y) return null;
            if (!state.hasNotifiedFinished) {
                showToast("Pjovimas baigtas - grįžtama į bazę", 'success');
                state.hasNotifiedFinished = true;
            }
            return algos.findPathToTarget(pos, curGrid, prevDir, (p) => p.x === currentDock.x && p.y === currentDock.y);
        }

        setStatusMessage("Pjaunama veja...");

        // Algoritmų pasirinkimas
        let move = null;
        if (['zigzag', 'u_shape', 'slam_boustrophedon', 'cellular_boustrophedon'].includes(algo)) {
            const fns = {
                zigzag: algos.getZigzagMove,
                u_shape: algos.getUShapeMove,
                slam_boustrophedon: algos.getSLAMBoustrophedonMove,
                cellular_boustrophedon: algos.getCellularBoustrophedonMove
            };
            move = fns[algo](state, curGrid, prevDir, rows, cols, CELL_TYPES, orientation);
        } else {
            const fns = {
                a_star: algos.getAStarMove,
                dijkstra: algos.getDijkstraMove,
                bfs: algos.getBFSMove,
                greedy_bfs: algos.getGreedyBestFirstMove,
                jps: algos.getJPSMove,
                d_star_lite: algos.getDStarLiteMove,
                custom_mower: algos.getCustomMove,
                smart_ai: algos.getSmartAIMove,
                neural_network: (s, g, d, c) => algos.getNeuralNetworkMove(s, g, d, c, nn)
            };
            move = (fns[algo] || algos.getSmartAIMove)(state, curGrid, prevDir, CELL_TYPES);
        }



        if (!move && algo !== 'smart_ai' && grassRemaining > 0) {
            move = algos.getSmartAIMove(state, curGrid, prevDir, CELL_TYPES);
        }

        if (!move) {
            if (pos.x === currentDock.x && pos.y === currentDock.y) return null;
            setStatusMessage("Nerasta daugiau pasiekiamos vejos - grįžtama į bazę");
            return algos.findPathToTarget(pos, curGrid, prevDir, (p) => p.x === currentDock.x && p.y === currentDock.y);
        }

        return move;
    };

    const runSimulation = () => {
        if (isRunning) { stopSimulation(); return; }
        simState.current.grid = grid;
        simState.current.dockPos = { ...dockPos };
        simState.current.battery = battery;
        setIsRunning(true);
        setStats(prev => {
            sessionStartStats.current = {
                ...prev,
                damagedGrassSnapshot: grid.flat().filter(c => c.type === CELL_TYPES.MOWED && c.damage > 0).length
            };
            return { ...prev, startTime: Date.now(), endTime: null };
        });
        currentSessionMoves.current = [];

        simulationRef.current = setInterval(() => {
            const state = simState.current;
            const { pos, prevDir, battery: curBat, grid: curGrid, dockPos: dPos } = state;

            // Krovimas
            if (state.isCharging) {
                // Krovimas vyksta 4x greičiau nei judesio kaina per vieną intervalą
                const chargedBat = Math.min(maxBattery * 0.8, curBat + (drainMove * 4));
                state.battery = chargedBat;
                setBattery(chargedBat);
                if (chargedBat >= maxBattery * 0.8) {
                    state.isCharging = false;
                    state.isReturningForCharge = false;
                    setStatusMessage("Pakrauta iki 80%. Tęsiama...");
                }
                return;
            }

            // Atvyko į stotelę krautis
            if (state.isReturningForCharge && pos.x === dPos.x && pos.y === dPos.y) {
                state.isCharging = true;
                setStats(s => ({ ...s, chargeCycles: s.chargeCycles + 1 }));
                return;
            }

            if (curBat <= 0) {
                setStatusMessage("Baterija išseko!");
                stopSimulation();
                return;
            }

            let wasGrass = false;
            const nextGrid = curGrid.map(row => row.map(cell => ({ ...cell })));
            const currentCell = nextGrid[pos.y][pos.x];

            if (currentCell.type === CELL_TYPES.GRASS) {
                currentCell.type = CELL_TYPES.MOWED;
                currentCell.direction = { ...prevDir };
                wasGrass = true;
            } else if (currentCell.type === CELL_TYPES.MOWED) {
                currentCell.damage += DAMAGE_PER_PASS;
                currentCell.direction = { ...prevDir };
            }

            state.grid = nextGrid;
            const nextMove = getNextStep(state);

            if (!nextMove) {
                if (pos.x === dPos.x && pos.y === dPos.y) {
                    setStatusMessage(countGrass(nextGrid) === 0 ? "Užduotis sėkmingai atlikta!" : "Darbas baigtas (yra nepasiekiamos vejos)");
                } else {
                    setStatusMessage("Klaida: stotelė nepasiekiama!");
                }
                setGrid(nextGrid);
                stopSimulation();
                return;
            }

            const newDx = nextMove.x - pos.x;
            const newDy = nextMove.y - pos.y;
            const isTurn = newDx !== prevDir.dx || newDy !== prevDir.dy;
            if (isTurn) { currentCell.damage += DAMAGE_PER_TURN; }

            const cost = drainMove + (isTurn ? drainTurn : 0);
            const newBat = Math.max(0, curBat - cost);

            state.pos = nextMove;
            state.prevDir = { dx: newDx, dy: newDy };
            state.battery = newBat;
            state.grid = nextGrid;

            const posKey = `${nextMove.x},${nextMove.y}`;
            state.visitCounts = state.visitCounts || {};
            state.visitCounts[posKey] = (state.visitCounts[posKey] || 0) + 1;

            setGrid(nextGrid);
            setMowerPos(nextMove);
            setBattery(newBat);
            const totalDamage = nextGrid.flat().reduce((sum, cell) => sum + (cell.damage || 0), 0);

            setStats(s => ({
                ...s,
                distance: s.distance + 1,
                mowedCount: wasGrass ? s.mowedCount + 1 : s.mowedCount,
                turns: isTurn ? s.turns + 1 : s.turns,
                damagedGrass: totalDamage
            }));

            // Collect training data (state-action pairs)
            const inputs = algos.prepareNNInputs(state, curGrid, CELL_TYPES);
            // Target output: 0: Up, 1: Down, 2: Left, 3: Right
            const targets = [0, 0, 0, 0];
            if (newDy === -1) targets[0] = 1;
            else if (newDy === 1) targets[1] = 1;
            else if (newDx === -1) targets[2] = 1;
            else if (newDx === 1) targets[3] = 1;

            currentSessionMoves.current.push({ inputs, targets });
        }, 140 - speed);
    };

    const resetMowedOnly = () => {
        stopSimulation();
        prepareSimulationState(grid, false);
        showToast("Rezultatas išvalytas");
    };

    const resetFull = () => {
        stopSimulation();
        initGrid();
    };

    const updateCell = (r, c) => {
        if (isRunning) return;
        setGrid(prev => {
            const newGrid = prev.map(row => row.map(cell => ({ ...cell })));
            const current = newGrid[r][c];

            if (brushType === CELL_TYPES.DOCK) {
                if (current.type === CELL_TYPES.OBSTACLE) return prev;

                const updatedGrid = newGrid.map((row, rIdx) => row.map((cell, cIdx) => {
                    if (cell.type === CELL_TYPES.DOCK) return { ...cell, type: CELL_TYPES.GRASS };
                    if (rIdx === r && cIdx === c) return { ...cell, type: CELL_TYPES.DOCK, damage: 0 };
                    return cell;
                }));

                setDockPos({ x: c, y: r });
                setMowerPos({ x: c, y: r });
                simState.current.pos = { x: c, y: r };
                simState.current.dockPos = { x: c, y: r };
                return updatedGrid;
            }

            newGrid[r][c] = { ...current, type: current.type === brushType ? CELL_TYPES.GRASS : brushType, damage: 0, direction: null };
            const newTotal = countGrass(newGrid);
            setStats(s => ({ ...s, totalGrass: newTotal }));
            simState.current.grid = newGrid;
            return newGrid;
        });
    };

    const getCellColor = (cell) => {
        if (cell.type === CELL_TYPES.OBSTACLE) return 'bg-slate-700';
        if (cell.type === CELL_TYPES.DOCK) return '#3b82f6';
        if (cell.type === CELL_TYPES.GRASS) return '#065f46';
        const baseMowed = [20, 35, 30];
        const targetRed = [220, 38, 38];
        const r = Math.round(baseMowed[0] + (targetRed[0] - baseMowed[0]) * Math.min(1, cell.damage));
        const g = Math.round(baseMowed[1] + (targetRed[1] - baseMowed[1]) * Math.min(1, cell.damage));
        const b = Math.round(baseMowed[2] + (targetRed[2] - baseMowed[2]) * Math.min(1, cell.damage));
        return `rgb(${r}, ${g}, ${b})`;
    };

    useEffect(() => {
        runSimulationRef.current = runSimulation;
    });

    const duration = Math.round(((stats.accumulatedDuration || 0) + (stats.startTime ? Date.now() - stats.startTime : 0)) / 1000);

    let winnerId = null;
    if (stats.history && stats.history.length > 1) {
        const validHistory = stats.history.filter(h => h.mowedCount > 0);
        if (validHistory.length > 0) {
            const winner = validHistory.reduce((prev, curr) => {
                if (curr.damagedGrass !== prev.damagedGrass) return curr.damagedGrass < prev.damagedGrass ? curr : prev;
                if (curr.chargeCycles !== prev.chargeCycles) return curr.chargeCycles < prev.chargeCycles ? curr : prev;
                if (curr.turns !== prev.turns) return curr.turns < prev.turns ? curr : prev;
                return curr.distance < prev.distance ? curr : prev;
            });
            winnerId = winner.id;
        }
    }


    return (
        <div className="flex flex-col items-center p-6 bg-slate-950 min-h-screen text-slate-200 font-sans" onMouseUp={() => setIsDrawing(false)}>

            <div className="w-full max-w-6xl">
                <div className="flex flex-col lg:flex-row gap-8">

                    <div className="w-full lg:w-80 flex flex-col gap-4">
                        <div className="bg-slate-900/50 backdrop-blur-md p-6 rounded-[2rem] border border-slate-800 shadow-2xl text-center">

                            <div className="flex items-center gap-3 mb-6 justify-center">
                                <div className="p-2 bg-emerald-500/20 rounded-lg">
                                    <div className="w-4 h-4 bg-emerald-500 rounded-sm rotate-45 animate-pulse"></div>
                                </div>
                                <h1 className="text-xl font-black tracking-tight text-white uppercase">MowerAI <span className="text-emerald-500 text-sm">v5.2</span></h1>
                            </div>

                            <div className="space-y-6">
                                <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl space-y-3">
                                    <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest ml-1 block">AI Dizainas</label>
                                    <input type="text" placeholder="Sukurk parką..." className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-emerald-500 transition-all text-center" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} />
                                    <div className="flex gap-2">
                                        <button onClick={handleGenerateAiPattern} disabled={isAiLoading || !aiPrompt} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 py-2 rounded-xl text-[9px] font-black">GENE</button>
                                        <button onClick={handleAnalyzeTerrain} disabled={isAiLoading} className="flex-1 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 py-2 rounded-xl text-[9px] font-black">ANALYZE</button>
                                    </div>
                                </div>

                                <div className="bg-slate-800/40 p-4 rounded-2xl space-y-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Nustatymai</label>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase"><span>Baterija</span><span>{maxBattery}%</span></div>
                                        <input type="range" min="10" max="200" step="10" value={maxBattery} onChange={e => setMaxBattery(Number(e.target.value))} className="w-full accent-emerald-500 h-1" disabled={isRunning} />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase"><span>Judesys</span><span>{drainMove.toFixed(2)}</span></div>
                                        <input type="range" min="0.01" max="1.0" step="0.01" value={drainMove} onChange={e => setDrainMove(Number(e.target.value))} className="w-full accent-emerald-500 h-1" disabled={isRunning} />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase"><span>Posūkis</span><span>{drainTurn.toFixed(2)}</span></div>
                                        <input type="range" min="0" max="2.0" step="0.1" value={drainTurn} onChange={e => setDrainTurn(Number(e.target.value))} className="w-full accent-emerald-500 h-1" disabled={isRunning} />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase"><span>Greitis</span><span>{speed}</span></div>
                                        <input type="range" min="10" max="135" step="5" value={speed} onChange={e => setSpeed(Number(e.target.value))} className="w-full accent-emerald-500 h-1" disabled={isRunning} />
                                    </div>
                                    <div className="space-y-2 pt-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Kryptis</label>
                                        <div className="flex gap-1">
                                            <button onClick={() => setOrientation('vertical')} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black transition-all border ${orientation === 'vertical' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-slate-800 text-slate-500 border-transparent'}`}>VERTIKALIAI</button>
                                            <button onClick={() => setOrientation('horizontal')} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black transition-all border ${orientation === 'horizontal' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-slate-800 text-slate-500 border-transparent'}`}>HORIZONTALIAI</button>
                                        </div>
                                    </div>
                                </div>


                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 block">Algoritmas</label>
                                    <div className="flex flex-col gap-1">
                                        {ALGORITHMS_LIST.map(a => (
                                            <button key={a} onClick={() => setAlgo(a)} className={`w-full p-2 rounded-lg text-[10px] font-bold transition-all border ${algo === a ? 'bg-emerald-500 text-emerald-950 border-emerald-400 shadow-emerald-500/20 shadow-lg' : 'bg-slate-800 text-slate-400 border-transparent'}`}>
                                                {ALGORITHMS_NAMES[a]}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-1">
                                    <button onClick={() => setBrushType(CELL_TYPES.OBSTACLE)} className={`py-2 rounded-lg text-[8px] font-black transition-all border ${brushType === CELL_TYPES.OBSTACLE ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' : 'bg-slate-800 text-slate-500 border-transparent'}`}>KLIŪTIS</button>
                                    <button onClick={() => setBrushType(CELL_TYPES.GRASS)} className={`py-2 rounded-lg text-[8px] font-black transition-all border ${brushType === CELL_TYPES.GRASS ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-slate-800 text-slate-500 border-transparent'}`}>TRINTUKAS</button>
                                    <button onClick={() => setBrushType(CELL_TYPES.DOCK)} className={`py-2 rounded-lg text-[8px] font-black transition-all border ${brushType === CELL_TYPES.DOCK ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' : 'bg-slate-800 text-slate-500 border-transparent'}`}>STOTELĖ</button>
                                </div>

                                <div className="bg-indigo-500/5 border border-indigo-500/20 p-4 rounded-2xl space-y-3">
                                    <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1 block">Neural Network (NN)</label>

                                    {trainingStatus.isTraining ? (
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-[8px] font-bold text-indigo-400 uppercase tracking-tighter">
                                                <span>Karta {trainingStatus.epoch}</span>
                                                <span>
                                                    Best: {Math.round(trainingStatus.bestFitness)}
                                                    <span className="ml-2 opacity-50">({Math.max(0, Math.round((trainingStatus.bestFitness / 10000000) * 100))}%)</span>
                                                </span>
                                            </div>

                                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-indigo-500 transition-all duration-500 ease-out"
                                                    style={{ width: `${Math.min(100, Math.max(0, (trainingStatus.bestFitness / 10000000) * 100))}%` }}
                                                ></div>
                                            </div>

                                            <div className="flex justify-between items-center">
                                                <div className="text-[7px] text-slate-500 uppercase font-black">Vykdoma nuolatinė evoliucija</div>
                                                <button onClick={stopTraining} className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-[8px] font-black rounded-lg transition-all">STABDYTI</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button onClick={trainNN} className="w-full bg-indigo-600 hover:bg-indigo-500 py-2 rounded-xl text-[9px] font-black shadow-lg shadow-indigo-500/20 transition-all active:scale-95">VYKDYTI NUOLATINĘ OPTIMIZACIJĄ</button>
                                    )}

                                    <div className="flex gap-2">
                                        <button onClick={downloadModel} disabled={trainingStatus.isTraining} className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 py-2 rounded-xl text-[9px] font-black border border-slate-700">ATSISIŲSTI</button>
                                        <label className={`flex-1 bg-slate-800 hover:bg-slate-700 py-2 rounded-xl text-[9px] font-black border border-slate-700 cursor-pointer text-center flex items-center justify-center ${trainingStatus.isTraining ? 'opacity-50 pointer-events-none' : ''}`}>
                                            ĮKELTI
                                            <input type="file" className="hidden" onChange={uploadModel} accept=".json" />
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 space-y-2">
                                <button onClick={runSimulation} className={`w-full py-3 rounded-xl font-black text-xs tracking-widest transition-all transform active:scale-95 ${isRunning && !isTestingAllRef.current ? 'bg-amber-400 text-amber-950' : 'bg-emerald-500 text-emerald-950 shadow-emerald-500/20 shadow-lg'}`}>{isRunning && !isTestingAllRef.current ? 'STABDYTI' : 'PRADĖTI'}</button>
                                <button onClick={testAllAlgorithms} disabled={isRunning || isTesting} className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-xl text-[9px] font-black tracking-widest transition shadow-lg shadow-blue-500/20 text-blue-50">TESTUOTI VISUS ALGORITMUS</button>
                                <button onClick={resetMowedOnly} className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-[9px] font-black tracking-widest transition border border-slate-700/50">IŠVALYTI REZULTATĄ</button>
                                <button onClick={resetFull} className="w-full py-2 text-slate-600 hover:text-slate-400 text-[9px] font-black tracking-widest transition">PILNAS RESETAS</button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col items-center">
                        <div className="w-full bg-slate-900/50 backdrop-blur-md p-6 rounded-[2.5rem] border border-slate-800 mb-4 shadow-xl flex flex-col gap-4 text-center">
                            <div className="flex justify-between items-center">
                                <div className="flex flex-col items-start">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Būsena</span>
                                    <span className={`text-sm font-bold ${statusMessage.includes('išseko') ? 'text-rose-400' : 'text-emerald-400'}`}>{statusMessage}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Energija</span>
                                    <p className={`font-mono text-xl font-bold ${battery < (maxBattery * 0.2) ? 'text-rose-500 animate-pulse' : 'text-emerald-400'}`}>
                                        {((battery / maxBattery) * 100).toFixed(1)}%
                                    </p>
                                </div>
                            </div>
                            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden p-[2px]">
                                <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${(battery / maxBattery) * 100}%` }}></div>
                            </div>
                        </div>

                        <div className={`grid gap-[2px] bg-slate-900 p-3 rounded-[2.5rem] shadow-2xl border border-slate-800/50 overflow-hidden transition-all duration-500 ${isAiLoading ? 'opacity-40 scale-95 grayscale' : 'opacity-100'}`} onMouseDown={() => setIsDrawing(true)}>
                            {grid.map((row, r) => (
                                <div key={r} className="flex gap-[2px]">
                                    {row.map((cell, c) => {
                                        const isMower = mowerPos.x === c && mowerPos.y === r;
                                        const cellColor = getCellColor(cell);
                                        return (
                                            <div
                                                key={`${r}-${c}`}
                                                onMouseDown={() => updateCell(r, c)}
                                                onMouseEnter={() => isDrawing && updateCell(r, c)}
                                                className={`w-6 h-6 transition-all duration-300 rounded-sm relative ${cell.type === CELL_TYPES.OBSTACLE ? 'bg-slate-700 scale-90 rounded-md shadow-inner' : ''}`}
                                                style={{
                                                    backgroundColor: cell.type !== CELL_TYPES.OBSTACLE ? cellColor : undefined,
                                                    borderTop: (cell.type === CELL_TYPES.MOWED && cell.direction && cell.direction.dx !== 0) ? '1px solid rgba(52, 211, 153, 0.5)' : '1px solid transparent',
                                                    borderBottom: (cell.type === CELL_TYPES.MOWED && cell.direction && cell.direction.dx !== 0) ? '1px solid rgba(52, 211, 153, 0.5)' : '1px solid transparent',
                                                    borderLeft: (cell.type === CELL_TYPES.MOWED && cell.direction && cell.direction.dy !== 0) ? '1px solid rgba(52, 211, 153, 0.5)' : '1px solid transparent',
                                                    borderRight: (cell.type === CELL_TYPES.MOWED && cell.direction && cell.direction.dy !== 0) ? '1px solid rgba(52, 211, 153, 0.5)' : '1px solid transparent',
                                                }}
                                            >
                                                {isMower && (
                                                    <div className="absolute inset-0 bg-amber-400 rounded-md shadow-[0_0_20px_rgba(251,191,36,0.8)] z-20 flex items-center justify-center transition-all duration-150 scale-125">
                                                        <div className="w-1.5 h-1.5 bg-black/20 rounded-full animate-ping"></div>
                                                    </div>
                                                )}
                                                {cell.type === CELL_TYPES.DOCK && !isMower && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <div className="w-2 h-2 bg-white/50 rounded-full animate-pulse"></div>
                                                    </div>
                                                )}
                                                {cell.type === CELL_TYPES.MOWED && !isMower && cell.damage > 0 && (
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-30">
                                                        <div className="w-full h-[1px] bg-white/10 rotate-45"></div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>

                        <div className="w-full mt-8 bg-slate-900/50 p-8 rounded-[3rem] border border-slate-800 shadow-2xl">
                            <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] mb-8 text-center">Analizės Statistika</h2>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                                <div className="bg-slate-950/50 p-4 rounded-3xl border border-slate-800/50 flex flex-col items-center">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase mb-2">Padengimas</span>
                                    <span className="text-2xl font-black text-white leading-none">{stats.totalGrass > 0 ? ((stats.mowedCount / stats.totalGrass) * 100).toFixed(1) : "0"}%</span>
                                    <span className="text-[10px] text-slate-600 mt-1">{stats.mowedCount} / {stats.totalGrass} lang.</span>
                                </div>
                                <div className="bg-slate-950/50 p-4 rounded-3xl border border-slate-800/50 flex flex-col items-center">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase mb-2">Nuvažiuota</span>
                                    <span className="text-2xl font-black text-cyan-400 leading-none">{stats.distance}m</span>
                                    <span className="text-[10px] text-slate-600 mt-1">{duration} sek. veikimo</span>
                                </div>
                                <div className="bg-slate-950/50 p-4 rounded-3xl border border-slate-800/50 flex flex-col items-center">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase mb-2">Posūkiai</span>
                                    <span className="text-2xl font-black text-amber-500 leading-none">{stats.turns}</span>
                                    <span className="text-[10px] text-slate-600 mt-1">Manevringumas</span>
                                </div>
                                <div className="bg-slate-950/50 p-4 rounded-3xl border border-slate-800/50 flex flex-col items-center">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase mb-2">Įkrovimai</span>
                                    <span className="text-2xl font-black text-blue-400 leading-none">{stats.chargeCycles}</span>
                                    <span className="text-[10px] text-slate-600 mt-1">Baterijos ciklai</span>
                                </div>
                                <div className="bg-slate-950/50 p-4 rounded-3xl border border-slate-800/50 flex flex-col items-center">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase mb-2">Pažeista</span>
                                    <span className="text-2xl font-black text-rose-400 leading-none">{grid.flat().filter(c => c.type === CELL_TYPES.MOWED && c.damage > 0).length}</span>
                                    <span className="text-[10px] text-slate-600 mt-1">Žolės pažeidimai</span>
                                </div>
                            </div>
                            <div className="mt-8 flex justify-center gap-10">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                    <span className="text-[10px] font-bold text-slate-400">Efektyvumas: {stats.distance > 0 ? (stats.mowedCount / stats.distance).toFixed(2) : 0} p/m</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                    <span className="text-[10px] font-bold text-slate-400">Baterijos likutis: {((battery / maxBattery) * 100).toFixed(1)}%</span>
                                </div>
                            </div>

                            {stats.history && stats.history.length > 0 && (
                                <div className="mt-8 pt-8 border-t border-slate-800/50">
                                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 text-left">Simuliacijų Istorija</h3>
                                    <div className="space-y-2">
                                        {stats.history.map((record, i) => (
                                            <div key={record.id} className={`p-4 rounded-2xl border flex flex-wrap justify-between items-center text-[10px] transition-all duration-300 ${record.id === winnerId ? 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)] bg-amber-900/20' : 'bg-slate-950/50 border-slate-800/50'}`}>
                                                <div className="flex gap-4 items-center">
                                                    <span className={`font-bold px-2 py-1 rounded-lg border ${record.id === winnerId ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'}`}>#{i + 1} {record.algo.replace(/_/g, ' ').toUpperCase()}</span>
                                                    {record.id === winnerId && <span className="text-amber-400 font-black animate-pulse flex items-center gap-1"><span className="text-sm">👑</span> NUGALĖTOJAS</span>}
                                                    <span className="text-slate-400 font-mono">{record.duration}s</span>
                                                </div>
                                                <div className="flex gap-6 text-slate-300 font-mono">
                                                    <div className="flex flex-col items-center"><span className="text-slate-500 text-[8px]">NUPJAUTA</span><span>{record.mowedCount}</span></div>
                                                    <div className="flex flex-col items-center"><span className="text-slate-500 text-[8px]">ATSTUMAS</span><span>{record.distance}m</span></div>
                                                    <div className="flex flex-col items-center"><span className="text-slate-500 text-[8px]">POSŪKIAI</span><span>{record.turns}</span></div>
                                                    <div className="flex flex-col items-center"><span className="text-blue-500 text-[8px]">ĮKROVIMAI</span><span className="text-blue-400">{record.chargeCycles || 0}</span></div>
                                                    <div className="flex flex-col items-center"><span className="text-rose-500 text-[8px]">PAŽEISTA</span><span className="text-rose-400">{record.damagedGrass}</span></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal for AI Analysis */}
            {isAnalysisOpen && aiFeedback && (
                <div className="modal-backdrop" onClick={() => setIsAnalysisOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-white uppercase tracking-tight">AI Teritorijos Analizė</h2>
                            <button onClick={() => setIsAnalysisOpen(false)} className="text-slate-500 hover:text-white transition-colors text-2xl">&times;</button>
                        </div>
                        <div className="space-y-4 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap bg-slate-950/50 p-6 rounded-3xl border border-slate-800">
                            {String(aiFeedback)}
                        </div>
                        <div className="mt-8">
                            <button onClick={() => setIsAnalysisOpen(false)} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-600/20">SUPRASTU</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notifications */}
            <div className="toast-container">
                {toasts.map(t => (
                    <div key={t.id} className={`toast ${t.type === 'error' ? 'error' : t.type === 'indigo' ? 'indigo' : ''}`}>
                        {t.type === 'error' ? '⚠️' : t.type === 'indigo' ? '🔋' : '✅'}
                        {t.msg}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default App;