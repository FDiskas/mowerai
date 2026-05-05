import { useState } from 'react';
import {
    CELL_TYPES,
    DEFAULT_MAX_BATTERY,
    DEFAULT_DRAIN_MOVE,
    DEFAULT_DRAIN_TURN
} from '../constants';

export const useAppSettings = () => {
    const [brushType, setBrushType] = useState<string>(CELL_TYPES.OBSTACLE);
    const [algo, setAlgo] = useState('smart_ai');
    const [orientation, setOrientation] = useState('vertical');
    const [speed, setSpeed] = useState(85);
    const [maxBattery, setMaxBattery] = useState(DEFAULT_MAX_BATTERY);
    const [drainMove, setDrainMove] = useState(DEFAULT_DRAIN_MOVE);
    const [drainTurn, setDrainTurn] = useState(DEFAULT_DRAIN_TURN);

    return {
        brushType, setBrushType,
        algo, setAlgo,
        orientation, setOrientation,
        speed, setSpeed,
        maxBattery, setMaxBattery,
        drainMove, setDrainMove,
        drainTurn, setDrainTurn
    };
};
