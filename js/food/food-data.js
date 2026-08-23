(function (global) {
    'use strict';

// 第一部分：共用資料與工具
        // =============================================================

        const FOOD_DATA = [
            // 水果
            { name: '蘋果', category: '水果', image: 'assets/food/蘋果.webp' },
            { name: '香蕉', category: '水果', image: 'assets/food/香蕉.webp' },
            { name: '車厘子', category: '水果', image: 'assets/food/櫻桃.webp' },
            { name: '火龍果', category: '水果', image: 'assets/food/火龍果.webp' },
            { name: '榴槤', category: '水果', image: 'assets/food/榴蓮.webp' },
            { name: '提子', category: '水果', image: 'assets/food/葡萄.webp' },
            { name: '荔枝', category: '水果', image: 'assets/food/荔枝.webp' },
            { name: '山竹', category: '水果', image: 'assets/food/山竹.webp' },
            { name: '橙', category: '水果', image: 'assets/food/橙子.webp' },
            { name: '桃', category: '水果', image: 'assets/food/桃子.webp' },
            { name: '梨', category: '水果', image: 'assets/food/梨.webp' },
            { name: '菠蘿', category: '水果', image: 'assets/food/菠蘿.webp' },
            { name: '士多啤梨', category: '水果', image: 'assets/food/草莓.webp' },
            { name: '西瓜', category: '水果', image: 'assets/food/西瓜.webp' },
            { name: '奇異果', category: '水果', image: 'assets/food/奇異果.webp' },
            { name: '木瓜', category: '水果', image: 'assets/food/木瓜.webp' },
            { name: '枇杷', category: '水果', image: 'assets/food/枇杷.webp' },
            { name: '柿子', category: '水果', image: 'assets/food/柿子.webp' },
            { name: '桑椹', category: '水果', image: 'assets/food/桑椹.webp' },
            { name: '椰子', category: '水果', image: 'assets/food/椰子.webp' },
            { name: '楊桃', category: '水果', image: 'assets/food/楊桃.webp' },
            { name: '檸檬', category: '水果', image: 'assets/food/檸檬.webp' },
            { name: '番石榴', category: '水果', image: 'assets/food/番石榴.webp' },
            { name: '百香果', category: '水果', image: 'assets/food/百香果.webp' },
            { name: '芒果', category: '水果', image: 'assets/food/芒果.webp' },
            { name: '藍莓', category: '水果', image: 'assets/food/藍莓.webp' },
            { name: '龍眼', category: '水果', image: 'assets/food/龍眼.webp' },
            { name: '大樹菠蘿', category: '水果', image: 'assets/food/大樹菠蘿.webp' },
            { name: '柑', category: '水果', image: 'assets/food/柑.webp' },
            { name: '雪梨', category: '水果', image: 'assets/food/雪梨.webp' },
            { name: '黃皮', category: '水果', image: 'assets/food/黃皮.webp' },
            // 蔬菜
            { name: '西蘭花', category: '蔬菜', image: 'assets/food/西蘭花.webp' },
            { name: '椰菜', category: '蔬菜', image: 'assets/food/椰菜.webp' },
            { name: '椰菜花', category: '蔬菜', image: 'assets/food/花椰菜.webp' },
            { name: '芹菜', category: '蔬菜', image: 'assets/food/芹菜.webp' },
            { name: '青瓜', category: '蔬菜', image: 'assets/food/黃瓜.webp' },
            { name: '茄子', category: '蔬菜', image: 'assets/food/茄子.webp' },
            { name: '青椒', category: '蔬菜', image: 'assets/food/青椒.webp' },
            { name: '蘑菇', category: '蔬菜', image: 'assets/food/蘑菇.webp' },
            { name: '洋蔥', category: '蔬菜', image: 'assets/food/洋蔥.webp' },
            { name: '薯仔', category: '蔬菜', image: 'assets/food/馬鈴薯.webp' },
            { name: '番茄', category: '蔬菜', image: 'assets/food/番茄.webp' },
            { name: '冬瓜', category: '蔬菜', image: 'assets/food/冬瓜.webp' },
            { name: '南瓜', category: '蔬菜', image: 'assets/food/南瓜.webp' },
            { name: '四季豆', category: '蔬菜', image: 'assets/food/四季豆.webp' },
            { name: '薑', category: '蔬菜', image: 'assets/food/姜.webp' },
            { name: '涼瓜', category: '蔬菜', image: 'assets/food/涼瓜.webp' },
            { name: '牛蒡', category: '蔬菜', image: 'assets/food/牛蒡.webp' },
            { name: '白菜', category: '蔬菜', image: 'assets/food/白菜.webp' },
            { name: '紅蘿蔔', category: '蔬菜', image: 'assets/food/紅蘿蔔.webp' },
            { name: '芋頭', category: '蔬菜', image: 'assets/food/芋頭.webp' },
            { name: '蒜頭', category: '蔬菜', image: 'assets/food/蒜頭.webp' },
            { name: '蔥', category: '蔬菜', image: 'assets/food/蔥.webp' },
            { name: '冬菇', category: '蔬菜', image: 'assets/food/冬菇.webp' },
            { name: '娃娃菜', category: '蔬菜', image: 'assets/food/娃娃菜.webp' },
            { name: '木耳', category: '蔬菜', image: 'assets/food/木耳.webp' },
            { name: '白蘿蔔', category: '蔬菜', image: 'assets/food/白蘿蔔.webp' },
            { name: '節瓜', category: '蔬菜', image: 'assets/food/節瓜.webp' },
            { name: '蓮藕', category: '蔬菜', image: 'assets/food/蓮藕.webp' },
            { name: '西洋菜', category: '蔬菜', image: 'assets/food/西洋菜.webp' },
            { name: '生菜', category: '蔬菜', image: 'assets/food/西生菜.webp' },
            { name: '韭菜', category: '蔬菜', image: 'assets/food/韭菜.webp' },
            // 肉類
            { name: '雞髀', category: '肉類', image: 'assets/food/雞髀.webp' },
            { name: '雞蛋', category: '肉類', image: 'assets/food/雞蛋.webp' },
            { name: '豬肉', category: '肉類', image: 'assets/food/豬肉.webp' },
            { name: '燒鴨', category: '肉類', image: 'assets/food/烤鴨.webp' },
            { name: '臘腸', category: '肉類', image: 'assets/food/臘腸.webp' },
            { name: '燒肉', category: '肉類', image: 'assets/food/燒肉.webp' },
            { name: '東坡肉', category: '肉類', image: 'assets/food/東坡肉.webp' },
            { name: '叉燒', category: '肉類', image: 'assets/food/叉燒.webp' },
            { name: '乳鴿', category: '肉類', image: 'assets/food/乳鴿.webp' },
            { name: '白切雞', category: '肉類', image: 'assets/food/白切雞.webp' },
            { name: '咕嚕肉', category: '肉類', image: 'assets/food/咕嚕肉.webp' },
            { name: '豬腳', category: '肉類', image: 'assets/food/豬腳.webp' },
            { name: '午餐肉', category: '肉類', image: 'assets/food/午餐肉.webp' },
            { name: '牛丸', category: '肉類', image: 'assets/food/牛丸.webp' },
            { name: '牛扒', category: '肉類', image: 'assets/food/牛扒.webp' },
            { name: '腸仔', category: '肉類', image: 'assets/food/腸仔.webp' },
            { name: '雞翼', category: '肉類', image: 'assets/food/雞翼.webp' },
            // 堅果
            { name: '花生', category: '堅果', image: 'assets/food/花生.webp' },
            { name: '核桃', category: '堅果', image: 'assets/food/核桃.webp' },
            { name: '瓜子', category: '堅果', image: 'assets/food/瓜子.webp' },
            { name: '腰果', category: '堅果', image: 'assets/food/腰果.webp' },
            { name: '杏仁', category: '堅果', image: 'assets/food/杏仁.webp' },
            { name: '開心果', category: '堅果', image: 'assets/food/開心果.webp' },
            { name: '栗子', category: '堅果', image: 'assets/food/栗子.webp' },
            { name: '榛子', category: '堅果', image: 'assets/food/榛子.webp' },
            { name: '黑芝麻', category: '堅果', image: 'assets/food/黑芝麻.webp' },
            // 穀物（僅保留資料，食物分類遊戲中不再顯示此類別）
            { name: '餅乾', category: '穀物', image: 'assets/food/餅乾.webp' },
            { name: '餃子', category: '穀物', image: 'assets/food/餃子.webp' },
            { name: '麵條', category: '穀物', image: 'assets/food/麵條.webp' },
            { name: '米飯', category: '穀物', image: 'assets/food/米飯.webp' },
            { name: '粟米', category: '穀物', image: 'assets/food/玉米.webp' },
            { name: '燕麥', category: '穀物', image: 'assets/food/燕麥.webp' },
            // 點心
            { name: '叉燒包', category: '點心', image: 'assets/food/叉燒包.webp' },
            { name: '咸水角', category: '點心', image: 'assets/food/咸水角.webp' },
            { name: '小籠包', category: '點心', image: 'assets/food/小籠包.webp' },
            { name: '流沙包', category: '點心', image: 'assets/food/流沙包.webp' },
            { name: '燒賣', category: '點心', image: 'assets/food/燒賣.webp' },
            { name: '牛柏葉', category: '點心', image: 'assets/food/牛柏葉.webp' },
            { name: '粉粿', category: '點心', image: 'assets/food/粉粿.webp' },
            { name: '糯米雞', category: '點心', image: 'assets/food/糯米雞.webp' },
            { name: '腸粉', category: '點心', image: 'assets/food/腸粉.webp' },
            { name: '蘿蔔糕', category: '點心', image: 'assets/food/蘿蔔糕.webp' },
            { name: '蝦餃', category: '點心', image: 'assets/food/蝦餃.webp' },
            { name: '豉汁排骨', category: '點心', image: 'assets/food/豉汁排骨.webp' },
            { name: '金錢肚', category: '點心', image: 'assets/food/金錢肚.webp' },
            { name: '雞扎', category: '點心', image: 'assets/food/雞扎.webp' },
            { name: '馬拉糕', category: '點心', image: 'assets/food/馬拉糕.webp' },
            { name: '鳳爪', category: '點心', image: 'assets/food/鳳爪.webp' },
            { name: '山竹牛肉球', category: '點心', image: 'assets/food/山竹牛肉球.webp' },
            { name: '春卷', category: '點心', image: 'assets/food/春卷.webp' },
            { name: '芝麻卷', category: '點心', image: 'assets/food/芝麻卷.webp' },
            { name: '蛋散', id: '蛋散-點心', category: '點心', image: 'assets/food/蛋散.webp' },
            // 甜品
            { name: '涼粉', category: '甜品', image: 'assets/food/涼粉.webp' },
            { name: '蛋糕', category: '甜品', image: 'assets/food/蛋糕.webp' },
            { name: '曲奇', category: '甜品', image: 'assets/food/曲奇.webp' },
            { name: '杏仁餅', category: '甜品', image: 'assets/food/杏仁餅.webp' },
            { name: '雪糕', category: '甜品', image: 'assets/food/雪糕.webp' },
            { name: '朱古力', category: '甜品', image: 'assets/food/巧克力.webp' },
            { name: '冬甩', category: '甜品', image: 'assets/food/冬甩.webp' },
            { name: '蛋撻', category: '甜品', image: 'assets/food/蛋撻.webp' },
            { name: '湯圓', category: '甜品', image: 'assets/food/湯圓.webp' },
            { name: '豆腐花', category: '甜品', image: 'assets/food/豆腐花.webp' },
            { name: '芝麻糊', category: '甜品', image: 'assets/food/芝麻糊.webp' },
            { name: '雞蛋仔', category: '甜品', image: 'assets/food/雞蛋仔.webp' },
            { name: '月餅', category: '甜品', image: 'assets/food/月餅.webp' },
            { name: '桂花糕', category: '甜品', image: 'assets/food/桂花糕.webp' },
            { name: '楊枝甘露', category: '甜品', image: 'assets/food/楊枝甘露.webp' },
            { name: '白糖糕', category: '甜品', image: 'assets/food/白糖糕.webp' },
            { name: '綠豆餅', category: '甜品', image: 'assets/food/綠豆餅.webp' },
            { name: '缽仔糕', category: '甜品', image: 'assets/food/缽仔糕.webp' },
            { name: '蛋卷', category: '甜品', image: 'assets/food/蛋卷.webp' },
            { name: '香蕉糕', category: '甜品', image: 'assets/food/香蕉糕.webp' },
            { name: '鳳梨酥', category: '甜品', image: 'assets/food/鳳梨酥.webp' },
            { name: '格仔餅', category: '甜品', image: 'assets/food/格仔餅.webp' },
            { name: '番薯糖水', category: '甜品', image: 'assets/food/番薯糖水.webp' },
            { name: '紅豆沙', category: '甜品', image: 'assets/food/紅豆沙.webp' },
            { name: '綠豆沙', category: '甜品', image: 'assets/food/綠豆沙.webp' },
            { name: '蛋散', id: '蛋散-甜品', category: '甜品', image: 'assets/food/蛋散.webp' },
            // 海鮮
            { name: '蝦', category: '海鮮', image: 'assets/food/蝦.webp' },
            { name: '三文魚', category: '海鮮', image: 'assets/food/鮭魚.webp' },
            { name: '蟹', category: '海鮮', image: 'assets/food/螃蟹.webp' },
            { name: '龍蝦', category: '海鮮', image: 'assets/food/龍蝦.webp' },
            { name: '鮑魚', category: '海鮮', image: 'assets/food/鮑魚.webp' },
            { name: '蟶子', category: '海鮮', image: 'assets/food/蟶子.webp' },
            { name: '墨魚', category: '海鮮', image: 'assets/food/墨魚.webp' },
            { name: '炒蜆', category: '海鮮', image: 'assets/food/炒蜆.webp' },
            { name: '比目魚', category: '海鮮', image: 'assets/food/比目魚.webp' },
            { name: '海膽', category: '海鮮', image: 'assets/food/海膽.webp' },
            { name: '象拔蚌', category: '海鮮', image: 'assets/food/象拔蚌.webp' },
            { name: '八爪魚', category: '海鮮', image: 'assets/food/八爪魚.webp' },
            { name: '吞拿魚', category: '海鮮', image: 'assets/food/吞拿魚.webp' },
            { name: '帶子', category: '海鮮', image: 'assets/food/帶子.webp' },
            { name: '海參', category: '海鮮', image: 'assets/food/海參.webp' },
            { name: '生蠔', category: '海鮮', image: 'assets/food/生蠔.webp' },
            { name: '石斑', category: '海鮮', image: 'assets/food/石斑.webp' },
            { name: '紅衫魚', category: '海鮮', image: 'assets/food/紅衫魚.webp' },
            { name: '鱸魚', category: '海鮮', image: 'assets/food/鱸魚.webp' },
            { name: '黃立鯧', category: '海鮮', image: 'assets/food/黃立鯧.webp' },
            { name: '黃花魚', category: '海鮮', image: 'assets/food/黃花魚.webp' },
        ];

        function getFoodId(item) { return item.id || item.name; }

        const CATEGORY_NAMES = ['水果', '蔬菜', '肉類', '點心', '堅果', '甜品', '海鮮'];
        const CATEGORY_ICONS = {
            '水果': '🍎', '蔬菜': '🥬', '肉類': '🍖', '點心': '🥟',
            '堅果': '🥜', '甜品': '🍰', '海鮮': '🦞'
        };
        const QUESTION_TEMPLATES = {
            '水果': '哪一個是 <span class="category-highlight">水果</span> ？',
            '蔬菜': '哪一個是 <span class="category-highlight">蔬菜</span> ？',
            '肉類': '哪一個是 <span class="category-highlight">肉類</span> ？',
            '點心': '哪一個是 <span class="category-highlight">點心</span> ？',
            '堅果': '哪一個是 <span class="category-highlight">堅果</span> ？',
            '甜品': '哪一個是 <span class="category-highlight">甜品</span> ？',
            '海鮮': '哪一個是 <span class="category-highlight">海鮮</span> ？',
        };

function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math
                .random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]]; } return a; }

        function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    var CognitiveFoodData = {
        FOOD_DATA: FOOD_DATA,
        getFoodId: getFoodId,
        CATEGORY_NAMES: CATEGORY_NAMES,
        CATEGORY_ICONS: CATEGORY_ICONS,
        QUESTION_TEMPLATES: QUESTION_TEMPLATES,
        shuffle: shuffle,
        pickRandom: pickRandom
    };

    // The food data is exposed only as the CognitiveFoodData bundle. The legacy
    // bare-global aliases (FOOD_DATA / getFoodId / CATEGORY_NAMES / ...) were dropped
    // once every consumer (game mounts + settings.js) read from CognitiveFoodData.
    if (typeof window !== 'undefined') {
        window.CognitiveFoodData = CognitiveFoodData;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = CognitiveFoodData;
    }
})(typeof window !== 'undefined' ? window : globalThis);
