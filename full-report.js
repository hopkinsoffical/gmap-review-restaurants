/**
 * Full growth report renderer (v2) — charts, mobile snap, PDF export.
 */
(function (global) {
  "use strict";

  var chartInstances = [];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function mvClass(tone) {
    if (tone === "success") return "mv--success";
    if (tone === "warning") return "mv--warning";
    return "mv--danger";
  }

  function checkIcon(status) {
    if (status === "ok") return '<span class="fr-check-icon fr-check-icon--ok">✓</span>';
    if (status === "warn") return '<span class="fr-check-icon fr-check-icon--warn">!</span>';
    return '<span class="fr-check-icon fr-check-icon--bad">✕</span>';
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } catch (e) {
      return "";
    }
  }

  /** Keep section title + content together in PDF (no split across pages). */
  function pdfGroup(html) {
    return '<div class="fr-pdf-group">' + html + "</div>";
  }

  /** One viewport snap section on mobile; flows as blocks on desktop. */
  function snapSection(panelId, html, opts) {
    opts = opts || {};
    var chapterHead = opts.chapter ? pgTag(opts.chapter.num, opts.chapter.label) : "";
    return (
      '<section class="rms-mobile-panel fr-snap-section' +
      (opts.chapterStart ? " fr-chapter-start" : "") +
      (opts.pdfBreak ? " fr-pdf-page-break" : "") +
      '" data-rms-panel="' +
      esc(panelId) +
      '">' +
      '<div class="rms-mobile-panel-inner fr-snap-section-inner">' +
      chapterHead +
      pdfGroup(html) +
      "</div></section>"
    );
  }

  function pgTag(num, label) {
    return (
      '<div class="pg-tag"><div class="pg-dot">' +
      esc(num) +
      '</div><span class="pg-lbl">' +
      label +
      "</span></div>"
    );
  }

  function scoreRingSvg(score, color) {
    var pct = Math.max(0, Math.min(100, Number(score) || 0));
    var offset = 176 - (176 * pct) / 100;
    return (
      '<svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">' +
      '<circle cx="36" cy="36" r="28" fill="none" stroke="currentColor" opacity="0.15" stroke-width="7"/>' +
      '<circle cx="36" cy="36" r="28" fill="none" stroke="' +
      esc(color) +
      '" stroke-width="7" stroke-dasharray="176" stroke-dashoffset="' +
      String(offset) +
      '" stroke-linecap="round" transform="rotate(-90 36 36)"/>' +
      '<text x="36" y="40" text-anchor="middle" font-size="16" font-weight="600" fill="currentColor">' +
      esc(String(Math.round(pct))) +
      "</text></svg>"
    );
  }

  function renderHeader(d) {
    return (
      '<header class="fr-rpt-header">' +
      '<div class="fr-rpt-header-copy">' +
      '<div style="display:flex;gap:7px;margin-bottom:7px;flex-wrap:wrap">' +
      '<span class="bdg fr-bdg-info">Full Growth Report</span>' +
      '<span class="bdg fr-bdg-danger">⚠ ' +
      esc(d.criticalIssues) +
      " critical issues</span>" +
      '<span class="bdg fr-bdg-warning">✦ ' +
      esc(d.quickWins) +
      " quick wins</span>" +
      "</div>" +
      "<p style=\"font-size:19px;font-weight:600;margin-bottom:3px\">" +
      esc(d.businessName) +
      "</p>" +
      '<p style="font-size:13px;color:var(--fr-muted)">📍 ' +
      esc(d.location) +
      " · " +
      esc(d.category) +
      " · " +
      esc(formatDate(d.generatedAt)) +
      "</p></div>" +
      '<div class="fr-score-ring">' +
      scoreRingSvg(d.overallScore, d.scoreColor || "#a32d2d") +
      '<p style="font-size:11px;font-weight:600;margin-top:4px;color:' +
      esc(d.scoreColor || "#a32d2d") +
      '">' +
      esc(d.overallLabel) +
      '</p><p style="font-size:10px;color:var(--fr-muted)">Overall score</p></div></header>'
    );
  }

  function renderMetrics(m) {
    var keys = ["rating", "reviews", "rank", "photos"];
    return (
      '<div class="mg">' +
      keys
        .map(function (k) {
          var x = m[k] || {};
          return (
            '<div class="mc"><p class="ml">' +
            esc(k.charAt(0).toUpperCase() + k.slice(1)) +
            '</p><p class="mv ' +
            mvClass(x.tone) +
            '">' +
            esc(x.value) +
            '</p><p class="ms">' +
            esc(x.sub) +
            "</p></div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderCheckup(items) {
    return (
      '<div class="card" style="padding:0;overflow:hidden"><div class="fr-check-grid">' +
      (items || [])
        .map(function (item) {
          return (
            '<div class="fr-check-cell">' +
            checkIcon(item.status) +
            '<p style="font-size:13px;font-weight:600;margin-bottom:3px">' +
            esc(item.title) +
            '</p><p style="font-size:11px;color:var(--fr-muted)">' +
            esc(item.detail) +
            "</p></div>"
          );
        })
        .join("") +
      "</div></div>"
    );
  }


  function renderChapter1(d) {
    var ch = { num: "1", label: "Business foundation &amp; digital profile" };
    return (
      snapSection("header", renderHeader(d)) +
      snapSection("p1-metrics", renderMetrics(d.metrics), { chapter: ch, chapterStart: true }) +
      snapSection("p1-checkup", '<p class="sec">Profile checkup</p>' + renderCheckup(d.profileCheckup)) +
      snapSection(
        "p1-radar",
        '<p class="sec">5-dimension score vs. top competitor</p>' +
          '<div class="card"><div class="fr-chart-box fr-chart-box--snap"><canvas data-fr-chart="radar"></canvas></div></div>',
      ) +
      snapSection(
        "p1-alert",
        '<div class="fr-callout fr-callout--danger"><p class="fr-callout-title">' +
          esc(d.page1Alert.title) +
          "</p><p>" +
          esc(d.page1Alert.body) +
          "</p></div>",
      )
    );
  }

  function renderChapter2(d) {
    var r = d.reviews || {};
    var ch = { num: "2", label: "Review analysis &amp; reputation" };
    var negHtml =
      '<div class="card fr-card-flush">' +
      (r.negativeSamples || [])
        .map(function (rev) {
          return (
            '<div class="fr-review-row">' +
            '<div class="fr-review-row-head"><strong class="fr-review-author">' +
            esc(rev.author) +
            '</strong><span class="fr-review-stars">★ ' +
            esc(rev.rating) +
            "</span></div>" +
            '<p class="fr-review-text">' +
            esc(rev.text) +
            "</p></div>"
          );
        })
        .join("") +
      "</div>";
    return (
      snapSection(
        "p2-summary",
        '<div class="mg">' +
        '<div class="mc"><p class="ml">1–2 star reviews</p><p class="mv mv--danger">' +
        esc(r.oneTwoStarPct) +
        '%</p></div>' +
        '<div class="mc"><p class="ml">Response rate</p><p class="mv mv--danger">' +
        esc(r.responseRate) +
        '%</p></div>' +
        '<div class="mc"><p class="ml">Reviews last 90d</p><p class="mv mv--warning">' +
        esc(r.reviews90d) +
        "</p></div>" +
        '<div class="mc"><p class="ml">Sentiment score</p><p class="mv mv--warning">' +
        esc(r.sentiment) +
        " / 100</p></div></div>",
        { chapter: ch, chapterStart: true, pdfBreak: true },
      ) +
      snapSection(
        "p2-rating",
        '<p class="sec">Rating distribution vs. area average</p>' +
          '<div class="card"><div class="fr-chart-box fr-chart-box--snap fr-chart-box--sm"><canvas data-fr-chart="ratingBar"></canvas></div></div>',
      ) +
      snapSection(
        "p2-pain",
        '<p class="sec">Negative review pain points</p>' +
          '<div class="card"><div class="fr-chart-box fr-chart-box--snap fr-chart-box--sm"><canvas data-fr-chart="pain"></canvas></div></div>',
      ) +
      snapSection("p2-reviews", '<p class="sec">Sample negative reviews</p>' + negHtml) +
      snapSection(
        "p2-calc",
        '<p class="sec">Revenue lost to missed calls</p>' +
          '<div class="card" data-fr-calculator>' +
          '<label class="fr-calc-label">Missed calls / week <input type="range" data-fr-calls min="1" max="20" value="' +
          esc(r.calculator.callsPerWeek) +
          '" class="fr-calc-range"></label>' +
          '<label class="fr-calc-label">Avg service ($) <input type="range" data-fr-value min="40" max="200" value="' +
          esc(r.calculator.avgService) +
          '" class="fr-calc-range"></label>' +
          '<div class="mg"><div class="mc fr-calc-stat"><p class="ml">Lost / month</p><p class="mv mv--danger" data-fr-lost-month>$0</p></div>' +
          '<div class="mc fr-calc-stat"><p class="ml">Lost / year</p><p class="mv mv--danger" data-fr-lost-year>$0</p></div>' +
          '<div class="mc fr-calc-stat"><p class="ml">Tier 3 cost</p><p class="mv mv--success">$' +
          esc(r.calculator.tier3Monthly) +
          "/mo</p></div></div>" +
          '<div class="fr-chart-box fr-chart-box--snap fr-chart-box--sm"><canvas data-fr-chart="loss"></canvas></div></div>',
      )
    );
  }

  function renderChapter3(d) {
    var ch = { num: "3", label: "Competitor &amp; community ranking" };
    var packRows =
      d.competitors && d.competitors.length
        ? d.competitors
            .map(function (c) {
              return (
                '<div class="fr-comp-row' +
                (c.yours ? " fr-comp-row--you" : "") +
                '"><span class="fr-comp-rank">' +
                esc(c.rank) +
                '</span><div class="fr-comp-body"><p class="fr-comp-name">' +
                esc(c.name) +
                '</p><p class="fr-comp-meta">' +
                esc(c.meta) +
                '</p></div><span class="fr-comp-rating">★ ' +
                esc(c.rating) +
                "</span></div>"
              );
            })
            .join("")
        : '<p class="fr-local-pack-empty">Nearby salon rankings are not available for this area yet.</p>';
    return (
      snapSection(
        "p3-pack",
        '<p class="sec">Your position in the local pack</p>' +
          '<div class="card fr-local-pack-card"><p class="fr-local-pack-query">' +
          esc(d.searchQuery) +
          "</p>" +
          packRows +
          "</div>",
        { chapter: ch, chapterStart: true, pdfBreak: true },
      ) +
      snapSection(
        "p3-feature",
        '<p class="sec">Feature gap</p><div class="card"><div class="fr-chart-box fr-chart-box--snap"><canvas data-fr-chart="feature"></canvas></div></div>',
      ) +
      snapSection(
        "p3-community",
        '<p class="sec">Community grid</p><div class="card"><div class="fr-community-grid" data-fr-community></div></div>',
      ) +
      snapSection(
        "p3-insight",
        '<div class="fr-callout fr-callout--warning"><p class="fr-callout-title">' +
          esc(d.page3Insight.title) +
          "</p><p>" +
          esc(d.page3Insight.body) +
          "</p></div>",
      )
    );
  }

  function renderChapter4(d) {
    var ch = { num: "4", label: "SEO diagnosis &amp; 30-day roadmap" };
    return (
      snapSection(
        "p4-keywords",
        '<p class="sec">Keyword rankings</p><div class="card"><div class="fr-chart-box fr-chart-box--snap"><canvas data-fr-chart="keywords"></canvas></div></div>',
        { chapter: ch, chapterStart: true, pdfBreak: true },
      ) +
      snapSection(
        "p4-seo",
        '<p class="sec">SEO signal health</p><div class="card"><div class="fr-chart-box fr-chart-box--snap fr-chart-box--sm"><canvas data-fr-chart="seo"></canvas></div></div>',
      ) +
      snapSection("p4-roadmap", '<p class="sec">30-day action roadmap</p><div class="card fr-card-flush" data-fr-roadmap></div>') +
      snapSection("p4-tiers", '<p class="sec">Recommended service tiers</p>' + renderTiers(d.tiers))
    );
  }

  function renderReportBody(d) {
    return renderChapter1(d) + renderChapter2(d) + renderChapter3(d) + renderChapter4(d);
  }

  function renderTiers(tiers) {
    return (tiers || [])
      .map(function (t) {
        return (
          '<a class="tier-card' +
          (t.featured ? " tier-card--featured" : "") +
          '" href="' +
          esc(t.href) +
          '"><div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:8px;flex-wrap:wrap">' +
          "<strong>" +
          esc(t.label) +
          "</strong><span style=\"color:var(--fr-muted)\">" +
          esc(t.price) +
          "</span></div><p style=\"font-size:12px;color:var(--fr-muted);margin-bottom:8px\">" +
          esc(t.summary) +
          '</p><div style="display:flex;flex-wrap:wrap;gap:5px">' +
          (t.tags || [])
            .map(function (tag) {
              return (
                '<span style="font-size:11px;background:var(--fr-bg2);padding:2px 8px;border-radius:20px">' +
                esc(tag) +
                "</span>"
              );
            })
            .join("") +
          "</div></a>"
        );
      })
      .join("");
  }

  function renderPage4(d) {
    return (
      '<section class="pg fr-pdf-page-break rms-mobile-panel" data-rms-panel="page4">' +
      pgTag("4", "SEO diagnosis &amp; 30-day roadmap") +
      pdfGroup(
        '<p class="sec">Keyword rankings</p><div class="card"><div class="fr-chart-box"><canvas data-fr-chart="keywords"></canvas></div></div>',
      ) +
      pdfGroup(
        '<p class="sec">SEO signal health</p><div class="card"><div class="fr-chart-box fr-chart-box--sm"><canvas data-fr-chart="seo"></canvas></div></div>',
      ) +
      pdfGroup('<p class="sec">30-day action roadmap</p><div class="card" style="padding:0" data-fr-roadmap></div>') +
      pdfGroup('<p class="sec">Recommended service tiers</p>' + renderTiers(d.tiers)) +
      "</section>"
    );
  }

  function renderHtml(data, opts) {
    opts = opts || {};
    var slug = opts.slug || data.slug || "";
    var briefUrl = "/analysis-reports/" + encodeURIComponent(slug);

    return (
      '<div class="fr-page marketing-page-full-report">' +
      '<a class="fr-mobile-back rms-mobile-only" href="' +
      esc(briefUrl) +
      '">← Brief</a>' +
      '<div class="fr-toolbar fr-toolbar--desktop-only">' +
      '<p class="intel-back"><a class="ghost landing-link" href="' +
      esc(briefUrl) +
      '">← Brief report</a></p>' +
      '<div class="fr-toolbar-actions">' +
      '<button type="button" class="fr-btn fr-btn--pdf" data-fr-download-pdf>Download PDF</button>' +
      '<a class="fr-btn" href="/services">All services</a>' +
      "</div></div>" +
      '<div class="fr-snap-wrap rms-snap-wrap">' +
      '<div class="rms-mobile-scroll" data-rms-mobile-scroll>' +
      '<div class="fr-rpt">' +
      renderReportBody(data) +
      "</div></div></div></div>"
    );
  }

  function destroyCharts() {
    chartInstances.forEach(function (c) {
      try {
        c.destroy();
      } catch (e) {
        /* ignore */
      }
    });
    chartInstances = [];
  }

  function initCharts(data) {
    if (!global.Chart) return;
    destroyCharts();

    var chartColors = chartThemeColors();
    var tick = chartColors.tick;
    var grid = chartColors.grid;

    function add(canvas, cfg) {
      if (!canvas) return;
      chartInstances.push(new global.Chart(canvas, cfg));
    }

    var radar = document.querySelector("[data-fr-chart=radar]");
    if (radar && data.radar) {
      add(radar, {
        type: "radar",
        data: {
          labels: data.radar.labels,
          datasets: [
            { label: "You", data: data.radar.you, borderColor: "#a32d2d", backgroundColor: "rgba(163,45,45,0.12)" },
            { label: "Top competitor", data: data.radar.competitor, borderColor: "#0f6e56", backgroundColor: "rgba(15,110,86,0.12)" },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
      });
    }

    var ratingBar = document.querySelector("[data-fr-chart=ratingBar]");
    if (ratingBar && data.reviews) {
      add(ratingBar, {
        type: "bar",
        data: {
          labels: ["5★", "4★", "3★", "2★", "1★"],
          datasets: [
            { label: "You", data: data.reviews.ratingBars.you, backgroundColor: "#185fa5" },
            { label: "Area avg", data: data.reviews.ratingBars.area, backgroundColor: "#d3d1c7" },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { max: 100, ticks: { callback: function (v) { return v + "%"; } } } } },
      });
    }

    var pain = document.querySelector("[data-fr-chart=pain]");
    if (pain && data.reviews) {
      add(pain, {
        type: "bar",
        data: {
          labels: data.reviews.painPoints.map(function (p) { return p.label; }),
          datasets: [{ data: data.reviews.painPoints.map(function (p) { return p.count; }), backgroundColor: "#a32d2d" }],
        },
        options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
      });
    }

    var loss = document.querySelector("[data-fr-chart=loss]");
    var lossChart;
    if (loss) {
      lossChart = new global.Chart(loss, {
        type: "bar",
        data: { labels: ["Annual revenue lost", "Tier 3 annual cost"], datasets: [{ data: [12000, 1188], backgroundColor: ["#a32d2d", "#0f6e56"] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
      });
      chartInstances.push(lossChart);
    }

    var feature = document.querySelector("[data-fr-chart=feature]");
    if (feature && data.featureGap) {
      add(feature, {
        type: "bar",
        data: {
          labels: data.featureGap.labels,
          datasets: [
            { label: "You", data: data.featureGap.you, backgroundColor: "#185fa5" },
            { label: "Competitor", data: data.featureGap.competitor, backgroundColor: "#0f6e56" },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { max: 1.2, ticks: { display: false } } } },
      });
    }

    var kw = document.querySelector("[data-fr-chart=keywords]");
    if (kw && data.keywords) {
      add(kw, {
        type: "bar",
        data: {
          labels: data.keywords.map(function (k) { return k.keyword; }),
          datasets: [{
            data: data.keywords.map(function (k) { return k.rank; }),
            backgroundColor: data.keywords.map(function (k) {
              return k.rank <= 5 ? "#0f6e56" : k.rank <= 10 ? "#ba7517" : "#a32d2d";
            }),
          }],
        },
        options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
      });
    }

    var seo = document.querySelector("[data-fr-chart=seo]");
    if (seo && data.seoSignals) {
      add(seo, {
        type: "bar",
        data: {
          labels: data.seoSignals.map(function (s) { return s.label; }),
          datasets: [{
            data: data.seoSignals.map(function (s) { return s.score; }),
            backgroundColor: data.seoSignals.map(function (s) {
              return s.score >= 65 ? "#0f6e56" : s.score >= 45 ? "#ba7517" : "#a32d2d";
            }),
          }],
        },
        options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
      });
    }

    initCalculator(data, lossChart);
    initCommunityGrid(data);
    initRoadmap(data);
  }

  function initCommunityGrid(data) {
    var wrap = document.querySelector("[data-fr-community]");
    if (!wrap) return;
    wrap.innerHTML = (data.communityGrid || [])
      .map(function (g) {
        var color = g.rank <= 3 ? "#0f6e56" : g.rank <= 10 ? "#ba7517" : "#a32d2d";
        var bg = g.rank <= 3 ? "rgba(15,110,86,0.12)" : g.rank <= 10 ? "rgba(186,117,23,0.12)" : "rgba(163,45,45,0.12)";
        return (
          '<div class="fr-community-cell' +
          (g.you ? " fr-community-cell--you" : "") +
          '" style="background:' +
          bg +
          '"><p style="font-size:18px;font-weight:600;color:' +
          color +
          '">#' +
          esc(g.rank) +
          '</p><p style="font-size:10px;color:var(--fr-muted)">' +
          esc(g.zone) +
          "</p></div>"
        );
      })
      .join("");
  }

  function initRoadmap(data) {
    var wrap = document.querySelector("[data-fr-roadmap]");
    if (!wrap) return;
    wrap.innerHTML = (data.roadmap || [])
      .map(function (w) {
        return (
          '<div style="display:flex;gap:12px;padding:14px 16px;border-bottom:1px solid var(--fr-border)">' +
          '<div style="min-width:64px;font-size:11px;font-weight:600;text-align:center;padding:4px 8px;border-radius:8px;background:var(--fr-bg2)">' +
          esc(w.week) +
          "</div><div><p style=\"font-weight:600;font-size:13px;margin-bottom:6px\">" +
          esc(w.title) +
          '</p><p style="font-size:11px;color:var(--fr-muted)">' +
          (w.items || []).map(esc).join(" · ") +
          "</p></div></div>"
        );
      })
      .join("");
  }

  function initCalculator(data, lossChart) {
    var root = document.querySelector("[data-fr-calculator]");
    if (!root) return;
    var calls = root.querySelector("[data-fr-calls]");
    var value = root.querySelector("[data-fr-value]");
    var lostM = root.querySelector("[data-fr-lost-month]");
    var lostY = root.querySelector("[data-fr-lost-year]");

    function update() {
      var c = parseInt(calls.value, 10) || 4;
      var v = parseInt(value.value, 10) || 85;
      var monthly = Math.round(c * 4 * v * 0.4);
      var annual = monthly * 12;
      lostM.textContent = "$" + monthly.toLocaleString();
      lostY.textContent = "$" + annual.toLocaleString();
      if (lossChart) {
        lossChart.data.datasets[0].data = [annual, (data.reviews.calculator.tier3Monthly || 99) * 12];
        lossChart.update();
      }
    }
    calls.addEventListener("input", update);
    value.addEventListener("input", update);
    update();
  }

  function chartThemeColors() {
    var page = document.querySelector(".fr-page");
    var source = page || document.documentElement;
    var muted = getComputedStyle(source).getPropertyValue("--fr-muted").trim();
    return { tick: muted || "#6b7280", grid: "rgba(0,0,0,0.08)" };
  }

  function refreshChartsForExport() {
    var colors = chartThemeColors();
    chartInstances.forEach(function (chart) {
      try {
        if (chart.options.scales) {
          Object.keys(chart.options.scales).forEach(function (axis) {
            var scale = chart.options.scales[axis];
            if (scale && scale.ticks) scale.ticks.color = colors.tick;
            if (scale && scale.grid) scale.grid.color = colors.grid;
          });
        }
        if (chart.options.plugins && chart.options.plugins.legend && chart.options.plugins.legend.labels) {
          chart.options.plugins.legend.labels.color = colors.tick;
        }
        chart.update("none");
      } catch (e) {
        /* ignore */
      }
    });
  }

  function setPdfExportMode(on) {
    var root = document.documentElement;
    var page = document.querySelector(".fr-page");
    if (on) {
      root.classList.add("fr-pdf-export");
      if (page) page.classList.add("fr-pdf-export");
      refreshChartsForExport();
    } else {
      root.classList.remove("fr-pdf-export");
      if (page) page.classList.remove("fr-pdf-export");
      refreshChartsForExport();
    }
  }

  function preparePdfClone(clonedDoc) {
    var html = clonedDoc.documentElement;
    html.setAttribute("data-theme", "light");
    html.classList.add("fr-pdf-export");
    var page = clonedDoc.querySelector(".fr-page");
    if (page) page.classList.add("fr-pdf-export");
    var toolbar = clonedDoc.querySelector(".fr-toolbar");
    if (toolbar) toolbar.style.display = "none";
    var dots = clonedDoc.querySelector(".rms-mobile-dots");
    if (dots) dots.style.display = "none";
  }

  function pdfFilename(el) {
    var nameEl = el.querySelector(".fr-rpt-header-copy p");
    var name = nameEl && nameEl.textContent ? nameEl.textContent.trim() : "rankmysalon";
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "rankmysalon"
    );
  }

  function downloadPdf() {
    var el = document.querySelector(".fr-page");
    if (!el) return;
    var btn = document.querySelector("[data-fr-download-pdf]");
    var prevLabel = btn ? btn.textContent : "";

    function finish() {
      setPdfExportMode(false);
      if (btn) {
        btn.disabled = false;
        btn.textContent = prevLabel || "Download PDF";
      }
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Generating PDF…";
    }

    setPdfExportMode(true);

    function runExport() {
      if (!global.html2pdf) {
        finish();
        global.print();
        return;
      }

      global
        .html2pdf()
        .set({
          margin: [10, 10, 14, 10],
          filename: pdfFilename(el) + "-full-report.pdf",
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            scrollY: 0,
            onclone: preparePdfClone,
          },
          pagebreak: {
            mode: ["css", "legacy"],
            before: ".fr-pdf-page-break",
            avoid: [".fr-pdf-group", ".fr-chart-box", ".fr-callout", ".fr-rpt-header"],
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(el)
        .save()
        .then(finish)
        .catch(function (err) {
          console.error("PDF export failed", err);
          finish();
        });
    }

    setTimeout(runExport, 400);
  }

  function bindActions() {
    var btn = document.querySelector("[data-fr-download-pdf]");
    if (btn) btn.addEventListener("click", downloadPdf);
  }

  function mount(container, data, opts) {
    if (!container || !data) return;
    destroyCharts();
    container.innerHTML = renderHtml(data, opts || {});
    bindActions();
    requestAnimationFrame(function () {
      initCharts(data);
      if (opts && typeof opts.onMounted === "function") opts.onMounted();
    });
  }

  global.RmsFullReport = {
    mount: mount,
    destroyCharts: destroyCharts,
    renderHtml: renderHtml,
  };
})(typeof window !== "undefined" ? window : global);
