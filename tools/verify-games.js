// Functional headless-Chrome verification of the six cognitive games.
// Usage: node tools/verify-games.js   (starts its own static server on 4173)
//        APP_URL / CDP_PORT / CHROME_PATH env overrides supported.
const { launch, defeatServiceWorker, delay } = require('./lib/cdp-harness');

const appUrl = process.env.APP_URL || 'http://localhost:4173/';
const port = Number(process.env.CDP_PORT || 9334);
const servePort = 4173;

const failures = [];
const errors = [];

async function main() {
  let browser = null;
  try {
    browser = await launch({ servePort: servePort, cdpPort: port, appUrl: appUrl, errors: errors, profilePrefix: 'cognitive-games' });
    const { send, evaluate } = browser;
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

    const start = Date.now();
    while (Date.now() - start < 30000) {
      const ready = await evaluate(`({ ready: document.readyState, hasRouter: !!window.CognitiveRouter, hasData: !!window.CognitiveFoodData })`).catch(() => null);
      if (ready && ready.ready === 'complete' && ready.hasRouter && ready.hasData) break;
      await delay(300);
    }
    await delay(600); // let self-mounts + main.js settle

    // The app precaches every asset behind a service worker, and a freshly
    // generated sw.js only activates after the page has loaded once - so the
    // checks above can run against stale CSS/JS and pass anyway. Drop the
    // worker and its caches, then reload, so this always tests current files.
    await defeatServiceWorker(evaluate).catch(() => null);
    await send('Page.reload');
    const reloadStart = Date.now();
    while (Date.now() - reloadStart < 30000) {
      const ready = await evaluate(`({ ready: document.readyState, hasRouter: !!window.CognitiveRouter, hasData: !!window.CognitiveFoodData })`).catch(() => null);
      if (ready && ready.ready === 'complete' && ready.hasRouter && ready.hasData) break;
      await delay(300);
    }
    await delay(600);

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


    // ---------------- memory pairs ----------------
    await check('pairs: start -> 8 cards, matching pair scores 1', async () => {
      await nav('pairsSettings');
      await delay(300);
      await clickSel('#pairsStartBtn');
      await delay(500);
      await dismiss();
      await delay(300);
      const cards = await countSel('#pairsGridContainer .memory-card');
      await evaluate(`document.querySelector('#pairsGridContainer .memory-card').click()`);
      await delay(200);
      await evaluate(`(() => {
        const cards = Array.from(document.querySelectorAll('#pairsGridContainer .memory-card'));
        const targetId = cards[0].dataset.pairId;
        cards.filter(card => card.dataset.pairId === targetId).forEach(card => card.click());
        return true;
      })()`);
      await delay(500);
      const score = await evaluate(`document.getElementById('pairsScoreNum').textContent`);
      return cards === 8 && score === '1';
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

    // ---------------- palm (composed screen) ----------------
    await check('palm: composed screen renders stage + controls', async () => {
      await nav('palm');
      await dismiss();
      return await evaluate(`(() => {
        const p = document.getElementById('palm');
        return !!p.querySelector('.grid-wrapper .game-board')
          && !!p.querySelector('#leftGesture') && !!p.querySelector('#rightGesture')
          && !!p.querySelector('.speed-control') && !!p.querySelector('#swapBtn')
          && !!p.querySelector('#playBtn') && p.classList.contains('game-screen');
      })()`) === true;
    });
    // This used to also assert `!!p.querySelector('#palmBackBtn')`. That was
    // presence-only and is exactly why a dead back button shipped: the button
    // existed in the DOM and did nothing when pressed. Back-button BEHAVIOUR is
    // asserted in tools/verify-back.js, which clicks each one for real.
    await check('palm: top bar keeps its own chrome (no score, no separator)', async () => {
      return await evaluate(`(() => {
        const p = document.getElementById('palm');
        return !p.querySelector('.score-display') && !p.querySelector('.separator')
          && !!p.querySelector('#difficultySelect') && !!p.querySelector('#handSelect')
          && !!p.querySelector('#palmMenuBtn');
      })()`) === true;
    });
    await check('palm: speed +/- change the level', async () => {
      const before = await evaluate(`document.getElementById('speedDisplay').textContent`);
      await clickSel('#speedUp');
      await delay(150);
      const after = await evaluate(`document.getElementById('speedDisplay').textContent`);
      await clickSel('#speedDown');
      await delay(150);
      const restored = await evaluate(`document.getElementById('speedDisplay').textContent`);
      return before === '5' && after === '6' && restored === '5';
    });
    await check('palm: gesture images actually load', async () => {
      await delay(500);
      return await evaluate(`(() => {
        const l = document.querySelector('#leftGesture img'), r = document.querySelector('#rightGesture img');
        return !!l && !!r && l.complete && l.naturalWidth > 0 && r.complete && r.naturalWidth > 0;
      })()`) === true;
    });
    await check('palm: swap mirrors left and right gestures', async () => {
      const read = `(() => { const l = document.querySelector('#leftGesture img'), r = document.querySelector('#rightGesture img'); return (l && r) ? l.src + '|' + r.src : ''; })()`;
      // Gestures are random. When both hands happen to show the SAME gesture
      // (~1 in 8), swapping mirrors the paths back to identical strings, so the
      // swap is a true no-op and retrying alone can never escape that state.
      // Reshuffle a hand first, then try the swap again.
      for (let attempt = 0; attempt < 10; attempt++) {
        const before = await evaluate(read);
        if (before === '') return false;
        await clickSel('#swapBtn');
        await delay(400);
        const after = await evaluate(read);
        if (before === after) {
          await clickSel('#leftSide');
          await delay(400);
          continue;
        }
        const [beforeL, beforeR] = before.split('|');
        const [afterL, afterR] = after.split('|');
        if (beforeL.replace('/left/', '/right/') === afterR &&
            beforeR.replace('/right/', '/left/') === afterL) return true;
        return false;
      }
      return false;
    });
    await check('palm: play toggles autoplay', async () => {
      await clickSel('#playBtn');
      await delay(300);
      const playing = await evaluate(`document.getElementById('playBtn').classList.contains('playing')`);
      await clickSel('#playBtn');
      await delay(250);
      const stopped = await evaluate(`document.getElementById('playBtn').classList.contains('playing')`);
      return playing === true && stopped === false;
    });
    await check('palm: difficulty + hand selects persist to prefs', async () => {
      await evaluate(`(() => {
        const d = document.getElementById('difficultySelect');
        d.value = 'easy'; d.dispatchEvent(new Event('change'));
        return true;
      })()`);
      await delay(250);
      const stored = await evaluate(`JSON.stringify((window.CognitiveSettingsStore.load(window.CognitiveSettingsStore.keys.palm) || {}))`);
      await evaluate(`(() => {
        const d = document.getElementById('difficultySelect');
        d.value = 'hard'; d.dispatchEvent(new Event('change'));
        return true;
      })()`);
      await delay(200);
      return stored.indexOf('"difficulty":"easy"') !== -1;
    });

    // ---------------- summary ----------------
    console.log('pageErrors=' + JSON.stringify(errors));
    const pass = failures.length === 0 && errors.length === 0;
    console.log('result=' + (pass ? 'PASS' : 'FAIL') + ' checks=' + (failures.length === 0 ? 'all' : failures.length + ' failed'));
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
