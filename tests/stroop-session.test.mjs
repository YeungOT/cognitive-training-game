import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sessionModule = require('../js/food/stroop-session.js');

const logic = {
    evaluateStroopResponse: function (trial, answer) {
        return trial.targetAnswer === answer;
    }
};

function makeClock() {
    let now = 0;
    return {
        now: function () { return now; },
        set: function (value) { now = value; }
    };
}

const sequence = [
    { condition: 'congruent', targetAnswer: 'positive' },
    { condition: 'incongruent', targetAnswer: 'negative' },
    { condition: 'neutral', targetAnswer: 'positive' }
];

test('session advances through the sequence and records responses', function () {
    const clock = makeClock();
    const session = sessionModule.createStroopSession({ logic: logic, sequence: sequence, clock: clock.now });

    const first = session.advance();
    assert.equal(first, sequence[0]);
    assert.equal(session.canAnswer(), true);
    clock.set(10);
    const practice = session.answer('positive');
    assert.equal(practice.correct, true);
    assert.equal(practice.rtMs, 10);
    assert.equal(session.score(), 1);
    assert.equal(session.canAnswer(), false);
    assert.equal(session.answer('negative'), null);

    const second = session.advance();
    assert.equal(second, sequence[1]);
    clock.set(25);
    assert.equal(session.answer('positive').correct, false);
    assert.equal(session.score(), 1);

    assert.equal(session.advance(), sequence[2]);
    clock.set(40);
    assert.equal(session.answer('positive').correct, true);
    assert.equal(session.score(), 2);

    assert.equal(session.advance(), null);
    assert.equal(session.isFinished(), true);
    const records = session.records();
    assert.equal(records.length, 3);
    assert.deepEqual(records.map(record => record.correct), [true, false, true]);
    assert.deepEqual(records.map(record => record.timeout), [false, false, false]);
});

test('session records an unanswered trial as a timeout', function () {
    const clock = makeClock();
    const session = sessionModule.createStroopSession({ logic: logic, sequence: sequence.slice(0, 2), clock: clock.now });
    session.advance();
    session.advance();
    assert.equal(session.advance(), null);
    const records = session.records();
    assert.equal(records.length, 2);
    records.forEach(record => {
        assert.equal(record.timeout, true);
        assert.equal(record.rtMs, null);
        assert.equal(record.correct, false);
    });
});

test('manual advance can skip an unanswered trial without recording a timeout', function () {
    const session = sessionModule.createStroopSession({
        logic: logic,
        sequence: sequence.slice(0, 1)
    });
    session.advance();
    assert.equal(session.advance({ recordTimeout: false }), null);
    assert.deepEqual(session.records(), []);
});

test('reset clears score, records and current trial', function () {
    const session = sessionModule.createStroopSession({ logic: logic, sequence: sequence });
    session.advance();
    session.answer('positive');
    session.advance();
    session.answer('negative');
    assert.equal(session.score(), 2);
    session.reset([]);
    assert.equal(session.current(), null);
    assert.equal(session.score(), 0);
    assert.deepEqual(session.records(), []);
    assert.equal(session.isFinished(), true);
});
