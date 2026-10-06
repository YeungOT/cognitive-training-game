import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const playbackModule = require('../js/food/stroop-playback.js');

function fakeActivityFactory() {
    const calls = { start: [], stop: 0, reset: 0, speeds: [] };
    let config = null;
    return {
        calls: calls,
        create: function (options) {
            config = options;
            return {
                start: function (speed) { calls.start.push(speed); },
                stop: function () { calls.stop++; },
                reset: function () { calls.reset++; },
                setSpeed: function (speed) { calls.speeds.push(speed); }
            };
        },
        tick: function () { if (config && config.tick) config.tick(); }
    };
}

test('playback starts and pauses the activity', function () {
    const factory = fakeActivityFactory();
    const playback = playbackModule.createStroopPlayback({ activity: factory });
    assert.equal(playback.isPlaying(), false);
    playback.start();
    assert.equal(playback.isPlaying(), true);
    assert.deepEqual(factory.calls.start, [5]);
    playback.pause();
    assert.equal(playback.isPlaying(), false);
    assert.equal(factory.calls.stop, 1);
});

test('playback clamps speed and resets the timer while playing', function () {
    const factory = fakeActivityFactory();
    const playback = playbackModule.createStroopPlayback({ activity: factory });
    playback.start();
    assert.equal(playback.setSpeed(1), 6);
    assert.equal(playback.setSpeed(10), 10);
    assert.deepEqual(factory.calls.speeds, [6, 10]);
    assert.equal(factory.calls.reset, 2);
});

test('playback auto-advances only while playing and allowed', function () {
    const factory = fakeActivityFactory();
    let advanced = 0;
    let allowed = true;
    const playback = playbackModule.createStroopPlayback({
        activity: factory,
        canAutoAdvance: function () { return allowed; },
        onAutoAdvance: function () { advanced++; }
    });
    factory.tick();
    assert.equal(advanced, 0);
    playback.start();
    factory.tick();
    assert.equal(advanced, 1);
    allowed = false;
    factory.tick();
    assert.equal(advanced, 1);
    allowed = true;
    playback.pause();
    factory.tick();
    assert.equal(advanced, 1);
});

test('resetTimer only resets while playing', function () {
    const factory = fakeActivityFactory();
    const playback = playbackModule.createStroopPlayback({ activity: factory });
    playback.resetTimer();
    assert.equal(factory.calls.reset, 0);
    playback.start();
    playback.resetTimer();
    assert.equal(factory.calls.reset, 1);
});
