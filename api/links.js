import { getLinks, redis, storeReady, LINKS_KEY, LINK_KEYS } from './_lib/store.js';
import { isLoggedIn } from './_lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!storeReady()) {
    return res.status(503).json({ error: '저장소(Upstash Redis)가 연결되지 않았습니다.' });
  }

  if (req.method === 'GET') {
    try {
      return res.status(200).json({ links: await getLinks() });
    } catch {
      return res.status(500).json({ error: '링크를 불러오지 못했습니다.' });
    }
  }

  if (req.method === 'PUT') {
    if (!isLoggedIn(req)) return res.status(401).json({ error: '로그인이 필요합니다.' });

    const { key, url } = req.body || {};
    if (!LINK_KEYS.includes(key)) return res.status(400).json({ error: '알 수 없는 항목입니다.' });

    const value = typeof url === 'string' ? url.trim() : '';
    try {
      if (!value) {
        await redis('HDEL', LINKS_KEY, key);
        return res.status(200).json({ ok: true, key, url: '' });
      }
      if (value.length > 2000 || !/^https?:\/\/[^\s<>"']+$/i.test(value)) {
        return res.status(400).json({ error: 'http:// 또는 https:// 로 시작하는 주소를 입력해 주세요.' });
      }
      await redis('HSET', LINKS_KEY, key, value);
      return res.status(200).json({ ok: true, key, url: value });
    } catch {
      return res.status(500).json({ error: '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    }
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'Method Not Allowed' });
}
