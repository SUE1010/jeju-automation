import { makeSessionCookie, safeEqual, clientIp } from './_lib/auth.js';
import { redis, storeReady } from './_lib/store.js';

const MAX_FAILS = 5;
const LOCK_SECONDS = 600; // 5번 틀리면 10분 잠금

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !process.env.SESSION_SECRET) {
    return res.status(500).json({ error: '관리자 비밀번호 환경변수가 설정되지 않았습니다.' });
  }

  const failKey = `jeju-automation:login-fail:${clientIp(req)}`;
  if (storeReady()) {
    const fails = Number((await redis('GET', failKey).catch(() => 0)) || 0);
    if (fails >= MAX_FAILS) {
      return res.status(429).json({ error: '비밀번호를 여러 번 틀려 10분 동안 로그인할 수 없습니다.' });
    }
  }

  const { password } = req.body || {};
  if (typeof password === 'string' && safeEqual(password, expected)) {
    if (storeReady()) await redis('DEL', failKey).catch(() => {});
    res.setHeader('Set-Cookie', makeSessionCookie());
    return res.status(200).json({ ok: true });
  }

  if (storeReady()) {
    await redis('INCR', failKey).catch(() => {});
    await redis('EXPIRE', failKey, LOCK_SECONDS).catch(() => {});
  }
  return res.status(401).json({ error: '비밀번호가 맞지 않습니다. 다시 입력해 주세요.' });
}
