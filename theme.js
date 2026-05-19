(function () {
  const STORAGE_KEY = "site-theme";

  function getSavedTheme() {
    return localStorage.getItem(STORAGE_KEY);
  }

  function getPreferredTheme() {
    const savedTheme = getSavedTheme();

    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }

    return "dark";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);

    const toggleButtons = document.querySelectorAll("[data-theme-toggle]");

    toggleButtons.forEach(function (button) {
      const label = button.querySelector("[data-theme-label]");
      const icon = button.querySelector("[data-theme-icon]");

      if (label) {
        label.textContent = theme === "dark" ? "Dark" : "Light";
      }

      if (icon) {
        icon.textContent = theme === "dark" ? "☾" : "☀";
      }

      button.setAttribute("aria-label", "Current theme: " + theme);
    });
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";

    applyTheme(nextTheme);
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyTheme(getPreferredTheme());

    const toggleButtons = document.querySelectorAll("[data-theme-toggle]");

    toggleButtons.forEach(function (button) {
      button.addEventListener("click", toggleTheme);
    });
  });
})();