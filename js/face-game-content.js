(function (global) {
    'use strict';

    // Game-facing projection of the celebrity Face Set. The Face Set owns
    // assets and labels; this module owns the item shape and the identity /
    // expression projection used by several games.

    var DIMENSIONS = ['identity', 'expression'];

    function createFaceGameContent(options) {
        options = options || {};
        var faceSet = options.faceSet === undefined
            ? global.CognitiveCelebrityFaces
            : options.faceSet;
        if (!faceSet) throw new Error('createFaceGameContent requires a Face Set');

        function assertDimension(dimension) {
            if (DIMENSIONS.indexOf(dimension) === -1) {
                throw new Error('Unknown face dimension: ' + dimension);
            }
        }

        function projectFace(face, dimension) {
            var identity = dimension === 'identity';
            return Object.freeze({
                id: face.personId + ':' + face.expressionKey,
                personId: face.personId,
                personLabel: face.personDisplayName,
                expressionKey: face.expressionKey,
                expressionLabel: face.expressionLabel,
                valence: face.valence,
                arousal: face.arousal,
                image: face.src,
                category: identity ? face.personId : face.expressionKey,
                categoryLabel: identity ? face.personDisplayName : face.expressionLabel,
                name: face.personDisplayName + ' ' + face.expressionLabel
            });
        }

        function listItems(options) {
            options = options || {};
            var dimension = options.dimension || 'expression';
            assertDimension(dimension);
            return faceSet.listFaces().map(function (face) {
                return projectFace(face, dimension);
            });
        }

        function expressionOptions() {
            return faceSet.shippedExpressions.map(function (expression) {
                return { value: expression.key, label: expression.label };
            });
        }

        function keyFor(item, dimension) {
            assertDimension(dimension);
            if (!item) throw new Error('Face item is required');
            return dimension === 'identity' ? item.personId : item.expressionKey;
        }

        function labelForDimension(dimension) {
            assertDimension(dimension);
            return dimension === 'identity' ? '身份' : '表情';
        }

        function groupItems(dimension) {
            var groups = {};
            listItems({ dimension: dimension }).forEach(function (item) {
                var key = keyFor(item, dimension);
                if (!groups[key]) groups[key] = [];
                groups[key].push(item);
            });
            return groups;
        }

        return {
            listItems: listItems,
            expressionOptions: expressionOptions,
            keyFor: keyFor,
            labelForDimension: labelForDimension,
            groupItems: groupItems
        };
    }

    var api = { createFaceGameContent: createFaceGameContent };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') {
        window.CognitiveFaceGameContent = createFaceGameContent({
            faceSet: window.CognitiveCelebrityFaces
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);
