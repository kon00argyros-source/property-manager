export const readMeterFromImage = async (base64Image, mediaType) => {
  try {
    // Call Netlify function directly at its actual path
    const response = await fetch('/.netlify/functions/read-meter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image, mediaType })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Meter reader HTTP error:', response.status, text);
      return { value: null, confidence: 'low', notes: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return {
      value: data.reading !== null && data.reading !== undefined ? parseFloat(data.reading) : null,
      confidence: data.confidence || 'low',
      notes: data.notes || ''
    };
  } catch (err) {
    console.error('readMeterFromImage error:', err);
    return { value: null, confidence: 'low', notes: err.message };
  }
};
