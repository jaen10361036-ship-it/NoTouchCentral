import React, { useMemo } from "react";
import {
  Activity,
  ArrowRight,
  BellRing,
  CheckCircle2,
  Clock3,
  Flame,
  Megaphone,
  Radio,
  Sparkles,
  Target,
  Trophy,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";
import StatCard from "../components/StatCard";

const heroMessages = [
  "대한민국 최고의 운영은 오늘도 노터치센트럴에서 시작됩니다.",
  "백전백승은 준비된 운영에서 시작됩니다.",
  "모든 권역의 성공을 향해 오늘도 함께 달립니다.",
  "안정적인 운영이 최고의 경쟁력입니다.",
  "오늘의 작은 판단이 최고의 결과를 만듭니다.",
  "현장의 흐름을 읽고, 가장 빠르게 움직입니다.",
  "데이터와 팀워크로 오늘의 성공을 완성합니다.",
  "모든 관리자가 같은 목표를 향해 움직입니다.",
];

const managers = [
  { name: "이재인", role: "BOSS · 지사장", time: "09:32", state: "운영 총괄", region: "강남중앙1", count: 28, tone: "lime" },
  { name: "이선호", role: "운영실장", time: "09:48", state: "배정 중", region: "강남중앙1", count: 34, tone: "blue" },
  { name: "정희철", role: "남중앙 팀장", time: "09:54", state: "관제 중", region: "강남남중앙", count: 31, tone: "violet" },
  { name: "서상원", role: "팀장", time: "10:03", state: "수행 중", region: "강남서초중앙", count: 22, tone: "amber" },
];

const setRows = [
  { region: "강남중앙1", riders: 46, maxRiders: 52, rejection: "7.4%", target: 600, current: 600, remain: 0, perRider: "0.0건", progress: 100, state: "완료", tone: "success" },
  { region: "강남중앙2", riders: 44, maxRiders: 50, rejection: "8.1%", target: 600, current: 500, remain: 100, perRider: "2.3건", progress: 83, state: "진행 중", tone: "info" },
  { region: "강남서초중앙", riders: 48, maxRiders: 55, rejection: "8.7%", target: 800, current: 700, remain: 100, perRider: "2.1건", progress: 88, state: "집중", tone: "warning" },
  { region: "강남남중앙", riders: 40, maxRiders: 47, rejection: "9.6%", target: 600, current: 400, remain: 200, perRider: "5.0건", progress: 67, state: "주의", tone: "danger" },
];

const missionRows = [
  { name: "강남중앙1", riders: 46, maxRiders: 52, rejection: "7.4%", target: 70, current: 70, remain: 0, perRider: "0.0건", progress: 100, status: "완료", tone: "success" },
  { name: "강남중앙2", riders: 44, maxRiders: 50, rejection: "8.1%", target: 70, current: 59, remain: 11, perRider: "0.3건", progress: 84, status: "진행 중", tone: "info" },
  { name: "강남서초중앙", riders: 48, maxRiders: 55, rejection: "8.7%", target: 75, current: 57, remain: 18, perRider: "0.4건", progress: 76, status: "집중", tone: "warning" },
  { name: "강남남중앙", riders: 40, maxRiders: 47, rejection: "9.6%", target: 75, current: 48, remain: 27, perRider: "0.7건", progress: 64, status: "주의", tone: "danger" },
];

const rewardRows = [
  { region: "강남중앙1", grade: "GOLD", rate: 94, total: 8160, totalTarget: 8600, dinner: 1152, dinnerTarget: 1280, tone: "warning" },
  { region: "강남중앙2", grade: "BLACK", rate: 91, total: 7824, totalTarget: 8600, dinner: 1098, dinnerTarget: 1280, tone: "info" },
  { region: "강남서초중앙", grade: "GOLD", rate: 93, total: 8040, totalTarget: 8600, dinner: 1136, dinnerTarget: 1280, tone: "warning" },
  { region: "강남남중앙", grade: "BLACK", rate: 88, total: 7568, totalTarget: 8600, dinner: 1024, dinnerTarget: 1280, tone: "danger" },
];

function AdminHome({ currentRegion = "강남중앙1", onOpenRegion }) {
  const heroMessage = useMemo(() => {
    const seed = new Date().getHours() + new Date().getDate();
    return heroMessages[seed % heroMessages.length];
  }, []);

  const hasMission = true;

  return (
    <div className="dashboard-grid">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="hero-kicker"><Radio size={14} /> 실시간 운영 상태</span>
          <p className="hero-greeting">좋은 오후입니다, <strong>이재인 지사장님.</strong></p>
          <h2>{heroMessage}</h2>
          <p>저녁피크 16:55–19:59 · 전 권역 데이터 수집 및 관리자 관제 연결 정상</p>
          <div className="hero-actions">
            <button className="primary-button">운영 상세 보기 <ArrowRight size={17} /></button>
            <button className="ghost-button"><Sparkles size={16} /> AI 브리핑</button>
            <button className="region-action-button" onClick={onOpenRegion}>현재 권역 · {currentRegion}</button>
          </div>
        </div>
        <div className="hero-status-card">
          <div className="status-card-head"><span>SYSTEM STATUS</span><b><i /> ONLINE</b></div>
          <div className="score-ring"><div><strong>97</strong><span>운영점수</span></div></div>
          <div className="status-mini-grid"><span><b>9 / 9</b>관리자</span><span><b>4개</b>운영권역</span><span><b>92%</b>리워드</span></div>
        </div>
      </section>

      <section className="panel notice-panel top-notice-panel">
        <div className="panel-head"><div><span className="section-label">NOTICE</span><h3>공지사항</h3></div><BellRing size={20}/></div>
        <div className="notice-list">
          <article className="important"><span>필독</span><div><strong>저녁피크 권역 배정 운영 안내</strong><p>피크타임에는 운영실장 권역 배정 오더에 따라 수행합니다.</p></div><time>오늘</time></article>
          <article><span>운영</span><div><strong>관리자 근무표 사용 기준</strong><p>출근·퇴근 체크 및 수행 건수 기록을 확인해주세요.</p></div><time>7/14</time></article>
          <article><span>미션</span><div><strong>팀미션 전권역 성공 운영</strong><p>모든 권역이 함께 성공할 수 있도록 관제 상황을 수시 확인합니다.</p></div><time>7/13</time></article>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard icon={Flame} label="현재 라이더" value="178명" detail="전 권역 온라인" />
        <StatCard icon={Target} label="팀미션" value="76%" detail="디너 미션 · 1개 권역 완료" accent="blue" />
        <StatCard icon={Users} label="오늘 근무" value="7 / 9명" detail="출근률 78% · 지각 1명" accent="amber" />
        <StatCard icon={WalletCards} label="주간 리워드" value="성공 예상" detail="예상 진행률 92%" accent="green" />
        <StatCard icon={Megaphone} label="새 공지" value="3건" detail="필독 공지 1건 포함" accent="violet" />
      </section>

      <section className="panel set-panel wide-panel priority-panel">
        <div className="panel-head"><div><span className="section-label">SET CONTROL</span><h3>실시간 세트 관제</h3></div><Flame size={20}/></div>
        <div className="mission-meta set-period-meta"><span><Clock3 size={15}/> 현재 구간</span><strong>아침논피크 · 06:00 ~ 10:54</strong></div>
        <div className="control-progress-list">{setRows.map(row => (
          <article className="control-progress-row" key={row.region}>
            <div className="control-progress-main">
              <div className="control-progress-copy">
                <strong>{row.region}</strong>
                <span>운행 {row.riders}/{row.maxRiders}명 · 팀거절율 {row.rejection}</span>
                <small>목표 {row.target}건 · 잔여 {row.remain}건 · 명당 {row.perRider} 처리 시 완료</small>
              </div>
              <div className="control-progress-value">
                <b>{row.progress}%</b>
                <span className={`status-badge ${row.tone}`}>{row.state}</span>
              </div>
            </div>
            <div className="progress-track"><div className={`progress-fill ${row.tone}`} style={{width:`${row.progress}%`}} /></div>
          </article>
        ))}</div>
      </section>

      <section className="panel mission-panel priority-panel">
        <div className="panel-head"><div><span className="section-label">TEAM MISSION</span><h3>권역별 팀미션 진행률</h3></div><button className="text-button">전체 보기 <ArrowRight size={16}/></button></div>
        {hasMission ? (
          <>
            <div className="mission-meta"><span><Clock3 size={15}/> 현재 미션</span><strong>디너 미션 · 18:00 ~ 20:00</strong></div>
            <div className="control-progress-list mission-control-list">{missionRows.map((mission) => <article className="control-progress-row" key={mission.name}>
              <div className="control-progress-main">
                <div className="control-progress-copy">
                  <strong>{mission.name}</strong>
                  <span>운행 {mission.riders}/{mission.maxRiders}명 · 팀거절율 {mission.rejection}</span>
                  <small>목표 {mission.target}건 · 잔여 {mission.remain}건 · 명당 {mission.perRider} 처리 시 완료</small>
                </div>
                <div className="control-progress-value">
                  <b>{mission.progress}%</b>
                  <span className={`status-badge ${mission.tone}`}>{mission.status}</span>
                </div>
              </div>
              <div className="progress-track"><div className={`progress-fill ${mission.tone}`} style={{width:`${mission.progress}%`}} /></div>
            </article>)}</div>
          </>
        ) : (
          <div className="empty-mission"><Target size={28}/><strong>현재 진행 중인 팀미션이 없습니다.</strong><span>다음 미션이 생성되면 이 영역에 자동 표시됩니다.</span></div>
        )}
      </section>

      <section className="panel briefing-panel">
        <div className="panel-head"><div><span className="section-label">AI OPERATIONS BRIEF</span><h3>AI 운영 브리핑</h3></div><Sparkles size={20} /></div>
        <div className="briefing-score"><span>현재 운영 안정도</span><strong>매우 안정적</strong><b>97</b></div>
        <div className="briefing-list">
          <article><div className="briefing-icon success"><CheckCircle2 size={18}/></div><div><strong>강남중앙1 세트 완료</strong><p>현재 흐름이 가장 안정적입니다.</p></div></article>
          <article><div className="briefing-icon warning"><Zap size={18}/></div><div><strong>강남남중앙 지원 권장</strong><p>잔여 2SET 기준 라이더 3명 추가 투입을 권장합니다.</p></div></article>
          <article><div className="briefing-icon info"><Activity size={18}/></div><div><strong>관리자 배정 정상</strong><p>현재 모든 권역에 현장 관리자가 배치되었습니다.</p></div></article>
        </div>
      </section>

      <section className="panel attendance-panel wide-panel">
        <div className="panel-head"><div><span className="section-label">TODAY ATTENDANCE</span><h3>관리자 출근 현황</h3></div><button className="text-button">관리자 근무표 열기 <ArrowRight size={16} /></button></div>
        <div className="attendance-overview"><div><strong>7</strong><span>출근</span></div><div><strong>1</strong><span>지각</span></div><div><strong>1</strong><span>휴무</span></div><div><strong>1</strong><span>미출근</span></div></div>
        <div className="manager-table">
          {managers.map((manager) => <article className="manager-row" key={manager.name}>
            <div className={`manager-avatar ${manager.tone}`}>{manager.name.slice(0,1)}</div>
            <div className="manager-name"><strong>{manager.name}</strong><span>{manager.role}</span></div>
            <div><small>출근</small><strong>{manager.time}</strong></div>
            <div><small>현재 상태</small><strong><i className="online-dot" />{manager.state}</strong></div>
            <div><small>배정 권역</small><strong>{manager.region}</strong></div>
            <div><small>수행</small><strong>{manager.count}건</strong></div>
          </article>)}
        </div>
      </section>

      <section className="panel reward-panel regional-reward-panel">
        <div className="panel-head"><div><span className="section-label">BRANCH WEEKLY REWARD</span><h3>지사 주간 리워드 진행률</h3></div><Trophy size={20}/></div>
        <div className="regional-reward-grid">
          {rewardRows.map((reward) => {
            const totalRate = Math.min(100, Math.round((reward.total / reward.totalTarget) * 100));
            const dinnerRate = Math.min(100, Math.round((reward.dinner / reward.dinnerTarget) * 100));
            return (
              <article className="regional-reward-card" key={reward.region}>
                <div className="regional-reward-head">
                  <div><strong>{reward.region}</strong><span className={`reward-grade ${reward.grade.toLowerCase()}`}>{reward.grade}</span></div>
                  <b>{reward.rate}%</b>
                </div>
                <div className="reward-metric">
                  <div><span>수행률</span><strong>{reward.rate}%</strong></div>
                  <div className="progress-track"><div className={`progress-fill ${reward.tone}`} style={{width:`${reward.rate}%`}} /></div>
                </div>
                <div className="reward-metric">
                  <div><span>총건수 보너스</span><strong>{reward.total.toLocaleString()} / {reward.totalTarget.toLocaleString()}건 · {totalRate}%</strong></div>
                  <div className="progress-track"><div className="progress-fill success" style={{width:`${totalRate}%`}} /></div>
                </div>
                <div className="reward-metric">
                  <div><span>주말 디너 보너스</span><strong>{reward.dinner.toLocaleString()} / {reward.dinnerTarget.toLocaleString()}건 · {dinnerRate}%</strong></div>
                  <div className="progress-track"><div className="progress-fill info" style={{width:`${dinnerRate}%`}} /></div>
                </div>
              </article>
            );
          })}
        </div>
      </section>


    </div>
  );
}

export default AdminHome;
