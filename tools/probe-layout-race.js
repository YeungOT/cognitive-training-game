// Diagnostic probe for the unexplained verify:layout flake.
//
// That gate failed ONCE on iphone-se/food ("top region overlaps the stage by
// 38px", top-bar 38 instead of 41.8) and then passed on identical code. Two
// candidate causes were already measured and disproven, so this probe attacks
// it the only way left: stop waiting for the flake to appear by chance and
// compare the two measurement strategies head to head, many times over.
//
// For each iteration it measures the SAME screen twice:
//   legacy  - exactly when the old gate measured: after fixed delays, no wait
//   settled - after settleLayout() (transition class clear, one screen visible,
//             same screen on a second sample)
// If legacy ever violates the overlap invariant where settled does not, then
// settleLayout is the fix and the earlier "green runs prove nothing" objection
// is answered. If both agree every time, the flake needs a different trigger
// entirely and this probe says so instead of implying a cure.
//
// Usage: node tools/probe-layout-race.js [iterations]
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appUrl = 'http://localhost:4188/';
const port = Number(process.env.CDP_PORT || 9343);
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = path.join(os.tmpdir(), 'cognitive-race-' + Date.now());
const ITERATIONS = Number(process.argv[2] || 12);
const TOL = 1;

// Identical to verify-layout.js so the verdicts are comparable.
const SCREENS = [
    { name: 'food', steps: ["CognitiveRouter.navigate('mainMenu')", "document.getElementById('gameFoodBtn').click()", "document.querySelector('#foodCategorySelect .category-btn').click()"] },
    { name: 'gng', steps: ["CognitiveRouter.navigate('mainMenu')", "document.getElementById('gameGngBtn').click()", "document.getElementById('gngStartBtn').click()"] },
    { name: 'shopping', steps: ["CognitiveRouter.navigate('mainMenu')", "document.getElementById('gameShoppingBtn').click()", "document.getElementById('shoppingStartBtn').click()", "document.getElementById('shoppingManualStartBtn').click()"] },
    { name: 'palm', steps: ["document.querySelector('[data-router-target=\"palm\"]').click()"] }
];
const VIEWPORT = { name: 'iphone-se', w: 667, h: 375 };

const METRIC = "(() => { const s=[...document.querySelectorAll('.app-screen')].filter(x=>!x.classList.contains('hidden'))[0]; if(!s) return null; const box=e=>{ if(!e) return null; const r=e.getBoundingClientRect(); return {w:Math.round(r.width*10)/10,h:Math.round(r.height*10)/10,y:Math.round(r.y*10)/10,b:Math.round(r.bottom*10)/10,x:Math.round(r.x*10)/10}; }; const kids=[...s.children]; return { screen:s.id, top:box(kids[0]), stage:box(kids[1]), bottom:box(kids[2]) }; })()";
const SETTLE_STATE = "(() => { const vis = [...document.querySelectorAll('.app-screen')].filter(x => !x.classList.contains('hidden') && x.getClientRects().length > 0); return { n: vis.length, ids: vis.map(x => x.id).join(','), transitioning: document.body.classList.contains('cognitive-screen-transition') }; })()";

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
// The invariant verify-layout asserts: the top region must not overlap the stage.
function overlapBy(m) {
    if (!m || !m.top || !m.stage) return null;
    return Math.round((m.top.b - m.stage.y) * 10) / 10;
}

async function main() {
    const server = spawn(process.execPath, [path.join(root, 'tools', 'serve.js'), '4188'], { stdio: 'ignore' });
    const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + port, '--user-data-dir=' + profileDir, 'about:blank'], { stdio: 'ignore' });
    let ws;
    try {
        await delay(900);
        let page = null;
        const t0 = Date.now();
        while (Date.now() - t0 < 20000 && !page) {
            try { page = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).find(t => t.type === 'page'); } catch (e) {}
            if (!page) await delay(200);
        }
        if (!page) throw new Error('no CDP target');
        ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
        let nextId = 1;
        const pending = new Map();
        ws.addEventListener('message', ev => {
            const m = JSON.parse(String(ev.data));
            if (!m.id || !pending.has(m.id)) return;
            const h = pending.get(m.id); pending.delete(m.id);
            m.error ? h.reject(new Error(m.error.message)) : h.resolve(m.result);
        });
        const send = (method, params) => new Promise((resolve, reject) => {
            const id = nextId++; pending.set(id, { resolve, reject });
            ws.send(JSON.stringify({ id, method, params: params || {} }));
        });
        const evaluate = async (expression) => {
            const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
            if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
            return r.result.value;
        };

        await send('Page.enable');
        await send('Runtime.enable');
        await send('Emulation.setDeviceMetricsOverride', { width: VIEWPORT.w, height: VIEWPORT.h, deviceScaleFactor: 1, mobile: false });
        await send('Page.navigate', { url: appUrl });
        await delay(2400);
        await evaluate("(async () => { const rs = await navigator.serviceWorker.getRegistrations(); for (const r of rs) { await r.unregister(); } const ks = await caches.keys(); for (const k of ks) { await caches.delete(k); } return 1; })()");
        await send('Page.reload');
        await delay(2400);
        for (let i = 0; i < 60; i++) {
            const booted = await evaluate("(() => { const l = document.getElementById('bootLoader'); return (!l || l.classList.contains('hidden') || l.getClientRects().length === 0) && document.readyState === 'complete' && !!window.CognitiveRouter; })()").catch(() => false);
            if (booted) break;
            await delay(250);
        }

        async function settle() {
            for (let i = 0; i < 50; i++) {
                const s = await evaluate(SETTLE_STATE).catch(() => null);
                if (s && s.n === 1 && !s.transitioning) {
                    await delay(120);
                    const again = await evaluate(SETTLE_STATE).catch(() => null);
                    if (again && again.n === 1 && !again.transitioning && again.ids === s.ids) return true;
                }
                await delay(120);
            }
            return false;
        }

        console.log('probe: ' + VIEWPORT.name + ' ' + VIEWPORT.w + 'x' + VIEWPORT.h + ', ' + ITERATIONS + ' iterations x ' + SCREENS.length + ' screens');
        console.log('invariant: top.b - stage.y must be <= ' + TOL + '\n');
        const totals = { legacyBad: 0, settledBad: 0, disagree: 0, samples: 0, neverSettled: 0 };
        const badSamples = [];

        for (let iter = 1; iter <= ITERATIONS; iter++) {
            for (const screen of SCREENS) {
                await evaluate("window.CognitiveRouter.goHome()");
                await delay(400);
                for (const step of screen.steps) {
                    try { await evaluate(step); } catch (e) {}
                    await delay(600);
                }
                await evaluate("(() => { if (window.CognitiveMessage) window.CognitiveMessage.dismiss(); return 1; })()");
                await delay(550);

                // 1. legacy: exactly where the old gate measured.
                const legacy = await evaluate(METRIC).catch(() => null);
                const legacyOverlap = overlapBy(legacy);
                // 2. settled: after the new guard.
                const didSettle = await settle();
                const settled = await evaluate(METRIC).catch(() => null);
                const settledOverlap = overlapBy(settled);

                totals.samples++;
                const legacyBad = legacyOverlap !== null && legacyOverlap > TOL;
                const settledBad = settledOverlap !== null && settledOverlap > TOL;
                if (!didSettle) totals.neverSettled++;
                if (legacyBad) totals.legacyBad++;
                if (settledBad) totals.settledBad++;
                if (legacyBad !== settledBad) {
                    totals.disagree++;
                    badSamples.push({ iter, screen: screen.name, legacy: legacyOverlap, settled: settledOverlap, legacyBox: legacy, settledBox: settled });
                }
                if (legacyBad || settledBad) {
                    console.log('VIOLATION iter=' + iter + ' screen=' + screen.name + ' legacy=' + legacyOverlap + ' settled=' + settledOverlap);
                    console.log('   legacy  ' + JSON.stringify({ screen: legacy && legacy.screen, top: legacy && legacy.top, stage: legacy && legacy.stage }));
                    console.log('   settled ' + JSON.stringify({ screen: settled && settled.screen, top: settled && settled.top, stage: settled && settled.stage }));
                }
            }
            console.log('iteration ' + iter + '/' + ITERATIONS + ' done (legacyBad=' + totals.legacyBad + ' settledBad=' + totals.settledBad + ' disagree=' + totals.disagree + ')');
        }

        console.log('\n=== RESULT ===');
        console.log('samples:            ' + totals.samples);
        console.log('legacy violations:  ' + totals.legacyBad);
        console.log('settled violations: ' + totals.settledBad);
        console.log('disagreements:      ' + totals.disagree);
        console.log('never settled:      ' + totals.neverSettled);
        if (badSamples.length) {
            console.log('\nfirst disagreements:');
            badSamples.slice(0, 3).forEach(b => console.log('  ' + JSON.stringify(b)));
        }
        if (totals.legacyBad === 0 && totals.settledBad === 0) {
            console.log('\nVERDICT: flake NOT reproduced in ' + totals.samples + ' samples. Neither strategy caught a bad state.');
            console.log('The trigger is something these two strategies do not exercise.');
        } else if (totals.legacyBad > totals.settledBad) {
            console.log('\nVERDICT: settleLayout prevents violations the legacy timing hits. The flake is a');
            console.log('measurement-timing problem after all, and the guard is the fix.');
        } else {
            console.log('\nVERDICT: violations occur regardless of strategy -- a REAL layout bug, not a race.');
        }
    } finally {
        try { if (ws) ws.close(); } catch (e) {}
        try { server.kill(); } catch (e) {}
        try { chrome.kill(); } catch (e) {}
    }
}

main().catch(e => { console.error('PROBE ERROR: ' + e.message); process.exit(1); });
