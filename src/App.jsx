import React, { useMemo, useState } from "react";
import {
  BarChart3,
  Bell,
  Boxes,
  ChevronDown,
  ClipboardList,
  Home,
  Map,
  MapPin,
  Menu,
  Settings,
  ShieldCheck,
  Star,
  Target,
  Trophy,
  UserCog,
  Users,
  Bike,
  X,
} from "lucide-react";
import AdminHome from "./pages/AdminHome";
import AdminAttendance from "./pages/AdminAttendance";
import AdminTeamMission from "./pages/AdminTeamMission";
import AdminSetControl from "./pages/AdminSetControl";
import AdminReward from "./pages/AdminReward";
import AdminLiveControl from "./pages/AdminLiveControl";
import AdminRiders from "./pages/AdminRiders";

const initialLogin = {
  username: "",
  password: "",
  remember: false,
};

const initialSignup = {
  name: "",
  phone: "",
  username: "",
  password: "",
  passwordConfirm: "",
  agree: false,
};

function App() {
  const [theme, setTheme] = useState("dark");
  const [screen, setScreen] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [login, setLogin] = useState(initialLogin);
  const [signup, setSignup] = useState(initialSignup);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentRegion, setCurrentRegion] = useState("강남중앙1");
  const [regionMenuOpen, setRegionMenuOpen] = useState(false);
  const [activePage, setActivePage] = useState("통합관제실");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const normalizedUsername = login.username.trim().toLowerCase();
  const isBoss = ["boss", "jaein", "leejaein"].includes(normalizedUsername);
  const currentUserRole = isBoss ? "BOSS/지사장" : "팀장";

  const screenMeta = useMemo(() => {
    if (screen === "signup") {
      return {
        eyebrow: "MANAGER REGISTRATION",
        title: "관리자 가입 신청",
        description: "가입 신청 후 최고관리자의 승인이 완료되어야 플랫폼을 사용할 수 있습니다.",
      };
    }

    if (screen === "waiting") {
      return {
        eyebrow: "APPROVAL PENDING",
        title: "승인 검토 중입니다",
        description: "신청 정보가 안전하게 접수되었습니다. 승인 완료 후 로그인할 수 있습니다.",
      };
    }

    return {
      eyebrow: "SECURE OPERATIONS ACCESS",
      title: "관리자 로그인",
      description: "승인된 노터치센트럴 관리자만 접속할 수 있습니다.",
    };
  }, [screen]);

  const setMessage = (message) => {
    setToast(message);
    window.clearTimeout(window.__ntToastTimer);
    window.__ntToastTimer = window.setTimeout(() => setToast(""), 2600);
  };

  const handleLogin = (event) => {
    event.preventDefault();

    const nextErrors = {};
    if (login.username.trim().length < 4) nextErrors.loginUsername = "아이디를 4자 이상 입력해주세요.";
    if (login.password.length < 4) nextErrors.loginPassword = "비밀번호를 4자 이상 입력해주세요.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setMessage("테스트 로그인에 성공했습니다.");
    window.setTimeout(() => setLoggedIn(true), 450);
  };

  const handleSignup = (event) => {
    event.preventDefault();

    const nextErrors = {};
    if (signup.name.trim().length < 2) nextErrors.name = "이름을 2자 이상 입력해주세요.";
    if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(signup.phone)) {
      nextErrors.phone = "휴대전화 번호를 확인해주세요.";
    }
    if (!/^[a-zA-Z0-9_-]{4,20}$/.test(signup.username)) nextErrors.username = "아이디는 영문, 숫자, _, - 조합 4~20자로 입력해주세요.";
    if (signup.password.length < 8) nextErrors.password = "비밀번호를 8자 이상 입력해주세요.";
    if (signup.password !== signup.passwordConfirm) {
      nextErrors.passwordConfirm = "비밀번호가 서로 다릅니다.";
    }
    if (!signup.agree) nextErrors.agree = "승인 절차 동의가 필요합니다.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setScreen("waiting");
    setErrors({});
    setMessage("가입 신청이 정상 접수되었습니다.");
  };

  if (loggedIn) {
    const allNavItems = [
      { label: "통합관제실", icon: Home },
      { label: "관리자 근무표", icon: ClipboardList },
      { label: "실시간 관제", icon: Map },
      { label: "기사 현황", icon: Bike },
      { label: "세트 관제", icon: Boxes },
      { label: "팀미션", icon: Target },
      { label: "리워드", icon: Trophy },
      { label: "관리자 리워드", icon: Star },
      { label: "운영 통계", icon: BarChart3 },
      { label: "관리자 관리", icon: UserCog },
      { label: "설정", icon: Settings },
    ];
    const navItems = allNavItems.filter((item) => item.label !== "실시간 관제" || isBoss);

    const pageMeta = {
      "통합관제실": { eyebrow: "OVERVIEW", title: "통합관제실" },
      "관리자 근무표": { eyebrow: "ATTENDANCE CONTROL", title: "관리자 근무표" },
      "실시간 관제": { eyebrow: "LIVE CONTROL", title: "실시간 관제" },
      "기사 현황": { eyebrow: "RIDER CONTROL", title: "기사 현황" },
      "팀미션": { eyebrow: "TEAM MISSION", title: "팀미션" },
      "세트 관제": { eyebrow: "SET CONTROL", title: "세트 관제" },
      "리워드": { eyebrow: "BRANCH REWARD", title: "지사 리워드" },
    };
    const currentPageMeta = pageMeta[activePage] || { eyebrow: "COMING SOON", title: activePage };

    const regions = ["강남중앙1", "강남중앙2", "강남서초중앙", "강남남중앙", "배정대기"];

    return (
      <div className={`app ${theme} dashboard-app`}>
        <aside className="dashboard-sidebar">
          <div className="sidebar-brand">
            <img src={theme === "light" ? "/notouch-admin-logo-light.png" : "/notouch-admin-logo.png"} alt="노터치센트럴" />
            <div><strong>노터치센트럴</strong><span>CONTROL CENTER</span></div>
          </div>

          <nav className="sidebar-nav" aria-label="관리자 메뉴">
            {navItems.map(({ label, icon: Icon }) => {
              const active = activePage === label;
              return (
                <button type="button" className={active ? "active" : ""} key={label} onClick={() => setActivePage(label)}>
                  <Icon size={19} />
                  <span>{label}</span>
                  {active && <i />}
                </button>
              );
            })}
          </nav>

          <div className="sidebar-system">
            <div className="system-orb"><ShieldCheck size={20} /></div>
            <div><strong>시스템 정상</strong><span>모든 서비스 온라인</span></div>
          </div>

          <button type="button" className="sidebar-profile" onClick={() => setLoggedIn(false)}>
            <span className="profile-avatar">이</span>
            <span><strong>이재인</strong><small>{currentUserRole}</small></span>
            <ChevronDown size={16} />
          </button>
        </aside>

        <div className="dashboard-main">
          <header className="dashboard-topbar">
            <div className="dashboard-title">
              
              <div><span>{currentPageMeta.eyebrow}</span><h1>{currentPageMeta.title}</h1></div>
            </div>

            <div className="dashboard-actions">
              <div className="live-clock"><i /><span>LIVE</span><strong>운영 중</strong></div>
              <div className="region-selector-wrap">
                <button type="button" className="top-region-button" onClick={() => setRegionMenuOpen((open) => !open)}>
                  <MapPin size={18} />
                  <span><small>현재 나의 권역</small><strong>{currentRegion}</strong></span>
                  <ChevronDown size={16} />
                </button>
                {regionMenuOpen && (
                  <div className="region-popover">
                    <div className="region-popover-head"><span>현재 나의 권역</span><button onClick={() => setRegionMenuOpen(false)}><X size={16}/></button></div>
                    {regions.map((region) => (
                      <button
                        type="button"
                        className={currentRegion === region ? "selected" : ""}
                        key={region}
                        onClick={() => { setCurrentRegion(region); setRegionMenuOpen(false); }}
                      >
                        <MapPin size={15}/><span>{region}</span>{currentRegion === region && <b>현재</b>}
                      </button>
                    ))}
                    <div className="region-admin-note">지사장·실장 권한에서는 관리자별 권역 배정 기능이 추가됩니다.</div>
                  </div>
                )}
              </div>
              <button type="button" className="icon-button" aria-label="알림"><Bell size={19} /><b>3</b></button>
              <button type="button" className="dashboard-theme-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "LIGHT" : "DARK"}</button>
              <button type="button" className="top-profile"><span>이</span><div><strong>이재인</strong><small>{isBoss ? "BOSS" : "TEAM LEADER"}</small></div></button>
            </div>
          </header>

          <div className="mobile-region-banner" onClick={() => setRegionMenuOpen(true)}>
            <MapPin size={18}/><span><small>현재 나의 권역</small><strong>{currentRegion}</strong></span><ChevronDown size={16}/>
          </div>

          <main className="dashboard-content">
            {activePage === "통합관제실" && <AdminHome currentRegion={currentRegion} onOpenRegion={() => setRegionMenuOpen(true)} />}
            {activePage === "관리자 근무표" && <AdminAttendance currentRegion={currentRegion} />}
            {activePage === "실시간 관제" && <AdminLiveControl />}
            {activePage === "기사 현황" && <AdminRiders />}
            {activePage === "팀미션" && <AdminTeamMission />}
            {activePage === "세트 관제" && <AdminSetControl />}
            {activePage === "리워드" && <AdminReward />}
            {activePage !== "통합관제실" && activePage !== "관리자 근무표" && activePage !== "실시간 관제" && activePage !== "기사 현황" && activePage !== "팀미션" && activePage !== "세트 관제" && activePage !== "리워드" && (
              <section className="coming-soon-panel"><strong>{activePage}</strong><span>페이지 디자인 준비 중입니다.</span></section>
            )}
          </main>

          {mobileMenuOpen && (
            <div className="mobile-menu-layer" role="presentation" onClick={() => setMobileMenuOpen(false)}>
              <section className="mobile-menu-sheet" role="dialog" aria-modal="true" aria-label="모바일 전체 메뉴" onClick={(event) => event.stopPropagation()}>
                <div className="mobile-menu-handle" />
                <div className="mobile-menu-head">
                  <div><span>QUICK MENU</span><strong>메뉴</strong></div>
                  <button type="button" aria-label="메뉴 닫기" onClick={() => setMobileMenuOpen(false)}><X size={20} /></button>
                </div>
                <div className="mobile-menu-grid">
                  {["기사 현황", "관리자 근무표", "관리자 관리", "설정"].map((label) => {
                    const item = navItems.find((navItem) => navItem.label === label);
                    if (!item) return null;
                    const Icon = item.icon;
                    return (
                      <button type="button" key={label} className={activePage === label ? "active" : ""} onClick={() => { setActivePage(label); setMobileMenuOpen(false); }}>
                        <span className="mobile-menu-icon"><Icon size={22} /></span>
                        <span><strong>{label}</strong><small>{label === "기사 현황" ? "접속·완료·거절 현황" : label === "관리자 근무표" ? "출퇴근 및 휴무 관리" : label === "관리자 관리" ? "직책과 권역 관리" : "앱 환경 설정"}</small></span>
                        <ChevronDown size={17} className="mobile-menu-arrow" />
                      </button>
                    );
                  })}
                </div>
                <button type="button" className="mobile-logout-button" onClick={() => { setMobileMenuOpen(false); setLoggedIn(false); }}>
                  로그아웃
                </button>
              </section>
            </div>
          )}

          <nav className="mobile-bottom-nav" aria-label="모바일 메뉴">
            {[
              { label: "통합관제실", short: "홈", icon: Home },
              { label: "세트 관제", short: "세트", icon: Boxes, live: true },
              { label: "팀미션", short: "팀미션", icon: Target, live: true },
              { label: "리워드", short: "리워드", icon: Trophy },
            ].map(({ label, short, icon: Icon, live }) => (
              <button type="button" className={activePage === label ? "active" : ""} key={label} onClick={() => { setActivePage(label); setMobileMenuOpen(false); }}>
                <span className="mobile-nav-icon"><Icon size={20} />{live && <i />}</span>
                <span>{short}</span>
              </button>
            ))}
            <button type="button" className={mobileMenuOpen ? "active" : ""} onClick={() => setMobileMenuOpen((open) => !open)} aria-expanded={mobileMenuOpen}>
              <span className="mobile-nav-icon"><Menu size={20} /></span><span>메뉴</span>
            </button>
          </nav>
        </div>
      </div>
    );
  }

  return (
    <div className={`app ${theme}`}>
      {toast && <div className="toast">{toast}</div>}

      <header className="topbar">
        <div className="brand">
          <img className="brandLogo" src="/notouch-admin-logo.png" alt="노터치센트럴 관리자 대표 로고" />
          <div className="brandText">
            <strong>노터치센트럴</strong>
            <span>기업용 운영 플랫폼</span>
          </div>
        </div>

        <button
          type="button"
          className="themeButton"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="테마 변경"
        >
          {theme === "dark" ? "화이트 테마" : "블랙 테마"}
        </button>
      </header>

      <main className="layout">
        <section className="hero">
          <div className="heroLogoWrap">
            <img className="heroLogo" src="/notouch-admin-logo.png" alt="" />
          </div>

          <div className="badge">승인형 관리자 보안 시스템</div>
          <p className="overline">NOTOUCH CENTRAL</p>

          <h1>
            운영의 모든 순간을
            <br />
            하나의 기준으로.
          </h1>

          <p className="heroText">
            관리자 근태, 실시간 관제, 팀미션, 세트관제, 리워드와
            운영 브리핑을 하나의 플랫폼에서 연결합니다.
          </p>

          <div className="features">
            <article>
              <strong>승인 전 접근 차단</strong>
              <span>승인되지 않은 계정은 운영 데이터에 접근할 수 없습니다.</span>
            </article>

            <article>
              <strong>기기 보안 기록</strong>
              <span>로그인 기기와 주요 접근 기록을 안전하게 관리합니다.</span>
            </article>

            <article>
              <strong>직책별 권한 분리</strong>
              <span>이재인 지사장만 BOSS 권한을 사용하며, 신규 가입자는 팀장으로 등록됩니다.</span>
            </article>
          </div>
        </section>

        <section className="panelWrap">
          <div className="panel">
            <div className="panelHeader">
              <div>
                <p className="overline">{screenMeta.eyebrow}</p>
                <h2>{screenMeta.title}</h2>
                <p className="panelText">{screenMeta.description}</p>
              </div>

              {screen !== "login" && (
                <button
                  type="button"
                  className="backButton"
                  onClick={() => {
                    setScreen("login");
                    setErrors({});
                  }}
                  aria-label="로그인으로 돌아가기"
                >
                  ←
                </button>
              )}
            </div>

            {screen === "login" && (
              <form className="form" onSubmit={handleLogin}>
                <label>
                  <span>아이디</span>
                  <input
                    type="text"
                    value={login.username}
                    onChange={(event) => setLogin({ ...login, username: event.target.value })}
                    placeholder="관리자 아이디를 입력하세요"
                    autoComplete="username"
                  />
                  {errors.loginUsername && <small className="errorText">{errors.loginUsername}</small>}
                </label>

                <label>
                  <span>비밀번호</span>
                  <div className="passwordField">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={login.password}
                      onChange={(event) => setLogin({ ...login, password: event.target.value })}
                      placeholder="비밀번호를 입력하세요"
                      autoComplete="current-password"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? "숨기기" : "보기"}
                    </button>
                  </div>
                  {errors.loginPassword && <small className="errorText">{errors.loginPassword}</small>}
                </label>

                <div className="options">
                  <label className="remember">
                    <input
                      type="checkbox"
                      checked={login.remember}
                      onChange={(event) => setLogin({ ...login, remember: event.target.checked })}
                    />
                    로그인 상태 유지
                  </label>

                  <button type="button" className="linkButton" onClick={() => setMessage("비밀번호 찾기는 서버 연결 단계에서 활성화됩니다.")}>
                    비밀번호 찾기
                  </button>
                </div>

                <button className="primaryButton" type="submit">
                  관리자 로그인 →
                </button>

                <button
                  className="secondaryButton"
                  type="button"
                  onClick={() => {
                    setScreen("signup");
                    setErrors({});
                  }}
                >
                  관리자 가입 신청
                </button>

                <button
                  className="demoButton"
                  type="button"
                  onClick={() => {
                    setLogin({
                      username: "boss",
                      password: "1234",
                      remember: true,
                    });
                    setMessage("테스트 계정이 자동 입력되었습니다.");
                  }}
                >
                  테스트 계정 자동 입력
                </button>
              </form>
            )}

            {screen === "signup" && (
              <form className="form signupForm" onSubmit={handleSignup}>
                <div className="twoColumns">
                  <label>
                    <span>이름</span>
                    <input
                      value={signup.name}
                      onChange={(event) => setSignup({ ...signup, name: event.target.value })}
                      placeholder="실명을 입력하세요"
                    />
                    {errors.name && <small className="errorText">{errors.name}</small>}
                  </label>

                  <label>
                    <span>휴대전화</span>
                    <input
                      value={signup.phone}
                      onChange={(event) => setSignup({ ...signup, phone: event.target.value })}
                      placeholder="010-0000-0000"
                    />
                    {errors.phone && <small className="errorText">{errors.phone}</small>}
                  </label>
                </div>

                <label>
                  <span>아이디</span>
                  <input
                    type="text"
                    value={signup.username}
                    onChange={(event) => setSignup({ ...signup, username: event.target.value })}
                    placeholder="영문·숫자 4~20자"
                    autoComplete="username"
                  />
                  {errors.username && <small className="errorText">{errors.username}</small>}
                </label>

                <div className="twoColumns">
                  <label>
                    <span>비밀번호</span>
                    <div className="passwordField">
                      <input
                        type={showSignupPassword ? "text" : "password"}
                        value={signup.password}
                        onChange={(event) => setSignup({ ...signup, password: event.target.value })}
                        placeholder="8자 이상"
                      />
                      <button type="button" onClick={() => setShowSignupPassword(!showSignupPassword)}>
                        {showSignupPassword ? "숨기기" : "보기"}
                      </button>
                    </div>
                    {errors.password && <small className="errorText">{errors.password}</small>}
                  </label>

                  <label>
                    <span>비밀번호 확인</span>
                    <input
                      type="password"
                      value={signup.passwordConfirm}
                      onChange={(event) => setSignup({ ...signup, passwordConfirm: event.target.value })}
                      placeholder="한 번 더 입력"
                    />
                    {errors.passwordConfirm && <small className="errorText">{errors.passwordConfirm}</small>}
                  </label>
                </div>

                <div className="signup-default-info">
                  <strong>가입 후 기본 설정</strong>
                  <span>직책은 <b>팀장</b>, 권역은 <b>미배정</b>으로 등록됩니다.</span>
                  <small>지사장 또는 실장이 승인 후 직책과 권역을 지정합니다.</small>
                </div>

                <label className="agreement">
                  <input
                    type="checkbox"
                    checked={signup.agree}
                    onChange={(event) => setSignup({ ...signup, agree: event.target.checked })}
                  />
                  <span>개인정보 처리 및 관리자 승인 절차에 동의합니다.</span>
                </label>
                {errors.agree && <small className="errorText">{errors.agree}</small>}

                <button className="primaryButton" type="submit">
                  승인 요청 보내기 →
                </button>
              </form>
            )}

            {screen === "waiting" && (
              <div className="waiting">
                <div className="waitingIcon">✓</div>
                <strong>가입 신청이 접수되었습니다.</strong>
                <p>
                  최고관리자가 신청 정보를 확인한 뒤 승인합니다.
                  승인 전에는 운영 화면과 데이터에 접근할 수 없습니다.
                </p>

                <div className="steps">
                  <div className="done"><b>1</b><span>가입 신청 완료</span></div>
                  <div className="active"><b>2</b><span>관리자 검토 중</span></div>
                  <div><b>3</b><span>승인 완료 대기</span></div>
                </div>

                <button className="secondaryButton" type="button" onClick={() => setScreen("login")}>
                  로그인 화면으로 돌아가기
                </button>
              </div>
            )}

            <footer className="footer">
              <span>Enterprise Security Access</span>
              <span>Build 013</span>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
