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

@keyframes lui-star-pulse {
  0%, 100% {
    box-shadow:
      0 0 0 2px rgba(79, 209, 255, 0.24),
      0 0 10px rgba(79, 209, 255, 0.55);
  }
  50% {
    box-shadow:
      0 0 0 4px rgba(242, 201, 125, 0.28),
      0 0 15px rgba(79, 209, 255, 0.8);
  }
}

@keyframes lui-track-flow {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 200% 50%;
  }
}

@keyframes lui-option-breathe {
  0%, 100% {
    box-shadow:
      0 0 0 1px rgba(242, 201, 125, 0.62),
      0 0 14px rgba(79, 209, 255, 0.16),
      inset 0 1px 0 rgba(255, 240, 196, 0.22);
  }
  50% {
    box-shadow:
      0 0 0 1px rgba(79, 209, 255, 0.72),
      0 0 20px rgba(242, 201, 125, 0.28),
      inset 0 1px 0 rgba(255, 240, 196, 0.34);
  }
}

@keyframes lui-emerald-starlight {
  0% {
    box-shadow:
      0 0 0 1px rgba(52, 211, 153, 0.9),
      0 0 22px rgba(52, 211, 153, 0.52);
  }
  100% {
    box-shadow:
      0 0 0 1px rgba(52, 211, 153, 0.72),
      0 0 14px rgba(52, 211, 153, 0.26);
  }
}

@keyframes lui-clock-pulse {
  0%, 100% {
    opacity: 0.72;
  }
  50% {
    opacity: 1;
  }
}

@keyframes lui-cta-sheen {
  0% {
    transform: translateX(-140%) skewX(-22deg);
  }
  38%, 100% {
    transform: translateX(240%) skewX(-22deg);
  }
}

.lui-paper-shell {
  --lui-shell-bg: linear-gradient(180deg, rgba(16, 28, 52, 0.985) 0%, rgba(11, 20, 39, 0.992) 52%, rgba(8, 15, 30, 0.995) 100%);
  --lui-header-bg: linear-gradient(180deg, rgba(25, 40, 70, 0.94) 0%, rgba(15, 26, 48, 0.96) 100%);
  --lui-footer-bg: linear-gradient(180deg, rgba(13, 22, 41, 0.96) 0%, rgba(9, 16, 31, 0.98) 100%);
  --lui-body-bg: radial-gradient(ellipse at 50% 0%, rgba(79, 209, 255, 0.07) 0%, rgba(15, 26, 48, 0) 64%);
  --lui-card-bg: #15233e;
  --lui-card-elevated: #1a2b4c;
  --lui-scaffold-bg: linear-gradient(165deg, rgba(23, 38, 69, 0.97) 0%, rgba(14, 25, 47, 0.98) 100%);
  --lui-scaffold-head-bg: linear-gradient(90deg, rgba(242, 201, 125, 0.14) 0%, rgba(79, 209, 255, 0.06) 100%);
  --lui-card-muted: rgba(24, 39, 68, 0.86);
  --lui-card-border: rgba(141, 162, 192, 0.24);
  --lui-card-gold-border: rgba(242, 201, 125, 0.44);
  --lui-ink-primary: #f1f5f9;
  --lui-ink-secondary: #cbd5e1;
  --lui-ink-muted: #8da2c0;
  --lui-heading-ink: #f8fafc;
  --lui-gold-hi: #fff0c4;
  --lui-gold-base: #f2c97d;
  --lui-gold-deep: #a87932;
  --lui-azure-hi: #a5f3fc;
  --lui-azure: #4fd1ff;
  --lui-azure-deep: #0ea5e9;
  --lui-emerald: #34d399;
  --lui-emerald-bg: rgba(16, 54, 46, 0.88);
  --lui-emerald-ink: #d1fae5;
  --lui-warn: #fbbf24;
  --lui-warn-bg: rgba(56, 38, 16, 0.84);
  --lui-warn-ink: #fef3c7;
  --lui-err: #fb7185;
  --lui-err-bg: rgba(62, 22, 34, 0.86);
  --lui-err-ink: #ffe4e6;
  --lui-code-bg: rgba(9, 15, 29, 0.72);
  --lui-quote-bg: rgba(25, 41, 72, 0.85);
  --lui-katex-bg: rgba(9, 16, 32, 0.56);
  --lui-option-bg: rgba(21, 35, 62, 0.92);
  --lui-option-hover-bg: rgba(28, 46, 80, 0.96);
  --lui-option-sel-bg: linear-gradient(135deg, rgba(40, 56, 88, 0.96) 0%, rgba(26, 44, 74, 0.98) 100%);
  --lui-option-diamond-bg: linear-gradient(135deg, #293e66 0%, #162440 100%);
  --lui-option-diamond-border: rgba(148, 163, 184, 0.55);
  --lui-option-diamond-ink: #e2e8f0;
  --lui-input-bg: rgba(11, 20, 38, 0.9);
  --lui-subtle-pill-bg: rgba(79, 209, 255, 0.12);
  --lui-subtle-pill-ink: #bae6fd;
  --lui-subtle-pill-border: rgba(79, 209, 255, 0.28);
  --lui-ref-bg: rgba(22, 37, 66, 0.86);
  --lui-ref-ink: #f2c97d;
  --lui-ref-border: rgba(242, 201, 125, 0.42);
  --lui-match-stroke: #f2c97d;
  --lui-match-node: #4fd1ff;
  --lui-ease: cubic-bezier(0.22, 1, 0.36, 1);

  position: relative;
  box-sizing: border-box;
  background: var(--lui-shell-bg);
  color: var(--lui-ink-primary);
  border: 1px solid rgba(242, 201, 125, 0.54);
  box-shadow:
    0 0 0 1px rgba(6, 11, 22, 0.88),
    inset 0 0 0 1px rgba(168, 121, 50, 0.22),
    inset 0 1px 0 rgba(255, 240, 196, 0.24),
    0 24px 64px rgba(3, 7, 18, 0.62);
  border-radius: 10px;
  font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.68;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.lui-paper-shell--parchment .lui-body {
  --lui-body-bg: linear-gradient(180deg, #eae4d6 0%, #e4ddcd 100%);
  --lui-card-bg: #f3eee2;
  --lui-card-elevated: #f8f4ea;
  --lui-scaffold-bg: linear-gradient(165deg, #f8f3e7 0%, #f1eadb 100%);
  --lui-scaffold-head-bg: linear-gradient(90deg, rgba(168, 121, 50, 0.14) 0%, rgba(14, 111, 140, 0.06) 100%);
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
  --lui-option-sel-bg: linear-gradient(135deg, #f6ead0 0%, #efe0be 100%);
  --lui-option-diamond-bg: linear-gradient(135deg, #ebe3d1 0%, #ddd2bc 100%);
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

.lui-corner-ornament {
  position: absolute;
  width: 14px;
  height: 14px;
  pointer-events: none;
  opacity: 0.92;
  z-index: 4;
}
.lui-corner-ornament--tl { top: 4px; left: 4px; }
.lui-corner-ornament--tr { top: 4px; right: 4px; transform: scaleX(-1); }
.lui-corner-ornament--bl { bottom: 4px; left: 4px; transform: scaleY(-1); }
.lui-corner-ornament--br { bottom: 4px; right: 4px; transform: scale(-1, -1); }

.lui-header {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 20px;
  background: var(--lui-header-bg);
  border-bottom: 1px solid rgba(242, 201, 125, 0.3);
  box-shadow: inset 0 -1px 0 rgba(79, 209, 255, 0.08);
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
  border-radius: 999px;
  background: rgba(141, 162, 192, 0.22);
  transition: background 240ms var(--lui-ease), box-shadow 240ms var(--lui-ease);
}

.lui-step-line--done {
  background: linear-gradient(90deg, #f2c97d 0%, #4fd1ff 100%);
  box-shadow: 0 0 8px rgba(79, 209, 255, 0.35);
}

.lui-step-line--active {
  background: linear-gradient(90deg, #f2c97d 0%, #4fd1ff 50%, #fff0c4 100%);
  background-size: 200% 100%;
  animation: lui-track-flow 2.4s linear infinite;
  box-shadow: 0 0 10px rgba(79, 209, 255, 0.45);
}

.lui-step-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 3px 5px;
  font-size: 12.5px;
  font-weight: 500;
  color: #8da2c0;
  letter-spacing: 0.03em;
  transition: color 200ms var(--lui-ease);
}

.lui-step-dot {
  width: 8px;
  height: 8px;
  border-radius: 1.5px;
  transform: rotate(45deg);
  box-sizing: border-box;
  border: 1.5px solid rgba(141, 162, 192, 0.48);
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
  text-shadow: 0 0 12px rgba(79, 209, 255, 0.35);
}

.lui-step-pill--active .lui-step-dot {
  border-color: #fff0c4;
  background: #4fd1ff;
  transform: rotate(45deg) scale(1.18);
  animation: lui-star-pulse 2.2s ease-in-out infinite;
}

.lui-step-pill--done {
  color: #e2e8f0;
}

.lui-step-pill--done .lui-step-dot {
  border-color: #fff0c4;
  background: #f2c97d;
  box-shadow: 0 0 8px rgba(242, 201, 125, 0.42);
}

.lui-clock-box {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 3px 11px 3px 6px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(16, 28, 52, 0.95) 0%, rgba(10, 18, 36, 0.98) 100%);
  color: #f8fafc;
  border: 1px solid rgba(79, 209, 255, 0.45);
  box-shadow:
    inset 0 1px 0 rgba(165, 243, 252, 0.16),
    0 0 12px rgba(79, 209, 255, 0.16);
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.lui-clock-box--urgent {
  border-color: rgba(251, 191, 36, 0.72);
  box-shadow:
    inset 0 1px 0 rgba(254, 243, 199, 0.22),
    0 0 14px rgba(251, 113, 133, 0.26);
}

.lui-clock-ring {
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  animation: lui-clock-pulse 2s ease-in-out infinite;
}

.lui-clock-time {
  color: #fff0c4;
  line-height: 1;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
}

.lui-clock-box--urgent .lui-clock-time {
  color: #fde68a;
}

.lui-theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 7px;
  border: 1px solid rgba(242, 201, 125, 0.42);
  background: linear-gradient(180deg, rgba(28, 44, 76, 0.92) 0%, rgba(15, 26, 48, 0.96) 100%);
  color: #f2c97d;
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
  border-color: #fff0c4;
  color: #fff0c4;
  box-shadow: 0 0 12px rgba(242, 201, 125, 0.28);
}

.lui-theme-toggle--parchment {
  background: linear-gradient(180deg, #f3e4be 0%, #dfc07b 100%);
  border-color: #fff0c4;
  color: #162136;
  box-shadow: 0 0 12px rgba(242, 201, 125, 0.36);
}

.lui-theme-toggle--parchment:hover {
  color: #0b1322;
  box-shadow: 0 0 16px rgba(242, 201, 125, 0.48);
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
  scrollbar-color: rgba(242, 201, 125, 0.38) transparent;
  transition: background 220ms var(--lui-ease), color 220ms var(--lui-ease);
}

.lui-body::-webkit-scrollbar {
  width: 6px;
}

.lui-body::-webkit-scrollbar-track {
  background: transparent;
}

.lui-body::-webkit-scrollbar-thumb {
  background: rgba(242, 201, 125, 0.34);
  border-radius: 999px;
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
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--lui-subtle-pill-ink, #bae6fd);
  background: var(--lui-subtle-pill-bg, rgba(79, 209, 255, 0.12));
  border: 1px solid var(--lui-subtle-pill-border, rgba(79, 209, 255, 0.28));
  font-variant-numeric: tabular-nums;
}

.lui-lock-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
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
  color: #cbd5e1;
  border: 1px solid rgba(141, 162, 192, 0.28);
  font-variant-numeric: tabular-nums;
}

.lui-badge--role {
  background: linear-gradient(135deg, rgba(242, 201, 125, 0.22) 0%, rgba(168, 121, 50, 0.14) 100%);
  color: #fff0c4;
  border-color: rgba(242, 201, 125, 0.5);
}

.lui-badge--locked {
  background: rgba(79, 209, 255, 0.14);
  color: #a5f3fc;
  border-color: rgba(79, 209, 255, 0.36);
}

.lui-badge--stars {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.28) 0%, rgba(180, 83, 9, 0.22) 100%);
  color: #fef08a;
  border-color: rgba(245, 158, 11, 0.58);
  letter-spacing: 0.06em;
  text-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
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
  background: linear-gradient(135deg, rgba(148, 163, 184, 0.24), rgba(71, 85, 105, 0.32));
  border-color: rgba(203, 213, 225, 0.52);
  color: #e2e8f0;
}

.lui-cost-badge--2 {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.26), rgba(6, 95, 70, 0.36));
  border-color: rgba(110, 231, 183, 0.54);
  color: #a7f3d0;
}

.lui-cost-badge--3 {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.28), rgba(29, 78, 216, 0.38));
  border-color: rgba(125, 211, 252, 0.58);
  color: #bae6fd;
}

.lui-cost-badge--4 {
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.28), rgba(107, 33, 168, 0.38));
  border-color: rgba(232, 121, 249, 0.54);
  color: #f3e8ff;
}

.lui-cost-badge--5 {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.34), rgba(146, 64, 14, 0.42));
  border-color: rgba(254, 240, 138, 0.68);
  color: #fef08a;
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.26);
}

.lui-material-drawer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lui-material-drawer:empty {
  display: none;
}

.lui-ref-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid var(--lui-ref-border, rgba(242, 201, 125, 0.42));
  background: var(--lui-ref-bg, rgba(22, 37, 66, 0.86));
  color: var(--lui-ref-ink, #f2c97d);
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
  border-color: var(--lui-gold-base, #f2c97d);
  box-shadow: 0 4px 12px rgba(7, 14, 28, 0.24);
}

.lui-ref-chevron {
  transition: transform 200ms var(--lui-ease);
}

.lui-ref-chevron--open {
  transform: rotate(180deg);
}

.lui-ref-btn--highlight {
  border-radius: 999px;
  padding: 4px 13px;
  border-color: var(--lui-gold-base, #f2c97d);
  background: linear-gradient(135deg, rgba(242, 201, 125, 0.2) 0%, rgba(168, 121, 50, 0.14) 100%);
  box-shadow: 0 0 12px rgba(242, 201, 125, 0.18);
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
  border-radius: 10px;
  border: 1px solid var(--lui-card-gold-border);
  background: var(--lui-scaffold-bg, var(--lui-card-elevated));
  box-shadow:
    inset 0 1px 0 rgba(255, 240, 196, 0.14),
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
  border-radius: 5px;
  border: 1px solid var(--lui-ref-border, rgba(242, 201, 125, 0.42));
  background: transparent;
  color: var(--lui-ref-ink, #f2c97d);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 160ms var(--lui-ease), border-color 160ms var(--lui-ease);
}

.lui-scaffold-collapse-btn:hover {
  border-color: var(--lui-gold-base);
  background: rgba(242, 201, 125, 0.12);
}

.lui-material-scaffold__body {
  padding: 16px 18px;
  max-height: min(560px, 60vh);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(242, 201, 125, 0.38) transparent;
}

.lui-material-scaffold__body::-webkit-scrollbar {
  width: 5px;
}

.lui-material-scaffold__body::-webkit-scrollbar-track {
  background: transparent;
}

.lui-material-scaffold__body::-webkit-scrollbar-thumb {
  background: rgba(242, 201, 125, 0.34);
  border-radius: 999px;
}

@media (max-width: 919px) {
  .lui-material-scaffold__body {
    max-height: 280px;
  }
}

.lui-material-scaffold__body .lui-md,
.lui-material-content .lui-md {
  font-size: 15px;
  line-height: 1.75;
}

.lui-material-content {
  padding: 15px 18px;
  border-radius: 8px;
  border: 1px solid var(--lui-card-gold-border);
  background: var(--lui-card-elevated);
  animation: lui-panel-reveal 200ms var(--lui-ease) both;
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
  transform: rotate(45deg);
  background: var(--lui-gold-base);
  box-shadow: 0 0 8px rgba(242, 201, 125, 0.45);
}

.lui-section-heading {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--lui-heading-ink);
  letter-spacing: 0.02em;
}

.lui-metal-divider {
  height: 1px;
  width: 100%;
  background: linear-gradient(90deg, rgba(242, 201, 125, 0.55) 0%, rgba(79, 209, 255, 0.28) 45%, transparent 100%);
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
  border-radius: 8px;
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
    inset 0 1px 0 rgba(165, 243, 252, 0.08),
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
  border-radius: 5px;
  display: inline-block;
  font-size: 13px;
  font-weight: 600;
  background: var(--lui-warn-bg);
  color: var(--lui-warn-ink);
  border: 1px solid rgba(251, 191, 36, 0.3);
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
  background: linear-gradient(90deg, transparent, var(--lui-card-gold-border), transparent);
}
.lui-md blockquote {
  margin: 0.6em 0;
  padding: 9px 14px;
  background: var(--lui-quote-bg);
  border-left: 3px solid var(--lui-gold-base);
  color: var(--lui-ink-primary);
  border-radius: 0 6px 6px 0;
}
.lui-md pre {
  margin: 0.6em 0;
  padding: 11px 14px;
  background: #0c1426;
  color: #f1f5f9;
  border: 1px solid rgba(141, 162, 192, 0.24);
  border-radius: 6px;
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
  border-radius: 6px;
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
  border-radius: 8px;
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
  box-shadow:
    0 0 0 1px rgba(242, 201, 125, 0.26),
    0 8px 18px rgba(4, 10, 22, 0.22);
}

.lui-option-btn--selected {
  transform: translateY(-1px);
  border-color: var(--lui-gold-base);
  background: var(--lui-option-sel-bg);
  animation: lui-option-breathe 2.8s ease-in-out infinite;
}

.lui-option-btn--correct {
  border-color: var(--lui-emerald);
  background: var(--lui-emerald-bg);
  color: var(--lui-emerald-ink);
  animation: lui-emerald-starlight 650ms var(--lui-ease) forwards;
}

.lui-option-btn--incorrect {
  border-color: var(--lui-err);
  background: var(--lui-err-bg);
  color: var(--lui-err-ink);
  animation: none;
  box-shadow: 0 0 0 1px rgba(251, 113, 133, 0.4);
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
  transform: rotate(45deg);
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
  background: linear-gradient(135deg, #fff0c4 0%, #f2c97d 52%, #b78535 100%);
  border-color: #fff6db;
  box-shadow: 0 0 10px rgba(242, 201, 125, 0.48);
  transform: rotate(45deg) scale(1.06);
}

.lui-option-btn--selected .lui-option-key {
  color: #111827;
}

.lui-option-btn--correct .lui-option-diamond-frame {
  background: linear-gradient(135deg, #a7f3d0 0%, #34d399 55%, #059669 100%);
  border-color: #ecfdf5;
  box-shadow: 0 0 14px rgba(52, 211, 153, 0.65);
}

.lui-option-btn--correct .lui-option-key {
  color: #06281c;
}

.lui-option-btn--incorrect .lui-option-diamond-frame {
  background: linear-gradient(135deg, #fecdd3 0%, #fb7185 55%, #be123c 100%);
  border-color: #fff1f2;
  box-shadow: 0 0 10px rgba(251, 113, 133, 0.45);
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
  border-radius: 7px;
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
  box-shadow: 0 0 0 1px var(--lui-azure), 0 0 12px rgba(79, 209, 255, 0.22);
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
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: linear-gradient(135deg, #f2c97d, #c6923f);
  color: #111827;
  font-variant-numeric: tabular-nums;
}

.lui-input-field {
  min-height: 44px;
  width: 100%;
  max-width: 420px;
  box-sizing: border-box;
  padding: 9px 14px;
  border-radius: 7px;
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
  box-shadow: 0 0 0 3px rgba(79, 209, 255, 0.2);
}

.lui-multistep-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.lui-multistep-row {
  padding: 12px 15px;
  border-radius: 8px;
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
  border-radius: 8px;
  background: var(--lui-warn-bg);
  border: 1px solid rgba(251, 191, 36, 0.36);
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
  border-radius: 8px;
  border: 1px solid rgba(52, 211, 153, 0.44);
  border-left: 3px solid var(--lui-emerald);
  background: var(--lui-emerald-bg);
  color: var(--lui-emerald-ink);
  box-shadow: 0 0 18px rgba(52, 211, 153, 0.14);
  animation: lui-panel-reveal 200ms var(--lui-ease) both;
}

.lui-feedback-box .lui-md,
.lui-feedback-box .lui-md strong {
  color: var(--lui-emerald-ink);
}

.lui-feedback-box--incorrect {
  border-color: rgba(251, 113, 133, 0.44);
  border-left-color: var(--lui-err);
  background: var(--lui-err-bg);
  color: var(--lui-err-ink);
  box-shadow: 0 0 16px rgba(251, 113, 133, 0.12);
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
  border-radius: 8px;
  background: var(--lui-emerald-bg);
  border: 1px solid rgba(52, 211, 153, 0.42);
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
  border-top: 1px solid rgba(242, 201, 125, 0.28);
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
  border-radius: 7px;
  font-size: 13.5px;
  font-weight: 700;
  letter-spacing: 0.03em;
  cursor: pointer;
  border: 1px solid rgba(141, 162, 192, 0.34);
  background: linear-gradient(180deg, rgba(28, 44, 76, 0.92) 0%, rgba(16, 27, 50, 0.96) 100%);
  color: #f1f5f9;
  transition:
    transform 150ms var(--lui-ease, cubic-bezier(0.22, 1, 0.36, 1)),
    background 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
}
.lui-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(242, 201, 125, 0.72);
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
  background: radial-gradient(circle at 50% 0%, #fff0c4 0%, #f2c97d 36%, #be8c3a 100%);
  color: #111827;
  border-color: #fff0c4;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.65),
    0 4px 16px rgba(242, 201, 125, 0.28);
}
.lui-btn--primary::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 45%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.42), transparent);
  animation: lui-cta-sheen 4.5s ease-in-out infinite;
  pointer-events: none;
}
.lui-btn--primary:hover:not(:disabled) {
  background: radial-gradient(circle at 50% 0%, #fff8df 0%, #f6d591 40%, #cb9843 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.78),
    0 6px 20px rgba(242, 201, 125, 0.42);
}
.lui-btn--ghost {
  background: rgba(21, 35, 62, 0.72);
  border-color: rgba(242, 201, 125, 0.38);
  color: #f2c97d;
}
.lui-btn--ghost:hover:not(:disabled) {
  background: rgba(242, 201, 125, 0.14);
  border-color: #f2c97d;
  color: #fff0c4;
}
.lui-btn--active-soft {
  background: rgba(242, 201, 125, 0.2);
  border-color: #f2c97d;
  color: #fff0c4;
}

.lui-lore-title {
  font-size: 17.5px;
  font-weight: 700;
  color: #fff0c4;
  letter-spacing: 0.05em;
}
.lui-lore-subtitle {
  font-size: 12.5px;
  color: #8da2c0;
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
  border-left: 1px solid rgba(242, 201, 125, 0.36);
  padding-left: 14px;
}
.lui-era-btn {
  position: relative;
  min-height: 44px;
  padding: 8px 12px;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  color: #cbd5e1;
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
  transform: translateY(-50%) rotate(45deg);
  width: 7px;
  height: 7px;
  border-radius: 1px;
  background: #0f1a30;
  border: 1.5px solid rgba(242, 201, 125, 0.56);
  transition: background-color 180ms var(--lui-ease), transform 180ms var(--lui-ease), box-shadow 180ms var(--lui-ease);
}
.lui-era-btn:hover {
  background: rgba(242, 201, 125, 0.08);
  color: #f8fafc;
}
.lui-era-btn--active {
  background: linear-gradient(135deg, rgba(28, 45, 78, 0.94) 0%, rgba(19, 32, 58, 0.96) 100%);
  color: #f8fafc;
  border-color: rgba(242, 201, 125, 0.52);
  box-shadow: inset 0 1px 0 rgba(255, 240, 196, 0.14);
}
.lui-era-btn--active::before {
  background: #4fd1ff;
  border-color: #fff0c4;
  transform: translateY(-50%) rotate(45deg) scale(1.22);
  box-shadow: 0 0 8px rgba(79, 209, 255, 0.65);
}
.lui-era-scale {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #f2c97d;
  font-variant-numeric: tabular-nums;
}
.lui-era-name {
  font-size: 13.5px;
  font-weight: 600;
}
.lui-era-heading {
  margin: 0 0 12px;
  font-size: 19px;
  color: #f8fafc;
  letter-spacing: 0.02em;
}

.lui-factions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(248px, 1fr));
  gap: 14px;
}
.lui-faction-card {
  padding: 15px 17px;
  border-radius: 8px;
  background: linear-gradient(160deg, rgba(27, 42, 74, 0.88) 0%, rgba(17, 27, 50, 0.94) 100%);
  border: 1px solid rgba(242, 201, 125, 0.32);
  box-shadow: inset 0 1px 0 rgba(255, 240, 196, 0.1);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lui-faction-title {
  font-size: 15.5px;
  font-weight: 700;
  color: #f8fafc;
  letter-spacing: 0.02em;
}
.lui-faction-motto {
  font-style: italic;
  color: #f2c97d;
  font-weight: 500;
  font-size: 13.5px;
  padding-left: 10px;
  border-left: 2px solid rgba(242, 201, 125, 0.52);
}
.lui-faction-summary {
  margin: 2px 0 4px;
  font-size: 13.5px;
  color: #cbd5e1;
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
  border-bottom: 1px solid rgba(242, 201, 125, 0.24);
  padding-bottom: 10px;
}

.lui-unit-name {
  font-size: 17px;
  font-weight: 700;
  color: #f8fafc;
  letter-spacing: 0.02em;
}
.lui-unit-silhouette {
  font-size: 13.5px;
  color: #cbd5e1;
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
  color: #f2c97d;
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
  border-radius: 6px;
  background: rgba(11, 20, 38, 0.72);
  border: 1px solid rgba(141, 162, 192, 0.22);
}
.lui-stat-label {
  font-size: 11px;
  color: #8da2c0;
  letter-spacing: 0.03em;
}
.lui-stat-value {
  font-size: 14px;
  font-weight: 700;
  color: #f8fafc;
  font-variant-numeric: tabular-nums;
}

.lui-voice-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.lui-voice-card {
  padding: 12px 15px;
  border-radius: 7px;
  background: linear-gradient(135deg, rgba(23, 37, 66, 0.94) 0%, rgba(16, 27, 50, 0.96) 100%);
  border: 1px solid rgba(141, 162, 192, 0.22);
  border-left: 3px solid #f2c97d;
}
.lui-voice-trigger {
  font-size: 11.5px;
  font-weight: 700;
  color: #f2c97d;
  margin-bottom: 4px;
  letter-spacing: 0.05em;
}
.lui-voice-text {
  font-size: 14.5px;
  color: #f1f5f9;
  line-height: 1.6;
}

.lui-recipe-tree {
  padding: 12px 14px;
  border-radius: 8px;
  background: linear-gradient(160deg, rgba(20, 33, 58, 0.95) 0%, rgba(12, 21, 40, 0.98) 100%);
  border: 1px solid rgba(242, 201, 125, 0.34);
  color: #f1f5f9;
  box-shadow: inset 0 1px 0 rgba(255, 240, 196, 0.1);
}
.lui-recipe-head {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #f2c97d;
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
  border-radius: 6px;
  border: 1px solid rgba(141, 162, 192, 0.3);
  background: rgba(16, 28, 52, 0.9);
  color: #e2e8f0;
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
  border-color: rgba(242, 201, 125, 0.72);
  color: #fff0c4;
}
.lui-recipe-chip--active {
  border-color: #f2c97d;
  background: linear-gradient(135deg, rgba(46, 62, 92, 0.96) 0%, rgba(28, 43, 72, 0.98) 100%);
  color: #fff0c4;
  box-shadow:
    0 0 0 1px rgba(242, 201, 125, 0.42),
    0 0 12px rgba(242, 201, 125, 0.18);
}
.lui-recipe-gem {
  color: #f2c97d;
  font-size: 10px;
}
.lui-recipe-formula-card {
  margin-top: 10px;
  padding: 12px 14px;
  border-radius: 7px;
  background: rgba(11, 20, 38, 0.82);
  border: 1px solid rgba(242, 201, 125, 0.32);
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
  color: #fff0c4;
}
.lui-recipe-formula-desc {
  font-size: 12.5px;
  margin: 5px 0 9px;
  color: #cbd5e1;
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
  color: #f2c97d;
}
.lui-recipe-comp {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 9px;
  border-radius: 5px;
  font-size: 12px;
  border: 1px solid rgba(141, 162, 192, 0.28);
  background: rgba(24, 38, 66, 0.9);
  color: #e2e8f0;
}
.lui-recipe-comp--owned {
  border-color: rgba(52, 211, 153, 0.62);
  background: rgba(16, 54, 46, 0.82);
  color: #d1fae5;
  font-weight: 600;
}
.lui-recipe-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  font-size: 10.5px;
  font-weight: 700;
  background: rgba(242, 201, 125, 0.18);
  border: 1px solid rgba(242, 201, 125, 0.45);
  color: #fff0c4;
}
.lui-owned-tag {
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(52, 211, 153, 0.22);
  border: 1px solid rgba(52, 211, 153, 0.42);
  color: #6ee7b7;
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
  border-radius: 8px;
  overflow: hidden;
  background: #0b1120;
  border: 1.5px solid var(--lui-item-accent, #f2c97d);
  box-shadow:
    0 2px 6px rgba(2, 6, 23, 0.65),
    inset 0 1px 0 rgba(255, 255, 255, 0.24),
    inset 0 -1px 0 rgba(0, 0, 0, 0.48);
}
.lui-item-icon::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  background: linear-gradient(155deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0) 42%);
}
.lui-item-icon--xs {
  width: 20px;
  height: 20px;
  border-radius: 5px;
  border-width: 1.25px;
}
.lui-item-icon--sm {
  width: 26px;
  height: 26px;
  border-radius: 6px;
}
.lui-item-icon--md {
  width: 38px;
  height: 38px;
  border-radius: 8px;
}
.lui-item-icon--lg {
  width: 44px;
  height: 44px;
  border-radius: 9px;
  border-width: 2px;
}
.lui-item-icon--component {
  border-color: var(--lui-item-accent, #f59e0b);
  box-shadow:
    0 2px 6px rgba(2, 6, 23, 0.6),
    0 0 8px color-mix(in srgb, var(--lui-item-accent, #f59e0b) 32%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.28);
}
.lui-item-icon--completed {
  border-color: #f0c975;
  box-shadow:
    0 2px 8px rgba(2, 6, 23, 0.7),
    0 0 10px rgba(242, 201, 125, 0.34),
    inset 0 0 0 1px rgba(255, 248, 220, 0.28);
}
.lui-item-icon--emblem {
  border-color: #d8a7f5;
  box-shadow:
    0 2px 8px rgba(2, 6, 23, 0.72),
    0 0 10px color-mix(in srgb, var(--lui-item-accent, #c084fc) 44%, transparent),
    inset 0 0 0 1px rgba(254, 240, 138, 0.36);
}
.lui-item-icon--flag {
  border-color: #fde047;
  box-shadow:
    0 2px 10px rgba(2, 6, 23, 0.75),
    0 0 12px rgba(253, 224, 71, 0.45),
    inset 0 0 0 1px rgba(255, 252, 230, 0.45);
}
.lui-item-icon--tool-remover {
  border-color: #38bdf8;
  box-shadow:
    0 2px 8px rgba(2, 6, 23, 0.68),
    0 0 10px rgba(56, 189, 248, 0.42),
    inset 0 0 0 1px rgba(224, 242, 254, 0.32);
}
.lui-item-icon--tool-reforger {
  border-color: #fb923c;
  box-shadow:
    0 2px 8px rgba(2, 6, 23, 0.68),
    0 0 10px rgba(249, 115, 22, 0.42),
    inset 0 0 0 1px rgba(254, 243, 199, 0.32);
}
.lui-item-icon--anvil-comp {
  border-color: #7dd3fc;
  box-shadow:
    0 2px 8px rgba(2, 6, 23, 0.68),
    0 0 9px rgba(125, 211, 252, 0.36);
}
.lui-item-icon--anvil-completed {
  border-color: #f5c451;
  box-shadow:
    0 2px 8px rgba(2, 6, 23, 0.72),
    0 0 11px rgba(245, 196, 81, 0.42);
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
  border-radius: 999px;
  background: rgba(7, 11, 22, 0.84);
  border: 0.75px solid rgba(254, 240, 138, 0.42);
  pointer-events: none;
}
.lui-item-icon__dot {
  display: block;
  width: 4.5px;
  height: 4.5px;
  border-radius: 999px;
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.85);
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
.lui-item-icon.lui-recipe-glyph {
  width: 20px;
  height: 20px;
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
  color: #fb923c;
}
.lui-stat-token--magic {
  color: #38bdf8;
}
.lui-stat-token--true {
  color: #f8fafc;
  text-shadow: 0 0 8px rgba(248, 250, 252, 0.42);
}
.lui-stat-token--shield {
  color: #93c5fd;
}
.lui-stat-token--hp {
  color: #34d399;
}
.lui-stat-token--as {
  color: #fde047;
}
.lui-stat-token--crit {
  color: #fb7185;
}
.lui-stat-token--armor {
  color: #f59e0b;
}
.lui-stat-token--mr {
  color: #c084fc;
}
.lui-stat-token--mana {
  color: #60a5fa;
}
.lui-stat-token--gold {
  color: #f2c97d;
}
.lui-paper-shell--parchment .lui-stat-token--phys {
  color: #c2410c;
}
.lui-paper-shell--parchment .lui-stat-token--magic {
  color: #0369a1;
}
.lui-paper-shell--parchment .lui-stat-token--true {
  color: #1e293b;
  text-shadow: none;
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
  background: linear-gradient(90deg, rgba(16, 29, 56, 0.96) 0%, rgba(24, 41, 74, 0.94) 50%, rgba(16, 29, 56, 0.96) 100%);
  border-bottom: 1px solid rgba(242, 201, 125, 0.24);
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
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(242, 201, 125, 0.24), rgba(168, 121, 50, 0.16));
  border: 1px solid rgba(242, 201, 125, 0.54);
  color: #fff0c4;
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.lui-arc-topic {
  font-size: 12.5px;
  font-weight: 700;
  color: #f1f5f9;
  max-width: 310px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lui-arc-tags {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.lui-arc-tag {
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(79, 209, 255, 0.12);
  border: 1px solid rgba(79, 209, 255, 0.3);
  color: #a5f3fc;
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
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.lui-arc-branch--remediate {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.24), rgba(180, 83, 9, 0.26));
  border: 1px solid rgba(251, 191, 36, 0.72);
  color: #fef3c7;
  box-shadow: 0 0 12px rgba(251, 191, 36, 0.24);
}
.lui-arc-branch--stretch {
  background: linear-gradient(135deg, rgba(255, 240, 196, 0.28), rgba(242, 201, 125, 0.22));
  border: 1px solid rgba(255, 232, 168, 0.86);
  color: #fff6d9;
  box-shadow: 0 0 14px rgba(242, 201, 125, 0.32);
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
  border-radius: 999px;
  background: rgba(141, 162, 192, 0.28);
}
.lui-arc-connector--done {
  background: linear-gradient(90deg, #34d399, #f2c97d);
}
.lui-arc-node {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 999px;
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
  color: #a7f3d0;
  background: rgba(16, 185, 129, 0.14);
  border-color: rgba(52, 211, 153, 0.38);
}
.lui-arc-node--done .lui-arc-node-dot {
  background: #34d399;
  box-shadow: 0 0 6px rgba(52, 211, 153, 0.7);
}
.lui-arc-node--active {
  color: #fff6d9;
  font-weight: 800;
  background: rgba(242, 201, 125, 0.18);
  border-color: rgba(242, 201, 125, 0.65);
  box-shadow: 0 0 10px rgba(242, 201, 125, 0.22);
}
.lui-arc-node--active .lui-arc-node-dot {
  background: #f2c97d;
  box-shadow: 0 0 8px rgba(255, 240, 196, 0.9);
}
.lui-arc-node--upcoming {
  color: #8da2c0;
  background: rgba(15, 26, 48, 0.6);
  border-color: rgba(141, 162, 192, 0.2);
}
.lui-arc-node--upcoming .lui-arc-node-dot {
  background: rgba(141, 162, 192, 0.5);
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
