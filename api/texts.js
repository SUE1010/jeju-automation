import { redis, storeReady } from './_lib/store.js';
import { isLoggedIn } from './_lib/auth.js';

// 하단(푸터) 문구 — 이 파일 안에서만 쓰므로 여기에 둡니다.
const TEXTS_KEY = 'jeju-automation:texts';
const TEXT_KEYS = ['footer_title', 'footer_dept', 'footer_contact', 'footer_notice'];

async function getTexts() {
  const flat = (await redis('HGETALL', TEXTS_KEY)) || [];
  const out = {};
  for (let i = 0; i < flat.length; i += 2) out[flat[i]] = flat[i + 1];
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!storeReady()) {
    return res.status(503).json({ error: '저장소(Upstash Redis)가 연결되지 않았습니다.' });
  }

  if (req.method === 'GET') {
    try {
      return res.status(200).json({ texts: await getTexts() });
    } catch {
      return res.status(500).json({ error: '문구를 불러오지 못했습니다.' });
    }
  }

  if (req.method === 'PUT') {
    if (!isLoggedIn(req)) return res.status(401).json({ error: '로그인이 필요합니다.' });

    const input = (req.body && req.body.texts) || {};
    const args = [];
    for (const key of TEXT_KEYS) {
      if (!(key in input)) continue;
      const v = typeof input[key] === 'string' ? input[key].trim() : '';
      if (v.length > 200) return res.status(400).json({ error: '문구는 200자 이내로 입력해 주세요.' });
      args.push(key, v);
    }
    if (!args.length) return res.status(400).json({ error: '저장할 내용이 없습니다.' });

    try {
      await redis('HSET', TEXTS_KEY, ...args);
      return res.status(200).json({ ok: true, texts: await getTexts() });
    } catch {
      return res.status(500).json({ error: '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    }
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'Method Not Allowed' });
}
