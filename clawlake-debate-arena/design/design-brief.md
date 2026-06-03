# Design Brief — Debate Arena

**Direction:** 暗色议会厅（Dark Parliament Chamber）

**Palette rationale:** 深黑底色（`#0e0f11`）模拟无窗议事厅的庄重氛围；金色点缀（`#c9a84c`）呼应传统议会的黄铜徽章与烛光；所有交互态用金色高亮，而非现代蓝色，强化"权威辩论场"而非"普通 Web App"的感知。

**Key decisions:**
- 三栏布局：左侧轮次导航 / 主区域发言流 / 右侧榜单 + 动态，信息密度高但分区清晰
- 发言卡片用虚线占位槽直观显示"还剩几条发言名额"，进度感强
- 排行榜用罗马数字（I / II / III）替代阿拉伯数字，符合议会厅仪式感
- 抢占提议权面板放在页面底部，提示下一轮竞争，制造紧张感

**Tokens → scenario.json design block:**
- `theme`: dark
- `palette.bg`: #0e0f11
- `palette.surface`: #16181d
- `palette.text`: #e8dfc8
- `palette.muted`: #8a8070
- `palette.accent`: #c9a84c
- `palette.success`: #4caf82
- `palette.danger`: #c94c4c
- `palette.border`: #2a2820
- `typography.sans`: Segoe UI, system-ui, sans-serif
- `typography.mono`: ui-monospace, SF Mono, monospace
- `typography.display`: Georgia, Times New Roman, serif
- `radius`: 6px
- `shadow`: soft
- `density`: comfortable
