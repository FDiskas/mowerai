import React, { useState, useEffect, useRef } from 'react';
import { NeuralNetwork } from '../../NeuralNetwork';
import type { Grid, Point } from '../../types';
import { CELL_TYPES } from '../../constants';
import { getNeuralNetworkMove } from '../../algorithms';

interface TrainingPreviewProps {
    nn: NeuralNetwork | null;
    initialGrid: Grid;
    dockPos: Point;
    orientation: 'horizontal' | 'vertical';
}

export const TrainingPreview: React.FC<TrainingPreviewProps> = ({ nn, initialGrid, dockPos, orientation }) => {
    const [previewGrid, setPreviewGrid] = useState<Grid>([]);
    const [mowerPos, setMowerPos] = useState<Point>(dockPos);
    const [battery, setBattery] = useState(100);
    const intervalRef = useRef<any>(null);
    const stateRef = useRef<any>(null);

    useEffect(() => {
        if (!nn || !initialGrid.length) return;

        // Reset simulation
        const cleanGrid = initialGrid.map(row => row.map(cell => ({
            ...cell,
            type: cell.type === CELL_TYPES.MOWED ? CELL_TYPES.GRASS : cell.type,
            damage: 0
        })));

        stateRef.current = {
            pos: { ...dockPos },
            prevDir: { dx: 0, dy: 1 },
            battery: 100,
            grid: cleanGrid,
            dockPos: { ...dockPos },
            isCharging: false,
            isReturningForCharge: false,
            visitCounts: {},
            orientation: orientation,
            maxBattery: 100
        };

        setPreviewGrid(cleanGrid);
        setMowerPos(dockPos);
        setBattery(100);

        if (intervalRef.current) clearInterval(intervalRef.current);

        intervalRef.current = setInterval(() => {
            const currentNn = nn;
            const state = stateRef.current;
            if (!currentNn || !state) return;

            const move = getNeuralNetworkMove(state, state.grid, state.prevDir, CELL_TYPES, currentNn);
            
            if (move) {
                const cell = state.grid[move.y][move.x];
                if (cell.type === CELL_TYPES.GRASS) {
                    cell.type = CELL_TYPES.MOWED;
                }
                
                const dx = move.x - state.pos.x;
                const dy = move.y - state.pos.y;
                
                state.pos = move;
                state.prevDir = { dx, dy };
                state.battery -= 0.2;

                setMowerPos({ ...move });
                setBattery(state.battery);
                
                // Tik kas kelis žingsnius atnaujiname tinklelį vizualiai dėl našumo
                setPreviewGrid([...state.grid.map(r => [...r])]);

                if (state.battery <= 0) {
                    state.battery = 100;
                    state.pos = { ...dockPos };
                    state.visitCounts = {};
                }
            }
        }, 80);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [nn, initialGrid, dockPos, orientation]);

    if (!nn || !previewGrid.length) return null;

    const cols = previewGrid[0].length;
    const rows = previewGrid.length;

    return (
        <div className="space-y-3 bg-slate-950/60 p-3 rounded-2xl border border-indigo-500/20 shadow-inner">
            <div className="flex justify-between items-center px-1">
                <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Geriausias AI (Live)</span>
                <div className="flex gap-2">
                    <span className="text-[9px] font-mono text-indigo-300">⚡ {Math.round(battery)}%</span>
                </div>
            </div>
            
            <div className="relative aspect-[25/20] w-full bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
                <div 
                    className="absolute inset-0 grid" 
                    style={{ 
                        gridTemplateColumns: `repeat(${cols}, 1fr)`,
                        gridTemplateRows: `repeat(${rows}, 1fr)`,
                        gap: '1px'
                    }}
                >
                    {previewGrid.flat().map((cell, i) => (
                        <div 
                            key={i} 
                            className={`w-full h-full ${
                                cell.type === CELL_TYPES.GRASS ? 'bg-emerald-950/40' :
                                cell.type === CELL_TYPES.OBSTACLE ? 'bg-slate-800' :
                                cell.type === CELL_TYPES.DOCK ? 'bg-indigo-500/40' :
                                'bg-emerald-500/60'
                            }`}
                        />
                    ))}
                </div>
                
                {/* Mower Indicator */}
                <div 
                    className="absolute w-2 h-2 bg-white rounded-full shadow-[0_0_8px_white] transition-all duration-75 ease-linear z-10"
                    style={{ 
                        left: `${(mowerPos.x / cols) * 100}%`,
                        top: `${(mowerPos.y / rows) * 100}%`,
                        transform: 'translate(50%, 50%)'
                    }}
                />
            </div>
        </div>
    );
};

