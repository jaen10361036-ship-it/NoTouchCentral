import React from "react";
import { LocateFixed, MapPin, RefreshCw, ShieldAlert } from "lucide-react";

const POSITION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 15000,
};

export default function LocationAccessGate({ token, children, onAuthExpired }) {
  const [state, setState] = React.useState("checking");
  const [message, setMessage] = React.useState("현재 위치와 권한을 확인하고 있습니다.");
  const heartbeatRef = React.useRef(null);
  const permissionRef = React.useRef(null);

  const sendLocation = React.useCallback(async (position) => {
    const response = await fetch("/api/location/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
      }),
    });

    if (response.status === 401) {
      onAuthExpired();
      throw new Error("로그인이 만료되었습니다.");
    }
    if (!response.ok) throw new Error("위치 정보를 서버에 등록하지 못했습니다.");
  }, [token, onAuthExpired]);

  const verifyLocation = React.useCallback(() => {
    if (!navigator.geolocation) {
      setState("unsupported");
      setMessage("이 브라우저에서는 위치 기능을 사용할 수 없습니다.");
      return;
    }

    setState("checking");
    setMessage("위치 권한을 요청하고 현재 위치를 확인하고 있습니다.");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await sendLocation(position);
          setState("granted");
          setMessage("위치 확인이 완료되었습니다.");
        } catch (error) {
          setState("error");
          setMessage(error.message || "위치 확인 중 오류가 발생했습니다.");
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setState("denied");
          setMessage("위치 권한이 차단되어 노터치센트럴을 이용할 수 없습니다.");
        } else if (error.code === error.TIMEOUT) {
          setState("error");
          setMessage("10초 안에 현재 위치를 확인하지 못했습니다. GPS를 켜고 다시 시도해 주세요.");
        } else {
          setState("error");
          setMessage("현재 위치를 가져올 수 없습니다. 기기의 위치 서비스를 확인해 주세요.");
        }
      },
      POSITION_OPTIONS,
    );
  }, [sendLocation]);

  React.useEffect(() => {
    verifyLocation();

    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: "geolocation" }).then((permission) => {
        permissionRef.current = permission;
        permission.onchange = () => {
          if (permission.state === "denied") {
            setState("denied");
            setMessage("위치 권한이 해제되어 서비스 이용이 즉시 중단되었습니다.");
          } else {
            verifyLocation();
          }
        };
      }).catch(() => {});
    }

    return () => {
      if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
      if (permissionRef.current) permissionRef.current.onchange = null;
    };
  }, [verifyLocation]);

  React.useEffect(() => {
    if (state !== "granted") {
      if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
      return;
    }

    heartbeatRef.current = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => sendLocation(position).catch(() => setState("error")),
        () => {
          setState("error");
          setMessage("위치 연결이 끊어져 서비스 이용이 중단되었습니다.");
        },
        POSITION_OPTIONS,
      );
    }, 45000);

    return () => {
      if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    };
  }, [state, sendLocation]);

  if (state === "granted") return children;

  return (
    <div className="location-gate-shell">
      <section className="location-gate-card" role="alert" aria-live="assertive">
        <div className={`location-gate-icon ${state}`}>
          {state === "checking" ? <LocateFixed size={34} /> : <ShieldAlert size={34} />}
        </div>
        <span className="location-gate-eyebrow">LOCATION SECURITY</span>
        <h1>위치 권한이 반드시 필요합니다</h1>
        <p>{message}</p>

        <div className="location-gate-rule">
          <MapPin size={18} />
          <div>
            <strong>권한 허용 전에는 사이트에 들어갈 수 없습니다.</strong>
            <span>홈·메뉴·운영 API가 모두 차단되며, 사용 중 권한을 해제해도 즉시 차단됩니다.</span>
          </div>
        </div>

        <button type="button" onClick={verifyLocation} disabled={state === "checking"}>
          <RefreshCw size={18} className={state === "checking" ? "spin" : ""} />
          {state === "checking" ? "위치 확인 중" : "위치 권한 다시 확인"}
        </button>
        <small>권한을 차단한 경우 브라우저 주소창의 자물쇠 아이콘에서 위치를 ‘허용’으로 변경해 주세요.</small>
      </section>
    </div>
  );
}
