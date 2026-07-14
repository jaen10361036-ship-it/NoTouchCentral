import React, { useMemo, useState } from "react";
import {
  Activity,
  Check,
  Clock3,
  Gauge,
  LayoutGrid,
  RefreshCw,
  Rows3,
  TimerReset,
  TrendingUp,
  Users,
} from "lucide-react";

const slotMeta = [
  { key: "morning", name: "아침 논피크", time: "06:00 ~ 10:54" },
  { key: "lunch", name: "점심 피크", time: "10:55 ~ 12:59" },
  { key: "afternoon", name: "오후 논피크", time: "13:00 ~ 16:54" },
  { key: "dinner", name: "저녁 피크", time: "16:55 ~ 19:59", active: true },
  { key: "night", name: "밤 논피크", time: "20:00 ~ 05:59", upcoming: true },
];

const regions = [
  {
    order: "01",
    name: "강남중앙1",
    tone: "blue",
    reject: 7.4,
    slots: [
      { target: 112, current: 112, perRider: 0 },
      { target: 223, current: 223, perRider: 0 },
      { target: 207, current: 207, perRider: 0 },
      { target: 293, current: 228, perRider: 2.8 },
      { target: 126, current: 0, perRider: null },
    ],
  },
  {
    order: "02",
    name: "강남중앙2",
    tone: "green",
    reject: 8.1,
    slots: [
      { target: 108, current: 108, perRider: 0 },
      { target: 216, current: 216, perRider: 0 },
      { target: 202, current: 202, perRider: 0 },
      { target: 286, current: 239, perRider: 2.1 },
      { target: 122, current: 0, perRider: null },
    ],
  },
  {
    order: "03",
    name: "강남서초중앙",
    tone: "purple",
    reject: 8.7,
    slots: [
      { target: 148, current: 148, perRider: 0 },
      { target: 296, current: 296, perRider: 0 },
      { target: 274, current: 274, perRider: 0 },
      { target: 388, current: 296, perRider: 3.3 },
      { target: 168, current: 0, perRider: null },
    ],
  },
  {
    order: "04",
    name: "남중앙",
    tone: "pink",
    reject: 9.6,
    slots: [
      { target: 104, current: 104, perRider: 0 },
      { target: 209, current: 209, perRider: 0 },
      { target: 196, current: 196, perRider: 0 },
      { target: 278, current: 186, perRider: 4.0 },
      { target: 118, current: 0, perRider: null },
    ],
  },
];

function progressOf(current, target) {
  return target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
}

function getSlotStatus(slot, meta) {
  if (meta.upcoming) return { label: "예정", className: "upcoming" };
  const progress = progressOf(slot.current, slot.target);
  if (progress >= 100) return { label: "완료", className: "success" };
  if (progress >= 85) return { label: "순항", className: "cruising" };
  if (progress >= 70) return { label: "집중", className: "focus" };
  return { label: "주의", className: "danger" };
}

function AdminSetControl() {
  const [view, setView] = useState("region");

  const totals = useMemo(() => {
    let target = 0;
    let current = 0;
    regions.forEach((region) => {
      region.slots.forEach((slot) => {
        target += slot.target;
        current += slot.current;
      });
    });
    return {
      target,
      current,
      remaining: Math.max(0, target - current),
      progress: progressOf(current, target),
    };
  }, []);

  return (
    <div className="set-control-page set-control-v2">
      <section className="set-control-heading">
        <div>
          <span className="section-label">SET CONTROL</span>
          <h2><Activity size={25} /> 실시간 세트관제</h2>
          <p>권역별 하루 5개 구간을 한 화면에서 비교하고 관리합니다.</p>
        </div>
        <div className="set-control-updated"><RefreshCw size={14} /><span>18:06 업데이트</span></div>
      </section>

      <section className="set-control-livebar">
        <div className="set-live-state"><i /> 진행 중</div>
        <div className="set-current-slot"><Clock3 size={16} /><span>현재 구간</span><strong>저녁 피크</strong><small>16:55 ~ 19:59</small></div>
        <div className="set-countdown"><TimerReset size={16} /><span>구간 종료까지</span><strong>01:53:24</strong></div>
        <div className="set-control-date">TODAY <strong>2026.07.14</strong></div>
      </section>

      <section className="set-v2-summary">
        <div className="set-v2-summary-main">
          <div><span>오늘 전체 달성률</span><strong>{totals.progress}%</strong></div>
          <div className="set-v2-summary-track"><i style={{ width: `${totals.progress}%` }} /></div>
        </div>
        <div className="set-v2-summary-stats">
          <div><span>전체 목표</span><strong>{totals.target.toLocaleString()}건</strong></div>
          <div><span>현재 완료</span><strong>{totals.current.toLocaleString()}건</strong></div>
          <div><span>전체 잔여</span><strong>{totals.remaining.toLocaleString()}건</strong></div>
        </div>
      </section>

      <section className="set-v2-toolbar">
        <div>
          <span className="section-label">REGION × TIME CONTROL</span>
          <h3>권역별 5구간 현황</h3>
        </div>
        <div className="set-v2-view-switch">
          <button className={view === "region" ? "active" : ""} onClick={() => setView("region")}><Rows3 size={14} /> 권역별 보기</button>
          <button className={view === "slot" ? "active" : ""} onClick={() => setView("slot")}><LayoutGrid size={14} /> 구간별 보기</button>
        </div>
      </section>

      {view === "region" ? (
        <section className="set-v2-region-board">
          {regions.map((region) => {
            const regionTarget = region.slots.reduce((sum, slot) => sum + slot.target, 0);
            const regionCurrent = region.slots.reduce((sum, slot) => sum + slot.current, 0);
            const regionProgress = progressOf(regionCurrent, regionTarget);
            return (
              <article className={`set-v2-region ${region.tone}`} key={region.name}>
                <header className="set-v2-region-header">
                  <div className="set-v2-region-title">
                    <span>{region.order}</span>
                    <div><h4>{region.name}</h4><small>팀거절률 {region.reject.toFixed(1)}%</small></div>
                  </div>
                  <div className="set-v2-region-total">
                    <span>오늘 누적</span>
                    <strong>{regionProgress}%</strong>
                    <small>{regionCurrent.toLocaleString()} / {regionTarget.toLocaleString()}건</small>
                  </div>
                </header>

                <div className="set-v2-slot-scroll">
                  <div className="set-v2-slot-row">
                    {slotMeta.map((meta, index) => {
                      const slot = region.slots[index];
                      const progress = progressOf(slot.current, slot.target);
                      const remaining = Math.max(0, slot.target - slot.current);
                      const status = getSlotStatus(slot, meta);
                      return (
                        <div className={`set-v2-slot ${meta.active ? "active" : ""} ${meta.upcoming ? "upcoming" : ""}`} key={meta.key}>
                          <div className="set-v2-slot-head">
                            <div><b>{meta.name}</b><small>{meta.time}</small></div>
                            <span className={`set-v2-slot-status ${status.className}`}>{status.className === "success" && <Check size={11} />}{status.label}</span>
                          </div>
                          <div className="set-v2-slot-progress"><strong>{progress}%</strong><span>{slot.current} / {slot.target}</span></div>
                          <div className="set-v2-slot-track"><i style={{ width: `${progress}%` }} /></div>
                          <div className="set-v2-slot-numbers">
                            <div><span>목표</span><strong>{slot.target}건</strong></div>
                            <div><span>완료</span><strong>{slot.current}건</strong></div>
                            <div><span>잔여</span><strong>{remaining}건</strong></div>
                          </div>
                          <div className="set-v2-per-rider"><Users size={13} /><span>명당</span><strong>{slot.perRider === null ? "-" : `${slot.perRider.toFixed(1)}건`}</strong></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="set-v2-slot-board">
          {slotMeta.map((meta, slotIndex) => (
            <article className={`set-v2-slot-group ${meta.active ? "active" : ""}`} key={meta.key}>
              <header><div><b>{meta.name}</b><small>{meta.time}</small></div>{meta.active && <span>현재 구간</span>}</header>
              <div className="set-v2-slot-group-grid">
                {regions.map((region) => {
                  const slot = region.slots[slotIndex];
                  const progress = progressOf(slot.current, slot.target);
                  const remaining = Math.max(0, slot.target - slot.current);
                  return (
                    <div className={`set-v2-compare-card ${region.tone}`} key={region.name}>
                      <div><b>{region.name}</b><strong>{progress}%</strong></div>
                      <div className="set-v2-slot-track"><i style={{ width: `${progress}%` }} /></div>
                      <p>완료 {slot.current} · 잔여 {remaining} · 명당 {slot.perRider === null ? "-" : `${slot.perRider.toFixed(1)}건`}</p>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="set-v2-guide"><Gauge size={20} /><div><strong>현재 구간은 형광 라임으로 강조됩니다.</strong><p>완료 구간은 체크, 예정 구간은 비활성으로 표시하며 각 구간별 명당 필요 건수를 함께 제공합니다.</p></div><TrendingUp size={18} /></section>
    </div>
  );
}

export default AdminSetControl;
