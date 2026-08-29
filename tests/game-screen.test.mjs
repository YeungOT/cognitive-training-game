import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createGameScreen } = require('../js/game-screen.js');

function createElement(tagName, className = '', id = '') {
    const node = {
        tagName,
        className,
        id,
        children: [],
        listeners: {},
        appendChild(child) { this.children.push(child); return child; },
        querySelectorAll() {
            return this.children.flatMap(child => [
                child,
                ...child.querySelectorAll()
            ]);
        }
    };
    if (id) node.id = id;
    return node;
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
test('createGameScreen supports Shopping top actions, stages, and settings chrome', function () {
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
                actions: [{ id: 'nameToggle', title: 'off', text: '名称', badgeId: 'nameBadge', badgeClassName: 'state-badge on' }],
                hamburgerId: 'menu'
            },
            stage: {
                id: 'shoppingStage',
                className: 'shopping-stage',
                children: [{
                    id: 'shoppingListView',
                    className: 'shopping-view',
                    children: [{ id: 'shoppingListGrid', className: 'shopping-list-grid count-3' }]
                }]
            },
            footer: {
                className: 'bottom-controls',
                controls: {
                    className: 'center-group shopping-controls',
                    children: [{ id: 'shoppingProgress', className: 'shopping-progress hidden', text: '已揀選 0 / 3' }]
                }
            }
        },
        settings: {
            id: 'shoppingSettings',
            backId: 'shoppingSettingsBack',
            title: '🛒 設定',
            chromeRightCluster: true,
            saveButton: { id: 'shoppingSaveSettings', title: '儲存設定', label: '💾儲存' },
            hamburgerId: 'shoppingSettingsMenu',
            fields: [
                { separator: true },
                {
                    id: 'shoppingMemoryTime',
                options: [{ value: 'manual', label: '手動' }],
                labelNode: {
                    tagName: 'span',
                    className: 'game-screen-label shopping-memory-time-label',
                    children: [
                        { tagName: 'span', className: 'shopping-memory-time-base', text: '⏳ 記憶時間' },
                        { tagName: 'span', id: 'shoppingMemoryTimeSuffix', className: 'shopping-memory-time-suffix', text: '（每張）' },
                        { tagName: 'span', id: 'shoppingOrderLightbulb', className: 'shopping-order-lightbulb hidden', title: '選擇已變更', text: '💡' }
                    ]
                }
            }],
            action: { id: 'shoppingStart', label: '▶ 開始遊戲' }
        }
    });

    assert.equal(screen.els.shoppingListGrid.className, 'shopping-list-grid count-3');
    assert.equal(screen.els.nameToggle.className, 'action-btn');
    assert.equal(screen.els.nameBadge.className, 'state-badge on');
    assert.equal(screen.els.shoppingProgress.textContent, '已揀選 0 / 3');
    assert.equal(screen.els.shoppingSaveSettings.className, 'save-btn');
    assert.equal(screen.els.shoppingOrderLightbulb.className, 'shopping-order-lightbulb hidden');
});
