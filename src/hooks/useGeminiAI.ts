import { useState, useCallback } from 'react';
import { CELL_TYPES } from '../constants';
import { GoogleGenAI } from "@google/genai";
import type { Grid } from '../types';

export const useGeminiAI = () => {
    const [aiPrompt, setAiPrompt] = useState("");
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiFeedback, setAiFeedback] = useState("");

    // Cache models to avoid repeated listing calls
    const [cachedModels, setCachedModels] = useState<string[]>([]);

    const callGemini = useCallback(async (prompt: string, systemPrompt: string, isJson = false) => {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
        if (!apiKey) throw new Error("API key missing. Add VITE_GEMINI_API_KEY to .env file.");

        const ai = new GoogleGenAI({ apiKey });
        
        let modelsToTry = cachedModels;
        
        if (modelsToTry.length === 0) {
            try {
                const resp = await ai.models.list();
                const raw = (resp as any).pageInternal || [];
                modelsToTry = raw
                    .filter((m: any) => m.supportedActions.includes("generateContent"))
                    .map((m: any) => m.name)
                    .sort((a: string, b: string) => {
                        const score = (name: string) => {
                            let s = 10;
                            if (name.includes("lite")) s = 1;
                            else if (name.includes("flash")) s = 2;
                            else if (name.includes("pro")) s = 3;
                            
                            // Prefer latest/stable over previews/dated versions
                            if (name.includes("latest")) s -= 0.5;
                            if (name.includes("preview")) s += 0.5;
                            return s;
                        };
                        return score(a) - score(b);
                    });
                setCachedModels(modelsToTry);
            } catch (e) {
                console.warn("Could not list models, using fallback", e);
                modelsToTry = ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-1.5-flash"];
            }
        }

        let lastError: any = null;
        for (const modelName of modelsToTry) {
            try {
                const result = await ai.models.generateContent({
                    model: modelName,
                    contents: prompt,
                    config: {
                        systemInstruction: systemPrompt,
                        responseMimeType: isJson ? "application/json" : undefined
                    }
                });
                return result.text;
            } catch (err: any) {
                lastError = err;
                const errorText = JSON.stringify(err);
                const isBusy = errorText.includes("503") || 
                               errorText.includes("429") || 
                               errorText.includes("high demand") || 
                               errorText.includes("UNAVAILABLE") ||
                               errorText.includes("RESOURCE_EXHAUSTED");
                
                if (isBusy) {
                    console.warn(`✨ Model ${modelName} is busy or quota exceeded, trying another...`);
                    setAiFeedback(`✨ Quota exceeded (${modelName}), trying another...`);
                    continue;
                }
                throw err; // Stop if it's a different error (like 401, 400)
            }
        }
        throw lastError || new Error("Failed to find a free AI model.");
    }, [cachedModels]);

    const generateAiPattern = useCallback(async (dockPos: {x: number, y: number}, applyGrid: (newGrid: Grid) => void) => {
        if (!aiPrompt) return;
        setIsAiLoading(true);
        setAiFeedback("✨ Generating design...");
        const systemPrompt = `You are a lawn designer. Create a 20x25 grid (20 rows, 25 columns). 0 - grass, 1 - obstacle. The dock is at (${dockPos.x}, ${dockPos.y}), it must be 0 there. Return JSON: { "grid": [[...], ...] }. Request: ${aiPrompt}`;
        try {
            const resultText = await callGemini("Generate grid", systemPrompt, true);
            if (!resultText) throw new Error("No AI response");
            const aiData = JSON.parse(resultText);
            const newGrid = aiData.grid.map((row: number[], r: number) => row.map((val: number, c: number) => ({
                type: (r === dockPos.y && c === dockPos.x) ? CELL_TYPES.DOCK : (val === 1 ? CELL_TYPES.OBSTACLE : CELL_TYPES.GRASS),
                damage: 0,
                direction: null
            })));
            applyGrid(newGrid);
            setAiFeedback("✨ Design ready!");
        } catch (err) {
            console.error("AI Generation Error:", err);
            setAiFeedback("❌ Error generating.");
        } finally { setIsAiLoading(false); }
    }, [aiPrompt, callGemini]);

    const analyzeTerrain = useCallback(async (grid: Grid) => {
        setIsAiLoading(true);
        const flatGrid = grid.map(row => row.map((c: any) => c.type === CELL_TYPES.OBSTACLE ? "X" : (c.type === CELL_TYPES.DOCK ? "H" : ".")).join("")).join("\n");
        const prompt = `Analyze the grid (X-obstacle, .-grass, H-dock). Which algorithm is better? Answer briefly in English US.\n${flatGrid}`;
        try {
            const feedback = await callGemini(prompt, "You are a lawn mowing expert.");
            setAiFeedback(String(feedback));
        } catch (err) { 
            console.error("AI Analysis Error:", err);
            setAiFeedback("❌ Analysis error."); 
        } finally { setIsAiLoading(false); }
    }, [callGemini]);

    return { aiPrompt, setAiPrompt, isAiLoading, aiFeedback, generateAiPattern, analyzeTerrain };
};
