export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // CORS headers
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers,
      status: 204 
    });
  }

  // Check method
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        headers,
        status: 405 
      }
    );
  }

  try {
    const body = await req.json();
    const { prompt } = body;

    // Validation
    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid prompt' }),
        { 
          headers,
          status: 400 
        }
      );
    }

    // Call Hugging Face API
    const hfResponse = await fetch(
      'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0', 
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          inputs: prompt,
          parameters: {
            guidance_scale: 7.5,
            num_inference_steps: 50
          }
        })
      }
    );

    if (!hfResponse.ok) {
      const error = await hfResponse.json().catch(() => ({}));
      throw new Error(error.error || 'Hugging Face API error');
    }

    const imageBuffer = await hfResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    return new Response(
      JSON.stringify({
        image: `data:image/png;base64,${base64Image}`,
        model: 'stabilityai/stable-diffusion-xl-base-1.0'
      }),
      { 
        headers,
        status: 200 
      }
    );

  } catch (error) {
    console.error('API error:', error);
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Internal server error';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers,
        status: 500 
      }
    );
  }
}