const fs = require("fs");
const path = require("path");

let cachedMenu = null;

/**
 * Salon demo / fallback catalog (same shape as published menu_json).
 * Used when a store has no published snapshot so receipt → review flow still works.
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
