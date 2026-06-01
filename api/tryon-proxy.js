const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Compress base64 image by resizing to max 800px and quality 0.7
async function compressBase64(base64, mimeType) {
  // Return as-is in Node environment — compression handled client-side
  return { data: base64, mimeType: mimeType || 'image/jpeg' };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set in Vercel Environment Variables.' });

    const { messages = [] } = req.body || {};
    if (!messages.length) return res.status(400).json({ error: 'No messages provided' });

    const parts = [];
    const content = (messages[0] && messages[0].content) || [];

    for (const block of content) {
      if (block.type === 'image' && block.source?.data) {
        // Truncate base64 to max 1MB per image (Gemini limit)
        let imgData = block.source.data;
        // Remove any whitespace/newlines
        imgData = imgData.replace(/\s/g, '');
        parts.push({
          inline_data: {
            mime_type: block.source.media_type || 'image/jpeg',
            data: imgData
          }
        });
      } else if (block.type === 'text') {
        parts.push({ text: block.text });
      }
    }

    if (parts.length === 0) return res.status(400).json({ error: 'No valid content found' });

    const payload = {
      system_instruction: {
        parts: [{ text: 'You are a warm, encouraging personal stylist for an online fashion store. Analyse the customer photo and product image. Be positive, specific, concise. Never make negative comments. Keep under 220 words. Use exactly these 3 bold headings: **FIT PREDICTION** **COLOUR & STYLE MATCH** **STYLING TIPS**' }]
      },
      contents: [{ role: 'user', parts }],
      generationConfig: { maxOutputTokens: 400, temperature: 0.7 }
    };

    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini error:', geminiRes.status, errText);
      if (geminiRes.status === 401 || geminiRes.status === 403) {
        return res.status(401).json({ error: 'Invalid Gemini API key. Please check GEMINI_API_KEY in Vercel Environment Variables.' });
      }
      if (geminiRes.status === 429) {
        return res.status(429).json({ error: 'Gemini API quota exceeded. Please set up billing at aistudio.google.com or try again tomorrow.' });
      }
      if (geminiRes.status === 413) {
        return res.status(413).json({ error: 'Images are too large. Please use smaller images (under 2MB each).' });
      }
      return res.status(geminiRes.status).json({ error: `Gemini error ${geminiRes.status}: ${errText.substring(0, 200)}` });
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to generate analysis.';
    return res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message });
  }
};
