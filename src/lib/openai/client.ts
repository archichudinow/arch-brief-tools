import OpenAI from 'openai';

// Initialize OpenAI client
// API key should be in .env.local as VITE_OPENAI_API_KEY
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

export const openai = apiKey ? new OpenAI({
  apiKey,
  dangerouslyAllowBrowser: true, // For client-side usage
}) : null;

export function isOpenAIConfigured(): boolean {
  return !!apiKey;
}
