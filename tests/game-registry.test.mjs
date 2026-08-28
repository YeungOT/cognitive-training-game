import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const { createGameRegistry } = require('../js/game-registry.js');

function createElement(tagName) {
    return {
        tagName,
        className: '',
        id: '',
        textContent: '',
        children: [],
        listeners: {},
        set className(value) { this.classNameValue = value; },
        get className() { return this.classNameValue || ''; },
        set id(value) { this.idValue = value; },
        get id() { return this.idValue || ''; },
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        addEventListener(type, handler) {
            this.listeners[type] = handler;
        },
        dispatch(type) {
            this.listeners[type]();
        }
    };
}

function createDocument() {
    return {
        createElement(tagName) {
            return createElement(tagName);
        }
    };
}

test('register rejects duplicate game ids', function () {
    const registry = createGameRegistry({ router: { navigate() { return true; } } });
    registry.register({ id: 'a', title: 'A', icon: 'A', entryRoute: 'aRoute', menuOrder: 1 });
    assert.throws(
        () => registry.register({ id: 'a', title: 'A2', icon: 'A2', entryRoute: 'aRoute2', menuOrder: 2 }),
        /Game id already registered/
    );
});

test('register rejects duplicate menu orders and entry routes', function () {
    const registry = createGameRegistry({ router: { navigate() { return true; } } });
    registry.register({ id: 'a', title: 'A', icon: 'A', entryRoute: 'aRoute', menuOrder: 1 });
    assert.throws(
        () => registry.register({ id: 'b', title: 'B', icon: 'B', entryRoute: 'bRoute', menuOrder: 1 }),
        /Game menu order already registered/
    );
    assert.throws(
        () => registry.register({ id: 'b', title: 'B', icon: 'B', entryRoute: 'aRoute', menuOrder: 2 }),
        /Game entry route already registered/
    );
});

test('register requires complete menu metadata', function () {
    const registry = createGameRegistry({});
    assert.throws(() => registry.register({ id: 'a' }), /Game title/);
    assert.throws(() => registry.register({ id: 'a', title: 'A' }), /Game icon/);
    assert.throws(() => registry.register({ id: 'a', title: 'A', icon: 'A' }), /Game entry route/);
    assert.throws(
        () => registry.register({ id: 'a', title: 'A', icon: 'A', entryRoute: 'aRoute' }),
        /Game menuOrder/
    );
});

test('list and renderMenu preserve explicit menu order', function () {
    const router = { navigate(route) { this.lastRoute = route; return true; } };
    const registry = createGameRegistry({ router });
    registry.register({ id: 'b', title: 'B', icon: 'B', entryRoute: 'bRoute', menuOrder: 2 });
    registry.register({ id: 'a', title: 'A', icon: 'A', entryRoute: 'aRoute', menuOrder: 1 });
    assert.deepEqual(registry.list().map(game => game.id), ['a', 'b']);

    const container = createElement('div');
    registry.renderMenu(container, createDocument());
    assert.equal(container.children.length, 2);
    assert.equal(container.children[0].id, 'gameABtn');
    assert.equal(container.children[1].id, 'gameBBtn');

    container.children[1].dispatch('click');
    assert.equal(router.lastRoute, 'bRoute');
});

test('navigating between games pauses the previous lifecycle', function () {
    const router = { navigate(route) { this.routes.push(route); return true; }, routes: [] };
    const registry = createGameRegistry({ router });
    const calls = { a: [], b: [] };
    function lifecycle(id) {
        return {
            start: () => calls[id].push('start'),
            pause: () => calls[id].push('pause'),
            reset: () => calls[id].push('reset'),
            destroy: () => calls[id].push('destroy')
        };
    }
    registry.register({
        id: 'a', title: 'A', icon: 'A', entryRoute: 'aRoute', menuOrder: 1,
        setup: () => lifecycle('a')
    });
    registry.register({
        id: 'b', title: 'B', icon: 'B', entryRoute: 'bRoute', menuOrder: 2,
        setup: () => lifecycle('b')
    });

    registry.navigate('a');
    registry.navigate('b');
    assert.deepEqual(calls.a, ['pause']);
    assert.deepEqual(calls.b, []);
    assert.deepEqual(router.routes, ['aRoute', 'bRoute']);

    registry.navigate('b');
    assert.deepEqual(calls.b, []);
});
