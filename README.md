# 제주시 업무자동화 홈페이지

## 폴더 구성

- `public/` 화면 파일 (메인, 공식 챗봇 소개, 팀 챗봇 소개, 관리자)
- `api/` 관리자 로그인과 바로가기 링크 저장을 처리하는 서버 기능
- `vercel.json` Vercel 설정

| 주소 | 화면 |
|---|---|
| `/` | 메인 페이지 |
| `/official-chatbot` | 공식 챗봇 소개 |
| `/team-chatbot` | 팀 챗봇 소개 |
| `/admin` | 관리자 (비밀번호 필요) |

## 배포 순서

1. **GitHub에 올리기**: 이 폴더 전체를 새 저장소에 올립니다.
2. **Vercel에서 가져오기**: Vercel > Add New > Project > 저장소 선택. Framework Preset은 `Other`, 나머지 설정은 그대로 두고 Deploy.
3. **저장소 연결 (링크 저장용)**: 프로젝트 > Storage(또는 Marketplace) > **Upstash for Redis** 를 추가하고 이 프로젝트에 연결합니다. 연결하면 `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (또는 `KV_REST_API_URL`, `KV_REST_API_TOKEN`) 환경변수가 자동으로 들어옵니다.
4. **환경변수 등록**: 프로젝트 > Settings > Environment Variables 에 다음 두 개를 추가합니다.
   - `ADMIN_PASSWORD` : 관리자 비밀번호
   - `SESSION_SECRET` : 16자 이상의 무작위 문자열
5. **다시 배포**: 환경변수는 새로 배포해야 적용됩니다. Deployments > 최신 배포 > Redeploy.
6. **링크 입력**: `/admin` 에 접속해 로그인한 뒤 각 바로가기 주소를 저장합니다.

## 참고

- 링크가 아직 등록되지 않은 버튼은 흐리게 보이고, 누르면 "링크를 준비하고 있습니다" 안내가 나옵니다.
- 관리자 비밀번호를 5번 틀리면 10분 동안 로그인이 막힙니다.
- 비밀번호를 바꾸려면 Vercel 환경변수의 `ADMIN_PASSWORD` 를 바꾸고 다시 배포하세요.
- 하단(푸터) 문구는 관리자 페이지 > 하단 문구 관리에서 바꿀 수 있습니다.
- 본문의 `[전화번호]` 같은 대괄호 문구는 `public/` 의 HTML 파일에서 직접 고쳐 주세요.
