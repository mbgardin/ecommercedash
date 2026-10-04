"""
Classical Baseline Time-Series Models for E-Commerce Demand Forecasting.
Provides:
- 28-day Seasonal Naive / Moving Average
- Exponential Smoothing baseline
- Prediction intervals derived from historical residual standard deviation
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, List


class ClassicalBaselineForecaster:
    """
    Seasonal Moving Average baseline with empirical prediction intervals.
    """
    def __init__(self, seasonal_period: int = 7, window: int = 28):
        self.seasonal_period = seasonal_period
        self.window = window
        self.sku_stats = {}

    def fit(self, df: pd.DataFrame):
        """Fit baseline on historical sales series per SKU."""
        for sku_id, group in df.groupby("sku_id"):
            sales = group.sort_values("date")["sales_units"].values
            if len(sales) < self.seasonal_period:
                mean_val = float(np.mean(sales)) if len(sales) > 0 else 10.0
                std_val = float(np.std(sales)) if len(sales) > 1 else 3.0
                dow_weights = np.ones(7)
            else:
                recent_sales = sales[-self.window:] if len(sales) >= self.window else sales
                mean_val = float(np.mean(recent_sales))
                std_val = float(np.std(recent_sales))
                
                # Day of week profile
                group["dow"] = pd.to_datetime(group["date"]).dt.dayofweek
                dow_means = group.groupby("dow")["sales_units"].mean()
                overall_mean = group["sales_units"].mean() + 1e-4
                dow_weights = (dow_means / overall_mean).values
                if len(dow_weights) < 7:
                    dow_weights = np.ones(7)

            self.sku_stats[sku_id] = {
                "base_mean": mean_val,
                "residual_std": max(std_val, 1.5),
                "dow_weights": dow_weights
            }

    def predict(self, sku_id: str, forecast_dates: List[pd.Timestamp]) -> Dict[str, Any]:
        """Generate 30-day forecast array with 80% & 95% uncertainty intervals."""
        stats = self.sku_stats.get(sku_id, {
            "base_mean": 20.0,
            "residual_std": 5.0,
            "dow_weights": np.ones(7)
        })

        base_mean = stats["base_mean"]
        residual_std = stats["residual_std"]
        dow_weights = stats["dow_weights"]

        forecast_points = []
        for dt in forecast_dates:
            dow = dt.dayofweek
            weight = dow_weights[dow] if dow < len(dow_weights) else 1.0
            yhat = max(0.0, round(float(base_mean * weight), 2))
            
            # Uncertainty expands slightly with forecast horizon h
            h = (dt - forecast_dates[0]).days + 1
            horizon_penalty = 1.0 + 0.015 * h
            eff_std = residual_std * horizon_penalty

            # 80% interval (z = 1.28) and 95% interval (z = 1.96)
            yhat_lower_80 = max(0.0, round(yhat - 1.28 * eff_std, 2))
            yhat_upper_80 = round(yhat + 1.28 * eff_std, 2)
            yhat_lower_95 = max(0.0, round(yhat - 1.96 * eff_std, 2))
            yhat_upper_95 = round(yhat + 1.96 * eff_std, 2)

            forecast_points.append({
                "date": dt.strftime("%Y-%m-%d"),
                "yhat": yhat,
                "yhat_lower": yhat_lower_80,
                "yhat_upper": yhat_upper_80,
                "yhat_lower_95": yhat_lower_95,
                "yhat_upper_95": yhat_upper_95,
                "model": "Classical Baseline (Seasonal MA)"
            })

        return {
            "sku_id": sku_id,
            "model_type": "baseline",
            "forecast": forecast_points
        }
