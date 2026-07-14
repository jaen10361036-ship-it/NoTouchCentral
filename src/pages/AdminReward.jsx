import React, { useMemo } from "react";
import {
  Activity,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Crown,
  Database,
  Gauge,
  Info,
  MoonStar,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Trophy,
} from "lucide-react";

const rewardRegions = [
  {
    order: "01",
    name: "강남중앙1",
    grade: "GOLD",
    progress: 92,
    official: 1384,
    expected: 1518,
    totalTarget: 1650,
    dinner: 4,
    dinnerTarget: 5,
    status: "진행 중",
    tone: "gold",
  },
  {
    order: "02",
    name: "강남중앙2",
    grade: "BLACK",
    progress: 104,
    official: 1612,
    expected: 1734,
    totalTarget: 1670,
    dinner: 5,
    dinnerTarget: 5,
    status: "성공 확정",
    tone: "black",
  },
  {
    order: "03",
    name: "강남서초중앙",
    grade: "GOLD",
    progress: 88,
    official: 1491,
    expected: 1586,
    totalTarget: 1800,
    dinner: 4,
    dinnerTarget: 5,
    status: "진행 중",
    tone: "gold",
  },
  {
    order: "04",
    name: "남중앙",
    grade: "BLACK",
    progress: 101,
    official: 1410,
    expected: 1588,
    totalTarget: 1570,
    dinner: 5,
    dinnerTarget: 5,
    status: "성공 확정",
    tone: "black",
  },
];

function GradeMark({ grade, tone }) {
  return (
    <div className={`reward-grade-mark ${tone}`} aria-label={`${grade} 등급`}>
      <span className="reward-grade-emblem"><Crown size={17} /></span>
      <span className="reward-grade-copy"><small>NOTOUCH</small><strong>{grade}</strong></span>
    </div>
  );
}

function ProgressTrack({ value, targetLabel, className = "" }) {
  const safeValue = Math.min(100, Math.max(0, value));
  return (
    <div className={`reward-progress-wrap ${className}`}>
      <div className="reward-progress-meta"><span>{targetLabel}</span><strong>{value}%</strong></div>
      <div className="reward-progress-track"><i style={{ width: `${safeValue}%` }} /></div>
    </div>
  );
}

function AdminReward() {
  const summary = useMemo(() => {
    const success = rewardRegions.filter((region) => region.progress >= 100).length;
    const expected = rewardRegions.reduce((sum, region) => sum + region.expected, 0);
    const target = rewardRegions.reduce((sum, region) => sum + region.totalTarget, 0);
    return {
      success,
      expected,
      target,
      progress: Math.round((expected / target) * 100),
    };
  }, []);

  return (
    <div className="branch-reward-page">
      <section className="branch-reward-hero">
        <div className="branch-reward-hero-copy">
          <span className="section-label">BRANCH REWARD</span>
          <h2><Trophy size={27} /> 지사 리워드</h2>
          <p>공식 집계와 실시간 예상 누적을 한 화면에서 비교하고, 권역별 성공 가능성을 빠르게 판단합니다.</p>
        </div>

        <div className="branch-reward-hero-summary">
          <div className="branch-reward-hero-ring" style={{ "--reward-ring": `${Math.min(summary.progress, 100) * 3.6}deg` }}>
            <div><strong>{summary.progress}%</strong><span>전체 수행률</span></div>
          </div>
          <div className="branch-reward-hero-metrics">
            <div><span>성공 확정</span><strong>{summary.success}<small> / 4권역</small></strong></div>
            <div><span>예상 누적</span><strong>{summary.expected.toLocaleString()}<small>건</small></strong></div>
          </div>
        </div>
      </section>

      <section className="branch-reward-toolbar">
        <div className="branch-reward-live"><i /><span>실시간 예상 집계</span></div>
        <div><CalendarDays size={16} /><span>2026.07.08 06:00 ~ 07.15 05:59</span></div>
        <div><RefreshCw size={15} /><span>공식 수치 매일 10:00 업데이트</span></div>
      </section>

      <section className="branch-reward-overview">
        <article>
          <span className="branch-reward-overview-icon"><TrendingUp size={18} /></span>
          <div><small>전체 예상 수행률</small><strong>{summary.progress}%</strong></div>
        </article>
        <article>
          <span className="branch-reward-overview-icon"><Database size={18} /></span>
          <div><small>공식 누적 합계</small><strong>{rewardRegions.reduce((sum, item) => sum + item.official, 0).toLocaleString()}건</strong></div>
        </article>
        <article>
          <span className="branch-reward-overview-icon"><Activity size={18} /></span>
          <div><small>실시간 예상 합계</small><strong>{summary.expected.toLocaleString()}건</strong></div>
        </article>
        <article>
          <span className="branch-reward-overview-icon"><BadgeCheck size={18} /></span>
          <div><small>현재 성공 권역</small><strong>{summary.success}개 권역</strong></div>
        </article>
      </section>

      <section className="branch-reward-grid">
        {rewardRegions.map((region) => {
          const totalProgress = Math.round((region.expected / region.totalTarget) * 100);
          const dinnerProgress = Math.round((region.dinner / region.dinnerTarget) * 100);
          const completed = region.progress >= 100;

          return (
            <article className={`branch-reward-card ${region.tone} ${completed ? "complete" : "active"}`} key={region.name}>
              <div className="branch-reward-card-glow" />
              <header className="branch-reward-card-head">
                <div className="branch-reward-region">
                  <span>{region.order}</span>
                  <div><small>GANGNAM REGION</small><h3>{region.name}</h3></div>
                </div>
                <span className={`branch-reward-status ${completed ? "success" : "progress"}`}>
                  {completed ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
                  {region.status}
                </span>
              </header>

              <div className="branch-reward-main-row">
                <GradeMark grade={region.grade} tone={region.tone} />
                <div className="branch-reward-rate">
                  <span>현재 수행률</span>
                  <strong>{region.progress}<small>%</small></strong>
                  <em>{completed ? "목표 달성" : `목표까지 ${Math.max(0, 100 - region.progress)}%`}</em>
                </div>
              </div>

              <div className="branch-reward-counts">
                <div>
                  <span><Database size={14} /> 공식 10시 업데이트</span>
                  <strong>{region.official.toLocaleString()}<small>건</small></strong>
                </div>
                <div>
                  <span><Activity size={14} /> 실시간 예상 누적</span>
                  <strong>{region.expected.toLocaleString()}<small>건</small></strong>
                </div>
              </div>

              <div className="branch-reward-progress-stack">
                <ProgressTrack value={totalProgress} targetLabel={`총건수 ${region.expected.toLocaleString()} / ${region.totalTarget.toLocaleString()}건`} className="total" />
                <ProgressTrack value={dinnerProgress} targetLabel={`주말 디너 보너스 ${region.dinner} / ${region.dinnerTarget}회`} className="dinner" />
              </div>

              <footer className="branch-reward-card-foot">
                <span><Gauge size={14} /> 예상 기준</span>
                <strong>{completed ? "성공 조건 충족" : `${Math.max(0, region.totalTarget - region.expected).toLocaleString()}건 남음`}</strong>
              </footer>
            </article>
          );
        })}
      </section>

      <section className="branch-reward-guide">
        <div className="branch-reward-guide-icon"><Info size={23} /></div>
        <div>
          <strong>벤더 집계 기준 안내</strong>
          <p>공식 누적은 매일 오전 10시에 갱신되는 벤더 수치입니다. 실시간 예상 누적은 기사현황 수행량을 합산한 참고 수치이며, 단건은 1.0건·멀티는 0.8건으로 계산됩니다.</p>
        </div>
        <span className="branch-reward-guide-badge"><MoonStar size={14} /> 최종 확정은 공식 수치 기준</span>
      </section>

      <section className="branch-reward-bottom-note">
        <Sparkles size={17} />
        <span>권역별 리워드는 공식 집계가 목표 이상이면 <strong>성공 확정</strong>, 미만이면 <strong>진행 중</strong>으로 표시됩니다.</span>
      </section>
    </div>
  );
}

export default AdminReward;
