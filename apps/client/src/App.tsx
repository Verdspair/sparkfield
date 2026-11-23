import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { DescriptionModeProvider, ensureLearningUiStyles } from '@pkg/learning-ui';
import { GlobalMatchAcceptModal } from './components/GlobalMatchAcceptModal.js';
import { PersistentStageCanvas } from './components/PersistentStageCanvas.js';
import { SettingsModal } from './components/SettingsModal.js';
import { TopRoomBar } from './components/TopRoomBar.js';
import { AuthPage } from './pages/AuthPage.js';
import { LobbyPage } from './pages/LobbyPage.js';
import { PrepRoomPage } from './pages/PrepRoomPage.js';
import { AppStoreProvider, useAppStore } from './store/appStore.js';

const LearningHomePage = lazy(() =>
  import('./pages/LearningHomePage.js').then((m) => ({ default: m.LearningHomePage })),
);
const EncyclopediaPage = lazy(() =>
  import('./pages/EncyclopediaPage.js').then((m) => ({ default: m.EncyclopediaPage })),
);
const RankingPage = lazy(() =>
  import('./pages/RankingPage.js').then((m) => ({ default: m.RankingPage })),
);
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage.js').then((m) => ({ default: m.ProfilePage })),
);
const RedemptionPage = lazy(() =>
  import('./pages/RedemptionPage.js').then((m) => ({ default: m.RedemptionPage })),
);
const OnboardingModal = lazy(() =>
  import('./onboarding/OnboardingModal.js').then((m) => ({ default: m.OnboardingModal })),
);
const MatchHudOverlay = lazy(() =>
  import('./hud/MatchHudOverlay.js').then((m) => ({ default: m.MatchHudOverlay })),
);
const MatchSummaryModal = lazy(() =>
  import('./hud/MatchSummaryModal.js').then((m) => ({ default: m.MatchSummaryModal })),
);

function RouteLoadingFallback(): React.JSX.Element {
  return (
    <div className="sf-route-fallback">
      <span className="stat-skeleton" style={{ width: 220, height: 22 }} />
    </div>
  );
}

function AppViewportRouter(): React.JSX.Element {
  const {
    authMode,
    entryGatePassed,
    inActiveMatch,
    activeTab,
    viewingPrepRoom,
    redemptionOpen,
    onboardingOpen,
    lobbyState,
    toasts,
    dismissToast,
  } = useAppStore();

  const quickDismissTimersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    ensureLearningUiStyles();
  }, []);

  useEffect(() => {
    const timers = quickDismissTimersRef.current;
    const activeIds = new Set(toasts.map((t) => t.id));

    for (const [id, handle] of timers.entries()) {
      if (!activeIds.has(id)) {
        window.clearTimeout(handle);
        timers.delete(id);
      }
    }

    for (const toast of toasts) {
      if (toast.tone !== 'info' && toast.tone !== 'success') continue;
      if (timers.has(toast.id)) continue;
      const handle = window.setTimeout(() => {
        timers.delete(toast.id);
        dismissToast(toast.id);
      }, 2200);
      timers.set(toast.id, handle);
    }
  }, [dismissToast, toasts]);

  useEffect(() => {
    const timers = quickDismissTimersRef.current;
    return () => {
      for (const handle of timers.values()) {
        window.clearTimeout(handle);
      }
      timers.clear();
    };
  }, []);

  const visibleToasts = toasts.slice(-2);
  const showStartGate =
    authMode === 'unauthenticated' || (authMode === 'authenticated' && !entryGatePassed);
  const canOpenSettings =
    (authMode === 'authenticated' && entryGatePassed) || authMode === 'offline_practice';

  return (
    <div className="blc-root">
      <PersistentStageCanvas />

      <div className="blc-ui-layer">
        {authMode === 'booting' ? (
          <div className="blc-auth-viewport" data-testid="boot-loading-screen">
            <div className="ui-metal-frame sf-boot-card">
              <h3 className="sf-boot-card__title">SparkField · 灵光之野</h3>
              <span className="stat-skeleton" style={{ width: '78%', height: 14 }} />
            </div>
          </div>
        ) : showStartGate ? (
          <AuthPage />
        ) : inActiveMatch ? (
          <Suspense fallback={<RouteLoadingFallback />}>
            <MatchHudOverlay />
            <MatchSummaryModal />
          </Suspense>
        ) : onboardingOpen ? (
          <Suspense fallback={<RouteLoadingFallback />}>
            <OnboardingModal />
          </Suspense>
        ) : (
          <>
            <TopRoomBar />

            <Suspense fallback={<RouteLoadingFallback />}>
              {redemptionOpen ? (
                <RedemptionPage />
              ) : activeTab === 'lobby' ? (
                viewingPrepRoom && lobbyState.prepRoom ? (
                  <PrepRoomPage />
                ) : (
                  <LobbyPage />
                )
              ) : activeTab === 'learning' ? (
                <LearningHomePage />
              ) : activeTab === 'encyclopedia' ? (
                <EncyclopediaPage />
              ) : activeTab === 'ranking' ? (
                <RankingPage />
              ) : (
                <ProfilePage />
              )}
            </Suspense>

            <GlobalMatchAcceptModal />
          </>
        )}
      </div>

      {canOpenSettings ? <SettingsModal /> : null}

      {visibleToasts.length > 0 ? (
        <div className="blc-toast-stack" aria-live="polite" data-testid="toast-banner-stack">
          {visibleToasts.map((t) => (
            <div key={t.id} className="blc-toast" data-tone={t.tone}>
              <span className="blc-toast__dot" aria-hidden="true" />
              <span className="blc-toast__text">{t.text}</span>
              <button
                type="button"
                className="blc-toast__close"
                aria-label="关闭提示"
                onClick={() => dismissToast(t.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function App(): React.JSX.Element {
  return (
    <DescriptionModeProvider>
      <AppStoreProvider>
        <AppViewportRouter />
      </AppStoreProvider>
    </DescriptionModeProvider>
  );
}
