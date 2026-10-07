// Boot-timeline gate. Asserts the first-run experience is a single, sane
// loading pass, which is what four separate bugs this session violated:
//   - the bar never reaching 100% on ordinary visits
//   - an update showing a second full loading bar before reloading
//   - a settings screen flashing on top of home before boot completed
//   - the bar restarting from 0% after reaching 95%
//
// Scenarios, all against a temp copy of the app so the update leg can publish
// a build without touching the repo:
//   cold    - first ever load, nothing cached
//   repeat  - second load, worker active, nothing to install
//   update  - a new build is published, worker installs and the page reloads
//
// Usage: node tools/verify-boot.js
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { launch, delay } = require('./lib/cdp-harness');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.CDP_PORT || 9366);
const servePort = Number(process.env.SERVE_PORT || 4190);
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cognitive-boot-'));
const appDir = path.join(workDir, 'app');

const failures = [];

// Injected before any page script. Everything is appended to a sessionStorage
// log so it survives the reload that the update leg causes.
const S = [];
S.push('(() => {');
S.push('  try {');
S.push('    if (!sessionStorage.getItem("__bootlog")) sessionStorage.setItem("__bootlog", "[]");');
S.push('    if (!sessionStorage.getItem("__bootloads")) sessionStorage.setItem("__bootloads", "0");');
S.push('    const loads = Number(sessionStorage.getItem("__bootloads")) + 1;');
S.push('    sessionStorage.setItem("__bootloads", String(loads));');
S.push('    const log = JSON.parse(sessionStorage.getItem("__bootlog"));');
S.push('    const state = { docLoads: loads, loaderAfterInit: false, loaderEverVisible: false, initSeen: false, preInitViolations: [], bars: [] };');
S.push('    window.__boot = state;');
S.push('    const flush = () => { log.push(JSON.parse(JSON.stringify(state))); sessionStorage.setItem("__bootlog", JSON.stringify(log)); };');
S.push('    setInterval(flush, 150);');
S.push('    window.addEventListener("pagehide", flush);');
S.push('    const attach = () => {');
S.push('      const loader = document.getElementById("bootLoader");');
S.push('      const bar = document.getElementById("bootLoaderProgress");');
S.push('      if (!loader || !bar) { setTimeout(attach, 5); return; }');
S.push('      const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };');
S.push('      const tick = () => {');
S.push('        const t0 = performance.now();');
S.push('        if (state.initSeen && !loader.classList.contains("hidden") && visible(loader)) state.loaderAfterInit = true;');
S.push('        // Only sample the bar while the loader is on screen. An update that');
S.push('        // installs after boot still rewrites bar.style.width on a hidden');
S.push('        // loader, and that is not something the user can see.');
S.push('        const loaderUp = !loader.classList.contains("hidden") && visible(loader);');
S.push('        if (loaderUp) {');
S.push('          state.loaderEverVisible = true;');
S.push('          const w = bar.style.width || "0%";');
S.push('          if (state.bars.length === 0 || state.bars[state.bars.length - 1] !== w) state.bars.push(w);');
S.push('        }');
S.push('        if (!state.initSeen) {');
S.push('          const off = [...document.querySelectorAll(".app-screen")].filter(s => !s.classList.contains("hidden") && visible(s) && s.id !== "home").map(s => s.id);');
S.push('          if (off.length) state.preInitViolations.push({ id: off[0], t: Math.round(t0) });');
S.push('        }');
S.push('        if (performance.now() - t0 < 60000) requestAnimationFrame(tick);');
S.push('      };');
S.push('      requestAnimationFrame(tick);');
S.push('      const watchRouter = () => {');
S.push('        if (!window.CognitiveRouter) { setTimeout(watchRouter, 5); return; }');
S.push('        const orig = window.CognitiveRouter.initialize;');
S.push('        window.CognitiveRouter.initialize = function () { state.initSeen = true; return orig.apply(window.CognitiveRouter, arguments); };');
S.push('      };');
S.push('      watchRouter();');
S.push('    };');
S.push('    attach();');
S.push('  } catch (e) {}');
S.push('  return true;');
S.push('})()');

// Fault injection for the update leg. installPendingUpdate() is only reachable
// when the STARTUP update check misses an update that a LATER check finds, which
// is a race a plain leg never wins. Making the first registration.update() a
// no-op forces that ordering deterministically, so the real path runs and the
// "loader never reappears after boot" assertion actually covers it.
const F = [];
F.push('(() => {');
F.push('  try {');
F.push('    if (sessionStorage.getItem("__bootFault") !== "1") return true;');
F.push('    const sw = navigator.serviceWorker;');
F.push('    const origRegister = sw.register.bind(sw);');
F.push('    sw.register = async function (url, opts) {');
F.push('      const reg = await origRegister(url, opts);');
F.push('      const origUpdate = reg.update.bind(reg);');
F.push('      let calls = 0;');
F.push('      reg.update = function () {');
F.push('        calls++;');
F.push('        if (calls === 1) return Promise.resolve();');
F.push('        return origUpdate();');
F.push('      };');
F.push('      return reg;');
F.push('    };');
F.push('  } catch (e) {}');
F.push('  return true;');
F.push('})()');

function copyApp() {
  const skip = new Set(['.git', 'node_modules']);
  fs.mkdirSync(appDir, { recursive: true });
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    fs.cpSync(path.join(root, entry.name), path.join(appDir, entry.name), { recursive: true });
  }
}

function fail(msg) { failures.push(msg); console.log('FAIL - ' + msg); }
function pass(msg) { console.log('PASS - ' + msg); }

function pct(v) { return Number(String(v).replace('%', '')) || 0; }

function checkLeg(name, snapshots, allowReload) {
  // The sampler flushes a cumulative snapshot every 150ms, so collapse to the
  // last snapshot per document before asserting.
  const byDoc = new Map();
  for (const s of snapshots) byDoc.set(s.docLoads, s);
  const docs = Array.from(byDoc.values()).sort((a, b) => a.docLoads - b.docLoads);
  console.log('\n== ' + name + ' (document loads: ' + docs.length + ') ==');

  // The loader starts visible in the HTML and is hidden by boot.js, so counting
  // any visibility would flag every load. The defect is the loader coming BACK
  // after boot has already completed - that is the "second bar" users saw.
  const docsWithLoader = docs.filter(d => d.loaderAfterInit);
  if (docsWithLoader.length <= 1) {
    pass(name + ': loader never reappears after boot completes');
  } else {
    fail(name + ': loader reappears after boot on ' + docsWithLoader.length +
      ' document(s) - the user sees the loading screen twice');
  }

  const violations = docs.flatMap(d => d.preInitViolations.map(v => v.id));
  if (violations.length === 0) {
    pass(name + ': only home is visible before boot completes');
  } else {
    fail(name + ': non-home screens visible before boot completed: ' + [...new Set(violations)].join(', '));
  }

  // A reload legitimately starts a new document with the bar at 0%, so the
  // no-restart rule applies WITHIN a document, never across the pair.
  const bars = docs.flatMap(d => d.bars).map(pct);
  let restart = null;
  for (const d of docs) {
    const seq = d.bars.map(pct);
    for (let i = 1; i < seq.length; i++) {
      if (seq[i] < seq[i - 1]) { restart = 'doc ' + d.docLoads + ': ' + seq[i - 1] + ' -> ' + seq[i]; break; }
    }
    if (restart) break;
  }
  if (restart === null) {
    pass(name + ': progress bar never restarts (' + bars[0] + '% -> ' + bars[bars.length - 1] + '%)');
  } else {
    fail(name + ': progress bar restarts (' + restart + ')');
  }

  const reached = docs.some(d => d.bars.map(pct).some(b => b >= 100));
  if (reached) pass(name + ': progress bar reaches 100%');
  else fail(name + ': progress bar never reaches 100% (peaked at ' + Math.max(0, ...bars) + '%)');

  if (allowReload && docs.length < 2) {
    fail(name + ': expected the update to reload the page, but it never did');
  }
  if (allowReload && docs.length >= 2) {
    const finalDoc = docs[docs.length - 1];
    if (finalDoc.loaderEverVisible) {
      fail(name + ': post-update document painted the loader again');
    } else {
      pass(name + ': post-update document never painted the loader');
    }
  }
}

async function main() {
  copyApp();
  let browser = null;
  try {
    // quiet: this gate runs its own navigations (cold start from about:blank,
    // then published builds), so the harness must not navigate on its own. The
    // injected scripts must be registered BEFORE the first navigation.
    browser = await launch({
      servePort: servePort,
      serveDir: appDir,
      cdpPort: port,
      profilePrefix: 'cognitive-boot',
      deviceMetrics: { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
      quiet: true,
      beforeNavigate: async ({ send }) => {
        await send('Page.addScriptToEvaluateOnNewDocument', { source: S.join('\n') });
        await send('Page.addScriptToEvaluateOnNewDocument', { source: F.join('\n') });
      }
    });
    const send = browser.send;
    const ev = async x => {
      const r = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
      return r.result.value;
    };

    const visit = async (ms, reset) => {
      // The first leg must NOT reset: navigating from about:blank is the only way
      // to get a genuine cold start, and resetting there would discard it.
      if (reset !== false) {
        await ev("(() => { try { sessionStorage.setItem('__bootlog', '[]'); sessionStorage.setItem('__bootloads', '0'); } catch (e) {} })()");
      }
      await send('Page.navigate', { url: 'http://localhost:' + servePort + '/' });
      await delay(ms);
      return JSON.parse(await ev("sessionStorage.getItem('__bootlog')") || '[]');
    };

    // First leg navigates straight from about:blank so it is a true cold start.
    checkLeg('cold', await visit(15000, false), false);

    // Second leg reuses the same sessionStorage, so reset it before sampling.
    checkLeg('repeat', await visit(9000), false);

    // Publish a new build in the temp copy only.
    fs.appendFileSync(path.join(appDir, 'README.md'), '\n<!-- boot gate update leg -->\n');
    spawnSync(process.execPath, [path.join(appDir, 'tools', 'generate-service-worker.js')], { cwd: appDir, stdio: 'ignore' });
    await ev("(() => { try { sessionStorage.setItem('__bootFault', '1'); } catch (e) {} })()");

    checkLeg('update', await visit(16000), true);

    const passAll = failures.length === 0;
    console.log('\nresult=' + (passAll ? 'PASS' : 'FAIL') + ' checks=' + (passAll ? 'all' : failures.length + ' failed'));
    if (!passAll) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    await delay(500);
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
