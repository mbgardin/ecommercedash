"""
Flask REST API Backend for E-Commerce Dynamic Price Optimization & Inventory Predictor.
Serves:
- Portfolio system summary and KPIs
- SKU catalog and metadata
- 30-day demand forecasts with 80% & 95% uncertainty intervals (Classical, LightGBM, Prophet, Ensemble)
- Ranked stockout risks with reorder points and safety stock
- Dynamic price elasticity & Markdown what-if simulations
- Pipeline execution triggers
"""

import json
import os
import sys
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from models.price_optimizer import DynamicPriceOptimizer

app = Flask(__name__)
# Enable CORS for frontend local development
CORS(app, resources={r"/api/*": {"origins": "*"}})

ARTIFACTS_DIR = os.path.join(ROOT_DIR, "data", "artifacts")


def load_artifact(filename: str):
    path = os.path.join(ARTIFACTS_DIR, filename)
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return None


@app.route("/api/health", methods=["GET"])
def health_check():
    summary = load_artifact("system_summary.json")
    return jsonify({
        "status": "healthy",
        "service": "retail-demand-forecast-pricing-api",
        "timestamp": datetime.now().isoformat(),
        "model_engine": "LightGBM + Prophet + Classical Ensemble",
        "last_pipeline_run": summary.get("generated_at") if summary else "Unknown"
    })


@app.route("/api/summary", methods=["GET"])
def get_summary():
    summary = load_artifact("system_summary.json")
    if not summary:
        return jsonify({"error": "Artifacts not generated yet. Run pipeline first."}), 503
    return jsonify(summary)


@app.route("/api/skus", methods=["GET"])
def get_skus():
    catalog_path = os.path.join(ROOT_DIR, "data", "raw", "sku_catalog.json")
    if os.path.exists(catalog_path):
        with open(catalog_path, "r") as f:
            catalog = json.load(f)
        return jsonify(catalog)
    summary = load_artifact("system_summary.json")
    if summary and "sku_catalog" in summary:
        return jsonify(summary["sku_catalog"])
    return jsonify([])


@app.route("/api/forecast", methods=["GET"])
def get_forecast():
    """
    Query parameters:
    - sku: SKU ID (required)
    - model: 'ensemble' (default), 'lightgbm', 'prophet', 'baseline'
    """
    sku_id = request.args.get("sku")
    model_type = request.args.get("model", "ensemble").lower()

    if not sku_id:
        return jsonify({"error": "sku parameter is required"}), 400

    forecasts = load_artifact("forecasts_by_sku.json")
    if not forecasts or sku_id not in forecasts:
        return jsonify({"error": f"SKU '{sku_id}' not found in forecasts."}), 404

    sku_data = forecasts[sku_id]
    
    # Select active forecast series
    model_key_map = {
        "ensemble": "forecast_ensemble",
        "lightgbm": "forecast_lightgbm",
        "prophet": "forecast_prophet",
        "baseline": "forecast_baseline"
    }
    target_key = model_key_map.get(model_type, "forecast_ensemble")

    response = {
        "sku_id": sku_id,
        "product_name": sku_data["product_name"],
        "category": sku_data["category"],
        "unit_price": sku_data["unit_price"],
        "unit_cost": sku_data["unit_cost"],
        "current_stock": sku_data["current_stock"],
        "selected_model": model_type,
        "history": sku_data["history"],
        "forecast": sku_data[target_key],
        "all_models": {
            "ensemble": sku_data["forecast_ensemble"],
            "lightgbm": sku_data["forecast_lightgbm"],
            "prophet": sku_data["forecast_prophet"],
            "baseline": sku_data["forecast_baseline"]
        },
        "summary": sku_data["summary"]
    }
    return jsonify(response)


@app.route("/api/stockout-risk", methods=["GET"])
def get_stockout_risk():
    category = request.args.get("category", "ALL").upper()
    stockout_list = load_artifact("stockout_risk.json")
    if not stockout_list:
        return jsonify([])

    if category != "ALL":
        stockout_list = [s for s in stockout_list if s["category"].upper() == category]

    return jsonify(stockout_list)


@app.route("/api/pricing-optimization", methods=["GET"])
def get_pricing_optimization():
    sku_id = request.args.get("sku")
    pricing_data = load_artifact("pricing_optimizations.json")
    if not pricing_data:
        return jsonify({"error": "Pricing optimization data not ready."}), 503

    if sku_id:
        if sku_id in pricing_data:
            return jsonify(pricing_data[sku_id])
        return jsonify({"error": f"SKU {sku_id} not found."}), 404

    return jsonify(pricing_data)


@app.route("/api/optimize-price", methods=["POST"])
def simulate_price_optimization():
    """
    Simulates dynamic price elasticity response for what-if scenarios.
    Payload:
    {
      "sku_id": "ELEC-HP-100",
      "test_markdown_pct": 15.0, # e.g. 15% markdown
      "current_price": 199.99,
      "unit_cost": 95.0,
      "current_stock": 180
    }
    """
    data = request.get_json() or {}
    sku_id = data.get("sku_id")
    test_markdown_pct = float(data.get("test_markdown_pct", 0.0))

    pricing_data = load_artifact("pricing_optimizations.json")
    forecasts = load_artifact("forecasts_by_sku.json")

    base_demand = 600.0
    current_price = float(data.get("current_price", 100.0))
    unit_cost = float(data.get("unit_cost", 50.0))
    current_stock = int(data.get("current_stock", 200))

    if forecasts and sku_id in forecasts:
        base_demand = forecasts[sku_id]["summary"]["total_30d_demand"]
        current_price = forecasts[sku_id]["unit_price"]
        unit_cost = forecasts[sku_id]["unit_cost"]
        current_stock = forecasts[sku_id]["current_stock"]

    optimizer = DynamicPriceOptimizer()
    if pricing_data and sku_id in pricing_data:
        optimizer.sku_elasticity[sku_id] = pricing_data[sku_id]["elasticity"]
    else:
        optimizer.sku_elasticity[sku_id] = -1.65

    result = optimizer.optimize_sku_markdown(
        sku_id=sku_id or "CUSTOM-SKU",
        current_price=current_price,
        unit_cost=unit_cost,
        current_stock=current_stock,
        base_30d_demand=base_demand,
        user_test_markdown_pct=test_markdown_pct
    )

    return jsonify(result)


@app.route("/api/pipeline/trigger", methods=["POST"])
def trigger_pipeline():
    """
    Trigger standalone ETL pipeline simulation.
    """
    from pipeline.run_pipeline import execute_full_pipeline
    try:
        run_res = execute_full_pipeline()
        return jsonify(run_res)
    except Exception as e:
        return jsonify({"status": "FAILED", "error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    print(f"Starting Flask API Server on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
