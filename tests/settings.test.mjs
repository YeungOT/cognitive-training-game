import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createSettingsStore, CognitiveSettingsStore } = require('../js/settings.js');

function createStorage(initial) {
    const data = new Map(Object.entries(initial || {}));
    return {
        getItem: key => data.has(key) ? data.get(key) : null,
        setItem: (key, value) => data.set(key, value),
        snapshot: () => Object.fromEntries(data)
    };
}

function createSchemas(overrides) {
    return Object.assign({
        flagKey: {
            format: 'flag',
            default: { enabled: true },
            fields: {
                enabled: { type: 'boolean' }
            }
        },
        stringKey: {
            format: 'string',
            default: { mode: 'auto' },
            fields: {
                mode: { type: 'string', enum: ['auto', 'manual'] }
            }
        },
        jsonKey: {
            format: 'json',
            default: {
                count: 3,
                label: 'apple',
                enabled: false
            },
            fields: {
                count: { type: 'number', enum: [2, 3, 4] },
                label: { type: 'string', enum: () => ['apple', 'pear'] },
                enabled: { type: 'boolean' }
            }
        },
        migrateKey: {
            format: 'json',
            default: { season: 'auto' },
            migrate(raw) {
                if (raw && raw.season === '春') raw.season = '春天';
                return raw;
            },
            fields: {
                season: { type: 'string', enum: ['auto', '春天', '夏天'] }
            }
        }
    }, overrides || {});
}

test('load returns defaults when storage is empty', function () {
    const storage = createStorage();
    const store = createSettingsStore({ storage, schemas: createSchemas() });

    assert.deepEqual(store.load('flagKey'), { enabled: true });
    assert.deepEqual(store.load('stringKey'), { mode: 'auto' });
    assert.deepEqual(store.load('jsonKey'), {
        count: 3,
        label: 'apple',
        enabled: false
    });
});

test('load keeps only valid stored fields', function () {
    const storage = createStorage({
        jsonKey: JSON.stringify({ count: 4, label: 'pear', enabled: true, extra: true })
    });
    const store = createSettingsStore({ storage, schemas: createSchemas() });

    assert.deepEqual(store.load('jsonKey'), {
        count: 4,
        label: 'pear',
        enabled: true
    });
});

test('invalid stored values fall back to defaults', function () {
    const storage = createStorage({
        flagKey: 'maybe',
        jsonKey: JSON.stringify({ count: 99, label: 'banana' })
    });
    const store = createSettingsStore({ storage, schemas: createSchemas() });

    assert.deepEqual(store.load('flagKey'), { enabled: true });
    assert.deepEqual(store.load('jsonKey'), {
        count: 3,
        label: 'apple',
        enabled: false
    });
});

test('save merges a valid patch and preserves other fields', function () {
    const storage = createStorage({
        jsonKey: JSON.stringify({ count: 2, label: 'pear', enabled: true })
    });
    const store = createSettingsStore({ storage, schemas: createSchemas() });

    assert.equal(store.save('jsonKey', { count: 4 }), true);
    assert.deepEqual(store.load('jsonKey'), {
        count: 4,
        label: 'pear',
        enabled: true
    });
});

test('save rejects unknown fields without writing', function () {
    const storage = createStorage({
        jsonKey: JSON.stringify({ count: 2 })
    });
    const store = createSettingsStore({ storage, schemas: createSchemas() });

    assert.equal(store.save('jsonKey', { mystery: true }), false);
    assert.deepEqual(store.load('jsonKey'), { count: 2, label: 'apple', enabled: false });
    assert.deepEqual(JSON.parse(storage.snapshot().jsonKey), { count: 2 });
});

test('save rejects invalid enum values without writing', function () {
    const storage = createStorage();
    const store = createSettingsStore({ storage, schemas: createSchemas() });

    assert.equal(store.save('jsonKey', { label: 'banana' }), false);
    assert.equal(store.load('jsonKey').label, 'apple');
    assert.equal(storage.snapshot().jsonKey, undefined);
});

test('flag and string formats preserve existing storage shapes', function () {
    const storage = createStorage();
    const store = createSettingsStore({ storage, schemas: createSchemas() });

    assert.equal(store.save('flagKey', { enabled: false }), true);
    assert.equal(store.save('stringKey', { mode: 'manual' }), true);
    assert.equal(storage.snapshot().flagKey, 'false');
    assert.equal(storage.snapshot().stringKey, 'manual');
    assert.deepEqual(store.load('flagKey'), { enabled: false });
    assert.deepEqual(store.load('stringKey'), { mode: 'manual' });
});

test('migrate normalizes old values and writes back', function () {
    const storage = createStorage({
        migrateKey: JSON.stringify({ season: '春' })
    });
    const store = createSettingsStore({ storage, schemas: createSchemas() });

    assert.deepEqual(store.load('migrateKey'), { season: '春天' });
    assert.deepEqual(JSON.parse(storage.snapshot().migrateKey), { season: '春天' });
});

test('unknown keys throw and cannot be saved', function () {
    const storage = createStorage();
    const store = createSettingsStore({ storage, schemas: createSchemas() });

    assert.throws(() => store.load('missing'), /Unknown settings key/);
    assert.equal(store.save('missing', { value: true }), false);
});

test('default store owns the expected keys and returns defaults', function () {
    const storage = createStorage();
    const store = createSettingsStore({ storage });

    assert.equal(store.keys.theme, 'cognitiveAppTheme');
    assert.equal(store.keys.music, 'cognitiveAppMusic');
    assert.equal(store.keys.sfx, 'cognitiveAppSfx');
    assert.equal(store.keys.gng, 'cognitiveGngPrefs');
    assert.equal(store.keys.nback, 'cognitiveNbackPrefs');
    assert.equal(store.keys.different, 'cognitiveDifferentPrefs');
    assert.equal(store.keys.pairs, 'cognitivePairsPrefs');
    assert.equal(store.keys.shopping, 'cognitiveShoppingPrefs');
    assert.equal(store.keys.reality, 'realityOrientationSettings');
    assert.deepEqual(store.load(store.keys.theme), { theme: 'light' });
    assert.deepEqual(store.load(store.keys.music), { music: true });
    assert.deepEqual(store.load(store.keys.pairs), {
        contentMode: 'food',
        pairCount: 4,
        previewTime: 'manual'
    });
    assert.deepEqual(store.load(store.keys.reality), {
        weather: '晴',
        season: '自動',
        location: '未設定'
    });
});

test('singleton is available from the module', function () {
    assert.equal(typeof CognitiveSettingsStore.load, 'function');
    assert.equal(typeof CognitiveSettingsStore.save, 'function');
});

test('save returns false without throwing when storage writes fail', function () {
    const storage = {
        getItem: () => null,
        setItem: () => {
            throw new DOMException('QuotaExceededError', 'QuotaExceededError');
        }
    };
    const store = createSettingsStore({ storage: storage, schemas: createSchemas() });
    assert.equal(store.save('flagKey', { enabled: false }), false);
    assert.deepEqual(store.load('flagKey'), { enabled: true });
});

test('load returns defaults and save degrades when storage reads throw', function () {
    const storage = {
        getItem: () => {
            throw new DOMException('SecurityError', 'SecurityError');
        },
        setItem: () => {
            throw new DOMException('SecurityError', 'SecurityError');
        }
    };
    const store = createSettingsStore({ storage: storage, schemas: createSchemas() });
    assert.deepEqual(store.load('flagKey'), { enabled: true });
    assert.equal(store.save('flagKey', { enabled: false }), false);
});
