import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'indigo';
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
    children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    className = '',
    children,
    ...props
}) => {
    const baseStyles = 'font-black tracking-widest transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl flex items-center justify-center gap-2';
    
    const variants = {
        primary: 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20',
        secondary: 'bg-blue-600 text-blue-50 hover:bg-blue-500 shadow-lg shadow-blue-500/20',
        danger: 'bg-rose-600 text-white hover:bg-rose-500 shadow-lg shadow-rose-600/20',
        indigo: 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20',
        ghost: 'bg-transparent text-slate-400 hover:text-white hover:bg-slate-800',
        outline: 'bg-transparent border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white',
    };

    const sizes = {
        sm: 'py-2 px-4 text-[10px]',
        md: 'py-2.5 px-6 text-xs',
        lg: 'py-3 px-8 text-sm',
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};
