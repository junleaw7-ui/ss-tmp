import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { Triage, TriageNeed, TriageUrgency } from './types';

/**
 * Classifies a flood help message. Uses Gemini when GEMINI_API_KEY is set,
 * otherwise (or on any error/timeout) falls back to keyword rules.
 * Never throws. Server-only (reads GEMINI_API_KEY).
 */

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const TIMEOUT_MS = 8000;

const URGENCIES: TriageUrgency[] = ['critical', 'high', 'medium'];
const NEEDS: TriageNeed[] = ['rescue', 'medical', 'water', 'food', 'shelter', 'other'];

const SYSTEM_PROMPT =
  'You classify Malaysian flood help messages written in Bahasa Malaysia, English or Manglish. ' +
  'Return urgency (critical = life at risk now, e.g. rising water, trapped, drowning, roof; ' +
  'high = medical need or vulnerable person at risk; medium = supplies or other), ' +
  'the main need, the number of people mentioned (null if unknown), ' +
  'and a one-sentence English summary for a rescue coordinator.';

const RULES: { words: string[]; urgency: TriageUrgency; need: TriageNeed }[] = [
  { words: ['air naik', 'lemas', 'bumbung', 'roof', 'boat', 'bot', 'terperangkap', 'trapped', 'drown'], urgency: 'critical', need: 'rescue' },
  { words: ['ubat', 'sakit', 'medicine', 'demam', 'fever', 'sick', 'hospital'], urgency: 'high', need: 'medical' },
  { words: ['air bersih', 'clean water', 'minum'], urgency: 'medium', need: 'water' },
  { words: ['makanan', 'makan', 'food', 'susu'], urgency: 'medium', need: 'food' },
];

export function triageByRules(message: string): Triage {
  const text = message.toLowerCase();
  for (const rule of RULES) {
    if (rule.words.some((w) => text.includes(w))) {
      return { urgency: rule.urgency, need: rule.need, people: null, summary_en: message.slice(0, 160), source: 'rules' };
    }
  }
  return { urgency: 'medium', need: 'other', people: null, summary_en: message.slice(0, 160), source: 'rules' };
}

let client: GoogleGenAI | null = null;
let clientKey = '';
function getClient(apiKey: string): GoogleGenAI {
  if (!client || clientKey !== apiKey) {
    client = new GoogleGenAI({ apiKey });
    clientKey = apiKey;
  }
  return client;
}

async function triageWithGemini(message: string, apiKey: string): Promise<Triage> {
  const ai = getClient(apiKey);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: message,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            urgency: { type: Type.STRING, enum: URGENCIES },
            need: { type: Type.STRING, enum: NEEDS },
            people: { type: Type.INTEGER, nullable: true },
            summary_en: { type: Type.STRING },
          },
          required: ['urgency', 'need', 'summary_en'],
        },
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        abortSignal: controller.signal,
      },
    });
    const parsed = JSON.parse(res.text ?? '') as Record<string, unknown>;
    const urgency = URGENCIES.includes(parsed.urgency as TriageUrgency) ? (parsed.urgency as TriageUrgency) : null;
    const need = NEEDS.includes(parsed.need as TriageNeed) ? (parsed.need as TriageNeed) : null;
    if (!urgency || !need) throw new Error('bad_ai_shape');
    const people = typeof parsed.people === 'number' && Number.isFinite(parsed.people) ? Math.round(parsed.people) : null;
    const summary = typeof parsed.summary_en === 'string' ? parsed.summary_en.slice(0, 200) : message.slice(0, 160);
    return { urgency, need, people, summary_en: summary, source: 'ai' };
  } finally {
    clearTimeout(timer);
  }
}

export async function triage(message: string, opts?: { rulesOnly?: boolean }): Promise<Triage> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (opts?.rulesOnly || !apiKey) return triageByRules(message);
  try {
    return await triageWithGemini(message, apiKey);
  } catch (err) {
    console.warn('Gemini triage failed, using rules:', err instanceof Error ? err.message : err);
    return triageByRules(message);
  }
}
