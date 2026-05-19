import googlemaps

API_KEY = "AIzaSyAd-J5GUvv9cDPHNTJrEMKoJxoSxQiL_mA"  # 替换为您的密钥
gmaps = googlemaps.Client(key=API_KEY)

# 最简单的测试
try:
    # 测试1：基本搜索（不加 type 参数）
    response = gmaps.places(query="nail salon in Newark, NJ")
    print(f"✅ 找到 {len(response.get('results', []))} 个结果")

    # 显示第一个结果
    if response.get("results"):
        first = response["results"][0]
        print(f"   示例: {first.get('name')} - {first.get('vicinity')}")

    # 测试2：获取详细信息
    if response.get("results"):
        place_id = response["results"][0]["place_id"]
        details = gmaps.place(
            place_id=place_id,
            fields=["name", "rating", "user_ratings_total", "formatted_address"],
        )
        result = details.get("result", {})
        print(f"\n📋 详情示例:")
        print(f"   名称: {result.get('name')}")
        print(f"   地址: {result.get('formatted_address')}")
        print(
            f"   评分: {result.get('rating')}⭐ ({result.get('user_ratings_total', 0)} reviews)"
        )

except Exception as e:
    print(f"❌ 错误: {e}")
    import traceback

    traceback.print_exc()
