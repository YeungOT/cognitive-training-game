import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const stroop = require('../js/food/stroop.js');
const logic = require('../js/food/stroop-logic.js');
const session = require('../js/food/stroop-session.js');
const screen = require('../js/food/stroop-screen.js');
const view = require('../js/food/stroop-view.js');
const faceSet = require('../js/celebrity-faces.js');

function makeRandom() {
    let seed = 246813579;
    return function () {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
    };
}

test('module exposes the seam: mount, logic, screen and view', function () {
    assert.equal(typeof stroop.mount, 'function');
    assert.equal(typeof logic.buildStroopSequence, 'function');
    assert.equal(typeof logic.evaluateStroopResponse, 'function');
    assert.equal(typeof logic.summariseStroopTrials, 'function');
    assert.equal(typeof session.createStroopSession, 'function');
    assert.equal(typeof screen.createStroopScreenDefinition, 'function');
    assert.equal(typeof view.createStroopEls, 'function');
});

test('mount returns null without a document or required dependencies', function () {
    assert.equal(stroop.mount(null), null);
    assert.equal(stroop.mount(undefined), null);
    assert.equal(stroop.mount({ ownerDocument: { getElementById: function () { return null; } } }, {}), null);
    assert.equal(stroop.mount({
        ownerDocument: { getElementById: function () { return null; } }
    }, { faceSet: faceSet, logic: logic, stroopScreen: screen, view: view }), null);
});

test('screen definition follows the shared Game Screen contract', function () {
    const definition = screen.createStroopScreenDefinition();
    assert.equal(definition.game.topBar.backId, 'stroopBackBtn');
    assert.equal(definition.game.topBar.scoreId, 'stroopScoreNum');
    assert.equal(definition.game.stage.id, 'stroopStage');
    assert.equal(definition.game.footer.className, 'bottom-controls');
    assert.equal(definition.game.footer.controls.left.children.length, 2);
    assert.equal(definition.settings, undefined);
    const answerButtons = definition.game.footer.controls.children;
    assert.equal(answerButtons.length, 2);
    assert.equal(answerButtons[0].id, 'stroopPositiveBtn');
    assert.equal(answerButtons[1].id, 'stroopNegativeBtn');
});

test('mode list is the two-way contract used by the game and settings', function () {
    assert.deepEqual(logic.STROOP_MODES, ['face', 'word']);
});

test('generated trials use only shipped faces and the expected word labels', function () {
    const sequence = logic.buildStroopSequence({
        faces: faceSet.listFaces(),
        mode: 'face',
        measuredCount: 48,
        practiceCount: 6,
        random: makeRandom()
    });
    const shippedSources = new Set(faceSet.listFaces().map(face => face.src));
    const allowedWords = new Set(['開心', '傷心'].concat(logic.DEFAULT_NEUTRAL_WORDS));
    sequence.forEach(trial => {
        assert.equal(shippedSources.has(trial.face.src), true);
        assert.equal(allowedWords.has(trial.word.label), true);
        assert.ok(trial.targetAnswer === 'positive' || trial.targetAnswer === 'negative');
    });
});
