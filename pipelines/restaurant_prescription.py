"""
Restaurant Service Prescription Engine (Python)
Mirrors restaurant-service-prescription.js

Usage:
  python3 pipelines/restaurant_prescription.py --limit 500 --show 10
"""

import math, os, time, json, argparse
import requests
from restaurant_scoring import (
    score_restaurant, assessment_level, WEIGHTS,
    rating_score, volume_score, sentiment_score, food_safety_score,
    profile_score, service_score, value_score, ops_score, conversion_score,
)

# ─── Service catalogue ─────────────────────────────────────────────────────────

SERVICES = {
    "review_booster": {
        "name":    "AI Review Booster",
        "tagline": "把满意的顾客变成5星好评——全自动。",
        "impacts": {"D2": 40, "D1": 20, "D3": 20},
        "pricing": "¥起 / 年",
        "cta":     "开始获取更多好评 →",
        "path":    "/ai-review-generator.html",
    },
    "sms_booster": {
        "name":    "SMS Review Booster",
        "tagline": "就餐后自动短信跟进，把顾客变成评价者。",
        "impacts": {"D3": 25, "D2": 25, "D9": 10},
        "pricing": "¥起 / 月",
        "cta":     "自动化你的评价跟进 →",
        "path":    "/ai-sms-review-booster.html",
    },
    "front_desk": {
        "name":    "AI Front-Desk Agent",
        "tagline": "7×24 AI电话接待——每个预订都不错过。",
        "impacts": {"D9": 45, "D6": 20},
        "pricing": "¥起 / 年",
        "cta":     "增加AI接待员 →",
        "path":    "/ai-front-desk.html",
    },
    "profile_opt": {
        "name":    "Google Profile Optimization",
        "tagline": "全面优化Google商户资料，在竞争对手前被找到。",
        "impacts": {"D5": 35, "D6": 20, "D8": 15},
        "pricing": "一次性设置",
        "cta":     "优化你的Google资料 →",
        "path":    "/services.html#profile",
    },
    "website": {
        "name":    "Website Design & Conversion",
        "tagline": "高转化餐厅网站，把访客变成到店顾客。",
        "impacts": {"D5": 20, "D9": 35, "D7": 20},
        "pricing": "定制报价",
        "cta":     "获取高转化网站 →",
        "path":    "/conversion-accelerator.html",
    },
    "social_media": {
        "name":    "Social Media Operation",
        "tagline": "持续内容运营，建立本地忠实粉丝群，拉动到店。",
        "impacts": {"D1": 12, "D2": 18, "D7": 25},
        "pricing": "$699–$1,499/月",
        "cta":     "增长社交媒体 →",
        "path":    "/social-media-growth-engine.html",
    },
}

DIM_LABELS = {
    "D1": "星级口碑", "D2": "评价量级", "D3": "情感评分",
    "D4": "食品安全", "D5": "资料完整度", "D6": "服务广度",
    "D7": "价值定位", "D8": "运营活跃", "D9": "转化就绪",
}

WHY_LINES = {
    "review_booster": lambda d: (
        f"评价量级仅 {d['D2']:.0f}分 — 更多评价直接提升排名。" if d["D2"] < 50 else
        f"星级口碑 {d['D1']:.0f}分 — 新5星好评提升 Google 本地排名。" if d["D1"] < 55 else
        "持续新评价让资料保持算法活跃度。"
    ),
    "sms_booster": lambda d: (
        f"情感评分 {d['D3']:.0f}分 — 负面评价较多；SMS跟进在差评扩散前捕获好评。" if d["D3"] < 60 else
        "SMS打开率98%，是最快积累评价速度的方式。"
    ),
    "front_desk": lambda d: (
        f"转化就绪仅 {d['D9']:.0f}分 — 漏接电话=漏失收入。AI接待员全天候响应。" if d["D9"] < 50 else
        "AI前台即时接受预订，让服务宽度得分显著提升。"
    ),
    "profile_opt": lambda d: (
        f"资料完整度 {d['D5']:.0f}分 — 缺少菜单/营业时间/图片，每天损失点击。" if d["D5"] < 70 else
        "完整关键词丰富的资料是本地地图Pack排名第一因素。"
    ),
    "website": lambda d: (
        f"转化就绪 {d['D9']:.0f}分 — 无网站意味着顾客无法在线预订。" if d["D9"] < 55 else
        "优化网站让访客转化率提升3倍。"
    ),
    "social_media": lambda d: (
        f"价值定位 {d['D7']:.0f}分 — 社交内容直接提升品牌感知价值。" if d["D7"] < 50 else
        "活跃社交账号带来20-35%的新客客流。"
    ),
}


# ─── Prescription logic ───────────────────────────────────────────────────────

def prescribe(scored: dict, max_recs: int = 3) -> dict:
    dims = {
        "D1": scored["dim_rating_score"],
        "D2": scored["dim_volume_score"],
        "D3": scored["dim_sentiment_score"],
        "D4": scored["dim_food_safety_score"],
        "D5": scored["dim_profile_score"],
        "D6": scored["dim_service_score"],
        "D7": scored["dim_value_score"],
        "D8": scored["dim_ops_score"],
        "D9": scored["dim_conversion_score"],
    }

    n = scored.get("review_count", 0) or 0
    conf = 1 - math.exp(-n / 80)
    factor = 0.30 + 0.70 * conf

    ranked = []
    for svc_id, svc in SERVICES.items():
        lift_score = 0.0
        total_lift = 0.0
        affected = []

        for dim_key, max_lift in svc["impacts"].items():
            current = dims.get(dim_key, 50)
            gap = max(0.0, 100.0 - current)
            achievable = min(max_lift, gap)
            w = WEIGHTS.get(dim_key, 0)
            lift_score += achievable * w
            total_lift += achievable * w
            if current < 80:
                affected.append({
                    "key":     dim_key,
                    "label":   DIM_LABELS[dim_key],
                    "current": round(current),
                    "lift":    round(min(max_lift, gap)),
                })

        score_lift = round(total_lift * factor * 10) / 10
        affected.sort(key=lambda x: -x["lift"])

        ranked.append({
            **svc,
            "id":           svc_id,
            "lift_score":   lift_score,
            "score_lift":   score_lift,
            "affected_dims": affected[:3],
            "why_line":     WHY_LINES[svc_id](dims),
        })

    ranked.sort(key=lambda x: -x["lift_score"])
    recs = ranked[:max_recs]

    # weakest addressable dim (exclude D4 = food safety, external)
    weak = sorted(
        ((k, v) for k, v in dims.items() if k != "D4"),
        key=lambda x: x[1]
    )[0]

    return {
        "restaurant_score": scored["restaurant_score"],
        "assessment_level": scored.get("assessment_level", "MODERATE"),
        "rating":           scored.get("rating"),
        "review_count":     n,
        "primary_gap": {
            "dim":   weak[0],
            "label": DIM_LABELS[weak[0]],
            "score": round(weak[1]),
        },
        "score_ceiling": min(100, round(
            scored["restaurant_score"] + sum(r["score_lift"] for r in recs)
        )),
        "recommendations": [
            {
                "rank":          i + 1,
                "id":            r["id"],
                "name":          r["name"],
                "tagline":       r["tagline"],
                "why_line":      r["why_line"],
                "pricing":       r["pricing"],
                "cta":           r["cta"],
                "path":          r["path"],
                "score_lift":    r["score_lift"],
                "affected_dims": r["affected_dims"],
            }
            for i, r in enumerate(recs)
        ],
    }


# ─── Fetch + score + prescribe ────────────────────────────────────────────────

def run(limit=500, show=10):
    SUPABASE_URL = os.getenv("SUPABASE_URL", "https://supabase.360ai.link")
    KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
        "eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NjI0MDUyMDAsImV4cCI6MTkyMDE3MTYwMH0."
        "0Scyjnrqt727pMYFEP5n-MBF3OcL2SyDUhgUTSLHLCE")
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}

    # fetch profiles
    profiles, offset, page = [], 0, min(limit, 200)
    print("Fetching profiles …")
    while len(profiles) < limit:
        r = requests.get(f"{SUPABASE_URL}/rest/v1/info_gather_google_profiles",
            headers={**h, "Range-Unit": "items", "Range": f"{offset}-{offset+page-1}"},
            params={"order": "reviews_count.desc"}, timeout=30)
        r.raise_for_status()
        batch = r.json()
        if not batch: break
        profiles.extend(batch)
        if len(batch) < page: break
        offset += page
        time.sleep(0.05)
    profiles = profiles[:limit]

    # DOH lookup
    print("Fetching DOH data …")
    rr = requests.get(f"{SUPABASE_URL}/rest/v1/info_gather_restaurants",
        headers={**h, "Range-Unit": "items", "Range": "0-9999"},
        params={"select": "id,camis,latest_grade,latest_score"}, timeout=60)
    rest_by_camis = {r["camis"]: r for r in rr.json()}

    # score
    print(f"Scoring {len(profiles)} restaurants …")
    results = []
    for p in profiles:
        rest = rest_by_camis.get(p.get("camis"), {})
        scored = score_restaurant(rest, p)
        results.append(scored)

    # cohort percentile → assessment level
    results.sort(key=lambda x: x["restaurant_score"], reverse=True)
    n_total = len(results)
    for i, rec in enumerate(results):
        rec["assessment_level"] = assessment_level(i / max(n_total, 1))

    # prescribe
    for rec in results:
        rec["prescription"] = prescribe(rec, max_recs=3)

    # ── Print report ────────────────────────────────────────────────────────
    print(f"\n{'='*65}")
    print(f"RESTAURANT DIAGNOSTIC + SERVICE PRESCRIPTION REPORT")
    print(f"{'='*65}")
    print(f"Total scored: {n_total:,}  |  Showing top {show} by score\n")

    # service demand heatmap
    svc_demand = {sid: 0 for sid in SERVICES}
    for rec in results:
        for r in rec["prescription"]["recommendations"]:
            svc_demand[r["id"]] += 1
    print("── Service Demand Across All Restaurants ───────────────────")
    for sid, cnt in sorted(svc_demand.items(), key=lambda x: -x[1]):
        bar = "█" * (cnt * 30 // max(svc_demand.values(), default=1))
        print(f"  {SERVICES[sid]['name']:<35} {cnt:>4} ({cnt*100//n_total}%)  {bar}")

    print(f"\n── Top {show} Restaurants: Score + Prescription ───────────────")
    for rec in results[:show]:
        px = rec["prescription"]
        print(f"\n  ★ {rec.get('rating','?')}  {rec['restaurant_score']:>5.1f}pts  "
              f"[{px['assessment_level']}]  reviews={rec['review_count']}  "
              f"grade={rec.get('latest_grade','?')}  "
              f"→ ceiling {px['score_ceiling']}pts if services applied")
        for r in px["recommendations"]:
            dims_str = ", ".join(
                f"{d['label']} {d['current']}→{d['current']+d['lift']}"
                for d in r["affected_dims"]
            )
            print(f"    #{r['rank']} {r['name']:<35} +{r['score_lift']:.1f}pts")
            print(f"       {r['why_line']}")
            if dims_str:
                print(f"       Dims: {dims_str}")

    return results


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--limit", type=int, default=500)
    p.add_argument("--show",  type=int, default=10)
    args = p.parse_args()
    run(limit=args.limit, show=args.show)
