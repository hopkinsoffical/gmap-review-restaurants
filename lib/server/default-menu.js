const fs = require("fs");
const path = require("path");

let cachedMenu = null;

/**
 * Generic Chinese-restaurant demo / fallback catalog (same shape as published
 * menu_json). Used when a store has no published snapshot so the receipt → review
 * flow still works. (Name kept for API stability; the salon catalog this fork
 * shipped with is preserved as menu.salon.json.bak.)
 */
function getDefaultSalonMenuJson() {
  if (cachedMenu) return cachedMenu;
  const menuPath = path.join(__dirname, "..", "..", "menu.json");
  const raw = fs.readFileSync(menuPath, "utf8");
  cachedMenu = JSON.parse(raw);
  return cachedMenu;
}

function getDefaultSalonMenuJsonSafe() {
  try {
    return getDefaultSalonMenuJson();
  } catch (error) {
    console.warn("[default-menu] Could not read menu.json", error && error.message ? error.message : error);
    return null;
  }
}

module.exports = {
  getDefaultSalonMenuJson,
  getDefaultSalonMenuJsonSafe,
};
