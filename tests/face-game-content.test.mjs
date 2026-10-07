import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const faceSet = require('../js/celebrity-faces.js');
const { createFaceGameContent } = require('../js/face-game-content.js');

const content = createFaceGameContent({ faceSet: faceSet });

test('face content exposes all six expression options', function () {
    assert.deepEqual(content.expressionOptions(), [
        { value: 'neutral', label: '無表情' },
        { value: 'happy', label: '開心' },
        { value: 'sad', label: '傷心' },
        { value: 'angry', label: '生氣' },
        { value: 'fear', label: '驚慌' },
        { value: 'disgust', label: '厭惡' }
    ]);
});

test('expression items project expression categories over all faces', function () {
    const items = content.listItems({ dimension: 'expression' });
    assert.equal(items.length, 60);
    assert.equal(new Set(items.map(item => item.id)).size, 60);
    assert.equal(items.filter(item => item.expressionKey === 'neutral').length, 10);
    assert.equal(items[0].category, items[0].expressionKey);
    assert.equal(items[0].categoryLabel, items[0].expressionLabel);
});

test('identity items project person categories over all faces', function () {
    const items = content.listItems({ dimension: 'identity' });
    assert.equal(items.length, 60);
    assert.equal(Object.keys(content.groupItems('identity')).length, 10);
    items.forEach(function (item) {
        assert.equal(item.category, item.personId);
        assert.equal(item.categoryLabel, item.personLabel);
        assert.equal(content.keyFor(item, 'identity'), item.personId);
    });
});

test('expression groups contain ten distinct people each', function () {
    const groups = content.groupItems('expression');
    Object.keys(groups).forEach(function (key) {
        assert.equal(groups[key].length, 10);
        assert.equal(new Set(groups[key].map(item => item.personId)).size, 10);
    });
});

test('face content rejects unknown dimensions and missing Face Sets', function () {
    assert.throws(() => content.listItems({ dimension: 'word' }), /Unknown face dimension/);
    assert.throws(() => createFaceGameContent({ faceSet: null }), /requires a Face Set/);
});
