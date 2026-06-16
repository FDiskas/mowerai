import React, { useId } from 'react';

interface SliderProps {
    label: string;
    value: number | string;
    min: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
    disabled?: boolean;
    suffix?: string;
}

export const Slider: React.FC<SliderProps> = ({
    label,
    value,
    min,
    max,
    step = 1,
    onChange,
    disabled = false,
    suffix = '',
}) => {
    const id = useId();

    return (
        <div className="space-y-1.5 group">
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                <label htmlFor={id} className="text-slate-500 group-hover:text-slate-400 transition-colors cursor-pointer">{label}</label>
                <span className="text-emerald-400 font-mono">{value}{suffix}</span>
            </div>
            <input
                id={id}
                name={id}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                disabled={disabled}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            />
        </div>
    );
};

