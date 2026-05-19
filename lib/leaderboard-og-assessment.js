const VISUALS = {
  EXCELLENT: {
    level: "EXCELLENT",
    labelEn: "Excellent",
    labelZh: "优秀",
    emoji: "⭐",
    color: "#1A365D",
    light: "#EBF8FF",
    border: "#63B3ED",
  },
  GOOD: {
    level: "GOOD",
    labelEn: "Good",
    labelZh: "良好",
    emoji: "🟢",
    color: "#276749",
    light: "#F0FFF4",
    border: "#68D391",
  },
  MODERATE: {
    level: "MODERATE",
    labelEn: "Fair",
    labelZh: "一般",
    emoji: "🟡",
    color: "#975A16",
    light: "#FFFFF0",
    border: "#ECC94B",
  },
  LOW: {
    level: "LOW",
    labelEn: "Poor",
    labelZh: "较差",
    emoji: "🟠",
    color: "#C05621",
    light: "#FFFAF0",
    border: "#F6AD55",
  },
  RISKY: {
    level: "RISKY",
    labelEn: "Critical",
    labelZh: "严重",
    emoji: "🔴",
    color: "#C53030",
    light: "#FFF5F5",
    border: "#FC8181",
  },
};

function getLeaderboardAssessmentVisual(salon) {
  const raw = String((salon && salon.assessmentLevel) || "")
    .trim()
    .toUpperCase();
  const key = raw && VISUALS[raw] ? raw : "MODERATE";
  return VISUALS[key];
}

function getLevelLabel(visual, locPref) {
  if (!visual) return "";
  if (locPref === "zh" && visual.labelZh) return visual.labelZh;
  if (visual.labelEn) return visual.labelEn;
  return String(visual.level || "");
}

module.exports = {
  getLeaderboardAssessmentVisual,
  getLevelLabel,
  VISUALS,
};
