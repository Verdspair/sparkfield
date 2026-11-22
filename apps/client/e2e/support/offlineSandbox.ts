import { expect, type Page } from '@playwright/test';
import { expectDirectLobby, localToken } from './flowHelpers.js';

export async function installOfflineSandboxHarness(page: Page) {
  await page.route((url) => url.pathname === '/src/pages/LobbyPage.tsx' && !url.searchParams.has('offline-sandbox-harness'),
    (route) => route.fulfill({
      contentType: 'application/javascript',
      body: `
        import React from '/node_modules/.vite/deps/react.js';
        import { LobbyPage as RealLobbyPage } from '/src/pages/LobbyPage.tsx?offline-sandbox-harness';
        import { useAppStore } from '/src/store/appStore.tsx';
        export function LobbyPage() {
          const { authMode, profile, enterOfflinePractice } = useAppStore();
          React.useEffect(() => {
            if (authMode !== 'authenticated' || !profile?.userId) return;
            window.addEventListener('sparkfield:e2e-offline-sandbox', enterOfflinePractice);
            return () => window.removeEventListener('sparkfield:e2e-offline-sandbox', enterOfflinePractice);
          }, [authMode, profile?.userId, enterOfflinePractice]);
          return React.createElement(RealLobbyPage);
        }
      `,
    }));
}

export async function enterOfflineSandboxFromLobby(page: Page) {
  await expectDirectLobby(page);
  await expect.poll(() => localToken(page)).toBeTruthy();
  await page.evaluate(() => window.dispatchEvent(new Event('sparkfield:e2e-offline-sandbox')));
  await expect(page.getByTestId('lobby-page')).toContainText('离线星港领航员');
  await expectDirectLobby(page);
}
