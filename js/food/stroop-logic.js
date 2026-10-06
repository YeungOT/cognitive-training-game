(function (global) {
    'use strict';

    // Pure face-target Stroop trial generation and scoring. No DOM, no timers,
    // no target-mode branch: the face is always the target and the word is the
    // distractor.

    var STROOP_CONDITIONS = ['congruent', 'incongruent', 'neutral'];

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
        if (!Number.isInteger(options.count) || options.count <= 0) throw new Error('count must be a positive integer');
        if (options.count % STROOP_CONDITIONS.length !== 0) throw new Error('count must divide evenly across conditions');
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
        return {
            facePools: {
                happy: createPool(byExpression.happy, random),
                sad: createPool(byExpression.sad, random)
            },
            wordPools: {
                happy: createPool(['happy'], random),
                sad: createPool(['sad'], random),
                neutral: createPool(neutralWords.slice(), random)
            }
        };
    }

    function buildSpecs(condition, countPerCondition) {
        if (countPerCondition % 2 !== 0) throw new Error('Each condition needs an even trial count');
        var specs = [];
        for (var i = 0; i < countPerCondition / 2; i++) {
            if (condition === 'congruent') {
                specs.push({ condition: condition, faceExpression: 'happy', wordKey: 'happy' });
                specs.push({ condition: condition, faceExpression: 'sad', wordKey: 'sad' });
            } else if (condition === 'incongruent') {
                specs.push({ condition: condition, faceExpression: 'happy', wordKey: 'sad' });
                specs.push({ condition: condition, faceExpression: 'sad', wordKey: 'happy' });
            } else {
                specs.push({ condition: condition, faceExpression: 'happy', wordKey: 'neutral' });
                specs.push({ condition: condition, faceExpression: 'sad', wordKey: 'neutral' });
            }
        }
        return specs;
    }

    function materialize(spec, pools) {
        var face = pools.facePools[spec.faceExpression].next();
        var word;
        if (spec.wordKey === 'neutral') {
            word = { key: 'neutral', label: pools.wordPools.neutral.next(), valence: 0 };
        } else {
            word = { key: spec.wordKey, label: WORD_LABELS[spec.wordKey], valence: WORD_VALENCES[spec.wordKey] };
        }
        return {
            condition: spec.condition,
            face: face,
            word: word,
            targetAnswer: valenceToAnswer(face.valence),
            congruent: spec.condition === 'congruent'
        };
    }

    function limitConditionRuns(specs, random, maxRun) {
        var result = shuffle(specs, random);
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

    function buildStroopSequence(options) {
        assertBuildInputs(options);
        var random = options.random || Math.random;
        var neutralWords = options.neutralWords || DEFAULT_NEUTRAL_WORDS;
        if (!Array.isArray(neutralWords) || neutralWords.length === 0) throw new Error('Stroop build requires neutral words');
        var pools = buildPools(options.faces, neutralWords, random);
        var specs = [];
        STROOP_CONDITIONS.forEach(function (condition) {
            specs = specs.concat(buildSpecs(condition, options.count / STROOP_CONDITIONS.length));
        });
        return limitConditionRuns(specs, random, 2).map(function (spec) {
            return materialize(spec, pools);
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
        DEFAULT_NEUTRAL_WORDS: DEFAULT_NEUTRAL_WORDS,
        buildStroopSequence: buildStroopSequence,
        evaluateStroopResponse: evaluateStroopResponse,
        summariseStroopTrials: summariseStroopTrials,
        median: median
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.CognitiveStroopLogic = api;
    if (typeof global !== 'undefined' && typeof window === 'undefined') global.CognitiveStroopLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
