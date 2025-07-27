export const config = {
  runtime: 'edge',
  maxDuration: 60
};

export default async function handler(req) {
  // Улучшенные CORS headers
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Content-Type': 'application/json',
    'Vary': 'Origin'
  });

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
  }

  // Validate method
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { headers, status: 405 }
    );
  }

  try {
    const { prompt, image, strength = 0.7, guidanceScale = 7.5, steps = 50 } = await req.json();
    
    if (!prompt?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { headers, status: 400 }
      );
    }

    // Подготовка запроса к Hugging Face
    const hfResponse = await fetch(
      'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: image ? {
            prompt: prompt.trim(),
            image: image
          } : prompt.trim(),
          parameters: {
            strength: Math.min(Math.max(Number(strength), 0.1), 0.9),
            guidance_scale: Number(guidanceScale),
            num_inference_steps: Number(steps)
          }
        })
      }
    );

    if (!hfResponse.ok) {
      const error = await hfResponse.json().catch(() => ({}));
      throw new Error(error.error || 'Generation failed');
    }

    const imageBuffer = await hfResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    return new Response(
      JSON.stringify({
        image: `data:image/png;base64,${base64Image}`,
        model: 'stabilityai/stable-diffusion-xl-base-1.0'
      }),
      { headers, status: 200 }
    );

  } catch (error) {
    console.error('API error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }),
      { headers, status: 500 }
    );
  }
}