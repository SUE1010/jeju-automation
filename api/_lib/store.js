// Upstash Redis(REST) 저장소. Vercel에서 Upstash를 연결하면 환경변수가 자동으로 들어옵니다.
// 연결할 때 붙인 접두어(예: STORAGE_, jeju_)가 달라도 찾을 수 있도록 이름 끝부분으로 찾습니다.
function findStoreEnv() {
  const env = process.env;
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return { url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN, names: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'] };
  }
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
    return { url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN, names: ['KV_REST_API_URL', 'KV_REST_API_TOKEN'] };
  }
  const pairs = [['KV_REST_API_URL', 'KV_REST_API_TOKEN'], ['REDIS_REST_URL', 'REDIS_REST_TOKEN']];
  for (const key of Object.keys(env)) {
    for (const [urlSuffix, tokenSuffix] of pairs) {
      if (key.endsWith(urlSuffix) && env[key]) {
        const tokenKey = key.slice(0, -urlSuffix.length) + tokenSuffix;
        if (env[tokenKey]) return { url: env[key], token: env[tokenKey], names: [key, tokenKey] };
      }
    }
  }
  return null;
}

const FOUND = findStoreEnv();
const URL_ = FOUND && FOUND.url;
const TOKEN = FOUND && FOUND.token;

export function storeEnvNames() {
  return FOUND ? FOUND.names : [];
}

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

// 관리자가 업로드한 HTML 페이지 (링크 대신 사용)
export const PAGE_PREFIX = 'jeju-automation:page:';
export const FILES_KEY = 'jeju-automation:link-files';

// 업로드한 파일 정보 { key: { name, size, uploadedAt } }
export async function getFiles() {
  const flat = (await redis('HGETALL', FILES_KEY)) || [];
  const out = {};
  for (let i = 0; i < flat.length; i += 2) {
    try { out[flat[i]] = JSON.parse(flat[i + 1]); } catch { /* 깨진 값은 무시 */ }
  }
  return out;
}

export async function removePage(key) {
  await redis('DEL', PAGE_PREFIX + key);
  await redis('HDEL', FILES_KEY, key);
}
