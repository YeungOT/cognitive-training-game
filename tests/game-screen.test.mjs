import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createGameScreen } = require('../js/game-screen.js');

function createElement(tagName) {
    return {
        tagName,
        className: '',
        children: [],
        listeners: {},
        appendChild(child) { this.children.push(child); return child; },
        querySelectorAll() { return []; }
    };
}

test('createGameScreen rejects incomplete definitions', function () {
    assert.throws(() => createGameScreen({}, {}), /definition must be an object|gameRoot/);
});

test('createGameScreen fills declared roots', function () {
    const gameRoot = createElement('div');
    const settingsRoot = createElement('div');
    const doc = { createElement: tagName => createElement(tagName) };
    const screen = createGameScreen(doc, {
        gameRoot,
        settingsRoot,
        game: {
            topBar: {
                backId: 'back',
                titleId: 'title',
                title: 'T',
                scoreId: 'score',
                hamburgerId: 'menu'
            },
            stage: { id: 'stage', className: 'stage' },
            footer: { hint: 'H', roundId: 'round' }
        },
        settings: {
            id: 'settings',
            backId: 'settingsBack',
            title: 'S',
            hamburgerId: 'settingsMenu',
            fields: [{ id: 'field', label: 'F', options: [{ value: 'a', label: 'A' }] }],
            action: { id: 'start', label: 'Start' }
        }
    });
    assert.equal(gameRoot.className, 'game-container app-screen game-screen hidden');
    assert.equal(settingsRoot.className, 'menu-overlay app-screen settings-screen game-screen hidden');
    assert.equal(gameRoot.children.length, 3);
});
