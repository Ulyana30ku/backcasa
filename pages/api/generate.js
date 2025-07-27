export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // CORS headers
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Content-Type', 'application/json');

  // Handle OPTIONS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
  }

  // Check method
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { headers, status: 405 }
    );
  }

  try {
    const { prompt } = await req.json();
    
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { headers, status: 400 }
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
        body: JSON.stringify({ inputs: prompt })
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
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error' 
      }),
      { headers, status: 500 }
    );
  }
}