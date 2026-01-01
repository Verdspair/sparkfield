import React, { useEffect, useState } from 'react';
import { ArenaThemeSwitcher } from '../components/PersistentStageCanvas.js';
import { useAppStore } from '../store/appStore.js';

type AuthStage = 'splash' | 'intent' | 'login' | 'register';

const AUTH_SCOPED_CSS = `
@keyframes blcAuthFadeUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes blcEmblemBreathe {
  0%, 100% {
    opacity: 0.84;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.025);
  }
}
@keyframes blcSplashPulse {
  0%, 100% {
    opacity: 0.72;
    border-color: rgba(240, 220, 170, 0.28);
    box-shadow: 0 0 0 rgba(240, 220, 170, 0);
  }
  50% {
    opacity: 1;
    border-color: rgba(240, 220, 170, 0.62);
    box-shadow: 0 0 22px rgba(200, 170, 110, 0.18);
  }
}
.blc-auth-fade-up {
  animation: blcAuthFadeUp 340ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.blc-splash-emblem {
  animation: blcEmblemBreathe 5.2s ease-in-out infinite;
}
.blc-splash-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 30px;
  border-radius: 999px;
  border: 1px solid rgba(240, 220, 170, 0.36);
  background: rgba(13, 17, 26, 0.46);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: var(--gold-light);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.24em;
  text-indent: 0.24em;
  cursor: pointer;
  animation: blcSplashPulse 3.6s ease-in-out infinite;
  transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1), background 180ms ease;
}
.blc-splash-cta:hover {
  background: rgba(200, 170, 110, 0.18);
  transform: translateY(-1px);
}
.blc-intent-card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 15px 18px;
  border-radius: 8px;
  border: 1px solid rgba(240, 220, 170, 0.2);
  background: rgba(16, 21, 32, 0.72);
  color: var(--text-primary);
  font-family: var(--font-sans);
  text-align: left;
  cursor: pointer;
  transition:
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color 180ms ease,
    background 180ms ease,
    box-shadow 180ms ease;
}
.blc-intent-card:hover {
  transform: translateY(-2px);
  border-color: rgba(240, 220, 170, 0.56);
  background: rgba(24, 31, 46, 0.86);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.36);
}
.blc-intent-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(240, 220, 170, 0.3);
  background: rgba(200, 170, 110, 0.08);
  color: var(--gold-light);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.blc-hairline-back {
  background: none;
  border: 0;
  padding: 4px 2px;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: 13px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: color 140ms ease;
}
.blc-hairline-back:hover {
  color: var(--gold-light);
}
.blc-inline-switch {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
.blc-inline-switch__btn {
  background: none;
  border: 0;
  border-bottom: 1.5px solid transparent;
  margin-bottom: -1px;
  padding: 4px 10px;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: color 140ms ease, border-color 140ms ease;
}
.blc-inline-switch__btn--active {
  color: var(--gold-light);
  border-bottom-color: var(--gold-light);
}
`;

function StarRingEmblem(): React.JSX.Element {
  return (
    <svg
      className="blc-splash-emblem"
      width="76"
      height="76"
      viewBox="0 0 76 76"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="38"
        cy="38"
        r="28"
        stroke="rgba(240, 220, 170, 0.32)"
        strokeWidth="0.9"
      />
      <ellipse
        cx="38"
        cy="38"
        rx="34"
        ry="13"
        transform="rotate(-24 38 38)"
        stroke="rgba(240, 220, 170, 0.68)"
        strokeWidth="1"
      />
      <ellipse
        cx="38"
        cy="38"
        rx="34"
        ry="13"
        transform="rotate(36 38 38)"
        stroke="rgba(92, 200, 214, 0.34)"
        strokeWidth="0.8"
      />
      <path
        d="M38 26L40.4 35.6L50 38L40.4 40.4L38 50L35.6 40.4L26 38L35.6 35.6L38 26Z"
        stroke="#F0DCAA"
        strokeWidth="1.1"
        fill="rgba(240, 220, 170, 0.14)"
      />
      <circle cx="38" cy="38" r="2" fill="#F0DCAA" />
    </svg>
  );
}

export function AuthPage(): React.JSX.Element {
  const {
    login,
    registerAndLogin,
    enterOfflinePractice,
    supersededBanner,
    dismissSupersededBanner,
  } = useAppStore();

  const [stage, setStage] = useState<AuthStage>(() => (supersededBanner ? 'login' : 'splash'));
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [showForgotHelp, setShowForgotHelp] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (supersededBanner) {
      setStage((prev) => (prev === 'splash' || prev === 'intent' ? 'login' : prev));
    }
  }, [supersededBanner]);

  useEffect(() => {
    if (stage !== 'splash') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-testid="arena-theme-switcher"]')) return;
      e.preventDefault();
      setStage('intent');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stage]);

  const switchFormMode = (next: 'login' | 'register') => {
    setStage(next);
    setErrorText(null);
    setShowForgotHelp(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    setSubmitting(true);
    try {
      if (stage === 'login') {
        await login(username.trim(), password);
      } else {
        const result = await registerAndLogin({
          username: username.trim(),
          password,
          nickname: nickname.trim(),
          email: email.trim() ? email.trim() : null,
        });
        if (result?.loginRequired) {
          setStage('login');
          setErrorText(`档案已创建，请登录。${result.message}`);
        }
      }
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : '连接失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const isSplash = stage === 'splash';

  return (
    <div
      className="blc-auth-viewport"
      style={{
        background: isSplash
          ? 'radial-gradient(circle at 50% 42%, rgba(11, 14, 21, 0.04) 0%, rgba(11, 14, 21, 0.46) 100%)'
          : 'radial-gradient(circle at 50% 45%, rgba(11, 14, 21, 0.24) 0%, rgba(11, 14, 21, 0.72) 100%)',
        transition: 'background 420ms ease',
      }}
      data-testid="auth-page"
    >
      <style>{AUTH_SCOPED_CSS}</style>

      {stage === 'splash' ? (
        <div
          className="blc-auth-fade-up"
          onClick={() => setStage('intent')}
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 44,
            paddingBottom: '6vh',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
              pointerEvents: 'none',
            }}
          >
            <StarRingEmblem />
            <h1
              style={{
                margin: 0,
                fontSize: 'clamp(28px, 3vw, 42px)',
                fontWeight: 400,
                letterSpacing: '0.32em',
                textIndent: '0.32em',
                color: 'var(--text-primary)',
                textShadow: '0 6px 28px rgba(0, 0, 0, 0.72)',
              }}
            >
              光 锥 之 外
            </h1>
          </div>

          <button
            type="button"
            className="blc-splash-cta"
            onClick={(e) => {
              e.stopPropagation();
              setStage('intent');
            }}
            data-testid="splash-enter-btn"
          >
            点击启航
          </button>
        </div>
      ) : null}

      {stage === 'intent' ? (
        <section
          className="ui-frosted-panel blc-auth-fade-up"
          aria-label="选择你的启航方式"
          style={{
            width: 'min(390px, 92vw)',
            padding: '22px 24px 26px',
            borderRadius: 10,
            border: '1px solid rgba(240, 220, 170, 0.24)',
            background: 'rgba(13, 17, 26, 0.78)',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              type="button"
              className="blc-hairline-back"
              aria-label="返回序幕"
              onClick={() => setStage('splash')}
            >
              ←
            </button>
            <span style={{ fontSize: 12, letterSpacing: '0.18em', color: 'var(--text-muted)' }}>
              光锥之外
            </span>
          </div>

          <h2
            style={{
              margin: '0 0 2px',
              fontSize: 19,
              fontWeight: 500,
              letterSpacing: '0.06em',
              color: 'var(--text-primary)',
            }}
          >
            选择你的启航方式
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              className="blc-intent-card"
              onClick={() => switchFormMode('register')}
              data-testid="auth-tab-register"
            >
              <span className="blc-intent-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 2.5V13.5M2.5 8H13.5"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <strong style={{ fontSize: 15, fontWeight: 600, color: 'var(--gold-light)' }}>
                  初建档案
                </strong>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>创建新身份</span>
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: 14 }} aria-hidden="true">
                ›
              </span>
            </button>

            <button
              type="button"
              className="blc-intent-card"
              onClick={() => switchFormMode('login')}
              data-testid="auth-tab-login"
            >
              <span className="blc-intent-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.3" />
                  <circle cx="8" cy="8" r="1.6" fill="currentColor" />
                </svg>
              </span>
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <strong style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                  账号登录
                </strong>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>继续已有进度</span>
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: 14 }} aria-hidden="true">
                ›
              </span>
            </button>

            <button
              type="button"
              className="blc-intent-card"
              onClick={enterOfflinePractice}
              data-testid="enter-offline-practice-btn"
            >
              <span className="blc-intent-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <polygon
                    points="8,2.2 13.4,5.3 13.4,10.7 8,13.8 2.6,10.7 2.6,5.3"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                </svg>
              </span>
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <strong style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                  离线试玩
                </strong>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  免登录单机演练
                </span>
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: 14 }} aria-hidden="true">
                ›
              </span>
            </button>
          </div>
        </section>
      ) : null}

      {stage === 'login' || stage === 'register' ? (
        <section
          className="ui-frosted-panel blc-auth-fade-up"
          aria-label={stage === 'login' ? '账号登录' : '初建档案'}
          style={{
            width: 'min(380px, 92vw)',
            maxHeight: 'calc(100vh - 96px)',
            overflowY: 'auto',
            padding: '22px 24px',
            borderRadius: 10,
            border: '1px solid rgba(240, 220, 170, 0.24)',
            background: 'rgba(13, 17, 26, 0.82)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              type="button"
              className="blc-hairline-back"
              onClick={() => {
                setStage('intent');
                setErrorText(null);
                setShowForgotHelp(false);
              }}
            >
              ← 返回
            </button>

            <div className="blc-inline-switch" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={stage === 'login'}
                className={`blc-inline-switch__btn ${
                  stage === 'login' ? 'blc-inline-switch__btn--active' : ''
                }`.trim()}
                onClick={() => switchFormMode('login')}
                data-testid="auth-tab-login"
              >
                登录
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={stage === 'register'}
                className={`blc-inline-switch__btn ${
                  stage === 'register' ? 'blc-inline-switch__btn--active' : ''
                }`.trim()}
                onClick={() => switchFormMode('register')}
                data-testid="auth-tab-register"
              >
                注册
              </button>
            </div>
          </div>

          {supersededBanner ? (
            <div className="blc-alert blc-alert--warning" data-testid="session-superseded-banner">
              <span style={{ flex: 1 }}>{supersededBanner}</span>
              <button
                type="button"
                className="blc-btn blc-btn--ghost blc-btn--xs"
                onClick={dismissSupersededBanner}
              >
                关闭
              </button>
            </div>
          ) : null}

          <form className="blc-auth-form" onSubmit={(e) => void handleSubmit(e)}>
            <label className="blc-field">
              <span className="blc-field__label">用户名</span>
              <input
                type="text"
                className="blc-input"
                required
                minLength={3}
                maxLength={32}
                autoComplete="username"
                placeholder="3–32 位字母或数字"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                data-testid="auth-username-input"
              />
            </label>

            {stage === 'register' ? (
              <label className="blc-field">
                <span className="blc-field__label">昵称</span>
                <input
                  type="text"
                  className="blc-input"
                  required
                  minLength={1}
                  maxLength={24}
                  placeholder="公开显示名称"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  data-testid="auth-nickname-input"
                />
              </label>
            ) : null}

            <label className="blc-field">
              <span className="blc-field__label">密码</span>
              <input
                type="password"
                className="blc-input"
                required
                minLength={stage === 'register' ? 6 : 1}
                maxLength={128}
                autoComplete={stage === 'login' ? 'current-password' : 'new-password'}
                placeholder={stage === 'register' ? '至少 6 位' : '输入密码'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="auth-password-input"
              />
            </label>

            {stage === 'register' ? (
              <label className="blc-field">
                <span className="blc-field__label">邮箱（选填）</span>
                <input
                  type="email"
                  className="blc-input"
                  placeholder="选填"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="auth-email-input"
                />
              </label>
            ) : null}

            {errorText ? (
              <div className="blc-alert blc-alert--error" role="alert" data-testid="auth-error-msg">
                {errorText}
              </div>
            ) : null}

            <button
              type="submit"
              className="blc-btn blc-btn--primary blc-btn--block"
              style={{ marginTop: 4 }}
              disabled={submitting}
              data-testid="auth-submit-btn"
            >
              {submitting
                ? stage === 'login'
                  ? '登录中…'
                  : '创建中…'
                : stage === 'login'
                  ? '登录'
                  : '创建档案'}
            </button>
          </form>

          {stage === 'login' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className="blc-link-btn"
                style={{ textDecoration: 'none', color: 'var(--text-muted)' }}
                onClick={() => setShowForgotHelp((prev) => !prev)}
                data-testid="forgot-password-help-btn"
              >
                忘记密码
              </button>

              {showForgotHelp ? (
                <div
                  className="blc-help-note"
                  style={{ width: '100%' }}
                  data-testid="forgot-password-help-box"
                >
                  未绑定邮箱的账号请联系管理员核验身份后重置。
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <div
        className="blc-auth-bottom-left"
        onClick={(e) => e.stopPropagation()}
      >
        <ArenaThemeSwitcher compact />
      </div>
    </div>
  );
}
