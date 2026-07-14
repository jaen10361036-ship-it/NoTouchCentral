import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
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

const initialManagers = [
  { name: "이재인", role: "BOSS · 지사장", region: "강남중앙1", start: "09:07", status: "근무 중", checkoutCount: null, late: false },
  { name: "이선호", role: "운영실장", region: "강남중앙2", start: "08:58", status: "식사중", checkoutCount: null, late: false, since: "11:50 시작" },
  { name: "정희철", role: "남중앙 팀장", region: "강남남중앙", start: "09:15", status: "근무 중", checkoutCount: null, late: false },
  { name: "서상원", role: "팀장", region: "강남서초중앙", start: "09:02", status: "근무 중", checkoutCount: null, late: false },
  { name: "박성현", role: "팀장", region: "강남중앙1", start: "09:12", status: "휴식", checkoutCount: null, late: false, since: "10:30 시작" },
  { name: "신정민", role: "팀장", region: "강남중앙2", start: "09:05", status: "배정대기중", checkoutCount: null, late: false },
  { name: "김태호", role: "팀장", region: "강남서초중앙", start: "09:10", status: "근무 중", checkoutCount: null, late: false },
  { name: "김남교", role: "팀장", region: "강남중앙2", start: "-", status: "미출근", checkoutCount: null, late: true },
  { name: "백상열", role: "팀장", region: "강남남중앙", start: "08:55", status: "퇴근", end: "18:28", checkoutCount: 42, late: false },
];

const initialLeaves = [
  { date: "2026-07-18", name: "정희철", status: "자동 승인", reason: "일반 휴무" },
  { date: "2026-07-18", name: "서상원", status: "자동 승인", reason: "일반 휴무" },
  { date: "2026-07-21", name: "이선호", status: "자동 승인", reason: "일반 휴무" },
  { date: "2026-07-21", name: "김태호", status: "자동 승인", reason: "일반 휴무" },
  { date: "2026-07-24", name: "김남교", status: "승인 대기", reason: "일반 휴무" },
];

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

function AdminAttendance({ currentRegion }) {
  const [managers, setManagers] = useState(initialManagers);
  const [myStatus, setMyStatus] = useState("근무 중");
  const [regionFilter, setRegionFilter] = useState("전체 권역");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState("today");
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInMessage, setCheckInMessage] = useState(checkInMessages[0]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutCount, setCheckoutCount] = useState("");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveMemo, setLeaveMemo] = useState("");
  const [leaves, setLeaves] = useState(initialLeaves);
  const today = new Date();
  const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const [calendarMonth, setCalendarMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayKey);

  const summary = useMemo(() => ({
    checked: managers.filter((m) => m.start !== "-").length,
    working: managers.filter((m) => m.status === "근무 중").length,
    break: managers.filter((m) => ["식사중", "휴식", "배정대기중"].includes(m.status)).length,
    off: managers.filter((m) => m.status === "퇴근").length,
    absent: managers.filter((m) => m.status === "미출근").length,
  }), [managers]);

  const filtered = managers.filter((manager) => {
    const regionOk = regionFilter === "전체 권역" || manager.region === regionFilter;
    const queryOk = `${manager.name} ${manager.role}`.includes(query.trim());
    return regionOk && queryOk;
  });

  const updateMyStatus = (status) => {
    setMyStatus(status);
    setManagers((prev) => prev.map((manager) => manager.name === "이재인" ? { ...manager, status } : manager));
  };

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
    updateMyStatus(button.status);
  };

  const submitCheckIn = () => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setMyStatus("근무 중");
    setManagers((prev) => prev.map((manager) => manager.name === "이재인" ? {
      ...manager,
      start: time,
      status: "근무 중",
      end: undefined,
      checkoutCount: null,
      late: false,
    } : manager));
    setCheckInOpen(false);
  };

  const submitCheckout = () => {
    const parsed = Number(checkoutCount);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setMyStatus("퇴근");
    setManagers((prev) => prev.map((manager) => manager.name === "이재인" ? {
      ...manager,
      status: "퇴근",
      end: time,
      checkoutCount: parsed,
    } : manager));
    setCheckoutOpen(false);
    setCheckoutCount("");
  };

  const submitLeave = () => {
    if (!selectedDate) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(`${selectedDate}T00:00:00`);
    const diffDays = Math.round((target - today) / 86400000);
    const status = diffDays >= 2 ? "자동 승인" : "승인 대기";
    setLeaves((prev) => [...prev, {
      date: selectedDate,
      name: "이재인",
      status,
      reason: "일반 휴무",
      memo: leaveMemo.trim(),
    }]);
    setLeaveOpen(false);
    setLeaveMemo("");
  };

  const summaries = [
    { label: "오늘 출근", value: `${summary.checked}명`, detail: "전체 9명 중", icon: Users, tone: "lime" },
    { label: "근무 중", value: `${summary.working}명`, detail: `${Math.round(summary.working / 9 * 100)}%`, icon: BriefcaseBusiness, tone: "blue" },
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
                <small>출근 09:07 · {currentRegion}</small>
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
              <button type="button" className="attendance-action-button approval" onClick={() => updateMyStatus("근무 중")}>
                <span className="action-icon"><ShieldCheck size={22}/></span>
                <span><strong>승인출근</strong><small>지각 예외 승인</small></span>
              </button>
            </div>
            <p className="approval-note"><ShieldCheck size={15}/> 승인출근은 지사장·운영실장 승인 후 사용하며 지각으로 처리되지 않습니다.</p>
          </section>

          <section className="attendance-board-panel">
            <div className="attendance-board-toolbar">
              <div><span className="section-label">MANAGER BOARD</span><h3>관리자 현황판</h3></div>
              <div className="attendance-tools">
                <label className="attendance-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="관리자 검색"/></label>
                <select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}>
                  <option>전체 권역</option><option>강남중앙1</option><option>강남중앙2</option><option>강남서초중앙</option><option>강남남중앙</option>
                </select>
                <button type="button" className="attendance-tool-button"><RefreshCw size={16}/> 새로고침</button>
                <button type="button" className="attendance-tool-button export"><ArrowDownToLine size={16}/> 엑셀 다운로드</button>
              </div>
            </div>

            <div className="attendance-table-head">
              <span>이름 / 직책</span><span>현재 권역</span><span>출근시간</span><span>현재 상태</span><span>퇴근시간</span><span>퇴근건수</span><span>지각 여부</span><span>관리</span>
            </div>
            <div className="attendance-manager-list">
              {filtered.map((manager) => {
                const meta = statusMeta[manager.status];
                const StatusIcon = meta.icon;
                return (
                  <article className="attendance-manager-row" key={manager.name}>
                    <div className="manager-person"><span className="manager-photo">{manager.name.slice(0,1)}</span><div><strong>{manager.name}</strong><small>{manager.role}</small></div></div>
                    <div className="manager-region"><MapPin size={14}/>{manager.region}</div>
                    <div className="manager-time"><Clock3 size={14}/>{manager.start}</div>
                    <div><span className={`attendance-status ${meta.tone}`}><StatusIcon size={14}/>{manager.status}</span>{manager.since && <small className="status-since">{manager.since}</small>}</div>
                    <div className="manager-time">{manager.end || "-"}</div>
                    <div className="manager-count">{manager.status === "퇴근" && manager.checkoutCount !== null ? <><strong>{manager.checkoutCount}</strong>건</> : <span>-</span>}</div>
                    <div>{manager.late ? <span className="late-badge">무단결근</span> : <span className="normal-badge">정상</span>}</div>
                    <div><button type="button" className="row-manage-button">상태 수정</button></div>
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
