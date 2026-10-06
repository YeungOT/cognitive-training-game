(function (global) {
    'use strict';

    // Game-agnostic Face Set manifest. Games ask for a face by person and
    // expression; path construction, availability, labels and validation live
    // here so no game module ever builds a filename.

    var ASSET_BASE = 'assets/celebrity-faces/';

    var PEOPLE = [
        { id: 'anita-mui', displayName: '梅艷芳' },
        { id: 'bruce-lee', displayName: '李小龍' },
        { id: 'chow-yun-fat', displayName: '周潤發' },
        { id: 'leslie-cheung', displayName: '張國榮' },
        { id: 'leung-sing-bor', displayName: '梁醒波' },
        { id: 'liza-wang', displayName: '汪明荃' },
        { id: 'paula-tsui', displayName: '徐小鳳' },
        { id: 'sam-hui', displayName: '許冠傑' },
        { id: 'teresa-teng', displayName: '鄧麗君' },
        { id: 'yam-kim-fai', displayName: '任劍輝' }
    ];

    var EXPRESSIONS = [
        { key: 'neutral', label: '無表情', fileSuffix: 'canonical', valence: 0, arousal: 'low' },
        { key: 'happy', label: '開心', fileSuffix: 'happy', valence: 1, arousal: 'medium' },
        { key: 'sad', label: '傷心', fileSuffix: 'sad', valence: -1, arousal: 'low' },
        { key: 'angry', label: '生氣', fileSuffix: 'angry', valence: -1, arousal: 'high' },
        { key: 'fear', label: '驚慌', fileSuffix: 'fear', valence: -1, arousal: 'high' },
        { key: 'disgust', label: '厭惡', fileSuffix: 'disgust', valence: -1, arousal: 'high' }
    ];

    // v1 ships only the expressions the game can currently show. The full
    // expression list above still defines the domain for later games.
    var SHIPPED_EXPRESSION_KEYS = ['happy', 'sad', 'neutral'];

    function freezeRecord(record) {
        return Object.freeze(record);
    }

    var people = Object.freeze(PEOPLE.map(freezeRecord));
    var expressions = Object.freeze(EXPRESSIONS.map(freezeRecord));

    var shippedExpressions = expressions.filter(function (expression) {
        return SHIPPED_EXPRESSION_KEYS.indexOf(expression.key) !== -1;
    });

    var peopleById = {};
    people.forEach(function (person) {
        peopleById[person.id] = person;
    });

    var expressionsByKey = {};
    expressions.forEach(function (expression) {
        expressionsByKey[expression.key] = expression;
    });

    var faces = [];
    SHIPPED_EXPRESSION_KEYS.forEach(function (expressionKey) {
        var expression = expressionsByKey[expressionKey];
        people.forEach(function (person) {
            faces.push(freezeRecord({
                personId: person.id,
                personDisplayName: person.displayName,
                expressionKey: expression.key,
                expressionLabel: expression.label,
                valence: expression.valence,
                arousal: expression.arousal,
                src: ASSET_BASE + person.id + '_' + expression.fileSuffix + '.webp'
            }));
        });
    });

    faces = Object.freeze(faces);

    var facesByPerson = {};
    faces.forEach(function (face) {
        if (!facesByPerson[face.personId]) facesByPerson[face.personId] = {};
        facesByPerson[face.personId][face.expressionKey] = face;
    });

    function assertKnownPerson(personId) {
        if (!peopleById[personId]) {
            throw new Error('Unknown person: ' + personId);
        }
    }

    function assertKnownExpression(expressionKey) {
        if (!expressionsByKey[expressionKey]) {
            throw new Error('Unknown expression: ' + expressionKey);
        }
    }

    function hasFace(personId, expressionKey) {
        return !!(facesByPerson[personId] && facesByPerson[personId][expressionKey]);
    }

    function getFace(personId, expressionKey) {
        assertKnownPerson(personId);
        assertKnownExpression(expressionKey);
        if (!hasFace(personId, expressionKey)) {
            throw new Error('Face is not shipped: ' + personId + ' / ' + expressionKey);
        }
        return facesByPerson[personId][expressionKey];
    }

    function listFaces(filter) {
        filter = filter || {};
        if (filter.expressionKey !== undefined) assertKnownExpression(filter.expressionKey);
        if (filter.personId !== undefined) assertKnownPerson(filter.personId);
        return faces.filter(function (face) {
            if (filter.expressionKey !== undefined && face.expressionKey !== filter.expressionKey) return false;
            if (filter.personId !== undefined && face.personId !== filter.personId) return false;
            return true;
        });
    }

    var api = {
        people: people,
        expressions: expressions,
        shippedExpressions: Object.freeze(shippedExpressions),
        getFace: getFace,
        listFaces: listFaces,
        hasFace: hasFace
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.CognitiveCelebrityFaces = api;
    if (typeof global !== 'undefined' && typeof window === 'undefined') global.CognitiveCelebrityFaces = api;
})(typeof window !== 'undefined' ? window : globalThis);
