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

const initialManagers = [];

const statusIcon = {
  운행중: Bike,
  "근무 중": Bike,
  위치공유중: Navigation,
  식사중: Utensils,
  휴식중: Coffee,
  휴식: Coffee,
  배정대기: Crosshair,
  배정대기중: Crosshair,
  "GPS 끊김": Signal,
  "위치 미수신": MapPin,
};

const NAVER_MAP_CLIENT_ID = "fdibsay7lo";

function loadNaverMaps() {
  if (window.naver?.maps) return Promise.resolve(window.naver.maps);

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-ntc-naver-map="true"]');

    if (existingScript) {
      if (window.naver?.maps) {
        resolve(window.naver.maps);
        return;
      }

      existingScript.addEventListener(
        "load",
        () => {
          if (window.naver?.maps) resolve(window.naver.maps);
          else reject(new Error("NAVER Maps SDK가 초기화되지 않았습니다."));
        },
        { once: true },
      );
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NAVER_MAP_CLIENT_ID}`;
    script.async = true;
    script.defer = true;
    script.dataset.ntcNaverMap = "true";
    script.onload = () => {
      if (window.naver?.maps) resolve(window.naver.maps);
      else reject(new Error("NAVER Maps SDK가 초기화되지 않았습니다."));
    };
    script.onerror = () => reject(new Error("NAVER Maps SDK를 불러오지 못했습니다."));
    document.head.appendChild(script);
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
  const icon = manager.badge === "BOSS" ? "B" : "TL";

  return `
    <div class="ntc-naver-marker compact ${badgeClass} ${active ? "selected" : ""}">
      <span class="ntc-naver-marker-label">
        <strong>${manager.name}</strong>
        <small>${manager.role}</small>
      </span>
      <span class="ntc-naver-marker-ring"></span>
      <span class="ntc-naver-marker-core">${icon}</span>
    </div>
  `;
}

function StatusChip({ icon: Icon, label, value, tone }) {
  return (
    <article className={`live-stat-chip ${tone || ""}`}>
      <span className="live-stat-icon"><Icon size={18} /></span>
      <span><small>{label}</small><strong>{value}</strong></span>
    </article>
  );
}

export default function AdminLiveControl({ token: suppliedToken, currentUser }) {
  const [managers, setManagers] = useState(initialManagers);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("전체");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [gpsState, setGpsState] = useState("idle");
  const [gpsMessage, setGpsMessage] = useState("위치 공유 대기");
  const [now, setNow] = useState(Date.now());
  const [serverError, setServerError] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState(null);

  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const watchIdRef = useRef(null);
  const initialCenterAppliedRef = useRef(false);
  const manualMapMoveRef = useRef(false);
  const resizeObserverRef = useRef(null);

  const selected = managers.find((manager) => manager.id === selectedId) || null;
  const filteredManagers = useMemo(() => managers.filter((manager) => {
    const matchesText = `${manager.name} ${manager.role} ${manager.region}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filter === "전체" || manager.status === filter;
    return matchesText && matchesStatus;
  }), [managers, search, filter]);

  const counts = useMemo(() => ({
    riding: managers.filter((item) =>
      ["운행중", "근무 중", "위치 공유중"].includes(item.status)
    ).length,
    meal: managers.filter((item) => item.status === "식사중").length,
    rest: managers.filter((item) => ["휴식중", "휴식"].includes(item.status)).length,
    waiting: managers.filter((item) =>
      ["배정대기", "배정대기중"].includes(item.status)
    ).length,
  }), [managers]);

  const getToken = () =>
    suppliedToken ||
    localStorage.getItem("ntc_token") ||
    sessionStorage.getItem("ntc_token") ||
    "";

  const normalizeLiveManager = (item) => {
    const rawUpdated = String(item.updated_at || "").trim();
    const updatedAt = rawUpdated
      ? new Date(rawUpdated.includes("T") ? rawUpdated : `${rawUpdated.replace(" ", "T")}Z`).getTime()
      : 0;
    const hasLocation =
      item.latitude !== null &&
      item.longitude !== null &&
      Number.isFinite(Number(item.latitude)) &&
      Number.isFinite(Number(item.longitude));
    const staleSeconds = updatedAt
      ? Math.max(0, Math.floor((Date.now() - updatedAt) / 1000))
      : 999999;
    const stale = hasLocation && staleSeconds >= 30;

    return {
      id: Number(item.user_id),
      name: item.name,
      role: item.role,
      badge: item.role === "BOSS/지사장" ? "BOSS" : "TEAM LEADER",
      region: item.region || "권역 미지정",
      status: !hasLocation
        ? "위치 미수신"
        : stale
          ? "GPS 끊김"
          : (item.attendance_status || "위치 공유중"),
      count: Number(item.orders || 0),
      updatedAt,
      lat: hasLocation ? Number(item.latitude) : null,
      lng: hasLocation ? Number(item.longitude) : null,
      accuracy: item.accuracy == null ? null : Number(item.accuracy),
      speed: item.speed == null ? null : Number(item.speed),
      heading: item.heading == null ? null : Number(item.heading),
      hasLocation,
      isLive: hasLocation && !stale,
    };
  };

  const loadLiveManagers = async () => {
    const token = getToken();
    if (!token) return;

    try {
      const response = await fetch("/api/live-map/locations", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || "실시간 위치를 불러오지 못했습니다.");
      }

      const nextManagers = (result.locations || []).map(normalizeLiveManager);

      setManagers(nextManagers);
      setServerError("");
      setLastSyncAt(Date.now());
      setSelectedId((current) => {
        if (current && nextManagers.some((manager) => manager.id === current)) {
          return current;
        }

        const me = nextManagers.find(
          (manager) => Number(manager.id) === Number(currentUser?.id),
        );
        if (me?.hasLocation) return me.id;

        return nextManagers.find((manager) => manager.hasLocation)?.id ?? null;
      });
    } catch (error) {
      console.error("live locations load failed", error);
      setServerError(error.message || "실시간 위치를 불러오지 못했습니다.");
    }
  };

  useEffect(() => {
    loadLiveManagers();
    const timer = window.setInterval(loadLiveManagers, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadNaverMaps()
      .then((maps) => {
        if (cancelled || !mapElementRef.current || mapRef.current) return;

        const map = new maps.Map(mapElementRef.current, {
          center: new maps.LatLng(DEFAULT_CENTER[0], DEFAULT_CENTER[1]),
          zoom: 16,
          minZoom: 10,
          maxZoom: 20,
          zoomControl: true,
          zoomControlOptions: {
            position: maps.Position.RIGHT_BOTTOM,
          },
          mapTypeControl: false,
          scaleControl: false,
          logoControl: true,
          mapDataControl: false,
        });

        mapRef.current = map;

        const forceMapResize = () => {
          if (!mapRef.current || !mapElementRef.current) return;
          const rect = mapElementRef.current.getBoundingClientRect();
          if (rect.width < 10 || rect.height < 10) return;

          maps.Event.trigger(mapRef.current, "resize");

          const current = managers.find(
            (manager) =>
              Number(manager.id) === Number(currentUser?.id) &&
              manager.hasLocation,
          ) || managers.find((manager) => manager.hasLocation);

          if (current && !initialCenterAppliedRef.current) {
            mapRef.current.setCenter(
              new maps.LatLng(current.lat, current.lng),
            );
            mapRef.current.setZoom(17);
            initialCenterAppliedRef.current = true;
          }
        };

        resizeObserverRef.current = new ResizeObserver(() => {
          window.requestAnimationFrame(forceMapResize);
        });
        resizeObserverRef.current.observe(mapElementRef.current);

        window.addEventListener("resize", forceMapResize);
        window.addEventListener("orientationchange", forceMapResize);
        document.addEventListener("visibilitychange", forceMapResize);

        window.setTimeout(forceMapResize, 100);
        window.setTimeout(forceMapResize, 350);
        window.setTimeout(forceMapResize, 900);

        maps.Event.addListener(map, "dragstart", () => {
          manualMapMoveRef.current = true;
        });
        maps.Event.addListener(map, "zoom_changed", () => {
          if (initialCenterAppliedRef.current) {
            manualMapMoveRef.current = true;
          }
        });

        setMapReady(true);

        window.setTimeout(() => {
          maps.Event.trigger(map, "resize");
        }, 120);
      })
      .catch((error) => {
        console.error("NAVER map load failed", error);
        setMapError(
          "네이버지도를 불러오지 못했습니다. 네이버클라우드 Web 서비스 URL과 Client ID를 확인해 주세요.",
        );
      });

    return () => {
      cancelled = true;

      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }

      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current.clear();

      if (mapRef.current && window.naver?.maps) {
        window.naver.maps.Event.clearInstanceListeners(mapRef.current);
      }

      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.naver?.maps) return;

    const maps = window.naver.maps;
    const mapManagers = managers.filter(
      (manager) =>
        manager.hasLocation &&
        Number.isFinite(manager.lat) &&
        Number.isFinite(manager.lng),
    );
    const nextIds = new Set(mapManagers.map((manager) => manager.id));

    markersRef.current.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        maps.Event.clearInstanceListeners(marker);
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    });

    mapManagers.forEach((manager) => {
      const position = new maps.LatLng(manager.lat, manager.lng);
      const content = markerHtml(manager, manager.id === selectedId);
      const existing = markersRef.current.get(manager.id);

      if (existing) {
        existing.setPosition(position);
        existing.setIcon({
          content,
          size: new maps.Size(72, 58),
          anchor: new maps.Point(36, 51),
        });
        return;
      }

      const marker = new maps.Marker({
        map: mapRef.current,
        position,
        clickable: true,
        zIndex: manager.badge === "BOSS" ? 120 : 100,
        icon: {
          content,
          size: new maps.Size(72, 58),
          anchor: new maps.Point(36, 51),
        },
      });

      maps.Event.addListener(marker, "click", () => {
        setSelectedId(manager.id);
      });

      markersRef.current.set(manager.id, marker);
    });
  }, [managers, selectedId, mapReady]);

  useEffect(() => {
    if (
      !mapReady ||
      !mapRef.current ||
      !selected?.hasLocation ||
      !window.naver?.maps
    ) {
      return;
    }

    const position = new window.naver.maps.LatLng(selected.lat, selected.lng);

    if (!initialCenterAppliedRef.current) {
      mapRef.current.setCenter(position);
      mapRef.current.setZoom(17);
      initialCenterAppliedRef.current = true;
      manualMapMoveRef.current = false;
      return;
    }

    // Only marker/list clicks update the center. Five-second data refreshes never reset zoom.
    if (!manualMapMoveRef.current) {
      mapRef.current.panTo(position);
    }
  }, [selectedId, mapReady]);

  const refresh = async () => {
    setRefreshing(true);
    if (mapRef.current && window.naver?.maps) {
      window.naver.maps.Event.trigger(mapRef.current, "resize");
    }
    await loadLiveManagers();
    window.setTimeout(() => setRefreshing(false), 350);
  };

  const selectManager = (manager) => {
    setSelectedId(manager.id);
    manualMapMoveRef.current = false;
    setSheetOpen(false);
  };

  const startGps = () => {
    if (!navigator.geolocation) {
      setGpsState("error");
      setGpsMessage("이 기기에서는 GPS를 사용할 수 없습니다.");
      return;
    }
    if (watchIdRef.current !== null) {
      const me =
        managers.find((manager) => Number(manager.id) === Number(currentUser?.id) && manager.hasLocation) ||
        selected ||
        managers.find((manager) => manager.hasLocation);
      if (me?.hasLocation && mapRef.current && window.naver?.maps) {
        mapRef.current.setZoom(17);
        mapRef.current.panTo(new window.naver.maps.LatLng(me.lat, me.lng));
      }
      return;
    }

    setGpsState("requesting");
    setGpsMessage("위치 권한을 확인하는 중입니다...");
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, accuracy, heading, speed } = position.coords;

        try {
          const response = await fetch("/api/location/update", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getToken()}`,
            },
            body: JSON.stringify({
              latitude,
              longitude,
              accuracy,
              heading: Number.isFinite(heading) ? heading : null,
              speed: Number.isFinite(speed) ? speed : null,
            }),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(result.message || "위치 저장에 실패했습니다.");
          }

          setGpsState("active");
          setGpsMessage(`실시간 위치 공유 중 · 오차 약 ${Math.round(accuracy)}m`);
          await loadLiveManagers();

          if (mapRef.current && window.naver?.maps) {
            mapRef.current.setZoom(17);
            mapRef.current.panTo(new window.naver.maps.LatLng(latitude, longitude));
          }
        } catch (error) {
          setGpsState("error");
          setGpsMessage(error.message || "위치 저장에 실패했습니다.");
        }
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
          <p>네이버지도와 현재 기기 GPS를 연결해 관리자 위치를 확인합니다.</p>
        </div>
        <div className="live-control-sync">
          <Signal size={17} />
          <span>
            <small>실시간 연결 상태</small>
            <strong>
              {refreshing
                ? "갱신 중..."
                : serverError
                  ? serverError
                  : lastSyncAt
                    ? `${gpsMessage} · 서버 ${formatAgo(lastSyncAt, now)}`
                    : gpsMessage}
            </strong>
          </span>
          <button type="button" onClick={refresh} aria-label="위치 새로고침"><RefreshCw size={18} className={refreshing ? "spin" : ""} /></button>
        </div>
      </div>

      <div className="live-stat-row">
        <StatusChip
          icon={Users}
          label="현재 접속"
          value={`${managers.filter((manager) => manager.isLive).length}명`}
          tone="online"
        />
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
            <div ref={mapElementRef} className="live-naver-map" />
            {!mapReady && !mapError && <div className="live-map-loading"><RefreshCw className="spin" size={22}/><strong>실시간 지도 연결 중</strong></div>}
            {mapError && <div className="live-map-loading error"><MapPin size={24}/><strong>{mapError}</strong></div>}
            {!mapError && serverError && (
              <div className="live-map-loading error">
                <Signal size={24}/>
                <strong>{serverError}</strong>
              </div>
            )}
            {mapReady && !mapError && !serverError && managers.length === 0 && (
              <div className="live-map-loading live-map-empty">
                <LocateFixed size={24}/>
                <strong>현재 수신된 관리자 위치가 없습니다.</strong>
                <span>관리자 기기에서 위치 권한을 허용하면 자동으로 표시됩니다.</span>
              </div>
            )}

          </div>

          <div className="live-map-mobile-bar" onClick={() => setSheetOpen(true)}>
            <span>
              <Users size={18}/>
              <b>승인 관리자 {managers.length}명</b>
              <small>위치 수신 {managers.filter((manager) => manager.hasLocation).length}명</small>
            </span>
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
                  <span className="manager-list-status">
                    <b className={manager.status}><Icon size={13}/>{manager.status}</b>
                    <small>
                      {!manager.hasLocation
                        ? "위치 권한 허용 전"
                        : <>
                            {manager.accuracy ? `오차 ${Math.round(manager.accuracy)}m · ` : ""}
                            {formatAgo(manager.updatedAt, now)}
                          </>}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="live-panel-note"><Shield size={16}/><span>D1에 저장된 실제 승인 관리자 GPS만 표시합니다. 30초 이상 미수신 시 GPS 끊김으로 표시됩니다.</span></div>
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
