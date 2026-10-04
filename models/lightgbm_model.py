"""
LightGBM Ensemble Forecaster with Quantile Regressions for Uncertainty Intervals.
Trained on feature-engineered signals:
- Lags (7, 14, 21, 28)
- Rolling stats (7d, 14d, 28d)
- Cyclical calendar & holiday proximity
- Dynamic price elasticity signals
"""

import os
import sys
import numpy as np
import pandas as pd
import lightgbm as lgb
from typing import Dict, Any, List

FEATURE_COLUMNS = [
    "day_of_week", "month", "quarter", "is_weekend",
    "dow_sin", "dow_cos", "month_sin", "month_cos",
    "is_holiday", "days_to_holiday",
    "sales_lag_1", "sales_lag_7", "sales_lag_14", "sales_lag_21", "sales_lag_28",
    "sales_rolling_mean_7", "sales_rolling_std_7",
    "sales_rolling_mean_14", "sales_rolling_std_14",
    "sales_rolling_mean_28", "sales_rolling_std_28",
    "unit_price", "discount_pct", "price_ratio_28d", "margin_rate",
    "momentum_7_28"
]


class LightGBMForecaster:
    """
    LightGBM multi-quantile regressor:
    - median (alpha=0.50)
    - lower bound (alpha=0.10 for 80% CI)
    - upper bound (alpha=0.90 for 80% CI)
    """
    def __init__(self):
        self.models_q50 = {} # Median
        self.models_q10 = {} # Lower bound 80%
        self.models_q90 = {} # Upper bound 80%
        self.feature_importance = {}
        self.latest_feature_cache = {}

    def fit(self, df: pd.DataFrame):
        """Fit quantile LightGBM models per SKU or across SKUs."""
        df = df.copy().sort_values("date")

        for sku_id, sku_df in df.groupby("sku_id"):
            sku_df = sku_df.dropna(subset=FEATURE_COLUMNS + ["sales_units"])
            if len(sku_df) < 30:
                continue

            X = sku_df[FEATURE_COLUMNS].values
            y = sku_df["sales_units"].values

            # Median model (L1/MAE or regression)
            params_base = {
                "verbosity": -1,
                "learning_rate": 0.05,
                "num_leaves": 31,
                "min_child_samples": 8,
                "n_estimators": 120,
                "random_state": 42
            }

            model_50 = lgb.LGBMRegressor(objective="regression_l1", **params_base)
            model_50.fit(X, y)
            self.models_q50[sku_id] = model_50

            # Quantile 10 (Lower bound)
            model_10 = lgb.LGBMRegressor(objective="quantile", alpha=0.10, **params_base)
            model_10.fit(X, y)
            self.models_q10[sku_id] = model_10

            # Quantile 90 (Upper bound)
            model_90 = lgb.LGBMRegressor(objective="quantile", alpha=0.90, **params_base)
            model_90.fit(X, y)
            self.models_q90[sku_id] = model_90

            # Cache feature importance
            importances = model_50.feature_importances_
            top_feats = sorted(zip(FEATURE_COLUMNS, importances), key=lambda x: x[1], reverse=True)[:5]
            self.feature_importance[sku_id] = [{"feature": f, "importance": int(imp)} for f, imp in top_feats]

            # Cache latest feature row for iterative multi-step forecasting
            self.latest_feature_cache[sku_id] = sku_df.iloc[-1].to_dict()

    def predict(self, sku_id: str, forecast_dates: List[pd.Timestamp], future_feature_rows: List[dict] = None) -> Dict[str, Any]:
        """
        Generate recursive or direct 30-day forecast with LightGBM quantile intervals.
        """
        if sku_id not in self.models_q50:
            raise ValueError(f"SKU {sku_id} not trained.")

        model_50 = self.models_q50[sku_id]
        model_10 = self.models_q10[sku_id]
        model_90 = self.models_q90[sku_id]

        latest = self.latest_feature_cache[sku_id]
        recent_sales_buffer = [
            latest.get("sales_lag_28", 20.0),
            latest.get("sales_lag_21", 20.0),
            latest.get("sales_lag_14", 20.0),
            latest.get("sales_lag_7", 20.0),
            latest.get("sales_lag_1", 20.0),
            latest.get("sales_units", 20.0)
        ]

        forecast_points = []
        for i, dt in enumerate(forecast_dates):
            dow = dt.dayofweek
            month = dt.month
            is_weekend = 1 if dow in (5, 6) else 0

            # Construct feature vector for day dt
            feat_dict = {
                "day_of_week": dow,
                "month": month,
                "quarter": dt.quarter,
                "is_weekend": is_weekend,
                "dow_sin": np.sin(2 * np.pi * dow / 7.0),
                "dow_cos": np.cos(2 * np.pi * dow / 7.0),
                "month_sin": np.sin(2 * np.pi * month / 12.0),
                "month_cos": np.cos(2 * np.pi * month / 12.0),
                "is_holiday": 0, # evaluated dynamically or provided
                "days_to_holiday": 15,
                "sales_lag_1": recent_sales_buffer[-1],
                "sales_lag_7": recent_sales_buffer[-7] if len(recent_sales_buffer) >= 7 else recent_sales_buffer[0],
                "sales_lag_14": recent_sales_buffer[-14] if len(recent_sales_buffer) >= 14 else recent_sales_buffer[0],
                "sales_lag_21": recent_sales_buffer[-21] if len(recent_sales_buffer) >= 21 else recent_sales_buffer[0],
                "sales_lag_28": recent_sales_buffer[-28] if len(recent_sales_buffer) >= 28 else recent_sales_buffer[0],
                "sales_rolling_mean_7": float(np.mean(recent_sales_buffer[-7:])),
                "sales_rolling_std_7": float(np.std(recent_sales_buffer[-7:])),
                "sales_rolling_mean_14": float(np.mean(recent_sales_buffer[-14:])),
                "sales_rolling_std_14": float(np.std(recent_sales_buffer[-14:])),
                "sales_rolling_mean_28": float(np.mean(recent_sales_buffer[-28:])),
                "sales_rolling_std_28": float(np.std(recent_sales_buffer[-28:])),
                "unit_price": latest.get("unit_price", 100.0),
                "discount_pct": 0.0,
                "price_ratio_28d": 1.0,
                "margin_rate": latest.get("margin_rate", 0.45),
                "momentum_7_28": float(np.mean(recent_sales_buffer[-7:])) / (float(np.mean(recent_sales_buffer[-28:])) + 1e-4)
            }

            x_vec = np.array([[feat_dict[col] for col in FEATURE_COLUMNS]])
            y_pred_50 = max(0.0, round(float(model_50.predict(x_vec)[0]), 2))
            y_pred_10 = max(0.0, round(float(model_10.predict(x_vec)[0]), 2))
            y_pred_90 = max(y_pred_50, round(float(model_90.predict(x_vec)[0]), 2))
            if y_pred_10 > y_pred_50:
                y_pred_10 = round(y_pred_50 * 0.75, 2)

            # Approximate 95% CI from quantile spread
            spread = (y_pred_90 - y_pred_10)
            y_pred_lower_95 = max(0.0, round(y_pred_50 - 0.75 * spread, 2))
            y_pred_upper_95 = round(y_pred_50 + 0.75 * spread, 2)

            forecast_points.append({
                "date": dt.strftime("%Y-%m-%d"),
                "yhat": y_pred_50,
                "yhat_lower": y_pred_10,
                "yhat_upper": y_pred_90,
                "yhat_lower_95": y_pred_lower_95,
                "yhat_upper_95": y_pred_upper_95,
                "model": "LightGBM Quantile Ensemble"
            })

            # Update recursive buffer
            recent_sales_buffer.append(y_pred_50)

        return {
            "sku_id": sku_id,
            "model_type": "lightgbm",
            "feature_importance": self.feature_importance.get(sku_id, []),
            "forecast": forecast_points
        }
