import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coffee,
  LogIn,
  LogOut,
  MapPin,
  Palmtree,
  PauseCircle,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
  Utensils,
  X,
} from "lucide-react";

const statusMeta = {
  "근무 중": { tone: "working", icon: BriefcaseBusiness },
  "식사중": { tone: "meal", icon: Utensils },
  "휴식": { tone: "break", icon: Coffee },
  "배정대기중": { tone: "standby", icon: PauseCircle },
  "미출근": { tone: "absent", icon: AlertTriangle },
  "퇴근": { tone: "off", icon: LogOut },
};

const actionButtons = [
  { label: "출근", sub: "출근 체크", icon: LogIn, tone: "lime", status: "근무 중" },
  { label: "퇴근", sub: "건수 입력 후 퇴근", icon: LogOut, tone: "neutral", status: "퇴근", type: "checkout" },
  { label: "식사중", sub: "식사 시작", icon: Utensils, tone: "amber", status: "식사중" },
  { label: "휴식", sub: "휴식 시작", icon: Coffee, tone: "blue", status: "휴식" },
  { label: "배정대기중", sub: "대기 상태", icon: PauseCircle, tone: "violet", status: "배정대기중" },
  { label: "업무복귀", sub: "현장 복귀", icon: RotateCcw, tone: "cyan", status: "근무 중" },
];

const weekLabels = ["일", "월", "화", "수", "목", "금", "토"];

const koreanHolidays = {
  "2026-01-01": "신정",
  "2026-02-16": "설날 연휴",
  "2026-02-17": "설날",
  "2026-02-18": "설날 연휴",
  "2026-03-01": "삼일절",
  "2026-03-02": "대체공휴일",
  "2026-05-05": "어린이날",
  "2026-05-24": "부처님오신날",
  "2026-05-25": "대체공휴일",
  "2026-06-06": "현충일",
  "2026-08-15": "광복절",
  "2026-08-17": "대체공휴일",
  "2026-09-24": "추석 연휴",
  "2026-09-25": "추석",
  "2026-09-26": "추석 연휴",
  "2026-10-03": "개천절",
  "2026-10-05": "대체공휴일",
  "2026-10-09": "한글날",
  "2026-12-25": "성탄절",
};

const checkInMessages = [
  "오늘도 안전운행과 성공적인 운영을 응원합니다.",
  "좋은 하루의 시작입니다. 오늘도 모든 권역의 성공을 함께 만들어봅시다.",
  "백전백승은 기본 근태와 준비된 운영에서 시작됩니다.",
  "오늘도 서로를 믿고 최고의 운영을 만들어봅시다.",
  "안전이 가장 먼저입니다. 오늘도 힘차게 시작해봅시다.",
  "작은 차이가 최고의 운영을 만듭니다. 오늘도 좋은 하루 되세요.",
];

function formatDateKey(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getCalendarCells(year, monthIndex) {
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const lastDate = new Date(year, monthIndex + 1, 0).getDate();
  return [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: lastDate }, (_, index) => index + 1),
  ];
}

function AdminAttendance({ currentRegion, token, currentUser: sessionUser, onAuthExpired }) {
  const [managers, setManagers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [myStatus, setMyStatus] = useState("미출근");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [regionFilter, setRegionFilter] = useState("전체 권역");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState("today");
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInMessage, setCheckInMessage] = useState(checkInMessages[0]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutCount, setCheckoutCount] = useState("");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveMemo, setLeaveMemo] = useState("");
  const [leaves, setLeaves] = useState([]);
  const today = new Date();
  const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const [calendarMonth, setCalendarMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayKey);


  const authFetch = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      onAuthExpired?.();
    }

    return response;
  };

  const loadAttendance = async () => {
    setLoading(true);
    try {
      const response = await authFetch("/api/attendance/today", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "근태 정보를 불러오지 못했습니다.");
      setManagers(result.managers || []);
      setLeaves(result.leaves || []);
      setCurrentUser(result.current || null);
      setMyStatus(result.current?.status || "미출근");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return undefined;

    loadAttendance();
    const timer = window.setInterval(loadAttendance, 10000);
    return () => window.clearInterval(timer);
  }, [token]);

  const sendAction = async (action, extra = {}) => {
    setNotice("");
    const response = await authFetch("/api/attendance/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(result.message || "근태 처리 중 오류가 발생했습니다.");
      return false;
    }
    setManagers(result.managers || []);
    setLeaves(result.leaves || []);
    setCurrentUser(result.current || null);
    setMyStatus(result.current?.status || "미출근");
    return true;
  };

  const summary = useMemo(() => ({
    checked: managers.filter((m) => m.check_in).length,
    working: managers.filter((m) => m.status === "근무 중").length,
    break: managers.filter((m) => ["식사중", "휴식", "배정대기중"].includes(m.status)).length,
    off: managers.filter((m) => m.status === "퇴근").length,
    late: managers.filter((m) => Number(m.late) === 1).length,
    absent: managers.filter((m) => ["미출근", "휴무"].includes(m.status)).length,
  }), [managers]);

  const filtered = managers.filter((manager) => {
    const regionOk = regionFilter === "전체 권역" || (manager.region || "미배정") === regionFilter;
    const queryOk = `${manager.name} ${manager.role}`.includes(query.trim());
    return regionOk && queryOk;
  });

  const handleAction = (button) => {
    if (button.label === "출근") {
      const nextMessage = checkInMessages[Math.floor(Math.random() * checkInMessages.length)];
      setCheckInMessage(nextMessage);
      setCheckInOpen(true);
      return;
    }
    if (button.type === "checkout") {
      setCheckoutOpen(true);
      return;
    }
    const actionMap = { "식사중": "meal", "휴식": "break", "배정대기중": "standby", "업무복귀": "resume" };
    sendAction(actionMap[button.label]);
  };

  const submitCheckIn = async () => {
    const ok = await sendAction("checkin");
    if (ok) setCheckInOpen(false);
  };

  const submitApprovedCheckIn = async () => {
    const reason = window.prompt("승인출근 사유를 입력해주세요.", "사전 보고 완료");
    if (reason === null) return;
    await sendAction("approved_checkin", { reason });
  };

  const submitCheckout = async () => {
    const parsed = Number(checkoutCount);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setNotice("수행건수를 0 이상의 숫자로 입력해주세요.");
      return;
    }
    const ok = await sendAction("checkout", { orders: parsed });
    if (ok) {
      setCheckoutOpen(false);
      setCheckoutCount("");
    }
  };

  const submitLeave = async () => {
    if (!selectedDate) return;
    const response = await authFetch("/api/attendance/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: selectedDate, memo: leaveMemo }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(result.message || "휴무 등록 중 오류가 발생했습니다.");
      return;
    }
    setNotice(result.message);
    setLeaveOpen(false);
    setLeaveMemo("");
    await loadAttendance();
  };

  const summaries = [
    { label: "오늘 출근", value: `${summary.checked}명`, detail: `전체 ${managers.length}명 중`, icon: Users, tone: "lime" },
    { label: "근무 중", value: `${summary.working}명`, detail: `${managers.length ? Math.round(summary.working / managers.length * 100) : 0}%`, icon: BriefcaseBusiness, tone: "blue" },
    { label: "지각", value: `${summary.late}명`, detail: "개별 기준시간 적용", icon: Clock3, tone: "red" },
    { label: "식사·휴식", value: `${summary.break}명`, detail: "현재 상태 기준", icon: Coffee, tone: "amber" },
    { label: "퇴근", value: `${summary.off}명`, detail: "퇴근건수 입력", icon: LogOut, tone: "violet" },
    { label: "휴무·미출근", value: `${summary.absent}명`, detail: "확인 필요", icon: AlertTriangle, tone: "red" },
  ];

  const calendarYear = calendarMonth.getFullYear();
  const calendarMonthIndex = calendarMonth.getMonth();
  const calendarCells = getCalendarCells(calendarYear, calendarMonthIndex);
  const selectedLeaves = leaves.filter((item) => item.date === selectedDate);

  return (
    <div className="attendance-page">
      <section className="attendance-page-head">
        <div>
          <span className="section-label">ADMIN ATTENDANCE</span>
          <h2>관리자 근무표</h2>
          <p>오늘의 근무 상태와 휴무 일정을 한 화면에서 관리합니다.</p>
        </div>
        <div className="attendance-head-meta"><RefreshCw size={15}/><span>최신 상태</span></div>
      </section>

      {notice && <div className="admin-management-message">{notice}</div>}

      <div className="attendance-view-tabs" role="tablist" aria-label="근무표 화면 전환">
        <button type="button" className={viewMode === "today" ? "active" : ""} onClick={() => setViewMode("today")}>
          <BriefcaseBusiness size={17}/> 오늘 근무 현황
        </button>
        <button type="button" className={viewMode === "leave" ? "active" : ""} onClick={() => setViewMode("leave")}>
          <CalendarDays size={17}/> 관리자 휴무표
        </button>
      </div>

      {viewMode === "today" ? (
        <>
          <section className="attendance-summary-grid">
            {summaries.map(({ label, value, detail, icon: Icon, tone }) => (
              <article className={`attendance-summary-card ${tone}`} key={label}>
                <div className="attendance-summary-icon"><Icon size={21}/></div>
                <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
              </article>
            ))}
          </section>

          <section className="attendance-action-panel">
            <div className="attendance-section-head">
              <div><span className="section-label">MY WORK STATUS</span><h3>내 근무 상태</h3></div>
              <div className="my-region-chip"><MapPin size={15}/><span>현재 권역</span><strong>{currentRegion}</strong></div>
            </div>

            <div className="my-status-highlight">
              <div>
                <span>현재 상태</span>
                <strong>{myStatus}</strong>
                <small>
                  {currentUser?.role === "BOSS/지사장"
                    ? "기준 출근시간 없음"
                    : `기준 ${currentUser?.scheduled_start_time || "10:00"}`}
                  {" · "}
                  {currentUser?.check_in
                    ? `출근 ${new Date(currentUser.check_in).toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}`
                    : "출근 전"}
                  {Number(currentUser?.late) === 1
                    ? ` · 지각 ${currentUser?.late_minutes || 0}분`
                    : ""}
                  {" · "}
                  {currentUser?.region || currentRegion}
                </small>
              </div>
              <span className={`attendance-status ${statusMeta[myStatus]?.tone || "working"}`}>{myStatus}</span>
            </div>

            <div className="attendance-action-grid">
              {actionButtons.map((button) => {
                const Icon = button.icon;
                return (
                  <button type="button" key={button.label} className={`attendance-action-button ${button.tone} ${myStatus === button.status && !button.type && button.label !== "업무복귀" ? "selected" : ""}`} onClick={() => handleAction(button)}>
                    <span className="action-icon"><Icon size={22}/></span>
                    <span><strong>{button.label}</strong><small>{button.sub}</small></span>
                    {myStatus === button.status && !button.type && button.label !== "업무복귀" && <Check size={16} className="action-check"/>}
                  </button>
                );
              })}
              <button type="button" className="attendance-action-button approval" onClick={submitApprovedCheckIn}>
                <span className="action-icon"><ShieldCheck size={22}/></span>
                <span><strong>승인출근</strong><small>지각 예외 승인</small></span>
              </button>
            </div>
            <p className="approval-note"><ShieldCheck size={15}/> 승인출근은 사전 보고 후 사용하며 지각으로 처리되지 않습니다. BOSS/지사장은 지각 대상에서 제외됩니다.</p>
          </section>

          <section className="attendance-board-panel">
            <div className="attendance-board-toolbar">
              <div><span className="section-label">MANAGER BOARD</span><h3>관리자 현황판</h3></div>
              <div className="attendance-tools">
                <label className="attendance-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="관리자 검색"/></label>
                <select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}>
                  <option>전체 권역</option>
                  <option>전권역 운영</option>
                  <option>강남중앙1</option>
                  <option>강남중앙2</option>
                  <option>강남서초중앙</option>
                  <option>강남남중앙</option>
                  <option>강남서부</option>
                  <option>권역없음(현장팀장)</option>
                </select>
                <button type="button" className="attendance-tool-button" onClick={loadAttendance}><RefreshCw size={16}/> 새로고침</button>

              </div>
            </div>

            <div className="attendance-table-head">
              <span>이름 / 직책</span><span>현재 권역</span><span>기준 / 출근시간</span><span>현재 상태</span><span>퇴근시간</span><span>퇴근건수</span><span>지각 여부</span><span>관리</span>
            </div>
            <div className="attendance-manager-list">
              {loading && <div className="admin-empty-state">근태 정보를 불러오는 중입니다.</div>}
              {!loading && filtered.length === 0 && <div className="admin-empty-state">표시할 관리자가 없습니다.</div>}
              {filtered.map((manager) => {
                const meta = statusMeta[manager.status] || statusMeta["미출근"];
                const StatusIcon = meta.icon;
                return (
                  <article className="attendance-manager-row" key={manager.user_id}>
                    <div className="manager-person"><span className="manager-photo">{manager.name.slice(0,1)}</span><div><strong>{manager.name}</strong><small>{manager.role}</small></div></div>
                    <div className="manager-region"><MapPin size={14}/>{manager.region || "미배정"}</div>
                    <div className="manager-time manager-schedule-time">
                      <Clock3 size={14}/>
                      <span>
                        <small>
                          {manager.role === "BOSS/지사장"
                            ? "기준 없음"
                            : `기준 ${manager.scheduled_start_time || "10:00"}`}
                        </small>
                        <strong>
                          {manager.check_in
                            ? new Date(manager.check_in).toLocaleTimeString("ko-KR", {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                              })
                            : "-"}
                        </strong>
                      </span>
                    </div>
                    <div><span className={`attendance-status ${meta.tone}`}><StatusIcon size={14}/>{manager.status}</span>{manager.since && <small className="status-since">{manager.since}</small>}</div>
                    <div className="manager-time">{manager.check_out ? new Date(manager.check_out).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "-"}</div>
                    <div className="manager-count">{manager.status === "퇴근" && manager.orders !== null && manager.orders !== undefined ? <><strong>{manager.orders}</strong>건</> : <span>-</span>}</div>
                    <div>
                      {manager.absent ? (
                        <span className="late-badge">무단결근</span>
                      ) : Number(manager.late) === 1 ? (
                        <span className="late-badge">지각 {manager.late_minutes || 0}분</span>
                      ) : manager.approved_checkin ? (
                        <span className="approved-badge">승인출근</span>
                      ) : (
                        <span className="normal-badge">
                          {manager.role === "BOSS/지사장" ? "지각 제외" : "정상"}
                        </span>
                      )}
                    </div>
                    <div><span className="normal-badge">실시간 반영</span></div>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        <section className="leave-calendar-panel">
          <div className="leave-calendar-head">
            <div>
              <span className="section-label">MANAGER LEAVE CALENDAR</span>
              <h3>관리자 휴무표</h3>
              <p>이틀 전 신청은 자동 승인, 당일 신청은 운영 최고관리자 승인 대기입니다.</p>
            </div>
            <div className="leave-today-summary"><span>오늘</span><strong>{today.getFullYear()}년 {today.getMonth() + 1}월 {today.getDate()}일</strong><small>{weekLabels[today.getDay()]}요일</small></div>
          </div>

          <div className="leave-calendar-layout">
            <div className="leave-calendar-card">
              <div className="leave-month-toolbar">
                <button type="button" onClick={() => setCalendarMonth(new Date(calendarYear, calendarMonthIndex - 1, 1))}><ChevronLeft size={19}/></button>
                <div className="leave-month-title"><strong>{calendarYear}년 {calendarMonthIndex + 1}월</strong><button type="button" className="leave-today-button" onClick={() => { setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(todayKey); }}>오늘</button></div>
                <button type="button" onClick={() => setCalendarMonth(new Date(calendarYear, calendarMonthIndex + 1, 1))}><ChevronRight size={19}/></button>
              </div>
              <div className="leave-week-labels">{weekLabels.map((label, index) => <span className={index === 0 ? "sunday" : index === 6 ? "saturday" : ""} key={label}>{label}</span>)}</div>
              <div className="leave-calendar-grid">
                {calendarCells.map((day, index) => {
                  if (!day) return <span className="leave-day empty" key={`empty-${index}`}/>;
                  const key = formatDateKey(calendarYear, calendarMonthIndex, day);
                  const dayLeaves = leaves.filter((item) => item.date === key);
                  const weekday = new Date(calendarYear, calendarMonthIndex, day).getDay();
                  const holidayName = koreanHolidays[key];
                  const isToday = key === todayKey;
                  return (
                    <button type="button" key={key} className={`leave-day ${selectedDate === key ? "selected" : ""} ${dayLeaves.length ? "has-leave" : ""} ${weekday === 0 || holidayName ? "holiday" : ""} ${weekday === 6 ? "saturday" : ""} ${isToday ? "today" : ""}`} onClick={() => setSelectedDate(key)}>
                      <div className="leave-day-number"><strong>{day}</strong>{isToday && <b>오늘</b>}</div>
                      {holidayName && <small className="holiday-name">{holidayName}</small>}
                      {dayLeaves.length > 0 && <span>{dayLeaves.length}명</span>}
                      <i aria-hidden="true"/>
                    </button>
                  );
                })}
              </div>
            </div>

            <aside className="leave-detail-card">
              <div className="leave-detail-head">
                <div>
                  <span className="section-label">SELECTED DATE</span>
                  <h4>{selectedDate.replaceAll("-", ".")} 휴무</h4>
                </div>
                <button type="button" className="leave-register-button" onClick={() => setLeaveOpen(true)}><Palmtree size={17}/> 휴무 등록</button>
              </div>
              {selectedLeaves.length ? (
                <div className="leave-detail-list">
                  {selectedLeaves.map((item, index) => (
                    <article key={`${item.name}-${index}`}>
                      <div className="manager-photo">{item.name.slice(0, 1)}</div>
                      <div><strong>{item.name}</strong><small>일반 휴무{item.memo ? ` · ${item.memo}` : ""}</small></div>
                      <span className={item.status === "자동 승인" ? "leave-approved" : "leave-pending"}>{item.status}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="leave-empty-state"><CalendarDays size={28}/><strong>등록된 휴무가 없습니다.</strong><span>오른쪽 위 휴무 등록 버튼으로 신청하세요.</span></div>
              )}
            </aside>
          </div>
        </section>
      )}

      {checkInOpen && (
        <div className="attendance-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCheckInOpen(false)}>
          <section className="attendance-modal" role="dialog" aria-modal="true" aria-label="출근 확인">
            <button type="button" className="attendance-modal-close" onClick={() => setCheckInOpen(false)}><X size={18}/></button>
            <div className="attendance-modal-icon"><LogIn size={24}/></div>
            <span className="section-label">CHECK IN</span>
            <h3>출근 확인</h3>
            <p className="checkin-message">{checkInMessage}</p>
            <strong className="attendance-confirm-question">출근하시겠습니까?</strong>
            <div className="attendance-modal-actions"><button type="button" onClick={() => setCheckInOpen(false)}>취소</button><button type="button" className="primary" onClick={submitCheckIn}>예, 출근합니다</button></div>
          </section>
        </div>
      )}

      {checkoutOpen && (
        <div className="attendance-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCheckoutOpen(false)}>
          <section className="attendance-modal" role="dialog" aria-modal="true" aria-label="퇴근 처리">
            <button type="button" className="attendance-modal-close" onClick={() => setCheckoutOpen(false)}><X size={18}/></button>
            <div className="attendance-modal-icon"><LogOut size={24}/></div>
            <span className="section-label">CHECK OUT</span>
            <h3>퇴근 처리</h3>
            <p>오늘 수행한 건수를 입력한 뒤 퇴근을 완료하세요.</p>
            <label className="attendance-modal-field"><span>오늘 수행건수</span><div><input type="number" min="0" inputMode="numeric" value={checkoutCount} onChange={(event) => setCheckoutCount(event.target.value)} placeholder="예: 42"/><b>건</b></div></label>
            <div className="attendance-modal-actions"><button type="button" onClick={() => setCheckoutOpen(false)}>취소</button><button type="button" className="primary" onClick={submitCheckout}>퇴근 완료</button></div>
          </section>
        </div>
      )}

      {leaveOpen && (
        <div className="attendance-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setLeaveOpen(false)}>
          <section className="attendance-modal leave-modal" role="dialog" aria-modal="true" aria-label="휴무 신청">
            <button type="button" className="attendance-modal-close" onClick={() => setLeaveOpen(false)}><X size={18}/></button>
            <div className="attendance-modal-icon holiday"><Palmtree size={24}/></div>
            <span className="section-label">LEAVE REQUEST</span>
            <h3>휴무 등록</h3>
            <p>선택한 날짜로 휴무가 등록됩니다. 이틀 전까지 등록하면 자동 승인됩니다.</p>
            <label className="attendance-modal-field"><span>선택 날짜</span><div className="leave-fixed-date"><CalendarDays size={18}/><strong>{selectedDate.replaceAll("-", ".")}</strong><em>날짜 고정</em></div></label>
            <label className="attendance-modal-field"><span>메모 (선택)</span><textarea value={leaveMemo} onChange={(event) => setLeaveMemo(event.target.value)} placeholder="메모가 필요한 경우에만 입력하세요."/></label>
            <div className="attendance-modal-actions"><button type="button" onClick={() => setLeaveOpen(false)}>취소</button><button type="button" className="primary" onClick={submitLeave}>휴무 등록</button></div>
          </section>
        </div>
      )}
    </div>
  );
}

export default AdminAttendance;
