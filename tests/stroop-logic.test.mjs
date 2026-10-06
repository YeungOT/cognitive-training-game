import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const logic = require('../js/food/stroop-logic.js');
const faceSet = require('../js/celebrity-faces.js');

function makeRandom() {
    let seed = 987654321;
    return function () {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
    };
}

function build(mode, overrides) {
    return logic.buildStroopSequence(Object.assign({
        faces: faceSet.listFaces(),
        mode: mode,
        measuredCount: 48,
        practiceCount: 6,
        random: makeRandom()
    }, overrides || {}));
}

function answerFor(valence) {
    return valence > 0 ? 'positive' : 'negative';
}

test('sequence contains the practice and measured phases with balanced conditions', function () {
    const sequence = build('face');
    assert.equal(sequence.length, 54);
    const practice = sequence.filter(trial => trial.phase === 'practice');
    const measured = sequence.filter(trial => trial.phase === 'measured');
    assert.equal(practice.length, 6);
    assert.equal(measured.length, 48);
    for (const phase of [practice, measured]) {
        const counts = { congruent: 0, incongruent: 0, neutral: 0 };
        phase.forEach(trial => { counts[trial.condition]++; });
        assert.equal(counts.congruent, phase.length / 3);
        assert.equal(counts.incongruent, phase.length / 3);
        assert.equal(counts.neutral, phase.length / 3);
    }
});

test('face-target trials answer from the face and word-target trials answer from the word', function () {
    const faceTrials = build('face');
    faceTrials.forEach(trial => {
        if (trial.condition === 'neutral') {
            assert.equal(trial.word.valence, 0);
        }
        assert.equal(trial.targetAnswer, answerFor(trial.face.valence));
    });

    const wordTrials = build('word');
    wordTrials.forEach(trial => {
        if (trial.condition === 'neutral') {
            assert.equal(trial.face.expressionKey, 'neutral');
        }
        assert.equal(trial.targetAnswer, answerFor(trial.word.valence));
    });
});

test('congruent trials share valence and incongruent trials do not', function () {
    for (const mode of ['face', 'word']) {
        build(mode).forEach(trial => {
            if (trial.condition === 'congruent') {
                assert.equal(trial.face.valence, trial.word.valence);
            }
            if (trial.condition === 'incongruent') {
                assert.notEqual(trial.face.valence, trial.word.valence);
            }
        });
    }
});

test('word-target neutral trials use neutral faces and emotional words', function () {
    build('word').forEach(trial => {
        if (trial.condition === 'neutral') {
            assert.equal(trial.face.expressionKey, 'neutral');
            assert.notEqual(trial.word.valence, 0);
        }
    });
});

test('the sequence avoids immediate repeated images and long condition runs', function () {
    const sequence = build('face');
    for (let i = 1; i < sequence.length; i++) {
        assert.notEqual(sequence[i].face.src, sequence[i - 1].face.src);
    }
    let run = 1;
    for (let i = 1; i < sequence.length; i++) {
        run = sequence[i].condition === sequence[i - 1].condition ? run + 1 : 1;
        assert.ok(run <= 2, 'condition run exceeded at index ' + i);
    }
});

test('evaluateStroopResponse compares against the trial target', function () {
    const trial = { targetAnswer: 'positive' };
    assert.equal(logic.evaluateStroopResponse(trial, 'positive'), true);
    assert.equal(logic.evaluateStroopResponse(trial, 'negative'), false);
    assert.equal(logic.evaluateStroopResponse(null, 'positive'), false);
});

test('summariseStroopTrials reports accuracy, medians and interference', function () {
    const records = [
        { condition: 'congruent', correct: true, rtMs: 800 },
        { condition: 'congruent', correct: true, rtMs: 1000 },
        { condition: 'incongruent', correct: true, rtMs: 1200 },
        { condition: 'incongruent', correct: true, rtMs: 1400 },
        { condition: 'neutral', correct: true, rtMs: 900 },
        { condition: 'neutral', correct: false, rtMs: 2000 }
    ];
    const summary = logic.summariseStroopTrials(records);
    assert.equal(summary.total, 6);
    assert.equal(summary.correct, 5);
    assert.equal(summary.accuracy, 5 / 6);
    assert.equal(summary.medianRtByCondition.congruent, 900);
    assert.equal(summary.medianRtByCondition.incongruent, 1300);
    assert.equal(summary.medianRtByCondition.neutral, 900);
    assert.equal(summary.interferenceMs, 400);
});

test('windowMsForSpeed maps the agreed 5000/3000/1500 ms window', function () {
    assert.equal(logic.windowMsForSpeed(1), 5000);
    assert.equal(logic.windowMsForSpeed(5), 3000);
    assert.equal(logic.windowMsForSpeed(10), 1500);
    assert.equal(logic.windowMsForSpeed(0), 5000);
    assert.equal(logic.windowMsForSpeed(11), 1500);
});

test('buildStroopSequence fails loudly on invalid inputs', function () {
    assert.throws(() => build('face', { measuredCount: 47 }), /divide evenly/);
    assert.throws(() => build('sideways'), /Unknown Stroop mode/);
    assert.throws(() => build('word', {
        faces: faceSet.listFaces({ expressionKey: 'happy' }).concat(faceSet.listFaces({ expressionKey: 'sad' }))
    }), /neutral faces/);
});
