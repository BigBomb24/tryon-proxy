module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { messages = [] } = req.body || {};
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not set');

    const content = (messages[0] && messages[0].content) || [];
    const groqContent = [];

    for (const block of content) {
      if (block.type === 'image' && block.source && block.source.data) {
        groqContent.push({
          type: 'image_url',
          image_url: {
            url: 'data:' + (block.source.media_type || 'image/jpeg') + ';base64,' + block.source.data
          }
        });
      } else if (block.type === 'text') {
        groqContent.push({ type: 'text', text: block.text });
      }
    }

    const payload = {
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content: 'You are a warm encouraging personal stylist for an online fashion store. Analyse the customer photo and product image. Be positive, specific, concise. Never make negative comments. Keep under 220 words. Use exactly these 3 bold headings: **FIT PREDICTION** **COLOUR & STYLE MATCH** **STYLING TIPS**'
        },
        {
          role: 'user',
          content: groqContent
        }
      ]
    };

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error('Groq error ' + response.status + ': ' + errText);
    }

    const data = await response.json();
    const text = data.choices[0].message.content || 'Unable to generate analysis.';
    res.status(200).json({ content: [{ type: 'text', text: text }] });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
