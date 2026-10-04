"""
Meta Prophet Time-Series Forecaster.
Fits additive decomposed trend, weekly & yearly seasonality,
and retail holiday effects with uncertainty intervals.
"""

import logging
import numpy as np
import pandas as pd
from typing import Dict, Any, List
from prophet import Prophet

# Suppress Prophet cmdstanpy info logs
logging.getLogger("cmdstanpy").setLevel(logging.WARNING)
logging.getLogger("prophet").setLevel(logging.WARNING)


class ProphetForecaster:
    """
    Wrapper around Meta's Prophet model for retail inventory demand forecasting.
    """
    def __init__(self, interval_width: float = 0.80):
        self.interval_width = interval_width
        self.models = {}

    def fit(self, df: pd.DataFrame):
        """Fit Prophet model for each SKU."""
        df = df.copy()
        df["date"] = pd.to_datetime(df["date"])

        for sku_id, sku_df in df.groupby("sku_id"):
            prophet_df = pd.DataFrame({
                "ds": sku_df["date"],
                "y": sku_df["sales_units"]
            }).sort_values("ds").reset_index(drop=True)

            if len(prophet_df) < 20:
                continue

            # Instantiate Prophet with retail tuned parameters
            m = Prophet(
                interval_width=self.interval_width,
                yearly_seasonality=True,
                weekly_seasonality=True,
                daily_seasonality=False,
                changepoint_prior_scale=0.05,
                seasonality_prior_scale=10.0,
            )
            # Add country holidays
            m.add_country_holidays(country_name="US")
            m.fit(prophet_df)
            self.models[sku_id] = m

    def predict(self, sku_id: str, periods: int = 30) -> Dict[str, Any]:
        """Generate 30-day forecast with confidence intervals."""
        if sku_id not in self.models:
            raise ValueError(f"SKU {sku_id} has not been trained in Prophet model.")

        m = self.models[sku_id]
        future = m.make_future_dataframe(periods=periods, freq="D")
        forecast = m.predict(future)

        # Take only the future 30 days
        future_forecast = forecast.tail(periods)

        forecast_points = []
        for _, row in future_forecast.iterrows():
            yhat = max(0.0, round(float(row["yhat"]), 2))
            yhat_lower = max(0.0, round(float(row["yhat_lower"]), 2))
            yhat_upper = max(yhat, round(float(row["yhat_upper"]), 2))

            # Approximate 95% interval from the 80% interval
            half_width_80 = (yhat_upper - yhat_lower) / 2.0
            yhat_lower_95 = max(0.0, round(yhat - 1.53 * half_width_80, 2))
            yhat_upper_95 = round(yhat + 1.53 * half_width_80, 2)

            forecast_points.append({
                "date": row["ds"].strftime("%Y-%m-%d"),
                "yhat": yhat,
                "yhat_lower": yhat_lower,
                "yhat_upper": yhat_upper,
                "yhat_lower_95": yhat_lower_95,
                "yhat_upper_95": yhat_upper_95,
                "model": "Meta Prophet (Additive Seasonality)"
            })

        return {
            "sku_id": sku_id,
            "model_type": "prophet",
            "forecast": forecast_points
        }
