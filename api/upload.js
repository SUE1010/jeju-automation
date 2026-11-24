// 관리자 전용: HTML 파일을 올리면 저장한 뒤 해당 바로가기를 /p/<항목> 주소로 연결합니다.
import { redis, storeReady, LINKS_KEY, LINK_KEYS, PAGE_PREFIX, FILES_KEY } from './_lib/store.js';
import { isLoggedIn } from './_lib/auth.js';

const MAX_BYTES = 4 * 1024 * 1024; // Vercel 함수 요청 한도(4.5MB) 안쪽

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BYTES) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  if (!isLoggedIn(req)) return res.status(401).json({ error: '로그인이 필요합니다.' });
  if (!storeReady()) return res.status(503).json({ error: '저장소(Upstash Redis)가 연결되지 않았습니다.' });

  const params = new URL(req.url, 'http://localhost').searchParams;
  const key = params.get('key') || '';
  const name = (params.get('name') || '').trim().slice(0, 200);
  if (!LINK_KEYS.includes(key)) return res.status(400).json({ error: '알 수 없는 항목입니다.' });
  if (!/\.html?$/i.test(name)) return res.status(400).json({ error: '.html 파일만 올릴 수 있습니다.' });

  let body;
  try { body = await readBody(req); } catch { return res.status(400).json({ error: '파일을 받지 못했습니다.' }); }
  if (body === null) return res.status(413).json({ error: '파일이 너무 큽니다. 4MB 이하 파일만 올릴 수 있습니다.' });
  if (!body.length) return res.status(400).json({ error: '빈 파일입니다.' });

  const file = { name, size: body.length, uploadedAt: new Date().toISOString() };
  // 주소 끝의 v 값이 바뀌므로 다시 올리면 브라우저·CDN 캐시와 상관없이 새 파일이 열립니다.
  const url = `/p/${key}?v=${Date.now().toString(36)}`;
  try {
    // 한글(EUC-KR) 문서도 깨지지 않도록 원본 바이트 그대로 저장합니다.
    await redis('SET', PAGE_PREFIX + key, body.toString('base64'));
    await redis('HSET', FILES_KEY, key, JSON.stringify(file));
    await redis('HSET', LINKS_KEY, key, url);
  } catch {
    return res.status(500).json({ error: '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  }
  return res.status(200).json({ ok: true, key, url, file });
}
