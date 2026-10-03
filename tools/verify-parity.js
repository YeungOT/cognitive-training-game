// Layout parity gate: asserts the bottom control row is identical across every
// game at every viewport, and that play button / speed control / primary action
// all share one height. This is the invariant that regressed repeatedly while
// Palm carried its own ID-scoped CSS copies of shared control classes.
//
// Usage: node tools/verify-parity.js
//        APP_URL / CDP_PORT / CHROME_PATH env overrides supported.
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appUrl = process.env.APP_URL || 'http://localhost:4181/';
const port = Number(process.env.CDP_PORT || 9348);
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = path.join(os.tmpdir(), 'cognitive-parity-' + Date.now());

const TOL = 0.5;
const failures = [];
const consoleErrors = [];

const VIEWPORTS = [
    { name: 'iphone-se', w: 667, h: 375 },
    { name: 'iphone-13', w: 844, h: 390 },
    { name: 'desktop', w: 1280, h: 800 },
    { name: 'desktop-xl', w: 1920, h: 1080 }
];

const GAMES = [
    { name: 'palm', steps: ["CognitiveRouter.navigate('palm')"] },
    { name: 'gng', steps: ["CognitiveRouter.navigate('mainMenu')", "document.getElementById('gameGngBtn').click()", "document.getElementById('gngStartBtn').click()"] },
    { name: 'nback', steps: ["CognitiveRouter.navigate('nbackModeSelect')", "document.getElementById('singleNbackBtn').click()"] },
    {
        name: 'dual',
        steps: [
            "CognitiveRouter.navigate('nbackModeSelect')",
            "document.getElementById('dualNbackBtn').click()",
            // Option VALUES are position/image - the Chinese text is only the label.
            "(() => { const a = document.getElementById('dualModality1Select'); a.value = 'position'; a.dispatchEvent(new Event('change')); const b = document.getElementById('dualModality2Select'); b.value = 'image'; b.dispatchEvent(new Event('change')); return 1; })()",
            "document.getElementById('dualStartBtn').click()"
        ]
    }
];

// The composer appends top bar, stage, footer in that order, so the stage is the
// screen's second child. Selecting by class is unreliable - games use different
// stage class names (.stage, .grid-wrapper, .dual-stage, ...).
const METRIC = "(() => { const s = [...document.querySelectorAll('.app-screen')].filter(x => !x.classList.contains('hidden'))[0]; if (!s) return null; const box = e => { if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, y: Math.round(r.y * 10) / 10 }; }; const f = s.querySelector('.bottom-controls,.footer'); const primary = s.querySelector('#swapBtn,.go-btn,.match-btn,.dual-match-btn'); return { screen: s.id, footer: box(f), stage: box(s.children[1]), primary: box(primary), play: box(s.querySelector('.play-btn')), speed: box(s.querySelector('.speed-control')) }; })()";

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function uiScale(w, h) { return Math.min(w / 1280, h / 800); }

function expectedFloor(vp) { return Math.max(88, Math.round(88 * uiScale(vp.w, vp.h) * 10) / 10); }

function fail(msg) { failures.push(msg); console.log('FAIL - ' + msg); }

function pass(msg) { console.log('PASS - ' + msg); }

function row(label, m) {
    const v = o => (o ? (o.w !== undefined ? o.w + 'x' + o.h : o.h) : 'MISSING');
    return '      ' + label.padEnd(7) + 'footer ' + (m.footer ? m.footer.h + '@y' + m.footer.y : 'MISSING') +
        '  stage ' + v(m.stage) + '  primary ' + v(m.primary) +
        '  play ' + v(m.play) + '  speed ' + v(m.speed);
}

async function getTargets() {
    const res = await fetch('http://127.0.0.1:' + port + '/json/list');
    return res.json();
}

async function waitForTargets(timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const targets = await getTargets();
            const page = targets.find(t => t.type === 'page');
            if (page) return page;
        } catch (e) {}
        await delay(200);
    }
    throw new Error('Chrome DevTools target did not appear');
}

async function main() {
    const server = spawn(process.execPath, [path.join(root, 'tools', 'serve.js'), '4181'], { stdio: 'ignore' });
    const chrome = spawn(chromePath, [
        '--headless=new', '--disable-gpu', '--no-sandbox',
        '--remote-debugging-port=' + port,
        '--user-data-dir=' + profileDir,
        'about:blank'
    ], { stdio: 'ignore' });

    let ws;
    try {
        await delay(800);
        const page = await waitForTargets(20000);
        ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
            ws.addEventListener('open', resolve, { once: true });
            ws.addEventListener('error', reject, { once: true });
        });

        let nextId = 1;
        const pending = new Map();
        ws.addEventListener('message', event => {
            const message = JSON.parse(String(event.data));
            if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
                consoleErrors.push(message.params.entry.text);
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
            if (result.exceptionDetails) throw new Error('Evaluation failed: ' + result.exceptionDetails.text);
            return result.result.value;
        }

        await send('Page.enable');
        await send('Runtime.enable');
        await send('Log.enable');

        for (const vp of VIEWPORTS) {
            await send('Emulation.setDeviceMetricsOverride', {
                width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: false
            });
            await send('Page.navigate', { url: appUrl });
            await delay(2200);

            console.log('\n== ' + vp.name + ' ' + vp.w + 'x' + vp.h + ' (ui-scale ' + uiScale(vp.w, vp.h).toFixed(3) + ') ==');

            const measured = [];
            for (const game of GAMES) {
                await evaluate("window.CognitiveRouter.goHome()");
                await delay(400);
                for (const step of game.steps) {
                    await evaluate(step);
                    await delay(650);
                }
                await evaluate("(() => { if (window.CognitiveMessage) window.CognitiveMessage.dismiss(); return 1; })()");
                await delay(600);
                const metric = await evaluate(METRIC);
                if (!metric || !metric.primary || !metric.play || !metric.speed) {
                    fail(vp.name + '/' + game.name + ': could not measure the bottom row');
                    continue;
                }
                measured.push({ name: game.name, m: metric });
                console.log(row(game.name, metric));

                if (Math.abs(metric.play.h - metric.speed.h) > TOL) {
                    fail(vp.name + '/' + game.name + ': play button ' + metric.play.h + ' != speed control ' + metric.speed.h);
                }
                if (Math.abs(metric.primary.h - metric.speed.h) > TOL) {
                    fail(vp.name + '/' + game.name + ': primary action ' + metric.primary.h + ' != speed control ' + metric.speed.h);
                }
                const floor = expectedFloor(vp);
                if (metric.primary.w + TOL < floor) {
                    fail(vp.name + '/' + game.name + ': primary width ' + metric.primary.w + ' below floor ' + floor);
                }
            }

            if (measured.length === GAMES.length) {
                const ref = measured[0].m;
                let sameFooter = true, sameStage = true;
                for (const entry of measured.slice(1)) {
                    if (Math.abs(entry.m.footer.h - ref.footer.h) > TOL || Math.abs(entry.m.footer.y - ref.footer.y) > TOL) sameFooter = false;
                    if (Math.abs(entry.m.stage.h - ref.stage.h) > TOL) sameStage = false;
                }
                if (sameFooter) pass(vp.name + ': footer identical across all games (' + ref.footer.h + ' @y' + ref.footer.y + ')');
                else fail(vp.name + ': footer differs between games - ' + measured.map(e => e.name + '=' + e.m.footer.h + '@y' + e.m.footer.y).join(', '));
                if (sameStage) pass(vp.name + ': stage height identical across all games (' + ref.stage.h + ')');
                else fail(vp.name + ': stage height differs - ' + measured.map(e => e.name + '=' + e.m.stage.h).join(', '));
            }
        }

        console.log('\nconsoleErrors=' + JSON.stringify(consoleErrors));
        if (consoleErrors.length) fail('console errors were logged');
        const passAll = failures.length === 0;
        console.log('result=' + (passAll ? 'PASS' : 'FAIL') + ' checks=' + (passAll ? 'all' : failures.length + ' failed'));
        if (!passAll) process.exitCode = 1;
        ws.close();
    } finally {
        chrome.kill();
        server.kill();
        await delay(500);
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
