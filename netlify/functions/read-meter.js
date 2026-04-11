exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { base64Image, mediaType } = JSON.parse(event.body || '{}');
    if (!base64Image || !mediaType) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing base64Image or mediaType' }) };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }) };
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
            { type: 'text', text: `You are an expert at reading old analog utility meters used in Greece (electricity and water meters from the 1970s-2000s).

METER TYPES:
1. ELECTRICITY (e.g. AEG Wisselstroommeter): A row of mechanical odometer-style digit wheels in small rectangular windows. Read the digits left to right. Last digit(s) in red/orange color = decimal part.
2. WATER (e.g. H.B., Simar): Circular face with a row of white/cream digit boxes showing m3. IGNORE the small round analog dials - read ONLY the rectangular digit boxes in a horizontal row.

RULES:
- Read the horizontal row of digit windows/boxes from LEFT to RIGHT
- If a wheel is between two numbers, use the LOWER digit
- Ignore leading zeros (00282 becomes 282)
- Last digit in red/orange = decimal (9763 with red last = 9763)

Respond ONLY with this exact JSON format, no other text:
{"reading": 9763, "confidence": "high", "notes": "describe exactly what digits you saw"}` }
          ]
        }]
      })
    });

    const data = await res.json();
    if (!res.ok) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Anthropic error', details: data }) };
    }

    const text = data.content?.[0]?.text?.trim() || '';
    try {
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      return { statusCode: 200, headers, body: JSON.stringify(parsed) };
    } catch {
      const match = text.match(/\d{2,}([.,]\d+)?/);
      const value = match ? parseFloat(match[0].replace(',', '.')) : null;
      return { statusCode: 200, headers, body: JSON.stringify({ reading: value, confidence: 'low', notes: text.substring(0, 200) }) };
    }
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
