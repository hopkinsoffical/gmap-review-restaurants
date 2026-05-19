"""
Google Places API - 新泽西州美甲沙龙数据采集器
获取字段：name, address, total_reviews, rating_score
"""

import googlemaps
import csv
import time
import os
from datetime import datetime

# ============ 配置区域 ============
API_KEY = "AIzaSyAd-J5GUvv9cDPHNTJrEMKoJxoSxQiL_mA"  # 替换为您的 API 密钥

# 新泽西州主要城市（覆盖全州）Tier 2
CITIES = [
    "Newark",
    "Paterson",
    "Elizabeth",
    "Trenton",
    "Camden",
    "Passaic",
    "Union City",
    "West New York",
]


# 每城市最多获取数量（可根据需要调整）
MAX_PER_CITY = 100

# ============ 核心功能函数 ============


def init_gmaps(api_key):
    """初始化 Google Maps 客户端"""
    if not api_key or api_key == "YOUR_GOOGLE_MAPS_API_KEY":
        print("❌ 错误：请先设置您的 API 密钥")
        print("获取方法：https://console.cloud.google.com/")
        return None
    return googlemaps.Client(key=api_key)


def search_nail_salons_detailed(gmaps, city, state="NJ", max_results=80):
    """获取更详细信息的版本"""
    results_list = []
    query = f"nail salon in {city}, {state}"

    try:
        print(f"🔍 搜索 {city}...")

        search_response = gmaps.places(query=query, language="en")

        all_places = []
        current_page = search_response
        page_count = 1

        while len(all_places) < max_results and current_page:
            places = current_page.get("results", [])
            all_places.extend(places)

            if "next_page_token" in current_page and len(all_places) < max_results:
                next_token = current_page["next_page_token"]
                time.sleep(3)
                current_page = gmaps.places(
                    query=query, page_token=next_token, language="en"
                )
                page_count += 1
            else:
                break

        print(f"   找到 {len(all_places)} 个潜在商家")

        for idx, place in enumerate(all_places[:max_results]):
            try:
                place_id = place.get("place_id")
                if not place_id:
                    continue

                # 获取详细信息（包含电话和营业时间）
                details = gmaps.place(
                    place_id=place_id,
                    fields=[
                        "name",
                        "formatted_address",
                        "formatted_phone_number",
                        "rating",
                        "user_ratings_total",
                        "place_id",
                        "business_status",
                        "price_level",
                        "website",
                        "opening_hours",
                    ],
                )

                result = details.get("result", {})
                salon_data = {
                    "name": result.get("name", ""),
                    "address": result.get("formatted_address", ""),
                    "phone": result.get("formatted_phone_number", ""),
                    "rating_score": result.get("rating", 0),
                    "total_reviews": result.get("user_ratings_total", 0),
                    "price_level": result.get("price_level", "N/A"),
                    "business_status": result.get("business_status", ""),
                    "website": result.get("website", ""),
                    "city": city,
                    "place_id": place_id,
                }
                # Keep all salon results from the query, even without phone/rating/reviews.
                results_list.append(salon_data)
                print(
                    f"   ✅ [{len(results_list)}] {salon_data['name'][:30]} - {salon_data['rating_score']}⭐ ({salon_data['total_reviews']} reviews)"
                )

                time.sleep(3)

            except Exception as e:
                print(f"   ⚠️ 详情获取失败: {e}")
                continue

        print(f"   📍 {city} 完成，获得 {len(results_list)} 家有效数据")

    except Exception as e:
        print(f"   ❌ 搜索 {city} 失败: {e}")

    return results_list


def remove_duplicates(salons):
    """基于 place_id 去重"""
    seen = set()
    unique = []
    for salon in salons:
        if salon["place_id"] not in seen:
            seen.add(salon["place_id"])
            unique.append(salon)
    return unique


def save_to_csv(salons, filename=None):
    """保存到CSV文件 - 支持更多字段"""
    if not filename:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"nj_nail_salons_{timestamp}.csv"

    # 检查是否有 phone 字段来决定使用哪个 keys
    if salons and "phone" in salons[0]:
        keys = [
            "name",
            "address",
            "phone",
            "rating_score",
            "total_reviews",
            "price_level",
            "business_status",
            "website",
            "city",
            "place_id",
        ]
    else:
        keys = ["name", "address", "rating_score", "total_reviews", "city", "place_id"]

    try:
        with open(filename, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(salons)

        file_size = os.path.getsize(filename)
        print(f"\n💾 数据已保存: {filename}")
        print(f"   文件大小: {file_size:,} bytes")
        return filename
    except Exception as e:
        print(f"❌ 保存失败: {e}")
        return None


def print_statistics(salons):
    """打印统计信息"""
    if not salons:
        print("无数据可统计")
        return

    total = len(salons)
    avg_rating = sum(s["rating_score"] for s in salons) / total
    avg_reviews = sum(s["total_reviews"] for s in salons) / total
    total_reviews = sum(s["total_reviews"] for s in salons)

    # 评分分布
    rating_dist = {
        "5⭐": sum(1 for s in salons if s["rating_score"] >= 4.8),
        "4-4.8⭐": sum(1 for s in salons if 4.0 <= s["rating_score"] < 4.8),
        "3-4⭐": sum(1 for s in salons if 3.0 <= s["rating_score"] < 4.0),
        "<3⭐": sum(1 for s in salons if s["rating_score"] < 3.0),
    }

    # 按城市统计
    city_counts = {}
    for s in salons:
        city_counts[s["city"]] = city_counts.get(s["city"], 0) + 1

    print("\n" + "=" * 50)
    print("📊 数据统计报告")
    print("=" * 50)
    print(f"🏪 总商家数: {total:,}")
    print(f"⭐ 平均评分: {avg_rating:.2f}/5.0")
    print(f"💬 平均评论数: {avg_reviews:.0f} 条")
    print(f"📝 总评论数: {total_reviews:,} 条")
    print(f"\n📈 评分分布:")
    for range_name, count in rating_dist.items():
        percentage = (count / total) * 100 if total > 0 else 0
        bar = "█" * int(percentage / 2)
        print(f"   {range_name}: {count:4d} 家 ({percentage:5.1f}%) {bar}")

    print(f"\n🏙️ 城市分布 (Top 10):")
    for city, count in sorted(city_counts.items(), key=lambda x: x[1], reverse=True)[
        :10
    ]:
        print(f"   {city:20s}: {count:3d} 家")


# ============ 主程序 ============


def main():
    print("=" * 50)
    print("🚀 新泽西州美甲沙龙数据采集器")
    print("=" * 50)
    print(f"📅 开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"📍 搜索范围: {len(CITIES)} 个城市")
    print(
        f"🔑 API密钥: {'已配置' if API_KEY != 'YOUR_GOOGLE_MAPS_API_KEY' else '未配置'}"
    )
    print("=" * 50 + "\n")

    # 检查API密钥
    if API_KEY == "YOUR_GOOGLE_MAPS_API_KEY":
        print("❌ 请先设置您的 Google Maps API 密钥")
        print("\n如何获取 API 密钥：")
        print("1. 访问 https://console.cloud.google.com/")
        print("2. 创建项目或选择现有项目")
        print("3. 启用 Places API")
        print("4. 创建凭据 → API 密钥")
        print("5. 将密钥复制到脚本中的 API_KEY 变量")
        return

    # 初始化
    gmaps = init_gmaps(API_KEY)
    if not gmaps:
        return

    # 搜索所有城市
    all_salons = []

    for i, city in enumerate(CITIES, 1):
        print(f"\n[{i}/{len(CITIES)}] ", end="")
        salons = search_nail_salons_detailed(gmaps, city)
        all_salons.extend(salons)
        time.sleep(1)  # 城市之间间隔

    # 去重
    print(f"\n🔄 正在去重...")
    unique_salons = remove_duplicates(all_salons)
    duplicates_removed = len(all_salons) - len(unique_salons)
    print(f"   原始数据: {len(all_salons)} 条")
    print(f"   去重后: {len(unique_salons)} 条")
    print(f"   移除重复: {duplicates_removed} 条")

    # 保存数据
    filename = save_to_csv(unique_salons)

    # 统计信息
    print_statistics(unique_salons)

    print(f"\n✅ 完成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"💡 提示: 如需更多数据，可增加 CITIES 列表或 MAX_PER_CITY 值")


# ============ 运行 ============
if __name__ == "__main__":
    main()
