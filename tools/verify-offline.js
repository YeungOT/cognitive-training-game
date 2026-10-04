const fs = require('fs');
const path = require('path');
const { launch, delay } = require('./lib/cdp-harness');

const root = path.resolve(__dirname, '..');
const appUrl = process.env.APP_URL || 'http://localhost:4173/';
const port = Number(process.env.CDP_PORT || 9333);

const swSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const appAssetMatch = swSource.match(/const APP_ASSET_PATHS = (\[[\s\S]*?\]);/);
const mediaAssetMatch = swSource.match(/const MEDIA_ASSET_PATHS = (\[[\s\S]*?\]);/);
const toPaths = (entries) => entries.map((entry) => typeof entry === 'string' ? entry : entry.path);
const appAssets = toPaths(JSON.parse(appAssetMatch[1]));
const mediaAssets = toPaths(JSON.parse(mediaAssetMatch[1]));
const expectedAssets = appAssets.length + mediaAssets.length;
const sampleAsset = mediaAssets.find((name) => name.startsWith('assets/food/'));
const imageAssets = mediaAssets.filter((name) => /\.(webp|png|svg)$/i.test(name));

async function main() {
  let browser = null;
  try {
    // This gate used to spawn Chrome but NOT a static server, so it only ever
    // worked if something else was already serving the app on the same port.
    // Run standalone, Page.navigate hit a refused connection, location.href
    // stayed about:blank, and waitForReady threw "Page did not become ready".
    // That is why it rotted: it was not wired into `npm run verify`, so nothing
    // noticed. launch() owns the server now, so the gate is self-contained.
    browser = await launch({
      servePort: new URL(appUrl).port || '4173',
      cdpPort: port,
      appUrl: appUrl,
      profilePrefix: 'cognitive-offline',
      quiet: true
    });

    const { send, evaluate } = browser;
    await send('Network.enable');

    async function waitForReady(timeoutMs) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        try {
          const state = await evaluate(`({
            ready: document.readyState,
            href: location.href
          })`);
          if (state.ready === 'complete' && state.href.startsWith(appUrl)) return;
        } catch (error) {}
        await delay(250);
      }
      throw new Error('Page did not become ready');
    }

    async function waitForServiceWorker(timeoutMs) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const state = await evaluate(`new Promise((resolve) => {
          if (!('serviceWorker' in navigator)) {
            resolve({ ok: false, reason: 'unsupported' });
            return;
          }
          navigator.serviceWorker.ready.then((registration) => {
            resolve({
              ok: true,
              state: registration.active ? registration.active.state : null
            });
          });
          setTimeout(() => resolve({ ok: false, reason: 'timeout' }), 8000);
        })`);
        if (state.ok) return state;
        await delay(1000);
      }
      throw new Error('Service worker did not become ready');
    }

    async function getCacheInfo() {
      return evaluate(`(async () => {
        const keys = await caches.keys();
        const result = [];
        for (const key of keys) {
          const cache = await caches.open(key);
          const entries = await cache.keys();
          result.push({ key, count: entries.length });
        }
        return result;
      })()`);
    }

    await send('Page.navigate', { url: appUrl });
    await waitForReady(30000);

    const swState = await waitForServiceWorker(120000);
    console.log('serviceWorker=' + JSON.stringify(swState));

    const cacheStart = Date.now();
    let cacheInfo = await getCacheInfo();
    while (Date.now() - cacheStart < 180000) {
      const total = cacheInfo.reduce((sum, item) => sum + item.count, 0);
      if (total >= expectedAssets) break;
      await delay(2000);
      cacheInfo = await getCacheInfo();
    }

    const totalCached = cacheInfo.reduce((sum, item) => sum + item.count, 0);
    console.log('cache=' + JSON.stringify({
      expected: expectedAssets,
      actual: totalCached,
      buckets: cacheInfo
    }));

    let controlled = false;
    const controlStart = Date.now();
    while (Date.now() - controlStart < 60000) {
      const controlInfo = await evaluate(`(async () => {
        if (!('serviceWorker' in navigator)) return { ok: false, reason: 'unsupported' };
        const registration = await navigator.serviceWorker.ready;
        const state = registration.active ? registration.active.state : null;
        return {
          ok: state === 'activated',
          state,
          controller: !!navigator.serviceWorker.controller
        };
      })()`);
      if (controlInfo.ok && controlInfo.controller) {
        controlled = true;
        break;
      }
      await send('Page.navigate', { url: appUrl });
      await waitForReady(30000);
    }
    if (!controlled) throw new Error('Service worker did not control the page');

    await send('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0
    });
    await send('Page.navigate', { url: appUrl });
    await waitForReady(30000);

    const offlineState = await evaluate(`(async () => {
      const result = {
        title: document.title,
        homeVisible: !!document.querySelector('.home-overlay'),
        controller: !!navigator.serviceWorker.controller
      };
      if (${JSON.stringify(sampleAsset)}) {
        result.imageLoaded = await new Promise((resolve) => {
          const image = new Image();
          image.onload = () => resolve(true);
          image.onerror = () => resolve(false);
          image.src = ${JSON.stringify(sampleAsset)};
        });
      }
      return result;
    })()`);

    console.log('offline=' + JSON.stringify(offlineState));

    const offlineImages = await evaluate(`(async () => {
      const assets = ${JSON.stringify(imageAssets)};
      const failures = [];
      for (const asset of assets) {
        const loaded = await new Promise((resolve) => {
          const image = new Image();
          image.onload = () => resolve(true);
          image.onerror = () => resolve(false);
          image.src = asset;
        });
        if (!loaded) failures.push(asset);
      }
      return { checked: assets.length, failures };
    })()`);

    console.log('offlineImages=' + JSON.stringify(offlineImages));

    const pass =
      swState.ok === true &&
      totalCached >= expectedAssets &&
      offlineState.title === '認知訓練' &&
      offlineState.homeVisible === true &&
      offlineState.controller === true &&
      offlineImages.checked === imageAssets.length &&
      offlineImages.failures.length === 0;

    console.log('result=' + (pass ? 'PASS' : 'FAIL'));
    if (!pass) process.exitCode = 1;

  } finally {
    if (browser) await browser.close();
    await delay(500);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
