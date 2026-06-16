import React, { memo, useMemo, useRef } from 'react';
import type { Grid as GridType, PositionType as Position, Direction } from '../../types';
import { CELL_TYPES } from '../../constants';

/** Rendered cell size in px (matches the w-6 / h-6 = 24px cells). */
const CELL_PX = 24;

type ObsToken = 'rock' | 'bush' | 'tree' | 'hedge' | 'stone' | 'covered';

interface Overlay {
    key: string;
    left: number;
    top: number;
    w: number;
    h: number;
    kind: 'canopy-tree' | 'canopy-bush' | 'building';
}

interface AnalysisResult {
    tokens: (ObsToken | null)[][];
    overlays: Overlay[];
}

const hashAt = (r: number, c: number) => Math.abs((r * 73856093) ^ (c * 19349663) ^ ((r + c) * 83492791));

/**
 * Classify connected obstacle groups so they render contextually:
 *  - single cell      -> rock / bush / tree
 *  - straight line    -> hedge / fence
 *  - small 2x2 blob   -> one big tree or bush
 *  - large footprint  -> stone-walled building / foundation
 */
const analyzeObstacles = (grid: GridType): AnalysisResult => {
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;
    const tokens: (ObsToken | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null));
    const overlays: Overlay[] = [];
    const seen: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
    const isObs = (r: number, c: number) =>
        r >= 0 && r < rows && c >= 0 && c < cols && grid[r][c].type === CELL_TYPES.OBSTACLE;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!isObs(r, c) || seen[r][c]) continue;

            // BFS the connected component (4-connectivity)
            const cells: { r: number; c: number }[] = [];
            const stack = [{ r, c }];
            seen[r][c] = true;
            let minR = r, maxR = r, minC = c, maxC = c;
            while (stack.length) {
                const cur = stack.pop()!;
                cells.push(cur);
                minR = Math.min(minR, cur.r); maxR = Math.max(maxR, cur.r);
                minC = Math.min(minC, cur.c); maxC = Math.max(maxC, cur.c);
                const nb = [[cur.r - 1, cur.c], [cur.r + 1, cur.c], [cur.r, cur.c - 1], [cur.r, cur.c + 1]];
                for (const [nr, nc] of nb) {
                    if (isObs(nr, nc) && !seen[nr][nc]) { seen[nr][nc] = true; stack.push({ r: nr, c: nc }); }
                }
            }

            const w = maxC - minC + 1;
            const h = maxR - minR + 1;
            const count = cells.length;
            const isRect = count === w * h;
            const isLine = Math.min(w, h) === 1 && count >= 2;
            const big = count >= 6 || (w >= 3 && h >= 3);
            const hash = hashAt(minR, minC);

            if (count === 1) {
                const v = hash % 100;
                tokens[r][c] = v < 48 ? 'rock' : v < 82 ? 'bush' : 'tree';
            } else if (isLine) {
                cells.forEach(p => { tokens[p.r][p.c] = 'hedge'; });
            } else if (big) {
                if (isRect) {
                    cells.forEach(p => { tokens[p.r][p.c] = 'covered'; });
                    overlays.push({ key: `b-${minR}-${minC}`, left: minC * CELL_PX, top: minR * CELL_PX, w: w * CELL_PX, h: h * CELL_PX, kind: 'building' });
                } else {
                    cells.forEach(p => { tokens[p.r][p.c] = 'stone'; });
                }
            } else {
                // small compact cluster -> one big tree / bush
                if (isRect) {
                    cells.forEach(p => { tokens[p.r][p.c] = 'covered'; });
                    overlays.push({ key: `g-${minR}-${minC}`, left: minC * CELL_PX, top: minR * CELL_PX, w: w * CELL_PX, h: h * CELL_PX, kind: hash % 2 ? 'canopy-tree' : 'canopy-bush' });
                } else {
                    cells.forEach((p, i) => { tokens[p.r][p.c] = (hashAt(p.r, p.c) + i) % 3 === 0 ? 'tree' : 'bush'; });
                }
            }
        }
    }
    return { tokens, overlays };
};

/** Cut-grass colour: fresh green -> worn khaki -> brown as a tile is run over repeatedly. */
const mownColor = (damage: number) => {
    const t = Math.min(1, damage / 1.2);
    const fresh = [122, 178, 86], worn = [150, 132, 66], dead = [120, 86, 48];
    const a = t < 0.5 ? fresh : worn;
    const b = t < 0.5 ? worn : dead;
    const k = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
    const m = (i: number) => Math.round(a[i] + (b[i] - a[i]) * k);
    return `rgb(${m(0)}, ${m(1)}, ${m(2)})`;
};

const getPathDefinition = (
    hasLeft: boolean,
    hasRight: boolean,
    hasTop: boolean,
    hasBottom: boolean
): string => {
    const count = [hasLeft, hasRight, hasTop, hasBottom].filter(Boolean).length;

    if (count === 2) {
        if (hasLeft && hasRight) return 'M 0 12 L 24 12';
        if (hasTop && hasBottom) return 'M 12 0 L 12 24';
        if (hasLeft && hasBottom) return 'M 0 12 Q 12 12, 12 24';
        if (hasLeft && hasTop) return 'M 0 12 Q 12 12, 12 0';
        if (hasRight && hasBottom) return 'M 24 12 Q 12 12, 12 24';
        if (hasRight && hasTop) return 'M 24 12 Q 12 12, 12 0';
    }

    const paths = [];
    if (hasLeft) paths.push('M 0 12 L 12 12');
    if (hasRight) paths.push('M 24 12 L 12 12');
    if (hasTop) paths.push('M 12 0 L 12 12');
    if (hasBottom) paths.push('M 12 24 L 12 12');

    return paths.join(' ');
};

interface CellProps {
    r: number;
    c: number;
    cell: any;
    isMower: boolean;
    isDock: boolean;
    obs: ObsToken | null;
    hasLeft: boolean;
    hasRight: boolean;
    hasTop: boolean;
    hasBottom: boolean;
    onCellClick?: (r: number, c: number) => void;
    onCellMouseEnter?: (r: number, c: number) => void;
}

const MemoizedCell = memo(({ r, c, cell, isMower, isDock, obs, hasLeft, hasRight, hasTop, hasBottom, onCellClick, onCellMouseEnter }: CellProps) => {
    const isMowed = cell.type === CELL_TYPES.MOWED;
    const d = getPathDefinition(hasLeft, hasRight, hasTop, hasBottom);

    return (
        <div
            onMouseDown={() => onCellClick?.(r, c)}
            onMouseEnter={() => onCellMouseEnter?.(r, c)}
            className="w-6 h-6 relative group cursor-crosshair"
        >
            {/* Mown grass: cut shade + directional stripes + multi-pass wear */}
            {isMowed && (
                <>
                    <div className="mown-base" style={{ background: mownColor(cell.damage || 0) }} />
                    <div className={cell.direction && cell.direction.dx !== 0 ? 'mown-stripe-h' : 'mown-stripe-v'} />
                    {cell.damage > 0 && (
                        <div className="mown-wear" style={{ opacity: Math.min(0.55, cell.damage * 0.4) }} />
                    )}
                    {/* overlap: mower drove over already-cut grass — flagged so repeats are obvious */}
                    {(cell.passes || 0) >= 2 && (
                        <div className="mown-overlap" style={{ opacity: Math.min(0.9, 0.4 + ((cell.passes || 2) - 2) * 0.2) }} />
                    )}
                    <div className="trail">
                        <svg
                            key={`${cell.damage}-${cell.direction?.dx ?? 0}-${cell.direction?.dy ?? 0}`}
                            className="trail-svg"
                            viewBox="0 0 24 24"
                        >
                            {d && (
                                <path
                                    d={d}
                                    fill="none"
                                    stroke="rgba(34, 211, 238, 0.35)"
                                    strokeWidth="7"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="trail-glow"
                                />
                            )}
                            {d && (
                                <path
                                    d={d}
                                    fill="none"
                                    stroke="#2af0ff"
                                    strokeWidth="3.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="trail-core"
                                />
                            )}
                            <circle
                                cx="12"
                                cy="12"
                                r="3.5"
                                fill="#2af0ff"
                                stroke="#ffffff"
                                strokeWidth="1"
                                className="trail-node"
                            />
                        </svg>
                    </div>
                </>
            )}

            {/* Obstacles */}
            {obs === 'hedge' && <div className="obs-hedge" />}
            {obs === 'stone' && <div className="obs-stone" />}
            {(obs === 'rock' || obs === 'bush' || obs === 'tree') && (
                <div className="obstacle"><div className={`obs-${obs}`} /></div>
            )}

            {/* Charging station */}
            {isDock && !isMower && (
                <div className="dock-pad">
                    <div className="dock-pad-inner">
                        <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
                            <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
                        </svg>
                    </div>
                </div>
            )}

            {/* Hover affordance (editable cells only) */}
            {!isMower && !obs && (
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/15 transition-colors pointer-events-none" />
            )}
        </div>
    );
});

interface GridProps {
    grid: GridType;
    mowerPos: Position;
    mowerDir?: Direction;
    isAiLoading: boolean;
    onCellClick?: (r: number, c: number) => void;
    onCellMouseEnter?: (r: number, c: number) => void;
    onMouseDown: () => void;
    onResize?: (cols: number, rows: number) => void;
}

export const SimulationGrid: React.FC<GridProps> = ({
    grid,
    mowerPos,
    mowerDir,
    isAiLoading,
    onCellClick,
    onCellMouseEnter,
    onMouseDown,
    onResize
}) => {
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;

    // Recompute obstacle layout only when the obstacle footprint changes.
    const obsSig = grid.map(row => row.map(c => (c.type === CELL_TYPES.OBSTACLE ? '1' : '0')).join('')).join('|');
    const { tokens, overlays } = useMemo(() => analyzeObstacles(grid), [obsSig]); // eslint-disable-line react-hooks/exhaustive-deps

    // Mower heading -> rotation (sprite drawn facing right = +x).
    const dir = mowerDir && (mowerDir.dx !== 0 || mowerDir.dy !== 0) ? mowerDir : { dx: 0, dy: 1 };
    const angle = Math.atan2(dir.dy, dir.dx) * (180 / Math.PI);
    const mowerW = CELL_PX * 1.9;
    const mowerH = CELL_PX * 1.3;

    const dragState = useRef<{ x: number; y: number; cols: number; rows: number; lc: number; lr: number } | null>(null);

    const onResizeStart = (e: React.PointerEvent) => {
        if (!onResize) return;
        e.preventDefault();
        dragState.current = { x: e.clientX, y: e.clientY, cols, rows, lc: cols, lr: rows };

        const onMove = (ev: PointerEvent) => {
            const s = dragState.current;
            if (!s) return;
            const nc = Math.max(8, Math.min(60, s.cols + Math.round((ev.clientX - s.x) / CELL_PX)));
            const nr = Math.max(8, Math.min(48, s.rows + Math.round((ev.clientY - s.y) / CELL_PX)));
            if (nc !== s.lc || nr !== s.lr) { s.lc = nc; s.lr = nr; onResize(nc, nr); }
        };
        const onUp = () => {
            dragState.current = null;
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    return (
        <div className="relative inline-block">
            <div
                className={`lawn-field inline-block p-3 rounded-[2rem] border border-white/10 ring-1 ring-black/40
                    shadow-[0_30px_70px_-20px_rgba(0,0,0,0.8)] overflow-hidden transition-all duration-500 relative
                    ${isAiLoading ? 'opacity-50 scale-95 grayscale' : 'opacity-100'}`}
                onMouseDown={onMouseDown}
            >
                {/* padding-free positioning context so px-based overlays align with cells */}
                <div className="relative field-grid">
                    {grid.map((row, r) => (
                        <div key={r} className="flex">
                            {row.map((cell, c) => {
                                const isMowed = cell.type === CELL_TYPES.MOWED;
                                let hasLeft = isMowed && (
                                    (cell.direction?.dx === -1 && cell.direction?.dy === 0) ||
                                    (c > 0 && grid[r][c - 1]?.direction?.dx === 1 && grid[r][c - 1]?.direction?.dy === 0)
                                );
                                let hasRight = isMowed && (
                                    (cell.direction?.dx === 1 && cell.direction?.dy === 0) ||
                                    (c < cols - 1 && grid[r][c + 1]?.direction?.dx === -1 && grid[r][c + 1]?.direction?.dy === 0)
                                );
                                let hasTop = isMowed && (
                                    (cell.direction?.dx === 0 && cell.direction?.dy === -1) ||
                                    (r > 0 && grid[r - 1][c]?.direction?.dx === 0 && grid[r - 1][c]?.direction?.dy === 1)
                                );
                                let hasBottom = isMowed && (
                                    (cell.direction?.dx === 0 && cell.direction?.dy === 1) ||
                                    (r < rows - 1 && grid[r + 1][c]?.direction?.dx === 0 && grid[r + 1][c]?.direction?.dy === -1)
                                );

                                // Filter out redundant stubs from previous perpendicular passes
                                const isVerticalDir = cell.direction?.dy !== 0;

                                if (hasLeft && hasRight && hasTop && hasBottom) {
                                    if (isVerticalDir) {
                                        hasLeft = false;
                                        hasRight = false;
                                    } else {
                                        hasTop = false;
                                        hasBottom = false;
                                    }
                                } else if (hasLeft && hasRight) {
                                    hasTop = false;
                                    hasBottom = false;
                                } else if (hasTop && hasBottom) {
                                    hasLeft = false;
                                    hasRight = false;
                                }

                                return (
                                    <MemoizedCell
                                        key={`${r}-${c}`}
                                        r={r}
                                        c={c}
                                        cell={cell}
                                        isMower={mowerPos.x === c && mowerPos.y === r}
                                        isDock={cell.type === CELL_TYPES.DOCK}
                                        obs={tokens[r]?.[c] ?? null}
                                        hasLeft={hasLeft}
                                        hasRight={hasRight}
                                        hasTop={hasTop}
                                        hasBottom={hasBottom}
                                        onCellClick={onCellClick}
                                        onCellMouseEnter={onCellMouseEnter}
                                    />
                                );
                            })}
                        </div>
                    ))}

                    {/* Large connected obstacles (trees, bushes, buildings) */}
                    {overlays.map(o => (
                        <div
                            key={o.key}
                            className={`obs-overlay ${o.kind}`}
                            style={{ left: o.left, top: o.top, width: o.w, height: o.h }}
                        />
                    ))}

                    {/* Robot mower — larger than a cell, rotated to its heading */}
                    <div
                        className="mower"
                        style={{
                            left: mowerPos.x * CELL_PX + CELL_PX / 2,
                            top: mowerPos.y * CELL_PX + CELL_PX / 2,
                            width: mowerW,
                            height: mowerH,
                            transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                        }}
                    >
                        <div className="mower-halo" />
                        <div className="mower-body">
                            <div className="mower-wheel top" />
                            <div className="mower-wheel bottom" />
                            <div className="mower-back" />
                            <div className="mower-front" />
                        </div>
                    </div>
                </div>

                {/* Drag-to-resize handle */}
                {onResize && (
                    <div className="resize-handle" onPointerDown={onResizeStart} title="Drag to resize the lawn">
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                            <path d="M20 9 9 20M20 15l-5 5" />
                        </svg>
                    </div>
                )}
            </div>

            <div className="text-center text-[11px] font-medium text-slate-500 tracking-widest mt-3 font-display">
                {cols}×{rows}
            </div>
        </div>
    );
};
