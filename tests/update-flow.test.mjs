import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createUpdateFlow } = require('../js/update-flow.js');

function createEventTarget() {
    const listeners = new Map();
    return {
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(handler);
        },
        removeEventListener(type, handler) {
            const handlers = listeners.get(type) || [];
            listeners.set(type, handlers.filter(item => item !== handler));
        },
        emit(type, event) {
            const handlers = listeners.get(type) || [];
            handlers.slice().forEach(handler => handler(event || {}));
        },
        listenerCount(type) {
            return (listeners.get(type) || []).length;
        }
    };
}

function createWorker(state) {
    return Object.assign(createEventTarget(), {
        state
    });
}

function createRegistration(activeWorker) {
    return Object.assign(createEventTarget(), {
        installing: null,
        waiting: null,
        active: activeWorker || null,
        updateCalls: 0,
        update: async function () {
            this.updateCalls++;
        }
    });
}

function createServiceWorkerContainer(registration) {
    return Object.assign(createEventTarget(), {
        controller: null,
        register: async () => registration
    });
}

function createLoader() {
    let shown = 0;
    let hidden = 0;
    const progress = [];
    return {
        show() {
            shown++;
        },
        hide() {
            hidden++;
        },
        setProgress(loaded, total) {
            progress.push([loaded, total]);
        },
        counts() {
            return { shown, hidden, progress };
        }
    };
}

function createRouter() {
    let current = 'home';
    const homeHandlers = [];
    return {
        getCurrent() {
            return current;
        },
        setCurrent(screen) {
            current = screen;
        },
        registerEnter(name, handler) {
            if (name === 'home') homeHandlers.push(handler);
        },
        enterHome() {
            homeHandlers.slice().forEach(handler => handler());
        }
    };
}

test('start is ready immediately when service workers are unsupported', async function () {
    const loader = createLoader();
    const flow = createUpdateFlow({
        navigator: {},
        loader
    });
    let ready = 0;

    await flow.start(() => {
        ready++;
    });

    assert.equal(ready, 1);
    assert.equal(loader.counts().hidden, 1);
});

test('active worker with no update completes boot and starts update checks', async function () {
    const worker = createWorker('activated');
    const registration = createRegistration(worker);
    const container = createServiceWorkerContainer(registration);
    const loader = createLoader();
    const flow = createUpdateFlow({
        navigator: {
            serviceWorker: container,
            onLine: true
        },
        loader
    });
    let ready = 0;

    await flow.start(() => {
        ready++;
    });

    assert.equal(ready, 1);
    assert.equal(loader.counts().hidden, 1);
    assert.equal(container.listenerCount('message'), 1);
    assert.equal(registration.updateCalls >= 1, true);
    // Regression: the bar used to be filled only when `complete(true)` ran, i.e.
    // only on a worker install. On this no-update path it kept the stylesheet's
    // 0% default, so an ordinary repeat visit showed an empty loader until home.
    const finalProgress = loader.counts().progress.at(-1);
    assert.equal(finalProgress[0], 1);
    assert.equal(finalProgress[1], 1);
});

test('progress reaches 100% before the loader is hidden', async function () {
    const worker = createWorker('activated');
    const registration = createRegistration(worker);
    const container = createServiceWorkerContainer(registration);
    const loader = createLoader();
    const timers = [];
    const flow = createUpdateFlow({
        navigator: { serviceWorker: container, onLine: true },
        loader,
        setTimeout(fn) {
            timers.push(fn);
            return timers.length;
        },
        clearTimeout() {}
    });
    let ready = 0;

    const started = flow.start(() => {
        ready++;
    });

    // Wait until the flow has written 100%. Waiting on timers.length would race:
    // the startup-update-check timer is pushed earlier and is not the hold.
    while (loader.counts().progress.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 5));
    }

    // The hold is scheduled, not run yet: bar is complete but the loader is still up.
    const finalProgress = loader.counts().progress.at(-1);
    assert.equal(finalProgress[0], 1);
    assert.equal(finalProgress[1], 1);
    assert.equal(loader.counts().hidden, 0);
    assert.equal(ready, 0);

    const hold = timers.pop();
    hold();
    await started;

    assert.equal(loader.counts().hidden, 1);
    assert.equal(ready, 1);
});

test('startup update is installed before boot completes', async function () {
    const oldWorker = createWorker('activated');
    const registration = createRegistration(oldWorker);
    const newWorker = createWorker('activated');
    registration.update = async function () {
        this.updateCalls++;
        this.installing = newWorker;
        this.emit('updatefound');
    };
    const container = createServiceWorkerContainer(registration);
    const loader = createLoader();
    const flow = createUpdateFlow({
        navigator: {
            serviceWorker: container,
            onLine: true
        },
        loader
    });
    let ready = 0;

    await flow.start(() => {
        ready++;
    });

    assert.equal(ready, 1);
    assert.equal(registration.updateCalls, 1);
    assert.equal(loader.counts().shown, 1);
    assert.equal(loader.counts().hidden, 1);
});

test('an update reload marks the next boot so the loader can be skipped', async function () {
    const oldWorker = createWorker('activated');
    const registration = createRegistration(oldWorker);
    const newWorker = createWorker('activated');
    registration.update = async function () {
        this.updateCalls++;
        this.installing = newWorker;
        this.active = newWorker;
        this.emit('updatefound');
    };
    const container = createServiceWorkerContainer(registration);
    // A controlled page is what makes the flow reload rather than complete.
    container.controller = {};
    const loader = createLoader();
    const store = new Map();
    const session = {
        setItem(k, v) { store.set(k, String(v)); },
        getItem(k) { return store.has(k) ? store.get(k) : null; },
        removeItem(k) { store.delete(k); }
    };
    const flow = createUpdateFlow({
        navigator: { serviceWorker: container, onLine: true },
        loader,
        session
    });

    // The reload path returns without completing, so start()'s promise never
    // resolves (the real page is navigating away). Do not await it.
    flow.start(() => {});
    while (!store.has('cognitive:post-update-reload')) {
        await new Promise(resolve => setTimeout(resolve, 5));
    }

    assert.equal(store.get('cognitive:post-update-reload'), '1');
    assert.equal(flow.POST_UPDATE_RELOAD_KEY, 'cognitive:post-update-reload');
});

test('an update install that ends in a reload does not show a second loader', async function () {
    const first = createWorker('activated');
    const registration = createRegistration(first);
    const second = createWorker('activated');
    let calls = 0;
    registration.update = async function () {
        this.updateCalls++;
        calls++;
        // The startup check finds nothing; the later check (after boot, while the
        // user is on home) finds the update. That is the second-bar scenario.
        if (calls === 1) return;
        this.installing = second;
        this.active = second;
        this.emit('updatefound');
    };
    const container = createServiceWorkerContainer(registration);
    container.controller = {};
    const loader = createLoader();
    const store = new Map();
    const session = {
        setItem(k, v) { store.set(k, String(v)); },
        getItem(k) { return store.has(k) ? store.get(k) : null; },
        removeItem(k) { store.delete(k); }
    };
    const flow = createUpdateFlow({
        navigator: { serviceWorker: container, onLine: true },
        loader,
        session
    });
    let ready = 0;

    await flow.start(() => { ready++; });
    await new Promise(resolve => setTimeout(resolve, 400));

    assert.equal(ready, 1);
    assert.equal(store.get('cognitive:post-update-reload'), '1');
    // Exactly one show: boot. The install reloads, so it must not add another.
    assert.equal(loader.counts().shown, 1);
});

test('an update on an uncontrolled page does not show a second bar', async function () {
    // controller is null on the first load after a worker registers, before it
    // claims the client. An update discovered then used to show a second full
    // progress bar over a home screen that was already working, with no reload.
    const first = createWorker('activated');
    const registration = createRegistration(first);
    const second = createWorker('activated');
    let calls = 0;
    registration.update = async function () {
        this.updateCalls++;
        calls++;
        if (calls === 1) return;
        this.installing = second;
        this.active = second;
        this.emit('updatefound');
    };
    const container = createServiceWorkerContainer(registration);
    container.controller = null;
    const loader = createLoader();
    const flow = createUpdateFlow({
        navigator: { serviceWorker: container, onLine: true },
        loader
    });
    let ready = 0;

    await flow.start(() => { ready++; });
    await new Promise(resolve => setTimeout(resolve, 400));

    assert.equal(ready, 1);
    assert.equal(loader.counts().shown, 1);
});

test('a late duplicate completion still takes the loader down', async function () {
    const first = createWorker('activated');
    const registration = createRegistration(first);
    const second = createWorker('activated');
    let calls = 0;
    registration.update = async function () {
        this.updateCalls++;
        calls++;
        if (calls === 1) return;
        this.installing = second;
        this.active = second;
        this.emit('updatefound');
    };
    const container = createServiceWorkerContainer(registration);
    // No controller => this install completes in place instead of reloading, so
    // it does show a loader and must take it down again on completion.
    container.controller = null;
    const loader = createLoader();
    const flow = createUpdateFlow({
        navigator: { serviceWorker: container, onLine: true },
        loader
    });
    let ready = 0;

    await flow.start(() => { ready++; });
    await new Promise(resolve => setTimeout(resolve, 400));

    assert.equal(ready, 1);
    // The invariant that matters is that the loader is never left on screen,
    // not that show and hide are balanced - a duplicate completion may hide an
    // already-hidden loader.
    assert.ok(loader.counts().hidden >= loader.counts().shown,
        'loader left visible: shown ' + loader.counts().shown + ', hidden ' + loader.counts().hidden);
});

test('no update reload leaves no marker behind', async function () {
    const worker = createWorker('activated');
    const registration = createRegistration(worker);
    const container = createServiceWorkerContainer(registration);
    const store = new Map();
    const session = {
        setItem(k, v) { store.set(k, String(v)); },
        getItem(k) { return store.has(k) ? store.get(k) : null; },
        removeItem(k) { store.delete(k); }
    };
    const flow = createUpdateFlow({
        navigator: { serviceWorker: container, onLine: true },
        loader: createLoader(),
        session
    });

    await flow.start(() => {});

    assert.equal(store.size, 0);
});

test('update found away from home is deferred until returning home', async function () {
    const worker = createWorker('activated');
    const registration = createRegistration(worker);
    const container = createServiceWorkerContainer(registration);
    const loader = createLoader();
    const router = createRouter();
    let reloads = 0;
    container.controller = {};

    const flow = createUpdateFlow({
        navigator: {
            serviceWorker: container,
            onLine: true
        },
        location: {
            reload() {
                reloads++;
            }
        },
        router,
        loader
    });

    await flow.start();

    const newWorker = createWorker('activated');
    router.setCurrent('game');
    registration.installing = newWorker;
    registration.emit('updatefound');

    assert.equal(reloads, 0);

    router.setCurrent('home');
    flow.enterHome();
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(reloads, 1);
    // The deferred install ends in a reload, so it no longer paints its own
    // progress bar - anything it drew would be thrown away with the page, and
    // it was the second bar users reported. Only boot shows one.
    assert.equal(loader.counts().shown, 1);
});

test('router home entry installs a deferred update', async function () {
    const worker = createWorker('activated');
    const registration = createRegistration(worker);
    const container = createServiceWorkerContainer(registration);
    const loader = createLoader();
    const router = createRouter();
    container.controller = {};

    const flow = createUpdateFlow({
        navigator: {
            serviceWorker: container,
            onLine: true
        },
        location: {
            reload() {}
        },
        router,
        loader
    });

    await flow.start();

    registration.installing = createWorker('activated');
    router.setCurrent('game');
    registration.emit('updatefound');
    router.setCurrent('home');
    router.enterHome();
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(loader.counts().shown, 1);
});
test('progress bar stays below 100 until the update is fully active', async function () {
    const oldWorker = createWorker('activated');
    const registration = createRegistration(oldWorker);
    const newWorker = createWorker('installing');
    registration.update = async function () {
        this.updateCalls++;
        this.installing = newWorker;
        this.emit('updatefound');
    };
    const container = createServiceWorkerContainer(registration);
    const loader = createLoader();
    const flow = createUpdateFlow({
        navigator: {
            serviceWorker: container,
            onLine: true
        },
        loader
    });

    const startPromise = flow.start();
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));

    // precache 中途：低於封頂照實顯示
    container.emit('message', { data: { type: 'cognitive-precache-progress', loaded: 50, total: 100 } });
    // precache 完成：仍應停在 95%（activation 尚未完成）
    container.emit('message', { data: { type: 'cognitive-precache-progress', loaded: 100, total: 100, done: true } });
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(loader.counts().hidden, 0);
    assert.deepEqual(loader.counts().progress[loader.counts().progress.length - 1], [95, 100]);

    // activation 完成 → 100% + 隱藏
    newWorker.state = 'activated';
    newWorker.emit('statechange');
    await startPromise;

    assert.deepEqual(loader.counts().progress[loader.counts().progress.length - 1], [1, 1]);
    assert.equal(loader.counts().hidden, 1);
});

test('progress cap is configurable via progressCapPercent', async function () {
    const oldWorker = createWorker('activated');
    const registration = createRegistration(oldWorker);
    const newWorker = createWorker('installing');
    registration.update = async function () {
        this.updateCalls++;
        this.installing = newWorker;
        this.emit('updatefound');
    };
    const container = createServiceWorkerContainer(registration);
    const loader = createLoader();
    const flow = createUpdateFlow({
        navigator: {
            serviceWorker: container,
            onLine: true
        },
        loader,
        progressCapPercent: 80
    });

    const startPromise = flow.start();
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));

    container.emit('message', { data: { type: 'cognitive-precache-progress', loaded: 100, total: 100, done: true } });
    await new Promise(resolve => setImmediate(resolve));

    assert.deepEqual(loader.counts().progress[loader.counts().progress.length - 1], [80, 100]);

    newWorker.state = 'activated';
    newWorker.emit('statechange');
    await startPromise;
    assert.equal(loader.counts().hidden, 1);
});

// Regression: a precache-progress message arriving AFTER the bar has already
// reached 100% must not move it. In the update path finishWorkerUpdate sets
// 100% and then calls location.reload(), which is not instantaneous; a late
// worker message in that window overwrote the bar with a low percentage, so it
// visibly fell from 100% back to ~2% just before the reload. Users read that as
// a second loading bar. verify-boot caught it, but only intermittently, which
// is why this is pinned deterministically here.
test('a progress message after the bar reaches 100% does not move it back', async function () {
    const worker = createWorker('activated');
    const registration = createRegistration(worker);
    const container = createServiceWorkerContainer(registration);
    const loader = createLoader();

    const flow = createUpdateFlow({
        navigator: { serviceWorker: container, onLine: true },
        loader
    });

    await flow.start(() => {});

    const progress = loader.counts().progress;
    assert.deepEqual(progress[progress.length - 1], [1, 1], 'bar should finish at 100%');
    const countAtFinish = progress.length;

    // A late message from the still-installing worker.
    container.emit('message', {
        data: { type: 'cognitive-precache-progress', loaded: 2, total: 431, done: false }
    });

    assert.equal(
        loader.counts().progress.length,
        countAtFinish,
        'a late precache message must not write progress after the bar finished'
    );
    assert.deepEqual(
        loader.counts().progress[loader.counts().progress.length - 1],
        [1, 1],
        'bar must still read 100%'
    );
});
