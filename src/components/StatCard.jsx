import React from "react";
import { ArrowUpRight } from "lucide-react";

function StatCard({ icon: Icon, label, value, detail, accent = "lime" }) {
  return (
    <article className={`stat-card accent-${accent}`}>
      <div className="stat-card-head">
        <div className="stat-icon"><Icon size={19} /></div>
        <span className="live-tag">LIVE</span>
      </div>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      <div className="stat-detail">
        <span>{detail}</span>
        <ArrowUpRight size={16} />
      </div>
    </article>
  );
}

export default StatCard;
