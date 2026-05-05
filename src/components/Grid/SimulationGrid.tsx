import React, { memo } from 'react';
import type { Grid as GridType, PositionType as Position } from '../../types';
import { CELL_TYPES } from '../../constants';

interface CellProps {
    r: number;
    c: number;
    cell: any;
    isMower: boolean;
    isDock: boolean;
    onCellClick: (r: number, c: number) => void;
    onCellMouseEnter: (r: number, c: number) => void;
}

const MemoizedCell = memo(({ r, c, cell, isMower, isDock, onCellClick, onCellMouseEnter }: CellProps) => {
    const isObstacle = cell.type === CELL_TYPES.OBSTACLE;
    const isMowed = cell.type === CELL_TYPES.MOWED;
    
    const getCellColor = () => {
        if (isObstacle) return undefined;
        if (cell.type === CELL_TYPES.DOCK) return '#3b82f6';
        if (cell.type === CELL_TYPES.GRASS) return '#065f46';
        
        // Mowed gradient
        const baseMowed = [20, 35, 30];
        const targetRed = [220, 38, 38];
        const rVal = Math.round(baseMowed[0] + (targetRed[0] - baseMowed[0]) * Math.min(1, cell.damage));
        const gVal = Math.round(baseMowed[1] + (targetRed[1] - baseMowed[1]) * Math.min(1, cell.damage));
        const bVal = Math.round(baseMowed[2] + (targetRed[2] - baseMowed[2]) * Math.min(1, cell.damage));
        return `rgb(${rVal}, ${gVal}, ${bVal})`;
    };

    return (
        <div
            onMouseDown={() => onCellClick(r, c)}
            onMouseEnter={() => onCellMouseEnter(r, c)}
            className={`w-6 h-6 rounded-sm relative group cursor-crosshair
                ${isObstacle ? 'scale-90 rounded-md shadow-inner bg-slate-700' : ''}`}
            style={{
                backgroundColor: !isObstacle ? getCellColor() : undefined,
                borderTop: (isMowed && cell.direction && cell.direction.dx !== 0) ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid transparent',
                borderBottom: (isMowed && cell.direction && cell.direction.dx !== 0) ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid transparent',
                borderLeft: (isMowed && cell.direction && cell.direction.dy !== 0) ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid transparent',
                borderRight: (isMowed && cell.direction && cell.direction.dy !== 0) ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid transparent',
            }}
        >
            {/* Mower Visual */}
            {isMower && (
                <div className="absolute inset-0 bg-amber-400 rounded-md shadow-[0_0_25px_rgba(251,191,36,1)] z-20 flex items-center justify-center scale-125 border-2 border-amber-300">
                    <div className="w-1.5 h-1.5 bg-black/30 rounded-full animate-ping"></div>
                </div>
            )}
            
            {/* Dock Visual */}
            {isDock && !isMower && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="w-2.5 h-2.5 bg-white/70 rounded-full animate-pulse shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>
                    <div className="absolute inset-0 border-2 border-white/20 rounded-sm scale-75"></div>
                </div>
            )}
            
            {/* Damage Indicator - Optimized to single div with pattern */}
            {isMowed && !isMower && cell.damage > 0 && (
                <div 
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{
                        backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%, transparent)',
                        backgroundSize: '4px 4px'
                    }}
                />
            )}

            {!isMower && (
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors pointer-events-none"></div>
            )}
        </div>
    );
});

interface GridProps {
    grid: GridType;
    mowerPos: Position;
    isAiLoading: boolean;
    onCellClick: (r: number, c: number) => void;
    onCellMouseEnter: (r: number, c: number) => void;
    onMouseDown: () => void;
}

export const SimulationGrid: React.FC<GridProps> = ({
    grid,
    mowerPos,
    isAiLoading,
    onCellClick,
    onCellMouseEnter,
    onMouseDown
}) => {
    return (
        <div 
            className={`grid gap-[2px] bg-slate-900 p-4 rounded-[2.5rem] shadow-2xl border border-slate-800/50 overflow-hidden transition-opacity duration-500 relative
                ${isAiLoading ? 'opacity-40 scale-95 grayscale' : 'opacity-100'}`}
            onMouseDown={onMouseDown}
        >
            {grid.map((row, r) => (
                <div key={r} className="flex gap-[2px]">
                    {row.map((cell, c) => (
                        <MemoizedCell
                            key={`${r}-${c}`}
                            r={r}
                            c={c}
                            cell={cell}
                            isMower={mowerPos.x === c && mowerPos.y === r}
                            isDock={cell.type === CELL_TYPES.DOCK}
                            onCellClick={onCellClick}
                            onCellMouseEnter={onCellMouseEnter}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
};

