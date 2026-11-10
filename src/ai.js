// Sample GenAI endpoint - template to adapt during the live coding part.
import { Router } from 'express';
import { complete } from './llm.js';

export const aiRouter = Router();

// POST /ai/summarize { "text": "..." } -> { summary, keyPoints[], sentiment }
aiRouter.post('/summarize', async (req, res) => {
  const { text } = req.body ?? {};
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: '"text" (non-empty string) is required' });
  }

  try {
    const out = await complete({
      system: 'You are a precise summarization assistant. Use only facts present in the input.',
      prompt: `Summarize the text below.
Return JSON exactly matching: {"summary": string, "keyPoints": string[], "sentiment": "positive"|"neutral"|"negative"}

<text>
${text}
</text>`,
      json: true,
      temperature: 0,
    });

    // Validate the model output - never trust it blindly
    if (typeof out?.summary !== 'string' || !Array.isArray(out?.keyPoints)) {
      return res.status(502).json({ error: 'LLM returned unexpected shape', raw: out });
    }
    return res.json(out);
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: 'LLM call failed', detail: err.message });
  }
});
