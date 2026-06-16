import { memo } from 'react';

export const Footer = memo(() => {
    return (
        <footer className="w-full mt-8 mb-4 flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4
            rounded-[1.5rem] bg-slate-900/40 border border-white/5 backdrop-blur-xl
            shadow-[0_8px_32px_-12px_rgba(0,0,0,0.5)] transition-all duration-300">

            {/* Left side: Copyright */}
            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500 tracking-wider">
                <span className="font-display font-bold text-slate-400 hover:text-emerald-400 transition-colors duration-200 cursor-default">
                    &copy;oders {new Date().getFullYear()}
                </span>
                <span className="hidden sm:inline text-slate-600">|</span>
                <span className="hidden sm:inline">Lawn Care Simulator</span>
            </div>

            {/* Right side: GitHub link */}
            <a
                href="https://github.com/FDiskas/mowerai"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/40 border border-white/5 
                    text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/5 
                    transition-all duration-300 group shadow-inner"
            >
                <svg
                    viewBox="0 0 24 24"
                    className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 group-hover:scale-110 transition-all duration-300"
                    fill="currentColor"
                >
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482C19.138 20.197 22 16.44 22 12.017 22 6.484 17.522 2 12 2z" />
                </svg>
                <span className="text-[11px] font-semibold tracking-wide">GitHub</span>
            </a>
        </footer>
    );
});

Footer.displayName = 'Footer';
