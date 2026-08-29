import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const pairsLogic = require('../js/food/pairs-logic.js');
const pairsView = require('../js/food/pairs-view.js');
const pairs = require('../js/food/pairs.js');
const foodData = require('../js/food/food-data.js');

function shuffle(values) {
    return [...values];
}

test('module exposes the registry game seams', function () {
    assert.equal(typeof pairs.mount, 'function');
    assert.equal(typeof pairsLogic.buildMemoryPairsRound, 'function');
    assert.equal(typeof pairsView.renderMemoryPairsGrid, 'function');
    assert.equal(pairs.mount(null), null);
});

test('buildMemoryPairsRound creates two cards for each unique food', function () {
    [3, 4, 5].forEach(function (pairCount) {
        const round = pairsLogic.buildMemoryPairsRound(
            pairCount,
            foodData.FOOD_DATA,
            shuffle,
            foodData.getFoodId
        );
        assert.equal(round.cards.length, pairCount * 2);
        const pairIds = round.cards.map(card => card.pairId);
        assert.equal(new Set(pairIds).size, pairCount);
        pairIds.forEach(function (pairId) {
            assert.equal(pairIds.filter(id => id === pairId).length, 2);
        });
        round.cards.forEach(function (card) {
            assert.ok(card.name);
            assert.ok(card.image);
            assert.equal(typeof card.pairId, 'string');
        });
    });
});

test('buildMemoryPairsRound rejects invalid rounds', function () {
    assert.throws(
        () => pairsLogic.buildMemoryPairsRound(1, foodData.FOOD_DATA, shuffle, foodData.getFoodId),
        /pairCount/
    );
    assert.throws(
        () => pairsLogic.buildMemoryPairsRound(3, [], shuffle, foodData.getFoodId),
        /items must contain/
    );
    assert.throws(
        () => pairsLogic.buildMemoryPairsRound(6, foodData.FOOD_DATA, shuffle, foodData.getFoodId),
        /pairCount/
    );
});

function createElement(tagName) {
    return {
        tagName,
        className: '',
        children: [],
        dataset: {},
        listeners: {},
        style: { setProperty(name, value) { this.styleValues = this.styleValues || {}; this.styleValues[name] = value; }, styleValues: {} },
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        addEventListener(type, handler) {
            this.listeners[type] = handler;
        },
        set textContent(value) {
            this.textContentValue = value;
            this.children = [];
        },
        get textContent() {
            return this.textContentValue || '';
        }
    };
}

test('view renders the requested pair grid', function () {
    const round = pairsLogic.buildMemoryPairsRound(4, foodData.FOOD_DATA, shuffle, foodData.getFoodId);
    const doc = { createElement: tagName => createElement(tagName) };
    const container = createElement('div');
    pairsView.renderMemoryPairsGrid(doc, container, round.cards, 4, {});
    assert.equal(container.className, 'dual-grid dual-grid-4x2');
    assert.equal(container.children.length, 8);
    assert.equal(container.children[0].className, 'dual-grid-cell memory-card');
    assert.ok(container.children[0].dataset.pairId);
});

