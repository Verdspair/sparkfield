import React, { useEffect, useState } from 'react';
import { TacticianPortrait } from '../components/UnitPortrait.js';
import { useAppStore } from '../store/appStore.js';

type AuthFormStage = 'intent' | 'login' | 'register';

function BrandCrestSvg(): React.JSX.Element {
  return (
    <svg
      className="sf-auth-crest sf-auth-crest--compact"
      width={34}
      height={34}
      viewBox="0 0 96 96"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="sf-crest-ring sf-crest-ring--outer"
        cx="48"
        cy="48"
        r="41"
        stroke="url(#sfCrestGold)"
        strokeWidth="1.4"
        strokeDasharray="6 4"
      />
      <ellipse
        cx="48"
        cy="48"
        rx="44"
        ry="16"
        transform="rotate(-24 48 48)"
        stroke="url(#sfCrestGold)"
        strokeWidth="1.5"
      />
      <ellipse
        cx="48"
        cy="48"
        rx="44"
        ry="16"
        transform="rotate(34 48 48)"
        stroke="url(#sfCrestAzure)"
        strokeWidth="1.2"
      />
      <path
        d="M48 24L52.2 43.8L72 48L52.2 52.2L48 72L43.8 52.2L24 48L43.8 43.8L48 24Z"
        stroke="#FFF0C4"
        strokeWidth="1.4"
        fill="rgba(242, 201, 125, 0.24)"
      />
      <circle cx="48" cy="48" r="3.4" fill="#FFF0C4" />
      <defs>
        <linearGradient id="sfCrestGold" x1="8" y1="8" x2="88" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF0C4" />
          <stop offset="50%" stopColor="#F2C97D" />
          <stop offset="100%" stopColor="#A87932" />
        </linearGradient>
        <linearGradient id="sfCrestAzure" x1="88" y1="12" x2="12" y2="84" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A5F3FC" />
          <stop offset="60%" stopColor="#4FD1FF" />
          <stop offset="100%" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function AuthPage(): React.JSX.Element {
  const {
    authMode,
    profile,
    preferredTacticianId,
    login,
    registerAndLogin,
    logout,
    enterGameFromStartScreen,
    supersededBanner,
    dismissSupersededBanner,
  } = useAppStore();

  const isPreLoginGate = authMode === 'authenticated';

  const [stage, setStage] = useState<AuthFormStage>(() =>
    !isPreLoginGate && supersededBanner ? 'login' : 'intent',
  );
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [showOptionalEmail, setShowOptionalEmail] = useState<boolean>(false);
  const [showForgotHelp, setShowForgotHelp] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [loggingOut, setLoggingOut] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (isPreLoginGate) {
      setStage('intent');
      setErrorText(null);
      setShowForgotHelp(false);
    }
  }, [isPreLoginGate]);

  useEffect(() => {
    if (!isPreLoginGate && supersededBanner) {
      setStage((prev) => (prev === 'intent' ? 'login' : prev));
    }
  }, [isPreLoginGate, supersededBanner]);

  useEffect(() => {
    if (isPreLoginGate || (stage !== 'login' && stage !== 'register')) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setStage('intent');
        setErrorText(null);
        setShowForgotHelp(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPreLoginGate, stage]);

  const switchFormMode = (next: 'login' | 'register') => {
    setStage(next);
    setErrorText(null);
    setShowForgotHelp(false);
  };

  const handleLogoutClick = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      setStage('intent');
      setErrorText(null);
    } finally {
      setLoggingOut(false);
    }
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
          email: showOptionalEmail && email.trim() ? email.trim() : null,
        });
        if (result?.loginRequired) {
          setStage('login');
          setErrorText(`账号已创建，请登录。${result.message}`);
        }
      }
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : '连接失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const isModalOpen = !isPreLoginGate && (stage === 'login' || stage === 'register');
  const displayName = profile?.nickname ?? profile?.username ?? '指挥官';

  return (
    <div
      className={`blc-auth-viewport ${isPreLoginGate ? 'sf-auth-stage--prelogin' : `sf-auth-stage--${stage}`}`}
      data-testid="auth-page"
    >
      <header className="sf-start-topbar">
        <div className="sf-start-logo">
          <BrandCrestSvg />
          <div className="sf-start-logo__copy">
            <h1 className="sf-start-logo__title">SparkField · 灵光之野</h1>
            <span className="sf-start-logo__season">S1 · 光锥之外</span>
          </div>
        </div>

        {isPreLoginGate ? (
          <button
            type="button"
            className="sf-start-logout-btn"
            disabled={loggingOut}
            onClick={() => void handleLogoutClick()}
            data-testid="start-gate-logout-btn"
          >
            {loggingOut ? '退出中…' : '退出登录'}
          </button>
        ) : null}
      </header>

      {isPreLoginGate ? (
        <div className="sf-start-bottom-dock">
          <div className="sf-start-account-plate" data-testid="start-gate-account-plate">
            <TacticianPortrait
              tacticianId={preferredTacticianId}
              size="sm"
              alt={displayName}
              className="sf-start-account-avatar"
            />
            <span className="sf-start-account-dot" aria-hidden="true" />
            <span className="sf-start-account-name">{displayName}</span>
          </div>

          <button
            type="button"
            className="sf-start-game-btn"
            onClick={enterGameFromStartScreen}
            data-testid="splash-enter-btn"
          >
            <span className="sf-start-game-btn__ornament" aria-hidden="true" />
            <span className="sf-start-game-btn__label">开始游戏</span>
          </button>
        </div>
      ) : null}

      {!isPreLoginGate && stage === 'intent' ? (
        <div className="sf-start-bottom-dock">
          <nav className="sf-auth-dual-dock" aria-label="选择启航入口">
            <button
              type="button"
              className="sf-auth-action-btn sf-auth-action-btn--gold"
              onClick={() => switchFormMode('login')}
              data-testid="auth-tab-login"
            >
              账号登录
            </button>

            <button
              type="button"
              className="sf-auth-action-btn sf-auth-action-btn--azure"
              onClick={() => switchFormMode('register')}
              data-testid="auth-tab-register"
            >
              注册新账号
            </button>
          </nav>
        </div>
      ) : null}

      {isModalOpen ? (
        <div
          className="sf-auth-modal-backdrop"
          onClick={() => {
            setStage('intent');
            setErrorText(null);
            setShowForgotHelp(false);
          }}
        >
          <section
            className="ui-metal-frame ui-corner-ornaments sf-auth-modal"
            aria-label={stage === 'login' ? '账号登录' : '注册新账号'}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sf-auth-modal__top">
              <button
                type="button"
                className="sf-auth-back-link"
                onClick={() => {
                  setStage('intent');
                  setErrorText(null);
                  setShowForgotHelp(false);
                }}
              >
                ← 返回
              </button>

              <div className="sf-auth-switch" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={stage === 'login'}
                  className={`sf-auth-switch__btn ${
                    stage === 'login' ? 'sf-auth-switch__btn--active' : ''
                  }`.trim()}
                  onClick={() => switchFormMode('login')}
                  data-testid="auth-tab-login"
                >
                  账号登录
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={stage === 'register'}
                  className={`sf-auth-switch__btn ${
                    stage === 'register' ? 'sf-auth-switch__btn--active' : ''
                  }`.trim()}
                  onClick={() => switchFormMode('register')}
                  data-testid="auth-tab-register"
                >
                  注册新账号
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
                    placeholder="输入游戏昵称"
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
                  placeholder={stage === 'register' ? '至少 6 位字符' : '输入密码'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="auth-password-input"
                />
              </label>

              {stage === 'register' ? (
                showOptionalEmail ? (
                  <div className="sf-auth-optional-wrap">
                    <label className="blc-field" style={{ flex: 1 }}>
                      <span className="blc-field__label">
                        邮箱 <small>（选填）</small>
                      </span>
                      <input
                        type="email"
                        className="blc-input"
                        placeholder="选填，用于找回密码"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        data-testid="auth-email-input"
                      />
                    </label>
                    <button
                      type="button"
                      className="sf-auth-collapse-email"
                      onClick={() => {
                        setShowOptionalEmail(false);
                        setEmail('');
                      }}
                    >
                      收起
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="sf-auth-add-email-btn"
                    onClick={() => setShowOptionalEmail(true)}
                    data-testid="toggle-optional-email-btn"
                  >
                    + 选填邮箱
                  </button>
                )
              ) : null}

              {errorText ? (
                <div className="blc-alert blc-alert--error" role="alert" data-testid="auth-error-msg">
                  {errorText}
                </div>
              ) : null}

              <button
                type="submit"
                className="blc-btn blc-btn--primary blc-btn--block sf-auth-submit-btn"
                disabled={submitting}
                data-testid="auth-submit-btn"
              >
                {submitting
                  ? stage === 'login'
                    ? '登录中…'
                    : '注册中…'
                  : stage === 'login'
                    ? '登录'
                    : '注册并进入'}
              </button>
            </form>

            {stage === 'login' ? (
              <div className="sf-auth-modal__footer">
                <button
                  type="button"
                  className="blc-link-btn sf-auth-forgot-btn"
                  onClick={() => setShowForgotHelp((prev) => !prev)}
                  data-testid="forgot-password-help-btn"
                >
                  忘记密码
                </button>

                {showForgotHelp ? (
                  <div className="blc-help-note" data-testid="forgot-password-help-box">
                    未绑定邮箱的账号请联系管理员重置。
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
