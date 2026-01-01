import React, { Suspense, lazy, useEffect } from 'react';
import { ensureLearningUiStyles } from '@pkg/learning-ui';
import { BottomDockNav } from './components/BottomDockNav.js';
import { GlobalMatchAcceptModal } from './components/GlobalMatchAcceptModal.js';
import { PersistentStageCanvas } from './components/PersistentStageCanvas.js';
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
    <div style={{ padding: '24px 28px' }}>
      <span className="stat-skeleton" style={{ width: 220, height: 22 }} />
    </div>
  );
}

function AppViewportRouter(): React.JSX.Element {
  const {
    authMode,
    inActiveMatch,
    activeTab,
    viewingPrepRoom,
    redemptionOpen,
    onboardingOpen,
    lobbyState,
    toasts,
    dismissToast,
  } = useAppStore();

  useEffect(() => {
    ensureLearningUiStyles();
  }, []);

  return (
    <div className="blc-root">
      <PersistentStageCanvas />

      <div className="blc-ui-layer">
        {authMode === 'booting' ? (
          <div className="blc-auth-viewport" data-testid="boot-loading-screen">
            <div className="ui-metal-frame ui-corner-ornaments blc-dialog-sm" style={{ textAlign: 'center' }}>
              <h3 style={{ margin: '8px 0', color: 'var(--gold-light)' }}>
                正在连接
              </h3>
              <span className="stat-skeleton" style={{ width: '75%', height: 18 }} />
            </div>
          </div>
        ) : authMode === 'unauthenticated' ? (
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

            <BottomDockNav />
            <GlobalMatchAcceptModal />
          </>
        )}
      </div>

      {toasts.length > 0 ? (
        <div className="blc-toast-stack" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="ui-metal-frame blc-toast" data-tone={t.tone}>
              <span>{t.text}</span>
              <button
                type="button"
                className="blc-btn blc-btn--ghost blc-btn--xs"
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
    <AppStoreProvider>
      <AppViewportRouter />
    </AppStoreProvider>
  );
}
