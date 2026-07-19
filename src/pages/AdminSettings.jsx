import React, { useState } from "react";
import {
  CalendarDays,
  Check,
  Clock3,
  KeyRound,
  LogOut,
  MapPin,
  Moon,
  Phone,
  Save,
  ShieldCheck,
  Sun,
  User,
} from "lucide-react";

const formatPhone = (value = "") => {
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value;
};

export default function AdminSettings({
  token,
  currentUser,
  theme,
  onThemeChange,
  onUserUpdate,
  onAuthExpired,
  onLogout,
}) {
  const [phone, setPhone] = useState(formatPhone(currentUser?.phone || ""));
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    newPasswordConfirm: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const request = async (url, options = {}) => {
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
    if (!response.ok) throw new Error(result.message || "요청 처리 중 오류가 발생했습니다.");
    return result;
  };

  const saveProfile = async () => {
    setMessage("");
    setError("");
    setProfileSaving(true);
    try {
      const result = await request("/api/settings/profile", {
        method: "PATCH",
        body: JSON.stringify({ phone }),
      });
      onUserUpdate(result.user);
      setPhone(formatPhone(result.user.phone));
      setMessage("휴대전화 번호를 저장했습니다.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (passwords.newPassword.length < 8) {
      setError("새 비밀번호를 8자 이상 입력해주세요.");
      return;
    }
    if (passwords.newPassword !== passwords.newPasswordConfirm) {
      setError("새 비밀번호가 서로 다릅니다.");
      return;
    }

    setPasswordSaving(true);
    try {
      await request("/api/settings/password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: passwords.currentPassword,
          newPassword: passwords.newPassword,
        }),
      });
      setPasswords({ currentPassword: "", newPassword: "", newPasswordConfirm: "" });
      setMessage("비밀번호를 변경했습니다.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <section className="settings-page">
      <div className="settings-hero">
        <div>
          <span>MY ACCOUNT</span>
          <h2>내 정보 및 설정</h2>
          <p>내 계정 정보와 보안 설정을 관리합니다.</p>
        </div>
        <div className="settings-boss-badge">
          <ShieldCheck size={17} />
          {currentUser?.role}
        </div>
      </div>

      {(message || error) && (
        <div className={`settings-message ${error ? "error" : "success"}`}>
          {error || message}
        </div>
      )}

      <div className="settings-layout">
        <article className="settings-profile-card">
          <div className="settings-avatar">
            {(currentUser?.name || "?").slice(0, 1)}
          </div>
          <strong>{currentUser?.name}</strong>
          <span>@{currentUser?.username}</span>
          <b>{currentUser?.role}</b>
          <small>{currentUser?.region}</small>
        </article>

        <div className="settings-content">
          <article className="settings-card">
            <div className="settings-card-title">
              <User size={20} />
              <div><strong>내 계정 정보</strong><span>직책과 권역은 관리자 정책에 따라 고정됩니다.</span></div>
            </div>

            <div className="settings-info-grid">
              <div><span>이름</span><strong>{currentUser?.name}</strong></div>
              <div><span>아이디</span><strong>@{currentUser?.username}</strong></div>
              <div><span>직책</span><strong>{currentUser?.role}</strong></div>
              <div><span>운영 권역</span><strong><MapPin size={15}/>{currentUser?.region}</strong></div>
            </div>

            <div className="settings-phone-row">
              <label>
                <span><Phone size={15}/> 휴대전화</span>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="010-0000-0000"
                />
              </label>
              <button type="button" onClick={saveProfile} disabled={profileSaving}>
                <Save size={17}/>
                {profileSaving ? "저장 중" : "번호 저장"}
              </button>
            </div>
          </article>

          <article className="settings-card">
            <div className="settings-card-title">
              <KeyRound size={20} />
              <div><strong>비밀번호 변경</strong><span>현재 비밀번호 확인 후 새 비밀번호로 변경합니다.</span></div>
            </div>

            <form className="settings-password-form" onSubmit={changePassword}>
              <label>
                <span>현재 비밀번호</span>
                <input
                  type="password"
                  value={passwords.currentPassword}
                  onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })}
                  autoComplete="current-password"
                />
              </label>
              <label>
                <span>새 비밀번호</span>
                <input
                  type="password"
                  value={passwords.newPassword}
                  onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })}
                  autoComplete="new-password"
                  placeholder="8자 이상"
                />
              </label>
              <label>
                <span>새 비밀번호 확인</span>
                <input
                  type="password"
                  value={passwords.newPasswordConfirm}
                  onChange={(event) => setPasswords({ ...passwords, newPasswordConfirm: event.target.value })}
                  autoComplete="new-password"
                />
              </label>
              <button type="submit" disabled={passwordSaving}>
                <Check size={17}/>
                {passwordSaving ? "변경 중" : "비밀번호 변경"}
              </button>
            </form>
          </article>

          <article className="settings-card">
            <div className="settings-card-title">
              {theme === "dark" ? <Moon size={20}/> : <Sun size={20}/>}
              <div><strong>화면 테마</strong><span>선택한 테마는 이 기기에 저장됩니다.</span></div>
            </div>
            <div className="settings-theme-options">
              <button
                type="button"
                className={theme === "dark" ? "active" : ""}
                onClick={() => onThemeChange("dark")}
              >
                <Moon size={19}/> 블랙 테마
              </button>
              <button
                type="button"
                className={theme === "light" ? "active" : ""}
                onClick={() => onThemeChange("light")}
              >
                <Sun size={19}/> 화이트 테마
              </button>
            </div>
          </article>

          <article className="settings-card settings-security-card">
            <div>
              <ShieldCheck size={21}/>
              <div><strong>계정 보안</strong><span>로그아웃하면 현재 기기의 로그인 세션이 종료됩니다.</span></div>
            </div>
            <button type="button" onClick={onLogout}>
              <LogOut size={17}/> 로그아웃
            </button>
          </article>
        </div>
      </div>
    </section>
  );
}
