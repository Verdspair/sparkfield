export const LEARNING_UI_STYLE_ID = 'pkg-learning-ui-styles';

export const LEARNING_UI_CSS = `
@keyframes lui-step-enter {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes lui-panel-reveal {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.lui-paper-shell {
  --lui-shell-bg: var(--sf-surface-elevated, linear-gradient(180deg, rgba(22, 34, 58, 0.92) 0%, rgba(15, 24, 41, 0.95) 100%));
  --lui-header-bg: rgba(16, 25, 42, 0.88);
  --lui-footer-bg: rgba(16, 25, 42, 0.88);
  --lui-body-bg: rgba(13, 21, 37, 0.84);
  --lui-card-bg: var(--sf-surface-card, linear-gradient(180deg, rgba(24, 37, 62, 0.88) 0%, rgba(17, 27, 46, 0.92) 100%));
  --lui-card-elevated: var(--sf-surface-cell-active, rgba(31, 47, 76, 0.90));
  --lui-scaffold-bg: var(--sf-surface-card, linear-gradient(180deg, rgba(24, 37, 62, 0.88) 0%, rgba(17, 27, 46, 0.92) 100%));
  --lui-scaffold-head-bg: var(--sf-surface-cell-active, rgba(31, 47, 76, 0.90));
  --lui-card-muted: var(--sf-surface-cell, rgba(16, 25, 42, 0.82));
  --lui-card-border: var(--hairline, rgba(216, 194, 148, 0.18));
  --lui-card-gold-border: var(--hairline-accent, rgba(216, 194, 148, 0.30));
  --lui-ink-primary: var(--text-primary, #f2f5fa);
  --lui-ink-secondary: var(--text-secondary, #c2cde0);
  --lui-ink-muted: var(--text-muted, #93a3bd);
  --lui-heading-ink: var(--text-primary, #f2f5fa);
  --lui-gold-hi: var(--accent-gold-bright, #f2e1bc);
  --lui-gold-base: var(--accent-gold, #dec592);
  --lui-gold-deep: var(--accent-gold-deep, #b39864);
  --lui-azure-hi: var(--accent-azure-bright, #b4dcf7);
  --lui-azure: var(--accent-azure, #7bb9e8);
  --lui-azure-deep: var(--accent-azure-deep, #4e91c7);
  --lui-emerald: var(--semantic-success, #5cc498);
  --lui-emerald-bg: rgba(92, 196, 152, 0.14);
  --lui-emerald-ink: #d4f3e5;
  --lui-warn: var(--semantic-warning, #e5b762);
  --lui-warn-bg: rgba(229, 183, 98, 0.15);
  --lui-warn-ink: #f6e1b8;
  --lui-err: var(--semantic-danger, #e07a86);
  --lui-err-bg: rgba(224, 122, 134, 0.15);
  --lui-err-ink: #f7d5da;
  --lui-code-bg: rgba(11, 18, 32, 0.78);
  --lui-quote-bg: rgba(24, 37, 62, 0.82);
  --lui-katex-bg: rgba(11, 18, 32, 0.78);
  --lui-option-bg: rgba(22, 34, 58, 0.84);
  --lui-option-hover-bg: rgba(31, 47, 76, 0.90);
  --lui-option-sel-bg: rgba(222, 197, 146, 0.14);
  --lui-option-diamond-bg: rgba(16, 25, 42, 0.86);
  --lui-option-diamond-border: rgba(216, 194, 148, 0.28);
  --lui-option-diamond-ink: #f2f5fa;
  --lui-input-bg: rgba(11, 18, 32, 0.80);
  --lui-subtle-pill-bg: rgba(123, 185, 232, 0.14);
  --lui-subtle-pill-ink: #b4dcf7;
  --lui-subtle-pill-border: rgba(123, 185, 232, 0.28);
  --lui-ref-bg: rgba(16, 25, 42, 0.86);
  --lui-ref-ink: #dec592;
  --lui-ref-border: rgba(216, 194, 148, 0.34);
  --lui-match-stroke: var(--accent-gold, #dec592);
  --lui-match-node: var(--accent-azure, #7bb9e8);
  --lui-ease: cubic-bezier(0.22, 1, 0.36, 1);

  position: relative;
  box-sizing: border-box;
  background: var(--lui-shell-bg);
  backdrop-filter: blur(12px);
  color: var(--lui-ink-primary);
  border: 1px solid rgba(216, 194, 148, 0.28);
  box-shadow: var(--sf-shadow-modal, inset 0 1px 0 rgba(255, 250, 236, 0.12), 0 18px 46px rgba(4, 9, 20, 0.48));
  border-radius: var(--sf-radius-modal, 10px);
  font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.68;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.lui-paper-shell--parchment .lui-body {
  --lui-body-bg: #eae4d6;
  --lui-card-bg: #f3eee2;
  --lui-card-elevated: #f8f4ea;
  --lui-scaffold-bg: #f4efe4;
  --lui-scaffold-head-bg: #eae3d3;
  --lui-card-muted: #e3dbc9;
  --lui-card-border: rgba(122, 97, 54, 0.24);
  --lui-card-gold-border: rgba(168, 121, 50, 0.48);
  --lui-ink-primary: #1a2232;
  --lui-ink-secondary: #3e4a5e;
  --lui-ink-muted: #626e82;
  --lui-heading-ink: #111827;
  --lui-gold-base: #9a6d28;
  --lui-gold-deep: #785219;
  --lui-azure: #0e6f8c;
  --lui-emerald: #15803d;
  --lui-emerald-bg: #e3f2e8;
  --lui-emerald-ink: #124526;
  --lui-warn: #9a5618;
  --lui-warn-bg: #f7ebd6;
  --lui-warn-ink: #5c340b;
  --lui-err: #b83242;
  --lui-err-bg: #f7e3e6;
  --lui-err-ink: #5e1722;
  --lui-code-bg: rgba(26, 34, 50, 0.08);
  --lui-quote-bg: #e7dfd0;
  --lui-katex-bg: rgba(255, 253, 248, 0.72);
  --lui-option-bg: #f6f2e8;
  --lui-option-hover-bg: #fbf8f0;
  --lui-option-sel-bg: #efe5d0;
  --lui-option-diamond-bg: #e4dccb;
  --lui-option-diamond-border: rgba(122, 97, 54, 0.48);
  --lui-option-diamond-ink: #273244;
  --lui-input-bg: #fbf9f3;
  --lui-subtle-pill-bg: rgba(14, 111, 140, 0.12);
  --lui-subtle-pill-ink: #0f5268;
  --lui-subtle-pill-border: rgba(14, 111, 140, 0.28);
  --lui-ref-bg: rgba(248, 244, 234, 0.94);
  --lui-ref-ink: #6e4e18;
  --lui-ref-border: rgba(154, 109, 40, 0.46);
  --lui-match-stroke: #9a6d28;
  --lui-match-node: #0e6f8c;
  color: var(--lui-ink-primary);
  box-shadow:
    inset 0 2px 10px rgba(8, 14, 28, 0.14),
    inset 0 -2px 8px rgba(8, 14, 28, 0.1);
}

.lui-paper-shell--overlay {
  width: min(1240px, 94vw);
  max-width: 100%;
  min-height: min(640px, 76vh);
  max-height: min(820px, 88vh);
  height: auto;
  margin: auto;
}

.lui-paper-shell--standalone {
  width: 100%;
  max-width: min(1240px, 94vw);
  min-height: min(640px, 78vh);
  margin-inline: auto;
}

.lui-paper-shell--sandbox {
  width: 100%;
  max-width: min(1160px, 94vw);
  margin-inline: auto;
}

.lui-paper-shell--compact {
  width: 100%;
}

.lui-header {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 20px;
  background: var(--lui-header-bg);
  border-bottom: 1px solid rgba(216, 194, 148, 0.3);
  box-shadow: inset 0 -1px 0 rgba(123, 185, 232, 0.08);
}

.lui-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.lui-step-rail {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0;
  list-style: none;
  margin: 0;
  padding: 0;
}

.lui-step-item {
  display: inline-flex;
  align-items: center;
}

.lui-step-line {
  width: 24px;
  height: 2px;
  margin: 0 7px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.22);
  transition: background 240ms var(--lui-ease), box-shadow 240ms var(--lui-ease);
}

.lui-step-line--done {
  background: #dec592;
  box-shadow: none;
}

.lui-step-line--active {
  background: #89a3b8;
    box-shadow: none;
}

.lui-step-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 3px 5px;
  font-size: 12.5px;
  font-weight: 500;
  color: #7f8a9c;
  letter-spacing: 0.03em;
  transition: color 200ms var(--lui-ease);
}

.lui-step-dot {
  width: 8px;
  height: 8px;
  border-radius: 1.5px;
  transform: none;
  box-sizing: border-box;
  border: 1.5px solid rgba(255, 255, 255, 0.48);
  background: rgba(15, 26, 48, 0.9);
  transition:
    transform 220ms var(--lui-ease),
    background-color 220ms var(--lui-ease),
    border-color 220ms var(--lui-ease),
    box-shadow 220ms var(--lui-ease);
}

.lui-step-pill--active {
  color: #fff7e6;
  font-weight: 700;
}

.lui-step-pill--active .lui-step-dot {
  border-color: #f2e1bc;
  background: #89a3b8;
  transform: none;
  }

.lui-step-pill--done {
  color: #eef1f5;
}

.lui-step-pill--done .lui-step-dot {
  border-color: #f2e1bc;
  background: #dec592;
  box-shadow: none;
}

.lui-clock-box {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 3px 11px 3px 6px;
  border-radius: var(--sf-radius-slot, 6px);
  background: var(--sf-surface-card, rgba(22, 34, 58, 0.88));
  color: #eef1f5;
  border: 1px solid rgba(123, 185, 232, 0.45);
  box-shadow: none;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.lui-clock-box--urgent {
  border-color: rgba(199, 161, 99, 0.72);
  box-shadow: none;
}

.lui-clock-ring {
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
}

.lui-clock-time {
  color: #f2e1bc;
  line-height: 1;
}

.lui-clock-box--urgent .lui-clock-time {
  color: #dec592;
}

.lui-theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: var(--sf-radius-card, 8px);
  border: 1px solid rgba(216, 194, 148, 0.42);
  background: var(--sf-surface-card, rgba(22, 34, 58, 0.88));
  color: #dec592;
  cursor: pointer;
  transition:
    transform 160ms var(--lui-ease),
    border-color 180ms var(--lui-ease),
    box-shadow 180ms var(--lui-ease),
    background 180ms var(--lui-ease),
    color 180ms var(--lui-ease);
}

.lui-theme-toggle:hover {
  transform: translateY(-1px);
  border-color: #f2e1bc;
  color: #f2e1bc;
  box-shadow: none;
}

.lui-theme-toggle--parchment {
  background: #dec592;
  border-color: #dec592;
  color: #141923;
  box-shadow: none;
}

.lui-theme-toggle--parchment:hover {
  color: #0b1322;
  box-shadow: none;
}

.lui-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 22px 26px;
  background: var(--lui-body-bg);
  display: flex;
  flex-direction: column;
  gap: 16px;
  scrollbar-width: thin;
  scrollbar-color: rgba(216, 194, 148, 0.38) transparent;
  transition: background 220ms var(--lui-ease), color 220ms var(--lui-ease);
}

.lui-body::-webkit-scrollbar {
  width: 6px;
}

.lui-body::-webkit-scrollbar-track {
  background: transparent;
}

.lui-body::-webkit-scrollbar-thumb {
  background: rgba(216, 194, 148, 0.34);
  border-radius: 2px;
}

.lui-stage-anim {
  display: flex;
  flex-direction: column;
  gap: 13px;
  animation: lui-step-enter 220ms var(--lui-ease) both;
}

.lui-utility-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 26px;
}

.lui-utility-left,
.lui-utility-right {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.lui-subtle-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 9px;
  border-radius: var(--sf-radius-slot, 6px);
  font-size: 11.5px;
  font-weight: 600;
  color: var(--lui-subtle-pill-ink, #a4bacb);
  background: var(--lui-subtle-pill-bg, rgba(123, 185, 232, 0.12));
  border: 1px solid var(--lui-subtle-pill-border, rgba(123, 185, 232, 0.28));
  font-variant-numeric: tabular-nums;
}

.lui-lock-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--sf-radius-slot, 6px);
  background: var(--lui-card-muted);
  border: 1px solid var(--lui-card-border);
  color: var(--lui-gold-base);
  opacity: 0.78;
}

.lui-badge-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
}

.lui-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 9px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(24, 39, 68, 0.88);
  color: #b7c0ce;
  border: 1px solid rgba(255, 255, 255, 0.28);
  font-variant-numeric: tabular-nums;
}

.lui-badge--role {
  background: var(--sf-surface-card, rgba(22, 34, 58, 0.88));
  color: #f2e1bc;
  border-color: rgba(216, 194, 148, 0.5);
}

.lui-badge--locked {
  background: rgba(123, 185, 232, 0.14);
  color: #a4bacb;
  border-color: rgba(123, 185, 232, 0.36);
}

.lui-badge--stars {
  background: var(--sf-surface-card, rgba(22, 34, 58, 0.88));
  color: #dec592;
  border-color: rgba(199, 161, 99, 0.58);
  letter-spacing: 0.06em;
}

.lui-cost-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  border: 1px solid transparent;
}

.lui-cost-badge--1 {
  background: var(--sf-surface-card, rgba(22, 34, 58, 0.88));
  border-color: rgba(203, 213, 225, 0.52);
  color: #eef1f5;
}

.lui-cost-badge--2 {
  background: var(--sf-surface-card, rgba(22, 34, 58, 0.88));
  border-color: rgba(114, 163, 138, 0.54);
  color: #9cc2ae;
}

.lui-cost-badge--3 {
  background: var(--sf-surface-card, rgba(22, 34, 58, 0.88));
  border-color: rgba(123, 185, 232, 0.58);
  color: #a4bacb;
}

.lui-cost-badge--4 {
  background: var(--sf-surface-card, rgba(22, 34, 58, 0.88));
  border-color: rgba(179, 160, 189, 0.54);
  color: #f3e8ff;
}

.lui-cost-badge--5 {
  background: var(--sf-surface-card, rgba(22, 34, 58, 0.88));
  border-color: rgba(216, 194, 148, 0.58);
  color: #dec592;
  box-shadow: none;
}

.lui-ref-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 4px 12px;
  border-radius: var(--sf-radius-slot, 6px);
  border: 1px solid var(--lui-ref-border, rgba(216, 194, 148, 0.42));
  background: var(--lui-ref-bg, rgba(22, 37, 66, 0.86));
  color: var(--lui-ref-ink, #dec592);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 180ms var(--lui-ease),
    border-color 180ms var(--lui-ease),
    transform 160ms var(--lui-ease),
    box-shadow 180ms var(--lui-ease);
}

.lui-ref-btn:hover {
  transform: translateY(-1px);
  border-color: var(--lui-gold-base, #dec592);
  box-shadow: 0 4px 12px rgba(7, 14, 28, 0.24);
}

.lui-ref-btn--highlight {
  border-radius: var(--sf-radius-slot, 6px);
  padding: 4px 13px;
  border-color: var(--lui-gold-base, #dec592);
  background: var(--sf-surface-card, rgba(22, 34, 58, 0.88));
  box-shadow: none;
}

.lui-study-workspace {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.lui-study-workspace--single {
  max-width: 920px;
  width: 100%;
  margin: 0 auto;
}

.lui-study-workspace--dual {
  display: grid;
  grid-template-columns: minmax(340px, 40%) minmax(0, 1fr);
  gap: 22px;
  align-items: start;
}

@media (max-width: 919px) {
  .lui-study-workspace--dual {
    grid-template-columns: 1fr;
    gap: 14px;
  }
}

.lui-study-main {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.lui-material-scaffold {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-radius: var(--sf-radius-modal, 10px);
  border: 1px solid var(--lui-card-gold-border);
  background: var(--lui-scaffold-bg, var(--lui-card-elevated));
  box-shadow:
    inset 0 1px 0 rgba(232, 210, 162, 0.14),
    0 10px 26px rgba(4, 10, 22, 0.26);
  overflow: hidden;
  animation: lui-panel-reveal 200ms var(--lui-ease) both;
}

.lui-material-scaffold__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 11px 16px;
  background: var(--lui-scaffold-head-bg);
  border-bottom: 1px solid var(--lui-card-gold-border);
}

.lui-material-scaffold__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--lui-gold-base);
  letter-spacing: 0.02em;
}

.lui-scaffold-collapse-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 26px;
  padding: 2px 9px;
  border-radius: var(--sf-radius-slot, 6px);
  border: 1px solid var(--lui-ref-border, rgba(216, 194, 148, 0.42));
  background: transparent;
  color: var(--lui-ref-ink, #dec592);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 160ms var(--lui-ease), border-color 160ms var(--lui-ease);
}

.lui-scaffold-collapse-btn:hover {
  border-color: var(--lui-gold-base);
  background: rgba(216, 194, 148, 0.12);
}

.lui-material-scaffold__body {
  padding: 16px 18px;
  max-height: min(560px, 60vh);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(216, 194, 148, 0.38) transparent;
}

.lui-material-scaffold__body::-webkit-scrollbar {
  width: 5px;
}

.lui-material-scaffold__body::-webkit-scrollbar-track {
  background: transparent;
}

.lui-material-scaffold__body::-webkit-scrollbar-thumb {
  background: rgba(216, 194, 148, 0.34);
  border-radius: 2px;
}

@media (max-width: 919px) {
  .lui-material-scaffold__body {
    max-height: 280px;
  }
}

.lui-material-scaffold__body .lui-md {
  font-size: 15px;
  line-height: 1.75;
}

.lui-briefing-canvas {
  max-width: 920px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.lui-briefing-title {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--lui-heading-ink);
  letter-spacing: 0.02em;
}

.lui-briefing-diamond {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  transform: none;
  background: var(--lui-gold-base);
  box-shadow: none;
}

.lui-metal-divider {
  height: 1px;
  width: 100%;
  background: rgba(216, 194, 148, 0.32);
  border: 0;
  margin: 2px 0;
}

.lui-stem-card {
  position: relative;
  padding: 20px 24px;
  background: var(--lui-card-bg);
  color: var(--lui-ink-primary);
  border: 1px solid var(--lui-card-border);
  border-left: 3px solid var(--lui-gold-base);
  border-radius: var(--sf-radius-card, 8px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 6px 18px rgba(5, 10, 22, 0.16);
}

.lui-stem-card .lui-md {
  font-size: 17px;
  line-height: 1.74;
}

.lui-stem-card--briefing {
  padding: 24px 28px;
  border-left-color: var(--lui-azure);
  box-shadow:
    inset 0 1px 0 rgba(164, 186, 203, 0.08),
    0 6px 20px rgba(5, 10, 22, 0.18);
}

.lui-stem-card--briefing .lui-md {
  font-size: 16px;
  line-height: 1.78;
}

.lui-remediation-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lui-remediation-submitted {
  margin: 8px 0 4px;
  padding: 4px 10px;
  border-radius: var(--sf-radius-slot, 6px);
  display: inline-block;
  font-size: 13px;
  font-weight: 600;
  background: var(--lui-warn-bg);
  color: var(--lui-warn-ink);
  border: 1px solid rgba(199, 161, 99, 0.3);
}

.lui-md {
  color: var(--lui-ink-primary);
  font-size: 15.5px;
  line-height: 1.7;
  word-break: break-word;
}
.lui-md--inline {
  display: inline;
  font-size: inherit;
  line-height: 1.55;
}
.lui-md h1, .lui-md h2, .lui-md h3, .lui-md h4 {
  margin: 0.55em 0 0.35em;
  color: var(--lui-heading-ink);
  font-weight: 700;
  line-height: 1.38;
}
.lui-md h1:first-child, .lui-md h2:first-child, .lui-md h3:first-child, .lui-md h4:first-child {
  margin-top: 0;
}
.lui-md h1 { font-size: 1.24em; }
.lui-md h2 { font-size: 1.14em; }
.lui-md h3 { font-size: 1.05em; color: var(--lui-gold-base); }
.lui-md p { margin: 0.45em 0; }
.lui-md p:first-child { margin-top: 0; }
.lui-md p:last-child { margin-bottom: 0; }
.lui-md strong {
  color: var(--lui-heading-ink);
  font-weight: 700;
}
.lui-md ul, .lui-md ol { margin: 0.45em 0; padding-left: 1.45em; }
.lui-md li { margin: 0.24em 0; }
.lui-md li::marker {
  color: var(--lui-gold-base);
}
.lui-md hr {
  border: 0;
  height: 1px;
  margin: 0.8em 0;
  background: rgba(255, 255, 255, 0.08);
}
.lui-md blockquote {
  margin: 0.6em 0;
  padding: 9px 14px;
  background: var(--lui-quote-bg);
  border-left: 3px solid var(--lui-gold-base);
  color: var(--lui-ink-primary);
  border-radius: 0 3px 3px 0;
}
.lui-md pre {
  margin: 0.6em 0;
  padding: 11px 14px;
  background: #0c1426;
  color: #eef1f5;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: var(--sf-radius-slot, 6px);
  overflow-x: auto;
  font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
  font-size: 13.5px;
}
.lui-md code {
  padding: 1px 6px;
  background: var(--lui-code-bg);
  border-radius: 4px;
  font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
  font-size: 0.9em;
}
.lui-md pre code {
  padding: 0;
  background: transparent;
  color: inherit;
}
.lui-md table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.6em 0;
  font-size: 14px;
}
.lui-md th, .lui-md td {
  border: 1px solid var(--lui-card-border);
  padding: 6px 10px;
  text-align: left;
}
.lui-md th {
  background: var(--lui-card-muted);
  color: var(--lui-heading-ink);
  font-weight: 700;
}
.lui-katex-block {
  margin: 0.65em 0;
  padding: 8px 12px;
  overflow-x: auto;
  text-align: center;
  background: var(--lui-katex-bg);
  border: 1px solid var(--lui-card-border);
  border-radius: var(--sf-radius-slot, 6px);
}
.lui-katex-inline {
  padding: 0 2px;
}
.katex .katex-mathml {
  position: absolute;
  clip: rect(1px, 1px, 1px, 1px);
  padding: 0;
  border: 0;
  height: 1px;
  width: 1px;
  overflow: hidden;
}

.lui-options-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 11px;
}

@media (max-width: 640px) {
  .lui-body {
    padding: 14px 16px;
  }
  .lui-options-grid {
    grid-template-columns: 1fr;
  }
}

.lui-option-btn {
  position: relative;
  min-height: 54px;
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 13px 17px;
  border-radius: var(--sf-radius-card, 8px);
  background: var(--lui-option-bg);
  color: var(--lui-ink-primary);
  border: 1px solid var(--lui-card-border);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  font-size: 15.5px;
  line-height: 1.6;
  text-align: left;
  cursor: pointer;
  transition:
    transform 170ms var(--lui-ease),
    border-color 180ms var(--lui-ease),
    background 180ms ease,
    box-shadow 180ms var(--lui-ease);
}

.lui-option-btn:hover:not(:disabled) {
  transform: translateY(-1.5px);
  border-color: var(--lui-gold-base);
  background: var(--lui-option-hover-bg);
  box-shadow: none;
}

.lui-option-btn--selected {
  transform: translateY(-1px);
  border-color: var(--lui-gold-base);
  background: var(--lui-option-sel-bg);
}

.lui-option-btn--correct {
  border-color: var(--lui-emerald);
  background: var(--lui-emerald-bg);
  color: var(--lui-emerald-ink);
}

.lui-option-btn--incorrect {
  border-color: var(--lui-err);
  background: var(--lui-err-bg);
  color: var(--lui-err-ink);
  animation: none;
  box-shadow: none;
}

.lui-option-btn:disabled {
  cursor: default;
  opacity: 0.92;
}

.lui-option-diamond {
  position: relative;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.lui-option-diamond-frame {
  position: absolute;
  inset: 3px;
  transform: none;
  border-radius: 3px;
  background: var(--lui-option-diamond-bg);
  border: 1.5px solid var(--lui-option-diamond-border);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transition:
    background 180ms var(--lui-ease),
    border-color 180ms var(--lui-ease),
    box-shadow 180ms var(--lui-ease),
    transform 180ms var(--lui-ease);
}

.lui-option-key {
  position: relative;
  z-index: 1;
  font-weight: 800;
  font-size: 12px;
  line-height: 1;
  color: var(--lui-option-diamond-ink);
  transition: color 180ms var(--lui-ease);
}

.lui-option-btn:hover:not(:disabled) .lui-option-diamond-frame {
  border-color: var(--lui-gold-base);
}

.lui-option-btn--selected .lui-option-diamond-frame {
  background: #dec592;
  border-color: #dec592;
  box-shadow: none;
  transform: none;
}

.lui-option-btn--selected .lui-option-key {
  color: #111827;
}

.lui-option-btn--correct .lui-option-diamond-frame {
  background: #72a38a;
  border-color: #72a38a;
  box-shadow: none;
}

.lui-option-btn--correct .lui-option-key {
  color: #06281c;
}

.lui-option-btn--incorrect .lui-option-diamond-frame {
  background: #b87076;
  border-color: #b87076;
  box-shadow: none;
}

.lui-option-btn--incorrect .lui-option-key {
  color: #2c0810;
}

.lui-matching-board {
  display: grid;
  grid-template-columns: 1fr 72px 1fr;
  align-items: stretch;
  gap: 10px;
}
.lui-matching-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lui-matching-item {
  min-height: 46px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 14px;
  border-radius: var(--sf-radius-card, 8px);
  background: var(--lui-option-bg);
  color: var(--lui-ink-primary);
  border: 1px solid var(--lui-card-border);
  font-size: 14.5px;
  cursor: pointer;
  text-align: left;
  transition:
    transform 170ms var(--lui-ease),
    border-color 180ms var(--lui-ease),
    background 180ms ease;
}
.lui-matching-item:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: var(--lui-gold-base);
}
.lui-matching-item--active {
  border-color: var(--lui-azure);
  background: var(--lui-option-hover-bg);
  box-shadow: none;
}
.lui-matching-item--paired {
  border-color: var(--lui-gold-base);
  background: var(--lui-option-sel-bg);
}
.lui-matching-svg {
  width: 100%;
  height: 100%;
  min-height: 136px;
}
.lui-matching-curve {
  fill: none;
  stroke: var(--lui-match-stroke);
  stroke-width: 2.2;
}
.lui-matching-node {
  fill: var(--lui-match-node);
}
.lui-pair-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: var(--sf-radius-slot, 6px);
  font-size: 11px;
  font-weight: 700;
  background: #dec592;
  color: #141923;
  font-variant-numeric: tabular-nums;
}

.lui-input-field {
  min-height: 44px;
  width: 100%;
  max-width: 420px;
  box-sizing: border-box;
  padding: 9px 14px;
  border-radius: var(--sf-radius-card, 8px);
  border: 1px solid var(--lui-card-gold-border);
  background: var(--lui-input-bg);
  color: var(--lui-ink-primary);
  font-size: 15.5px;
  font-family: inherit;
  transition: border-color 180ms var(--lui-ease), box-shadow 180ms var(--lui-ease);
}
.lui-input-field::placeholder {
  color: var(--lui-ink-muted);
}
.lui-input-field:focus {
  outline: none;
  border-color: var(--lui-azure);
  box-shadow: none;
}

.lui-multistep-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.lui-multistep-row {
  padding: 12px 15px;
  border-radius: var(--sf-radius-card, 8px);
  background: var(--lui-card-bg);
  border: 1px solid var(--lui-card-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lui-multistep-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 600;
  color: var(--lui-heading-ink);
}

.lui-hint-box {
  padding: 12px 16px;
  border-radius: var(--sf-radius-card, 8px);
  background: var(--lui-warn-bg);
  border: 1px solid rgba(199, 161, 99, 0.36);
  border-left: 3px solid var(--lui-warn);
  color: var(--lui-warn-ink);
  animation: lui-panel-reveal 180ms var(--lui-ease) both;
}

.lui-hint-box .lui-md,
.lui-hint-box .lui-md strong,
.lui-hint-box .lui-md h3 {
  color: var(--lui-warn-ink);
}

.lui-feedback-box {
  padding: 13px 16px;
  border-radius: var(--sf-radius-card, 8px);
  border: 1px solid rgba(114, 163, 138, 0.44);
  border-left: 3px solid var(--lui-emerald);
  background: var(--lui-emerald-bg);
  color: var(--lui-emerald-ink);
  box-shadow: none;
  animation: lui-panel-reveal 200ms var(--lui-ease) both;
}

.lui-feedback-box .lui-md,
.lui-feedback-box .lui-md strong {
  color: var(--lui-emerald-ink);
}

.lui-feedback-box--incorrect {
  border-color: rgba(184, 112, 118, 0.44);
  border-left-color: var(--lui-err);
  background: var(--lui-err-bg);
  color: var(--lui-err-ink);
  box-shadow: none;
}

.lui-feedback-box--incorrect .lui-md,
.lui-feedback-box--incorrect .lui-md strong {
  color: var(--lui-err-ink);
}

.lui-feedback-head {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-weight: 700;
  font-size: 14.5px;
}

.lui-wait-banner {
  padding: 11px 16px;
  border-radius: var(--sf-radius-card, 8px);
  background: var(--lui-emerald-bg);
  border: 1px solid rgba(114, 163, 138, 0.42);
  color: var(--lui-emerald-ink);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 13.5px;
  font-weight: 600;
}

.lui-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 20px;
  background: var(--lui-footer-bg);
  border-top: 1px solid rgba(216, 194, 148, 0.28);
}

.lui-btn-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 9px;
}

.lui-btn {
  position: relative;
  overflow: hidden;
  min-height: 38px;
  padding: 7px 18px;
  border-radius: var(--sf-radius-card, 8px);
  font-size: 13.5px;
  font-weight: 700;
  letter-spacing: 0.03em;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.34);
  background: var(--sf-surface-card, rgba(22, 34, 58, 0.88));
  color: #eef1f5;
  transition:
    transform 150ms var(--lui-ease, cubic-bezier(0.22, 1, 0.36, 1)),
    background 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
}
.lui-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(216, 194, 148, 0.72);
  box-shadow: 0 6px 16px rgba(4, 10, 24, 0.32);
}
.lui-btn:active:not(:disabled) {
  transform: scale(0.96);
}
.lui-btn:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}
.lui-btn--primary {
  background: var(--sf-gold-surface, linear-gradient(180deg, #e5d2a7 0%, #d4bd8c 100%));
  color: #171e2b;
  border-color: var(--sf-gold-border, rgba(244, 228, 190, 0.72));
  box-shadow: var(--sf-gold-shadow, inset 0 1px 0 rgba(255, 252, 242, 0.42), 0 6px 16px rgba(6, 11, 24, 0.28));
}
.lui-btn--primary:hover:not(:disabled) {
  background: var(--sf-gold-surface-hover, linear-gradient(180deg, #eedcb5 0%, #dec899 100%));
  border-color: rgba(250, 238, 206, 0.88);
  box-shadow: var(--sf-gold-shadow-hover, inset 0 1px 0 rgba(255, 252, 242, 0.54), 0 8px 20px rgba(6, 11, 24, 0.36));
}
.lui-btn--ghost {
  background: rgba(21, 35, 62, 0.72);
  border-color: rgba(216, 194, 148, 0.38);
  color: #dec592;
}
.lui-btn--ghost:hover:not(:disabled) {
  background: rgba(216, 194, 148, 0.14);
  border-color: #dec592;
  color: #f2e1bc;
}
.lui-btn--active-soft {
  background: rgba(216, 194, 148, 0.2);
  border-color: #dec592;
  color: #f2e1bc;
}

.lui-lore-title {
  font-size: 17.5px;
  font-weight: 700;
  color: #f2e1bc;
  letter-spacing: 0.05em;
}
.lui-lore-subtitle {
  font-size: 12.5px;
  color: #7f8a9c;
  margin-top: 2px;
}

.lui-lore-layout {
  display: grid;
  grid-template-columns: 236px 1fr;
  gap: 20px;
}
@media (max-width: 860px) {
  .lui-lore-layout {
    grid-template-columns: 1fr;
  }
}
.lui-era-nav {
  display: flex;
  flex-direction: column;
  gap: 5px;
  border-left: 1px solid rgba(216, 194, 148, 0.36);
  padding-left: 14px;
}
.lui-era-btn {
  position: relative;
  min-height: 44px;
  padding: 8px 12px;
  border-radius: var(--sf-radius-card, 8px);
  border: 1px solid transparent;
  background: transparent;
  color: #b7c0ce;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition:
    background-color 180ms var(--lui-ease),
    border-color 180ms var(--lui-ease),
    color 180ms var(--lui-ease);
}
.lui-era-btn::before {
  content: "";
  position: absolute;
  left: -18.5px;
  top: 50%;
  transform: translateY(-50%);
  width: 7px;
  height: 7px;
  border-radius: 1px;
  background: #0f1a30;
  border: 1.5px solid rgba(216, 194, 148, 0.56);
  transition: background-color 180ms var(--lui-ease), transform 180ms var(--lui-ease), box-shadow 180ms var(--lui-ease);
}
.lui-era-btn:hover {
  background: rgba(216, 194, 148, 0.08);
  color: #eef1f5;
}
.lui-era-btn--active {
  background: var(--sf-surface-card, rgba(22, 34, 58, 0.88));
  color: #eef1f5;
  border-color: rgba(216, 194, 148, 0.52);
  box-shadow: inset 0 1px 0 rgba(232, 210, 162, 0.14);
}
.lui-era-btn--active::before {
  background: #89a3b8;
  border-color: #f2e1bc;
  transform: translateY(-50%);
  box-shadow: none;
}
.lui-era-scale {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #dec592;
  font-variant-numeric: tabular-nums;
}
.lui-era-name {
  font-size: 13.5px;
  font-weight: 600;
}
.lui-era-heading {
  margin: 0 0 12px;
  font-size: 19px;
  color: #eef1f5;
  letter-spacing: 0.02em;
}

.lui-factions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(248px, 1fr));
  gap: 14px;
}
.lui-faction-card {
  padding: 15px 17px;
  border-radius: var(--sf-radius-card, 8px);
  background: var(--sf-surface-card, rgba(22, 34, 58, 0.88));
  border: 1px solid rgba(216, 194, 148, 0.32);
  box-shadow: inset 0 1px 0 rgba(232, 210, 162, 0.1);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lui-faction-title {
  font-size: 15.5px;
  font-weight: 700;
  color: #eef1f5;
  letter-spacing: 0.02em;
}
.lui-faction-motto {
  font-style: italic;
  color: #dec592;
  font-weight: 500;
  font-size: 13.5px;
  padding-left: 10px;
  border-left: 2px solid rgba(216, 194, 148, 0.52);
}
.lui-faction-summary {
  margin: 2px 0 4px;
  font-size: 13.5px;
  color: #b7c0ce;
  line-height: 1.62;
}
.lui-faction-units {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: auto;
  padding-top: 6px;
}

.lui-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  border-bottom: 1px solid rgba(216, 194, 148, 0.24);
  padding-bottom: 10px;
}

.lui-unit-name {
  font-size: 17px;
  font-weight: 700;
  color: #eef1f5;
  letter-spacing: 0.02em;
}
.lui-unit-silhouette {
  font-size: 13.5px;
  color: #b7c0ce;
  margin-bottom: 10px;
  line-height: 1.58;
}
.lui-unit-skill-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.04em;
  color: #dec592;
  margin-bottom: 6px;
}
.lui-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
  gap: 7px;
  margin-top: 12px;
}
.lui-stat-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 7px 10px;
  border-radius: var(--sf-radius-slot, 6px);
  background: rgba(11, 20, 38, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.22);
}
.lui-stat-label {
  font-size: 11px;
  color: #7f8a9c;
  letter-spacing: 0.03em;
}
.lui-stat-value {
  font-size: 14px;
  font-weight: 700;
  color: #eef1f5;
  font-variant-numeric: tabular-nums;
}

.lui-voice-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.lui-voice-card {
  padding: 12px 15px;
  border-radius: var(--sf-radius-card, 8px);
  background: var(--sf-surface-card, rgba(22, 34, 58, 0.88));
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-left: 3px solid #dec592;
}
.lui-voice-trigger {
  font-size: 11.5px;
  font-weight: 700;
  color: #dec592;
  margin-bottom: 4px;
  letter-spacing: 0.05em;
}
.lui-voice-text {
  font-size: 14.5px;
  color: #eef1f5;
  line-height: 1.6;
}

.lui-recipe-tree {
  padding: 12px 14px;
  border-radius: var(--sf-radius-card, 8px);
  background: var(--sf-surface-card, rgba(22, 34, 58, 0.88));
  border: 1px solid rgba(216, 194, 148, 0.34);
  color: #eef1f5;
  box-shadow: inset 0 1px 0 rgba(232, 210, 162, 0.1);
}
.lui-recipe-head {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #dec592;
  margin-bottom: 9px;
}
.lui-recipe-row {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.lui-recipe-chip {
  min-height: 34px;
  padding: 5px 11px;
  border-radius: var(--sf-radius-slot, 6px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(16, 28, 52, 0.9);
  color: #eef1f5;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  transition:
    border-color 160ms cubic-bezier(0.22, 1, 0.36, 1),
    background 160ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 160ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 160ms cubic-bezier(0.22, 1, 0.36, 1);
}
.lui-recipe-chip:hover {
  transform: translateY(-1px);
  border-color: rgba(216, 194, 148, 0.72);
  color: #f2e1bc;
}
.lui-recipe-chip--active {
  border-color: #dec592;
  background: var(--sf-surface-card, rgba(22, 34, 58, 0.88));
  color: #f2e1bc;
  box-shadow: none;
}
.lui-recipe-formula-card {
  margin-top: 10px;
  padding: 12px 14px;
  border-radius: var(--sf-radius-card, 8px);
  background: rgba(11, 20, 38, 0.82);
  border: 1px solid rgba(216, 194, 148, 0.32);
  animation: lui-panel-reveal 180ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.lui-recipe-formula-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.lui-recipe-formula-name {
  font-size: 14px;
  font-weight: 700;
  color: #f2e1bc;
}
.lui-recipe-formula-desc {
  font-size: 12.5px;
  margin: 5px 0 9px;
  color: #b7c0ce;
  line-height: 1.55;
}
.lui-recipe-chain {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.lui-recipe-plus {
  font-weight: 800;
  color: #dec592;
}
.lui-recipe-comp {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 9px;
  border-radius: var(--sf-radius-slot, 6px);
  font-size: 12px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: rgba(24, 38, 66, 0.9);
  color: #eef1f5;
}
.lui-recipe-comp--owned {
  border-color: rgba(114, 163, 138, 0.62);
  background: rgba(16, 54, 46, 0.82);
  color: #d1fae5;
  font-weight: 600;
}
.lui-owned-tag {
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: var(--sf-radius-slot, 6px);
  background: rgba(114, 163, 138, 0.22);
  border: 1px solid rgba(114, 163, 138, 0.42);
  color: #9cc2ae;
}
.lui-item-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 0;
  vertical-align: middle;
  box-sizing: border-box;
  border-radius: var(--sf-radius-card, 8px);
  overflow: hidden;
  background: #131e32;
  border: 1px solid color-mix(in srgb, var(--lui-item-accent, #dec592) 50%, #222d40);
}
.lui-item-icon--xs {
  width: 20px;
  height: 20px;
  border-radius: var(--sf-radius-slot, 6px);
}
.lui-item-icon--sm {
  width: 26px;
  height: 26px;
  border-radius: var(--sf-radius-slot, 6px);
}
.lui-item-icon--md {
  width: 38px;
  height: 38px;
  border-radius: var(--sf-radius-card, 8px);
}
.lui-item-icon--lg {
  width: 44px;
  height: 44px;
  border-radius: var(--sf-radius-card, 8px);
}
.lui-item-icon__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
  pointer-events: none;
}
.lui-item-icon__dots {
  position: absolute;
  right: 2px;
  bottom: 2px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 1.5px;
  padding: 1.5px 2.5px;
  border-radius: 2px;
  background: rgba(7, 11, 22, 0.84);
  border: 0;
  pointer-events: none;
}
.lui-item-icon__dot {
  display: block;
  width: 4.5px;
  height: 4.5px;
  border-radius: 2px;
  box-shadow: none;
}
.lui-item-icon--sm .lui-item-icon__dots {
  right: 1px;
  bottom: 1px;
  padding: 1px 2px;
}
.lui-item-icon--sm .lui-item-icon__dot {
  width: 3.5px;
  height: 3.5px;
}
.lui-unit-skill-desc {
  font-size: 13.5px;
  line-height: 1.65;
  color: inherit;
}
.lui-rich-game-text {
  line-height: inherit;
  word-break: break-word;
}
.lui-stat-token {
  display: inline-flex;
  align-items: center;
  gap: 2.5px;
  vertical-align: baseline;
  font-weight: 600;
  padding: 0 2px;
  border-radius: 4px;
  line-height: 1.35;
}
.lui-stat-icon {
  display: inline-block;
  width: 13px;
  height: 13px;
  flex-shrink: 0;
  vertical-align: -2px;
  transform: translateY(0.5px);
}
.lui-stat-num {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.lui-stat-token--phys {
  color: #eb9d62;
}
.lui-stat-token--magic {
  color: #6bc0f5;
}
.lui-stat-token--true {
  color: #f4f7fb;
}
.lui-stat-token--shield {
  color: #98c7f5;
}
.lui-stat-token--hp {
  color: #5cc498;
}
.lui-stat-token--as {
  color: #ecd175;
}
.lui-stat-token--crit {
  color: #e67f8e;
}
.lui-stat-token--armor {
  color: #e2aa5e;
}
.lui-stat-token--mr {
  color: #c2a0f2;
}
.lui-stat-token--mana {
  color: #70b2f5;
}
.lui-stat-token--gold {
  color: #e8cb88;
}
.lui-paper-shell--parchment .lui-stat-token--phys {
  color: #c2410c;
}
.lui-paper-shell--parchment .lui-stat-token--magic {
  color: #5a7286;
}
.lui-paper-shell--parchment .lui-stat-token--true {
  color: #1e293b;
}
.lui-paper-shell--parchment .lui-stat-token--shield {
  color: #1d4ed8;
}
.lui-paper-shell--parchment .lui-stat-token--hp {
  color: #047857;
}
.lui-paper-shell--parchment .lui-stat-token--as {
  color: #a16207;
}
.lui-paper-shell--parchment .lui-stat-token--crit {
  color: #be123c;
}
.lui-paper-shell--parchment .lui-stat-token--armor {
  color: #b45309;
}
.lui-paper-shell--parchment .lui-stat-token--mr {
  color: #7e22ce;
}
.lui-paper-shell--parchment .lui-stat-token--mana {
  color: #1d4ed8;
}
.lui-paper-shell--parchment .lui-stat-token--gold {
  color: #92400e;
}
.lui-arc-ribbon {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 14px;
  padding: 8px 20px;
  background: #161d29;
  border-bottom: 1px solid rgba(216, 194, 148, 0.24);
}
.lui-arc-ribbon__left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1 1 260px;
  flex-wrap: wrap;
}
.lui-arc-counter {
  display: inline-flex;
  align-items: center;
  padding: 2px 9px;
  border-radius: var(--sf-radius-slot, 6px);
  background: var(--sf-surface-card, rgba(22, 34, 58, 0.88));
  border: 1px solid rgba(216, 194, 148, 0.54);
  color: #f2e1bc;
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.lui-arc-topic {
  color: var(--lui-ink-primary);
  font-size: 13px;
  line-height: 1.45;
  font-weight: 700;
  min-width: 0;
  overflow-wrap: anywhere;
}
.lui-arc-tags {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.lui-arc-tag {
  padding: 1px 7px;
  border-radius: var(--sf-radius-slot, 6px);
  background: rgba(123, 185, 232, 0.12);
  border: 1px solid rgba(123, 185, 232, 0.3);
  color: #a4bacb;
  font-size: 10.5px;
  font-weight: 600;
  white-space: nowrap;
}
.lui-arc-ribbon__right {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-left: auto;
}
.lui-arc-branch {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 9px;
  border-radius: var(--sf-radius-slot, 6px);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.lui-arc-branch--remediate {
  background: var(--sf-surface-card, rgba(22, 34, 58, 0.88));
  border: 1px solid rgba(199, 161, 99, 0.72);
  color: #fef3c7;
  box-shadow: none;
}
.lui-arc-branch--stretch {
  background: var(--sf-surface-card, rgba(22, 34, 58, 0.88));
  border: 1px solid rgba(255, 232, 168, 0.86);
  color: #eef1f5;
  box-shadow: none;
}
.lui-arc-outline {
  margin: 0;
  padding: 0;
  list-style: none;
  display: inline-flex;
  align-items: center;
  gap: 0;
}
.lui-arc-outline-item {
  display: inline-flex;
  align-items: center;
}
.lui-arc-connector {
  width: 14px;
  height: 1.5px;
  margin: 0 4px;
  border-radius: var(--sf-radius-slot, 6px);
  background: rgba(255, 255, 255, 0.28);
}
.lui-arc-connector--done {
  background: #72a38a;
}
.lui-arc-node {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: var(--sf-radius-slot, 6px);
  font-size: 11px;
  font-weight: 600;
  border: 1px solid transparent;
  white-space: nowrap;
}
.lui-arc-node-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.lui-arc-node--done {
  color: #9cc2ae;
  background: rgba(114, 163, 138, 0.14);
  border-color: rgba(114, 163, 138, 0.38);
}
.lui-arc-node--done .lui-arc-node-dot {
  background: #72a38a;
  box-shadow: none;
}
.lui-arc-node--active {
  color: #eef1f5;
  font-weight: 800;
  background: rgba(216, 194, 148, 0.18);
  border-color: rgba(216, 194, 148, 0.65);
  box-shadow: none;
}
.lui-arc-node--active .lui-arc-node-dot {
  background: #dec592;
  box-shadow: none;
}
.lui-arc-node--upcoming {
  color: #7f8a9c;
  background: rgba(15, 26, 48, 0.6);
  border-color: rgba(255, 255, 255, 0.2);
}
.lui-arc-node--upcoming .lui-arc-node-dot {
  background: rgba(255, 255, 255, 0.5);
}
.lui-desc-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: var(--sf-radius-slot, 6px);
  border: 1px solid rgba(216, 194, 148, 0.44);
  background: rgba(15, 26, 48, 0.86);
  color: #dec592;
  font-family: inherit;
  font-weight: 700;
  letter-spacing: 0.03em;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease, box-shadow 140ms ease;
}
.lui-desc-toggle:hover {
  background: rgba(30, 48, 82, 0.96);
  border-color: rgba(216, 194, 148, 0.78);
  color: #f2e1bc;
}
.lui-desc-toggle--xs {
  height: 22px;
  padding: 0 7px;
  font-size: 11px;
}
.lui-desc-toggle--sm {
  height: 27px;
  padding: 0 10px;
  font-size: 12px;
}
.lui-desc-toggle--detailed {
  background: var(--sf-surface-card, rgba(22, 34, 58, 0.88));
  border-color: rgba(216, 194, 148, 0.82);
  color: #f2e1bc;
  box-shadow: none;
}
.lui-desc-toggle__icon {
  display: inline-flex;
  flex-shrink: 0;
}
.lui-unit-skill-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.lui-unit-skill-head .lui-unit-skill-label {
  margin-bottom: 0;
}
.lui-recipe-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 9px;
}
.lui-recipe-head-row .lui-recipe-head {
  margin-bottom: 0;
}
`;

export function ensureLearningUiStyles(targetDoc?: Document | null): void {
  const doc = targetDoc ?? (typeof document !== 'undefined' ? document : null);
  if (!doc || !doc.head) return;
  if (doc.getElementById(LEARNING_UI_STYLE_ID)) return;
  const styleEl = doc.createElement('style');
  styleEl.id = LEARNING_UI_STYLE_ID;
  styleEl.textContent = LEARNING_UI_CSS;
  doc.head.appendChild(styleEl);
}
