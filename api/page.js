// 업로드한 HTML 페이지를 보여줍니다. (/p/<항목> → 이 함수, vercel.json 참고)
import { redis, storeReady, LINK_KEYS, PAGE_PREFIX } from './_lib/store.js';

// 업로드한 파일 안의 스크립트가 관리자 로그인 상태를 이용하지 못하도록
// 홈페이지와 분리된(sandbox) 환경에서 실행합니다.
const SANDBOX = 'sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals';

function notFound(res, status, msg) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(status).send(`<!doctype html><meta charset="utf-8"><title>페이지 없음</title>` +
    `<p style="font-family:sans-serif;padding:48px;text-align:center">${msg}<br><a href="/">메인 페이지로</a></p>`);
}

export default async function handler(req, res) {
  const key = new URL(req.url, 'http://localhost').searchParams.get('key') || '';
  if (!LINK_KEYS.includes(key)) return notFound(res, 404, '페이지를 찾을 수 없습니다.');
  if (!storeReady()) return notFound(res, 503, '저장소가 연결되지 않았습니다.');

  let b64;
  try { b64 = await redis('GET', PAGE_PREFIX + key); } catch { return notFound(res, 500, '페이지를 불러오지 못했습니다.'); }
  if (!b64) return notFound(res, 404, '등록된 페이지가 없습니다.');

  const body = Buffer.from(b64, 'base64');
  let type = 'text/html';
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(body);
    type = 'text/html; charset=utf-8';
  } catch {
    // UTF-8이 아니면 문서 안의 <meta charset> 을 따르도록 둡니다.
  }
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Security-Policy', SANDBOX);
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  return res.status(200).send(body);
}
