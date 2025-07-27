const MODELS = [
  "stabilityai/stable-diffusion-xl-base-1.0",
  "dreamlike-art/dreamlike-photoreal-2.0",
  "digiplay/juggernaut_final"
];

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt, guidanceScale = 10, steps = 50 } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const HF_TOKEN = process.env.HF_TOKEN;
    if (!HF_TOKEN) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    let result;
    for (const model of MODELS) {
      try {
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
                guidance_scale: guidanceScale,
                num_inference_steps: steps
              }
            })
          }
        );

        if (response.ok) {
          const buffer = await response.arrayBuffer();
          result = {
            image: Buffer.from(buffer).toString('base64'),
            contentType: response.headers.get('content-type') || 'image/png',
            model
          };
          break;
        }
      } catch (error) {
        console.error(`Error with model ${model}:`, error);
      }
    }

    if (!result) {
      return res.status(500).json({ error: 'All models failed' });
    }

    // Возвращаем JSON с base64 без кодирования URL
    return res.status(200).json({
      image: `data:${result.contentType};base64,${result.image}`,
      model: result.model
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}