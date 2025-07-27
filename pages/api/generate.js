const MODELS = [
  "stabilityai/stable-diffusion-xl-base-1.0",
  "dreamlike-art/dreamlike-photoreal-2.0",
  "digiplay/juggernaut_final"
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
  try {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Only POST method allowed' });
    }

    const { prompt, guidanceScale = 10, steps = 50 } = req.body;
    
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt must be a non-empty string' });
    }

    const HF_TOKEN = process.env.HF_TOKEN;
    if (!HF_TOKEN) {
      console.error('HF_TOKEN is not set in environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const startTime = Date.now();
    const errors = [];

    for (const model of MODELS) {
      try {
        console.log(`Attempting model: ${model}`);
        
        const response = await fetch(
          `https://api-inference.huggingface.co/models/${model}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${HF_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              inputs: prompt,
              parameters: {
                guidance_scale: Number(guidanceScale),
                num_inference_steps: Number(steps)
              }
            }),
            timeout: 30000
          }
        );

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          errors.push(`${model}: ${error.error || response.status}`);
          console.error(`Model ${model} failed:`, error);
          continue;
        }

        const contentType = response.headers.get('content-type');
        if (contentType?.includes('image')) {
          const buffer = await response.arrayBuffer();
          return res.status(200).json({
            imageUrl: `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`,
            timeTaken: (Date.now() - startTime) / 1000,
            modelUsed: model
          });
        }

        const unexpectedResponse = await response.text();
        errors.push(`${model}: Unexpected response format`);
        console.error(`Unexpected response from ${model}:`, unexpectedResponse.substring(0, 200));
      } catch (error) {
        const errorMsg = error.message || 'Request failed';
        errors.push(`${model}: ${errorMsg}`);
        console.error(`Error with model ${model}:`, error);
      }
    }

    return res.status(500).json({
      error: `All models failed`,
      details: errors,
      timeTaken: (Date.now() - startTime) / 1000
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

export default allowCors(handler);