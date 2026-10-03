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
    assert.equal(loader.counts().shown, 2);
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

    assert.equal(loader.counts().shown, 2);
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
