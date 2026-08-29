(function (global) {
    'use strict';

    function buildMemoryPairsRound(pairCount, items, shuffle, getFoodId) {
        if (!Number.isInteger(pairCount) || pairCount < 2 || pairCount > 5) {
            throw new Error('pairCount must be an integer of at least 2');
        }
        if (!Array.isArray(items) || items.length < pairCount) {
            throw new Error('items must contain at least pairCount entries');
        }
        if (typeof shuffle !== 'function') {
            throw new Error('shuffle must be a function');
        }
        if (typeof getFoodId !== 'function') {
            throw new Error('getFoodId must be a function');
        }

        const chosen = shuffle(items).slice(0, pairCount);
        const seenIds = new Set();
        const cards = [];

        chosen.forEach(function (item) {
            if (!item || !item.name || !item.image) {
                throw new Error('Each food item requires name and image');
            }
            const id = String(getFoodId(item));
            if (seenIds.has(id)) {
                throw new Error('Food ids must be unique within a round: ' + id);
            }
            seenIds.add(id);
            for (let copy = 0; copy < 2; copy++) {
                cards.push({
                    pairId: id,
                    name: item.name,
                    image: item.image,
                    category: item.category || ''
                });
            }
        });

        return { cards: shuffle(cards) };
    }

    var api = { buildMemoryPairsRound: buildMemoryPairsRound };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof window !== 'undefined') {
        window.CognitivePairsLogic = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);

