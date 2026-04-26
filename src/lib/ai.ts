/**
 * src/lib/ai.ts
 *
 * Provider-agnostic via the Vercel AI SDK.
 * Switch models entirely through env vars — no code changes needed.
 *
 *   AI_MODEL=gpt-4o                             -> OpenAI
 *   AI_MODEL=claude-sonnet-4-5                  -> Anthropic
 *   AI_MODEL=gemini-2.5-flash                   -> Google
 *   AI_MODEL=groq:llama-3.1-70b-versatile       -> Groq
 *   AI_MODEL=openrouter:mistralai/mistral-large -> OpenRouter
 *   AI_MODEL=llama3 + AI_BASE_URL=http://localhost:11434/v1 -> Ollama
 *
 *   AI_API_KEY=<key for the chosen provider>
 *
 * Install adapters for whichever providers you need:
 *   npm install ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google @ai-sdk/groq
 */

import { generateText, LanguageModel } from "ai";
import { google } from "@ai-sdk/google";

async function callModel(systemPrompt: string, userPrompt: string): Promise<string> {
    const { text } = await generateText({
        model: google("gemma-4-31b-it"),
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.1,
    });
    return text;
}

// ---- public interface ------------------------------------------------------

export async function generateJSON<T>(prompt: string, retries = 3): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const raw = await callModel(
                "Return only valid JSON with no explanation and no markdown fences.",
                prompt
            );
            return extractJSON<T>(raw);
        } catch (err) {
            lastError = err as Error;
            console.warn(`generateJSON attempt ${attempt}/${retries} failed:`, (err as Error).message);
            if (attempt < retries) await sleep(500 * attempt);
        }
    }

    throw new Error(`generateJSON failed after ${retries} attempts. Last: ${lastError?.message}`);
}

// ---- JSON extraction + repair ----------------------------------------------

export function extractJSON<T>(text: string): T {
    try { return JSON.parse(text) as T; } catch { }

    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) { try { return JSON.parse(repair(fenced[1].trim())) as T; } catch { } }

    const arr = text.match(/\[[\s\S]*\]/);
    if (arr) { try { return JSON.parse(repair(arr[0])) as T; } catch { } }

    const obj = text.match(/\{[\s\S]*\}/);
    if (obj) { try { return JSON.parse(repair(obj[0])) as T; } catch { } }

    throw new Error("Could not extract JSON from response. Raw: " + text.slice(0, 300));
}

function repair(text: string): string {
    return text
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/[\u201C\u201D\u201E]/g, '"')
        .replace(/[\u2018\u2019\u201A]/g, "'")
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
        .replace(/"([^"]*?)\n([^"]*?)"/g, (_, a, b) => `"${a} ${b}"`);
}

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}