import React, { useMemo } from "react";
import {
  Check,
  Clock3,
  Flame,
  Gauge,
  Sparkles,
  Target,
  Trophy,
  Users,
} from "lucide-react";

const missionRegions = [
  { order: "01", name: "강남중앙1", current: 150, target: 200, perRider: 6.5, tone: "blue" },
  { order: "02", name: "강남중앙2", current: 120, target: 200, perRider: 5.7, tone: "green" },
  { order: "03", name: "강남서초중앙", current: 90, target: 200, perRider: 3.2, tone: "purple" },
  { order: "04", name: "남중앙", current: 110, target: 200, perRider: 5.5, tone: "pink" },
];

function getMissionState(progress) {
  if (progress >= 100) return { label: "성공", className: "success", icon: Check };
  if (progress >= 80) return { label: "순항", className: "cruising", icon: Flame };
  if (progress >= 50) return { label: "주의", className: "warning", icon: Gauge };
  return { label: "지원 필요", className: "danger", icon: Users };
}

function MissionRing({ progress, tone, compact = false }) {
  const safeProgress = Math.min(100, Math.max(0, progress));
  const ringStyle = { "--mission-progress": `${safeProgress * 3.6}deg` };

  return (
    <div className={`team-mission-ring ${tone} ${safeProgress >= 100 ? "complete" : ""} ${compact ? "compact" : ""}`} style={ringStyle}>
      <div className="team-mission-ring-core">
        {safeProgress >= 100 && <Check size={compact ? 16 : 22} />}
        <strong>{safeProgress}%</strong>
        {!compact && <span>{safeProgress >= 100 ? "달성" : "완료"}</span>}
      </div>
    </div>
  );
}

function AdminTeamMission() {
  const mission = {
    name: "디너 미션",
    time: "16:55 ~ 19:59",
    status: "진행 중",
  };

  const totals = useMemo(() => {
    const current = missionRegions.reduce((sum, region) => sum + region.current, 0);
    const target = missionRegions.reduce((sum, region) => sum + region.target, 0);
    return { current, target, progress: Math.round((current / target) * 100) };
  }, []);

  return (
    <div className="team-mission-page">
      <section className="team-mission-header">
        <div className="team-mission-title-block">
          <span className="section-label">TEAM MISSION</span>
          <h2><Target size={25} /> 팀미션 현황</h2>
          <p>오늘의 목표를 함께 달성하세요. 백전백승!</p>
        </div>

        <div className="team-mission-summary">
          <div className="team-mission-summary-ring">
            <span>전체 완료율</span>
            <MissionRing progress={totals.progress} tone="lime" compact />
          </div>
          <div className="team-mission-summary-count">
            <span>전체 완료 건수</span>
            <strong>{totals.current.toLocaleString()} <small>/ {totals.target.toLocaleString()}</small></strong>
          </div>
        </div>
      </section>

      <section className="team-mission-toolbar">
        <div className="team-mission-live"><i /> {mission.status}</div>
        <div className="team-mission-period"><Clock3 size={16} /><strong>{mission.name}</strong><span>{mission.time}</span></div>
        <div className="team-mission-today">TODAY <strong>2026.07.14</strong></div>
      </section>

      <section className="team-mission-status-legend" aria-label="팀미션 상태 기준">
        <span className="success"><Check size={14} /> 성공 <small>100%</small></span>
        <span className="cruising"><Flame size={14} /> 순항 <small>80~99%</small></span>
        <span className="warning"><Gauge size={14} /> 주의 <small>50~79%</small></span>
        <span className="danger"><Users size={14} /> 지원 필요 <small>0~49%</small></span>
      </section>

      <section className="team-mission-grid">
        {missionRegions.map((region) => {
          const progress = Math.round((region.current / region.target) * 100);
          const state = getMissionState(progress);
          const StateIcon = state.icon;

          return (
            <article className={`team-mission-card ${region.tone} ${progress < 100 ? "active-pulse" : ""}`} key={region.name}>
              <div className="team-mission-card-head">
                <span className="team-mission-order">{region.order}</span>
                <h3>{region.name}</h3>
                <span className={`team-mission-state ${state.className}`}><StateIcon size={13} /> {state.label}</span>
              </div>

              <MissionRing progress={progress} tone={region.tone} />

              <div className="team-mission-count">
                <span>완료 건수</span>
                <strong>{region.current.toLocaleString()} <small>/ {region.target.toLocaleString()}</small></strong>
              </div>

              <div className="team-mission-metrics">
                <div>
                  <span>완료</span>
                  <strong>{region.current.toLocaleString()}건</strong>
                </div>
                <div>
                  <span>명당</span>
                  <strong><Flame size={13} /> {region.perRider.toFixed(1)}건</strong>
                </div>
                <div>
                  <span>목표까지</span>
                  <strong>{Math.max(0, region.target - region.current).toLocaleString()}건</strong>
                </div>
              </div>

              <div className={`team-mission-status-bar ${state.className}`}>
                <span><StateIcon size={15} /> 현재 상태</span>
                <strong>{progress >= 100 ? "성공 완료" : state.label}</strong>
              </div>
            </article>
          );
        })}
      </section>

      <section className="team-mission-guide">
        <div className="team-mission-guide-icon"><Trophy size={27} /></div>
        <div>
          <strong>팀미션 목표 달성을 위해 전원이 힘을 모아주세요!</strong>
          <span>하나의 권역도 포기하지 않고, 끝까지 함께 가면 백전백승입니다.</span>
        </div>
        <div className="team-mission-guide-badge"><Sparkles size={15} /> 전 권역 100% 목표</div>
      </section>
    </div>
  );
}

export default AdminTeamMission;
