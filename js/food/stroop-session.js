(function (global) {
    'use strict';

    // Pure session state machine for the Stroop game. It owns trial
    // progression, response evaluation, score and records; DOM, timers and
    // routing stay in the game module.

    function createStroopSession(options) {
        options = options || {};
        var logic = options.logic;
        var clock = options.clock || function () { return Date.now(); };
        if (!logic) throw new Error('Stroop session requires logic');

        var sequence = options.sequence || [];
        var index = -1;
        var currentTrial = null;
        var responded = false;
        var score = 0;
        var records = [];
        var startedAt = 0;

        function recordTimeoutIfUnanswered() {
            if (!currentTrial || responded) return;
            records.push({
                condition: currentTrial.condition,
                correct: false,
                rtMs: null,
                timeout: true
            });
        }

        function advance(options) {
            var shouldRecordTimeout = !options || options.recordTimeout !== false;
            if (shouldRecordTimeout) recordTimeoutIfUnanswered();
            index++;
            if (index >= sequence.length) {
                currentTrial = null;
                responded = false;
                return null;
            }
            currentTrial = sequence[index];
            responded = false;
            startedAt = clock();
            return currentTrial;
        }

        function canAnswer() {
            return !!currentTrial && !responded;
        }

        function answer(answerKey) {
            if (!canAnswer()) return null;
            responded = true;
            var rtMs = clock() - startedAt;
            var correct = logic.evaluateStroopResponse(currentTrial, answerKey);
            records.push({
                condition: currentTrial.condition,
                correct: correct,
                rtMs: rtMs,
                timeout: false
            });
            if (correct) score++;
            return { correct: correct, rtMs: rtMs, trial: currentTrial };
        }

        function reset(nextSequence) {
            sequence = nextSequence || [];
            index = -1;
            currentTrial = null;
            responded = false;
            score = 0;
            records = [];
            startedAt = 0;
        }

        return {
            advance: advance,
            answer: answer,
            canAnswer: canAnswer,
            current: function () { return currentTrial; },
            isFinished: function () { return sequence.length === 0 || index >= sequence.length; },
            score: function () { return score; },
            records: function () { return records.slice(); },
            reset: reset
        };
    }

    var api = { createStroopSession: createStroopSession };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.CognitiveStroopSession = api;
    if (typeof global !== 'undefined' && typeof window === 'undefined') global.CognitiveStroopSession = api;
})(typeof window !== 'undefined' ? window : globalThis);
