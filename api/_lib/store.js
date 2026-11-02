// Upstash Redis(REST) 저장소. Vercel Marketplace에서 Upstash를 연결하면 환경변수가 자동으로 들어옵니다.
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export function storeReady() {
  return Boolean(URL_ && TOKEN);
}

export async function redis(...command) {
  if (!storeReady()) throw new Error('STORE_NOT_CONFIGURED');
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `REDIS_${res.status}`);
  return data.result;
}

export const LINKS_KEY = 'jeju-automation:links';

// 관리자 페이지에서 관리하는 링크 목록 (여기에 없는 키는 저장할 수 없습니다)
export const LINK_KEYS = ['manneung', 'worksai', 'excel', 'hwp', 'odf', 'overtime', 'board'];

export async function getLinks() {
  const flat = (await redis('HGETALL', LINKS_KEY)) || [];
  const out = {};
  for (let i = 0; i < flat.length; i += 2) out[flat[i]] = flat[i + 1];
  return out;
}

export const TEXTS_KEY = 'jeju-automation:texts';

// 관리자 페이지에서 수정하는 하단(푸터) 문구
export const TEXT_KEYS = ['footer_title', 'footer_dept', 'footer_contact', 'footer_notice'];

export async function getTexts() {
  const flat = (await redis('HGETALL', TEXTS_KEY)) || [];
  const out = {};
  for (let i = 0; i < flat.length; i += 2) out[flat[i]] = flat[i + 1];
  return out;
}
