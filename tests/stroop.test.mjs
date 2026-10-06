import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const stroop = require('../js/food/stroop.js');
const logic = require('../js/food/stroop-logic.js');
const session = require('../js/food/stroop-session.js');
const screen = require('../js/food/stroop-screen.js');
const playback = require('../js/food/stroop-playback.js');
const response = require('../js/food/stroop-response.js');
const view = require('../js/food/stroop-view.js');
const faceSet = require('../js/celebrity-faces.js');

function makeRandom() {
    let seed = 246813579;
    return function () {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
    };
}

test('module exposes the seam: mount, logic, session, screen, playback, response and view', function () {
    assert.equal(typeof stroop.mount, 'function');
    assert.equal(typeof logic.buildStroopSequence, 'function');
    assert.equal(typeof session.createStroopSession, 'function');
    assert.equal(typeof screen.createStroopScreenDefinition, 'function');
    assert.equal(typeof playback.createStroopPlayback, 'function');
    assert.equal(typeof response.createStroopResponse, 'function');
    assert.equal(typeof view.createStroopEls, 'function');
});

test('mount returns null without a document or required dependencies', function () {
    assert.equal(stroop.mount(null), null);
    assert.equal(stroop.mount(undefined), null);
    assert.equal(stroop.mount({ ownerDocument: { getElementById: function () { return null; } } }, {}), null);
    assert.equal(stroop.mount({
        ownerDocument: { getElementById: function () { return null; } }
    }, {
        faceSet: faceSet,
        logic: logic,
        session: session,
        screen: screen,
        playback: playback,
        response: response,
        view: view
    }), null);
});

test('screen definition is the single face-target game screen', function () {
    const definition = screen.createStroopScreenDefinition();
    assert.equal(definition.game.topBar.backId, 'stroopBackBtn');
    assert.equal(definition.game.topBar.titleId, undefined);
    assert.equal(definition.game.topBar.scoreId, 'stroopScoreNum');
    assert.equal(definition.game.stage.id, 'stroopStage');
    assert.equal(definition.game.stage.children.length, 1);
    assert.equal(definition.game.stage.children[0].id, 'stroopFaceWrap');
    assert.equal(definition.game.footer.controls.left.children.length, 2);
    assert.equal(definition.game.footer.controls.children[0].className, 'go-btn');
    assert.equal(definition.game.footer.controls.children[1].className, 'nogo-btn');
    assert.equal(definition.settings, undefined);
});

test('generated trials use only shipped faces and the expected word labels', function () {
    const sequence = logic.buildStroopSequence({
        faces: faceSet.listFaces(),
        count: 48,
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
