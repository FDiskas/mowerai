import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    variant?: 'default' | 'glass' | 'outline';
}

export const Card: React.FC<CardProps> = ({ children, className = '', variant = 'default' }) => {
    const variants = {
        default: 'bg-slate-900 border-slate-800',
        glass: 'bg-slate-900/50 backdrop-blur-md border-slate-800 shadow-2xl',
        outline: 'bg-transparent border-slate-800',
    };

    return (
        <div className={`rounded-[2rem] border p-6 ${variants[variant]} ${className}`}>
            {children}
        </div>
    );
};
