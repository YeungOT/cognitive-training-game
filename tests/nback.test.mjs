import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nback = require('../js/food/nback.js');
const foodData = require('../js/food/food-data.js');
const { CognitiveSequence: sequence } = require('../js/food/sequence.js');

const FOOD_DATA = foodData.FOOD_DATA;

test('module exposes the seam: mount + generateNbackSequence', function () {
    assert.equal(typeof nback.mount, 'function');
    assert.equal(typeof nback.generateNbackSequence, 'function');
});

test('mount returns null without a document or required deps', function () {
    assert.equal(nback.mount(null), null);
    assert.equal(nback.mount(undefined), null);
    assert.equal(nback.mount({ ownerDocument: { getElementById: function () { return null; } } }, { foodData: foodData }), null);
    assert.equal(nback.mount({ ownerDocument: { getElementById: function () { return null; } } }, { foodData: foodData, sequence: sequence }), null);
});

test('generateNbackSequence returns length trials with value+isMatch', function () {
    const trials = nback.generateNbackSequence(50, 2, FOOD_DATA, sequence);
    assert.equal(trials.length, 50);
    trials.forEach(function (t, i) {
        assert.ok(t && typeof t === 'object');
        assert.ok('value' in t && 'isMatch' in t);
        if (i < 2) assert.equal(t.isMatch, false);
        assert.ok(t.value && t.value.name && t.value.image);
    });
});

test('generateNbackSequence match trial clones the n-back value (n=1)', function () {
    const trials = nback.generateNbackSequence(200, 1, FOOD_DATA, sequence);
    let matchFound = false;
    for (let i = 1; i < trials.length; i++) {
        if (trials[i].isMatch) {
            assert.equal(trials[i].value.name, trials[i - 1].value.name);
            matchFound = true;
            break;
        }
    }
    assert.ok(matchFound, 'at least one match in 200 trials');
});

test('generateNbackSequence clones values (no shared object identity)', function () {
    const trials = nback.generateNbackSequence(50, 1, FOOD_DATA, sequence);
    const first = trials[0].value;
    const matchIdx = trials.findIndex(function (t, i) { return i >= 1 && t.isMatch; });
    if (matchIdx !== -1) {
        assert.notEqual(trials[matchIdx].value, trials[matchIdx - 1].value);
        assert.equal(trials[matchIdx].value.name, trials[matchIdx - 1].value.name);
    }
});