(function (global) {
    'use strict';

    var DIMENSIONS = ['identity', 'expression'];

    function cloneItem(item) {
        return Object.assign({}, item);
    }

    function pickRandom(items, random) {
        return items[Math.floor(random() * items.length)];
    }

    function keyFor(item, dimension) {
        return dimension === 'identity' ? item.personId : item.expressionKey;
    }

    function pickFace(faces, predicate, random) {
        var candidates = faces.filter(predicate);
        if (candidates.length === 0) {
            throw new Error('Face N-back sequence has no valid candidate');
        }
        return cloneItem(pickRandom(candidates, random));
    }

    function buildMatchFace(target, faces, dimension, random) {
        if (dimension === 'identity') {
            var samePerson = faces.filter(function (item) {
                return item.personId === target.personId && item.expressionKey !== target.expressionKey;
            });
            if (samePerson.length > 0) return cloneItem(pickRandom(samePerson, random));
            return pickFace(faces, function (item) {
                return item.personId === target.personId;
            }, random);
        }
        var sameExpression = faces.filter(function (item) {
            return item.expressionKey === target.expressionKey && item.personId !== target.personId;
        });
        if (sameExpression.length > 0) return cloneItem(pickRandom(sameExpression, random));
        return pickFace(faces, function (item) {
            return item.expressionKey === target.expressionKey;
        }, random);
    }

    function buildNonMatchFace(target, faces, dimension, random) {
        return pickFace(faces, function (item) {
            return keyFor(item, dimension) !== keyFor(target, dimension);
        }, random);
    }

    function buildFaceNbackSequence(options) {
        options = options || {};
        var dimension = options.dimension;
        var n = options.n;
        var length = options.length;
        var faces = options.faces;
        var random = options.random || Math.random;
        var matchProbability = options.matchProbability === undefined
            ? 0.25
            : options.matchProbability;
        var seedValues = options.seedValues || [];

        if (DIMENSIONS.indexOf(dimension) === -1) {
            throw new Error('Unknown face N-back dimension: ' + dimension);
        }
        if (!Number.isInteger(n) || n < 1) throw new Error('n must be a positive integer');
        if (!Number.isInteger(length) || length < 1) throw new Error('length must be a positive integer');
        if (!Array.isArray(faces) || faces.length === 0) throw new Error('faces are required');

        var trials = [];
        for (var i = 0; i < length; i++) {
            if (i < n) {
                var seedFace = cloneItem(pickRandom(faces, random));
                trials.push({
                    value: seedFace,
                    isMatch: i < seedValues.length &&
                        keyFor(seedFace, dimension) === keyFor(seedValues[i], dimension)
                });
                continue;
            }

            var target = trials[i - n].value;
            var isMatch = random() < matchProbability;
            trials.push({
                value: isMatch
                    ? buildMatchFace(target, faces, dimension, random)
                    : buildNonMatchFace(target, faces, dimension, random),
                isMatch: isMatch
            });
        }
        return trials;
    }

    function buildDualFaceNbackSequence(options) {
        options = options || {};
        var n = options.n;
        var length = options.length;
        var faces = options.faces;
        var random = options.random || Math.random;
        var matchProbability = options.matchProbability === undefined
            ? 0.25
            : options.matchProbability;

        if (!Number.isInteger(n) || n < 1) throw new Error('n must be a positive integer');
        if (!Number.isInteger(length) || length < 1) throw new Error('length must be a positive integer');
        if (!Array.isArray(faces) || faces.length === 0) throw new Error('faces are required');

        function pickWithPredicate(predicate) {
            return cloneItem(pickFace(faces, predicate, random));
        }

        function chooseValue(target, identityMatch, expressionMatch) {
            if (identityMatch && expressionMatch) {
                return cloneItem(target);
            }
            if (identityMatch) {
                return pickWithPredicate(function (item) {
                    return item.personId === target.personId && item.expressionKey !== target.expressionKey;
                });
            }
            if (expressionMatch) {
                return pickWithPredicate(function (item) {
                    return item.expressionKey === target.expressionKey && item.personId !== target.personId;
                });
            }
            return pickWithPredicate(function (item) {
                return item.personId !== target.personId && item.expressionKey !== target.expressionKey;
            });
        }

        var trials = [];
        for (var i = 0; i < length; i++) {
            if (i < n) {
                trials.push({
                    value: cloneItem(pickRandom(faces, random)),
                    identityMatch: false,
                    expressionMatch: false
                });
                continue;
            }
            var identityMatch = random() < matchProbability;
            var expressionMatch = random() < matchProbability;
            trials.push({
                value: chooseValue(trials[i - n].value, identityMatch, expressionMatch),
                identityMatch: identityMatch,
                expressionMatch: expressionMatch
            });
        }
        return trials;
    }

    function buildDualFaceSequences(options) {
        var trials = buildDualFaceNbackSequence(options);
        return {
            identity: trials.map(function (trial) {
                return { value: trial.value, isMatch: trial.identityMatch };
            }),
            expression: trials.map(function (trial) {
                return { value: trial.value, isMatch: trial.expressionMatch };
            })
        };
    }

    var api = {
        DIMENSIONS: DIMENSIONS,
        keyFor: keyFor,
        buildFaceNbackSequence: buildFaceNbackSequence,
        buildDualFaceNbackSequence: buildDualFaceNbackSequence,
        buildDualFaceSequences: buildDualFaceSequences
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.CognitiveFaceNbackLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
