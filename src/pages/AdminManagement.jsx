import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  KeyRound,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserRoundX,
  Users,
} from "lucide-react";

const ROLE_OPTIONS = [
  "총괄본부장",
  "운영실장",
  "운영팀장",
  "강남총괄팀장",
  "강남중앙1 팀장",
  "강남중앙2 팀장",
  "강남서초중앙 팀장",
  "강남남중앙 팀장",
  "강남서부 팀장",
  "팀장",
];

const REGION_OPTIONS = [
  "전권역 운영",
  "강남중앙1",
  "강남중앙2",
  "강남서초중앙",
  "강남남중앙",
  "강남서부",
  "권역없음(현장팀장)",
];

const ROLE_REGION_MAP = {
  총괄본부장: "전권역 운영",
  운영실장: "전권역 운영",
  운영팀장: "권역없음(현장팀장)",
  강남총괄팀장: "권역없음(현장팀장)",
  "강남중앙1 팀장": "강남중앙1",
  "강남중앙2 팀장": "강남중앙2",
  "강남서초중앙 팀장": "강남서초중앙",
  "강남남중앙 팀장": "강남남중앙",
  "강남서부 팀장": "강남서부",
  팀장: "권역없음(현장팀장)",
};

const formatPhone = (phone = "") => {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return phone || "-";
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(`${String(value).replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ko-KR");
};

export default function AdminManagement({ token, currentUser, onAuthExpired }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [workingId, setWorkingId] = useState(null);
  const [selections, setSelections] = useState({});
  const [tab, setTab] = useState("pending");

  const loadUsers = async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/users", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (response.status === 401) {
        onAuthExpired?.();
        throw new Error("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
      }
      if (!response.ok) throw new Error(result.message || "관리자 목록을 불러오지 못했습니다.");

      const list = result.users || [];
      setUsers(list);
      setSelections((current) => {
        const next = { ...current };
        for (const user of list) {
          const role = user.role || "팀장";
          next[user.id] = {
            name: user.name || "",
            phone: formatPhone(user.phone),
            role,
            region:
              !user.region || user.region === "미배정"
                ? ROLE_REGION_MAP[role]
                : user.region,
            scheduled_start_time:
              user.role === "BOSS/지사장"
                ? ""
                : (user.scheduled_start_time || "10:00"),
          };
        }
        return next;
      });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadUsers();
  }, [token]);

  const pendingUsers = useMemo(
    () => users.filter((user) => Number(user.is_active) === 0),
    [users],
  );
  const activeUsers = useMemo(
    () => users.filter((user) => Number(user.is_active) === 1),
    [users],
  );
  const suspendedUsers = useMemo(
    () => users.filter((user) => Number(user.is_active) === 2),
    [users],
  );

  const displayedUsers =
    tab === "pending"
      ? pendingUsers
      : tab === "active"
        ? activeUsers
        : suspendedUsers;

  const updateSelection = (id, field, value) => {
    setSelections((current) => {
      const next = {
        ...current,
        [id]: { ...(current[id] || {}), [field]: value },
      };
      if (field === "role" && ROLE_REGION_MAP[value]) {
        next[id].region = ROLE_REGION_MAP[value];
      }
      return next;
    });
  };

  const request = async (url, options, successMessage) => {
    setMessage("");
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options?.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) {
      onAuthExpired?.();
      throw new Error("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
    }
    if (!response.ok) throw new Error(result.message || "처리 중 오류가 발생했습니다.");
    setMessage(successMessage || result.message);
    await loadUsers();
    return result;
  };

  const approveOrSave = async (user) => {
    const data = selections[user.id];
    if (!data?.name?.trim()) {
      setMessage("이름을 입력해주세요.");
      return;
    }

    if (Number(user.is_active) === 0) {
      const confirmed = window.confirm(
        `${data.name}님을 ${data.role} / ${data.region} / 기준 출근 ${data.scheduled_start_time}으로 승인할까요?`,
      );
      if (!confirmed) return;
    }

    setWorkingId(user.id);
    try {
      await request(
        `/api/admin/users/${user.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
        Number(user.is_active) === 0
          ? `${data.name}님의 가입을 승인했습니다.`
          : `${data.name}님의 정보를 저장했습니다.`,
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setWorkingId(null);
    }
  };

  const rejectUser = async (user) => {
    if (!window.confirm(`${user.username} 계정의 가입 신청을 거절하고 삭제할까요?`)) return;
    setWorkingId(user.id);
    try {
      await request(
        `/api/admin/users/${user.id}`,
        { method: "DELETE" },
        "가입 신청을 거절했습니다.",
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setWorkingId(null);
    }
  };

  const changeStatus = async (user, action) => {
    const verb = action === "suspend" ? "정지" : "재활성화";
    if (!window.confirm(`${user.name || user.username} 계정을 ${verb}할까요?`)) return;
    setWorkingId(user.id);
    try {
      await request(
        `/api/admin/users/${user.id}/${action}`,
        { method: "PATCH" },
        `계정을 ${verb}했습니다.`,
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setWorkingId(null);
    }
  };

  const resetPassword = async (user) => {
    if (!window.confirm(`${user.name || user.username}님의 비밀번호를 임시 비밀번호로 초기화할까요?`)) return;
    setWorkingId(user.id);
    try {
      const result = await request(
        `/api/admin/users/${user.id}/reset-password`,
        { method: "POST" },
        "비밀번호를 초기화했습니다.",
      );
      window.prompt(
        "아래 임시 비밀번호를 관리자에게 전달하세요. 이 창을 닫으면 다시 확인할 수 없습니다.",
        result.temporaryPassword,
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <section className="admin-management-page">
      <div className="admin-management-hero">
        <div>
          <span>ACCOUNT CONTROL</span>
          <h2>관리자 계정 관리</h2>
          <p>가입 승인, 계정 정보, 직책과 운영 권역을 관리합니다.</p>
        </div>
        <button type="button" onClick={loadUsers} disabled={loading}>
          <RefreshCw size={17} className={loading ? "spin" : ""} /> 새로고침
        </button>
      </div>

      <div className="admin-summary-grid">
        <article><UserCheck size={20}/><div><strong>{pendingUsers.length}</strong><span>승인 대기</span></div></article>
        <article><Users size={20}/><div><strong>{activeUsers.length}</strong><span>승인 완료</span></div></article>
        <article><UserRoundX size={20}/><div><strong>{suspendedUsers.length}</strong><span>계정 정지</span></div></article>
        <article><ShieldCheck size={20}/><div><strong>{users.length}</strong><span>전체 계정</span></div></article>
      </div>

      <div className="admin-account-tabs">
        <button className={tab === "pending" ? "active" : ""} onClick={() => setTab("pending")}>가입 대기 <b>{pendingUsers.length}</b></button>
        <button className={tab === "active" ? "active" : ""} onClick={() => setTab("active")}>승인 완료 <b>{activeUsers.length}</b></button>
        <button className={tab === "suspended" ? "active" : ""} onClick={() => setTab("suspended")}>계정 정지 <b>{suspendedUsers.length}</b></button>
      </div>

      {message && <div className="admin-management-message">{message}</div>}

      <div className="admin-user-list">
        {loading ? (
          <div className="admin-empty-state">관리자 목록을 불러오는 중입니다.</div>
        ) : displayedUsers.length === 0 ? (
          <div className="admin-empty-state">표시할 계정이 없습니다.</div>
        ) : displayedUsers.map((user) => {
          const selected = selections[user.id] || {};
          const status = Number(user.is_active);
          const isBossAccount = user.role === "BOSS/지사장";

          return (
            <article className="admin-user-card" key={user.id}>
              <div className="admin-user-identity">
                <div className="admin-user-avatar">{(selected.name || user.username || "?").slice(0, 1)}</div>
                <div><strong>{selected.name || "이름 미입력"}</strong><span>@{user.username}</span></div>
                <em className={isBossAccount ? "approved boss" : status === 0 ? "pending" : status === 1 ? "approved" : "suspended"}>
                  {isBossAccount ? "BOSS 잠금" : status === 0 ? "승인 대기" : status === 1 ? "승인 완료" : "계정 정지"}
                </em>
              </div>

              <div className="admin-user-info-grid admin-edit-grid">
                <label>
                  <span>이름</span>
                  <input disabled={isBossAccount} value={selected.name || ""} onChange={(e) => updateSelection(user.id, "name", e.target.value)} />
                </label>
                <label>
                  <span>휴대전화</span>
                  <input disabled={isBossAccount} value={selected.phone || ""} onChange={(e) => updateSelection(user.id, "phone", e.target.value)} />
                </label>
                <div><span>가입 일시</span><strong>{formatDate(user.created_at)}</strong></div>
                <div><span>마지막 로그인</span><strong>{formatDate(user.last_login)}</strong></div>
              </div>

              <div className="admin-assignment-grid">
                <label>
                  <span>직책</span>
                  {isBossAccount ? (
                    <div className="boss-locked-field">BOSS/지사장</div>
                  ) : (
                    <select value={selected.role || "팀장"} onChange={(e) => updateSelection(user.id, "role", e.target.value)}>
                      {ROLE_OPTIONS.map((role) => <option key={role}>{role}</option>)}
                    </select>
                  )}
                </label>
                <label>
                  <span>운영 권역</span>
                  {isBossAccount ? (
                    <div className="boss-locked-field">전권역 운영</div>
                  ) : (
                    <select value={selected.region || "권역없음(현장팀장)"} onChange={(e) => updateSelection(user.id, "region", e.target.value)}>
                      {REGION_OPTIONS.map((region) => <option key={region}>{region}</option>)}
                    </select>
                  )}
                </label>
                <label>
                  <span>기준 출근시간</span>
                  {isBossAccount ? (
                    <div className="boss-locked-field">지각 제외</div>
                  ) : (
                    <input
                      className="admin-time-input"
                      type="time"
                      step="60"
                      value={selected.scheduled_start_time || "10:00"}
                      onChange={(event) =>
                        updateSelection(user.id, "scheduled_start_time", event.target.value)
                      }
                    />
                  )}
                </label>
              </div>

              <div className="admin-user-actions">
                {isBossAccount ? (
                  <div className="boss-account-lock"><ShieldCheck size={17}/> BOSS 계정은 변경·정지·삭제할 수 없습니다.</div>
                ) : <>
                <button className={status === 0 ? "approve" : "save"} disabled={workingId === user.id} onClick={() => approveOrSave(user)}>
                  {status === 0 ? <Check size={17}/> : <Save size={17}/>}
                  {workingId === user.id ? "처리 중" : status === 0 ? "승인" : "정보 저장"}
                </button>

                {status === 0 && (
                  <button className="reject" disabled={workingId === user.id} onClick={() => rejectUser(user)}>
                    <Trash2 size={16}/>거절
                  </button>
                )}

                {status === 1 && (
                  <>
                    <button className="reset-password" disabled={workingId === user.id} onClick={() => resetPassword(user)}>
                      <KeyRound size={16}/>비밀번호 초기화
                    </button>
                    <button className="suspend" disabled={workingId === user.id} onClick={() => changeStatus(user, "suspend")}>
                      <UserRoundX size={16}/>계정 정지
                    </button>
                  </>
                )}

                {status === 2 && (
                  <button className="reactivate" disabled={workingId === user.id} onClick={() => changeStatus(user, "reactivate")}>
                    <ShieldCheck size={16}/>계정 재활성화
                  </button>
                )}
                </>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
