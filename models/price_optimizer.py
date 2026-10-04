"""
Dynamic Price & Markdown Optimization Engine.
Estimates empirical price elasticity of demand via log-log regression.
Computes profit-maximizing prices, revenue curves, and markdown schedules
for overstocked or slow-moving retail inventory.
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, List
from sklearn.linear_model import Ridge


class DynamicPriceOptimizer:
    """
    Solves for optimal price and markdown percentages based on empirical
    price elasticity and inventory holding cost trade-offs.
    """
    def __init__(self):
        self.sku_elasticity = {}

    def fit_elasticity(self, df: pd.DataFrame):
        """
        Estimate price elasticity using log-log regression:
        ln(Q + 1) = alpha + epsilon * ln(P) + beta_controls
        """
        for sku_id, group in df.groupby("sku_id"):
            group = group[group["unit_price"] > 0].copy()
            if len(group) < 15:
                self.sku_elasticity[sku_id] = -1.5
                continue

            log_q = np.log(group["sales_units"].values + 1.0)
            log_p = np.log(group["unit_price"].values)
            dow = group["day_of_week"].values if "day_of_week" in group else np.zeros(len(group))
            is_hol = group["is_holiday"].values if "is_holiday" in group else np.zeros(len(group))

            # Feature matrix with controls
            X = np.column_stack([
                log_p,
                dow,
                is_hol
            ])

            # Ridge regression to prevent runaway coefficients
            ridge = Ridge(alpha=1.0)
            ridge.fit(X, log_q)
            raw_elasticity = float(ridge.coef_[0])

            # Retail sanity bounds: elasticity typically in [-3.5, -0.4]
            bounded_elasticity = float(np.clip(raw_elasticity, -3.2, -0.6))
            self.sku_elasticity[sku_id] = round(bounded_elasticity, 2)

    def optimize_sku_markdown(
        self,
        sku_id: str,
        current_price: float,
        unit_cost: float,
        current_stock: int,
        base_30d_demand: float,
        holding_cost_annual_pct: float = 0.22,
        user_test_markdown_pct: float = None
    ) -> Dict[str, Any]:
        """
        Simulates demand, revenue, and gross profit across price points (-40% to +20%).
        Computes optimal markdown if inventory runway exceeds 30-day velocity.
        """
        elasticity = self.sku_elasticity.get(sku_id, -1.6)
        base_daily_demand = max(1.0, base_30d_demand / 30.0)

        # Baseline metrics (at 0% markdown / current price)
        daily_holding_cost_per_unit = (unit_cost * holding_cost_annual_pct) / 365.0
        days_of_inventory = current_stock / base_daily_demand if base_daily_demand > 0 else 999.0

        # Sweep candidate discount levels: -40% to +20% (price multipliers 0.60 to 1.20)
        candidate_discounts = np.linspace(-0.40, 0.20, 25) # negative = discount, positive = price hike
        sweep_curve = []
        best_profit = -float("inf")
        best_discount = 0.0

        for disc in candidate_discounts:
            # Price multiplier: discount of 15% means multiplier = 0.85
            # disc < 0 means markdown: price = current_price * (1 + disc)
            p_cand = round(current_price * (1.0 + disc), 2)
            if p_cand <= unit_cost:
                continue # Do not price below unit cost unless hard liquidation

            # Elasticity equation: Q(P) = Q0 * (P / P0) ^ elasticity
            price_ratio = p_cand / current_price
            demand_multiplier = (price_ratio) ** elasticity
            proj_daily_demand = base_daily_demand * demand_multiplier
            proj_30d_demand = proj_daily_demand * 30.0

            # 30-day sold units cannot exceed available stock
            sold_30d = min(float(current_stock), proj_30d_demand)
            remaining_stock = max(0.0, current_stock - sold_30d)

            # Financials
            revenue_30d = round(sold_30d * p_cand, 2)
            cogs_30d = round(sold_30d * unit_cost, 2)
            holding_cost_30d = round(remaining_stock * daily_holding_cost_per_unit * 30.0, 2)
            gross_profit_30d = round(revenue_30d - cogs_30d - holding_cost_30d, 2)
            gross_margin_pct = round(((p_cand - unit_cost) / p_cand) * 100.0, 1)

            sweep_curve.append({
                "discount_pct": round(-disc * 100, 1), # Positive value represents markdown %
                "price": p_cand,
                "projected_30d_demand": round(proj_30d_demand, 1),
                "units_sold_30d": round(sold_30d, 1),
                "remaining_stock": round(remaining_stock, 1),
                "projected_revenue": revenue_30d,
                "gross_profit": gross_profit_30d,
                "gross_margin_pct": gross_margin_pct
            })

            if gross_profit_30d > best_profit:
                best_profit = gross_profit_30d
                best_discount = -disc # Store as positive markdown percentage

        # Status & Recommendation Classification
        is_overstocked = days_of_inventory > 40.0 and current_stock > 150
        is_stockout_risk = days_of_inventory < 12.0

        if is_overstocked:
            rec_action = "OPTIMIZE_CLEARANCE_MARKDOWN"
            rec_text = f"High inventory runway ({round(days_of_inventory)} days). Recommend markdown to accelerate turnover & curtail holding penalties."
            optimal_markdown_pct = max(10.0, round(best_discount * 100, 1))
        elif is_stockout_risk:
            rec_action = "RAISE_PRICE_OR_EXPEDITE_REORDER"
            rec_text = f"Low inventory runway ({round(days_of_inventory, 1)} days). Limit markdowns or raise price to preserve margins and buffer stockout."
            optimal_markdown_pct = 0.0
        else:
            rec_action = "MAINTAIN_CURRENT_PRICE"
            rec_text = "Inventory levels and velocity are in equilibrium. Keep baseline pricing."
            optimal_markdown_pct = max(0.0, round(best_discount * 100, 1))

        # Evaluate specific user test markdown if requested
        user_scenario = None
        if user_test_markdown_pct is not None:
            user_disc_ratio = 1.0 - (user_test_markdown_pct / 100.0)
            user_price = round(current_price * user_disc_ratio, 2)
            user_p_ratio = user_price / current_price
            user_demand = base_daily_demand * (user_p_ratio ** elasticity) * 30.0
            user_sold = min(float(current_stock), user_demand)
            user_rev = round(user_sold * user_price, 2)
            user_profit = round(user_rev - (user_sold * unit_cost) - ((current_stock - user_sold) * daily_holding_cost_per_unit * 30.0), 2)
            
            # Baseline (0% discount)
            base_rev = round(min(float(current_stock), base_30d_demand) * current_price, 2)
            base_profit = round(base_rev - (min(float(current_stock), base_30d_demand) * unit_cost) - ((current_stock - min(float(current_stock), base_30d_demand)) * daily_holding_cost_per_unit * 30.0), 2)

            user_scenario = {
                "test_markdown_pct": user_test_markdown_pct,
                "simulated_price": user_price,
                "projected_30d_demand": round(user_demand, 1),
                "revenue_delta": round(user_rev - base_rev, 2),
                "profit_delta": round(user_profit - base_profit, 2),
                "simulated_revenue": user_rev,
                "simulated_profit": user_profit
            }

        return {
            "sku_id": sku_id,
            "elasticity": elasticity,
            "elasticity_label": "Highly Elastic" if elasticity < -1.5 else "Moderately Elastic",
            "current_price": current_price,
            "unit_cost": unit_cost,
            "current_stock": current_stock,
            "days_of_inventory": round(days_of_inventory, 1),
            "stockout_risk_status": "CRITICAL" if days_of_inventory < 8 else ("WARNING" if days_of_inventory < 15 else "HEALTHY"),
            "recommended_action": rec_action,
            "recommendation_text": rec_text,
            "optimal_markdown_pct": optimal_markdown_pct,
            "optimal_price": round(current_price * (1.0 - (optimal_markdown_pct / 100.0)), 2),
            "sweep_curve": sweep_curve,
            "user_scenario": user_scenario
        }
