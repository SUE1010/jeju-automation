// 설정 점검용: 값은 보여주지 않고 연결 여부와 변수 이름만 알려줍니다.
import { storeReady, storeEnvNames, redis } from './_lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
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
