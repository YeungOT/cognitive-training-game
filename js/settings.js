(function (global) {
    'use strict';

    var KEYS = {
        theme: 'cognitiveAppTheme',
        music: 'cognitiveAppMusic',
        sfx: 'cognitiveAppSfx',
        gng: 'cognitiveGngPrefs',
        different: 'cognitiveDifferentPrefs',
        pairs: 'cognitivePairsPrefs',
        shopping: 'cognitiveShoppingPrefs',
        reality: 'realityOrientationSettings',
        palm: 'cognitivePalmPrefs'
    };

    var REALITY_WEATHER_OPTIONS = ['未設定', '晴', '陰', '雨', '雷暴'];
    var REALITY_SEASON_OPTIONS = ['自動', '春天', '夏天', '秋天', '冬天'];
    var REALITY_HOMES = [
        '鰂魚涌富璟',
        '油塘康璟',
        '筲箕灣聖輝',
        '新蒲崗康璟',
        '觀塘慶樺',
        '深水埗慶楠',
        '荃灣慶楠',
        '上水慶楠',
        '沙田富璟',
        '大埔富樺',
        '上水富璟',
        '沙田第一城富璟'
    ];

    var DEFAULT_SCHEMAS = {
        cognitiveAppTheme: {
            format: 'string',
            default: { theme: 'light' },
            fields: {
                theme: { type: 'string', enum: ['light', 'dark'] }
            }
        },
        cognitiveAppMusic: {
            format: 'flag',
            default: { music: true },
            fields: {
                music: { type: 'boolean' }
            }
        },
        cognitiveAppSfx: {
            format: 'flag',
            default: { sfx: true },
            fields: {
                sfx: { type: 'boolean' }
            }
        },
        cognitiveGngPrefs: {
            format: 'json',
            default: {
                goCategory: '水果',
                noGoCategory: '全部',
                autoSwitch: false,
                switchType: 'swap',
                switchFreq: 10
            },
            fields: {
                goCategory: {
                    type: 'string',
                    enum: function () {
                        return getFoodCategoryOptions();
                    }
                },
                noGoCategory: {
                    type: 'string',
                    enum: function () {
                        return getFoodCategoryOptions();
                    }
                },
                autoSwitch: { type: 'boolean' },
                switchType: { type: 'string', enum: ['random', 'swap'] },
                switchFreq: { type: 'number', enum: [5, 10, 15, 20] }
            }
        },
        cognitiveStroopPrefs: {
            format: 'json',
            default: { mode: 'face', speed: 5 },
            fields: {
                mode: { type: 'string', enum: ['face', 'word'] },
                speed: { type: 'number', enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }
            }
        },
        cognitiveDifferentPrefs: {
            format: 'json',
            default: { imageCount: 4 },
            fields: {
                imageCount: { type: 'number', enum: [3, 4, 5, 6] }
            }
        },
        cognitivePairsPrefs: {
            format: 'json',
            default: { pairCount: 4, previewTime: 'manual' },
            fields: {
                pairCount: { type: 'number', enum: [3, 4, 5] },
                previewTime: { type: 'string', enum: ['5', '10', '15', '20', 'manual'] }
            }
        },
        cognitiveShoppingPrefs: {
            format: 'json',
            default: {
                listDisplayMode: 'image',
                listCount: 3,
                memoryTime: 'manual',
                choiceCount: 6,
                orderRequired: false,
                recallTime: '0'
            },
            fields: {
                listDisplayMode: { type: 'string', enum: ['image', 'name'] },
                listCount: { type: 'number', enum: [2, 3, 4, 5, 6] },
                memoryTime: {
                    type: 'string',
                    enum: ['1', '3', '5', '10', '15', '20', 'manual']
                },
                choiceCount: { type: 'number', enum: [4, 6, 8] },
                orderRequired: { type: 'boolean' },
                recallTime: { type: 'string', enum: ['0', '15', '30', '45', '60'] }
            }
        },
        realityOrientationSettings: {
            format: 'json',
            migrate: function (raw) {
                var oldSeasonNames = { '春': '春天', '夏': '夏天', '秋': '秋天', '冬': '冬天' };
                if (raw && raw.season && oldSeasonNames[raw.season]) {
                    raw.season = oldSeasonNames[raw.season];
                }
                return raw;
            },
            default: {
                weather: '晴',
                season: '自動',
                location: '未設定'
            },
            fields: {
                weather: { type: 'string', enum: REALITY_WEATHER_OPTIONS },
                season: {
                    type: 'string',
                    enum: REALITY_SEASON_OPTIONS
                },
                location: {
                    type: 'string',
                    enum: ['未設定'].concat(REALITY_HOMES)
                }
            }
        },
        cognitivePalmPrefs: {
            format: 'json',
            default: {
                difficulty: 'hard',
                hand: 'both'
            },
            fields: {
                difficulty: { type: 'string', enum: ['easy', 'hard'] },
                hand: { type: 'string', enum: ['both', 'palmar'] }
            }
        }
    };

    function getFoodCategoryOptions() {
        var foodData = typeof global.CognitiveFoodData !== 'undefined' ? global.CognitiveFoodData : null;
        var names = foodData ? foodData.CATEGORY_NAMES : [];
        return ['全部'].concat(names);
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function resolveEnum(rule) {
        return typeof rule.enum === 'function' ? rule.enum() : rule.enum;
    }

    function isValid(value, rule) {
        if (rule.type === 'boolean') return typeof value === 'boolean';
        if (rule.type === 'number') return typeof value === 'number' && isFinite(value);
        if (rule.type === 'string') return typeof value === 'string';
        return false;
    }

    function isAllowed(value, rule) {
        if (!isValid(value, rule)) return false;
        if (!rule.enum) return true;
        return resolveEnum(rule).indexOf(value) !== -1;
    }

    function parseStored(raw, format) {
        if (format === 'flag') {
            if (raw === 'true') return true;
            if (raw === 'false') return false;
            return undefined;
        }
        if (format === 'json') {
            try {
                return JSON.parse(raw);
            } catch (error) {
                return undefined;
            }
        }
        return raw;
    }

    function writeStored(storage, key, value, format) {
        if (!storage) return false;
        try {
            if (format === 'json') {
                storage.setItem(key, JSON.stringify(value));
            } else {
                var fieldKeys = Object.keys(value);
                storage.setItem(key, String(value[fieldKeys[0]]));
            }
            return true;
        } catch (error) {
            return false;
        }
    }

    function createSettingsStore(options) {
        options = options || {};
        var storage = options.storage;
        if (!storage && typeof window !== 'undefined') {
            try {
                storage = window.localStorage;
            } catch (error) {
                storage = null;
            }
        }
        var schemas = options.schemas || DEFAULT_SCHEMAS;

        function getSchema(key) {
            var schema = schemas[key];
            if (!schema) throw new Error('Unknown settings key: ' + key);
            return schema;
        }

        function load(key) {
            var schema = getSchema(key);
            var result = clone(schema.default);
            var raw = null;
            if (storage) {
                try {
                    raw = storage.getItem(key);
                } catch (error) {
                    raw = null;
                }
            }
            if (raw === null || raw === undefined) return result;

            var parsed = parseStored(raw, schema.format);
            if (parsed === undefined || parsed === null ||
                (typeof parsed !== 'object' && schema.format === 'json')) {
                return result;
            }

            var storedObject = parsed;
            if (schema.format !== 'json') {
                storedObject = {};
                storedObject[Object.keys(schema.fields)[0]] = parsed;
            }

            var migrated = false;
            if (typeof schema.migrate === 'function') {
                storedObject = schema.migrate(storedObject) || storedObject;
                migrated = true;
            }

            Object.keys(schema.fields).forEach(function (field) {
                if (storedObject[field] === undefined) return;
                var rule = schema.fields[field];
                if (isAllowed(storedObject[field], rule)) {
                    result[field] = storedObject[field];
                }
            });

            if (migrated) {
                writeStored(storage, key, result, schema.format);
            }
            return result;
        }

        function save(key, patch) {
            var schema = schemas[key];
            if (!schema) return false;
            if (!patch || typeof patch !== 'object') return false;
            var current = load(key);
            var next = clone(current);

            var patchKeys = Object.keys(patch);
            for (var i = 0; i < patchKeys.length; i++) {
                var field = patchKeys[i];
                var rule = schema.fields[field];
                if (!rule || !isAllowed(patch[field], rule)) return false;
                next[field] = patch[field];
            }

            if (!storage) return false;
            return writeStored(storage, key, next, schema.format);
        }

        return {
            keys: KEYS,
            load: load,
            save: save
        };
    }

    var store = createSettingsStore();

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            CognitiveSettingsStore: store,
            createSettingsStore: createSettingsStore,
            defaultSchemas: DEFAULT_SCHEMAS
        };
    }

    if (typeof window !== 'undefined') {
        window.CognitiveSettingsStore = store;
    }
})(typeof window !== 'undefined' ? window : globalThis);
