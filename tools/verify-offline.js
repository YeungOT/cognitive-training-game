const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appUrl = process.env.APP_URL || 'http://localhost:4173/';
const port = Number(process.env.CDP_PORT || 9333);
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = path.join(os.tmpdir(), 'cognitive-pwa-cdp-' + Date.now());

const swSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const appAssetMatch = swSource.match(/const APP_ASSET_PATHS = (\[[\s\S]*?\]);/);
const mediaAssetMatch = swSource.match(/const MEDIA_ASSET_PATHS = (\[[\s\S]*?\]);/);
const toPaths = (entries) => entries.map((entry) => typeof entry === 'string' ? entry : entry.path);
const appAssets = toPaths(JSON.parse(appAssetMatch[1]));
const mediaAssets = toPaths(JSON.parse(mediaAssetMatch[1]));
const expectedAssets = appAssets.length + mediaAssets.length;
const sampleAsset = mediaAssets.find((name) => name.startsWith('assets/food/'));
const imageAssets = mediaAssets.filter((name) => /\.(webp|png|svg)$/i.test(name));

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getTargets() {
  const response = await fetch('http://127.0.0.1:' + port + '/json/list');
  return response.json();
}

async function waitForTargets(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const targets = await getTargets();
      const page = targets.find((target) => target.type === 'page');
      if (page) return page;
    } catch (error) {}
    await delay(200);
  }
  throw new Error('Chrome DevTools target did not appear');
}

async function main() {
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + profileDir,
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    const page = await waitForTargets(20000);
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });

    let nextId = 1;
    const pending = new Map();
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id || !pending.has(message.id)) return;
      const handlers = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) handlers.reject(new Error(message.error.message));
      else handlers.resolve(message.result);
    });

    function send(method, params) {
      return new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params: params || {} }));
      });
    }

    async function evaluate(expression) {
      const result = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true
      });
      if (result.exceptionDetails) {
        throw new Error('Evaluation failed: ' + JSON.stringify(result.exceptionDetails));
      }
      return result.result.value;
    }

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

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');
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

    ws.close();
  } finally {
    chrome.kill();
    await delay(500);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
