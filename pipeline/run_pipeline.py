"""
Standalone ETL & Forecasting Pipeline Runner.
Simulates an Airflow DAG run execution locally without requiring
a full Airflow scheduler daemon. Used by the Flask API trigger and manual CLI.
"""

import os
import sys
import time
import json
from datetime import datetime

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from pipeline.data_loader import generate_retail_sales_history, save_raw_dataset
from pipeline.feature_engineering import process_and_save
from models.train_and_evaluate import run_training_and_evaluation


def execute_full_pipeline() -> dict:
    start_time = time.time()
    run_id = f"dag_run_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    print(f"\n[AIRFLOW ETL] Starting execution for DAG Run: {run_id}")

    # Step 1: Ingestion
    print("\n--- [Step 1/4] Ingesting Sales Data ---")
    df_raw = generate_retail_sales_history(days=365)
    save_raw_dataset(df_raw)

    # Step 2: Feature Engineering
    print("\n--- [Step 2/4] Feature Engineering ---")
    df_feat = process_and_save()

    # Step 3: Model Retraining & Forecasting
    print("\n--- [Step 3/4] Retraining Models & Optimizing Markdown Pricing ---")
    master_demo = run_training_and_evaluation()

    # Step 4: Sync to Frontend if present
    print("\n--- [Step 4/4] Syncing Artifacts ---")
    dest_frontend = os.path.join(ROOT_DIR, "frontend", "src", "data", "demoData.json")
    if os.path.exists(os.path.dirname(dest_frontend)):
        with open(dest_frontend, "w") as f:
            json.dump(master_demo, f, indent=2)
        print(f"Synced master demo artifacts to {dest_frontend}")

    elapsed = round(time.time() - start_time, 2)
    result = {
        "run_id": run_id,
        "status": "SUCCESS",
        "duration_seconds": elapsed,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "records_ingested": len(df_raw),
        "features_engineered": len(df_feat.columns),
        "skus_evaluated": len(master_demo["forecasts_by_sku"]),
        "kpis": master_demo["system_summary"]["kpis"]
    }

    # Save run execution log
    log_path = os.path.join(ROOT_DIR, "data", "artifacts", "latest_dag_run.json")
    with open(log_path, "w") as f:
        json.dump(result, f, indent=2)

    print(f"\n[AIRFLOW ETL] Pipeline finished successfully in {elapsed}s.")
    return result


if __name__ == "__main__":
    execute_full_pipeline()
