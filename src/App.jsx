import React, { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  Bell,
  Home,
  FileText,
  MessageCircle,
  Phone,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Wifi,
  X,
  LogOut,
  UserRound,
  Building2,
  Activity,
  RefreshCcw,
  MapPin,
  Siren,
  Send,
  CheckCheck
} from "lucide-react";
import {
  createFallEventApi,
  listFallEventsApi,
  updateFallEventStatusApi,
  sendGuardianNotificationApi
} from "./awsApi.js";

const DEMO_USERS = [
  {
    id: "admin",
    password: "admin123",
    role: "admin",
    name: "시설 담당자",
    subtitle: "낙상 사고 대응 담당자"
  },
  {
    id: "guardian",
    password: "guardian123",
    role: "guardian",
    name: "김보호님",
    subtitle: "보호자 안심 알림 수신자"
  }
];

const DEFAULT_INCIDENT = {
  eventId: "FE-DEMO-001",
  status: "STABLE",
  location: "3층 체련장",
  displayLocation: "시설 공용공간",
  residentLabel: "어르신",
  severity: "HIGH",
  detectedAt: "-",
  event_timestamp: "-",
  ack_status: "NONE",
  ack_at: null,
  escalation_level: 0,
  guardianNotification: "NOT_SENT",
  actionResult: "",
  flowStartedAtMs: null,
  flowEndedAtMs: null,
  flowUpdatedAtMs: null,
  apiLatencyMs: null,
  payloadBytes: null,
  statusUpdateLatencyMs: null,
  completeLatencyMs: null,
  guardianLatencyMs: null
};

const DEFAULT_NOTIFICATIONS = [
  {
    id: 1,
    role: "guardian",
    time: "초기 상태",
    title: "안정 상태",
    body: "현재 등록된 낙상 사고가 없습니다.",
    unread: false
  },
  {
    id: 2,
    role: "admin",
    time: "초기 상태",
    title: "대기 중",
    body: "신규 낙상 이벤트 수신을 대기하고 있습니다.",
    unread: false
  }
];

function nowTime() {
  return new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function makeEventId() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const t = String(Date.now()).slice(-4);
  return `FE-${y}${m}${day}-${t}`;
}

function loadFromStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function getGuardianContent(status) {
  if (status === "RECEIVED") {
    return {
      icon: <AlertTriangle size={34} />,
      badge: "접수됨",
      title: "낙상 사고가 접수되었습니다",
      subtitle: "시설에서 어르신 상태를 확인 중입니다.",
      message: "담당자가 확인한 뒤 조치 상황을 안내드리겠습니다.",
      tone: "warning"
    };
  }

  if (status === "IN_PROGRESS") {
    return {
      icon: <Clock3 size={34} />,
      badge: "대응 중",
      title: "시설 담당자가 대응 중입니다",
      subtitle: "담당자가 현장 확인을 진행하고 있습니다.",
      message: "추가 안내가 필요한 경우 시설에서 별도로 연락드립니다.",
      tone: "progress"
    };
  }

  if (status === "COMPLETED") {
    return {
      icon: <ShieldCheck size={34} />,
      badge: "조치 완료",
      title: "조치가 완료되었습니다",
      subtitle: "현재 안정 상태로 확인되었습니다.",
      message: "자세한 사항은 시설로 문의 바랍니다.",
      tone: "stable"
    };
  }

  return {
    icon: <ShieldCheck size={34} />,
    badge: "안정 상태",
    title: "현재 안정 상태입니다",
    subtitle: "등록된 낙상 사고가 없습니다.",
    message: "새로운 안내가 발생하면 이 화면에서 확인할 수 있습니다.",
    tone: "stable"
  };
}

function getAdminContent(status) {
  if (status === "RECEIVED") {
    return {
      icon: <Siren size={34} />,
      badge: "미확인",
      title: "낙상 사고 발생",
      subtitle: "현장 확인 및 대응 시작이 필요합니다.",
      message: "발생 위치를 확인하고 즉시 대응 시작 버튼을 눌러 주세요.",
      tone: "warning"
    };
  }

  if (status === "IN_PROGRESS") {
    return {
      icon: <Activity size={34} />,
      badge: "대응 중",
      title: "현장 대응 중",
      subtitle: "담당자 확인이 완료되었습니다.",
      message: "현장 조치가 끝나면 대응 완료 버튼을 눌러 보호자 안내를 발송하세요.",
      tone: "progress"
    };
  }

  if (status === "COMPLETED") {
    return {
      icon: <CheckCheck size={34} />,
      badge: "완료",
      title: "대응 완료",
      subtitle: "보호자 안내가 발송되었습니다.",
      message: "사고 조치가 완료되었고 보호자에게 안심 안내가 발송되었습니다.",
      tone: "stable"
    };
  }

  return {
    icon: <ShieldCheck size={34} />,
    badge: "대기 중",
    title: "신규 사고 대기 중",
    subtitle: "현재 처리할 낙상 이벤트가 없습니다.",
    message: "데모 시연을 위해 낙상 이벤트 발생 버튼을 눌러 흐름을 시작할 수 있습니다.",
    tone: "stable"
  };
}

function getTimeline(status) {
  const steps = [
    ["낙상 사고 접수", "RECEIVED"],
    ["담당자 확인", "IN_PROGRESS"],
    ["현장 대응 중", "IN_PROGRESS"],
    ["조치 완료", "COMPLETED"],
    ["보호자 안내 발송", "COMPLETED"]
  ];

  return steps.map((step, index) => {
    const [label, required] = step;
    let state = "pending";

    if (status === "RECEIVED") {
      state = index === 0 ? "done" : "pending";
    }

    if (status === "IN_PROGRESS") {
      state = index <= 2 ? "done" : "pending";
      if (index === 2) state = "progress";
    }

    if (status === "COMPLETED") {
      state = "done";
    }

    if (status === "STABLE") {
      state = "pending";
    }

    return {
      label,
      required,
      state
    };
  });
}

function LoginScreen({ onLogin, toast }) {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");

  function submit(e) {
    e.preventDefault();
    onLogin(id, password);
  }

  function quickLogin(user) {
    setId(user.id);
    setPassword(user.password);
    onLogin(user.id, user.password);
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-logo">
          <ShieldCheck size={38} />
        </div>

        <h1>SilverGuard</h1>
        <p className="login-subtitle">
          실버타운 낙상 사고 초동대응 플랫폼
        </p>

        <form className="login-form" onSubmit={submit}>
          <label>
            <span>아이디</span>
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="admin 또는 guardian"
            />
          </label>

          <label>
            <span>비밀번호</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              type="password"
            />
          </label>

          <button className="primary-button full" type="submit">
            로그인
          </button>
        </form>

        <div className="demo-accounts">
          <p>데모 계정</p>

          <button onClick={() => quickLogin(DEMO_USERS[0])}>
            <Building2 size={17} />
            <div>
              <strong>관리자 계정</strong>
              <span>ID admin / PW admin123</span>
            </div>
          </button>

          <button onClick={() => quickLogin(DEMO_USERS[1])}>
            <UserRound size={17} />
            <div>
              <strong>보호자 계정</strong>
              <span>ID guardian / PW guardian123</span>
            </div>
          </button>
        </div>
      </div>

      {toast && <div className="global-toast">{toast}</div>}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("home");
  const [incident, setIncident] = useState(() =>
    loadFromStorage("sg_incident", DEFAULT_INCIDENT)
  );
  const [notifications, setNotifications] = useState(() =>
    loadFromStorage("sg_notifications", DEFAULT_NOTIFICATIONS)
  );
  const [lastUpdated, setLastUpdated] = useState(0);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(null);
  const [selectedHistory, setSelectedHistory] = useState(null);

  const isAdmin = user?.role === "admin";
  const visibleNotifications = notifications.filter((n) => n.role === user?.role);
  const unreadCount = visibleNotifications.filter((n) => n.unread).length;

  const content = useMemo(() => {
    return isAdmin
      ? getAdminContent(incident.status)
      : getGuardianContent(incident.status);
  }, [incident.status, isAdmin]);

  const timeline = useMemo(() => getTimeline(incident.status), [incident.status]);

  useEffect(() => {
    localStorage.setItem("sg_incident", JSON.stringify(incident));
  }, [incident]);

  useEffect(() => {
    localStorage.setItem("sg_notifications", JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    const timer = setInterval(() => {
      setLastUpdated((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // AWS 실시간 동기화: REST API 구조이므로 3초 폴링 방식
  useEffect(() => {
    if (!user) return;

    const timer = setInterval(async () => {
      try {
        const data = await listFallEventsApi();
        const events = Array.isArray(data) ? data : data?.items || [];

        if (events.length > 0) {
          const latest = events[0];

          setIncident((prev) => ({
            ...prev,
            eventId: latest.eventId || prev.eventId,
            status: latest.status || prev.status,
            location: latest.location || prev.location,
            detectedAt: latest.detectedAt || prev.detectedAt,
            event_timestamp: latest.event_timestamp || prev.event_timestamp,
            ack_status: latest.ack_status || prev.ack_status,
            ack_at: latest.ack_at || prev.ack_at,
            escalation_level: latest.escalation_level ?? prev.escalation_level
          }));
        }
      } catch (err) {
        console.warn("AWS 실시간 조회 실패:", err.message);
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [user]);


  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(""), 2500);
  }

  function login(id, password) {
    const found = DEMO_USERS.find(
      (u) => u.id === id.trim() && u.password === password.trim()
    );

    if (!found) {
      showToast("데모 계정 정보를 확인해 주세요.");
      return;
    }

    setUser(found);
    setTab("home");
    showToast(`${found.name} 계정으로 로그인했습니다.`);
  }

  function logout() {
    setUser(null);
    setTab("home");
  }

  function addNotification(role, title, body) {
    setNotifications((prev) => [
      {
        id: Date.now() + Math.random(),
        role,
        time: nowTime(),
        title,
        body,
        unread: true
      },
      ...prev
    ]);
  }

  function markRead(id) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
  }

  function readAll() {
    setNotifications((prev) =>
      prev.map((n) => (n.role === user.role ? { ...n, unread: false } : n))
    );
    showToast("모든 알림을 읽음 처리했습니다.");
  }

  async function createFallEvent() {
    const nowIso = new Date().toISOString();

    const payload = {
      residentId: "R1001",
      location: "3층 복도 체련실 앞",
      detectedAt: nowIso,
      event_timestamp: nowIso,
      sourceType: "CCTV",
      severity: "HIGH"
    };

    const flowStartedAtMs = Date.now();
    const payloadText = JSON.stringify(payload);
    const payloadBytes = new Blob([payloadText]).size;

    try {
      showToast("AWS로 낙상 이벤트를 전송 중입니다...");

      const apiStartMs = performance.now();
      const result = await createFallEventApi(payload);
      const apiLatencyMs = Math.round(performance.now() - apiStartMs);

      const newIncident = {
        eventId: result.eventId || makeEventId(),
        status: result.status || "RECEIVED",
        location: payload.location,
        displayLocation: "시설 공용공간",
        residentLabel: "어르신",
        severity: payload.severity,
        detectedAt: payload.detectedAt,
        event_timestamp: payload.event_timestamp,
        ack_status: "UNACKNOWLEDGED",
        ack_at: null,
        escalation_level: 0,
        guardianNotification: "NOT_SENT",
        actionResult: "AWS API Gateway를 통해 낙상 사고가 접수됨",

        flowStartedAtMs,
        flowEndedAtMs: null,
        flowUpdatedAtMs: Date.now(),
        apiLatencyMs,
        payloadBytes,
        statusUpdateLatencyMs: null,
        completeLatencyMs: null,
        guardianLatencyMs: null
      };

      setIncident(newIncident);
      setLastUpdated(0);

      addNotification(
        "admin",
        "[긴급] 낙상 사고 발생",
        "AWS API Gateway를 통해 낙상 사고가 접수되었습니다. 즉시 현장 확인이 필요합니다."
      );

      addNotification(
        "guardian",
        "낙상 사고 접수 안내",
        "시설에서 어르신 상태를 확인 중입니다. 확인 결과는 조치 후 안내드리겠습니다."
      );

      showToast("AWS 연동 성공: 낙상 이벤트가 접수되었습니다.");
    } catch (err) {
      console.error(err);
      showToast(`AWS 연동 실패: ${err.message}`);
    }
  }

  async function startResponse() {
    if (incident.status !== "RECEIVED") return;

    try {
      const patchStartMs = performance.now();

      await updateFallEventStatusApi(incident.eventId, {
        status: "IN_PROGRESS",
        detectedAt: incident.detectedAt,
        event_timestamp: incident.event_timestamp,
        ack_status: "ACKNOWLEDGED",
        ack_by: "ADMIN_DEMO",
        actionResult: "시설 담당자가 현장 대응을 시작함"
      });

      const statusUpdateLatencyMs = Math.round(performance.now() - patchStartMs);

      setIncident((prev) => ({
        ...prev,
        status: "IN_PROGRESS",
        ack_status: "ACKNOWLEDGED",
        ack_at: new Date().toISOString(),
        escalation_level: 0,
        actionResult: "시설 담당자가 현장 대응을 시작함",
        statusUpdateLatencyMs,
        flowEndedAtMs: null,
        flowUpdatedAtMs: Date.now()
      }));

      setLastUpdated(0);

      addNotification(
        "admin",
        "대응 시작 처리 완료",
        "AWS에 현장 대응 시작 상태가 저장되었습니다."
      );

      addNotification(
        "guardian",
        "시설 담당자 대응 중",
        "담당자가 현장 확인을 진행하고 있습니다. 추가 안내가 필요한 경우 시설에서 연락드립니다."
      );

      showToast("AWS 상태 업데이트 성공: 대응 시작");
    } catch (err) {
      console.error(err);
      showToast(`상태 업데이트 실패: ${err.message}`);
    }
  }

  async function completeResponse() {
    if (incident.status !== "IN_PROGRESS") return;

    try {
      const completeStartMs = performance.now();

      await updateFallEventStatusApi(incident.eventId, {
        status: "COMPLETED",
        detectedAt: incident.detectedAt,
        event_timestamp: incident.event_timestamp,
        actionResult: "현장 확인 및 초동 조치 완료"
      });

      const completeLatencyMs = Math.round(performance.now() - completeStartMs);

      let guardianSent = false;
      let guardianLatencyMs = null;

      try {
        const guardianStartMs = performance.now();

        await sendGuardianNotificationApi(incident.eventId, {
          notifyGuardian: true,
          detectedAt: incident.detectedAt,
          event_timestamp: incident.event_timestamp,
          message: "안내 말씀 드립니다. 어르신 낙상 사고가 있었으나 초동 조치 후 안정 취하시는 상태입니다."
        });

        guardianLatencyMs = Math.round(performance.now() - guardianStartMs);
        guardianSent = true;
      } catch (guardianErr) {
        console.warn("보호자 알림 요청 실패:", guardianErr);
      }

      const flowEndedAtMs = Date.now();

      setIncident((prev) => ({
        ...prev,
        status: "COMPLETED",
        guardianNotification: guardianSent ? "SENT" : "FAILED",
        actionResult: "현장 확인 및 초동 조치 완료",
        completeLatencyMs,
        guardianLatencyMs,
        flowEndedAtMs,
        flowUpdatedAtMs: flowEndedAtMs
      }));

      setLastUpdated(0);

      addNotification(
        "admin",
        "대응 완료 처리",
        guardianSent
          ? "AWS에 조치 완료 상태가 저장되고 보호자 알림이 요청되었습니다."
          : "AWS에 조치 완료 상태는 저장되었지만 보호자 알림 요청은 실패했습니다."
      );

      addNotification(
        "guardian",
        "조치 완료 안내",
        "현재 안정 상태로 확인되었습니다. 자세한 사항은 시설로 문의 바랍니다."
      );

      showToast(
        guardianSent
          ? "AWS 연동 성공: 대응 완료 및 보호자 알림 요청"
          : "대응 완료 저장 성공, 보호자 알림은 실패"
      );
    } catch (err) {
      console.error(err);
      showToast(`대응 완료 처리 실패: ${err.message}`);
    }
  }

  function resetDemo() {
    setIncident(DEFAULT_INCIDENT);
    setNotifications(DEFAULT_NOTIFICATIONS);
    setLastUpdated(0);
    showToast("데모 상태를 초기화했습니다.");
  }

  function openHistory(item) {
    setSelectedHistory(item);
    setModal("history");
  }

  if (!user) {
    return <LoginScreen onLogin={login} toast={toast} />;
  }

  const navItems = [
    { key: "home", label: isAdmin ? "대응" : "홈", icon: Home },
    { key: "notifications", label: "알림", icon: Bell },
    { key: "history", label: "기록", icon: FileText },
    { key: "contact", label: isAdmin ? "운영" : "문의", icon: MessageCircle }
  ];

  return (
    <div className="app-shell">
      <div className="bg-orb orb-one" />
      <div className="bg-orb orb-two" />
      <div className="bg-orb orb-three" />

      <main className="phone">
        <header className="app-header">
          <div className="header-top">
            <div className="brand">
              <div className="brand-icon">
                <ShieldCheck size={26} />
              </div>
              <div>
                <h1>SilverGuard</h1>
                <p>{isAdmin ? "시설 담당자 모드" : "보호자 안심 알림"}</p>
              </div>
            </div>

            <button className="logout-button" type="button" onClick={logout}>
              <LogOut size={18} />
            </button>
          </div>

          <div className="user-card">
            <div>
              <span>{isAdmin ? "관리자 계정" : "보호자 계정"}</span>
              <strong>{user.name}</strong>
            </div>

            <div className="live-pill">
              <Wifi size={13} />
              데모 모드
              {unreadCount > 0 && <b>{unreadCount}</b>}
            </div>
          </div>
        </header>

        <section className="screen">
          {tab === "home" && (
            <section className="page">
              <div className="page-title-row">
                <div>
                  <p className="eyebrow">
                    {isAdmin ? "STAFF RESPONSE" : "TODAY STATUS"}
                  </p>
                  <h2>{isAdmin ? "낙상 대응 현황" : "오늘의 안심 현황"}</h2>
                </div>

                {isAdmin && (
                  <button className="small-button" onClick={createFallEvent}>
                    사고 발생
                  </button>
                )}
              </div>

              <section className={`hero-card ${content.tone}`}>
                <div className="hero-top">
                  <div className="status-icon">{content.icon}</div>
                  <span className="status-badge">{content.badge}</span>
                </div>

                <h2>{content.title}</h2>
                <p>{content.subtitle}</p>

                <div className="update-line">
                  <span>마지막 업데이트</span>
                  <strong>{lastUpdated}초 전</strong>
                </div>
              </section>

              {isAdmin ? (
                <AdminPanel
                  incident={incident}
                  content={content}
                  onStart={startResponse}
                  onComplete={completeResponse}
                  onReset={resetDemo}
                />
              ) : (
                <GuardianPanel incident={incident} content={content} />
              )}

              <section className="card">
                <div className="section-head">
                  <div className="round-icon">
                    <Clock3 size={18} />
                  </div>
                  <h3>진행 상황</h3>
                </div>

                <div className="timeline">
                  {timeline.map((step, index) => (
                    <div className="time-item" key={step.label}>
                      <div className={`time-mark ${step.state}`}>
                        {step.state === "done" ? (
                          <CheckCircle2 size={18} />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <div className="time-body">
                        <strong>{step.label}</strong>
                        {step.state === "progress" && <em>진행 중</em>}
                        <p>{incident.status === "STABLE" ? "대기" : "업데이트됨"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {!isAdmin && (
                <section className="notice-card">
                  <div className="section-head">
                    <div className="round-icon">
                      <Sparkles size={18} />
                    </div>
                    <h3>안내 사항</h3>
                  </div>
                  <p>추가 조치가 필요한 경우 시설 담당자가 별도로 연락드립니다.</p>
                  <small>
                    개인정보 보호를 위해 상세 위치와 민감 정보는 표시되지 않습니다.
                  </small>
                </section>
              )}
            </section>
          )}

          {tab === "notifications" && (
            <section className="page">
              <div className="page-title-row">
                <div>
                  <p className="eyebrow">NOTIFICATIONS</p>
                  <h2>받은 알림</h2>
                </div>
                <button className="small-button" onClick={readAll}>
                  모두 읽음
                </button>
              </div>

              <div className="summary-pill">
                읽지 않은 알림 <strong>{unreadCount}</strong>건
              </div>

              <div className="list">
                {visibleNotifications.map((item) => (
                  <button
                    className={`list-card notification ${item.unread ? "unread" : ""}`}
                    key={item.id}
                    onClick={() => markRead(item.id)}
                  >
                    <div>
                      <span>{item.time}</span>
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                    </div>
                    {item.unread && <i />}
                  </button>
                ))}
              </div>
            </section>
          )}

          {tab === "history" && (
            <section className="page">
              <p className="eyebrow">EVENT HISTORY</p>
              <h2 className="page-title">안내 기록</h2>

              <div className="list with-margin">
                <button
                  className="list-card history"
                  onClick={() =>
                    openHistory({
                      title: "현재 데모 사고",
                      date: incident.detectedAt,
                      status: incident.status,
                      desc: incident.actionResult || "현재 처리 중인 사고 이력이 없습니다."
                    })
                  }
                >
                  <div>
                    <span>{incident.detectedAt}</span>
                    <h3>{incident.eventId}</h3>
                    <p>{incident.actionResult || "현재 처리 중인 사고 이력이 없습니다."}</p>
                  </div>
                  <strong>{incident.status}</strong>
                </button>

                <button
                  className="list-card history"
                  onClick={() =>
                    openHistory({
                      title: "정기 상태 확인",
                      date: "2026.05.28",
                      status: "이상 없음",
                      desc: "시설 정기 확인 완료"
                    })
                  }
                >
                  <div>
                    <span>2026.05.28</span>
                    <h3>정기 상태 확인</h3>
                    <p>시설 정기 확인 완료</p>
                  </div>
                  <strong>이상 없음</strong>
                </button>
              </div>
            </section>
          )}

          {tab === "contact" && (
            <section className="page">
              {isAdmin ? (
                <AdminOpsPanel incident={incident} resetDemo={resetDemo} />
              ) : (
                <GuardianContact setModal={setModal} />
              )}
            </section>
          )}
        </section>

        <nav className="bottom-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={tab === item.key ? "active" : ""}
                onClick={() => setTab(item.key)}
              >
                <Icon size={19} />
                {item.label}
                {item.key === "notifications" && unreadCount > 0 && (
                  <i>{unreadCount}</i>
                )}
              </button>
            );
          })}
        </nav>

        {toast && <div className="toast">{toast}</div>}

        {modal === "contact" && (
          <div className="modal-backdrop">
            <section className="sheet">
              <button className="sheet-close" onClick={() => setModal(null)}>
                <X size={22} />
              </button>
              <div className="sheet-icon">
                <Phone size={28} />
              </div>
              <h2>시설 문의</h2>
              <p>
                담당자가 현재 상황을 확인하고 있습니다. 긴급한 문의가 필요한 경우 시설 대표번호로 연락해 주세요.
              </p>
              <button
                className="primary-button full"
                onClick={() => {
                  setModal(null);
                  showToast("시설 문의 요청이 준비되었습니다.");
                }}
              >
                전화 연결
              </button>
              <button className="secondary-button full" onClick={() => setModal(null)}>
                닫기
              </button>
            </section>
          </div>
        )}

        {modal === "history" && selectedHistory && (
          <div className="modal-backdrop">
            <section className="sheet">
              <button className="sheet-close" onClick={() => setModal(null)}>
                <X size={22} />
              </button>
              <div className="sheet-icon">
                <FileText size={28} />
              </div>
              <h2>{selectedHistory.title}</h2>
              <p>
                {selectedHistory.date} · {selectedHistory.status}
              </p>
              <div className="message-box">{selectedHistory.desc}</div>
              <button className="primary-button full" onClick={() => setModal(null)}>
                확인
              </button>
            </section>
          </div>
        )}
      </main>

      <LiveFlowPanel
        incident={incident}
        lastUpdated={lastUpdated}
        isAdmin={isAdmin}
      />
    </div>
  );
}

function LiveFlowPanel({ incident, lastUpdated, isAdmin }) {
  const [liveNowMs, setLiveNowMs] = useState(Date.now());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setLiveNowMs(Date.now());
    }, 100);

    return () => clearInterval(intervalId);
  }, []);

  const isReceived = incident.status === "RECEIVED";
  const isProgress = incident.status === "IN_PROGRESS";
  const isCompleted = incident.status === "COMPLETED";

  const hasFlowStarted = typeof incident.flowStartedAtMs === "number";
  const flowStartedAtMs = hasFlowStarted ? incident.flowStartedAtMs : null;

  const completedAtMs =
    isCompleted && typeof incident.flowEndedAtMs === "number"
      ? incident.flowEndedAtMs
      : isCompleted && typeof incident.flowUpdatedAtMs === "number"
      ? incident.flowUpdatedAtMs
      : null;

  const isTimerRunning = hasFlowStarted && !isCompleted && (isReceived || isProgress);
  const isTimerFrozen = hasFlowStarted && isCompleted && typeof completedAtMs === "number";

  const elapsedMs = isTimerFrozen
    ? Math.max(0, completedAtMs - flowStartedAtMs)
    : isTimerRunning
    ? Math.max(0, liveNowMs - flowStartedAtMs)
    : 0;

  const elapsedSec = (elapsedMs / 1000).toFixed(1);

  const apiLatencyMs = incident.apiLatencyMs || null;
  const statusUpdateLatencyMs = incident.statusUpdateLatencyMs || null;
  const completeLatencyMs = incident.completeLatencyMs || null;
  const guardianLatencyMs = incident.guardianLatencyMs || null;

  const payloadBytes = incident.payloadBytes || 360;
  const payloadKb = (payloadBytes / 1024).toFixed(2);

  const transferKbps =
    apiLatencyMs && apiLatencyMs > 0
      ? ((payloadBytes * 8) / apiLatencyMs).toFixed(1)
      : isTimerRunning && elapsedMs > 0
      ? ((payloadBytes * 8) / elapsedMs).toFixed(1)
      : "0.0";

  const statusLabel = !hasFlowStarted
    ? "READY"
    : isCompleted
    ? "COMPLETED"
    : isProgress
    ? "IN_PROGRESS"
    : isReceived
    ? "RECEIVED"
    : "READY";

  const isActive = hasFlowStarted && (isReceived || isProgress || isCompleted);

  const stageTimes = {
    event: 0,
    api: apiLatencyMs || 300,
    lambda: Math.max(apiLatencyMs || 300, 600),
    ddb: Math.max(apiLatencyMs || 300, 900),
    queue: Math.max(apiLatencyMs || 300, 1200)
  };

  const isStageDone = (ms) => isActive && elapsedMs >= ms;

  const formatSec = (ms) => `${(ms / 1000).toFixed(1)}s`;
  const formatExact = (ms) => `${(ms / 1000).toFixed(2)}s`;

  const flowProgress = isCompleted
    ? 100
    : isProgress
    ? Math.min(90, 70 + elapsedMs / 180)
    : isReceived
    ? Math.min(70, elapsedMs / 18)
    : 0;

  const baseSteps = [
    {
      key: "source",
      title: "현장 이벤트",
      desc: "CCTV·IoT·직원 신고",
      meta: incident.location || "3층 복도 체련실 앞",
      doneAt: stageTimes.event
    },
    {
      key: "api",
      title: "API Gateway",
      desc: "POST /fall-events",
      meta: apiLatencyMs ? `실측 API 응답 ${apiLatencyMs}ms` : "AWS 응답 측정 중",
      doneAt: stageTimes.api
    },
    {
      key: "lambda",
      title: "Ingest Lambda",
      desc: "검증 · 멱등성 · Δt 계산",
      meta: "event_timestamp 기반 지연 확인",
      doneAt: stageTimes.lambda
    },
    {
      key: "ddb",
      title: "DynamoDB 저장",
      desc: "SilverTown-FallEvents",
      meta: incident.eventId || "FE-DEMO-001",
      doneAt: stageTimes.ddb
    },
    {
      key: "queue",
      title: "SQS/SNS 알림",
      desc: "NotificationQueue → SNS",
      meta: "간호사 · 요양보호사 · 관리자",
      doneAt: stageTimes.queue
    }
  ];

  const flowSteps = [
    ...baseSteps.map((step, index) => {
      const done = isStageDone(step.doneAt);
      const progress = isActive && !done && elapsedMs >= Math.max(0, step.doneAt - 250);

      return {
        ...step,
        index,
        state: done ? "done" : progress ? "progress" : "idle",
        time: done ? formatSec(step.doneAt) : progress ? `${elapsedSec}s` : "대기"
      };
    }),
    {
      key: "ack",
      index: 5,
      title: "담당자 확인",
      desc: "PATCH /status",
      meta: statusUpdateLatencyMs
        ? `상태 변경 실측 ${statusUpdateLatencyMs}ms`
        : incident.ack_status || "UNACKNOWLEDGED",
      state: isCompleted || isProgress ? "done" : isReceived ? "progress" : "idle",
      time: statusUpdateLatencyMs
        ? formatExact(statusUpdateLatencyMs)
        : isReceived || isProgress || isCompleted
        ? `${elapsedSec}s`
        : "대기"
    },
    {
      key: "guardian",
      index: 6,
      title: "보호자 2차 안내",
      desc: "guardian-notification",
      meta: guardianLatencyMs
        ? `보호자 알림 실측 ${guardianLatencyMs}ms`
        : incident.guardianNotification || "NOT_SENT",
      state: isCompleted ? "done" : isProgress ? "progress" : "idle",
      time: isCompleted ? `${elapsedSec}s` : isProgress ? `${elapsedSec}s` : "대기"
    }
  ];

  const liveLogs = [];

  if (!isActive) {
    liveLogs.push({
      time: "0.0s",
      text: "사고 발생 버튼을 누르면 실시간 로그가 생성됩니다.",
      on: false
    });
  }

  if (isActive) {
    liveLogs.push({
      time: "0.0s",
      text: "낙상 이벤트 생성 및 API 호출 시작",
      on: true
    });
  }

  if (isStageDone(stageTimes.api)) {
    liveLogs.push({
      time: apiLatencyMs ? formatExact(apiLatencyMs) : formatSec(stageTimes.api),
      text: apiLatencyMs
        ? `API Gateway 응답 수신 · ${apiLatencyMs}ms`
        : "API Gateway가 POST /fall-events 요청 수신",
      on: true
    });
  }

  if (isStageDone(stageTimes.lambda)) {
    liveLogs.push({
      time: formatSec(stageTimes.lambda),
      text: "Ingest Lambda 검증 및 Δt 계산 완료",
      on: true
    });
  }

  if (isStageDone(stageTimes.ddb)) {
    liveLogs.push({
      time: formatSec(stageTimes.ddb),
      text: "DynamoDB SilverTown-FallEvents 저장 완료",
      on: true
    });
  }

  if (isStageDone(stageTimes.queue)) {
    liveLogs.push({
      time: formatSec(stageTimes.queue),
      text: "NotificationQueue 적재 및 SNS 알림 요청 완료",
      on: true
    });
  }

  if (isProgress || isCompleted) {
    liveLogs.push({
      time: statusUpdateLatencyMs ? formatExact(statusUpdateLatencyMs) : `${elapsedSec}s`,
      text: statusUpdateLatencyMs
        ? `담당자 확인 상태 업데이트 완료 · ${statusUpdateLatencyMs}ms`
        : "담당자 확인 처리 중",
      on: true
    });
  }

  if (isCompleted) {
    liveLogs.push({
      time: `${elapsedSec}s`,
      text: guardianLatencyMs
        ? `대응 완료 및 보호자 안내 요청 완료 · 보호자 알림 ${guardianLatencyMs}ms`
        : "대응 완료 및 보호자 안내 요청 완료",
      on: true
    });
  }

  return (
    <aside className="live-flow-panel">
      <div className="live-flow-header">
        <div>
          <p className="eyebrow">LIVE SERVERLESS FLOW</p>
          <h2>초동대응 실시간 흐름</h2>
        </div>
        <span className={`flow-status ${isActive ? "active" : ""}`}>
          {statusLabel}
        </span>
      </div>

      <section className="live-metrics-grid">
        <div className="live-metric-card primary">
          <span>실시간 경과</span>
          <strong>{isActive ? `${elapsedSec}s` : "0.0s"}</strong>
          <p>
            {isCompleted
              ? "대응 완료 시점에서 정지"
              : isActive
              ? "사고 발생 후 현재까지"
              : "사고 발생 전 대기"}
          </p>
        </div>

        <div className="live-metric-card">
          <span>API 응답</span>
          <strong>{apiLatencyMs ? `${apiLatencyMs}ms` : isActive ? "측정 중" : "-"}</strong>
          <p>Hugging Face → AWS</p>
        </div>

        <div className="live-metric-card">
          <span>Payload</span>
          <strong>{payloadKb}KB</strong>
          <p>전송 요청 크기</p>
        </div>

        <div className="live-metric-card">
          <span>전송 속도</span>
          <strong>{transferKbps}kbps</strong>
          <p>요청 크기 / 응답시간</p>
        </div>
      </section>

      <section className="flow-summary-card">
        <div>
          <span>전체 플로우</span>
          <strong>{isActive ? `${elapsedSec}초` : "0.0초"}</strong>
        </div>

        <div className="live-progress-track">
          <div
            className="live-progress-fill"
            style={{ width: `${Math.min(100, flowProgress)}%` }}
          />
        </div>

        <p>
          API Gateway → Lambda → DynamoDB → SQS/SNS → 담당자 알림
        </p>
      </section>

      <section className="flow-three-columns">
        <div className={`flow-big-card ${isActive ? "on" : ""}`}>
          <div className="flow-card-icon">①</div>
          <h3>현장 이벤트</h3>
          <p>CCTV / IoT 센서 / 직원 신고 앱</p>
          <strong>{incident.location || "3층 복도 체련실 앞"}</strong>
        </div>

        <div className={`flow-big-card ${isActive ? "on" : ""}`}>
          <div className="flow-card-icon">②</div>
          <h3>AWS 처리</h3>
          <p>API Gateway · Lambda · DynamoDB</p>
          <strong>{apiLatencyMs ? `실측 ${apiLatencyMs}ms` : "서버 처리 3초 이내 목표"}</strong>
        </div>

        <div className={`flow-big-card ${isActive ? "on" : ""}`}>
          <div className="flow-card-icon">③</div>
          <h3>담당자 알림</h3>
          <p>SQS · SNS · 보호자 2차 안내</p>
          <strong>{incident.guardianNotification || "NOT_SENT"}</strong>
        </div>
      </section>

      <section className="flow-pipeline">
        {flowSteps.map((step) => (
          <div className={`flow-step ${step.state}`} key={step.key}>
            <div className="flow-step-mark">
              {step.state === "done" ? "✓" : step.index + 1}
            </div>

            <div className="flow-step-body">
              <div className="flow-step-top">
                <strong>{step.title}</strong>
                <em>{step.time}</em>
              </div>
              <p>{step.desc}</p>
              <small>{step.meta}</small>
            </div>
          </div>
        ))}
      </section>

      <section className="flow-log-card">
        <div className="flow-log-title">
          <h3>실시간 처리 로그</h3>
          <span>
            {isCompleted
              ? `${elapsedSec}초에서 완료`
              : isActive
              ? `${elapsedSec}초 경과`
              : "대기 중"}
          </span>
        </div>

        <div className="flow-log-list">
          {liveLogs.map((item, idx) => (
            <div className={`flow-log-item ${item.on ? "on" : ""}`} key={`${item.text}-${idx}`}>
              <b>{item.time}</b>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flow-kpi-strip">
        <div>
          <span>AS-IS</span>
          <strong>14분</strong>
          <p>수기 전파</p>
        </div>
        <div>
          <span>TO-BE</span>
          <strong>3초 이내</strong>
          <p>서버리스 처리</p>
        </div>
        <div>
          <span>장애 추적</span>
          <strong>DLQ</strong>
          <p>실패 이벤트 보관</p>
        </div>
      </section>
    </aside>
  );
}

function AdminPanel({ incident, content, onStart, onComplete, onReset }) {
  const canStart = incident.status === "RECEIVED";
  const canComplete = incident.status === "IN_PROGRESS";

  return (
    <>
      <section className="card">
        <div className="card-head">
          <div>
            <p className="eyebrow">INCIDENT DETAIL</p>
            <h3>사고 상세 정보</h3>
          </div>
          <span className="mini-badge">{incident.status}</span>
        </div>

        <div className="info-grid">
          <div>
            <span>사고 ID</span>
            <strong>{incident.eventId}</strong>
          </div>
          <div>
            <span>발생 위치</span>
            <strong>{incident.location}</strong>
          </div>
          <div>
            <span>발생 시각</span>
            <strong>{incident.detectedAt}</strong>
          </div>
          <div>
            <span>수신 확인</span>
            <strong>{incident.ack_status}</strong>
          </div>
        </div>

        <div className="safe-tags">
          <span>심각도</span>
          <b>긴급</b>
          <span>에스컬레이션</span>
          <b>L{incident.escalation_level}</b>
        </div>

        <div className="message-box">{content.message}</div>
      </section>

      <div className="actions vertical">
        <button
          className="primary-button full"
          disabled={!canStart}
          onClick={onStart}
        >
          대응 시작
        </button>

        <button
          className="primary-button full"
          disabled={!canComplete}
          onClick={onComplete}
        >
          대응 완료 및 보호자 안내 발송
        </button>

        <button className="secondary-button full" onClick={onReset}>
          데모 초기화
        </button>
      </div>
    </>
  );
}

function GuardianPanel({ incident, content }) {
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <p className="eyebrow">LATEST NOTICE</p>
          <h3>보호자 안내</h3>
        </div>
        <span className="mini-badge">{content.badge}</span>
      </div>

      <div className="info-grid">
        <div>
          <span>발생 시각</span>
          <strong>{incident.detectedAt}</strong>
        </div>
        <div>
          <span>안내 상태</span>
          <strong>
            {incident.guardianNotification === "SENT" ? "발송 완료" : "확인 중"}
          </strong>
        </div>
      </div>

      <div className="safe-tags">
        <span>대상</span>
        <b>어르신</b>
        <span>위치</span>
        <b>{incident.displayLocation}</b>
      </div>

      <p className="body-text">
        개인정보 보호를 위해 상세 위치, 입주민 식별 정보, 구체적 상해 내용은 표시하지 않습니다.
      </p>

      <div className="message-box">{content.message}</div>
    </section>
  );
}

function AdminOpsPanel({ incident, resetDemo }) {
  return (
    <>
      <section className="contact-hero">
        <div className="contact-icon">
          <Activity size={31} />
        </div>
        <h2>운영 상태</h2>
        <p>데모 환경에서는 실제 AWS 지표 대신 사고 처리 상태를 기준으로 운영 흐름을 표시합니다.</p>
      </section>

      <section className="card">
        <div className="section-head">
          <div className="round-icon">
            <RefreshCcw size={18} />
          </div>
          <h3>현재 처리 상태</h3>
        </div>

        <div className="info-grid">
          <div>
            <span>현재 상태</span>
            <strong>{incident.status}</strong>
          </div>
          <div>
            <span>보호자 안내</span>
            <strong>{incident.guardianNotification}</strong>
          </div>
          <div>
            <span>ACK 상태</span>
            <strong>{incident.ack_status}</strong>
          </div>
          <div>
            <span>Escalation</span>
            <strong>L{incident.escalation_level}</strong>
          </div>
        </div>

        <button className="secondary-button full" onClick={resetDemo}>
          데모 데이터 초기화
        </button>
      </section>
    </>
  );
}

function GuardianContact({ setModal }) {
  return (
    <>
      <section className="contact-hero">
        <div className="contact-icon">
          <Phone size={31} />
        </div>
        <h2>시설 문의</h2>
        <p>긴급한 문의가 필요한 경우 시설 대표번호로 연락해 주세요.</p>
        <button className="primary-button full" onClick={() => setModal("contact")}>
          시설에 문의하기
        </button>
      </section>

      <section className="card">
        <h3 className="faq-title">자주 묻는 질문</h3>

        <div className="faq">
          <strong>보호자 알림은 언제 발송되나요?</strong>
          <p>담당자 확인 및 초동 조치 후 보호자에게 안심 알림이 발송됩니다.</p>
        </div>

        <div className="faq">
          <strong>왜 상세 위치가 표시되지 않나요?</strong>
          <p>개인정보 보호를 위해 상세 위치와 민감 정보는 표시하지 않습니다.</p>
        </div>

        <div className="faq">
          <strong>추가 연락은 언제 오나요?</strong>
          <p>추가 조치가 필요한 경우 시설 담당자가 별도로 연락드립니다.</p>
        </div>
      </section>
    </>
  );
}
