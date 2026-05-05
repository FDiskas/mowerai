import { useState, useCallback } from 'react';
import { Mower } from '../domain/Mower';
import { SimulationGrid } from '../domain/SimulationGrid';
import { SimulationEnvironment } from '../domain/SimulationEnvironment';
import { Position } from '../domain/Position';
import { Battery } from '../domain/Battery';
import { NavigationState } from '../domain/NavigationState';
import { MovementMetrics, EfficiencyMetrics, ImpactMetrics, SimulationStats } from '../domain/SimulationStats';
import type { Grid as GridType, PositionType } from '../types';

import { SimulationHistory } from '../domain/SimulationHistory';

export const useSimulation = (initialGrid: GridType, dock: PositionType, maxBat: number) => {
    const [env, setEnv] = useState(() => new SimulationEnvironment(
        new Mower(new Battery(maxBat, maxBat), new NavigationState(Position.fromObject(dock), { dx: 0, dy: 1 })),
        new SimulationGrid(initialGrid),
        Position.fromObject(dock)
    ));

    const [stats, setStats] = useState(() => new SimulationStats(
        new MovementMetrics(0, 0),
        new EfficiencyMetrics(0, 0),
        new ImpactMetrics(0, 0)
    ));

    const [history, setHistory] = useState(() => new SimulationHistory());

    const reset = useCallback((grid: GridType, dockPos: PositionType, batteryVal: number) => {
        setEnv(new SimulationEnvironment(
            new Mower(new Battery(batteryVal, batteryVal), new NavigationState(Position.fromObject(dockPos), { dx: 0, dy: 1 })),
            new SimulationGrid(grid),
            Position.fromObject(dockPos)
        ));
        setStats(new SimulationStats(
            new MovementMetrics(0, 0),
            new EfficiencyMetrics(0, grid.flat().filter(c => c.type === 'grass').length),
            new ImpactMetrics(0, 0)
        ));
    }, []);

    return { env, setEnv, stats, setStats, history, setHistory, reset };
};
