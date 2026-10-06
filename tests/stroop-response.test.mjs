import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const responseModule = require('../js/food/stroop-response.js');

function makeHarness(options) {
    options = options || {};
    const calls = { score: [], feedback: [], audio: [], flash: [], advanced: 0 };
    const session = {
        canAnswer: function () { return options.canAnswer !== false; },
        answer: function () {
            return {
                correct: options.correct !== false,
                trial: {}
            };
        },
        score: function () { return 1; }
    };
    const view = {
        setScore: function (els, score) { calls.score.push(score); },
        flashStage: function (els, correct) { calls.flash.push(correct); }
    };
    const feedback = {
        show: function (els, text, kind) { calls.feedback.push(text + '|' + kind); }
    };
    const audio = {
        play: function (kind) { calls.audio.push(kind); }
    };
    const response = responseModule.createStroopResponse({
        session: session,
        view: view,
        feedback: feedback,
        audio: audio,
        els: { stage: {} },
        feedbackMs: 20,
        isPlaying: function () { return options.playing === true; },
        onAdvance: function () { calls.advanced++; }
    });
    return { response: response, calls: calls };
}

test('response scores a measured correct answer and advances in auto mode', async function () {
    const harness = makeHarness({ playing: true });
    assert.equal(harness.response.handle('positive'), true);
    assert.equal(harness.response.isPending(), true);
    assert.deepEqual(harness.calls.score, [1]);
    assert.deepEqual(harness.calls.feedback, ['✅ 正確|correct']);
    assert.deepEqual(harness.calls.flash, [true]);
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.equal(harness.response.isPending(), false);
    assert.equal(harness.calls.advanced, 1);
});

test('response does not auto-advance in manual mode', async function () {
    const harness = makeHarness({ playing: false });
    harness.response.handle('negative');
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.equal(harness.calls.advanced, 0);
});

test('response refuses to answer when the session is not answerable', function () {
    const harness = makeHarness({ canAnswer: false });
    assert.equal(harness.response.handle('positive'), false);
});
