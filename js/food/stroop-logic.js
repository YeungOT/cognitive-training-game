(function (global) {
    'use strict';

    // Pure Stroop trial generation and scoring. No DOM, no timers, no globals:
    // callers inject the face list, the neutral word list, the mode and a random
    // function so the whole module is testable through this interface.

    var STROOP_CONDITIONS = ['congruent', 'incongruent', 'neutral'];
    var STROOP_MODES = ['face', 'word'];

    var WORD_LABELS = {
        happy: '開心',
        sad: '傷心'
    };

    var WORD_VALENCES = {
        happy: 1,
        sad: -1
    };

    var DEFAULT_NEUTRAL_WORDS = [
        '桌子', '椅子', '書本', '衣服', '汽車',
        '房間', '電話', '電視', '報紙', '茶杯'
    ];

    function shuffle(items, random) {
        var copy = items.slice();
        for (var i = copy.length - 1; i > 0; i--) {
            var j = Math.floor(random() * (i + 1));
            var swap = copy[i];
            copy[i] = copy[j];
            copy[j] = swap;
        }
        return copy;
    }

    function createPool(items, random) {
        if (!Array.isArray(items) || items.length === 0) {
            throw new Error('Pool requires at least one item');
        }
        var queue = [];
        var last = null;
        return {
            next: function () {
                if (queue.length === 0) {
                    queue = shuffle(items, random);
                    if (queue.length > 1 && queue[0] === last) {
                        var swapIndex = -1;
                        for (var i = 1; i < queue.length; i++) {
                            if (queue[i] !== last) { swapIndex = i; break; }
                        }
                        if (swapIndex > 0) {
                            var swap = queue[0];
                            queue[0] = queue[swapIndex];
                            queue[swapIndex] = swap;
                        }
                    }
                }
                last = queue.shift();
                return last;
            }
        };
    }

    function valenceToAnswer(valence) {
        if (valence === 0) return null;
        return valence > 0 ? 'positive' : 'negative';
    }

    function assertBuildInputs(options) {
        if (!options || typeof options !== 'object') throw new Error('Stroop build options are required');
        if (!Array.isArray(options.faces) || options.faces.length === 0) throw new Error('Stroop build requires faces');
        if (STROOP_MODES.indexOf(options.mode) === -1) throw new Error('Unknown Stroop mode: ' + options.mode);
        if (!Number.isInteger(options.measuredCount) || options.measuredCount <= 0) throw new Error('measuredCount must be a positive integer');
        if (options.measuredCount % STROOP_CONDITIONS.length !== 0) throw new Error('measuredCount must divide evenly across conditions');
        var practiceCount = options.practiceCount === undefined ? 0 : options.practiceCount;
        if (!Number.isInteger(practiceCount) || practiceCount < 0) throw new Error('practiceCount must be a non-negative integer');
        if (practiceCount % STROOP_CONDITIONS.length !== 0) throw new Error('practiceCount must divide evenly across conditions');
    }

    function countFacesByExpression(faces) {
        var counts = {};
        faces.forEach(function (face) {
            counts[face.expressionKey] = (counts[face.expressionKey] || 0) + 1;
        });
        return counts;
    }

    function buildPools(faces, neutralWords, random) {
        var byExpression = {};
        faces.forEach(function (face) {
            if (!byExpression[face.expressionKey]) byExpression[face.expressionKey] = [];
            byExpression[face.expressionKey].push(face);
        });
        if (!byExpression.happy || !byExpression.sad) {
            throw new Error('Stroop build requires both happy and sad faces');
        }
        var pools = {
            happy: createPool(byExpression.happy, random),
            sad: createPool(byExpression.sad, random)
        };
        if (byExpression.neutral) pools.neutral = createPool(byExpression.neutral, random);
        return {
            facePools: pools,
            wordPools: {
                happy: createPool(['happy'], random),
                sad: createPool(['sad'], random),
                neutral: createPool(neutralWords.slice(), random)
            }
        };
    }

    function buildSpecs(condition, countPerCondition, mode) {
        if (countPerCondition % 2 !== 0) throw new Error('Each condition needs an even trial count');
        var specs = [];
        for (var i = 0; i < countPerCondition / 2; i++) {
            if (condition === 'congruent') {
                specs.push({ condition: condition, faceExpression: 'happy', wordKey: 'happy' });
                specs.push({ condition: condition, faceExpression: 'sad', wordKey: 'sad' });
            } else if (condition === 'incongruent') {
                specs.push({ condition: condition, faceExpression: 'happy', wordKey: 'sad' });
                specs.push({ condition: condition, faceExpression: 'sad', wordKey: 'happy' });
            } else if (mode === 'face') {
                specs.push({ condition: condition, faceExpression: 'happy', wordKey: 'neutral' });
                specs.push({ condition: condition, faceExpression: 'sad', wordKey: 'neutral' });
            } else {
                specs.push({ condition: condition, faceExpression: 'neutral', wordKey: 'happy' });
                specs.push({ condition: condition, faceExpression: 'neutral', wordKey: 'sad' });
            }
        }
        return specs;
    }

    function materialize(spec, mode, pools) {
        if (spec.faceExpression === 'neutral' && !pools.facePools.neutral) {
            throw new Error('Word-target neutral trials require neutral faces');
        }
        var face = pools.facePools[spec.faceExpression].next();
        var word;
        if (spec.wordKey === 'neutral') {
            word = { key: 'neutral', label: pools.wordPools.neutral.next(), valence: 0 };
        } else {
            word = { key: spec.wordKey, label: WORD_LABELS[spec.wordKey], valence: WORD_VALENCES[spec.wordKey] };
        }
        var targetAnswer = mode === 'face'
            ? valenceToAnswer(face.valence)
            : valenceToAnswer(word.valence);
        return {
            phase: spec.phase,
            condition: spec.condition,
            face: face,
            word: word,
            targetAnswer: targetAnswer,
            congruent: spec.condition === 'congruent'
        };
    }

    function limitConditionRuns(trials, random, maxRun) {
        var result = shuffle(trials, random);
        for (var i = maxRun; i < result.length; i++) {
            var runLength = 1;
            for (var j = i - 1; j >= 0 && result[j].condition === result[i].condition; j--) runLength++;
            if (runLength <= maxRun) continue;
            for (var k = i + 1; k < result.length; k++) {
                if (result[k].condition !== result[i].condition) {
                    var swap = result[i];
                    result[i] = result[k];
                    result[k] = swap;
                    break;
                }
            }
        }
        return result;
    }

    function buildBlockSpecs(countPerCondition, phase, mode, random) {
        var specs = [];
        STROOP_CONDITIONS.forEach(function (condition) {
            specs = specs.concat(buildSpecs(condition, countPerCondition, mode));
        });
        specs = limitConditionRuns(specs, random, 2);
        specs.forEach(function (spec) {
            spec.phase = phase;
        });
        return specs;
    }

    function avoidBoundaryRun(practiceSpecs, measuredSpecs) {
        if (practiceSpecs.length < 2 || measuredSpecs.length < 2) return measuredSpecs;
        var tail = practiceSpecs[practiceSpecs.length - 1].condition;
        var beforeTail = practiceSpecs[practiceSpecs.length - 2].condition;
        if (tail !== beforeTail || measuredSpecs[0].condition !== tail) return measuredSpecs;
        for (var i = 1; i < measuredSpecs.length; i++) {
            if (measuredSpecs[i].condition !== tail) {
                var swap = measuredSpecs[0];
                measuredSpecs[0] = measuredSpecs[i];
                measuredSpecs[i] = swap;
                break;
            }
        }
        return measuredSpecs;
    }

    function buildStroopSequence(options) {
        assertBuildInputs(options);
        var random = options.random || Math.random;
        var neutralWords = options.neutralWords || DEFAULT_NEUTRAL_WORDS;
        if (!Array.isArray(neutralWords) || neutralWords.length === 0) throw new Error('Stroop build requires neutral words');
        var pools = buildPools(options.faces, neutralWords, random);
        var practiceCount = options.practiceCount === undefined ? 0 : options.practiceCount;
        var practiceSpecs = [];
        var measuredSpecs = buildBlockSpecs(options.measuredCount / STROOP_CONDITIONS.length, 'measured', options.mode, random);
        if (practiceCount > 0) {
            practiceSpecs = buildBlockSpecs(practiceCount / STROOP_CONDITIONS.length, 'practice', options.mode, random);
            measuredSpecs = avoidBoundaryRun(practiceSpecs, measuredSpecs);
        }
        return practiceSpecs.concat(measuredSpecs).map(function (spec) {
            return materialize(spec, options.mode, pools);
        });
    }

    function evaluateStroopResponse(trial, answer) {
        if (!trial || !trial.targetAnswer) return false;
        return trial.targetAnswer === answer;
    }

    function median(values) {
        if (!values.length) return null;
        var sorted = values.slice().sort(function (a, b) { return a - b; });
        var mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    // Response window per speed: 5000 ms at speed 1, 3000 ms at speed 5,
    // 1500 ms at speed 10. The Activity controller accepts this mapping directly.
    function windowMsForSpeed(speed) {
        var clamped = Math.max(1, Math.min(10, speed));
        if (clamped <= 5) return 5000 - (clamped - 1) * 500;
        return 3000 - (clamped - 5) * 300;
    }

    function summariseStroopTrials(records) {
        var list = Array.isArray(records) ? records : [];
        var byCondition = {};
        STROOP_CONDITIONS.forEach(function (condition) { byCondition[condition] = []; });
        var correct = 0;
        list.forEach(function (record) {
            if (record.correct) correct++;
            if (record.correct && typeof record.rtMs === 'number' && record.condition in byCondition) {
                byCondition[record.condition].push(record.rtMs);
            }
        });
        var medianRtByCondition = {};
        STROOP_CONDITIONS.forEach(function (condition) {
            medianRtByCondition[condition] = median(byCondition[condition]);
        });
        var interferenceMs = null;
        if (medianRtByCondition.incongruent !== null && medianRtByCondition.congruent !== null) {
            interferenceMs = medianRtByCondition.incongruent - medianRtByCondition.congruent;
        }
        return {
            total: list.length,
            correct: correct,
            accuracy: list.length ? correct / list.length : null,
            medianRtByCondition: medianRtByCondition,
            interferenceMs: interferenceMs,
            countsByCondition: {
                congruent: byCondition.congruent.length,
                incongruent: byCondition.incongruent.length,
                neutral: byCondition.neutral.length
            }
        };
    }

    var api = {
        STROOP_CONDITIONS: STROOP_CONDITIONS,
        STROOP_MODES: STROOP_MODES,
        DEFAULT_NEUTRAL_WORDS: DEFAULT_NEUTRAL_WORDS,
        buildStroopSequence: buildStroopSequence,
        evaluateStroopResponse: evaluateStroopResponse,
        summariseStroopTrials: summariseStroopTrials,
        windowMsForSpeed: windowMsForSpeed,
        median: median
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.CognitiveStroopLogic = api;
    if (typeof global !== 'undefined' && typeof window === 'undefined') global.CognitiveStroopLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
