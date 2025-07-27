export const config = {
  runtime: 'edge',
  maxDuration: 60,
};

export default async function handler(req) {
  // Улучшенные CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate'
  };

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
    const requestData = await req.json();
    const { prompt, strength = 0.7, guidanceScale = 7.5, steps = 50 } = requestData;
    
    // Валидация промпта
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Valid prompt is required' }),
        { headers, status: 400 }
      );
    }

    // Параметры для Hugging Face
    const hfBody = {
      inputs: prompt.trim(),
      options: { wait_for_model: true },
      parameters: {
        guidance_scale: Number(guidanceScale),
        num_inference_steps: Number(steps),
        ...(strength && { strength: Math.min(Math.max(Number(strength), 0.1), 0.9) })
      }
    };

    // Вызов HF API
    const hfResponse = await fetch(
      'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(hfBody)
      }
    );

    // Обработка ошибок HF
    if (!hfResponse.ok) {
      const error = await hfResponse.json().catch(() => ({}));
      const errorMsg = error.error || `HF API error (status ${hfResponse.status})`;
      throw new Error(errorMsg);
    }

    // Получение и проверка изображения
    const imageBuffer = await hfResponse.arrayBuffer();
    if (imageBuffer.byteLength > 10 * 1024 * 1024) {
      throw new Error('Generated image is too large (max 10MB)');
    }

    // Конвертация в base64
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const imageUrl = `data:image/png;base64,${base64Image}`;

    // Успешный ответ
    return new Response(
      JSON.stringify({
        image: imageUrl,
        model: 'stabilityai/stable-diffusion-xl-base-1.0',
        size: imageBuffer.byteLength
      }),
      { headers, status: 200 }
    );

  } catch (error) {
    console.error('API error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error'
      }),
      { 
        headers,
        status: error.message.includes('HF API') ? 502 : 500 
      }
    );
  }
}