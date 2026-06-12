# PM 및 AWS 구현 회고

## 작성 근거

이 문서는 첨부된 PPT 3개와 스크린샷 10개에서 확인된 사실만 기준으로 작성했다.

| 자료 | 확인 범위 |
| --- | --- |
| `DX_13조_설계.pptx` | 10장 전체 확인 |
| `DX_13조_구현.pptx` | 21장 전체 확인 |
| `DX_13조_발표.pptx` | 24장 전체 확인 |
| `screenshots/` | 앱 로그인, 관리자 대응, 서버리스 흐름, 완료 이력, 보호자 화면 확인 |

## 프로젝트 요약

SilverGuard는 실버타운 낙상 사고 발생 시 담당자와 보호자에게 초동 대응 흐름을 자동 전파하고, 사고 이력과 조치 상태를 AWS 기반으로 기록하는 서버리스 플랫폼이다.

PPT에서 확인된 문제 정의는 다음과 같다.

- 야간 당직 간호사 1명이 약 40~42명 입주민을 담당한다.
- 02:00~05:00은 낙상 사고 위험이 큰 시간대다.
- 기존 방식은 무전·전화 연락 중 환자 곁을 떠나야 해 초동 대응이 지연된다.
- 수기 사고 기록 작성에 평균 15분이 소요된다.
- 발표 자료는 기존 전파 시간을 14분, 목표 전파 시간을 3초로 제시한다.

## 내 역할

역할은 PM과 AWS 구현이다. 발표 자료에는 팀 역할 중 `PM 윤재욱`이 명시되어 있고, 구현 자료에는 AWS 구성 요소로 API Gateway, Lambda, DynamoDB, SQS, SNS, CloudWatch, DLQ, EventBridge가 제시되어 있다.

PM 역할에서는 문제 정의, 요구사항 우선순위, API 범위, 데모 흐름, 발표 메시지를 연결하는 역할이 중요했다. AWS 구현 역할에서는 낙상 이벤트가 들어온 뒤 저장, 알림, 상태 변경, 보호자 안내까지 이어지는 서버리스 흐름을 실제 동작 가능한 구조로 구성하는 것이 핵심이었다.

## 기술 역량 정리

### 요구사항 구조화

설계 PPT의 MoSCoW 기준에 따라 필수 범위를 `Must Have`로 좁혔다. 필수 범위는 낙상 이벤트 신규 접수, 이벤트 검증 및 저장, 담당자 1차 알림, 현장 조치 상태 업데이트, 실패 추적 및 운영 모니터링이다.

이 결정은 기능을 많이 넣는 방향이 아니라, 낙상 사고 초동 대응에 직접 필요한 흐름을 먼저 완성하는 방향이다. Bedrock AI 위험도 분류, QuickSight 통계 대시보드, 자체 모바일 앱, EMR 연동은 이번 범위에서 제외했다.

### API 및 서버리스 구현

구현 자료 기준 API는 5개다.

- `POST /fall-events`
- `GET /fall-events`
- `GET /fall-events/{eventId}`
- `PATCH /fall-events/{eventId}/status`
- `POST /fall-events/{eventId}/guardian-notification`

Lambda는 4종으로 역할을 분리했다.

- `IngestLambda`: 낙상 이벤트 수신, 필수값 검증, 멱등성 확인, `event_timestamp`와 `detectedAt` 기반 지연 계산, DynamoDB 저장, SQS 적재
- `NotificationLambda`: SQS 메시지 폴링, SNS 알림 발송, 민감정보 마스킹, 보호자 2차 알림, 실패 시 DLQ 격리
- `EscalationLambda`: EventBridge 1분 주기 기반 미응답 사고 확인, L1/L2/L3 경보 확대
- `HeartbeatLambda`: 5분 주기 생존성 메트릭 발행, 10분 이상 미수신 시 알람

### 데이터 모델링

핵심 테이블은 `SilverTown-FallEvents`다. 주요 필드는 `eventId`, `detectedAt`, `event_timestamp`, `residentId`, `location`, `sourceType`, `severity`, `status`, `ack_status`, `ack_at`, `escalation_level`, `actionResult`로 설계됐다.

GSI는 3개 목적이 확인된다.

- `status + detectedAt`: 미해결 사고 목록 조회
- `residentId + detectedAt`: 특정 입주민 과거 낙상 이력 조회
- `event_timestamp + detectedAt`: 감지 지연 구간 조회 및 SLA 위반 모니터링

### 운영 모니터링 설계

CloudWatch 기준은 지연, 오류율, 실패 추적으로 분류했다.

- 지연: API Gateway `Latency`, `IntegrationLatency`, Lambda `Duration`, `DetectionDelayDeltaSeconds`
- 오류율: `4XXError`, `5XXError`, `429/503` 로그 필터, Lambda `Errors`
- 실패 추적: SQS backlog, DLQ, SNS 실패, Heartbeat 미수신

운영 기준은 p95 3초, `5XX` 1% 초과, DLQ 1건 이상, SNS 실패 1건 이상, Heartbeat 10분 미수신이다.

### 데모 검증

스크린샷에서 확인된 실제 데모 값은 다음과 같다.

- `screenshots/03-incident-received-pipeline.png`: 낙상 사고 접수 후 API Gateway 응답 약 700ms, DynamoDB 저장, SQS/SNS 알림 단계 표시
- `screenshots/04-response-completed-guardian-sent.png`: 보호자 2차 안내 `SENT`, 보호자 알림 실측 616ms, 전체 완료 40.1초 표시
- `screenshots/05-event-history-completed.png`: 완료 이력에 `COMPLETED` 상태 표시
- `screenshots/06-guardian-completed-home.png`: 보호자 화면에 조치 완료 및 발송 완료 상태 표시

단, 40.1초는 전체 데모 완료 시간으로 보이며, 시스템 API 응답 시간 700ms와 직접 동일한 지표가 아니다. 전체 완료 시간에는 담당자 확인과 대응 완료 버튼 조작 같은 사용자 조작 시간이 포함된다.

## 어려웠던 점

### 현장 문제를 기술 범위로 바꾸는 과정

초기 문제는 “낙상 사고 대응이 늦다”였지만, 구현 가능한 범위로 바꾸려면 API, 상태값, 알림 흐름, 장애 대응 기준으로 쪼개야 했다. 이를 해결하기 위해 MoSCoW 우선순위를 사용했고, 핵심 범위를 5개 API와 4개 Lambda로 고정했다.

### 빠른 알림과 기록 보존을 동시에 만족시키는 구조

낙상 대응은 빠르게 알리는 것만으로 끝나지 않고, 누가 언제 확인했는지 기록도 남아야 한다. 그래서 `status`, `ack_status`, `ack_at`, `escalation_level`, `actionResult`를 FallEvents에 포함했고, `RECEIVED → IN_PROGRESS → COMPLETED → ESCALATED` 상태 흐름을 사용했다.

### 장애를 단일 로그가 아니라 운영 기준으로 보는 과정

처음부터 모든 CloudWatch 지표를 다 보면 운영자가 판단하기 어렵다. 구현 자료에서는 지표를 지연, 오류율, 실패 추적 3개 축으로 줄였다. 이 방식으로 `429`는 센서 폭주나 중복 호출, `503`은 서버리스 구성요소 장애 신호로 분리해 대응하도록 설계했다.

### 배포 환경 변수 불일치

이번 배포 과정에서 `SeniorSafety` Hugging Face Space에는 처음에 `API_KEY` secret이 없었다. 기존 정상 동작 Space의 공개 `server.js`는 `API_KEY`를 필수로 요구했고, AWS Lambda 환경 변수에서 동일한 목적의 `API_KEY`가 확인됐다. 해당 값을 Hugging Face secret으로 등록하고 Space를 재시작해 API Key 오류를 해결했다. 실제 secret 값은 문서와 저장소에 기록하지 않는다.

## 부족했던 점

발표 PPT의 한계 슬라이드에서 확인된 현재 버전의 부족한 점은 다음과 같다.

- 낙상 감지 AI 부재: 외부 AI/CCTV 이벤트에 의존하고, 자체 오탐 필터링 로직은 미구현
- 단일 시설 PoC 규모: 월 트래픽 1,500건 가정이며 멀티테넌트와 대규모 동시 사고는 미검증
- CI/CD 파이프라인 부재: 현재 수동 배포이며 CodePipeline 또는 GitHub Actions 자동화 미적용
- 실제 SMS/Email 비용: 국내 SMS 비용이 높아 카카오 알림톡 같은 대체 채널 검토 필요
- Cognito Authorizer 미구현: 현재 API Key 기반이며 JWT와 역할별 접근 제어가 필요
- 전용 모바일 앱 부재: 현장 직원은 전용 앱 없이 알림 수신에 의존

## 해결 방향

발표 PPT의 로드맵 기준 개선 순서는 다음과 같다.

1. Phase 1: CI/CD 파이프라인 구축, Cognito JWT 기반 역할별 접근 제어, 오탐 필터링, SMS 채널 대체 검토
2. Phase 2: CloudWatch Synthetics 외부 모니터링, QuickSight 사고 통계 대시보드, 멀티테넌트 확장, Bedrock AI 위험도 자동 분류
3. Phase 3: 전용 간호사 모바일 앱, EMR 연동, 실시간 위치 추적, B2B SaaS 전환

개선 우선순위는 CI/CD 자동화, Cognito 인증 강화, 오탐 필터링 순서가 적절하다. 이유는 현재 한계 중 운영 안정성과 보안에 직접 영향을 주는 항목이 먼저 해결되어야 하기 때문이다.

## 데이터 기반 의사결정

| 결정 | 근거 |
| --- | --- |
| 서버리스 선택 | 발표 PPT는 EC2 월 $50, Lambda 중심 서버리스 월 $5 내외를 제시했고, 낙상 이벤트가 간헐적 요청이라는 점을 근거로 서버리스가 비용 효율적이라고 설명한다. |
| SQS/DLQ 사용 | 구현 PPT는 알림 폭주 완충, 3회 재시도 후 DLQ 격리, 실패 이벤트 수동 재처리를 근거로 제시한다. |
| CloudWatch 중심 운영 | 구현 PPT는 p95 3초, 5XX 1%, DLQ 1건, Heartbeat 10분 미수신을 운영 판단 기준으로 제시한다. |
| API 5개로 범위 고정 | 설계 PPT의 IDD와 MoSCoW에서 낙상 접수, 목록/상세 조회, 상태 변경, 보호자 2차 알림으로 API 범위를 분리했다. |
| 보호자 알림을 2차로 분리 | 설계 PPT는 보호자 안심 알림을 Should Have로 분류했고, 구현 흐름에서는 현장 조치 후 보호자 안내를 발송하는 구조로 확인된다. |

정량 근거 중 주의할 점도 있다. 발표 PPT에는 `EC2 월 $50 → Lambda 월 $5`, `월 $45 절감`, `연간 $1,344 절감`이 함께 나온다. 월 $45 절감이면 단순 연산상 연 $540이므로, 본 문서에서는 산술이 직접 맞는 `월 $50 → $5`, `약 90% 절감`만 판단 근거로 사용한다.

## 포트폴리오용 요약 문장

PM과 AWS 구현을 담당하며 실버타운 낙상 사고 초동 대응 문제를 5개 HTTP API와 4개 Lambda 기반 서버리스 아키텍처로 구현했다. 야간 1인 근무, 수기 기록 평균 15분, 기존 전파 14분이라는 현장 문제를 MoSCoW와 IDD로 구조화했고, Ingest Lambda, DynamoDB, SQS, SNS, CloudWatch, DLQ를 연결해 이벤트 접수부터 담당자 알림, 상태 변경, 보호자 2차 안내까지 동작하는 PoC를 완성했다. 운영 관점에서는 p95 3초, 5XX 1%, DLQ 1건, Heartbeat 10분 미수신 같은 기준을 정의해 장애 판단 기준을 명확히 했다.

## 참고 스크린샷

- [로그인 화면](../screenshots/01-login.png)
- [관리자 초기 상태 및 실시간 흐름](../screenshots/02-admin-ready-live-flow.png)
- [낙상 사고 접수 및 서버리스 처리 흐름](../screenshots/03-incident-received-pipeline.png)
- [대응 완료 및 보호자 안내 발송](../screenshots/04-response-completed-guardian-sent.png)
- [완료 이력](../screenshots/05-event-history-completed.png)
- [보호자 조치 완료 화면](../screenshots/06-guardian-completed-home.png)
