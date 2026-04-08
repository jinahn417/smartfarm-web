# Smartfarm 외부 배포 매뉴얼

이 문서는 로컬 PC에서 개발한 Smartfarm 웹사이트를 **외부에서 접속 가능하게 배포**하는 전체 절차를 다룹니다.

## 전체 구조

```
외부 브라우저 ──(HTML/JS/CSS)──> Vercel (정적 호스팅)
    │
    └──(fetch /api/readings)──> Cloudflare Tunnel ──> Pi FastAPI :8765 ──> SQLite
```

---

## 1단계: GitHub 로그인 및 저장소 push

### 1.1 GitHub CLI 로그인

PowerShell 터미널에서:

```powershell
gh auth login --web --git-protocol https
```

- 화면에 **코드(예: XXXX-YYYY)** 가 표시됩니다
- 브라우저가 자동으로 열립니다 (안 열리면 https://github.com/login/device 접속)
- 코드를 입력하고 → GitHub 로그인 → "Authorize GitHub CLI" 클릭
- 터미널에 `✓ Logged in as jinahn417` 가 나오면 성공

### 1.2 GitHub 저장소 생성 + push

```powershell
cd C:\Users\2023user\smartfarm-web
gh repo create smartfarm-web --public --source=. --push
```

이 명령 하나로:
- GitHub에 `smartfarm-web` 저장소가 생성됨
- 현재 코드가 push됨

성공하면 `https://github.com/jinahn417/smartfarm-web` 에서 확인 가능

---

## 2단계: Cloudflare Tunnel 설정 (라즈베리파이)

> Pi의 FastAPI를 인터넷에 안전하게 공개하는 단계

### 2.1 Cloudflare 계정 준비

1. https://dash.cloudflare.com/sign-up 에서 **무료 계정** 생성
2. 도메인이 없어도 진행 가능 (Cloudflare가 `*.trycloudflare.com` 임시 도메인 제공)

### 2.2 Pi에 cloudflared 설치

**Pi 터미널 (SSH)** 에서:

```bash
# ARM용 cloudflared 다운로드
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o cloudflared

# 실행 권한 부여 및 이동
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/

# 설치 확인
cloudflared --version
```

> Pi가 32비트(armhf)인 경우: `cloudflared-linux-arm` 으로 다운로드

### 2.3 Cloudflare 로그인 (Pi에서)

```bash
cloudflared tunnel login
```

- URL이 표시되면 **Pi와 같은 네트워크에 있는 PC/폰 브라우저**에서 해당 URL 접속
- Cloudflare 계정 로그인 → 도메인 선택 → "Authorize"
- Pi 터미널에 인증 완료 메시지가 나옴

### 2.4 터널 생성

```bash
cloudflared tunnel create smartfarm-api
```

성공하면 터널 ID(UUID)가 출력됩니다. 기억해두세요.

### 2.5 터널 설정 파일 생성

```bash
nano ~/.cloudflared/config.yml
```

아래 내용 입력 (`터널ID` 부분을 2.4에서 받은 UUID로 교체):

```yaml
tunnel: 터널ID
credentials-file: /home/pi/.cloudflared/터널ID.json

ingress:
  - hostname: smartfarm-api.내도메인.com
    service: http://localhost:8765
  - service: http_status:404
```

> **도메인이 없는 경우 (임시 URL 사용):**
> config.yml 없이 아래 명령으로 바로 실행 가능합니다:
> ```bash
> cloudflared tunnel --url http://localhost:8765
> ```
> 실행하면 `https://xxxx-xxxx.trycloudflare.com` 같은 임시 URL이 발급됩니다.
> 이 URL을 .env.production의 VITE_API_BASE에 넣으면 됩니다.

### 2.6 DNS 레코드 추가 (도메인이 있는 경우)

```bash
cloudflared tunnel route dns smartfarm-api smartfarm-api.내도메인.com
```

### 2.7 터널 실행 테스트

```bash
cloudflared tunnel run smartfarm-api
```

- PC/폰 브라우저에서 `https://smartfarm-api.내도메인.com/health` 접속
- `{"ok": true, "db_exists": true}` 가 나오면 성공

### 2.8 systemd로 자동 실행 (Pi 재부팅 시에도 유지)

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
sudo systemctl status cloudflared
```

---

## 3단계: .env.production 수정 (PC)

터널 URL이 확정되면 PC에서 수정:

파일: `C:\Users\2023user\smartfarm-web\.env.production`

```
VITE_API_BASE=https://smartfarm-api.내도메인.com
```

또는 임시 URL을 사용하는 경우:

```
VITE_API_BASE=https://xxxx-xxxx.trycloudflare.com
```

---

## 4단계: Vercel 배포

### 4.1 Vercel 가입 + GitHub 연결

1. https://vercel.com 접속 → "Sign Up" → **"Continue with GitHub"** 선택
2. GitHub 계정(jinahn417)으로 로그인

### 4.2 프로젝트 import

1. Vercel 대시보드 → "Add New..." → "Project"
2. "Import Git Repository" → `smartfarm-web` 선택
3. **Framework Preset**: `Vite` (자동 감지될 수 있음)
4. **Environment Variables** 에 아래 추가:
   - `VITE_API_BASE` = `https://smartfarm-api.내도메인.com` (터널 URL)
   - `KMA_SERVICE_KEY` = `기상청_서비스키` (VITE_ 접두사 없이! 서버리스 함수용)
5. "Deploy" 클릭

### 4.3 배포 확인

- 배포 완료 후 `https://smartfarm-web.vercel.app` 같은 URL이 발급됩니다
- 이 URL이 외부에서 접속할 주소입니다

### 4.4 이후 코드 변경 시

```powershell
cd C:\Users\2023user\smartfarm-web
git add .
git commit -m "변경 내용 설명"
git push
```

push하면 **Vercel이 자동으로 재빌드/배포**합니다.

---

## 5단계: CORS 업데이트 (라즈베리파이)

Vercel 도메인에서 Pi API를 호출하려면 FastAPI의 CORS 설정을 업데이트해야 합니다.

**Pi 터미널에서:**

```bash
cd ~/smartfarm-api
source .venv/bin/activate
nano main.py
```

`allow_origins=["*"]` 부분을 찾아서 아래로 변경:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://smartfarm-web.vercel.app",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

> `smartfarm-web.vercel.app` 부분을 실제 Vercel에서 받은 도메인으로 교체하세요.
> 개발 중에는 `"*"` 로 두어도 괜찮지만, 배포 후에는 위처럼 제한하는 것이 안전합니다.

변경 후 저장하고 재시작:

```bash
sudo systemctl restart smartfarm-api
```

---

## 6단계: 외부 접속 테스트

1. **폰 데이터(LTE/5G)** 또는 **다른 Wi-Fi 네트워크**에서 테스트
2. Vercel URL (예: `https://smartfarm-web.vercel.app`) 접속
3. 확인 사항:
   - [ ] Overview 탭: 센서 차트와 게이지가 정상 표시
   - [ ] 30초마다 자동 갱신 (새로고침 버튼 옆 시간 변화 확인)
   - [ ] Weather 탭: KMA 날씨 데이터 표시 (서버리스 프록시 사용)
   - [ ] Manual control 탭: 토글 스위치 동작

---

## 7단계: (선택) KMA 프록시 - 이미 설정 완료

> 이 단계는 이미 코드에 포함되어 있습니다.

- `api/kma.js`: Vercel 서버리스 함수 (KMA API를 서버 측에서 호출)
- `App.jsx`: 프로덕션에서는 자동으로 `/api/kma` 프록시를 사용
- Vercel 환경변수에 `KMA_SERVICE_KEY`를 설정하면 Weather 탭이 정상 작동

**장점:**
- 기상청 서비스키가 브라우저에 노출되지 않음
- CORS / HTTP 401 문제 해결

---

## 8단계: (선택) Pi API 보안 강화

Pi API를 인터넷에 노출하면 누구나 센서 데이터를 읽을 수 있습니다.
보안을 위해 API 키 인증을 추가할 수 있습니다.

### 8.1 Pi FastAPI에 API 키 미들웨어 추가

`main.py`에 아래 코드 추가:

```python
import os

API_KEY = os.environ.get("SMARTFARM_API_KEY", "")

@app.middleware("http")
async def check_api_key(request, call_next):
    # health 엔드포인트와 OPTIONS(CORS preflight)는 키 없이 허용
    if request.url.path == "/health" or request.method == "OPTIONS":
        return await call_next(request)
    if API_KEY and request.headers.get("x-api-key") != API_KEY:
        from starlette.responses import JSONResponse
        return JSONResponse({"detail": "Invalid API key"}, status_code=401)
    return await call_next(request)
```

### 8.2 Pi에 API 키 환경변수 설정

```bash
sudo nano /etc/systemd/system/smartfarm-api.service
```

`[Service]` 섹션에 추가:

```ini
Environment=SMARTFARM_API_KEY=여기에_비밀키_입력
```

```bash
sudo systemctl daemon-reload
sudo systemctl restart smartfarm-api
```

### 8.3 프론트엔드에 API 키 추가

`App.jsx`의 `fetch` 호출에 헤더 추가:

```javascript
const res = await fetch(url, {
  signal: ac.signal,
  headers: { "x-api-key": import.meta.env.VITE_API_KEY || "" },
});
```

Vercel 환경변수에 `VITE_API_KEY`를 설정하면 됩니다.

> 주의: `VITE_` 접두사 변수는 브라우저에서 보이므로, 완벽한 보안은 아닙니다.
> 하지만 무단 접근을 상당히 줄일 수 있습니다.

---

## 요약: 최소 필수 작업

| 순서 | 작업 | 위치 | 소요시간 |
|------|------|------|----------|
| 1 | GitHub 로그인 + push | PC 터미널 | 3분 |
| 2 | Cloudflare Tunnel 설정 | Pi SSH | 15분 |
| 3 | .env.production 수정 + push | PC | 2분 |
| 4 | Vercel 가입 + 배포 | 브라우저 | 5분 |
| 5 | CORS 업데이트 | Pi SSH | 3분 |
| 6 | 외부 테스트 | 폰/PC | 2분 |

**총 예상 소요시간: 약 30분**
