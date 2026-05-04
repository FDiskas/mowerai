import { useState } from 'react';
import { CELL_TYPES } from '../constants';
import { GoogleGenAI } from "@google/genai";

export const useGeminiAI = () => {
    const [aiPrompt, setAiPrompt] = useState("");
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiFeedback, setAiFeedback] = useState("");

    const callGemini = async (prompt: string, systemPrompt: string, isJson = false) => {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
        if (!apiKey) throw new Error("API key missing. Pridėkite VITE_GEMINI_API_KEY į .env failą.");

        const ai = new GoogleGenAI({ apiKey });
        
        const response = await ai.models.generateContent({
            model: "gemini-flash-latest",
            contents: prompt,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: isJson ? "application/json" : undefined
            }
        });
        
        return response.text;
    };

    const generateAiPattern = async (dockPos: {x: number, y: number}, applyGrid: (newGrid: any[]) => void) => {
        if (!aiPrompt) return;
        setIsAiLoading(true);
        setAiFeedback("✨ Generuojamas dizainas...");
        const systemPrompt = `Tu esi vejos dizaineris. Sukurk 20x25 tinklelį (20 eilučių, 25 stulpeliai). 0 - žolė, 1 - kliūtis. Stotelė yra (${dockPos.x}, ${dockPos.y}), ten privalo būti 0. Grąžink JSON: { "grid": [[...], ...] }. Užklausa: ${aiPrompt}`;
        try {
            const resultText = await callGemini("Generate grid", systemPrompt, true);
            const aiData = JSON.parse(resultText);
            const newGrid = aiData.grid.map((row: number[], r: number) => row.map((val: number, c: number) => ({
                type: (r === dockPos.y && c === dockPos.x) ? CELL_TYPES.DOCK : (val === 1 ? CELL_TYPES.OBSTACLE : CELL_TYPES.GRASS),
                damage: 0
            })));
            applyGrid(newGrid);
            setAiFeedback("✨ Dizainas paruoštas!");
        } catch (err) {
            console.error("AI Generation Error:", err);
            setAiFeedback("❌ Klaida generuojant.");
        } finally { setIsAiLoading(false); }
    };

    const analyzeTerrain = async (grid: any[]) => {
        setIsAiLoading(true);
        const flatGrid = grid.map(row => row.map(c => c.type === CELL_TYPES.OBSTACLE ? "X" : (c.type === CELL_TYPES.DOCK ? "H" : ".")).join("")).join("\n");
        const prompt = `Išanalizuok tinklelį (X-kliūtis, .-žolė, H-stotelė). Kuris algoritmas geresnis? Atsakyk trumpai lietuviškai.\n${flatGrid}`;
        try {
            const feedback = await callGemini(prompt, "Tu esi žolės pjovimo ekspertas.");
            setAiFeedback(String(feedback));
        } catch (err) { 
            console.error("AI Analysis Error:", err);
            setAiFeedback("❌ Analizės klaida."); 
        } finally { setIsAiLoading(false); }
    };

    return { aiPrompt, setAiPrompt, isAiLoading, aiFeedback, generateAiPattern, analyzeTerrain };
};
