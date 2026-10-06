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

function build(overrides) {
    return logic.buildStroopSequence(Object.assign({
        faces: faceSet.listFaces(),
        count: 48,
        random: makeRandom()
    }, overrides || {}));
}

function answerFor(valence) {
    return valence > 0 ? 'positive' : 'negative';
}

test('sequence contains 48 scored trials with balanced conditions', function () {
    const sequence = build();
    assert.equal(sequence.length, 48);
    const counts = { congruent: 0, incongruent: 0, neutral: 0 };
    sequence.forEach(trial => {
        counts[trial.condition]++;
        assert.equal(trial.phase, undefined);
    });
    assert.equal(counts.congruent, 16);
    assert.equal(counts.incongruent, 16);
    assert.equal(counts.neutral, 16);
});

test('the face is always the target', function () {
    build().forEach(trial => {
        assert.equal(trial.targetAnswer, answerFor(trial.face.valence));
        if (trial.condition === 'neutral') assert.equal(trial.word.valence, 0);
    });
});

test('congruent trials share valence and incongruent trials do not', function () {
    build().forEach(trial => {
        if (trial.condition === 'congruent') assert.equal(trial.face.valence, trial.word.valence);
        if (trial.condition === 'incongruent') assert.notEqual(trial.face.valence, trial.word.valence);
    });
});

test('the sequence avoids immediate repeated images and long condition runs', function () {
    const sequence = build();
    for (let i = 1; i < sequence.length; i++) {
        assert.notEqual(sequence[i].face.src, sequence[i - 1].face.src);
    }
    let run = 1;
    for (let i = 1; i < sequence.length; i++) {
        run = sequence[i].condition === sequence[i - 1].condition ? run + 1 : 1;
        assert.ok(run <= 2, 'condition run exceeded at index ' + i);
    }
});

test('evaluateStroopResponse compares against the face target', function () {
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

test('buildStroopSequence fails loudly on invalid inputs', function () {
    assert.throws(() => build({ count: 47 }), /divide evenly/);
    assert.throws(() => build({ neutralWords: [] }), /neutral words/);
    assert.throws(() => build({
        faces: faceSet.listFaces({ expressionKey: 'happy' })
    }), /happy and sad/);
});
