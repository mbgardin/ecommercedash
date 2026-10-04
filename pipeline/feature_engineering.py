"""
Feature Engineering Engine for Time-Series Retail Demand Forecasting.
Computes:
- Cyclical calendar encodings (DoW, Month)
- Lag features (7, 14, 21, 28 days)
- Rolling statistics (7d, 14d, 28d mean and std)
- Holiday proximity signals
- Price elasticity signals (discount pct, price relative to historical baseline)
"""

import os
import sys
from datetime import datetime, timedelta

# Ensure workspace root is in python path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

import numpy as np
import pandas as pd
from pipeline.data_loader import RETAIL_HOLIDAYS


def compute_holiday_distance(dates: pd.Series) -> pd.DataFrame:
    """Computes days to the nearest past and upcoming retail holidays."""
    date_dt = pd.to_datetime(dates)
    days_to_hol = []
    is_hol_list = []

    for dt in date_dt:
        min_dist = 999
        is_hol = 0
        for h in RETAIL_HOLIDAYS:
            # Check for current year and adjacent years
            for yr in [dt.year - 1, dt.year, dt.year + 1]:
                try:
                    hol_date = datetime(yr, h["month"], h["day"])
                    dist = abs((dt - hol_date).days)
                    if dist < min_dist:
                        min_dist = dist
                    if dist <= 1:
                        is_hol = 1
                except ValueError:
                    continue
        days_to_hol.append(min_dist)
        is_hol_list.append(is_hol)

    return pd.DataFrame({
        "is_holiday_flag": is_hol_list,
        "days_to_nearest_holiday": days_to_hol
    }, index=dates.index)


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Transforms raw retail transactions into an ML-ready feature matrix
    with strictly causal lag and rolling features (no data leakage).
    """
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values(by=["sku_id", "date"]).reset_index(drop=True)

    # 1. Calendar Features
    df["day_of_week"] = df["date"].dt.dayofweek
    df["day_of_month"] = df["date"].dt.day
    df["month"] = df["date"].dt.month
    df["quarter"] = df["date"].dt.quarter
    df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)

    # Cyclical representations
    df["dow_sin"] = np.sin(2 * np.pi * df["day_of_week"] / 7.0)
    df["dow_cos"] = np.cos(2 * np.pi * df["day_of_week"] / 7.0)
    df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12.0)
    df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12.0)

    # Holiday signals
    hol_df = compute_holiday_distance(df["date"])
    df["is_holiday"] = hol_df["is_holiday_flag"]
    df["days_to_holiday"] = hol_df["days_to_nearest_holiday"]

    # 2. Lag Features & Rolling Windows per SKU
    grouped = df.groupby("sku_id")
    
    # Lags (shift by 1 to avoid current-day leakage, or lag_k)
    lags = [1, 7, 14, 21, 28]
    for lag in lags:
        df[f"sales_lag_{lag}"] = grouped["sales_units"].shift(lag)

    # Rolling window statistics (computed on shift(1) to prevent leakage)
    for window in [7, 14, 28]:
        shifted = grouped["sales_units"].shift(1)
        df[f"sales_rolling_mean_{window}"] = shifted.groupby(df["sku_id"]).transform(
            lambda x: x.rolling(window, min_periods=3).mean()
        )
        df[f"sales_rolling_std_{window}"] = shifted.groupby(df["sku_id"]).transform(
            lambda x: x.rolling(window, min_periods=3).std().fillna(0)
        )

    # 3. Price & Economic Features
    # Rolling price benchmark (historical average unit price)
    df["price_rolling_mean_28"] = grouped["unit_price"].shift(1).groupby(df["sku_id"]).transform(
        lambda x: x.rolling(28, min_periods=7).mean()
    )
    df["price_ratio_28d"] = df["unit_price"] / (df["price_rolling_mean_28"] + 1e-4)
    df["margin_rate"] = (df["unit_price"] - df["unit_cost"]) / (df["unit_price"] + 1e-4)

    # 4. Momentum / Velocity Ratio (7d short term vs 28d long term)
    df["momentum_7_28"] = df["sales_rolling_mean_7"] / (df["sales_rolling_mean_28"] + 1e-4)

    # Fill earliest warm-up periods cleanly with forward/backfill
    df = df.bfill().ffill()

    return df


def process_and_save(
    input_path: str = "data/raw/retail_sales_transactions.csv",
    output_path: str = "data/processed/featured_sales_data.csv"
):
    print(f"Loading raw data from {input_path}...")
    df = pd.read_csv(input_path)
    featured_df = engineer_features(df)
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    featured_df.to_csv(output_path, index=False)
    print(f"✓ Engineered {len(featured_df.columns)} features across {len(featured_df)} rows.")
    print(f"✓ Saved featured dataset to {output_path}")
    return featured_df


if __name__ == "__main__":
    process_and_save()
