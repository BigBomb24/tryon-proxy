const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { messages = [] } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const parts = [];
    const content = (messages[0] && messages[0].content) || [];
    for (const block of content) {
      if (block.type === 'image' && block.source?.data) {
        parts.push({ inline_data: { mime_type: block.source.media_type || 'image/jpeg', data: block.source.data } });
      } else if (block.type === 'text') {
        parts.push({ text: block.text });
      }
    }

    const payload = {
      system_instruction: { parts: [{ text: `You are a warm encouraging personal stylist for an online fashion store. Analyse the customer photo and product image. Be positive, specific, concise. Never make negative comments. Keep under 220 words. Use exactly these 3 bold headings: **FIT PREDICTION** **COLOUR & STYLE MATCH** **STYLING TIPS**` }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { maxOutputTokens: 400, temperature: 0.7 }
    };

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`Gemini error ${response.status}`);
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to generate analysis.';
    res.status(200).json({ content: [{ type: 'text', text }] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
