(function (global) {
    'use strict';

    // =============================================================
    // 雙重 N-back — pure logic + data tables
    // =============================================================
    //
    // DOM-free: modality/grid/palette tables and the sequence-generation
    // helpers. No lifecycle or DOM.

    var DUAL_NBACK_SEQUENCE_LENGTH = 50;

    var DUAL_MODALITY_LABELS = {
        image: '圖片',
        position: '位置',
        color: '顏色',
        audio: '聲音'
    };

    var DUAL_POSITION_GRIDS = {
        '2x1': { cols: 2, rows: 1 },
        '3x1': { cols: 3, rows: 1 },
        '2x2': { cols: 2, rows: 2 },
        '3x2': { cols: 3, rows: 2 },
        '3x3': { cols: 3, rows: 3 }
    };

    var DUAL_COLOR_PALETTES = {
        '6': [
            { name: '紅色', css: '#e53935' },
            { name: '橙色', css: '#fb8c00' },
            { name: '黃色', css: '#fdd835' },
            { name: '綠色', css: '#43a047' },
            { name: '藍色', css: '#1e88e5' },
            { name: '紫色', css: '#8e24aa' }
        ],
        '3': [
            { name: '紅色', css: '#e53935' },
            { name: '綠色', css: '#43a047' },
            { name: '藍色', css: '#1e88e5' }
        ]
    };

    function getDualFoodId(item) {
        return item.id || item.name;
    }

    function getDualModalityValue(modality, value) {
        if (modality === 'image') return value.image || getDualFoodId(value);
        if (modality === 'audio') return getDualFoodId(value);
        if (modality === 'color') return value.name;
        return value;
    }

    function cloneDualModalityValue(modality, value) {
        if (modality === 'image' || modality === 'audio') return value ? { ...value } : value;
        if (modality === 'color') return value ? { ...value } : value;
        return value;
    }

    function getDualModalityChoices(modality, positionGrid, colorPalette, foodData, positionGrids, colorPalettes) {
        if (modality === 'image' || modality === 'audio') return foodData;
        if (modality === 'position') {
            var grid = positionGrids[positionGrid] || positionGrids['3x3'];
            return Array.from({ length: grid.cols * grid.rows }, function (_, index) { return index; });
        }
        if (modality === 'color') {
            return colorPalettes[colorPalette] || colorPalettes['6'];
        }
        return [];
    }

    function generateDualSequences(modalities, n, length, positionGrid, colorPalette, foodData, positionGrids, colorPalettes, sequence, seedTails) {
        var sequences = {};
        if (!sequence) return sequences;
        seedTails = seedTails || {};
        modalities.forEach(function (modality) {
            var choices = getDualModalityChoices(modality, positionGrid, colorPalette, foodData, positionGrids, colorPalettes);
            sequences[modality] = sequence.generateTrials({
                choices: choices,
                n: n,
                length: length,
                matchProbability: sequence.matchProbability,
                cloneValue: function (value) { return cloneDualModalityValue(modality, value); },
                keyFor: function (value) { return getDualModalityValue(modality, value); },
                seedValues: seedTails[modality] || []
            });
        });
        return sequences;
    }

    var api = {
        DUAL_NBACK_SEQUENCE_LENGTH: DUAL_NBACK_SEQUENCE_LENGTH,
        DUAL_MODALITY_LABELS: DUAL_MODALITY_LABELS,
        DUAL_POSITION_GRIDS: DUAL_POSITION_GRIDS,
        DUAL_COLOR_PALETTES: DUAL_COLOR_PALETTES,
        getDualFoodId: getDualFoodId,
        getDualModalityValue: getDualModalityValue,
        cloneDualModalityValue: cloneDualModalityValue,
        getDualModalityChoices: getDualModalityChoices,
        generateDualSequences: generateDualSequences
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (typeof window !== 'undefined') {
        window.CognitiveDualNbackLogic = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);