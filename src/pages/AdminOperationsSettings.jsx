import React from "react";
import { Boxes, Clock3, Radio, Save, Settings2, ShieldCheck, TimerReset } from "lucide-react";

const DEFAULTS = {
  setCount: {
    "강남중앙1": 6,
    "강남중앙2": 6,
    "강남서초중앙": 8,
    "강남남중앙": 6,
  },
  readerInterval: 30,
  missionKeepMinutes: 60,
};

export default function AdminOperationsSettings({ token, onAuthExpired }) {
  const [settings, setSettings] = React.useState(DEFAULTS);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  const request = React.useCallback(async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) {
      onAuthExpired();
      throw new Error("로그인이 만료되었습니다.");
    }
    if (!response.ok) throw new Error(result.message || "설정을 불러오지 못했습니다.");
    return result;
  }, [token, onAuthExpired]);

  React.useEffect(() => {
    request("/api/settings/operations", { cache: "no-store" })
      .then((result) => setSettings(result.settings || DEFAULTS))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [request]);

  const updateSetCount = (region, value) => {
    const count = Math.max(1, Math.min(20, Number(value) || 1));
    setSettings((current) => ({
      ...current,
      setCount: { ...current.setCount, [region]: count },
    }));
  };

  const save = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const result = await request("/api/settings/operations", {
        method: "PATCH",
        body: JSON.stringify(settings),
      });
      setSettings(result.settings);
      setMessage("운영 설정을 D1에 저장했습니다. 다음 수집 주기부터 적용됩니다.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <section className="ops-settings-loading">운영 설정을 불러오는 중입니다.</section>;

  return (
    <section className="ops-settings-page">
      <header className="ops-settings-hero">
        <div>
          <span><ShieldCheck size={15} /> BOSS ONLY</span>
          <h2>운영 설정</h2>
          <p>권역별 SET와 Reader·팀미션 운영 기준을 관리합니다.</p>
        </div>
        <div className="ops-settings-status"><Radio size={17} /><span>D1 SETTINGS</span><strong>연결됨</strong></div>
      </header>

      {(message || error) && <div className={`ops-settings-message ${error ? "error" : "success"}`}>{error || message}</div>}

      <div className="ops-settings-grid">
        <article className="ops-settings-card ops-settings-sets">
          <div className="ops-settings-title">
            <Boxes size={21} />
            <div><strong>권역별 SET 관리</strong><span>NoTouchCC 목표값과 무관한 고정 운영값입니다.</span></div>
          </div>
          <div className="ops-region-list">
            {Object.entries(settings.setCount).map(([region, value]) => (
              <label key={region}>
                <span>{region}</span>
                <div><input type="number" min="1" max="20" value={value} onChange={(event) => updateSetCount(region, event.target.value)} /><b>SET</b></div>
              </label>
            ))}
          </div>
        </article>

        <article className="ops-settings-card">
          <div className="ops-settings-title">
            <Clock3 size={21} />
            <div><strong>Reader 수집 주기</strong><span>전체 권역 데이터를 다시 읽는 간격입니다.</span></div>
          </div>
          <label className="ops-number-control">
            <input type="number" min="10" max="300" value={settings.readerInterval} onChange={(event) => setSettings({ ...settings, readerInterval: Math.max(10, Math.min(300, Number(event.target.value) || 10)) })} />
            <span>초</span>
          </label>
          <small>권장값 30초 · 허용범위 10~300초</small>
        </article>

        <article className="ops-settings-card">
          <div className="ops-settings-title">
            <TimerReset size={21} />
            <div><strong>팀미션 유지시간</strong><span>미션이 화면에서 사라진 뒤 캐시에 남겨둘 시간입니다.</span></div>
          </div>
          <label className="ops-number-control">
            <input type="number" min="0" max="180" value={settings.missionKeepMinutes} onChange={(event) => setSettings({ ...settings, missionKeepMinutes: Math.max(0, Math.min(180, Number(event.target.value) || 0)) })} />
            <span>분</span>
          </label>
          <small>현재 운영 기준 60분 · 허용범위 0~180분</small>
        </article>

        <article className="ops-settings-card ops-settings-future">
          <div className="ops-settings-title">
            <Settings2 size={21} />
            <div><strong>운영 스위치</strong><span>향후 알림·지도·공지 설정이 이 영역에 추가됩니다.</span></div>
          </div>
          <div className="ops-future-row"><i /><span>추가 운영 옵션 준비됨</span></div>
        </article>
      </div>

      <div className="ops-settings-savebar">
        <div><strong>변경사항 저장</strong><span>저장 즉시 D1 기준값이 갱신됩니다.</span></div>
        <button type="button" onClick={save} disabled={saving}><Save size={18} />{saving ? "저장 중" : "운영 설정 저장"}</button>
      </div>
    </section>
  );
}
