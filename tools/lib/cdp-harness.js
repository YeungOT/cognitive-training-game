// Shared CDP harness for the headless verification gates.
//
// WHY THIS EXISTS: seven gate scripts each independently re-implemented the
// same setup -- spawn tools/serve.js, spawn Chrome with a remote debugging
// port, wait for the page target, open a WebSocket, wire its `message` event
// into an id->promise map, and expose send/evaluate. That boilerplate was
// duplicated verbatim and, worse, the subtle part -- defeating the service
// worker before measuring -- was duplicated too. When a gate forgets that
// step it silently measures the PREVIOUS build, because a freshly generated
// sw.js only activates after the page has already loaded once. That is not
// hypothetical: it made three gates here validate stale assets at the same
// time until someone noticed. Keeping it in one place is the point.
//
// Each gate keeps its own assertions, thresholds and screen definitions. This
// module only owns "get a real browser and talk to it".
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const delay = ms => new Promise(r => setTimeout(r, ms));

async function findPageTarget(port, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
            const page = list.find(t => t.type === 'page');
            if (page) return page;
        } catch (e) {}
        await delay(200);
    }
    throw new Error('Chrome DevTools target did not appear');
}

/**
 * Launch a static server plus headless Chrome, and return a small CDP client.
 *
 * options:
 *   servePort   port for tools/serve.js (required unless serveUrl is given)
 *   serveDir    directory to serve; defaults to the repo root
 *   cdpPort     Chrome remote debugging port
 *   appUrl      URL to navigate to first; defaults to the served root
 *   errors      optional array; console errors and page exceptions are pushed
 *   quiet       don't navigate on launch (gate will do its own navigating)
 */
async function launch(options) {
    const opts = options || {};
    const toolsDir = path.resolve(__dirname, '..');
    const serveDir = opts.serveDir || path.resolve(toolsDir, '..');
    const cdpPort = opts.cdpPort;
    const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), (opts.profilePrefix || 'cognitive-gate') + '-'));
    const chromePath = opts.chromePath || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const appUrl = opts.appUrl || 'http://localhost:' + opts.servePort + '/';
    const errors = opts.errors || null;

    let server = null;
    if (!opts.externalServer) {
        // Must launch serve.js FROM serveDir, not the repo's copy with a cwd.
        // serve.js resolves its document root from its own __dirname, so passing
        // cwd does nothing -- the server would silently serve the repo instead
        // of the temp copy, and a gate that publishes a build into that copy
        // would never see an update.
        server = spawn(process.execPath, [path.join(serveDir, 'tools', 'serve.js'), String(opts.servePort)], { stdio: 'ignore' });
    }
    const chrome = spawn(chromePath, [
        '--headless=new', '--disable-gpu', '--no-sandbox',
        '--remote-debugging-port=' + cdpPort,
        '--user-data-dir=' + profileDir,
        'about:blank'
    ], { stdio: 'ignore' });

    const cleanup = async () => {
        try { if (server) server.kill(); } catch (e) {}
        try { chrome.kill(); } catch (e) {}
    };

    try {
        await delay(900);
        const page = await findPageTarget(cdpPort, opts.targetTimeoutMs || 20000);
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
            ws.addEventListener('open', resolve, { once: true });
            ws.addEventListener('error', reject, { once: true });
        });

        let nextId = 1;
        const pending = new Map();
        ws.addEventListener('message', event => {
            const message = JSON.parse(String(event.data));
            if (errors) {
                if (message.method === 'Runtime.exceptionThrown' && opts.collectExceptions !== false) {
                    const d = message.params.exceptionDetails;
                    errors.push('exception: ' + (d.exception && d.exception.description || d.text));
                }
                if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
                    errors.push('console.error: ' + message.params.entry.text);
                }
            }
            if (!message.id || !pending.has(message.id)) return;
            const handlers = pending.get(message.id);
            pending.delete(message.id);
            if (message.error) handlers.reject(new Error(message.error.message));
            else handlers.resolve(message.result);
        });

        const send = (method, params) => new Promise((resolve, reject) => {
            const id = nextId++;
            pending.set(id, { resolve, reject });
            ws.send(JSON.stringify({ id, method, params: params || {} }));
        });
        const evaluate = async expression => {
            const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
            if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
            return result.result.value;
        };

        await send('Page.enable');
        await send('Runtime.enable');
        if (opts.errors) await send('Log.enable');
        if (opts.deviceMetrics) await send('Emulation.setDeviceMetricsOverride', opts.deviceMetrics);
        if (opts.touchEmulation) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
        if (opts.beforeNavigate) await opts.beforeNavigate({ send, evaluate });
        if (!opts.quiet) {
            await send('Page.navigate', { url: appUrl });
            await delay(opts.initialDelayMs || 2400);
        }

        return {
            send,
            evaluate,
            appUrl,
            close: async () => {
                try { ws.close(); } catch (e) {}
                await cleanup();
            }
        };
    } catch (error) {
        await cleanup();
        throw error;
    }
}

// Unregister every service worker and drop every cache, so the next load
// fetches assets straight from the server instead of from the precache.
// WITHOUT this a gate measures the previously installed build and can pass
// while the working tree is broken.
async function defeatServiceWorker(evaluate) {
    return evaluate("(async () => { const rs = await navigator.serviceWorker.getRegistrations(); for (const r of rs) { await r.unregister(); } const ks = await caches.keys(); for (const k of ks) { await caches.delete(k); } return { unregistered: rs.length, cachesCleared: ks.length }; })()");
}

module.exports = { launch, defeatServiceWorker, delay };
