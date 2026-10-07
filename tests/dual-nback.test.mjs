import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dualNback = require('../js/food/dual-nback.js');
const logic = require('../js/food/dual-nback-logic.js');
const foodData = require('../js/food/food-data.js');
const { CognitiveSequence: sequence } = require('../js/food/sequence.js');

const FOOD_DATA = foodData.FOOD_DATA;
const GRIDS = logic.DUAL_POSITION_GRIDS;
const PALETTES = logic.DUAL_COLOR_PALETTES;

test('module exposes the seam: mount + pure-logic module + data tables', function () {
    assert.equal(typeof dualNback.mount, 'function');
    assert.equal(typeof logic.generateDualSequences, 'function');
    assert.equal(typeof logic.getDualModalityChoices, 'function');
    assert.equal(typeof logic.getDualModalityValue, 'function');
    assert.equal(typeof logic.cloneDualModalityValue, 'function');
    assert.equal(typeof logic.getDualFoodId, 'function');
    assert.equal(logic.DUAL_MODALITY_LABELS.image, '圖片');
    assert.equal(logic.DUAL_MODALITY_LABELS.identity, '身份');
    assert.equal(logic.DUAL_MODALITY_LABELS.expression, '表情');
    assert.equal(logic.DUAL_POSITION_GRIDS['3x3'].cols, 3);
    assert.equal(logic.DUAL_COLOR_PALETTES['6'].length, 6);
    assert.equal(logic.DUAL_NBACK_SEQUENCE_LENGTH, 50);
});

test('mount returns null without a document or required deps', function () {
    assert.equal(dualNback.mount(null), null);
    assert.equal(dualNback.mount(undefined), null);
    assert.equal(dualNback.mount({ ownerDocument: { getElementById: function () { return null; } } }, {}), null);
    assert.equal(dualNback.mount({ ownerDocument: { getElementById: function () { return null; } } }, { foodData: foodData }), null);
});

test('getDualFoodId / getDualModalityValue / cloneDualModalityValue semantics', function () {
    assert.equal(logic.getDualFoodId({ id: 'x', name: 'n' }), 'x');
    assert.equal(logic.getDualFoodId({ name: 'n' }), 'n');
    assert.equal(logic.getDualModalityValue('image', { id: 'i', name: 'n' }), 'i');
    assert.equal(logic.getDualModalityValue('identity', { personId: 'anita-mui' }), 'anita-mui');
    assert.equal(logic.getDualModalityValue('expression', { expressionKey: 'happy' }), 'happy');
    assert.equal(logic.getDualModalityValue('audio', { name: 'n' }), 'n');
    assert.equal(logic.getDualModalityValue('color', { name: '紅色', css: '#fff' }), '紅色');
    assert.equal(logic.getDualModalityValue('position', 5), 5);
    assert.deepEqual(logic.cloneDualModalityValue('image', { id: 'i', name: 'n' }), { id: 'i', name: 'n' });
    assert.equal(logic.cloneDualModalityValue('position', 3), 3);
    assert.equal(logic.cloneDualModalityValue('image', null), null);
});

test('getDualModalityChoices returns the right choice set per modality', function () {
    const args = ['3x3', '6', FOOD_DATA, GRIDS, PALETTES];
    assert.equal(logic.getDualModalityChoices('image', ...args), FOOD_DATA);
    assert.equal(logic.getDualModalityChoices('identity', ...args), FOOD_DATA);
    assert.equal(logic.getDualModalityChoices('expression', ...args), FOOD_DATA);
    assert.equal(logic.getDualModalityChoices('audio', ...args), FOOD_DATA);
    assert.deepEqual(logic.getDualModalityChoices('position', ...args), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    assert.deepEqual(logic.getDualModalityChoices('position', '2x2', '6', FOOD_DATA, GRIDS, PALETTES), [0, 1, 2, 3]);
    assert.equal(logic.getDualModalityChoices('color', '3x3', '3', FOOD_DATA, GRIDS, PALETTES).length, 3);
    assert.deepEqual(logic.getDualModalityChoices('unknown', ...args), []);
});

test('generateDualSequences builds a length-N trial map per modality', function () {
    const seqs = logic.generateDualSequences(['image', 'position'], 2, 50, '3x3', '6', FOOD_DATA, GRIDS, PALETTES, sequence);
    assert.ok(seqs.image && seqs.position);
    assert.equal(seqs.image.length, 50);
    assert.equal(seqs.position.length, 50);
    seqs.image.forEach(function (t, i) { assert.ok(t.value && t.value.name); if (i < 2) assert.equal(t.isMatch, false); });
    seqs.position.forEach(function (t, i) { assert.ok(typeof t.value === 'number'); if (i < 2) assert.equal(t.isMatch, false); });
});

test('generateDualSequences returns an empty map without a sequence dependency', function () {
    assert.deepEqual(logic.generateDualSequences(['image'], 1, 10, '3x3', '6', FOOD_DATA, GRIDS, PALETTES, null), {});
});
