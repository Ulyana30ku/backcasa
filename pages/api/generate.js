const MODELS = [
  "stabilityai/stable-diffusion-xl-1.0",
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

async function checkModelAvailability(model, hfToken) {
  try {
    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      headers: { 'Authorization': `Bearer ${hfToken}` }
    });
    return response.ok;
  } catch (error) {
    console.error(`Availability check failed for ${model}:`, error.message);
    return false;
  }
}

async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).send('OK');
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt, guidanceScale = 10, steps = 50 } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Valid prompt is required' });
    }

    const hfToken = process.env.HF_TOKEN;
    if (!hfToken) {
      return res.status(500).json({ error: 'Hugging Face token not configured' });
    }

    const start = Date.now();
    const errors = [];

    for (const model of MODELS) {
      try {
        console.log(`Attempting model: ${model}`);
        
        // Проверка доступности модели
        const isAvailable = await checkModelAvailability(model, hfToken);
        if (!isAvailable) {
          const msg = `Model ${model} is currently unavailable`;
          errors.push(msg);
          console.warn(msg);
          continue;
        }

        // Запрос генерации
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
              guidance_scale: Number(guidanceScale),
              num_inference_steps: Number(steps)
            }
          }),
          timeout: 30000 // 30 секунд таймаут
        });

        const contentType = response.headers.get('content-type');
        const timeTaken = (Date.now() - start) / 1000;

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.error || `HTTP ${response.status}`;
          errors.push(`${model}: ${errorMsg}`);
          console.error(`Model ${model} failed:`, errorMsg);
          continue;
        }

        if (contentType?.startsWith('image/')) {
          const buffer = await response.arrayBuffer();
          return res.status(200).json({
            imageUrl: `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`,
            timeTaken,
            modelUsed: model,
            error: null
          });
        }

        const data = await response.json();
        errors.push(`${model}: Unexpected response format`);
        console.error(`Unexpected response from ${model}:`, data);

      } catch (error) {
        const errorMsg = error.message || 'Model processing error';
        errors.push(`${model}: ${errorMsg}`);
        console.error(`Error with model ${model}:`, error);
      }
    }

    return res.status(500).json({
      error: `All models failed: ${errors.join('; ')}`,
      timeTaken: (Date.now() - start) / 1000,
      availableModels: MODELS
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