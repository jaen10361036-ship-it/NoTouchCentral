import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bike,
  CheckCircle2,
  Clock3,
  MapPin,
  RefreshCw,
  Search,
  Signal,
  SignalZero,
  UsersRound,
  Wifi,
  WifiOff,
} from "lucide-react";

const REGIONS = ["전체", "강남중앙1", "강남중앙2", "강남서초중앙", "강남남중앙"];
const LIVE_REGIONS = REGIONS.slice(1);
const getToken = () => localStorage.getItem("ntc_token") || sessionStorage.getItem("ntc_token") || "";
const numberText = (value) => Number(value || 0).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
const statusRank = { 배달중: 0, 대기중: 1, 오프라인: 2 };
const statusClass = (status) => status === "배달중" ? "rider-status-driving" : status === "대기중" ? "rider-status-waiting" : "rider-status-offline";
const rejectionRate = (rider) => Number(rider.completed || 0) > 0 ? ((Number(rider.rejected || 0) + Number(rider.canceled || 0)) / Number(rider.completed || 0)) * 100 : 0;
const normalizeRegion = (value) => value === "남중앙" ? "강남남중앙" : value;

export default function AdminRiders() {
  const [riders, setRiders] = useState([]);
  const [sync, setSync] = useState([]);
  const [region, setRegion] = useState("전체");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/riders", {
        headers: { Authorization: `Bearer ${getToken()}` },
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "기사현황을 불러오지 못했습니다.");
      setRiders((data.riders || []).map((item) => ({
        ...item,
        region: normalizeRegion(item.region),
        online: Boolean(Number(item.online)),
      })));
      setSync(data.sync || []);
    } catch (err) {
      setError(err.message || "기사현황을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  const filtered = useMemo(() => riders.filter((rider) => {
    const keyword = query.trim().toLowerCase();
    return (region === "전체" || rider.region === region)
      && (!keyword || rider.name.toLowerCase().includes(keyword) || rider.region.toLowerCase().includes(keyword));
  }).sort((a, b) => (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9)
    || Number(b.completed) - Number(a.completed)
    || a.name.localeCompare(b.name, "ko")), [riders, region, query]);

  const summary = useMemo(() => ({
    total: riders.length,
    online: riders.filter((r) => r.online || r.status !== "오프라인").length,
    driving: riders.filter((r) => r.status === "배달중").length,
    waiting: riders.filter((r) => r.status === "대기중").length,
    offline: riders.filter((r) => r.status === "오프라인").length,
    completed: riders.reduce((sum, r) => sum + Number(r.completed || 0), 0),
  }), [riders]);

  const regionStats = useMemo(() => LIVE_REGIONS.map((regionName) => {
    const items = riders.filter((rider) => rider.region === regionName);
    const online = items.filter((rider) => rider.online || rider.status !== "오프라인").length;
    return {
      name: regionName,
      total: items.length,
      online,
      driving: items.filter((rider) => rider.status === "배달중").length,
      waiting: items.filter((rider) => rider.status === "대기중").length,
      completed: items.reduce((sum, rider) => sum + Number(rider.completed || 0), 0),
      onlineRate: items.length ? Math.round((online / items.length) * 100) : 0,
    };
  }), [riders]);

  const latestSync = sync.map((item) => item.received_at).filter(Boolean).sort().at(-1);
  const syncTime = latestSync
    ? new Date(latestSync).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    : "연결 대기";

  const summaryCards = [
    { label: "전체 기사", value: summary.total, unit: "명", icon: UsersRound, tone: "total" },
    { label: "접속중", value: summary.online, unit: "명", icon: Wifi, tone: "online" },
    { label: "배달중", value: summary.driving, unit: "명", icon: Bike, tone: "driving" },
    { label: "대기중", value: summary.waiting, unit: "명", icon: Clock3, tone: "waiting" },
    { label: "오프라인", value: summary.offline, unit: "명", icon: WifiOff, tone: "offline" },
  ];

  return <section className="riders-page rider-control-page">
    <header className="rider-control-hero">
      <div className="rider-control-title">
        <div className="rider-control-live-label"><span />실시간 운행 관제</div>
        <h2>기사 현황</h2>
        <p>4개 권역 기사 접속 상태와 수행 현황을 한눈에 확인합니다.</p>
      </div>

      <div className="rider-control-summary">
        {summaryCards.map(({ label, value, unit, icon: Icon, tone }) => <article key={label} className={`rider-control-kpi ${tone}`}>
          <span className="rider-control-kpi-label"><Icon size={16} />{label}</span>
          <strong>{numberText(value)}<small>{unit}</small></strong>
        </article>)}
      </div>

      <div className="rider-control-sync">
        <div><i /><span>마지막 수신</span><strong>{syncTime}</strong></div>
        <button type="button" onClick={load} disabled={loading} aria-label="기사현황 새로고침">
          <RefreshCw size={15} className={loading ? "spin" : ""} />
        </button>
      </div>
    </header>

    <section className="rider-region-live-section">
      <div className="rider-region-live-heading">
        <div><Activity size={18} /><strong>권역별 LIVE 현황</strong></div>
        <small>권역 카드를 누르면 기사 목록이 자동 필터링됩니다.</small>
      </div>

      <div className="rider-region-live-grid">
        {regionStats.map((item) => <button
          type="button"
          key={item.name}
          className={`rider-region-live-card ${region === item.name ? "active" : ""}`}
          onClick={() => setRegion(region === item.name ? "전체" : item.name)}
        >
          <div className="rider-region-live-card-head">
            <span><MapPin size={14} />{item.name}</span>
            <small>전체 {item.total}명</small>
          </div>
          <div className="rider-region-online"><i /><strong>{item.online}</strong><span>명 접속중</span></div>
          <div className="rider-region-metrics">
            <div className="driving"><Bike size={13} /><strong>{item.driving}</strong><span>배달중</span></div>
            <div className="waiting"><Clock3 size={13} /><strong>{item.waiting}</strong><span>대기중</span></div>
            <div><CheckCircle2 size={13} /><strong>{numberText(item.completed)}</strong><span>완료건수</span></div>
          </div>
          <div className="rider-region-progress-label"><span>접속률</span><strong>{item.onlineRate}%</strong></div>
          <div className="rider-region-progress"><i style={{ width: `${item.onlineRate}%` }} /></div>
        </button>)}
      </div>
    </section>

    <section className="riders-panel rider-control-list-panel">
      <div className="rider-panel-heading">
        <div>
          <span className="rider-panel-heading-icon"><Activity size={18} /></span>
          <div><strong>실시간 기사 리스트</strong><small>상태 우선 · 완료 건수 순으로 자동 정렬</small></div>
        </div>
        <span className="rider-panel-count">{filtered.length} RIDERS</span>
      </div>

      <div className="riders-toolbar rider-control-toolbar">
        <div className="rider-region-tabs rider-premium-tabs rider-control-tabs">
          {REGIONS.map((item) => <button type="button" key={item} className={region === item ? "active" : ""} onClick={() => setRegion(item)}>
            <span>{item}</span>
            <small>{item === "전체" ? riders.length : riders.filter((r) => r.region === item).length}</small>
          </button>)}
        </div>
        <label className="rider-search-box rider-premium-search rider-control-search">
          <Search size={17} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="기사명 또는 권역 검색" />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기">×</button>}
        </label>
      </div>

      {error && <div className="rider-live-error rider-premium-error"><SignalZero size={24} /><div><strong>기사 데이터를 불러오지 못했습니다.</strong><span>{error}</span></div></div>}
      {!error && !loading && filtered.length === 0 && <div className="rider-empty rider-premium-empty"><span><SignalZero size={30} /></span><strong>현재 표시할 기사 데이터가 없습니다.</strong><small>기사 수집 데이터가 들어오면 자동으로 표시됩니다.</small></div>}

      {filtered.length > 0 && <>
        <div className="rider-table-wrap rider-control-table-wrap">
          <table className="rider-table rider-table-v2 rider-live-table rider-premium-table rider-control-table">
            <thead><tr><th>기사</th><th>운행 상태</th><th>현재 권역</th><th>거절</th><th>취소</th><th>완료</th><th>점심피크</th><th>저녁피크</th><th>논피크</th></tr></thead>
            <tbody>{filtered.map((r) => <tr key={`${r.region}-${r.id}`}>
              <td><div className="rider-name-cell"><span>{r.name?.slice(0, 1)}</span><div><strong>{r.name}</strong><small>RIDER</small></div></div></td>
              <td><span className={`rider-status rider-premium-status ${statusClass(r.status)}`}><i />{r.status}</span></td>
              <td><span className="rider-region-cell"><MapPin size={13} />{r.region}</span></td>
              <td><div className="rider-rejection-cell"><strong>{numberText(r.rejected)}</strong><small>{rejectionRate(r).toFixed(1)}%</small></div></td>
              <td>{numberText(r.canceled)}</td>
              <td><strong className="rider-completed-value">{numberText(r.completed)}</strong></td>
              <td>{numberText(r.lunch)}</td><td>{numberText(r.dinner)}</td><td>{numberText(r.nonPeak)}</td>
            </tr>)}</tbody>
          </table>
        </div>

        <div className="rider-mobile-compact rider-control-mobile-list">
          {filtered.map((r) => <article className="rider-premium-mobile-card" key={`${r.region}-${r.id}`}>
            <div className="rider-mobile-card-head">
              <div className="rider-mobile-identity"><span className="rider-mobile-avatar">{r.name?.slice(0, 1)}</span><div><strong>{r.name}</strong><small><MapPin size={11} />{r.region}</small></div></div>
              <span className={`rider-status rider-premium-status ${statusClass(r.status)}`}><i />{r.status}</span>
            </div>
            <div className="rider-mobile-primary"><span>완료 건수</span><strong>{numberText(r.completed)}<small>건</small></strong></div>
            <div className="rider-mobile-metric-grid">
              <div><span>거절</span><strong>{numberText(r.rejected)}</strong><small>{rejectionRate(r).toFixed(1)}%</small></div>
              <div><span>취소</span><strong>{numberText(r.canceled)}</strong></div>
              <div><span>점심피크</span><strong>{numberText(r.lunch)}</strong></div>
              <div><span>저녁피크</span><strong>{numberText(r.dinner)}</strong></div>
              <div><span>논피크</span><strong>{numberText(r.nonPeak)}</strong></div>
            </div>
          </article>)}
        </div>
      </>}
    </section>

    <footer className="riders-data-note rider-premium-data-note">
      <div className="rider-data-note-icon"><Wifi size={17} /></div>
      <div><strong>30초 자동 갱신</strong><span>{latestSync ? `마지막 서버 수신 · ${new Date(latestSync).toLocaleString("ko-KR")}` : "기사 데이터 연결 대기 중입니다."}</span></div>
      <div className="rider-data-note-completed"><CheckCircle2 size={15} /><span>전체 완료 {numberText(summary.completed)}건</span></div>
      <Signal size={19} />
    </footer>
  </section>;
}
