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
  
  const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models/gpt2';
  
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
  
    const { prompt, image, strength, guidanceScale, steps } = req.body;
    console.log('INCOMING BODY:', req.body);
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
  
    const start = Date.now();
    try {
      const payload = {
        inputs: image ? {
          prompt,
          image,
          strength: strength ?? 0.7,
          guidance_scale: guidanceScale ?? 7.5,
          num_inference_steps: steps ?? 50
        } : {
          prompt,
          strength: strength ?? 0.7,
          guidance_scale: guidanceScale ?? 7.5,
          num_inference_steps: steps ?? 50
        }
      };
      console.log('PAYLOAD FOR HF:', payload);
  
      const hfToken = process.env.HF_TOKEN;
      if (!hfToken) {
        return res.status(500).json({ error: 'Hugging Face token not set in .env' });
      }
  
      const response = await fetch(HUGGINGFACE_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload.inputs)
      });
  
      const contentType = response.headers.get('content-type');
      const timeTaken = (Date.now() - start) / 1000;
  
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('HF ERROR RESPONSE:', error);
        return res.status(response.status).json({ imageUrl: null, timeTaken, error });
      }
  
      if (contentType && contentType.startsWith('image/')) {
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        console.log('HF IMAGE RESPONSE: <binary image>');
        return res.status(200).json({ imageUrl: `data:${contentType};base64,${base64}`, timeTaken, error: null });
      } else {
        const data = await response.json();
        console.log('HF JSON RESPONSE:', data);
        return res.status(200).json({
          imageUrl: data.url || data.image || null,
          timeTaken,
          error: null
        });
      }
    } catch (error) {
      console.error('SERVER ERROR:', error);
      return res.status(500).json({ imageUrl: null, timeTaken: 0, error: error.message || 'Internal server error' });
    }
  }

export default allowCors(handler);
//dddddd
