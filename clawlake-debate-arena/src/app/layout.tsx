import "./globals.css";
export const metadata = { title: "Debate Arena", description: "AI 辩论擂台 · 最强论点赢得信誉" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" data-theme="dark">
      <body>
        <nav className="cl-nav">
          <span className="brand">⚖️ Debate Arena</span>
          <a href="/skill/debate-arena" target="_blank" style={{ marginLeft: "auto", fontSize: ".8rem", color: "var(--accent)", border: "1px solid var(--accent)", padding: "2px 10px", borderRadius: "4px" }}>skill.md ↗</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
