// 설정 점검용(관리자 전용): 값은 보여주지 않고 연결 여부와 변수 이름만 알려줍니다.
import { storeReady, storeEnvNames, redis } from './_lib/store.js';
import { isLoggedIn } from './_lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  // 설정 정보가 드러나지 않도록 관리자로 로그인한 경우에만 보여줍니다.
  if (!isLoggedIn(req)) return res.status(401).json({ error: '로그인이 필요합니다.' });
  let storeWorks = false;
  if (storeReady()) {
    try { storeWorks = (await redis('PING')) === 'PONG'; } catch { storeWorks = false; }
  }
  const redisLike = Object.keys(process.env).filter((k) => /REDIS|KV_|UPSTASH/i.test(k));
  return res.status(200).json({
    adminPassword: Boolean(process.env.ADMIN_PASSWORD),
    sessionSecret: Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16),
    storeFound: storeReady(),
    storeWorks,
    storeVariableNames: storeEnvNames(),
    redisLikeVariableNames: redisLike,
  });
}
