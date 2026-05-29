from datetime import datetime, timedelta
import logging
from database import db

logger = logging.getLogger("Analytics")

def calculate_user_analytics(user_id: int):
    """
    Fetch all waste records for the user and calculate detailed,
    aggregated statistics for the dashboard.
    """
    logger.info(f"Calculating analytics for user {user_id}")
    
    records = db.get_user_waste_records(user_id)
    
    total_items = len(records)
    
    # Initialize category counters
    categories_count = {
        "plastic": 0,
        "glass": 0,
        "paper": 0,
        "metal": 0,
        "organic": 0
    }
    
    total_carbon_saved = 0.0
    
    for r in records:
        category = r["category"].lower()
        if category in categories_count:
            categories_count[category] += 1
            
        total_carbon_saved += float(r.get("carbon_saved", 0.0))
        
    # Calculate recycling percentage
    # (assuming all uploaded items are recycled/composted correctly in our app context)
    # If total items = 0, default to 0%
    recycling_percentage = 100.0 if total_items > 0 else 0.0
    
    # Build daily waste tracking (last 7 days)
    daily_tracking = {}
    today = datetime.utcnow().date()
    
    # Initialize last 7 days with 0 counts
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        daily_tracking[day_str] = {
            "date": day.strftime("%b %d"),
            "plastic": 0,
            "glass": 0,
            "paper": 0,
            "metal": 0,
            "organic": 0,
            "total": 0
        }
        
    for r in records:
        try:
            created_at_date = datetime.fromisoformat(r["created_at"]).date()
            date_str = created_at_date.strftime("%Y-%m-%d")
            
            if date_str in daily_tracking:
                category = r["category"].lower()
                if category in daily_tracking[date_str]:
                    daily_tracking[date_str][category] += 1
                daily_tracking[date_str]["total"] += 1
        except Exception as e:
            logger.warning(f"Error parsing date in analytics: {e}")
            
    # Convert daily tracking dict to a sorted list
    daily_tracking_list = list(daily_tracking.values())
    
    # Determine Gamification Badge & Rank
    rank = "Eco Starter"
    next_rank = "Waste Warrior"
    points_to_next = 50 - (total_items * 10)
    
    if total_items >= 25:
        rank = "Circular Champion"
        next_rank = "Max Rank Achieved"
        points_to_next = 0
    elif total_items >= 10:
        rank = "Sustainability Sentinel"
        next_rank = "Circular Champion"
        points_to_next = 250 - (total_items * 10)
    elif total_items >= 5:
        rank = "Waste Warrior"
        next_rank = "Sustainability Sentinel"
        points_to_next = 100 - (total_items * 10)
        
    badges = []
    if total_items >= 1:
        badges.append({"id": "badge_first", "name": "Eco Pioneer", "desc": "Logged your first piece of waste", "icon": "Seedling"})
    if categories_count["organic"] >= 3:
        badges.append({"id": "badge_compost", "name": "Compost Master", "desc": "Composted 3+ organic items", "icon": "Sprout"})
    if total_carbon_saved >= 5.0:
        badges.append({"id": "badge_carbon", "name": "Carbon Slasher", "desc": "Saved over 5kg of CO2 emissions", "icon": "CloudLightning"})
    if len(set(cat for cat, count in categories_count.items() if count > 0)) == 5:
        badges.append({"id": "badge_all", "name": "Recycling Maestro", "desc": "Classified waste in all 5 categories", "icon": "Award"})

    return {
        "summary": {
            "total_items": total_items,
            "recycling_percentage": round(recycling_percentage, 1),
            "total_carbon_saved": round(total_carbon_saved, 2),
            "rank": rank,
            "next_rank": next_rank,
            "points_to_next": max(0, points_to_next),
            "total_points": total_items * 10
        },
        "categories_count": categories_count,
        "daily_tracking": daily_tracking_list,
        "badges": badges
    }
