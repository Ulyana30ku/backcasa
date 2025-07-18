# Hugging Face Proxy Backend

Backend для проксирования запросов к Hugging Face API (Stable Diffusion и др.) через Next.js API route. Готов к деплою на Vercel.

## Быстрый старт

1. Склонируйте репозиторий или скопируйте папку `hf-proxy-backend`.
2. Скопируйте `.env.example` в `.env` и вставьте свой Hugging Face токен:
   ```
   HF_TOKEN=your_huggingface_token_here
   ```
3. Установите зависимости:
   ```
   npm install
   ```
4. Запустите локально:
   ```
   npm run dev
   ```
5. Деплойте на Vercel как Next.js проект (root = `hf-proxy-backend`).

## Эндпоинт

POST `/api/generate`

### Входные данные (JSON):
```
{
  "prompt": "modern living room, bright colors",
  "image": null, // base64 или null
  "strength": 0.7,
  "guidanceScale": 10,
  "steps": 50
}
```

### Ответ:
```
{
  "imageUrl": "data:image/png;base64,..." или "https://...",
  "timeTaken": 12.3,
  "error": null
}
```

## Пример запроса с фронта

```js
const response = await fetch('https://your-backend.vercel.app/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'modern living room, bright colors',
    image: null,
    strength: 0.7,
    guidanceScale: 10,
    steps: 50
  })
});
const data = await response.json();
console.log(data.imageUrl, data.timeTaken, data.error);
```

## CORS

Для теста разрешены все домены. Для продакшена настройте `Access-Control-Allow-Origin` на нужный домен.

---

**Вопросы — пиши!**

---

### **pages/api/generate.js**

Создай папки:
```sh
mkdir -p pages/api
```

В файл `pages/api/generate.js` вставь:

```js
// pages/api/generate.js

// Разрешаем CORS для всех (для теста)
const allowCors = fn => async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  return await fn(req, res);
};

const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1'; // Можно заменить на нужную модель

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, image, strength, guidanceScale, steps } = req.body;
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
      return res.status(response.status).json({ imageUrl: null, timeTaken, error });
    }

    if (contentType && contentType.startsWith('image/')) {
      // Hugging Face может вернуть изображение напрямую
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      return res.status(200).json({ imageUrl: `data:${contentType};base64,${base64}`, timeTaken, error: null });
    } else {
      // Или JSON с url/base64
      const data = await response.json();
      return res.status(200).json({
        imageUrl: data.url || data.image || null,
        timeTaken,
        error: null
      });
    }
  } catch (error) {
    return res.status(500).json({ imageUrl: null, timeTaken: 0, error: error.message || 'Internal server error' });
  }
}

export default allowCors(handler);
```

---

## 3. Установи зависимости и запусти

```sh
npm install
npm run dev
```

---

**Если что-то не получается — напиши, помогу восстановить!**  
Если хочешь, чтобы я сгенерировал архив с этими файлами — дай знать!
