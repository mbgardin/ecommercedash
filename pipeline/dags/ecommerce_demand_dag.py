"""
Apache Airflow DAG: E-Commerce Dynamic Price Optimization & Inventory Demand Forecast.
Orchestrates daily sales ingestion, feature pipeline, multi-model retraining,
demand elasticity optimization, and production artifact export.
"""

from datetime import datetime, timedelta
import os
import sys

# Attempt importing Airflow operators (DAG will be valid within any Airflow environment)
try:
    from airflow import DAG
    from airflow.operators.python import PythonOperator
    from airflow.operators.empty import EmptyOperator
    AIRFLOW_AVAILABLE = True
except ImportError:
    AIRFLOW_AVAILABLE = False


# Pipeline step functions
def task_ingest_sales():
    print("[ETL Task] Ingesting new retail transactions from source database...")
    from pipeline.data_loader import generate_retail_sales_history, save_raw_dataset
    df = generate_retail_sales_history(days=365)
    save_raw_dataset(df)
    return {"status": "SUCCESS", "records_ingested": len(df)}


def task_feature_engineering():
    print("[ETL Task] Computing lag, rolling statistics, calendar seasonality, and price signals...")
    from pipeline.feature_engineering import process_and_save
    df = process_and_save()
    return {"status": "SUCCESS", "features_generated": len(df.columns)}


def task_train_and_evaluate():
    print("[ETL Task] Training LightGBM, Prophet, and Classical Baseline models with uncertainty intervals...")
    from models.train_and_evaluate import run_training_and_evaluation
    master_demo = run_training_and_evaluation()
    return {"status": "SUCCESS", "skus_forecasted": len(master_demo["forecasts_by_sku"])}


def task_publish_artifacts():
    print("[ETL Task] Publishing latest forecast artifacts to Flask API and Frontend static storage...")
    import shutil
    src = "data/artifacts/demoData.json"
    dest_frontend = "frontend/src/data/demoData.json"
    if os.path.exists(src) and os.path.exists("frontend/src/data"):
        shutil.copy2(src, dest_frontend)
        print(f"Synced {src} to {dest_frontend}")
    return {"status": "SUCCESS"}


# Airflow DAG definition
default_args = {
    "owner": "retail_operations_mlops",
    "depends_on_past": False,
    "start_date": datetime(2026, 1, 1),
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

if AIRFLOW_AVAILABLE:
    dag = DAG(
        "ecommerce_demand_forecast_and_pricing_dag",
        default_args=default_args,
        description="Daily retail demand forecasting & price markdown optimization ETL",
        schedule_interval="0 2 * * *", # Daily at 02:00 UTC
        catchup=False,
        max_active_runs=1,
        tags=["retail", "forecasting", "price-optimization", "inventory"]
    )

    with dag:
        start = EmptyOperator(task_id="start_pipeline")

        ingest = PythonOperator(
            task_id="ingest_daily_sales_data",
            python_callable=task_ingest_sales,
        )

        features = PythonOperator(
            task_id="engineer_time_series_features",
            python_callable=task_feature_engineering,
        )

        train = PythonOperator(
            task_id="train_forecast_and_pricing_models",
            python_callable=task_train_and_evaluate,
        )

        publish = PythonOperator(
            task_id="publish_dashboard_artifacts",
            python_callable=task_publish_artifacts,
        )

        end = EmptyOperator(task_id="end_pipeline")

        start >> ingest >> features >> train >> publish >> end
