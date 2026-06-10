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
  UserRound,
  ChevronRight,
  Wifi,
  X
} from "lucide-react";

const API_BASE_URL = ""; 
// 나중에 AWS 연결할 때 여기에 넣기
// 예: const API_BASE_URL = "https://h6lfwix2ke.execute-api.ap-northeast-2.amazonaws.com/dev";

const initialNotifications = [
  {
    id: 1,
    time: "오늘 10:36",
    title: "조치 완료 안내",
    body: "현재 안정 상태입니다. 보호자 안내가 발송되었습니다.",
    unread: true
  },
  {
    id: 2,
    time: "오늘 10:31",
    title: "담당자 확인",
    body: "담당자가 현장 확인을 시작했습니다.",
    unread: false
  },
  {
    id: 3,
    time: "오늘 10:30",
    title: "사고 접수",
    body: "낙상 사고가 접수되었습니다.",
    unread: false
  }
];

const historyItems = [
  {
    date: "2026.06.10",
    title: "낙상 사고 조치 안내",
    status: "안정 상태",
    desc: "담당자 확인 및 보호자 안내 완료"
  },
  {
    date: "2026.05.28",
    title: "상태 확인 안내",
    status: "이상 없음",
    desc: "시설 정기 확인 완료"
  },
  {
    date: "2026.05.11",
    title: "생활 공간 확인 안내",
    status: "조치 완료",
    desc: "시설 담당자 확인 완료"
  }
];

function getStateContent(state) {
  if (state === "new") {
    return {
      icon: <AlertTriangle size={34} />,
      badge: "접수됨",
      title: "새 사고 알림이 접수되었습니다",
      subtitle: "담당자에게 즉시 전달되었습니다.",
      summary:
        "담당자가 현장 확인을 준비 중입니다. 확인 결과는 즉시 안내드리겠습니다.",
      tone: "warning"
    };
  }

  if (state === "checking") {
    return {
      icon: <Clock3 size={34} />,
      badge: "조치 중",
      title: "담당자가 현장 확인 중입니다",
      subtitle: "확인 결과를 즉시 안내드리겠습니다.",
      summary:
        "담당자가 현장 확인을 진행 중입니다. 확인 결과는 즉시 안내드리겠습니다.",
      tone: "progress"
    };
  }

  return {
    icon: <ShieldCheck size={34} />,
    badge: "안정 상태",
    title: "현재 안정 상태입니다",
    subtitle: "초동 조치가 완료되었습니다.",
    summary:
      "현재 안정 상태로 확인되었습니다. 자세한 사항은 시설로 문의 바랍니다.",
    tone: "stable"
  };
}

function getTimeline(state) {
  const base = [
    ["사고 접수", "10:30"],
    ["담당자 확인", "10:31"],
    ["초동 조치 완료", "10:35"],
    ["보호자 안내 발송", "10:36"]
  ];

  return base.map(([label, time], index) => {
    let status = "done";

    if (state === "new") {
      status = index === 0 ? "done" : "pending";
    }

    if (state === "checking") {
      status = index <= 1 ? "done" : index === 2 ? "progress" : "pending";
    }

    return { label, time, status };
  });
}

function formatLatestEventToState(item) {
  if (!item) return "completed";

  const status = String(item.status || "").toUpperCase();

  if (status === "RECEIVED" || status === "OPEN") return "new";
  if (status === "IN_PROGRESS") return "checking";
  if (status === "COMPLETED") return "completed";

  return "completed";
}

export default function App() {
  const [tab, setTab] = useState("home");
  const [incidentState, setIncidentState] = useState("completed");
  const [notifications, setNotifications] = useState(initialNotifications);
  const [lastUpdated, setLastUpdated] = useState(12);
  const [confirmed, setConfirmed] = useState(false);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(null);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [awsMode, setAwsMode] = useState(false);

  const stateContent = useMemo(
    () => getStateContent(incidentState),
    [incidentState]
  );

  const timeline = useMemo(() => getTimeline(incidentState), [incidentState]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  useEffect(() => {
    const timer = setInterval(() => {
      setLastUpdated((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!API_BASE_URL) return;

    setAwsMode(true);

    async function fetchLatest() {
      try {
        const res = await fetch(`${API_BASE_URL}/fall-events`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json"
          }
        });

        if (!res.ok) {
          throw new Error(`API Error: ${res.status}`);
        }

        const data = await res.json();
        const list = Array.isArray(data) ? data : data.items || [];
        const latest = list[0];

        if (latest) {
          setIncidentState(formatLatestEventToState(latest));
          setLastUpdated(0);
        }
      } catch (error) {
        console.log("AWS polling failed:", error);
      }
    }

    fetchLatest();
    const polling = setInterval(fetchLatest, 3000);

    return () => clearInterval(polling);
  }, []);

  function showToast(message) {
    setToast(message);

    setTimeout(() => {
      setToast("");
    }, 2400);
  }

  function addNotification(title, body) {
    setNotifications((prev) => [
      {
        id: Date.now(),
        time: "방금 전",
        title,
        body,
        unread: true
      },
      ...prev
    ]);
  }

  function simulateIncident() {
    setTab("home");
    setConfirmed(false);
    setIncidentState("new");
    setLastUpdated(0);

    addNotification("새 사고 알림 접수", "낙상 사고가 접수되었습니다.");
    showToast("새로운 낙상 사고 알림이 접수되었습니다.");

    setTimeout(() => {
      setIncidentState("checking");
      setLastUpdated(0);
      addNotification("담당자 확인 시작", "담당자가 현장 확인을 시작했습니다.");
      showToast("담당자가 현장 확인을 시작했습니다.");
    }, 1800);

    setTimeout(() => {
      setIncidentState("completed");
      setLastUpdated(0);
      addNotification("조치 완료 안내", "현재 안정 상태로 확인되었습니다.");
      showToast("초동 조치가 완료되었습니다.");
    }, 5200);
  }

  function markRead(id) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
  }

  function readAll() {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    showToast("모든 알림을 읽음 처리했습니다.");
  }

  function confirmGuardian() {
    setConfirmed(true);
    showToast("확인 처리되었습니다. 추가 안내가 필요한 경우 다시 알림을 보내드립니다.");
  }

  function openHistory(item) {
    setSelectedHistory(item);
    setModal("history");
  }

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
                <p>보호자 안심 알림</p>
              </div>
            </div>

            <button className="profile-button" type="button">
              김
            </button>
          </div>

          <div className="user-card">
            <div>
              <span>보호자 계정</span>
              <strong>김보호님</strong>
            </div>

            <div className="live-pill">
              <Wifi size={13} />
              {awsMode ? "AWS 연동 중" : "데모 모드"}
              {unreadCount > 0 && <b>{unreadCount}</b>}
            </div>
          </div>
        </header>

        <section className="screen">
          {tab === "home" && (
            <section className="page">
              <div className="page-title-row">
                <div>
                  <p className="eyebrow">TODAY STATUS</p>
                  <h2>오늘의 안심 현황</h2>
                </div>
                <button className="small-button" onClick={simulateIncident}>
                  알림 테스트
                </button>
              </div>

              <section className={`hero-card ${stateContent.tone}`}>
                <div className="hero-top">
                  <div className="status-icon">{stateContent.icon}</div>
                  <span className="status-badge">{stateContent.badge}</span>
                </div>

                <h2>{stateContent.title}</h2>
                <p>{stateContent.subtitle}</p>

                <div className="update-line">
                  <span>마지막 업데이트</span>
                  <strong>{lastUpdated}초 전</strong>
                </div>
              </section>

              <section className="card">
                <div className="card-head">
                  <div>
                    <p className="eyebrow">LATEST NOTICE</p>
                    <h3>낙상 사고 조치 안내</h3>
                  </div>
                  <span className="mini-badge">{stateContent.badge}</span>
                </div>

                <div className="info-grid">
                  <div>
                    <span>발생 시각</span>
                    <strong>오늘 10:30</strong>
                  </div>
                  <div>
                    <span>안내 발송</span>
                    <strong>오늘 10:36</strong>
                  </div>
                </div>

                <div className="safe-tags">
                  <span>대상</span>
                  <b>어르신</b>
                  <span>위치</span>
                  <b>시설 공용공간</b>
                </div>

                <p className="body-text">
                  어르신께 낙상 사고가 있었으나, 담당자가 현장 확인 후 필요한 조치를 진행했습니다.
                </p>

                <div className="message-box">{stateContent.summary}</div>
              </section>

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
                      <div className={`time-mark ${step.status}`}>
                        {step.status === "done" ? (
                          <CheckCircle2 size={18} />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <div className="time-body">
                        <strong>{step.label}</strong>
                        {step.status === "progress" && (
                          <em>진행 중</em>
                        )}
                        <p>{step.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

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

              <div className="actions">
                <button className="primary-button" onClick={() => setModal("contact")}>
                  시설에 문의하기
                </button>
                <button
                  className="secondary-button"
                  disabled={confirmed}
                  onClick={confirmGuardian}
                >
                  {confirmed ? "확인 완료" : "확인했습니다"}
                </button>
              </div>
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
                {notifications.map((item) => (
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
              <p className="eyebrow">RECENT 30 DAYS</p>
              <h2 className="page-title">안내 기록</h2>

              <div className="list with-margin">
                {historyItems.map((item) => (
                  <button
                    className="list-card history"
                    key={item.date}
                    onClick={() => openHistory(item)}
                  >
                    <div>
                      <span>{item.date}</span>
                      <h3>{item.title}</h3>
                      <p>{item.desc}</p>
                    </div>
                    <strong>
                      {item.status}
                      <ChevronRight size={15} />
                    </strong>
                  </button>
                ))}
              </div>
            </section>
          )}

          {tab === "contact" && (
            <section className="page">
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
            </section>
          )}
        </section>

        <nav className="bottom-nav">
          <button
            className={tab === "home" ? "active" : ""}
            onClick={() => setTab("home")}
          >
            <Home size={19} />
            홈
          </button>

          <button
            className={tab === "notifications" ? "active" : ""}
            onClick={() => setTab("notifications")}
          >
            <Bell size={19} />
            알림
            {unreadCount > 0 && <i>{unreadCount}</i>}
          </button>

          <button
            className={tab === "history" ? "active" : ""}
            onClick={() => setTab("history")}
          >
            <FileText size={19} />
            기록
          </button>

          <button
            className={tab === "contact" ? "active" : ""}
            onClick={() => setTab("contact")}
          >
            <MessageCircle size={19} />
            문의
          </button>
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
              <div className="message-box muted">
                개인정보 보호를 위해 상세 위치와 민감 정보는 표시되지 않습니다.
              </div>
              <button className="primary-button full" onClick={() => setModal(null)}>
                확인
              </button>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
