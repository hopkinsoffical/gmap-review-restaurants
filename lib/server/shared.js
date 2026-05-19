function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/（[^）]*）/g, " ")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "")
    .trim();
}

function simplifyText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/（[^）]*）/g, " ")
    .replace(/\b\d+\s*(pcs?|piece|lb|oz)\b/g, " ")
    .replace(/[^\w\u4e00-\u9fff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueArray(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
}

function normalizeStringList(values) {
  if (!Array.isArray(values)) return [];
  return uniqueArray(
    values
      .map(function (value) {
        return String(value || "").trim();
      })
      .filter(Boolean),
  );
}

function createAppError(code, message, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status || 500;
  return error;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

module.exports = {
  asArray,
  createAppError,
  normalizeStringList,
  normalizeText,
  simplifyText,
  uniqueArray,
};
