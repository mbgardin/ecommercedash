"""
Data Loader & Retail Transaction Generator for E-Commerce Forecasting.
Simulates public retail competition datasets (M5 / Online Retail) with realistic
price elasticity, calendar seasonality, retail holidays, promotional variations,
and inventory stock-out dynamics.
"""

import json
import os
from datetime import datetime, timedelta
import numpy as np
import pandas as pd

# Define catalog of retail SKUs with economic & supply chain parameters
SKU_CATALOG = [
    {
        "sku_id": "ELEC-HP-100",
        "name": "Apex Wireless Noise-Canceling Headphones",
        "category": "Electronics",
        "base_price": 199.99,
        "cost_price": 95.00,
        "base_daily_demand": 24,
        "elasticity": -1.85,
        "current_stock": 180,
        "lead_time_days": 10,
        "holding_cost_annual_pct": 0.22,
        "description": "Premium over-ear wireless audio with active noise cancellation."
    },
    {
        "sku_id": "ELEC-WATCH-200",
        "name": "Pulse Pro Smart Fitness Watch",
        "category": "Electronics",
        "base_price": 149.50,
        "cost_price": 68.00,
        "base_daily_demand": 32,
        "elasticity": -1.65,
        "current_stock": 210,
        "lead_time_days": 8,
        "holding_cost_annual_pct": 0.20,
        "description": "Continuous heart-rate, GPS tracking, and titanium bezel."
    },
    {
        "sku_id": "ELEC-KEYB-300",
        "name": "Vortex Pro Mechanical Gaming Keyboard",
        "category": "Electronics",
        "base_price": 119.00,
        "cost_price": 48.00,
        "base_daily_demand": 19,
        "elasticity": -1.45,
        "current_stock": 75,
        "lead_time_days": 12,
        "holding_cost_annual_pct": 0.18,
        "description": "Hot-swappable tactile switches with per-key RGB backlighting."
    },
    {
        "sku_id": "APPR-HOOD-400",
        "name": "Highland Heavyweight Cotton Hoodie",
        "category": "Apparel",
        "base_price": 78.00,
        "cost_price": 28.00,
        "base_daily_demand": 45,
        "elasticity": -2.10,
        "current_stock": 140,
        "lead_time_days": 14,
        "holding_cost_annual_pct": 0.25,
        "description": "450 GSM French terry hoodie with relaxed vintage silhouette."
    },
    {
        "sku_id": "APPR-SHOE-500",
        "name": "Strata Carbon Running Trainers",
        "category": "Apparel",
        "base_price": 165.00,
        "cost_price": 62.00,
        "base_daily_demand": 28,
        "elasticity": -1.90,
        "current_stock": 92,
        "lead_time_days": 15,
        "holding_cost_annual_pct": 0.24,
        "description": "Engineered propulsion plate with responsive supercritical foam."
    },
    {
        "sku_id": "APPR-JACK-600",
        "name": "Selvedge Denim Workwear Jacket",
        "category": "Apparel",
        "base_price": 140.00,
        "cost_price": 54.00,
        "base_daily_demand": 14,
        "elasticity": -1.75,
        "current_stock": 580, # Overstocked clearance candidate!
        "lead_time_days": 14,
        "holding_cost_annual_pct": 0.28,
        "description": "14oz Japanese selvedge denim with brass hardware."
    },
    {
        "sku_id": "HOME-ESPR-700",
        "name": "Barista Touch Compact Espresso Machine",
        "category": "Home & Kitchen",
        "base_price": 389.00,
        "cost_price": 185.00,
        "base_daily_demand": 12,
        "elasticity": -1.35,
        "current_stock": 48,
        "lead_time_days": 18,
        "holding_cost_annual_pct": 0.18,
        "description": "Dual PID thermal control with commercial 58mm portafilter."
    },
    {
        "sku_id": "HOME-AIRP-800",
        "name": "AeroPure Smart H13 HEPA Air Purifier",
        "category": "Home & Kitchen",
        "base_price": 129.99,
        "cost_price": 52.00,
        "base_daily_demand": 26,
        "elasticity": -1.50,
        "current_stock": 85,
        "lead_time_days": 10,
        "holding_cost_annual_pct": 0.19,
        "description": "Covers 1,200 sq ft with real-time PM2.5 laser particle sensor."
    },
    {
        "sku_id": "HOME-DESK-900",
        "name": "ErgoFlex Ergonomic Lumbar Mesh Chair",
        "category": "Home & Kitchen",
        "base_price": 299.00,
        "cost_price": 135.00,
        "base_daily_demand": 16,
        "elasticity": -1.60,
        "current_stock": 650, # High inventory holding cost candidate
        "lead_time_days": 21,
        "holding_cost_annual_pct": 0.26,
        "description": "Adaptive dynamic lumbar support with 4D armrests."
    },
    {
        "sku_id": "GROC-COLD-101",
        "name": "Artisan Nitro Cold Brew (12-Pack)",
        "category": "Grocery",
        "base_price": 39.99,
        "cost_price": 16.50,
        "base_daily_demand": 62,
        "elasticity": -1.15,
        "current_stock": 195,
        "lead_time_days": 6,
        "holding_cost_annual_pct": 0.30,
        "description": "Single-origin organic steeped cold brew with micro-bubbles."
    },
    {
        "sku_id": "GROC-MATC-102",
        "name": "Ceremonial Grade Uji Matcha (100g)",
        "category": "Grocery",
        "base_price": 34.00,
        "cost_price": 12.00,
        "base_daily_demand": 41,
        "elasticity": -1.25,
        "current_stock": 160,
        "lead_time_days": 7,
        "holding_cost_annual_pct": 0.22,
        "description": "First-harvest stone-ground Japanese green tea powder."
    },
    {
        "sku_id": "CARE-TOOTH-103",
        "name": "SonicPulse Magnetic Electric Toothbrush",
        "category": "Personal Care",
        "base_price": 69.50,
        "cost_price": 24.00,
        "base_daily_demand": 36,
        "elasticity": -1.30,
        "current_stock": 110,
        "lead_time_days": 9,
        "holding_cost_annual_pct": 0.17,
        "description": "42,000 vibrations per minute with inductive travel charging case."
    }
]

# Major retail calendar events / holidays (month, day, spike multiplier)
RETAIL_HOLIDAYS = [
    {"name": "New Year's Day", "month": 1, "day": 1, "multiplier": 1.25},
    {"name": "Valentine's Day", "month": 2, "day": 14, "multiplier": 1.35},
    {"name": "Spring Sale", "month": 4, "day": 15, "multiplier": 1.20},
    {"name": "Memorial Day", "month": 5, "day": 28, "multiplier": 1.40},
    {"name": "Prime / Summer Days", "month": 7, "day": 12, "multiplier": 1.70},
    {"name": "Labor Day", "month": 9, "day": 4, "multiplier": 1.30},
    {"name": "Halloween", "month": 10, "day": 31, "multiplier": 1.15},
    {"name": "Black Friday", "month": 11, "day": 27, "multiplier": 2.65},
    {"name": "Cyber Monday", "month": 11, "day": 30, "multiplier": 2.30},
    {"name": "Holiday Season Spike", "month": 12, "day": 18, "multiplier": 1.90},
    {"name": "Christmas Eve", "month": 12, "day": 24, "multiplier": 1.50},
    {"name": "Boxing Day", "month": 12, "day": 26, "multiplier": 1.45},
]


def generate_retail_sales_history(
    days: int = 365,
    end_date_str: str = "2026-10-04",
    seed: int = 42
) -> pd.DataFrame:
    """
    Generate realistic multi-SKU retail sales transactions over `days`.
    Includes weekly patterns, price promotions, elasticity response,
    calendar holidays, and ambient noise.
    """
    np.random.seed(seed)
    end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    start_date = end_date - timedelta(days=days - 1)
    
    date_range = [start_date + timedelta(days=i) for i in range(days)]
    records = []

    for sku in SKU_CATALOG:
        sku_id = sku["sku_id"]
        base_price = sku["base_price"]
        base_demand = sku["base_daily_demand"]
        elasticity = sku["elasticity"]

        # Generate intermittent markdown promotions (e.g. 5-10% of days have discounts)
        promo_prob = 0.08
        promo_mask = np.random.binomial(1, promo_prob, size=days)
        discount_levels = np.random.choice([0.10, 0.15, 0.20, 0.25], size=days)

        for i, dt in enumerate(date_range):
            # Calendar day features
            dow = dt.weekday() # 0 = Monday, 6 = Sunday
            is_weekend = 1 if dow in (5, 6) else 0

            # Day-of-week multiplier (Friday/Saturday/Sunday peak for e-commerce)
            dow_multipliers = {0: 0.90, 1: 0.88, 2: 0.92, 3: 0.98, 4: 1.15, 5: 1.28, 6: 1.18}
            dow_mult = dow_multipliers[dow]

            # Monthly seasonality wave
            month = dt.month
            month_mult = 1.0 + 0.12 * np.sin((month - 3) * (2 * np.pi / 12))

            # Holiday multiplier
            holiday_mult = 1.0
            is_holiday = 0
            for hol in RETAIL_HOLIDAYS:
                if hol["month"] == dt.month and abs(hol["day"] - dt.day) <= 1:
                    holiday_mult = max(holiday_mult, hol["multiplier"])
                    is_holiday = 1

            # Price calculation
            if promo_mask[i] == 1:
                discount_pct = discount_levels[i]
                price = round(base_price * (1 - discount_pct), 2)
            else:
                discount_pct = 0.0
                # Slight random price jitter around base price (+/- 2%)
                price = round(base_price * (1 + np.random.uniform(-0.02, 0.02)), 2)

            # Price elasticity response: ln(Q / Q0) = elasticity * ln(P / P0)
            # => Q_price_mult = (price / base_price) ** elasticity
            price_ratio = price / base_price
            price_elasticity_mult = (price_ratio) ** elasticity

            # Expected demand
            expected_demand = (
                base_demand
                * dow_mult
                * month_mult
                * holiday_mult
                * price_elasticity_mult
            )

            # Realized sales with Poisson / Negative Binomial stochastic noise
            sales_units = int(np.random.poisson(max(1.0, expected_demand)))

            revenue = round(sales_units * price, 2)
            cost_of_goods = round(sales_units * sku["cost_price"], 2)
            gross_margin = round(revenue - cost_of_goods, 2)

            records.append({
                "date": dt.strftime("%Y-%m-%d"),
                "sku_id": sku_id,
                "product_name": sku["name"],
                "category": sku["category"],
                "unit_price": price,
                "unit_cost": sku["cost_price"],
                "discount_pct": round(discount_pct * 100, 1),
                "sales_units": sales_units,
                "revenue": revenue,
                "gross_margin": gross_margin,
                "is_weekend": is_weekend,
                "is_holiday": is_holiday,
                "day_of_week": dow,
                "month": month,
            })

    df = pd.DataFrame(records)
    return df


def save_raw_dataset(df: pd.DataFrame, output_path: str = "data/raw/retail_sales_transactions.csv"):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"✓ Saved {len(df)} transaction records to {output_path}")

    # Also save SKU catalog metadata
    catalog_path = "data/raw/sku_catalog.json"
    with open(catalog_path, "w") as f:
        json.dump(SKU_CATALOG, f, indent=2)
    print(f"✓ Saved SKU catalog metadata to {catalog_path}")


if __name__ == "__main__":
    df = generate_retail_sales_history(days=365)
    save_raw_dataset(df)
    print(f"Generated retail sales data across {df['sku_id'].nunique()} SKUs from {df['date'].min()} to {df['date'].max()}.")
