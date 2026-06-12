---
title: SeniorSafety
emoji: 🛡️
colorFrom: yellow
colorTo: red
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# SilverGuard Guardian

SilverGuard Guardian은 낙상 이벤트 접수, 시설 담당자 대응, 보호자 안내 흐름을 시연하는 웹 애플리케이션입니다. React/Vite 프론트엔드와 Express 프록시 서버로 구성되어 있으며, Hugging Face Spaces의 Docker SDK로 배포할 수 있습니다.

## 주요 기능

- 관리자/보호자 데모 로그인
- 낙상 이벤트 생성 및 처리 상태 추적
- 관리자 대응 시작/완료 처리
- 보호자 알림 요청 흐름 시뮬레이션
- Hugging Face Space에서 AWS API로 요청을 중계하는 Express 프록시

## 기술 스택

- React
- Vite
- Express
- Docker
- Hugging Face Spaces Docker SDK

## 실행 구조

```text
Browser
  -> React/Vite UI
  -> Express API proxy (/api/*)
  -> External API configured by API_BASE_URL and optional API_KEY
```

프론트엔드는 직접 외부 API 키를 사용하지 않습니다. 서버인 `server.js`가 환경변수를 읽어 외부 API로 요청을 전달합니다.

## 환경변수

배포 환경에는 다음 값을 등록해야 합니다.

```env
API_BASE_URL=https://your-api.example.com
```

`API_BASE_URL`은 민감값이 아니면 Hugging Face Space variable로 등록합니다.

외부 API가 `x-api-key` 인증을 요구할 때만 다음 값을 secret으로 추가 등록합니다.

```env
API_KEY=your-api-key
```

주의: API 키, Hugging Face 토큰, SendGrid 키 같은 민감 정보는 README, Git 커밋, 프론트엔드 코드에 저장하지 않습니다. Hugging Face Spaces에서는 Settings의 Variables and secrets에 등록합니다.

## 로컬 실행

```bash
npm install
npm run dev
```

개발 서버는 기본적으로 `http://localhost:7860`에서 실행됩니다.

## 프로덕션 실행

```bash
npm install
npm run build
npm run start
```

서버는 기본 포트 `7860`을 사용합니다. 다른 포트를 쓰려면 `PORT` 환경변수를 지정합니다.

## Docker 실행

```bash
docker build -t silverguard-guardian .
docker run --rm -p 7860:7860 \
  -e API_BASE_URL=https://your-api.example.com \
  silverguard-guardian
```

Windows PowerShell 예시:

```powershell
docker build -t silverguard-guardian .
docker run --rm -p 7860:7860 `
  -e API_BASE_URL="https://your-api.example.com" `
  silverguard-guardian
```

## Hugging Face Spaces 배포

이 저장소는 Streamlit 앱이 아니라 Node/React Docker 앱입니다. Hugging Face Spaces에 배포할 때는 SDK를 `Docker`로 선택해야 합니다.

대상 예시:

```text
https://huggingface.co/spaces/ukss/SeniorSafety
```

배포 절차:

1. Hugging Face에서 새 Space를 생성합니다.
2. Owner를 `ukss`로 선택합니다.
3. Space name을 `SeniorSafety`로 지정합니다.
4. SDK를 `Docker`로 선택합니다.
5. Settings -> Variables and secrets에 `API_BASE_URL`을 variable로 등록합니다.
6. 이 저장소를 Space Git remote로 push합니다.

예시:

```bash
git remote add hf https://huggingface.co/spaces/ukss/SeniorSafety
git push hf main
```

이미 `origin`을 Hugging Face Space로 쓰고 있다면 다음처럼 원격 URL을 바꿀 수 있습니다.

```bash
git remote set-url origin https://huggingface.co/spaces/ukss/SeniorSafety
git push origin main
```

## GitHub 업로드

GitHub 저장소가 이미 있다면 원격을 추가한 뒤 push합니다.

```bash
git remote add github https://github.com/YOUR_GITHUB_USERNAME/silverguard-guardian-docker.git
git push github main
```

GitHub Actions나 GitHub Pages 설정은 이 Docker 기반 앱 배포에 필수는 아닙니다. Hugging Face Spaces 배포는 Space 저장소로 push하면 Dockerfile 기준으로 빌드됩니다.

## 데모 계정

| 역할 | ID | Password |
| --- | --- | --- |
| 관리자 | `admin` | `admin123` |
| 보호자 | `guardian` | `guardian123` |

## API 프록시 엔드포인트

Express 서버는 다음 경로를 외부 API로 전달합니다.

- `POST /api/fall-events`
- `GET /api/fall-events`
- `GET /api/fall-events/:eventId`
- `PATCH /api/fall-events/:eventId/status`
- `POST /api/fall-events/:eventId/guardian-notification`

## 보안 메모

- `HF_TOKEN`, `SENDGRID_API_KEY`, 외부 API 키는 저장소에 커밋하지 않습니다.
- 브라우저에 노출되는 `src/*` 파일에 secret을 넣지 않습니다.
- 배포 토큰이 대화, 로그, 커밋에 노출된 경우 즉시 폐기하고 재발급합니다.
