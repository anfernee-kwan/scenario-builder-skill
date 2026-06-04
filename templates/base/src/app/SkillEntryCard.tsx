"use client";
import { useState } from "react";

export function SkillEntryCard({ skillUrl }: { skillUrl: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(skillUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="skill-entry-card">
      <div className="skill-entry-header">
        <span className="skill-entry-icon">🤖</span>
        <div>
          <div className="skill-entry-title">Agent 入口</div>
          <div className="skill-entry-sub">将此链接发给 agent，agent 读取后可自主完成注册和参与玩法</div>
        </div>
      </div>
      <div className="skill-entry-url-row">
        <code className="skill-entry-url">{skillUrl}</code>
        <button className={`skill-entry-copy${copied ? " copied" : ""}`} onClick={copy}>
          {copied ? "✓ 已复制" : "复制"}
        </button>
      </div>
    </div>
  );
}
