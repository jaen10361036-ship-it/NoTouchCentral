import React, { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownUp,
  CheckCircle2,
  Clock3,
  Filter,
  Gauge,
  RefreshCw,
  Search,
  Signal,
  SignalZero,
  TrendingUp,
  UserRoundCheck,
  UsersRound,
  XCircle,
  CircleSlash2,
  Trophy,
  TriangleAlert,
  Ban,
  BarChart3,
  ChevronRight,
} from "lucide-react";

const REGION_ORDER = ["전체", "강남중앙1", "강남중앙2", "강남서초중앙", "남중앙"];

const RIDERS = [
  { id: "r-001", name: "장만기", region: "강남중앙1", online: false, status: "오프라인", completed: 64.8, rejected: 5.8, canceled: 0, lunch: 8.6, dinner: 14.8, nonPeak: 41.4, updatedSeconds: 186 },
  { id: "r-002", name: "김재민", region: "강남중앙1", online: false, status: "오프라인", completed: 63.8, rejected: 4.6, canceled: 1, lunch: 12.6, dinner: 17, nonPeak: 34.2, updatedSeconds: 221 },
  { id: "r-003", name: "박종길", region: "강남중앙1", online: false, status: "오프라인", completed: 53.6, rejected: 0.8, canceled: 1, lunch: 7.8, dinner: 12, nonPeak: 33.8, updatedSeconds: 258 },
  { id: "r-004", name: "최용훈", region: "강남중앙1", online: false, status: "오프라인", completed: 51.8, rejected: 0, canceled: 1, lunch: 7.8, dinner: 11, nonPeak: 33, updatedSeconds: 305 },
  { id: "r-005", name: "김재현", region: "강남중앙2", online: false, status: "오프라인", completed: 48, rejected: 17.2, canceled: 2, lunch: 10, dinner: 11.8, nonPeak: 26.2, updatedSeconds: 348 },
  { id: "r-006", name: "박두현", region: "강남중앙2", online: false, status: "오프라인", completed: 46.2, rejected: 5.4, canceled: 1, lunch: 11.2, dinner: 16.8, nonPeak: 18.2, updatedSeconds: 391 },
  { id: "r-007", name: "최희진", region: "강남중앙2", online: false, status: "오프라인", completed: 45, rejected: 1.6, canceled: 0, lunch: 5.8, dinner: 14.2, nonPeak: 25, updatedSeconds: 418 },
  { id: "r-008", name: "주영진", region: "강남서초중앙", online: false, status: "오프라인", completed: 44.8, rejected: 5.8, canceled: 1, lunch: 6.4, dinner: 11.2, nonPeak: 27.2, updatedSeconds: 466 },
  { id: "r-009", name: "정희철", region: "남중앙", online: false, status: "오프라인", completed: 43.8, rejected: 4.2, canceled: 0, lunch: 6.4, dinner: 13, nonPeak: 24.4, updatedSeconds: 508 },
  { id: "r-010", name: "유재희", region: "강남서초중앙", online: false, status: "오프라인", completed: 43.6, rejected: 0, canceled: 0, lunch: 6.6, dinner: 10, nonPeak: 27, updatedSeconds: 559 },
  { id: "r-011", name: "김철환", region: "강남서초중앙", online: true, status: "운행중", completed: 43.2, rejected: 2.6, canceled: 0, lunch: 8.6, dinner: 12.2, nonPeak: 22.4, updatedSeconds: 7 },
  { id: "r-012", name: "김천수", region: "남중앙", online: true, status: "배정대기", completed: 41.8, rejected: 3.6, canceled: 3, lunch: 7.4, dinner: 11, nonPeak: 23.4, updatedSeconds: 11 },
  { id: "r-013", name: "김지수", region: "남중앙", online: true, status: "배달중", completed: 40.8, rejected: 1.6, canceled: 0, lunch: 7.8, dinner: 11.4, nonPeak: 21.6, updatedSeconds: 4 },
  { id: "r-014", name: "김대현", region: "강남중앙2", online: true, status: "운행중", completed: 38.2, rejected: 4.2, canceled: 1, lunch: 6.8, dinner: 9.6, nonPeak: 21.8, updatedSeconds: 8 },
  { id: "r-015", name: "이상욱", region: "강남중앙1", online: true, status: "대기중", completed: 37.2, rejected: 7, canceled: 0, lunch: 4.4, dinner: 8.8, nonPeak: 24, updatedSeconds: 12 },
  { id: "r-016", name: "이기찬", region: "강남서초중앙", online: true, status: "배달중", completed: 36, rejected: 2, canceled: 2, lunch: 8, dinner: 11.8, nonPeak: 16.2, updatedSeconds: 6 },
];

const REGION_REWARD = {
  강남중앙1: { official: 1820, liveDelta: 174, target: 2500 },
  강남중앙2: { official: 1765, liveDelta: 169, target: 2500 },
  강남서초중앙: { official: 2240, liveDelta: 188, target: 3000 },
  남중앙: { official: 1710, liveDelta: 158, target: 2500 },
};

const statusClass = (status) => {
  if (status === "운행중" || status === "배달중") return "rider-status-driving";
  if (status === "배정대기" || status === "대기중") return "rider-status-waiting";
  if (status === "휴식중") return "rider-status-break";
  return "rider-status-offline";
};

const relativeTime = (seconds) => {
  if (seconds < 60) return `${seconds}초 전`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}분 전`;
};

const displayNumber = (value) => Number.isInteger(value) ? value : value.toFixed(1);
const calculateRejectionRate = (rider) => {
  if (!rider.completed) return 0;
  return ((rider.rejected + rider.canceled) / rider.completed) * 100;
};

function AdminRiders() {
  const [region, setRegion] = useState("전체");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("completed");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [rankingOpen, setRankingOpen] = useState(false);
  const [rankingTab, setRankingTab] = useState("completed");

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const list = RIDERS.filter((rider) => {
      const regionMatch = region === "전체" || rider.region === region;
      const searchMatch = !keyword || rider.name.toLowerCase().includes(keyword) || rider.region.toLowerCase().includes(keyword);
      const onlineMatch = !onlineOnly || rider.online;
      return regionMatch && searchMatch && onlineMatch;
    });

    return [...list].sort((a, b) => {
      if (sort === "rejected") return calculateRejectionRate(b) - calculateRejectionRate(a);
      if (sort === "canceled") return b.canceled - a.canceled;
      if (sort === "lunch") return b.lunch - a.lunch;
      if (sort === "dinner") return b.dinner - a.dinner;
      if (sort === "nonPeak") return b.nonPeak - a.nonPeak;
      if (sort === "recent") return a.updatedSeconds - b.updatedSeconds;
      if (sort === "name") return a.name.localeCompare(b.name, "ko");
      return b.completed - a.completed;
    });
  }, [region, query, sort, onlineOnly]);

  const summary = useMemo(() => {
    const source = region === "전체" ? RIDERS : RIDERS.filter((rider) => rider.region === region);
    const online = source.filter((rider) => rider.online).length;
    const completed = source.reduce((sum, rider) => sum + rider.completed, 0);
    const rejected = source.reduce((sum, rider) => sum + rider.rejected, 0);
    const canceled = source.reduce((sum, rider) => sum + rider.canceled, 0);
    const rejectionRate = completed ? ((rejected + canceled) / completed) * 100 : 0;
    return {
      total: source.length,
      online,
      driving: source.filter((rider) => rider.status === "운행중" || rider.status === "배달중").length,
      completed,
      rejected,
      canceled,
      rejectionRate,
    };
  }, [region]);


  const regionStats = useMemo(() => REGION_ORDER.slice(1).map((regionName) => {
    const riders = RIDERS.filter((rider) => rider.region === regionName);
    const rejectedCount = riders.reduce((sum, rider) => sum + rider.rejected, 0);
    const canceledCount = riders.reduce((sum, rider) => sum + rider.canceled, 0);
    const completed = riders.reduce((sum, rider) => sum + rider.completed, 0);
    const rejectionRate = completed ? ((rejectedCount + canceledCount) / completed) * 100 : 0;
    return { region: regionName, riders: riders.length, rejectedCount, canceledCount, completed, rejectionRate };
  }), []);

  const completionTop = useMemo(() => [...RIDERS].sort((a, b) => b.completed - a.completed).slice(0, 5), []);
  const rejectionTop = useMemo(() => [...RIDERS].sort((a, b) => calculateRejectionRate(b) - calculateRejectionRate(a)).slice(0, 5), []);
  const cancelTop = useMemo(() => [...RIDERS].sort((a, b) => b.canceled - a.canceled || b.completed - a.completed).slice(0, 5), []);

  const rejectionTone = (value) => {
    if (value >= 10) return "danger";
    if (value >= 5) return "warning";
    return "safe";
  };

  const handleRefresh = () => {
    setRefreshing(true);
    window.setTimeout(() => {
      setLastRefresh(new Date());
      setRefreshing(false);
    }, 650);
  };

  return (
    <section className="riders-page">
      <header className="riders-hero">
        <div>
          <div className="riders-eyebrow"><span />RIDER LIVE STATUS</div>
          <h2>기사 현황</h2>
          <p>노터치CC 기준 접속 상태·거절·취소·완료·구간별 수행을 확인합니다.</p>
        </div>
        <button type="button" className="riders-refresh-button" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw size={17} className={refreshing ? "spin" : ""} />
          <span>{refreshing ? "갱신 중" : "새로고침"}</span>
          <small>{lastRefresh.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</small>
        </button>
      </header>

      <div className="riders-summary-grid riders-summary-grid-v2">
        <article className="rider-summary-card rider-summary-online">
          <div className="rider-summary-icon"><Signal size={21} /></div>
          <div><span>현재 접속</span><strong>{summary.online}<em>명</em></strong><small>전체 {summary.total}명</small></div>
          <i className="rider-live-dot" />
        </article>
        <article className="rider-summary-card">
          <div className="rider-summary-icon"><UserRoundCheck size={21} /></div>
          <div><span>운행 중</span><strong>{summary.driving}<em>명</em></strong><small>배달중 포함</small></div>
        </article>
        <article className="rider-summary-card">
          <div className="rider-summary-icon"><CheckCircle2 size={21} /></div>
          <div><span>완료</span><strong>{displayNumber(summary.completed)}<em>건</em></strong><small>현재 조회 기준</small></div>
        </article>
        <article className="rider-summary-card rider-summary-danger">
          <div className="rider-summary-icon"><XCircle size={21} /></div>
          <div><span>통합 거절률</span><strong>{summary.rejectionRate.toFixed(1)}<em>%</em></strong><small>거절 {displayNumber(summary.rejected)}건 + 취소 {summary.canceled}건</small></div>
        </article>
        <article className="rider-summary-card rider-summary-cancel">
          <div className="rider-summary-icon"><CircleSlash2 size={21} /></div>
          <div><span>취소</span><strong>{summary.canceled}<em>건</em></strong><small>거절과 별도 집계</small></div>
        </article>
      </div>

      <section className="rider-region-operations">
        <div className="rider-section-title">
          <div><span className="rider-section-icon"><Gauge size={19} /></span><div><strong>권역별 거절 현황</strong><small>거절률은 (거절 건수 + 취소 건수) ÷ 완료 건수로 계산합니다.</small></div></div>
          <button type="button" className="rider-ranking-open" onClick={() => setRankingOpen(true)}>
            <BarChart3 size={17} /> TOP 순위 관리 <ChevronRight size={16} />
          </button>
        </div>
        <div className="rider-region-stat-grid">
          {regionStats.map((item) => (
            <article key={item.region}>
              <div className="rider-region-stat-head"><strong>{item.region}</strong><span>{item.riders}명</span></div>
              <div className="rider-region-rate"><b className={`tone-${rejectionTone(item.rejectionRate)}`}>{item.rejectionRate.toFixed(1)}%</b><small>거절률</small></div>
              <div className="rider-region-counts">
                <span><small>거절</small><strong>{displayNumber(item.rejectedCount)}<em>건</em></strong></span>
                <i />
                <span><small>취소</small><strong>{item.canceledCount}<em>건</em></strong></span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rider-reward-bridge">
        <div className="rider-reward-title">
          <span className="rider-reward-icon"><TrendingUp size={20} /></span>
          <div><strong>리워드 실시간 예상 연동</strong><small>공식 10시 수치 + 기사 완료 증가분</small></div>
        </div>
        <div className="rider-reward-regions">
          {Object.entries(REGION_REWARD).map(([name, data]) => {
            const expected = data.official + data.liveDelta;
            const percent = Math.min((expected / data.target) * 100, 100);
            return (
              <article key={name}>
                <div><strong>{name}</strong><span>{percent.toFixed(1)}%</span></div>
                <div className="rider-reward-numbers"><small>공식 {data.official.toLocaleString()}</small><b>+{data.liveDelta}</b><strong>{expected.toLocaleString()}건</strong></div>
                <div className="rider-reward-track"><i style={{ width: `${percent}%` }} /></div>
              </article>
            );
          })}
        </div>
        <p><Gauge size={15} /> 완료는 리워드 예상 누적에 사용하고, 거절과 취소는 별도 운영 지표로 보존합니다.</p>
      </section>

      <div className="riders-content-grid riders-content-grid-single">
        <section className="riders-panel">
          <div className="riders-toolbar">
            <div className="rider-region-tabs">
              {REGION_ORDER.map((item) => (
                <button type="button" key={item} className={region === item ? "active" : ""} onClick={() => setRegion(item)}>
                  {item}
                  <small>{item === "전체" ? RIDERS.length : RIDERS.filter((rider) => rider.region === item).length}</small>
                </button>
              ))}
            </div>

            <div className="rider-filter-row">
              <label className="rider-search-box">
                <Search size={17} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="기사명 또는 권역 검색" />
              </label>
              <label className="rider-sort-box">
                <ArrowDownUp size={16} />
                <select value={sort} onChange={(event) => setSort(event.target.value)}>
                  <option value="completed">완료 높은 순</option>
                  <option value="rejected">거절률 높은 순</option>
                  <option value="canceled">취소 높은 순</option>
                  <option value="lunch">점심피크 높은 순</option>
                  <option value="dinner">저녁피크 높은 순</option>
                  <option value="nonPeak">논피크 높은 순</option>
                  <option value="recent">최근 갱신 순</option>
                  <option value="name">이름 순</option>
                </select>
              </label>
              <button type="button" className={`rider-online-toggle ${onlineOnly ? "active" : ""}`} onClick={() => setOnlineOnly((value) => !value)}>
                <Filter size={16} /> 접속중만
              </button>
            </div>
          </div>

          <div className="rider-table-wrap">
            <table className="rider-table rider-table-v2">
              <thead>
                <tr>
                  <th>이름</th><th>상태</th><th>권역</th><th>거절률 / 거절건수</th><th>취소</th><th>완료</th><th>점심피크</th><th>저녁피크</th><th>논피크</th><th>마지막 갱신</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((rider) => (
                  <tr key={rider.id}>
                    <td><div className="rider-person"><span>{rider.name.slice(0, 1)}</span><div><strong>{rider.name}</strong><small>{rider.id}</small></div></div></td>
                    <td><span className={`rider-status ${statusClass(rider.status)}`}><i />{rider.status}</span></td>
                    <td><span className="rider-region-chip">{rider.region}</span></td>
                    <td>
                      <div className="rider-rejection-cell">
                        <strong className={`tone-${rejectionTone(calculateRejectionRate(rider))}`}>{calculateRejectionRate(rider).toFixed(1)}%</strong>
                        <small>거절 {displayNumber(rider.rejected)}건</small>
                      </div>
                    </td>
                    <td><strong className={rider.canceled >= 2 ? "rider-cancel-alert" : ""}>{rider.canceled}</strong></td>
                    <td><strong className="rider-completed-value">{displayNumber(rider.completed)}</strong></td>
                    <td>{displayNumber(rider.lunch)}</td>
                    <td>{displayNumber(rider.dinner)}</td>
                    <td>{displayNumber(rider.nonPeak)}</td>
                    <td><span className="rider-update-time"><Clock3 size={14} />{relativeTime(rider.updatedSeconds)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rider-mobile-list">
            {filtered.map((rider) => (
              <article className="rider-mobile-card" key={rider.id}>
                <div className="rider-mobile-head">
                  <div className="rider-person"><span>{rider.name.slice(0, 1)}</span><div><strong>{rider.name}</strong><small>{rider.region}</small></div></div>
                  <span className={`rider-status ${statusClass(rider.status)}`}><i />{rider.status}</span>
                </div>
                <div className="rider-mobile-metrics rider-mobile-metrics-v2">
                  <div><span>완료</span><strong>{displayNumber(rider.completed)}<small>건</small></strong></div>
                  <div><span>거절률</span><strong className={`tone-${rejectionTone(calculateRejectionRate(rider))}`}>{calculateRejectionRate(rider).toFixed(1)}<small>%</small></strong><em>거절 {displayNumber(rider.rejected)}건</em></div>
                  <div><span>취소</span><strong className={rider.canceled >= 2 ? "rider-cancel-alert" : ""}>{rider.canceled}<small>건</small></strong></div>
                </div>
                <div className="rider-mobile-segments">
                  <span>점심 <b>{displayNumber(rider.lunch)}</b></span>
                  <span>저녁 <b>{displayNumber(rider.dinner)}</b></span>
                  <span>논피크 <b>{displayNumber(rider.nonPeak)}</b></span>
                </div>
                <div className="rider-mobile-foot">
                  <span>노터치CC 집계 기준</span>
                  <span><Clock3 size={13} />{relativeTime(rider.updatedSeconds)}</span>
                </div>
              </article>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="rider-empty"><SignalZero size={30} /><strong>조건에 맞는 기사가 없습니다.</strong><span>검색어나 필터를 변경해주세요.</span></div>
          )}
        </section>


      </div>

      {rankingOpen && (
        <div className="rider-ranking-modal-backdrop" onClick={() => setRankingOpen(false)}>
          <section className="rider-ranking-modal" onClick={(event) => event.stopPropagation()}>
            <header>
              <div><span><BarChart3 size={20} /></span><div><strong>기사 TOP 순위</strong><small>필요할 때만 열어 확인하는 운영 순위판</small></div></div>
              <button type="button" onClick={() => setRankingOpen(false)} aria-label="닫기"><XCircle size={22} /></button>
            </header>
            <nav className="rider-ranking-tabs">
              <button className={rankingTab === "completed" ? "active" : ""} onClick={() => setRankingTab("completed")}><Trophy size={16} />완료 TOP 5</button>
              <button className={rankingTab === "rejected" ? "active" : ""} onClick={() => setRankingTab("rejected")}><TriangleAlert size={16} />거절률 TOP 5</button>
              <button className={rankingTab === "canceled" ? "active" : ""} onClick={() => setRankingTab("canceled")}><Ban size={16} />취소 TOP 5</button>
            </nav>
            <div className="rider-ranking-modal-list">
              {(rankingTab === "completed" ? completionTop : rankingTab === "rejected" ? rejectionTop : cancelTop).map((rider, index) => (
                <article key={rider.id}>
                  <b className={`rider-rank rider-rank-${index + 1}`}>{String(index + 1).padStart(2, "0")}</b>
                  <div className="rider-ranking-person"><strong>{rider.name}</strong><small>{rider.region}</small></div>
                  <span className={rankingTab === "rejected" ? `rider-rejection-rank ${rejectionTone(calculateRejectionRate(rider))}` : rankingTab === "canceled" ? "rider-cancel-rank" : ""}>
                    {rankingTab === "completed" ? displayNumber(rider.completed) : rankingTab === "rejected" ? calculateRejectionRate(rider).toFixed(1) : rider.canceled}
                    <em>{rankingTab === "rejected" ? "%" : "건"}</em>
                    {rankingTab === "rejected" && <small>거절 {displayNumber(rider.rejected)} + 취소 {rider.canceled}</small>}
                  </span>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      <footer className="riders-data-note">
        <Activity size={17} />
        <div><strong>기사 데이터 집계 기준</strong><span>노터치CC의 기사 고유 ID를 기준으로 집계하며, 거절률은 (거절 건수 + 취소 건수) ÷ 완료 건수 × 100으로 계산합니다.</span></div>
        <UsersRound size={19} />
      </footer>
    </section>
  );
}

export default AdminRiders;
