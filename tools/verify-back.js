// Back-button gate. Asserts every game's back button actually navigates away,
// by dispatching a real mouse click at the button's on-screen centre.
//
// Why this exists: each composer-built game declares a back button through the
// shared Game Screen (`backId`), but the Game Screen only CREATES the element.
// Each game is separately responsible for wiring its click handler, and a
// missing handler produces a button that renders perfectly and does nothing --
// which no existence check can catch. `verify-games.js` asserted only that
// `#palmBackBtn` was present in the DOM, so the dead button sailed through.
//
// Usage: node tools/verify-back.js
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appUrl = 'http://localhost:4186/';
const port = Number(process.env.CDP_PORT || 9342);
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = path.join(os.tmpdir(), 'cognitive-back-' + Date.now());

// steps mirror tools/verify-layout.js so both gates agree on how to reach a game.
const SCREENS = [
    // Palm is entered from a home tile (data-router-target), not the registry,
    // so click the real tile rather than calling navigate() directly.
    { name: 'palm', backId: 'palmBackBtn', expectBackTo: 'home', steps: ["document.querySelector('[data-router-target=\"palm\"]').click()"] },
    { name: 'gng', backId: 'gngBackBtn', steps: ["CognitiveRouter.navigate('mainMenu')", "document.getElementById('gameGngBtn').click()", "document.getElementById('gngStartBtn').click()"] },
    { name: 'nback', backId: 'nbackBackBtn', steps: ["CognitiveRouter.navigate('nbackModeSelect')", "document.getElementById('singleNbackBtn').click()"] },
    {
        name: 'dual',
        backId: 'dualNbackBackBtn',
        steps: [
            "CognitiveRouter.navigate('nbackModeSelect')",
            "document.getElementById('dualNbackBtn').click()",
            "(() => { const a = document.getElementById('dualModality1Select'); a.value = 'position'; a.dispatchEvent(new Event('change')); const b = document.getElementById('dualModality2Select'); b.value = 'image'; b.dispatchEvent(new Event('change')); return 1; })()",
            "document.getElementById('dualStartBtn').click()"
        ]
    },
    { name: 'food', backId: 'foodBackBtn', steps: ["CognitiveRouter.navigate('mainMenu')", "document.getElementById('gameFoodBtn').click()", "document.querySelector('#foodCategorySelect .category-btn').click()"] },
    {
        name: 'shopping',
        backId: 'shoppingBackBtn',
        steps: [
            "CognitiveRouter.navigate('mainMenu')",
            "document.getElementById('gameShoppingBtn').click()",
            "document.getElementById('shoppingStartBtn').click()",
            "document.getElementById('shoppingManualStartBtn').click()"
        ]
    },
    { name: 'different', backId: 'differentBackBtn', steps: ["CognitiveRouter.navigate('mainMenu')", "document.getElementById('gameDifferentBtn').click()"] },
    { name: 'pairs', backId: 'pairsBackBtn', steps: ["CognitiveRouter.navigate('mainMenu')", "document.getElementById('gamePairsBtn').click()", "document.getElementById('pairsStartBtn').click()"] },
    { name: 'reality', backId: 'realityBackBtn', steps: ["CognitiveRouter.navigate('realityBoard')"] }
];

const failures = [];
const errors = [];
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function fail(m) { failures.push(m); console.log('FAIL - ' + m); }
function pass(m) { console.log('PASS - ' + m); }

async function main() {
    const server = spawn(process.execPath, [path.join(root, 'tools', 'serve.js'), '4186'], { stdio: 'ignore' });
    const chrome = spawn(chromePath, [
        '--headless=new', '--disable-gpu', '--no-sandbox',
        '--remote-debugging-port=' + port,
        '--user-data-dir=' + profileDir,
        'about:blank'
    ], { stdio: 'ignore' });

    let ws;
    try {
        await delay(900);
        let page = null;
        const started = Date.now();
        while (Date.now() - started < 20000 && !page) {
            try {
                const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
                page = list.find(t => t.type === 'page');
            } catch (e) {}
            if (!page) await delay(200);
        }
        if (!page) throw new Error('Chrome DevTools target did not appear');

        ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((res, rej) => {
            ws.addEventListener('open', res, { once: true });
            ws.addEventListener('error', rej, { once: true });
        });
        let nextId = 1;
        const pending = new Map();
        ws.addEventListener('message', ev => {
            const m = JSON.parse(String(ev.data));
            if (m.method === 'Runtime.exceptionThrown') {
                errors.push('exception: ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text));
            }
            if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
                errors.push('console.error: ' + m.params.entry.text);
            }
            if (!m.id || !pending.has(m.id)) return;
            const h = pending.get(m.id);
            pending.delete(m.id);
            if (m.error) h.reject(new Error(m.error.message)); else h.resolve(m.result);
        });
        const send = (method, params) => new Promise((resolve, reject) => {
            const id = nextId++;
            pending.set(id, { resolve, reject });
            ws.send(JSON.stringify({ id, method, params: params || {} }));
        });
        const evaluate = async (expression) => {
            const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
            if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
            return r.result.value;
        };

        await send('Page.enable');
        await send('Runtime.enable');
        await send('Log.enable');
        await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
        await send('Page.navigate', { url: appUrl });
        await delay(2400);
        // The app precaches behind a service worker; a fresh sw.js only activates
        // after a load, so measuring without this reads stale assets.
        await evaluate("(async () => { const rs = await navigator.serviceWorker.getRegistrations(); for (const r of rs) { await r.unregister(); } const ks = await caches.keys(); for (const k of ks) { await caches.delete(k); } return 1; })()");
        await send('Page.reload');
        await delay(2400);
        for (let i = 0; i < 60; i++) {
            const booted = await evaluate("(() => { const l = document.getElementById('bootLoader'); return (!l || l.classList.contains('hidden') || l.getClientRects().length === 0) && document.readyState === 'complete' && !!window.CognitiveRouter; })()").catch(() => false);
            if (booted) break;
            await delay(250);
        }

        const VISIBLE = "(() => { const s = [...document.querySelectorAll('.app-screen')].filter(x => !x.classList.contains('hidden') && x.getClientRects().length > 0); return s.map(x => x.id).join(',') || 'none'; })()";

        for (const screen of SCREENS) {
            await evaluate("window.CognitiveRouter.goHome()");
            await delay(500);
            let reached = true;
            for (const step of screen.steps) {
                try { await evaluate(step); } catch (e) { reached = false; }
                await delay(600);
            }
            await evaluate("(() => { if (window.CognitiveMessage) window.CognitiveMessage.dismiss(); return 1; })()");
            await delay(550);

            const before = await evaluate(VISIBLE);
            const box = await evaluate(`(() => {
                const el = document.getElementById(${JSON.stringify(screen.backId)});
                if (!el) return null;
                const r = el.getBoundingClientRect();
                return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) };
            })()`);

            if (!box) {
                fail(screen.name + ': back button #' + screen.backId + ' does not exist');
                continue;
            }
            if (box.w < 1 || box.h < 1) {
                fail(screen.name + ': back button #' + screen.backId + ' exists but is not visible');
                continue;
            }

            // Real dispatched click at the button centre, so hit-testing counts too.
            await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1, buttons: 1 });
            await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1, buttons: 0 });
            await delay(800);
            const after = await evaluate(VISIBLE);

            if (!reached) {
                fail(screen.name + ': could not reach the game screen, so the back test is inconclusive (visible=' + before + ')');
            } else if (after === before) {
                fail(screen.name + ': clicking #' + screen.backId + ' did NOT navigate away (still on "' + before + '") -- button is dead');
            } else if (screen.expectBackTo && after !== screen.expectBackTo) {
                fail(screen.name + ': #' + screen.backId + ' went to "' + after + '" but should return to "' + screen.expectBackTo + '"');
            } else {
                pass(screen.name + ': #' + screen.backId + ' navigates ' + before + ' -> ' + after);
            }
        }

        console.log('');
        if (errors.length) {
            console.log('page errors:');
            errors.forEach(e => console.log('  ' + e));
            failures.push('page errors: ' + errors.length);
        }
    } finally {
        try { if (ws) ws.close(); } catch (e) {}
        try { server.kill(); } catch (e) {}
        try { chrome.kill(); } catch (e) {}
    }

    if (failures.length) {
        console.log('\n' + failures.length + ' check(s) failed');
        process.exit(1);
    }
    console.log('\nAll back-button checks passed');
}

main().catch(e => { console.error('GATE ERROR: ' + e.message); process.exit(1); });
