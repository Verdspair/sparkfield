export const LEARNING_UI_STYLE_ID = 'pkg-learning-ui-styles';

export const LEARNING_UI_CSS = `
@keyframes lui-step-enter {
  from {
    opacity: 0;
    transform: translateY(7px);
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
  --lui-paper-bg: #F6F4EE;
  --lui-paper-elevated: #FCFBF7;
  --lui-paper-muted-bg: #ECE9DF;
  --lui-ink-primary: #1C2129;
  --lui-ink-secondary: #4A5362;
  --lui-ink-muted: #768091;
  --lui-gold-light: #F0DCAA;
  --lui-gold-base: #C8AA6E;
  --lui-gold-dark: #7A6136;
  --lui-cyan-accent: #1E7A8C;
  --lui-ok: #1F7A4F;
  --lui-ok-bg: #EBF5EF;
  --lui-warn: #9A5618;
  --lui-warn-bg: #FAF2E6;
  --lui-err: #AD383E;
  --lui-err-bg: #FAEDEE;
  --lui-ease: cubic-bezier(0.22, 1, 0.36, 1);

  position: relative;
  box-sizing: border-box;
  background: var(--lui-paper-bg);
  color: var(--lui-ink-primary);
  border: 1px solid rgba(200, 170, 110, 0.62);
  box-shadow:
    0 0 0 1px rgba(110, 88, 50, 0.28),
    inset 0 1px 0 rgba(255, 253, 247, 0.85),
    0 22px 56px rgba(8, 11, 18, 0.38);
  border-radius: 8px;
  font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.68;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.lui-paper-shell--overlay {
  width: min(74vw, 1160px);
  height: min(76vh, 840px);
  margin: auto;
}

.lui-paper-shell--standalone {
  width: 100%;
  min-height: 500px;
}

.lui-paper-shell--sandbox {
  width: 100%;
  min-height: 440px;
}

.lui-paper-shell--compact {
  width: 100%;
}

.lui-corner-ornament {
  position: absolute;
  width: 11px;
  height: 11px;
  pointer-events: none;
  opacity: 0.65;
  z-index: 3;
}
.lui-corner-ornament--tl { top: 5px; left: 5px; }
.lui-corner-ornament--tr { top: 5px; right: 5px; transform: scaleX(-1); }
.lui-corner-ornament--bl { bottom: 5px; left: 5px; transform: scaleY(-1); }
.lui-corner-ornament--br { bottom: 5px; right: 5px; transform: scale(-1, -1); }

.lui-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 13px 24px;
  background: linear-gradient(180deg, #F2EFE6 0%, #EAE6DA 100%);
  border-bottom: 1px solid rgba(200, 170, 110, 0.42);
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
  width: 22px;
  height: 1px;
  margin: 0 8px;
  background: rgba(140, 115, 68, 0.26);
  transition: background-color 220ms var(--lui-ease);
}

.lui-step-line--done {
  background: rgba(156, 123, 62, 0.72);
}

.lui-step-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 3px 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--lui-ink-muted);
  letter-spacing: 0.02em;
  transition: color 200ms var(--lui-ease);
}

.lui-step-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-sizing: border-box;
  border: 1.5px solid rgba(118, 128, 145, 0.45);
  background: transparent;
  transition:
    transform 220ms var(--lui-ease),
    background-color 220ms var(--lui-ease),
    border-color 220ms var(--lui-ease),
    box-shadow 220ms var(--lui-ease);
}

.lui-step-pill--active {
  color: var(--lui-ink-primary);
  font-weight: 700;
}

.lui-step-pill--active .lui-step-dot {
  border-color: #9A783B;
  background: #C8AA6E;
  box-shadow: 0 0 0 3px rgba(200, 170, 110, 0.26);
  transform: scale(1.12);
}

.lui-step-pill--done {
  color: var(--lui-ink-secondary);
}

.lui-step-pill--done .lui-step-dot {
  border-color: #9A783B;
  background: #B89758;
}

.lui-clock-box {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  background: #1E242E;
  color: #F2E3BE;
  border: 1px solid rgba(200, 170, 110, 0.65);
  font-variant-numeric: tabular-nums;
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.lui-clock-time {
  color: #F2E3BE;
  line-height: 1;
}

.lui-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.lui-stage-anim {
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: lui-step-enter 220ms var(--lui-ease) both;
}

.lui-utility-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 28px;
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
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--lui-ink-secondary);
  background: rgba(27, 32, 40, 0.06);
}

.lui-lock-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  color: rgba(110, 88, 50, 0.36);
}

.lui-badge-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.lui-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 9px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  background: var(--lui-paper-muted-bg);
  color: var(--lui-ink-secondary);
  border: 1px solid rgba(27, 32, 40, 0.1);
}

.lui-badge--role {
  background: #EFE9DA;
  color: #5C441B;
  border-color: rgba(180, 146, 86, 0.38);
}

.lui-badge--locked {
  background: #F4ECE1;
  color: #7C4D12;
  border-color: rgba(168, 91, 20, 0.28);
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
  border-radius: 999px;
  border: 1px solid rgba(180, 146, 86, 0.48);
  background: rgba(252, 251, 247, 0.9);
  color: #5A4520;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 180ms var(--lui-ease),
    border-color 180ms var(--lui-ease),
    transform 180ms var(--lui-ease);
}

.lui-ref-btn:hover {
  background: #F7F0DF;
  border-color: #9A783B;
}

.lui-ref-chevron {
  transition: transform 200ms var(--lui-ease);
}

.lui-ref-chevron--open {
  transform: rotate(180deg);
}

.lui-material-content {
  padding: 14px 18px;
  border-radius: 6px;
  border: 1px solid rgba(200, 170, 110, 0.45);
  background: #F9F6EE;
  animation: lui-panel-reveal 200ms var(--lui-ease) both;
}

.lui-section-heading {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--lui-ink-secondary);
  letter-spacing: 0.02em;
}

.lui-stem-card {
  padding: 20px 24px;
  background: var(--lui-paper-elevated);
  border: 1px solid rgba(27, 32, 40, 0.09);
  border-left: 3px solid var(--lui-gold-base);
  border-radius: 6px;
  box-shadow: 0 2px 10px rgba(20, 24, 32, 0.03);
}

.lui-md {
  color: var(--lui-ink-primary);
  font-size: 16px;
  line-height: 1.74;
  word-break: break-word;
}
.lui-md--inline {
  display: inline;
}
.lui-md h1, .lui-md h2, .lui-md h3, .lui-md h4 {
  margin: 0.55em 0 0.35em;
  color: #13171E;
  font-weight: 700;
  line-height: 1.38;
}
.lui-md h1 { font-size: 1.32em; }
.lui-md h2 { font-size: 1.18em; }
.lui-md h3 { font-size: 1.06em; }
.lui-md p { margin: 0.45em 0; }
.lui-md p:first-child { margin-top: 0; }
.lui-md p:last-child { margin-bottom: 0; }
.lui-md ul, .lui-md ol { margin: 0.45em 0; padding-left: 1.45em; }
.lui-md li { margin: 0.22em 0; }
.lui-md blockquote {
  margin: 0.65em 0;
  padding: 10px 14px;
  background: #EFECE3;
  border-left: 3px solid #9A783B;
  color: #262E3A;
  border-radius: 0 5px 5px 0;
}
.lui-md pre {
  margin: 0.65em 0;
  padding: 12px 14px;
  background: #1E2430;
  color: #F3F4F6;
  border-radius: 5px;
  overflow-x: auto;
  font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
  font-size: 13.5px;
}
.lui-md code {
  padding: 1px 5px;
  background: rgba(27, 32, 40, 0.08);
  border-radius: 3px;
  font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
  font-size: 0.91em;
}
.lui-md pre code {
  padding: 0;
  background: transparent;
  color: inherit;
}
.lui-md table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.65em 0;
  font-size: 14px;
}
.lui-md th, .lui-md td {
  border: 1px solid rgba(27, 32, 40, 0.16);
  padding: 6px 10px;
  text-align: left;
}
.lui-md th {
  background: #EAE7DD;
  font-weight: 700;
}
.lui-katex-block {
  margin: 0.7em 0;
  padding: 8px 12px;
  overflow-x: auto;
  text-align: center;
  background: rgba(255, 255, 255, 0.65);
  border-radius: 5px;
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
  gap: 12px;
}

.lui-option-btn {
  min-height: 52px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 6px;
  background: #FFFFFF;
  color: var(--lui-ink-primary);
  border: 1px solid rgba(27, 32, 40, 0.16);
  font-size: 15px;
  text-align: left;
  cursor: pointer;
  transition:
    transform 180ms var(--lui-ease),
    border-color 180ms var(--lui-ease),
    background-color 180ms ease,
    box-shadow 180ms var(--lui-ease);
}
.lui-option-btn:hover:not(:disabled) {
  transform: translateY(-1.5px);
  border-color: #B49356;
  background: #FDFBF6;
  box-shadow: 0 6px 16px rgba(110, 88, 50, 0.08);
}
.lui-option-btn--selected {
  transform: translateY(-1px);
  border-color: #967438;
  background: #F9F2DF;
  box-shadow:
    0 0 0 1px rgba(200, 170, 110, 0.62),
    0 6px 16px rgba(110, 88, 50, 0.1);
}
.lui-option-btn:disabled {
  cursor: default;
  opacity: 0.88;
}
.lui-option-key {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  font-weight: 700;
  font-size: 12.5px;
  background: #EFECE4;
  color: #2B323E;
  border: 1px solid rgba(27, 32, 40, 0.14);
  transition:
    background-color 180ms var(--lui-ease),
    color 180ms var(--lui-ease),
    border-color 180ms var(--lui-ease);
}
.lui-option-btn--selected .lui-option-key {
  background: #1F2530;
  color: #F0DCAA;
  border-color: #C8AA6E;
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
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 14px;
  border-radius: 6px;
  background: #FFFFFF;
  color: var(--lui-ink-primary);
  border: 1px solid rgba(27, 32, 40, 0.16);
  font-size: 14.5px;
  cursor: pointer;
  text-align: left;
  transition:
    transform 180ms var(--lui-ease),
    border-color 180ms var(--lui-ease),
    background-color 180ms ease;
}
.lui-matching-item:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: #B49356;
}
.lui-matching-item--active {
  border-color: var(--lui-cyan-accent);
  background: #EBF5F8;
  box-shadow: 0 0 0 1px var(--lui-cyan-accent);
}
.lui-matching-item--paired {
  border-color: #967438;
  background: #F8F2E2;
}
.lui-matching-svg {
  width: 100%;
  height: 100%;
  min-height: 140px;
}
.lui-pair-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: #1F2530;
  color: #F0DCAA;
}

.lui-input-field {
  min-height: 46px;
  width: 100%;
  max-width: 420px;
  box-sizing: border-box;
  padding: 10px 14px;
  border-radius: 6px;
  border: 1px solid rgba(27, 32, 40, 0.24);
  background: #FFFFFF;
  color: var(--lui-ink-primary);
  font-size: 15.5px;
  font-family: inherit;
  transition: border-color 180ms var(--lui-ease), box-shadow 180ms var(--lui-ease);
}
.lui-input-field:focus {
  outline: none;
  border-color: #967438;
  box-shadow: 0 0 0 3px rgba(200, 170, 110, 0.22);
}

.lui-multistep-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.lui-multistep-row {
  padding: 14px 16px;
  border-radius: 6px;
  background: #FCFBF7;
  border: 1px solid rgba(27, 32, 40, 0.11);
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
}

.lui-hint-box {
  padding: 12px 16px;
  border-radius: 6px;
  background: var(--lui-warn-bg);
  border: 1px solid rgba(154, 86, 24, 0.28);
  color: #5C340B;
  animation: lui-panel-reveal 180ms var(--lui-ease) both;
}
.lui-feedback-box {
  padding: 14px 18px;
  border-radius: 6px;
  border: 1px solid rgba(31, 122, 79, 0.32);
  background: var(--lui-ok-bg);
  color: #153E2A;
  animation: lui-panel-reveal 200ms var(--lui-ease) both;
}
.lui-feedback-box--incorrect {
  border-color: rgba(173, 56, 62, 0.34);
  background: var(--lui-err-bg);
  color: #591B1F;
}
.lui-wait-banner {
  padding: 12px 18px;
  border-radius: 6px;
  background: #EEF4F0;
  border: 1px solid rgba(42, 123, 83, 0.3);
  color: #1D4530;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
}

.lui-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 24px;
  background: #EFECE2;
  border-top: 1px solid rgba(200, 170, 110, 0.42);
}

.lui-btn-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.lui-btn {
  min-height: 40px;
  padding: 7px 18px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid rgba(27, 32, 40, 0.2);
  background: #FFFFFF;
  color: var(--lui-ink-primary);
  transition:
    transform 160ms var(--lui-ease),
    background-color 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;
}
.lui-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: #9A783B;
}
.lui-btn:active:not(:disabled) {
  transform: translateY(0);
}
.lui-btn:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}
.lui-btn--primary {
  background: linear-gradient(180deg, #27303F 0%, #181E28 100%);
  color: #F4E5C2;
  border-color: #C8AA6E;
  box-shadow: inset 0 1px 0 rgba(240, 220, 170, 0.28), 0 4px 12px rgba(18, 22, 30, 0.16);
}
.lui-btn--primary:hover:not(:disabled) {
  background: linear-gradient(180deg, #2E394B 0%, #1D2430 100%);
}
.lui-btn--ghost {
  background: transparent;
  border-color: rgba(110, 88, 50, 0.34);
  color: #4E3E20;
}
.lui-btn--ghost:hover:not(:disabled) {
  background: rgba(200, 170, 110, 0.12);
}
.lui-btn--active-soft {
  background: rgba(200, 170, 110, 0.2);
  border-color: #9A783B;
}

.lui-lore-layout {
  display: grid;
  grid-template-columns: 248px 1fr;
  gap: 24px;
  min-height: 460px;
}
@media (max-width: 860px) {
  .lui-lore-layout {
    grid-template-columns: 1fr;
  }
}
.lui-era-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-left: 1px solid rgba(180, 146, 86, 0.42);
  padding-left: 14px;
}
.lui-era-btn {
  position: relative;
  min-height: 46px;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--lui-ink-secondary);
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
  border-radius: 50%;
  background: var(--lui-paper-bg);
  border: 1.5px solid rgba(154, 120, 59, 0.55);
  transition: background-color 180ms var(--lui-ease), transform 180ms var(--lui-ease);
}
.lui-era-btn:hover {
  background: rgba(200, 170, 110, 0.1);
  color: var(--lui-ink-primary);
}
.lui-era-btn--active {
  background: #F6EFE0;
  color: var(--lui-ink-primary);
  border-color: rgba(200, 170, 110, 0.62);
}
.lui-era-btn--active::before {
  background: #C8AA6E;
  border-color: #8C6B2F;
  transform: translateY(-50%) scale(1.2);
}
.lui-era-scale {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: #8C6B2F;
}
.lui-factions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 14px;
}
.lui-faction-card {
  padding: 16px 18px;
  border-radius: 6px;
  background: #FCFBF7;
  border: 1px solid rgba(200, 170, 110, 0.45);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lui-faction-motto {
  font-style: italic;
  color: #6B4F1D;
  font-weight: 500;
  font-size: 13.5px;
}
.lui-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  border-bottom: 1px solid rgba(200, 170, 110, 0.36);
  padding-bottom: 10px;
}
.lui-voice-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.lui-voice-card {
  padding: 12px 16px;
  border-radius: 6px;
  background: #FCFBF7;
  border: 1px solid rgba(27, 32, 40, 0.09);
  border-left: 3px solid #C8AA6E;
}
.lui-recipe-head {
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #5C441B;
  margin-bottom: 8px;
}
.lui-recipe-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.lui-recipe-chip {
  min-height: 36px;
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid rgba(140, 110, 58, 0.36);
  background: #FCFBF7;
  color: var(--lui-ink-primary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  transition:
    border-color 160ms var(--lui-ease),
    background-color 160ms var(--lui-ease),
    transform 160ms var(--lui-ease);
}
.lui-recipe-chip:hover {
  transform: translateY(-1px);
  border-color: #9A783B;
}
.lui-recipe-chip--active {
  border-color: #B49150;
  background: #F7EFE0;
  box-shadow: 0 0 0 1px rgba(200, 170, 110, 0.55);
}
.lui-recipe-formula-card {
  margin-top: 10px;
  padding: 12px 14px;
  border-radius: 6px;
  background: #FCFBF7;
  border: 1px solid rgba(200, 170, 110, 0.42);
  animation: lui-panel-reveal 180ms var(--lui-ease) both;
}
.lui-recipe-comp {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 5px;
  font-size: 12.5px;
  border: 1px solid rgba(27, 32, 40, 0.16);
  background: #FFFFFF;
}
.lui-recipe-comp--owned {
  border-color: #B89655;
  background: #F9F0DA;
  font-weight: 600;
}
.lui-owned-tag {
  font-size: 10.5px;
  padding: 1px 5px;
  border-radius: 999px;
  background: rgba(184, 150, 85, 0.24);
  color: #5C4318;
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
