import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const faces = require('../js/celebrity-faces.js');
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('Face Set exposes all six shipped expressions', function () {
    assert.equal(faces.people.length, 10);
    assert.equal(faces.expressions.length, 6);
    assert.deepEqual(
        faces.expressions.map(expression => expression.key),
        ['neutral', 'happy', 'sad', 'angry', 'fear', 'disgust']
    );
    assert.deepEqual(
        faces.shippedExpressions.map(expression => expression.key).sort(),
        ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad']
    );
});

test('display labels use the agreed vocabulary', function () {
    const byKey = {};
    faces.expressions.forEach(expression => { byKey[expression.key] = expression.label; });
    assert.equal(byKey.neutral, '無表情');
    assert.equal(byKey.happy, '開心');
    assert.equal(byKey.sad, '傷心');
    assert.equal(byKey.angry, '生氣');
    assert.equal(byKey.fear, '驚慌');
    assert.equal(byKey.disgust, '厭惡');
});

test('getFace resolves shipped faces including the neutral expression', function () {
    const happy = faces.getFace('anita-mui', 'happy');
    assert.equal(happy.src, 'assets/celebrity-faces/anita-mui_happy.webp');
    assert.equal(happy.expressionLabel, '開心');
    assert.equal(happy.valence, 1);
    const neutral = faces.getFace('anita-mui', 'neutral');
    assert.equal(neutral.src, 'assets/celebrity-faces/anita-mui_canonical.webp');
    assert.equal(neutral.expressionLabel, '無表情');
});

test('getFace fails loudly for unknown people and expressions', function () {
    assert.throws(() => faces.getFace('nobody', 'happy'), /Unknown person/);
    assert.throws(() => faces.getFace('anita-mui', 'unknown'), /Unknown expression/);
});

test('listFaces returns the sixty shipped faces and filters by expression and person', function () {
    assert.equal(faces.listFaces().length, 60);
    assert.equal(faces.listFaces({ expressionKey: 'happy' }).length, 10);
    assert.equal(faces.listFaces({ expressionKey: 'neutral' }).length, 10);
    assert.equal(faces.listFaces({ personId: 'sam-hui' }).length, 6);
    assert.equal(faces.listFaces({ personId: 'sam-hui', expressionKey: 'sad' }).length, 1);
});

test('every person has all six expressions and every shipped source file exists', function () {
    const seen = new Set();
    faces.people.forEach(person => {
        ['neutral', 'happy', 'sad', 'angry', 'fear', 'disgust'].forEach(expressionKey => {
            assert.equal(faces.hasFace(person.id, expressionKey), true);
            const face = faces.getFace(person.id, expressionKey);
            assert.equal(seen.has(face.src), false, 'duplicate source: ' + face.src);
            seen.add(face.src);
            assert.equal(existsSync(resolve(repoRoot, face.src)), true, 'missing asset: ' + face.src);
        });
    });
    assert.equal(seen.size, 60);
});
