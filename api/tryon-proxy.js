const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

module.exports = async function handler(req, res) {
  // ── CORS ──────────────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')   { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    // ── API KEY CHECK ─────────────────────────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY environment variable is not set');
      return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY not set. Please add it in Vercel Environment Variables.' });
    }

    // ── PARSE BODY ────────────────────────────────────────────────────────
    const { messages = [] } = req.body || {};
    if (!messages.length) {
      return res.status(400).json({ error: 'No messages provided' });
    }

    // ── BUILD GEMINI PARTS ────────────────────────────────────────────────
    const parts = [];
    const content = (messages[0] && messages[0].content) || [];

    for (const block of content) {
      if (block.type === 'image' && block.source?.data) {
        parts.push({
          inline_data: {
            mime_type: block.source.media_type || 'image/jpeg',
            data: block.source.data
          }
        });
      } else if (block.type === 'text') {
        parts.push({ text: block.text });
      }
    }

    if (parts.length === 0) {
      return res.status(400).json({ error: 'No valid content parts found in messages' });
    }

    // ── CALL GEMINI ───────────────────────────────────────────────────────
    const payload = {
      system_instruction: {
        parts: [{
          text: 'You are a warm, encouraging personal stylist for an online fashion store. Analyse the customer photo and the product image provided. Be positive, specific, and concise. Never make negative comments about appearance. Keep response under 220 words. Use exactly these 3 bold headings: **FIT PREDICTION** **COLOUR & STYLE MATCH** **STYLING TIPS**'
        }]
      },
      contents: [{ role: 'user', parts }],
      generationConfig: { maxOutputTokens: 400, temperature: 0.7 }
    };

    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    // ── HANDLE GEMINI ERRORS ──────────────────────────────────────────────
    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errText);

      if (geminiRes.status === 400) {
        return res.status(400).json({ error: 'Bad request to Gemini API. Check image format.' });
      }
      if (geminiRes.status === 401 || geminiRes.status === 403) {
        return res.status(401).json({ error: 'Invalid or unauthorised Gemini API key. Please check your GEMINI_API_KEY in Vercel Environment Variables.' });
      }
      if (geminiRes.status === 429) {
        return res.status(429).json({ error: 'Gemini API quota exceeded. Please try again later.' });
      }
      return res.status(geminiRes.status).json({ error: `Gemini API error ${geminiRes.status}: ${errText}` });
    }

    // ── PARSE RESPONSE ────────────────────────────────────────────────────
    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to generate analysis.';
    return res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
