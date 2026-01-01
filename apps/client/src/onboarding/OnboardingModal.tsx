import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SEASON1_UNITS_BY_ID,
  lookupItemById,
  type CoursePackManifest,
  type SubjectId,
} from '@pkg/contracts';
import { previewItemEquip } from '@pkg/game-core';
import { QuestionStepCard, type QuestionAnswerSubmission } from '@pkg/learning-ui';
import { ApiClientError, httpClient } from '../api/httpClient.js';
import type { BattleBroadcastPayload, MatchRoomSnapshot } from '../api/matchSocket.js';
import { STARTER_COURSE_PACKS } from '../content/starterPacks.js';
import {
  OnboardingMicroController,
  type OnboardingMicroProgress,
} from '../offline/offlinePracticeController.js';
import { LiveBattleChoreographer, SnapshotStageSynchronizer } from '../hud/stageSync.js';
import { useAppStore } from '../store/appStore.js';

const ONBOARDING_MINIMAL_CSS = `
@keyframes ob-panel-enter {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.99);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes ob-slide-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes ob-pulse-ring {
  0% {
    transform: translate(-50%, -50%) scale(0.86);
    opacity: 0.92;
  }
  70% {
    transform: translate(-50%, -50%) scale(1.36);
    opacity: 0;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.36);
    opacity: 0;
  }
}

@keyframes ob-cue-bob {
  0%, 100% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(-4px);
  }
}

@keyframes ob-dash-flow {
  to {
    stroke-dashoffset: -28;
  }
}

@keyframes ob-soft-breathe {
  0%, 100% {
    opacity: 0.72;
  }
  50% {
    opacity: 1;
  }
}

.ob-minimal-panel {
  width: min(940px, 94vw);
  max-height: 88vh;
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  overflow-y: auto;
  animation: ob-panel-enter 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.ob-stage-anim {
  display: flex;
  flex-direction: column;
  gap: 20px;
  animation: ob-slide-enter 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.ob-header-center {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
}

.ob-header-center h2 {
  margin: 0;
  font-size: clamp(20px, 1.5vw, 24px);
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--gold-light);
}

.ob-header-close {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
}

.ob-choices-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 860px) {
  .ob-choices-grid {
    grid-template-columns: 1fr;
  }
}

.ob-choice-card {
  position: relative;
  padding: 26px 22px 22px;
  border-radius: 8px;
  background: rgba(16, 21, 31, 0.78);
  border: 1px solid rgba(200, 170, 110, 0.28);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  transition:
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color 220ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 220ms ease;
}

.ob-choice-card:hover {
  transform: translateY(-4px);
  border-color: rgba(240, 220, 170, 0.72);
  background: rgba(22, 29, 43, 0.88);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.42), 0 0 22px rgba(200, 170, 110, 0.14);
}

.ob-choice-card--featured {
  border-color: rgba(240, 220, 170, 0.62);
  background: linear-gradient(180deg, rgba(28, 36, 52, 0.9) 0%, rgba(16, 21, 31, 0.86) 100%);
  box-shadow: inset 0 1px 0 rgba(240, 220, 170, 0.22), 0 10px 28px rgba(0, 0, 0, 0.34);
}

.ob-choice-icon {
  width: 68px;
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(200, 170, 110, 0.16) 0%, rgba(200, 170, 110, 0.02) 72%);
  border: 1px solid rgba(200, 170, 110, 0.32);
}

.ob-choice-title {
  margin: 2px 0 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--gold-light);
}

.ob-choice-sub {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--text-secondary);
  letter-spacing: 0.02em;
}

.ob-cards-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ob-step-counter {
  font-family: var(--font-mono);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--gold-base);
  letter-spacing: 0.08em;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid rgba(200, 170, 110, 0.34);
  background: rgba(12, 16, 24, 0.65);
}

.ob-diagram-stage {
  padding: 26px 24px 20px;
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(14, 18, 28, 0.86) 0%, rgba(19, 25, 38, 0.78) 100%);
  border: 1px solid rgba(200, 170, 110, 0.32);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.ob-diagram-title {
  margin: 0;
  font-size: clamp(18px, 1.35vw, 22px);
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--gold-light);
  text-align: center;
}

.ob-diagram-svg {
  width: 100%;
  max-width: 720px;
  height: auto;
  overflow: visible;
}

.ob-flow-line {
  stroke-dasharray: 6 8;
  animation: ob-dash-flow 1.4s linear infinite;
}

.ob-breathe {
  animation: ob-soft-breathe 2.4s ease-in-out infinite;
}

.ob-dots-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.ob-dot-btn {
  width: 24px;
  height: 6px;
  padding: 0;
  border-radius: 999px;
  border: none;
  background: rgba(200, 170, 110, 0.26);
  cursor: pointer;
  transition: width 200ms cubic-bezier(0.22, 1, 0.36, 1), background-color 200ms ease;
}

.ob-dot-btn--active {
  width: 38px;
  background: var(--gold-light);
}

.ob-start-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 860px) {
  .ob-start-cols {
    grid-template-columns: 1fr;
  }
}

.ob-subject-card {
  padding: 18px 20px;
  border-radius: 8px;
  background: rgba(15, 20, 30, 0.76);
  border: 1px solid rgba(200, 170, 110, 0.28);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ob-subject-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(200, 170, 110, 0.2);
}

.ob-subject-head h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--gold-light);
}

.ob-chapter-option {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 11px 14px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  background: rgba(11, 14, 21, 0.52);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  transition:
    border-color 180ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 180ms ease,
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.ob-chapter-option:hover {
  border-color: rgba(200, 170, 110, 0.5);
  transform: translateX(2px);
}

.ob-chapter-option--selected {
  border-color: var(--gold-light);
  background: rgba(200, 170, 110, 0.16);
  font-weight: 600;
}

.ob-chapter-option input {
  accent-color: #C8AA6E;
  margin: 0;
}

.ob-micro-topbar {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  width: min(680px, 94vw);
  padding: 7px 16px;
  z-index: 65;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border-radius: 999px;
  background: rgba(14, 18, 27, 0.84);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(200, 170, 110, 0.48);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
}

.ob-micro-title {
  font-size: 13.5px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--gold-light);
}

.ob-progress-dots {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.ob-pdot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid rgba(200, 170, 110, 0.45);
  background: transparent;
  transition: all 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.ob-pdot--done {
  background: #C8AA6E;
  border-color: #C8AA6E;
}

.ob-pdot--active {
  background: #F0DCAA;
  border-color: #F0DCAA;
  box-shadow: 0 0 0 4px rgba(240, 220, 170, 0.24);
  transform: scale(1.15);
}

.ob-goal-banner {
  position: absolute;
  top: 66px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 44;
  padding: 12px 20px;
  border-radius: 999px;
  background: rgba(15, 20, 30, 0.78);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(240, 220, 170, 0.55);
  box-shadow: 0 16px 38px rgba(0, 0, 0, 0.48);
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  justify-content: center;
  animation: ob-panel-enter 240ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.ob-goal-steps {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
}

.ob-goal-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(200, 170, 110, 0.14);
  border: 1px solid rgba(200, 170, 110, 0.32);
  color: var(--gold-light);
}

.ob-goal-arrow {
  color: rgba(200, 170, 110, 0.65);
  font-size: 12px;
}

.ob-hud-dock {
  position: absolute;
  top: 66px;
  left: 16px;
  z-index: 38;
  width: min(244px, 44vw);
  padding: 12px 14px;
  border-radius: 8px;
  background: rgba(14, 19, 28, 0.84);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(200, 170, 110, 0.45);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ob-mini-checks {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.ob-mini-check {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 5px 6px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.ob-mini-check--done {
  color: #34D399;
  border-color: rgba(52, 211, 153, 0.42);
  background: rgba(16, 185, 129, 0.12);
}

.ob-equip-rack {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ob-equip-chip {
  width: 100%;
  min-height: 36px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid rgba(200, 170, 110, 0.48);
  background: rgba(22, 29, 43, 0.88);
  color: var(--gold-light);
  font-size: 12.5px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  cursor: pointer;
  transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1), border-color 160ms ease;
}

.ob-equip-chip:hover {
  transform: translateY(-1px);
  border-color: #F0DCAA;
}

.ob-equip-chip--selected {
  background: rgba(200, 170, 110, 0.28);
  border-color: #F0DCAA;
}

.ob-spotlight-anchor {
  position: relative;
}

.ob-float-cue {
  position: absolute;
  bottom: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  padding: 5px 12px;
  border-radius: 999px;
  background: linear-gradient(180deg, #F5E5BD 0%, #D4B475 100%);
  color: #171208;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.03em;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.5), 0 0 16px rgba(240, 220, 170, 0.45);
  pointer-events: none;
  z-index: 48;
  animation: ob-cue-bob 1.6s ease-in-out infinite;
}

.ob-float-cue::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-width: 5px 5px 0 5px;
  border-style: solid;
  border-color: #D4B475 transparent transparent transparent;
}

.ob-pulse-beacon {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 14px;
  height: 14px;
  pointer-events: none;
  z-index: 46;
}

.ob-pulse-beacon__core {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 8px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: #FDE68A;
  box-shadow: 0 0 8px #F0DCAA;
}

.ob-pulse-beacon__wave {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1.5px solid #F0DCAA;
  animation: ob-pulse-ring 1.6s cubic-bezier(0.22, 1, 0.36, 1) infinite;
}

.ob-summary-card {
  width: min(380px, 90vw);
  padding: 26px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
  animation: ob-panel-enter 240ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
`;

const FOUR_GUIDE_CARDS = [
  {
    step: '1 / 4',
    title: '答题蓄能，化作整金法球',
  },
  {
    step: '2 / 4',
    title: '三张同卡，自动聚拢升星',
  },
  {
    step: '3 / 4',
    title: '两件散件，拖放直合成装',
  },
  {
    step: '4 / 4',
    title: '布阵交锋，累计胜点争先',
  },
] as const;

function formatCompactClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = String(s % 60).padStart(2, '0');
  return `${m}:${rem}`;
}

function shortItemName(rawName: string): string {
  if (rawName.includes('钨芯刃')) return '钨芯刃';
  if (rawName.includes('加速轨')) return '加速轨';
  return rawName;
}

function SpotlightCue({ label }: { readonly label: string }): React.JSX.Element {
  return (
    <>
      <span className="ob-float-cue" aria-hidden="true">
        {label}
      </span>
      <span className="ob-pulse-beacon" aria-hidden="true">
        <span className="ob-pulse-beacon__wave" />
        <span className="ob-pulse-beacon__core" />
      </span>
    </>
  );
}

function ChoiceIconCardsSvg(): React.JSX.Element {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <rect x="5" y="7" width="16" height="20" rx="2.5" stroke="#C8AA6E" strokeWidth="1.4" />
      <path d="M9 13H17M9 17H15" stroke="#F0DCAA" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="26" cy="20" r="6.5" stroke="#5CC8D6" strokeWidth="1.4" />
      <circle cx="26" cy="20" r="2.6" fill="#F0DCAA" />
      <path d="M21 15L24 17.5" stroke="#C8AA6E" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ChoiceIconMicroSvg(): React.JSX.Element {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <polygon
        points="18,5 29,11.5 29,24.5 18,31 7,24.5 7,11.5"
        stroke="#F0DCAA"
        strokeWidth="1.5"
        fill="rgba(200,170,110,0.1)"
      />
      <polygon
        points="18,11 23.5,14.2 23.5,20.8 18,24 12.5,20.8 12.5,14.2"
        stroke="#5CC8D6"
        strokeWidth="1.2"
      />
      <circle cx="18" cy="17.5" r="2.5" fill="#F0DCAA" />
    </svg>
  );
}

function ChoiceIconSkipSvg(): React.JSX.Element {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <circle cx="18" cy="18" r="12" stroke="rgba(200,170,110,0.55)" strokeWidth="1.3" />
      <path
        d="M13 13L19 18L13 23M20 13L26 18L20 23"
        stroke="#F0DCAA"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GuideSlideDiagram({ index }: { readonly index: number }): React.JSX.Element {
  if (index === 0) {
    return (
      <svg className="ob-diagram-svg" viewBox="0 0 720 220" fill="none" role="img" aria-label="答题蓄能化作整金法球">
        <g transform="translate(56, 34)">
          <rect x="0" y="0" width="144" height="128" rx="8" fill="#171E2C" stroke="#C8AA6E" strokeWidth="1.6" />
          <rect x="18" y="22" width="22" height="22" rx="4" fill="rgba(92,200,214,0.16)" stroke="#5CC8D6" strokeWidth="1.3" />
          <path d="M24 33L28 37L35 28" stroke="#F0DCAA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="50" y1="28" x2="122" y2="28" stroke="#F0DCAA" strokeWidth="2" strokeLinecap="round" />
          <line x1="50" y1="39" x2="102" y2="39" stroke="rgba(200,170,110,0.55)" strokeWidth="1.6" strokeLinecap="round" />
          <rect x="18" y="60" width="108" height="20" rx="4" fill="rgba(240,220,170,0.12)" stroke="rgba(240,220,170,0.45)" strokeWidth="1.1" />
          <rect x="18" y="88" width="108" height="20" rx="4" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
          <text x="72" y="154" textAnchor="middle" fill="#D5DCE8" fontSize="13.5" fontWeight="600">答题卡</text>
        </g>

        <line x1="220" y1="98" x2="314" y2="98" stroke="#C8AA6E" strokeWidth="2" className="ob-flow-line" />
        <polygon points="322,98 310,92 310,104" fill="#F0DCAA" />

        <g transform="translate(348, 30)">
          <circle cx="68" cy="68" r="54" stroke="rgba(240,220,170,0.28)" strokeWidth="1.3" strokeDasharray="4 5" />
          <circle cx="68" cy="68" r="40" fill="rgba(200,170,110,0.18)" stroke="#F0DCAA" strokeWidth="2" className="ob-breathe" />
          <circle cx="56" cy="54" r="9" fill="rgba(255,252,240,0.34)" />
          <text x="68" y="75" textAnchor="middle" fill="#F6E7C1" fontSize="22" fontWeight="800">+2G</text>
          <text x="68" y="158" textAnchor="middle" fill="#F0DCAA" fontSize="13.5" fontWeight="700">+2 整金法球</text>
        </g>

        <text x="514" y="104" textAnchor="middle" fill="#C8AA6E" fontSize="20" fontWeight="700">+</text>

        <g transform="translate(544, 34)">
          <circle cx="60" cy="64" r="42" stroke="rgba(255,255,255,0.14)" strokeWidth="6" />
          <path
            d="M60 22 A42 42 0 1 1 21 80"
            stroke="#5CC8D6"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <text x="60" y="70" textAnchor="middle" fill="#E6F7FA" fontSize="17" fontWeight="700">65%</text>
          <text x="60" y="154" textAnchor="middle" fill="#9ADCE6" fontSize="13.5" fontWeight="600">充能环</text>
        </g>
      </svg>
    );
  }

  if (index === 1) {
    return (
      <svg className="ob-diagram-svg" viewBox="0 0 720 220" fill="none" role="img" aria-label="三张同卡自动聚拢升星">
        {[
          { x: 64, y: 22 },
          { x: 64, y: 80 },
          { x: 64, y: 138 },
        ].map((pos, idx) => (
          <g key={idx} transform={`translate(${pos.x}, ${pos.y})`}>
            <rect x="0" y="0" width="122" height="46" rx="7" fill="#182030" stroke="#C8AA6E" strokeWidth="1.5" />
            <polygon points="26,13 29,20 36,20 30.5,24.5 32.5,31.5 26,27 19.5,31.5 21.5,24.5 16,20 23,20" fill="#D5DCE8" />
            <text x="74" y="28" textAnchor="middle" fill="#F0DCAA" fontSize="15" fontWeight="700">1★ 同卡</text>
          </g>
        ))}

        <path d="M196 45 C270 45, 290 102, 376 102" stroke="#C8AA6E" strokeWidth="1.8" className="ob-flow-line" />
        <path d="M196 103 L376 103" stroke="#F0DCAA" strokeWidth="2" className="ob-flow-line" />
        <path d="M196 161 C270 161, 290 104, 376 104" stroke="#C8AA6E" strokeWidth="1.8" className="ob-flow-line" />
        <rect x="258" y="88" width="58" height="28" rx="14" fill="#131926" stroke="rgba(240,220,170,0.55)" strokeWidth="1.2" />
        <text x="287" y="106" textAnchor="middle" fill="#F0DCAA" fontSize="12.5" fontWeight="700">聚拢</text>
        <polygon points="386,103 374,97 374,109" fill="#F0DCAA" />

        <g transform="translate(432, 16)">
          <rect x="74" y="4" width="52" height="148" rx="26" fill="rgba(240,220,170,0.14)" className="ob-breathe" />
          <line x1="100" y1="8" x2="100" y2="146" stroke="#F0DCAA" strokeWidth="2.4" strokeDasharray="3 4" />
          <polygon
            points="100,112 154,132 134,158 66,158 46,132"
            fill="rgba(92,200,214,0.14)"
            stroke="#5CC8D6"
            strokeWidth="1.6"
          />
          <circle cx="100" cy="82" r="34" fill="#1B2436" stroke="#F0DCAA" strokeWidth="2.2" />
          <text x="100" y="90" textAnchor="middle" fill="#FDE68A" fontSize="22" fontWeight="800">2★</text>
          <text x="100" y="182" textAnchor="middle" fill="#F0DCAA" fontSize="13.5" fontWeight="700">2★ 升星光柱</text>
        </g>
      </svg>
    );
  }

  if (index === 2) {
    return (
      <svg className="ob-diagram-svg" viewBox="0 0 720 220" fill="none" role="img" aria-label="两件散件拖放直合成装">
        <g transform="translate(52, 42)">
          <rect x="0" y="0" width="118" height="108" rx="8" fill="#171F2E" stroke="#C8AA6E" strokeWidth="1.6" />
          <path d="M38 74L78 34M64 34H78V48M32 68L44 80" stroke="#F0DCAA" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <text x="59" y="134" textAnchor="middle" fill="#D5DCE8" fontSize="13.5" fontWeight="600">钨芯刃</text>
        </g>

        <text x="196" y="104" textAnchor="middle" fill="#F0DCAA" fontSize="24" fontWeight="700">+</text>

        <g transform="translate(222, 42)">
          <rect x="0" y="0" width="118" height="108" rx="8" fill="#171F2E" stroke="#5CC8D6" strokeWidth="1.6" />
          <path d="M32 68L78 34M42 78L88 44" stroke="#5CC8D6" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="60" cy="56" r="6" fill="#F0DCAA" />
          <text x="59" y="134" textAnchor="middle" fill="#D5DCE8" fontSize="13.5" fontWeight="600">加速轨</text>
        </g>

        <line x1="362" y1="96" x2="458" y2="96" stroke="#C8AA6E" strokeWidth="2.2" className="ob-flow-line" />
        <polygon points="468,96 455,90 455,102" fill="#F0DCAA" />

        <g transform="translate(492, 26)">
          <polygon
            points="84,8 158,70 84,132 10,70"
            fill="rgba(200,170,110,0.16)"
            stroke="#F0DCAA"
            strokeWidth="2.2"
            className="ob-breathe"
          />
          <polygon
            points="84,24 138,70 84,116 30,70"
            fill="#172030"
            stroke="#5CC8D6"
            strokeWidth="1.3"
          />
          <path d="M56 82L112 58M62 66L106 48M68 92L112 74" stroke="#FDE68A" strokeWidth="2.2" strokeLinecap="round" />
          <text x="84" y="160" textAnchor="middle" fill="#F0DCAA" fontSize="14" fontWeight="700">洛伦兹连发轨</text>
        </g>
      </svg>
    );
  }

  return (
    <svg className="ob-diagram-svg" viewBox="0 0 720 220" fill="none" role="img" aria-label="布阵交锋累计胜点争先">
      <g transform="translate(58, 28)">
        {[
          { cx: 56, cy: 52, active: true },
          { cx: 112, cy: 52, active: false },
          { cx: 168, cy: 52, active: false },
          { cx: 84, cy: 100, active: false },
          { cx: 140, cy: 100, active: true },
          { cx: 196, cy: 100, active: false },
        ].map((hex, i) => (
          <polygon
            key={i}
            points={`${hex.cx},${hex.cy - 26} ${hex.cx + 23},${hex.cy - 13} ${hex.cx + 23},${hex.cy + 13} ${hex.cx},${hex.cy + 26} ${hex.cx - 23},${hex.cy + 13} ${hex.cx - 23},${hex.cy - 13}`}
            fill={hex.active ? 'rgba(200,170,110,0.2)' : 'rgba(23,31,46,0.9)'}
            stroke={hex.active ? '#F0DCAA' : 'rgba(92,200,214,0.45)'}
            strokeWidth={hex.active ? '1.8' : '1.2'}
          />
        ))}
        <circle cx="56" cy="52" r="9" fill="#5CC8D6" />
        <circle cx="140" cy="100" r="9" fill="#F0DCAA" />
        <path d="M68 44 C104 20, 134 44, 140 84" stroke="#F0DCAA" strokeWidth="1.7" strokeDasharray="4 4" />
        <path d="M128 108 C92 130, 62 106, 56 68" stroke="#5CC8D6" strokeWidth="1.7" strokeDasharray="4 4" />
        <text x="124" y="158" textAnchor="middle" fill="#D5DCE8" fontSize="13.5" fontWeight="600">六角棋盘互换</text>
      </g>

      <line x1="316" y1="98" x2="432" y2="98" stroke="#C8AA6E" strokeWidth="2.2" className="ob-flow-line" />
      <polygon points="442,98 429,92 429,104" fill="#F0DCAA" />

      <g transform="translate(478, 24)">
        <polygon
          points="84,10 132,30 150,76 132,122 84,142 36,122 18,76 36,30"
          fill="rgba(200,170,110,0.16)"
          stroke="#F0DCAA"
          strokeWidth="2"
          className="ob-breathe"
        />
        <polygon
          points="84,28 118,42 132,76 118,110 84,124 50,110 36,76 50,42"
          fill="#172030"
          stroke="rgba(240,220,170,0.55)"
          strokeWidth="1.2"
        />
        <polygon points="84,48 92,66 112,68 97,81 101,100 84,90 67,100 71,81 56,68 76,66" fill="#FDE68A" />
        <text x="84" y="166" textAnchor="middle" fill="#F0DCAA" fontSize="13.5" fontWeight="700">胜点徽章</text>
      </g>
    </svg>
  );
}

export function OnboardingModal(): React.JSX.Element | null {
  const {
    onboardingOpen,
    onboardingInitialMode,
    closeOnboarding,
    profile,
    authMode,
    patchUserProfile,
    getStageEngine,
    registerStageEngine,
    setCustomStageOverride,
    setExternalLearningOverlay,
    audioBus,
    pushToast,
  } = useAppStore();

  const [step, setStep] = useState<'choice' | 'cards' | 'micro_match' | 'learning_start'>(
    onboardingInitialMode,
  );
  const [cardIndex, setCardIndex] = useState<number>(0);
  const [packs, setPacks] = useState<CoursePackManifest[]>(() =>
    STARTER_COURSE_PACKS.map((p) => p.manifest),
  );
  const [englishNode, setEnglishNode] = useState<string>(
    profile?.learningStartSelections?.english ??
      STARTER_COURSE_PACKS[0]!.manifest.knowledgeGraph[0]!.nodeId,
  );
  const [mathNode, setMathNode] = useState<string>(
    profile?.learningStartSelections?.math ??
      STARTER_COURSE_PACKS[1]!.manifest.knowledgeGraph[0]!.nodeId,
  );
  const [saving, setSaving] = useState<boolean>(false);
  const savingRef = useRef<boolean>(false);

  const [microSnap, setMicroSnap] = useState<MatchRoomSnapshot | null>(null);
  const [microProg, setMicroProg] = useState<OnboardingMicroProgress | null>(null);
  const [selectedItemIdx, setSelectedItemIdx] = useState<number | null>(null);
  const [draggingUnitId, setDraggingUnitId] = useState<string | null>(null);
  const [overSell, setOverSell] = useState<boolean>(false);

  const microCtrlRef = useRef<OnboardingMicroController | null>(null);
  const syncRef = useRef<SnapshotStageSynchronizer>(new SnapshotStageSynchronizer());
  const choreoRef = useRef<LiveBattleChoreographer>(new LiveBattleChoreographer());
  const battlePayloadRef = useRef<BattleBroadcastPayload | null>(null);

  useEffect(() => {
    if (!onboardingOpen) return;
    setStep(onboardingInitialMode);
    setCardIndex(0);
    if (profile?.learningStartSelections?.english) {
      setEnglishNode(profile.learningStartSelections.english);
    }
    if (profile?.learningStartSelections?.math) {
      setMathNode(profile.learningStartSelections.math);
    }
    if (authMode === 'authenticated') {
      void httpClient
        .getCoursePacks()
        .then((rows) => {
          if (rows.length > 0) setPacks(rows.map((r) => r.manifest));
        })
        .catch(() => undefined);
    }
  }, [authMode, onboardingInitialMode, onboardingOpen]);

  useEffect(() => {
    if (!onboardingOpen || step !== 'micro_match') {
      setExternalLearningOverlay('onboarding-sample', false);
      return;
    }

    setCustomStageOverride(true);
    const stage = getStageEngine();

    const ctrl = new OnboardingMicroController({
      onUpdate: (snap, prog) => {
        setMicroSnap(snap);
        setMicroProg(prog);
        setExternalLearningOverlay('onboarding-sample', prog.stageId === 'sample');
        const stEngine = getStageEngine();
        if (stEngine && prog.stageId !== 'battle') {
          choreoRef.current.stop();
          syncRef.current.syncSnapshot(stEngine, snap);
        }
      },
      onBattle: (payload) => {
        battlePayloadRef.current = payload;
        const stEngine = getStageEngine();
        if (stEngine && microCtrlRef.current) {
          const snap = microCtrlRef.current.scenario;
          choreoRef.current.start({
            stage: stEngine,
            snapshot: {
              roomId: 'onboarding-micro-room',
              matchId: 'onboarding-90s-micro',
              mode: 'quick',
              queueType: 'solo',
              phase: 'battle',
              phaseIndex: 3,
              deadlineEpochMs: Date.now() + 20_000,
              remainingSeconds: 20,
              round: 1,
              nodeIndex: 0,
              versionLock: {
                seasonTermId: 'onboarding-sandbox',
                gameSetVersion: 'season1-v1',
                coursePackVersion: '1.0.0',
              },
              seatId: snap.playerSeatId,
              self: structuredClone(
                snap.game.seats.find((s) => s.id === snap.playerSeatId)!,
              ),
              seats: snap.game.seats.map((s) => ({
                seatId: s.id,
                nickname: s.id,
                level: s.level,
                units: structuredClone(s.units.filter((u) => u.location.zone === 'board')),
                victoryPoints: 0,
                chosenAugments: [],
              })),
              learning: null,
              resourceSettlement: null,
              summary: null,
              completed: false,
              failure: null,
            },
            battlePayload: payload,
            viewedSeatId: snap.playerSeatId,
            stageSeatIndex: 0,
          });
        }
      },
      onFinished: () => {
        void finishChoiceAndProceed('micro_match');
      },
    });

    microCtrlRef.current = ctrl;

    if (stage) {
      stage.returnHome();
      stage.setCallbacks({
        onMoveUnit: (instanceId, to) => {
          ctrl.sendCommand({ type: 'MOVE_UNIT', instanceId, to });
        },
        onSellUnitRequest: (instanceId) => {
          ctrl.sendCommand({ type: 'SELL_UNIT', instanceId });
        },
        onCollectLootOrb: (orbId) => {
          syncRef.current.markOrbCollected(orbId);
        },
        onInspectUnit: (instanceId) => {
          if (instanceId && selectedItemIdxRef.current !== null) {
            ctrl.sendCommand({
              type: 'EQUIP_ITEM',
              inventoryItemIndex: selectedItemIdxRef.current,
              targetInstanceId: instanceId,
            });
            setSelectedItemIdx(null);
          }
        },
        onDragStateChange: (id, over) => {
          setDraggingUnitId(id);
          setOverSell(over);
        },
      });
    }

    ctrl.start();

    return () => {
      choreoRef.current.stop();
      ctrl.dispose();
      microCtrlRef.current = null;
      setMicroSnap(null);
      setMicroProg(null);
      setSelectedItemIdx(null);
      setDraggingUnitId(null);
      setOverSell(false);
      setExternalLearningOverlay('onboarding-sample', false);
      setCustomStageOverride(false);
      const currentEngine = getStageEngine();
      if (currentEngine) {
        registerStageEngine(currentEngine);
      }
    };
  }, [onboardingOpen, step]);

  const selectedItemIdxRef = useRef<number | null>(null);
  selectedItemIdxRef.current = selectedItemIdx;

  const [, setTick] = useState<number>(0);
  useEffect(() => {
    if (!onboardingOpen || step !== 'micro_match') return;
    const id = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [onboardingOpen, step]);

  const englishManifest = useMemo(
    () => packs.find((p) => p.subject === 'english') ?? STARTER_COURSE_PACKS[0]!.manifest,
    [packs],
  );
  const mathManifest = useMemo(
    () => packs.find((p) => p.subject === 'math') ?? STARTER_COURSE_PACKS[1]!.manifest,
    [packs],
  );

  if (!onboardingOpen) return null;

  const isFirstTimeUnset = profile?.onboardingChoice === 'unset';

  async function finishChoiceAndProceed(choice: 'cards' | 'micro_match' | 'skipped') {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await patchUserProfile({ onboardingChoice: choice });
      if (isFirstTimeUnset) {
        setStep('learning_start');
      } else {
        closeOnboarding();
      }
    } catch (err) {
      const detail = err instanceof ApiClientError ? err.message : '请重试当前操作。';
      pushToast(`启航进度尚未确认保存。${detail}`, 'error');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const handleSaveLearningStart = async (skipCustom = false) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const selections: Partial<Record<SubjectId, string>> = skipCustom
        ? {
            english: englishManifest.knowledgeGraph[0]!.nodeId,
            math: mathManifest.knowledgeGraph[0]!.nodeId,
          }
        : {
            english: englishNode,
            math: mathNode,
          };
      await patchUserProfile({
        ...(profile?.onboardingChoice === 'unset' ? { onboardingChoice: 'skipped' } : {}),
        learningStartSelections: selections,
      });
      pushToast('起始章节已保存', 'success');
      closeOnboarding();
    } catch (err) {
      const detail = err instanceof ApiClientError ? err.message : '请点击“进入大厅”或“默认起点”重试。';
      pushToast(`起始章节尚未确认保存，当前选择已保留。${detail}`, 'error');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (step === 'micro_match' && microSnap && microProg) {
    const selfSeat = microSnap.self;
    const carryUnit = selfSeat.units.find((u) => u.unitId === 'S09') ?? selfSeat.units[0];
    const dotStepIndex =
      microProg.stageId === 'goal'
        ? 0
        : microProg.stageId === 'sample'
          ? 1
          : microProg.stageId === 'prep'
            ? 2
            : 3;

    const activePrepSpotlight: 'buy' | 'equip' | 'battle' = !microProg.checklist.mergedTwoStar
      ? 'buy'
      : !microProg.checklist.craftedRailgun && selfSeat.inventoryItems.length > 0
        ? 'equip'
        : 'battle';

    return (
      <div className="blc-micro-overlay" data-testid="onboarding-micro-scenario">
        <style>{ONBOARDING_MINIMAL_CSS}</style>

        <header className="ob-micro-topbar">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            <span className="ob-micro-title">实机演练</span>
            <div className="ob-progress-dots" aria-label="演练进度">
              {[0, 1, 2, 3].map((idx) => (
                <span
                  key={idx}
                  className={`ob-pdot ${
                    idx < dotStepIndex
                      ? 'ob-pdot--done'
                      : idx === dotStepIndex
                        ? 'ob-pdot--active'
                        : ''
                  }`.trim()}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span className="blc-clock-pill">
              {formatCompactClock(microProg.stageRemainingSec)}
            </span>
            <button
              type="button"
              className="blc-btn blc-btn--ghost blc-btn--xs"
              disabled={saving}
              onClick={() => void finishChoiceAndProceed('micro_match')}
              data-testid="skip-micro-scenario-btn"
            >
              跳过
            </button>
          </div>
        </header>

        {microProg.stageId === 'goal' ? (
          <div className="ob-goal-banner">
            <div className="ob-goal-steps">
              <span className="ob-goal-pill">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M4.5 7L6.3 8.8L9.5 5.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>答题</span>
              </span>
              <span className="ob-goal-arrow">→</span>
              <span className="ob-goal-pill">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <polygon points="7,1.5 8.7,5 12.5,5.5 9.7,8.2 10.4,12 7,10.2 3.6,12 4.3,8.2 1.5,5.5 5.3,5" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                <span>升 2★</span>
              </span>
              <span className="ob-goal-arrow">→</span>
              <span className="ob-goal-pill">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <polygon points="7,1.5 12.5,7 7,12.5 1.5,7" stroke="currentColor" strokeWidth="1.3" />
                </svg>
                <span>合装开战</span>
              </span>
            </div>

            <button
              type="button"
              className="blc-btn blc-btn--primary blc-btn--sm"
              onClick={() => microCtrlRef.current?.advanceStageNow()}
            >
              开始
            </button>
          </div>
        ) : null}

        {microProg.stageId === 'sample' ? (
          <div className="learning-briefing-backdrop" style={{ zIndex: 55 }}>
            <div className="learning-briefing-modal">
              <QuestionStepCard
                stepKind="resource_check"
                question={microProg.sampleQuestion}
                feedback={microProg.sampleFeedback}
                sharedRemainingSeconds={microProg.stageRemainingSec}
                sharedTotalSeconds={10}
                variant="overlay"
                audioBus={audioBus}
                submitLabel="提交"
                nextStepLabel="下一步"
                onSubmitAnswer={(sub: QuestionAnswerSubmission) =>
                  microCtrlRef.current?.submitSampleQuestion({
                    answer: sub.answer,
                    status: 'submitted',
                    hintUsed: sub.hintUsed,
                  })
                }
                onSkipQuestion={() =>
                  microCtrlRef.current?.submitSampleQuestion({
                    answer: null,
                    status: 'skipped',
                  })
                }
                onAdvanceStep={() => microCtrlRef.current?.advanceStageNow()}
              />
            </div>
          </div>
        ) : null}

        {microProg.stageId === 'prep' ? (
          <>
            <aside className="ob-hud-dock" data-testid="micro-checklist">
              <div className="ob-mini-checks">
                <span
                  className={`ob-mini-check ${
                    microProg.checklist.mergedTwoStar ? 'ob-mini-check--done' : ''
                  }`.trim()}
                >
                  <span>{microProg.checklist.mergedTwoStar ? '✓' : '○'}</span>
                  <span>升 2★</span>
                </span>
                <span
                  className={`ob-mini-check ${
                    microProg.checklist.craftedRailgun ? 'ob-mini-check--done' : ''
                  }`.trim()}
                >
                  <span>{microProg.checklist.craftedRailgun ? '✓' : '○'}</span>
                  <span>合主装</span>
                </span>
                <span
                  className={`ob-mini-check ${
                    microProg.checklist.repositionedUnit ? 'ob-mini-check--done' : ''
                  }`.trim()}
                >
                  <span>{microProg.checklist.repositionedUnit ? '✓' : '○'}</span>
                  <span>布阵</span>
                </span>
              </div>

              {selfSeat.inventoryItems.length > 0 ? (
                <div className="ob-equip-rack ob-spotlight-anchor">
                  {activePrepSpotlight === 'equip' ? (
                    <SpotlightCue label="点散件 · 装主核" />
                  ) : null}
                  {selfSeat.inventoryItems.map((itemId, idx) => {
                    const itemEntry = lookupItemById(itemId);
                    const preview = carryUnit ? previewItemEquip(carryUnit, itemId) : null;
                    const craftedEntry = preview?.craftedItemId
                      ? lookupItemById(preview.craftedItemId)
                      : null;
                    return (
                      <button
                        key={`${itemId}-${idx}`}
                        type="button"
                        className={`ob-equip-chip ${
                          selectedItemIdx === idx ? 'ob-equip-chip--selected' : ''
                        }`.trim()}
                        onClick={() => {
                          if (carryUnit) {
                            microCtrlRef.current?.sendCommand({
                              type: 'EQUIP_ITEM',
                              inventoryItemIndex: idx,
                              targetInstanceId: carryUnit.instanceId,
                            });
                          } else {
                            setSelectedItemIdx(idx);
                          }
                        }}
                        data-testid={`micro-equip-item-${idx}`}
                      >
                        <span>◆ {shortItemName(itemEntry?.item.name ?? itemId)}</span>
                        <span style={{ fontSize: 11, opacity: 0.85 }}>
                          {craftedEntry ? `→ ${craftedEntry.item.name}` : '穿戴'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="ob-spotlight-anchor">
                {activePrepSpotlight === 'battle' ? (
                  <SpotlightCue label="就绪 · 点击开战" />
                ) : null}
                <button
                  type="button"
                  className="blc-btn blc-btn--primary blc-btn--sm"
                  style={{ width: '100%' }}
                  onClick={() => microCtrlRef.current?.advanceStageNow()}
                  data-testid="micro-start-battle-now-btn"
                >
                  开战
                </button>
              </div>
            </aside>

            <footer
              className="ui-metal-frame blc-micro-shop"
              style={{ overflow: 'visible' }}
            >
              {draggingUnitId ? (
                <div
                  className={`shop-sell-dropzone ${
                    overSell ? 'shop-sell-dropzone--magnet-active' : ''
                  }`.trim()}
                >
                  <span>松手出售</span>
                </div>
              ) : (
                <div className="blc-shop-row">
                  <div className="blc-shop-wallet">
                    <span className="gold-roller" style={{ fontSize: 21 }}>
                      {selfSeat.gold}G
                    </span>
                    <div
                      className="science-charge-ring"
                      style={
                        {
                          '--charge-pct': `${selfSeat.learningChargeCents}%`,
                        } as React.CSSProperties
                      }
                      title="充能环"
                    >
                      {selfSeat.learningChargeCents}
                    </div>
                  </div>

                  <div className="blc-shop-cards" style={{ overflow: 'visible' }}>
                    {selfSeat.shop.map((unitId, sIdx) => {
                      if (!unitId) {
                        return (
                          <div key={sIdx} className="blc-shop-empty">
                            已购入
                          </div>
                        );
                      }
                      const def = SEASON1_UNITS_BY_ID.get(unitId);
                      const copiesOwned = selfSeat.units.filter(
                        (u) => u.unitId === unitId && u.star === 1,
                      ).length;
                      const canMerge2 = copiesOwned >= 2;
                      const showShopSpotlight =
                        activePrepSpotlight === 'buy' && canMerge2;

                      return (
                        <div key={sIdx} className="ob-spotlight-anchor">
                          {showShopSpotlight ? (
                            <SpotlightCue label="买牌 · 升 2★" />
                          ) : null}
                          <button
                            type="button"
                            style={{ width: '100%', height: '100%' }}
                            className={`shop-card shop-card--cost-${def?.cost ?? 1} ${
                              canMerge2 ? 'shop-card--merge-2star' : ''
                            }`.trim()}
                            disabled={selfSeat.gold < (def?.cost ?? 1)}
                            onClick={() =>
                              microCtrlRef.current?.sendCommand({
                                type: 'BUY_CARD',
                                shopIndex: sIdx,
                              })
                            }
                            data-testid={`micro-shop-slot-${sIdx}`}
                          >
                            <div className="blc-shop-card__top">
                              <strong>{def?.name ?? unitId}</strong>
                              <span className="blc-gold-text">{def?.cost ?? 1}G</span>
                            </div>
                            <div className="blc-shop-card__traits">
                              <span>{def?.faction}</span> · <span>{def?.role}</span>
                            </div>
                            {canMerge2 ? (
                              <div className="blc-merge-hint">★ 升 2★</div>
                            ) : null}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </footer>
          </>
        ) : null}

        {microProg.stageId === 'summary' ? (
          <div className="blc-center-float">
            <div className="ui-metal-frame ui-corner-ornaments ob-summary-card">
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
                <polygon
                  points="22,3 38,12 38,32 22,41 6,32 6,12"
                  fill="rgba(200,170,110,0.16)"
                  stroke="#F0DCAA"
                  strokeWidth="1.6"
                />
                <path
                  d="M15 22.5L20 27.5L29.5 17"
                  stroke="#FDE68A"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <h3 style={{ margin: 0, color: 'var(--gold-light)', fontSize: 20 }}>
                {microProg.battleOutcome === 'win' ? '演练告捷' : '演练完成'}
              </h3>
              <button
                type="button"
                className="blc-btn blc-btn--primary"
                disabled={saving}
                onClick={() => void finishChoiceAndProceed('micro_match')}
                data-testid="micro-finish-continue-btn"
              >
                {isFirstTimeUnset ? '下一步' : '完成'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="blc-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="启航引导"
      data-testid="onboarding-modal"
    >
      <style>{ONBOARDING_MINIMAL_CSS}</style>

      <div className="ui-metal-frame ui-corner-ornaments ob-minimal-panel">
        {step === 'choice' ? (
          <div key="choice" className="ob-stage-anim">
            <header className="ob-header-center">
              <h2>启航方式</h2>
              {!isFirstTimeUnset ? (
                <button
                  type="button"
                  className="blc-btn blc-btn--ghost blc-btn--xs ob-header-close"
                  disabled={saving}
                  onClick={closeOnboarding}
                >
                  关闭
                </button>
              ) : null}
            </header>

            <div className="ob-choices-grid" data-testid="onboarding-three-choices">
              <div className="ob-choice-card">
                <div className="ob-choice-icon">
                  <ChoiceIconCardsSvg />
                </div>
                <h3 className="ob-choice-title">核心图解</h3>
                <p className="ob-choice-sub">4 步看懂核心循环</p>
                <button
                  type="button"
                  className="blc-btn blc-btn--metal blc-btn--block"
                  disabled={saving}
                  onClick={() => setStep('cards')}
                  data-testid="onboarding-opt-cards"
                >
                  查看
                </button>
              </div>

              <div className="ob-choice-card ob-choice-card--featured">
                <div className="ob-choice-icon">
                  <ChoiceIconMicroSvg />
                </div>
                <h3 className="ob-choice-title">实机演练</h3>
                <p className="ob-choice-sub">90 秒棋盘亲手试玩</p>
                <button
                  type="button"
                  className="blc-btn blc-btn--primary blc-btn--block"
                  disabled={saving}
                  onClick={() => setStep('micro_match')}
                  data-testid="onboarding-opt-micro"
                >
                  开始
                </button>
              </div>

              <div className="ob-choice-card">
                <div className="ob-choice-icon">
                  <ChoiceIconSkipSvg />
                </div>
                <h3 className="ob-choice-title">直接进入</h3>
                <p className="ob-choice-sub">跳过引导直达大厅</p>
                <button
                  type="button"
                  className="blc-btn blc-btn--ghost blc-btn--block"
                  disabled={saving}
                  onClick={() => void finishChoiceAndProceed('skipped')}
                  data-testid="onboarding-opt-skip"
                >
                  跳过
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {step === 'cards' ? (
          <div key="cards" className="ob-stage-anim">
            <header className="ob-cards-top">
              <span className="ob-step-counter">{FOUR_GUIDE_CARDS[cardIndex]!.step}</span>
              <button
                type="button"
                className="blc-btn blc-btn--ghost blc-btn--xs"
                disabled={saving}
                onClick={() => void finishChoiceAndProceed('cards')}
                data-testid="cards-skip-now-btn"
              >
                跳过
              </button>
            </header>

            <div
              key={cardIndex}
              className="ob-diagram-stage ob-stage-anim"
              data-testid="guide-card-slide"
            >
              <h2 className="ob-diagram-title">{FOUR_GUIDE_CARDS[cardIndex]!.title}</h2>
              <GuideSlideDiagram index={cardIndex} />
              <div className="ob-dots-row">
                {FOUR_GUIDE_CARDS.map((c, idx) => (
                  <button
                    key={c.step}
                    type="button"
                    className={`ob-dot-btn ${idx === cardIndex ? 'ob-dot-btn--active' : ''}`.trim()}
                    disabled={saving}
                    onClick={() => setCardIndex(idx)}
                    aria-label={`第 ${idx + 1} 页`}
                  />
                ))}
              </div>
            </div>

            <footer className="blc-onboarding-footer">
              <button
                type="button"
                className="blc-btn blc-btn--ghost"
                disabled={saving || cardIndex === 0}
                onClick={() => setCardIndex((i) => Math.max(0, i - 1))}
              >
                上一页
              </button>

              {cardIndex < FOUR_GUIDE_CARDS.length - 1 ? (
                <button
                  type="button"
                  className="blc-btn blc-btn--primary"
                  disabled={saving}
                  onClick={() => setCardIndex((i) => i + 1)}
                  data-testid="guide-card-next-btn"
                >
                  下一页
                </button>
              ) : (
                <button
                  type="button"
                  className="blc-btn blc-btn--primary"
                  disabled={saving}
                  onClick={() => void finishChoiceAndProceed('cards')}
                  data-testid="guide-card-finish-btn"
                >
                  {isFirstTimeUnset ? '下一步' : '完成'}
                </button>
              )}
            </footer>
          </div>
        ) : null}

        {step === 'learning_start' ? (
          <div key="learning_start" className="ob-stage-anim">
            <header className="ob-header-center">
              <h2>选择起始章节</h2>
              {!isFirstTimeUnset ? (
                <button
                  type="button"
                  className="blc-btn blc-btn--ghost blc-btn--xs ob-header-close"
                  disabled={saving}
                  onClick={closeOnboarding}
                >
                  关闭
                </button>
              ) : null}
            </header>

            <div className="ob-start-cols" data-testid="learning-start-selector">
              <div className="ob-subject-card">
                <div className="ob-subject-head">
                  <h3>英语</h3>
                </div>
                <div className="blc-node-list">
                  {englishManifest.knowledgeGraph.map((node, idx) => (
                    <label
                      key={node.nodeId}
                      className={`ob-chapter-option ${
                        englishNode === node.nodeId ? 'ob-chapter-option--selected' : ''
                      }`.trim()}
                    >
                      <input
                        type="radio"
                        name="english-start-node"
                        value={node.nodeId}
                        disabled={saving}
                        checked={englishNode === node.nodeId}
                        onChange={() => setEnglishNode(node.nodeId)}
                      />
                      <span>
                        第 {idx + 1} 节 · {node.title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="ob-subject-card">
                <div className="ob-subject-head">
                  <h3>数学</h3>
                </div>
                <div className="blc-node-list">
                  {mathManifest.knowledgeGraph.map((node, idx) => (
                    <label
                      key={node.nodeId}
                      className={`ob-chapter-option ${
                        mathNode === node.nodeId ? 'ob-chapter-option--selected' : ''
                      }`.trim()}
                    >
                      <input
                        type="radio"
                        name="math-start-node"
                        value={node.nodeId}
                        disabled={saving}
                        checked={mathNode === node.nodeId}
                        onChange={() => setMathNode(node.nodeId)}
                      />
                      <span>
                        第 {idx + 1} 节 · {node.title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <footer className="blc-onboarding-footer">
              <button
                type="button"
                className="blc-btn blc-btn--ghost"
                disabled={saving}
                onClick={() => void handleSaveLearningStart(true)}
                data-testid="skip-learning-start-btn"
              >
                默认起点
              </button>
              <button
                type="button"
                className="blc-btn blc-btn--primary"
                disabled={saving}
                onClick={() => void handleSaveLearningStart(false)}
                data-testid="save-learning-start-btn"
              >
                {saving ? '保存中…' : '进入大厅'}
              </button>
            </footer>
          </div>
        ) : null}
      </div>
    </div>
  );
}
