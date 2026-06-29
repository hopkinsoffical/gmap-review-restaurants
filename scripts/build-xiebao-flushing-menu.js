#!/usr/bin/env node
/**
 * Build menu JSON for xiebao-flushing (names only, no counts/prices).
 */
const fs = require("fs");
const path = require("path");

const RAW_ITEMS = [
  ["Signature Crab Roe 招牌蟹黄", "Eel Rice Bowl", "鳗鱼盖饭"],
  ["Signature Crab Roe 招牌蟹黄", "Crab Roe Rice (Tasting)", "蟹黄盖饭（体验版）"],
  ["Signature Crab Roe 招牌蟹黄", "Crab Roe Rice (Premium)", "蟹黄盖饭（至尊版）"],
  ["Signature Crab Roe 招牌蟹黄", "Crab Roe Meatballs Rice", "蟹黄狮子头盖饭"],
  ["Signature Crab Roe 招牌蟹黄", "Crab Roe Meatballs", "蟹黄狮子头"],
  ["Signature Crab Roe 招牌蟹黄", "Crab Roe Tofu Rice", "蟹黄豆腐盖饭"],
  ["Signature Crab Roe 招牌蟹黄", "Crab Roe Lo Mein (Tasting)", "蟹黄捞面（体验版）"],
  ["Signature Crab Roe 招牌蟹黄", "Crab Roe Lo Mein (Premium)", "蟹黄捞面（至尊版）"],
  ["Signature Crab Roe 招牌蟹黄", "Crab Roe & Yellow Fish Soup Rice", "金汤黄鱼蟹黄泡饭"],
  ["Signature Crab Roe 招牌蟹黄", "Crab Roe & Shrimp Topped Noodles", "蟹黄虾仁盖面"],
  ["Signature Crab Roe 招牌蟹黄", "Crab Roe Chicken Soup w. Pork Rinds", "蟹黄鸡汤肉皮煲"],
  ["Signature Crab Roe 招牌蟹黄", "Crab Roe Fish Soup w. Pork Rinds", "蟹黄鱼汤肉皮煲"],
  ["Signature Crab Roe 招牌蟹黄", "Crab Roe & Roast Duck Soup Dumplings", "蟹黄烤鸭汤包"],
  ["Rice & Classics 饭与经典", "Dongpo Pork w. Lotus Leaf", "荷叶东坡肉"],
  ["Rice & Classics 饭与经典", "Crab Meat Fried Rice w. XO Sauce", "蟹肉 XO酱炒饭"],
  ["Rice & Classics 饭与经典", "Rice", "米饭"],
  ["Noodles 面食", "Shanghai Smoked Fish Noodle Soup", "上海熏鱼面"],
  ["Noodles 面食", "Shanghai Yellow Croaker Noodle Soup", "上海黄鱼面"],
  ["Noodles 面食", "Stir-Fried Shrimp Topped Noodles", "爆炒虾仁盖浇面"],
  ["Noodles 面食", "XO Sauce Topped Noodles", "XO 酱盖浇面"],
  ["Noodles 面食", "Dan Dan Noodles", "担担面"],
  ["Noodles 面食", "Shredded Pork & Pepper Topped Noodles", "青椒香干肉丝盖浇面"],
  ["Noodles 面食", "Eel & Shrimp Topped Noodles", "鳝丝虾仁盖浇面"],
  ["Noodles 面食", "Beef & Shrimp Topped Noodles", "牛肉虾仁盖浇面"],
  ["Noodles 面食", "Spicy Shredded Chicken Noodles", "麻辣鸡丝面"],
  ["Noodles 面食", "Scallion Oil Chicken Noodles", "葱油鸡丝面"],
  ["Noodles 面食", "Scallion Oil Noodles", "葱油面"],
  ["Noodles 面食", "XO Sauce Noodles", "XO 酱面"],
  ["Noodles 面食", "Noodles", "面"],
  ["Wontons & Porridge 馄饨粥品", "Large Fresh Shrimp Wontons", "鲜虾大馄饨"],
  ["Wontons & Porridge 馄饨粥品", "Three-Delight Shrimp Wontons", "三鲜虾仁馄饨"],
  ["Wontons & Porridge 馄饨粥品", "Shepherd's Purse Pork Wontons", "荠菜鲜肉大馄饨"],
  ["Wontons & Porridge 馄饨粥品", "Fish Soup Wontons", "鱼汤小馄饨"],
  ["Wontons & Porridge 馄饨粥品", "Pork & Crab Roe Wontons", "蟹黄鲜肉小馄饨"],
  ["Wontons & Porridge 馄饨粥品", "Meiling Sweet Porridge", "美龄粥"],
  ["Baos & Dumplings 包点小笼", "Pure Crab Roe Xiaolongbao", "纯蟹黄小笼包"],
  ["Baos & Dumplings 包点小笼", "Crab Roe & Pork Xiaolongbao", "蟹黄鲜肉小笼"],
  ["Baos & Dumplings 包点小笼", "Frozen Pure Crab Roe Xiaolongbao", "速冻纯蟹黄小笼包"],
  ["Baos & Dumplings 包点小笼", "Frozen Crab Roe & Pork Xiaolongbao", "速冻蟹黄鲜肉小笼"],
  ["Baos & Dumplings 包点小笼", "Crab Meat Buns", "蟹黄肉包"],
  ["Baos & Dumplings 包点小笼", "Sea Tiger Crab Roe Bun", "海虎蟹黄包"],
  ["Baos & Dumplings 包点小笼", "Sea Tiger Crab Bun", "海虎蟹肉包"],
  ["Baos & Dumplings 包点小笼", "Braised Pork Steamed Bun", "红烧肉包"],
  ["Baos & Dumplings 包点小笼", "Shanghai Spicy Chicken Bao", "上海辣鸡包"],
  ["Baos & Dumplings 包点小笼", "Spicy Pork Belly Bao", "回锅肉包"],
  ["Baos & Dumplings 包点小笼", "Corn & Pork Steamed Bun", "玉米鲜肉包"],
  ["Baos & Dumplings 包点小笼", "Teriyaki Chicken Bao", "照烧鸡包"],
  ["Baos & Dumplings 包点小笼", "Greens & Bamboo Shoot Bao", "青菜笋丁包"],
  ["Baos & Dumplings 包点小笼", "Black Pepper Beef Bao", "黑椒牛肉包"],
  ["Baos & Dumplings 包点小笼", "Yangzhou Three-Diced Pork Bun", "扬州三丁包"],
  ["Baos & Dumplings 包点小笼", "Shrimp Spring Roll", "纯鲜虾春卷"],
  ["Baos & Dumplings 包点小笼", "Crab Roe & Shrimp Spring Rolls", "蟹黄鲜虾春卷"],
  ["Baos & Dumplings 包点小笼", "Fried Lotus Root Box", "煎藕夹"],
  ["Mooncakes & Zongzi 月饼粽子", "Crab Treasure Meat Zongzi", "蟹宝肉粽"],
  ["Mooncakes & Zongzi 月饼粽子", "Red Bean Zongzi", "红豆粽子"],
  ["Mooncakes & Zongzi 月饼粽子", "Crab Roe Mooncake", "蟹黄鲜肉月饼"],
  ["Mooncakes & Zongzi 月饼粽子", "Red Bean Paste Mooncake", "豆沙月饼"],
  ["Mooncakes & Zongzi 月饼粽子", "Rose Red Bean Mooncake", "玫瑰豆沙月饼"],
  ["Mooncakes & Zongzi 月饼粽子", "Salted Egg Pork Floss Mooncake", "咸蛋黄肉松月饼"],
  ["Mooncakes & Zongzi 月饼粽子", "Crab Roe & Pork Mooncake", "蟹黄蟹肉月饼"],
  ["Mooncakes & Zongzi 月饼粽子", "Frozen Crab Roe Mooncake", "速冻蟹黄蟹肉月饼"],
  ["Mooncakes & Zongzi 月饼粽子", "Frozen Rose Red Bean Mooncake", "速冻玫瑰豆沙月饼"],
  ["Mooncakes & Zongzi 月饼粽子", "Frozen Salted Egg Pork Floss Mooncake", "速冻咸蛋黄肉松月饼"],
  ["Mooncakes & Zongzi 月饼粽子", "Fresh Pork Mooncake", "鲜肉月饼"],
  ["Mooncakes & Zongzi 月饼粽子", "Mooncake Gift Box", "月饼打包盒"],
  ["Small Plates 小菜", "Spicy Shredded Chicken", "麻辣鸡丝"],
  ["Small Plates 小菜", "Stewed Beef Short Ribs w. Radish", "牛仔骨清炖萝卜煲"],
  ["Small Plates 小菜", "Braised Razor Clams w. Radish", "萝卜烧蛏子"],
  ["Small Plates 小菜", "Whitebait Omelet", "银鱼跑蛋"],
  ["Small Plates 小菜", "Blanched Greens", "烫青菜"],
  ["Drinks 饮品", "Red Date & Ginger Tea", "红枣生姜茶"],
  ["Drinks 饮品", "Iced Cola", "冰可乐"],
  ["Drinks 饮品", "Iced Diet Coke", "冰无糖可乐"],
  ["Drinks 饮品", "Iced Mineral Water", "冰矿泉水"],
  ["Other 其他", "Open Items", "开价菜"],
];

function inferDishType(category, en) {
  const hay = category + " " + en;
  if (/crab|roe|seafood|clam|whitebait|fish|shrimp|eel|wonton/i.test(hay)) return "seafood";
  if (/noodle|lo mein|dan dan|scallion oil/i.test(hay)) return "noodle";
  if (/rice|porridge|bowl/i.test(hay)) return "rice";
  if (/bao|dumpling|xiaolong|spring roll|mooncake|zongzi|bun/i.test(hay)) return "dim_sum";
  if (/drink|tea|cola|water/i.test(hay)) return "drink";
  if (/soup/i.test(hay)) return "soup";
  return "entree";
}

function buildMenuJson() {
  const categories = new Map();
  RAW_ITEMS.forEach(function (row, index) {
    const category = row[0];
    const en = String(row[1] || "").trim();
    const zh = String(row[2] || "").trim();
    if (!en || !zh) return;
    const uqid = index + 1;
    const item = {
      uqid: uqid,
      n: en,
      zh: zh,
      en: en,
      id: uqid,
      pp: 0,
      ingr: zh + " / " + en,
      aliases: [],
      dish_type: inferDishType(category, en),
      dish_subtype: inferDishType(category, en),
    };
    if (!categories.has(category)) categories.set(category, []);
    categories.get(category).push(item);
  });

  const result = {
    message: "xiebao-flushing menu",
    format: {
      uqid: 0,
      n: "",
      zh: "",
      id: "",
      pp: 0,
      ingr: "dish details",
    },
    note: {
      "Menu note": "Xiebao Flushing catalog — crab roe specialties and Shanghai-style dishes.",
    },
  };

  categories.forEach(function (items, categoryName) {
    result[categoryName] = items;
  });

  return {
    results: [
      {
        toolCallId: "seed-xiebao-flushing-menu",
        result: result,
      },
    ],
  };
}

const menuJson = buildMenuJson();
const outPath = path.resolve(__dirname, "..", "data", "menus", "xiebao-flushing-menu.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(menuJson, null, 2) + "\n");
console.log("Wrote", outPath, "items:", RAW_ITEMS.length);

module.exports = { buildMenuJson, outPath };
