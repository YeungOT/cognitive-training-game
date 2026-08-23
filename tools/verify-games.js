// Functional headless-Chrome verification of the six cognitive games.
// Usage: node tools/verify-games.js   (starts its own static server on 4173)
//        APP_URL / CDP_PORT / CHROME_PATH env overrides supported.
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appUrl = process.env.APP_URL || 'http://localhost:4173/';
const port = Number(process.env.CDP_PORT || 9334);
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = path.join(os.tmpdir(), 'cognitive-games-cdp-' + Date.now());
const servePort = 4173;

const failures = [];
const errors = [];

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function getTargets() {
  const res = await fetch('http://127.0.0.1:' + port + '/json/list');
  return res.json();
}
async function waitForTargets(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const targets = await getTargets();
      const page = targets.find((t) => t.type === 'page');
      if (page) return page;
    } catch (e) {}
    await delay(200);
  }
  throw new Error('Chrome DevTools target did not appear');
}

async function main() {
  const server = spawn(process.execPath, [path.join(root, 'tools', 'serve.js'), String(servePort)], { stdio: 'ignore' });
  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + profileDir,
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    await delay(800);
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
      if (message.method === 'Runtime.exceptionThrown') {
        errors.push('exception: ' + JSON.stringify(message.params.exceptionDetails.exception && message.params.exceptionDetails.exception.description || message.params.exceptionDetails.text));
      }
      if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
        errors.push('console.error: ' + message.params.entry.text);
      }
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
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error('Evaluation failed: ' + JSON.stringify(result.exceptionDetails));
      return result.result.value;
    }
    async function check(name, fn) {
      try {
        const ok = await fn();
        console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
        if (!ok) failures.push(name);
      } catch (error) {
        console.log('FAIL - ' + name + ' (' + error.message + ')');
        failures.push(name);
      }
    }
    async function nav(screen) {
      await evaluate(`CognitiveRouter.navigate(${JSON.stringify(screen)})`);
      await delay(450);
    }
    async function dismiss() {
      await evaluate(`(() => { if (window.CognitiveMessage && typeof window.CognitiveMessage.dismiss === 'function') window.CognitiveMessage.dismiss(); return true; })()`);
      await delay(120);
    }
    async function key(k) {
      await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true }))`);
      await delay(80);
    }
    async function clickSel(sel) {
      return evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true; })()`);
    }
    async function countSel(sel) {
      return evaluate(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Log.enable');
    await send('Page.navigate', { url: appUrl });
    const start = Date.now();
    while (Date.now() - start < 30000) {
      const ready = await evaluate(`({ ready: document.readyState, hasRouter: !!window.CognitiveRouter, hasData: !!window.CognitiveFoodData })`).catch(() => null);
      if (ready && ready.ready === 'complete' && ready.hasRouter && ready.hasData) break;
      await delay(300);
    }
    await delay(600); // let self-mounts + main.js settle

    // ---------------- food ----------------
    await check('food: category select screen renders buttons', async () => {
      await nav('foodCategorySelect');
      return (await countSel('#foodCategoryGrid .category-btn')) > 0;
    });
    await check('food: start a category -> 3-card grid + question', async () => {
      await evaluate(`(() => { const btns = document.querySelectorAll('#foodCategoryGrid .category-btn:not(.random-btn)'); for (const b of btns) { if (!b.classList.contains('completed')) { b.click(); return true; } } return false; })()`);
      await delay(450);
      await dismiss();
      const cards = await countSel('#gridContainer .food-card');
      const q = await evaluate(`document.getElementById('questionText').innerHTML.length`);
      return cards === 3 && q > 0;
    });
    await check('food: clicking the correct card scores 1', async () => {
      await evaluate(`(() => { const c = document.querySelector('#gridContainer .food-card[data-correct="true"]'); if (!c) return false; c.click(); return true; })()`);
      await delay(900);
      return (await evaluate(`document.getElementById('foodScoreNum').textContent`)) === '1';
    });
    await check('food: count select 2 -> 2-card grid', async () => {
      await evaluate(`(() => { const s = document.getElementById('countSelect'); s.value = '2'; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
      await delay(300);
      return (await countSel('#gridContainer .food-card')) === 2;
    });
    await check('food: name toggle hides names via shared singleton', async () => {
      await evaluate(`document.getElementById('toggleNamesBtn').click()`);
      await delay(150);
      const hidden = await evaluate(`document.getElementById('foodGame').classList.contains('hide-names')`);
      const shared = await evaluate(`window.CognitiveNameVisibility.shared.isEnabled`);
      return hidden === true && shared === false;
    });
    await evaluate(`document.getElementById('toggleNamesBtn').click()`); // restore
    await delay(150);

    // ---------------- nback ----------------
    await check('nback: mode select -> single nback renders image', async () => {
      await nav('nbackModeSelect');
      await clickSel('#singleNbackBtn');
      await delay(500);
      const src = await evaluate(`document.getElementById('nbackImage').src`);
      const step = await evaluate(`document.getElementById('nbackStepLabel').textContent`);
      return typeof src === 'string' && src.length > 0 && step === '#1';
    });
    await check('nback: play + speed + space advance + pause', async () => {
      await dismiss(); // instruction modal open after entering the game
      await clickSel('#nbackPlayBtn');
      await delay(200);
      const playing = await evaluate(`document.getElementById('nbackPlayBtn').classList.contains('playing')`);
      await key('=');
      const speed = await evaluate(`document.getElementById('nbackSpeedDisplay').textContent`);
      await key(' ');
      await delay(350);
      const step = await evaluate(`document.getElementById('nbackStepLabel').textContent`);
      await key('p');
      await delay(150);
      const paused = !(await evaluate(`document.getElementById('nbackPlayBtn').classList.contains('playing')`));
      return playing && speed === '6' && step !== '#1' && paused;
    });

    // ---------------- dual-nback ----------------
    await check('dual-nback: settings -> start -> grid + 2 match buttons', async () => {
      await nav('dualNbackSettings');
      await evaluate(`(() => {
        document.getElementById('dualModality1Select').value = 'image';
        document.getElementById('dualModality2Select').value = 'position';
        document.getElementById('dualPositionGridSelect').value = '3x3';
        document.getElementById('dualModality1Select').dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`);
      await delay(150);
      const enabled = await evaluate(`!document.getElementById('dualStartBtn').disabled`);
      await clickSel('#dualStartBtn');
      await delay(500);
      const gridVisible = await evaluate(`!document.getElementById('dualNbackGrid').classList.contains('hidden')`);
      const cells = await countSel('#dualNbackGrid .dual-grid-cell');
      const matchBtns = await countSel('#dualNbackMatchButtons .dual-match-btn');
      return enabled && gridVisible && cells === 9 && matchBtns === 2;
    });
    await check('dual-nback: J + Space + P run without error', async () => {
      await key('j');
      await delay(150);
      await key(' ');
      await delay(150);
      await key('p');
      await delay(150);
      return true; // no exception is the assertion (errors captured globally)
    });

    // ---------------- gng ----------------
    await check('gng: settings -> start -> 1-card grid + rule labels', async () => {
      await nav('gngSettings');
      await evaluate(`(() => {
        document.getElementById('gngGoCategory').value = '水果';
        document.getElementById('gngNoGoCategory').value = '全部';
        document.getElementById('gngSwitchType').value = 'swap';
        document.getElementById('gngSwitchFreq').value = '10';
        return true;
      })()`);
      await clickSel('#gngStartBtn');
      await delay(650);
      await dismiss();
      const cards = await countSel('#gngGridContainer .gng-card');
      const goLabel = await evaluate(`document.getElementById('gngGoLabel').textContent`);
      return cards >= 1 && goLabel === '水果';
    });
    await check('gng: J response + Space next run without error', async () => {
      await key('j');
      await delay(750);
      await key(' ');
      await delay(300);
      return true;
    });

    // ---------------- different ----------------
    await check('different: start -> 4 cards, click correct scores 1', async () => {
      await nav('differentGame');
      await delay(500);
      await dismiss();
      const cards = await countSel('#differentGridContainer .different-card');
      await evaluate(`(() => { const c = document.querySelector('#differentGridContainer .different-card[data-correct="true"]'); if (!c) return false; c.click(); return true; })()`);
      await delay(800);
      const score = await evaluate(`document.getElementById('differentScoreNum').textContent`);
      return cards === 4 && score === '1';
    });

    // ---------------- shopping ----------------
    await check('shopping: settings -> list phase renders 3 cards', async () => {
      await nav('shoppingSettings');
      await evaluate(`(() => {
        document.getElementById('shoppingListDisplayMode').value = 'image';
        document.getElementById('shoppingListCount').value = '3';
        document.getElementById('shoppingMemoryTime').value = 'manual';
        document.getElementById('shoppingChoiceCount').value = '6';
        document.getElementById('shoppingOrderRequired').value = 'false';
        document.getElementById('shoppingRecallTime').value = '0';
        return true;
      })()`);
      await clickSel('#shoppingStartBtn');
      await delay(500);
      await dismiss();
      const cards = await countSel('#shoppingListGrid .shopping-list-card');
      return cards === 3;
    });
    await check('shopping: manual start -> recall grid 6 -> pick 3 targets -> complete', async () => {
      await clickSel('#shoppingManualStartBtn');
      await delay(400);
      const recallCards = await countSel('#shoppingRecallGrid .shopping-recall-card');
      await evaluate(`(() => { const targets = document.querySelectorAll('#shoppingRecallGrid .shopping-recall-card[data-target="true"]'); targets.forEach((c, i) => setTimeout(() => c.click(), i * 250)); return targets.length; })()`);
      await delay(1600);
      const score = await evaluate(`document.getElementById('shoppingScoreNum').textContent`);
      const progress = await evaluate(`document.getElementById('shoppingProgress').textContent`);
      return recallCards === 6 && score === '3' && progress.indexOf('3 / 3') !== -1;
    });
    await check('shopping: name toggle shared with food singleton', async () => {
      await clickSel('#shoppingNameToggleBtn');
      await delay(150);
      const shared = await evaluate(`window.CognitiveNameVisibility.shared.isEnabled`);
      await nav('foodCategorySelect');
      const foodHidden = await evaluate(`document.getElementById('foodGame').classList.contains('hide-names')`);
      await evaluate(`window.CognitiveNameVisibility.shared.set(true); window.CognitiveNameVisibility.shared.apply()`);
      return shared === false && foodHidden === true;
    });

    // ---------------- summary ----------------
    console.log('pageErrors=' + JSON.stringify(errors));
    const pass = failures.length === 0 && errors.length === 0;
    console.log('result=' + (pass ? 'PASS' : 'FAIL') + ' checks=' + (failures.length === 0 ? 'all' : failures.length + ' failed'));
    if (!pass) process.exitCode = 1;
    ws.close();
  } finally {
    chrome.kill();
    server.kill();
    await delay(500);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});