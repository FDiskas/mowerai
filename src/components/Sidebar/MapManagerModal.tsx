import { useState, useEffect, memo } from 'react';
import { Button } from '../ui/Button';
import type { Grid as GridType } from '../../types';

interface SavedMap {
    id: string;
    name: string;
    cols: number;
    rows: number;
    dockPos: { x: number; y: number };
    cells: GridType;
}

interface MapManagerModalProps {
    isOpen: boolean;
    mode: 'save' | 'load';
    onClose: () => void;
    currentGrid: GridType;
    gridSize: { cols: number; rows: number };
    dockPos: { x: number; y: number };
    onLoadMap: (cells: GridType, cols: number, rows: number, dockPos: { x: number; y: number }) => void;
    showToast: (msg: string, type?: string) => void;
}

const STORAGE_KEY = 'mowerai_custom_maps';

export const MapManagerModal = memo<MapManagerModalProps>((props) => {
    const [mapName, setMapName] = useState('');
    const [savedMaps, setSavedMaps] = useState<SavedMap[]>([]);

    // Load custom maps from localStorage when the modal opens
    useEffect(() => {
        if (props.isOpen) {
            try {
                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored) {
                    setSavedMaps(JSON.parse(stored));
                } else {
                    setSavedMaps([]);
                }
            } catch (e) {
                console.error("Failed to load custom maps from localStorage", e);
                props.showToast("Failed to load maps list", 'error');
            }
            setMapName('');
        }
    }, [props.isOpen]);

    if (!props.isOpen) return null;

    const handleSave = () => {
        const trimmedName = mapName.trim();
        if (!trimmedName) {
            props.showToast("Please enter a valid map name", 'error');
            return;
        }

        try {
            // Clean mowed trails from the cells before saving, so we save pristine grass/obstacles
            const cleanCells = props.currentGrid.map(row => row.map(cell => ({
                type: cell.type === 'mowed' ? 'grass' : cell.type,
                damage: 0,
                direction: null
            })));

            const newMap: SavedMap = {
                id: Date.now().toString(),
                name: trimmedName,
                cols: props.gridSize.cols,
                rows: props.gridSize.rows,
                dockPos: props.dockPos,
                cells: cleanCells
            };

            const updatedMaps = [...savedMaps.filter(m => m.name.toLowerCase() !== trimmedName.toLowerCase()), newMap];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedMaps));
            setSavedMaps(updatedMaps);
            props.showToast(`Map "${trimmedName}" saved successfully`, 'indigo');
            props.onClose();
        } catch (e) {
            console.error("Failed to save map", e);
            props.showToast("Failed to save map", 'error');
        }
    };

    const handleDelete = (id: string, name: string) => {
        try {
            const updatedMaps = savedMaps.filter(m => m.id !== id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedMaps));
            setSavedMaps(updatedMaps);
            props.showToast(`Map "${name}" deleted`);
        } catch (e) {
            console.error("Failed to delete map", e);
            props.showToast("Failed to delete map", 'error');
        }
    };

    const handleLoad = (map: SavedMap) => {
        props.onLoadMap(map.cells, map.cols, map.rows, map.dockPos);
        props.showToast(`Loaded map "${map.name}"`, 'indigo');
        props.onClose();
    };

    return (
        <div className="modal-backdrop" onClick={props.onClose}>
            <div className="modal-content border border-slate-700/50 max-w-md flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                            {props.mode === 'save' ? 'Save Map Layout' : 'Load Map Layout'}
                        </h2>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">
                            {props.mode === 'save' ? 'Store current terrain layout' : 'Select a saved map to load'}
                        </p>
                    </div>
                    <button 
                        onClick={props.onClose} 
                        className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 text-slate-500 hover:text-white transition-colors text-2xl flex items-center justify-center cursor-pointer"
                    >
                        &times;
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-6 bg-slate-950/50 p-6 rounded-[2rem] border border-slate-800 shadow-inner min-h-[200px]">
                    {props.mode === 'save' ? (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="map-save-name" className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block text-left ml-1 cursor-pointer">
                                    Map Name
                                </label>
                                <input
                                    id="map-save-name"
                                    name="map-save-name"
                                    type="text"
                                    placeholder="Enter map name..."
                                    value={mapName}
                                    onChange={e => setMapName(e.target.value)}
                                    maxLength={30}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs outline-none focus:border-emerald-500 transition-all text-center text-slate-200"
                                    autoFocus
                                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                                />
                            </div>
                            <div className="text-[10px] text-slate-500 text-center">
                                Grid Size: {props.gridSize.cols}x{props.gridSize.rows} | Charger Dock: ({props.dockPos.x}, {props.dockPos.y})
                            </div>
                            <div className="pt-4">
                                <Button variant="primary" size="lg" fullWidth onClick={handleSave}>
                                    SAVE CURRENT MAP
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {savedMaps.length === 0 ? (
                                <div className="py-12 text-center text-slate-500 text-xs">
                                    No saved maps found. Save your current layout first!
                                </div>
                            ) : (
                                <div className="space-y-3.5">
                                    {savedMaps.map(map => (
                                        <div 
                                            key={map.id} 
                                            className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/40 border border-slate-800 hover:border-slate-700/50 transition-all duration-300"
                                        >
                                            <div className="text-left space-y-1">
                                                <div className="text-xs font-bold text-slate-200 truncate max-w-[180px]">{map.name}</div>
                                                <div className="text-[9px] text-slate-500 font-mono">
                                                    Grid: {map.cols}x{map.rows} | Dock: ({map.dockPos.x}, {map.dockPos.y})
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleLoad(map)}
                                                    className="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-emerald-950 text-[10px] font-black tracking-widest transition-all duration-200 cursor-pointer"
                                                >
                                                    LOAD
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(map.id, map.name)}
                                                    className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all duration-200 cursor-pointer"
                                                    title="Delete preset"
                                                >
                                                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="mt-6">
                    <Button variant="secondary" size="md" fullWidth onClick={props.onClose}>
                        CLOSE
                    </Button>
                </div>
            </div>
        </div>
    );
});

MapManagerModal.displayName = 'MapManagerModal';
