import { useState, useCallback, useRef } from 'react';

export const useAppUI = () => {
    const [statusMessage, setStatusMessage] = useState("Ready for work");
    const [toasts, setToasts] = useState<any[]>([]);
    const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const toastIdCounter = useRef(0);
    const showToast = useCallback((msg: string, type: string = 'success') => {
        const id = ++toastIdCounter.current;
        setToasts(prev => [...prev, { id, msg, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    return {
        statusMessage, setStatusMessage,
        toasts, showToast,
        isAnalysisOpen, setIsAnalysisOpen,
        isSettingsOpen, setIsSettingsOpen
    };
};
