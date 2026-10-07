import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const faceSet = require('../js/celebrity-faces.js');
const { createFaceGameContent } = require('../js/face-game-content.js');
const logic = require('../js/face-nback-logic.js');

const faceContent = createFaceGameContent({ faceSet: faceSet });
const faces = faceContent.listItems({ dimension: 'expression' });

function randomAlways(value) {
    return function () { return value; };
}

test('identity match trials reuse the person and prefer a different expression', function () {
    const sequence = logic.buildFaceNbackSequence({
        dimension: 'identity',
        n: 1,
        length: 6,
        faces: faces,
        matchProbability: 1,
        random: randomAlways(0)
    });
    for (let i = 1; i < sequence.length; i++) {
        assert.equal(sequence[i].isMatch, true);
        assert.equal(sequence[i].value.personId, sequence[i - 1].value.personId);
        assert.notEqual(sequence[i].value.expressionKey, sequence[i - 1].value.expressionKey);
    }
});

test('expression match trials reuse the expression and prefer a different person', function () {
    const sequence = logic.buildFaceNbackSequence({
        dimension: 'expression',
        n: 1,
        length: 6,
        faces: faces,
        matchProbability: 1,
        random: randomAlways(0)
    });
    for (let i = 1; i < sequence.length; i++) {
        assert.equal(sequence[i].isMatch, true);
        assert.equal(sequence[i].value.expressionKey, sequence[i - 1].value.expressionKey);
        assert.notEqual(sequence[i].value.personId, sequence[i - 1].value.personId);
    }
});

test('non-match trials differ on the selected dimension', function () {
    ['identity', 'expression'].forEach(function (dimension) {
        const sequence = logic.buildFaceNbackSequence({
            dimension: dimension,
            n: 1,
            length: 6,
            faces: faces,
            matchProbability: 0,
            random: randomAlways(0)
        });
        for (let i = 1; i < sequence.length; i++) {
            assert.equal(sequence[i].isMatch, false);
            assert.notEqual(
                logic.keyFor(sequence[i].value, dimension),
                logic.keyFor(sequence[i - 1].value, dimension)
            );
        }
    });
});

test('face N-back includes neutral and rejects unknown dimensions', function () {
    const sequence = logic.buildFaceNbackSequence({
        dimension: 'expression',
        n: 1,
        length: 50,
        faces: faces,
        matchProbability: 0.5,
        random: Math.random
    });
    assert.equal(sequence.length, 50);
    assert.throws(() => logic.buildFaceNbackSequence({
        dimension: 'word',
        n: 1,
        length: 2,
        faces: faces
    }), /Unknown face N-back dimension/);
});

test('dual face N-back derives identity and expression match streams from one face sequence', function () {
    const sequences = logic.buildDualFaceSequences({
        n: 1,
        length: 12,
        faces: faces,
        matchProbability: 0.5,
        random: randomAlways(0.1)
    });
    assert.equal(sequences.identity.length, 12);
    assert.equal(sequences.expression.length, 12);
    for (let i = 0; i < 12; i++) {
        assert.equal(sequences.identity[i].value.id, sequences.expression[i].value.id);
        assert.equal(typeof sequences.identity[i].isMatch, 'boolean');
        assert.equal(typeof sequences.expression[i].isMatch, 'boolean');
    }
});
