import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bike,
  Coffee,
  Crosshair,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  Shield,
  Signal,
  Utensils,
  Users,
  X,
} from "lucide-react";

const DEFAULT_CENTER = [37.4979, 127.0276];
const MAP_ZOOM = 13;

const initialManagers = [
  { id: 1, name: "이재인", role: "BOSS/지사장", badge: "BOSS", region: "강남중앙1", status: "운행중", count: 42, updatedAt: Date.now(), lat: 37.4979, lng: 127.0276, isLive: true },
  { id: 2, name: "이선호", role: "총괄본부장", badge: "TEAM LEADER", region: "강남중앙2", status: "운행중", count: 37, updatedAt: Date.now() - 4000, lat: 37.5101, lng: 127.0437 },
  { id: 3, name: "정희철", role: "남중앙 팀장", badge: "TEAM LEADER", region: "강남남중앙", status: "배정대기", count: 28, updatedAt: Date.now() - 8000, lat: 37.4729, lng: 127.0413 },
  { id: 4, name: "서상원", role: "팀장", badge: "TEAM LEADER", region: "강남서초중앙", status: "운행중", count: 31, updatedAt: Date.now() - 5000, lat: 37.4917, lng: 127.0086 },
  { id: 5, name: "박성현", role: "팀장", badge: "TEAM LEADER", region: "강남중앙1", status: "식사중", count: 24, updatedAt: Date.now() - 12000, lat: 37.5047, lng: 127.0342 },
  { id: 6, name: "신정민", role: "팀장", badge: "TEAM LEADER", region: "강남중앙2", status: "운행중", count: 35, updatedAt: Date.now() - 6000, lat: 37.5172, lng: 127.0474 },
  { id: 7, name: "김태호", role: "팀장", badge: "TEAM LEADER", region: "강남서초중앙", status: "휴식중", count: 19, updatedAt: Date.now() - 18000, lat: 37.4857, lng: 127.0057 },
  { id: 8, name: "김남교", role: "팀장", badge: "TEAM LEADER", region: "강남남중앙", status: "운행중", count: 29, updatedAt: Date.now() - 7000, lat: 37.4787, lng: 127.0512 },
];

const statusIcon = {
  운행중: Bike,
  식사중: Utensils,
  휴식중: Coffee,
  배정대기: Crosshair,
};

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  return new Promise((resolve, reject) => {
    const existingCss = document.querySelector('link[data-ntc-leaflet="true"]');
    if (!existingCss) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.dataset.ntcLeaflet = "true";
      document.head.appendChild(link);
    }

    const existingScript = document.querySelector('script[data-ntc-leaflet="true"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.L), { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.dataset.ntcLeaflet = "true";
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

function formatAgo(timestamp, now) {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 5) return "방금 전";
  if (seconds < 60) return `${seconds}초 전`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}분 전`;
}

function markerHtml(manager, active) {
  const badgeClass = manager.badge === "BOSS" ? "boss" : "leader";
  const icon = manager.badge === "BOSS" ? "◆" : "➤";
  return `
    <div class="ntc-leaflet-marker ${badgeClass} ${active ? "selected" : ""}">
      <span class="ntc-leaflet-pulse"></span>
      <span class="ntc-leaflet-core">${icon}</span>
      <span class="ntc-leaflet-label"><strong>${manager.name}</strong><small>${manager.role}</small></span>
    </div>`;
}

function StatusChip({ icon: Icon, label, value, tone }) {
  return (
    <article className={`live-stat-chip ${tone || ""}`}>
      <span className="live-stat-icon"><Icon size={18} /></span>
      <span><small>{label}</small><strong>{value}</strong></span>
    </article>
  );
}

export default function AdminLiveControl() {
  const [managers, setManagers] = useState(initialManagers);
  const [selectedId, setSelectedId] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("전체");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [gpsState, setGpsState] = useState("idle");
  const [gpsMessage, setGpsMessage] = useState("위치 공유 대기");
  const [now, setNow] = useState(Date.now());

  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const watchIdRef = useRef(null);

  const selected = managers.find((manager) => manager.id === selectedId) || managers[0];
  const filteredManagers = useMemo(() => managers.filter((manager) => {
    const matchesText = `${manager.name} ${manager.role} ${manager.region}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filter === "전체" || manager.status === filter;
    return matchesText && matchesStatus;
  }), [managers, search, filter]);

  const counts = useMemo(() => ({
    riding: managers.filter((item) => item.status === "운행중").length,
    meal: managers.filter((item) => item.status === "식사중").length,
    rest: managers.filter((item) => item.status === "휴식중").length,
    waiting: managers.filter((item) => item.status === "배정대기").length,
  }), [managers]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapElementRef.current || mapRef.current) return;
        const map = L.map(mapElementRef.current, {
          zoomControl: false,
          attributionControl: true,
          preferCanvas: true,
        }).setView(DEFAULT_CENTER, MAP_ZOOM);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);

        L.control.zoom({ position: "bottomright" }).addTo(map);
        mapRef.current = map;
        setMapReady(true);
        window.setTimeout(() => map.invalidateSize(), 100);
      })
      .catch(() => setMapError("실시간 지도를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요."));

    return () => {
      cancelled = true;
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.L) return;
    const L = window.L;
    const nextIds = new Set(managers.map((manager) => manager.id));

    markersRef.current.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    managers.forEach((manager) => {
      const icon = L.divIcon({
        className: "ntc-marker-wrapper",
        html: markerHtml(manager, manager.id === selectedId),
        iconSize: [150, 70],
        iconAnchor: [75, 32],
      });
      const existing = markersRef.current.get(manager.id);
      if (existing) {
        existing.setLatLng([manager.lat, manager.lng]);
        existing.setIcon(icon);
      } else {
        const marker = L.marker([manager.lat, manager.lng], { icon, riseOnHover: true })
          .addTo(mapRef.current)
          .on("click", () => setSelectedId(manager.id));
        markersRef.current.set(manager.id, marker);
      }
    });
  }, [managers, selectedId, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !selected) return;
    mapRef.current.panTo([selected.lat, selected.lng], { animate: true, duration: 0.45 });
  }, [selectedId, mapReady]);

  const refresh = () => {
    setRefreshing(true);
    if (mapRef.current) mapRef.current.invalidateSize();
    window.setTimeout(() => setRefreshing(false), 650);
  };

  const selectManager = (manager) => {
    setSelectedId(manager.id);
    setSheetOpen(false);
  };

  const startGps = () => {
    if (!navigator.geolocation) {
      setGpsState("error");
      setGpsMessage("이 기기에서는 GPS를 사용할 수 없습니다.");
      return;
    }
    if (watchIdRef.current !== null) {
      const me = managers.find((item) => item.id === 1);
      if (me && mapRef.current) mapRef.current.setView([me.lat, me.lng], 16, { animate: true });
      return;
    }

    setGpsState("requesting");
    setGpsMessage("위치 권한을 확인하는 중입니다...");
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setManagers((current) => current.map((manager) => manager.id === 1
          ? { ...manager, lat: latitude, lng: longitude, updatedAt: Date.now(), accuracy, isLive: true }
          : manager));
        setGpsState("active");
        setGpsMessage(`실시간 위치 공유 중 · 오차 약 ${Math.round(accuracy)}m`);
        if (mapRef.current) mapRef.current.setView([latitude, longitude], 16, { animate: true });
      },
      (error) => {
        watchIdRef.current = null;
        setGpsState("error");
        if (error.code === 1) setGpsMessage("위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해 주세요.");
        else if (error.code === 2) setGpsMessage("현재 위치를 확인할 수 없습니다. GPS와 네트워크를 확인해 주세요.");
        else setGpsMessage("위치 확인 시간이 초과되었습니다. 다시 시도해 주세요.");
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 },
    );
  };

  return (
    <section className="live-control-page">
      <div className="live-control-head">
        <div>
          <span className="live-control-kicker"><i /> LIVE POSITION CONTROL</span>
          <h2>실시간 관제</h2>
          <p>실제 지도와 현재 기기 GPS를 연결해 관리자 위치를 확인합니다.</p>
        </div>
        <div className="live-control-sync">
          <Signal size={17} />
          <span><small>실시간 연결 상태</small><strong>{refreshing ? "갱신 중..." : gpsMessage}</strong></span>
          <button type="button" onClick={refresh} aria-label="위치 새로고침"><RefreshCw size={18} className={refreshing ? "spin" : ""} /></button>
        </div>
      </div>

      <div className="live-stat-row">
        <StatusChip icon={Users} label="현재 접속" value={`${managers.length}명`} tone="online" />
        <StatusChip icon={Bike} label="운행중" value={`${counts.riding}명`} tone="riding" />
        <StatusChip icon={Utensils} label="식사중" value={`${counts.meal}명`} tone="meal" />
        <StatusChip icon={Coffee} label="휴식중" value={`${counts.rest}명`} tone="rest" />
        <StatusChip icon={Crosshair} label="배정대기" value={`${counts.waiting}명`} tone="waiting" />
      </div>

      <div className="live-control-layout">
        <div className="live-map-card">
          <div className="live-map-toolbar">
            <div className="live-map-location"><MapPin size={17} /><span>서울 강남 운영권역</span><b>LIVE MAP</b></div>
            <div>
              <button type="button" className={`live-gps-button ${gpsState}`} onClick={startGps}><LocateFixed size={18} /><span>{gpsState === "active" ? "내 위치 추적 중" : "내 위치 연결"}</span></button>
            </div>
          </div>

          <div className="live-map-stage live-map-real">
            <div ref={mapElementRef} className="live-leaflet-map" />
            {!mapReady && !mapError && <div className="live-map-loading"><RefreshCw className="spin" size={22}/><strong>실시간 지도 연결 중</strong></div>}
            {mapError && <div className="live-map-loading error"><MapPin size={24}/><strong>{mapError}</strong></div>}

            {selected && (
              <article className="selected-manager-card live-selected-overlay">
                <button type="button" onClick={() => setSelectedId(0)} aria-label="상세 닫기"><X size={15}/></button>
                <div className="selected-manager-top">
                  <span className={selected.badge === "BOSS" ? "boss" : "leader"}>{selected.badge}</span>
                  <i className={`status-dot ${selected.status}`} />
                </div>
                <strong>{selected.name}</strong><small>{selected.role}</small>
                <div className="selected-manager-meta">
                  <span><small>현재 권역</small><b>{selected.region.replace("강남", "")}</b></span>
                  <span><small>오늘 수행</small><b>{selected.count}건</b></span>
                </div>
                <div className="selected-manager-foot"><span>{selected.status}</span><small>GPS {formatAgo(selected.updatedAt, now)}</small></div>
              </article>
            )}
          </div>

          <div className="live-map-mobile-bar" onClick={() => setSheetOpen(true)}>
            <span><Users size={18}/><b>관리자 {managers.length}명</b><small>현황 펼쳐보기</small></span>
            <ChevronHandle />
          </div>
        </div>

        <aside className="live-manager-panel">
          <div className="live-panel-head">
            <div><span>MANAGERS</span><strong>관리자 현황</strong></div>
            <b>{filteredManagers.length}</b>
          </div>
          <label className="live-manager-search"><Search size={17}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="이름·권역 검색" /></label>
          <div className="live-status-filters">
            {["전체", "운행중", "배정대기", "식사중", "휴식중"].map((item) => <button type="button" key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
          </div>
          <div className="live-manager-list">
            {filteredManagers.map((manager) => {
              const Icon = statusIcon[manager.status] || MapPin;
              return (
                <button type="button" key={manager.id} className={selectedId === manager.id ? "active" : ""} onClick={() => selectManager(manager)}>
                  <span className={`manager-list-avatar ${manager.badge === "BOSS" ? "boss" : "leader"}`}>{manager.name.slice(0, 1)}</span>
                  <span className="manager-list-info"><strong>{manager.name}<small>{manager.role}</small></strong><span><MapPin size={13}/>{manager.region.replace("강남", "")}</span></span>
                  <span className="manager-list-status"><b className={manager.status}><Icon size={13}/>{manager.status}</b><small>{formatAgo(manager.updatedAt, now)}</small></span>
                </button>
              );
            })}
          </div>
          <div className="live-panel-note"><Shield size={16}/><span>현재 패치는 실제 지도와 이 기기의 GPS를 사용합니다. 다른 관리자 기기의 위치 공유는 서버 연결 후 활성화됩니다.</span></div>
        </aside>
      </div>

      {sheetOpen && (
        <div className="live-mobile-sheet-layer" onClick={() => setSheetOpen(false)}>
          <div className="live-mobile-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="live-sheet-handle" />
            <div className="live-panel-head"><div><span>LIVE MANAGERS</span><strong>관리자 현황</strong></div><button type="button" onClick={() => setSheetOpen(false)}><X size={19}/></button></div>
            <div className="live-manager-list">
              {managers.map((manager) => <button type="button" key={manager.id} onClick={() => selectManager(manager)}><span className={`manager-list-avatar ${manager.badge === "BOSS" ? "boss" : "leader"}`}>{manager.name.slice(0, 1)}</span><span className="manager-list-info"><strong>{manager.name}<small>{manager.role}</small></strong><span><MapPin size={13}/>{manager.region.replace("강남", "")}</span></span><span className="manager-list-status"><b className={manager.status}>{manager.status}</b><small>{formatAgo(manager.updatedAt, now)}</small></span></button>)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ChevronHandle() {
  return <span className="live-chevron-handle">⌃</span>;
}
