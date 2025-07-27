const MODELS = [
  "stabilityai/stable-diffusion-xl-base-1.0",
  "dreamlike-art/dreamlike-photoreal-2.0",
  "digiplay/Juggernaut_final"
];

const allowCors = fn => async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(200).send('OK');
    return;
  }
  return await fn(req, res);
};

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).send('OK');
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, strength, guidanceScale, steps } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const hfToken = process.env.HF_TOKEN;
  if (!hfToken) {
    return res.status(500).json({ error: 'Hugging Face token not set in .env' });
  }

  const start = Date.now();
  let lastError = null;
  for (const model of MODELS) {
    try {
      const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            strength: strength ?? 0.7,
            guidance_scale: guidanceScale ?? 10,
            num_inference_steps: steps ?? 50
          }
        })
      });

      const contentType = response.headers.get('content-type');
      const timeTaken = (Date.now() - start) / 1000;

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        lastError = error.error || 'Unknown error';
        continue; // Пробуем следующую модель
      }

      if (contentType && contentType.startsWith('image/')) {
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        return res.status(200).json({ imageUrl: `data:${contentType};base64,${base64}`, timeTaken, error: null });
      } else {
        const data = await response.json();
        lastError = data.error || 'Unknown error';
        continue;
      }
    } catch (error) {
      lastError = error.message || 'Internal server error';
      continue;
    }
  }
  // Если все модели не сработали
  return res.status(500).json({ imageUrl: null, timeTaken: 0, error: lastError || 'All models failed' });
}

export default allowCors(handler);

