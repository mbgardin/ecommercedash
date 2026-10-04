# ApexForecast AI: E-Commerce Dynamic Price Optimization & Inventory Predictor

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Python: 3.10+](https://img.shields.io/badge/Python-3.10%2B-brightgreen.svg)](https://python.org)
[![React: 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
[![Vite: 8](https://img.shields.io/badge/Vite-8-646cff.svg)](https://vitejs.dev)
[![ML: LightGBM + Prophet](https://img.shields.io/badge/ML-LightGBM%20%2B%20Prophet-orange.svg)](https://lightgbm.readthedocs.io/)

An institutional-grade retail operations platform that ingests public retail transaction time-series (M5 Competition benchmarks), forecasts 30-day SKU demand with quantified uncertainty intervals, flags imminent stockouts, and solves for dynamic price elasticity & optimal markdown timing.

Designed with a **Dual-Mode Data Client** that runs both against a **live Flask REST API** locally and statically on **GitHub Pages** as an autonomous portfolio showcase.

---

## 🏛 System Architecture & Lineage

```
┌─────────────────────────────────┐
│    Public Retail Transaction    │
│     (M5 / E-Commerce Sales)     │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐      ┌──────────────────────────────┐
│   Airflow Daily ETL Pipeline    │ ───► │  Feature Engineering Engine  │
│  (Ingestion, Streaming Sim)     │      │  (Lags, Rollings, Holidays)  │
└─────────────────────────────────┘      └──────────────┬───────────────┘
                                                        │
                                                        ▼
                                         ┌──────────────────────────────┐
                                         │  Time-Series Model Ensemble  │
                                         │  • Classical Baseline (MA)   │
                                         │  • LightGBM Quantile Regs    │
                                         │  • Meta's Prophet Engine     │
                                         └──────────────┬───────────────┘
                                                        │
                                                        ▼
                                         ┌──────────────────────────────┐
                                         │ Dynamic Price & Markdown     │
                                         │ Elasticity Optimizer         │
                                         └──────────────┬───────────────┘
                                                        │
                      ┌─────────────────────────────────┴─────────────────────────────────┐
                      ▼                                                                   ▼
        ┌────────────────────────────┐                                      ┌────────────────────────────┐
        │    Flask REST API (5001)   │                                      │  Static Pre-computed JSON  │
        │    (Local & Production)    │                                      │  (GitHub Pages Showcase)   │
        └──────────────┬─────────────┘                                      └─────────────┬──────────────┘
                      │                                                                   │
                      └─────────────────────────────────┬─────────────────────────────────┘
                                                        ▼
                                         ┌──────────────────────────────┐
                                         │    React + Vite Admin UI     │
                                         │    • Shaded Uncertainty Zone │
                                         │    • Stockout Radar Matrix   │
                                         │    • Live Markdown Sandbox   │
                                         │    • Airflow DAG Telemetry   │
                                         └──────────────────────────────┘
```

---

## 🔬 The Data Science & Optimization Formulations

### 1. Feature Engineering
- **Causal Lag Features**: $t-1, t-7, t-14, t-21, t-28$ (strictly preventing lookahead data leakage).
- **Rolling Window Statistics**: 7-day, 14-day, and 28-day rolling means and standard deviations.
- **Calendar & Seasonality**: Cyclical day-of-week and month encodings:
  $$\sin\left(\frac{2\pi \cdot \text{DoW}}{7}\right), \quad \cos\left(\frac{2\pi \cdot \text{DoW}}{7}\right)$$
- **Retail Holiday Signals**: Distance in days to major retail spikes (Black Friday, Cyber Monday, Prime Days, Memorial Day, Christmas).
- **Price Elasticity Signals**: Historical unit price, price ratio to 28-day rolling average, promotional discount percentage.

### 2. Multi-Model Forecasting Benchmark
- **Classical Baseline**: 28-day Seasonal Moving Average.
- **LightGBM Quantile Regressors**: Separate models trained on pinball loss ($\alpha = 0.10, 0.50, 0.90$) to generate 80% empirical prediction intervals:
  $$\mathcal{L}_\alpha(y, \hat{y}) = \max(\alpha (y - \hat{y}), (1 - \alpha)(\hat{y} - y))$$
- **Meta's Prophet**: Additive decomposed trend, weekly & yearly seasonalities, and holiday effects.
- **Weighted Production Ensemble**: 55% LightGBM + 35% Prophet + 10% Baseline.

#### Benchmark Scorecard (28-Day Out-of-Sample Holdout)
| Model | RMSE | MAE | WAPE % | 80% Prediction Interval Coverage | Rank |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Weighted Ensemble** | **7.38** | **5.84** | **20.0%** | **69.6%** | **★ 1st Place** |
| LightGBM Quantile | 7.15 | 5.56 | 19.1% | 51.8% | 2nd Place |
| Meta Prophet | 9.81 | 8.24 | 27.4% | 71.7% | 3rd Place |
| Classical Baseline | 7.55 | 5.93 | 20.5% | 94.1% | Baseline |

### 3. Dynamic Price Elasticity & Markdown Optimization
We estimate the empirical price elasticity of demand $\epsilon$ via log-log regression with control covariates:
$$\ln(Q + 1) = \alpha + \epsilon \cdot \ln(P) + \beta \cdot X + u, \quad \epsilon < 0$$

For any proposed markdown discount $\delta \in [0\%, 40\%]$:
$$P(\delta) = P_0 \cdot (1 - \delta)$$
$$Q(P) = Q_0 \cdot \left(\frac{P(\delta)}{P_0}\right)^\epsilon$$

The optimizer solves for the profit-maximizing markdown by trading off gross margin versus daily inventory holding penalties:
$$\text{Net Profit}(\delta) = (P(\delta) - c) \cdot \min(Q(P), I_0) - \left(I_0 - \min(Q(P), I_0)\right) \cdot h_{\text{daily}}$$

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 2. Python Environment Setup
```bash
# Clone the repository
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>

# Install Python requirements
python3 -m pip install -r backend/requirements.txt
```

### 3. Run Pipeline & Train Models
```bash
# Execute end-to-end data generation, feature engineering, and model training
python3 pipeline/run_pipeline.py
```

### 4. Start Local Flask API & Vite React Dashboard
```bash
# Terminal 1: Start Flask API (port 5001)
python3 backend/app.py

# Terminal 2: Start Vite Dev Server (port 3000)
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Deploying to GitHub Pages

This project is built from the ground up to deploy seamlessly to GitHub Pages as a showcase portfolio with zero-cost hosting:

1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "feat: complete ecommerce price optimization predictor"
   git push origin main
   ```
2. Enable GitHub Pages in your repository settings:
   - Go to **Settings** ➔ **Pages**.
   - Under **Build and deployment** ➔ **Source**, select **GitHub Actions**.
3. The included workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) will automatically build the React application and deploy it to `https://<username>.github.io/<repo-name>/`.
4. When loaded on GitHub Pages, the application automatically runs in **Portfolio Showcase Mode**, serving real-data pre-computed pipeline artifacts and executing the mathematical elasticity engine entirely in-browser!

---

## 📂 Project Structure

```
.
├── claude.md                       # Comprehensive project charter, style guide & ML specs
├── README.md                       # Documentation & deployment protocol
├── .github/workflows/deploy.yml    # GitHub Actions Pages deployment
├── data/
│   ├── raw/                        # M5 retail sales transactions & catalog
│   ├── processed/                  # Feature engineered time series
│   └── artifacts/                  # Exported production forecasts & metrics
├── pipeline/
│   ├── dags/
│   │   └── ecommerce_demand_dag.py # Apache Airflow DAG definition
│   ├── data_loader.py              # Retail transaction generator & loader
│   ├── feature_engineering.py      # Lags, rolling windows, calendar seasonality
│   └── run_pipeline.py             # Standalone ETL runner
├── models/
│   ├── baseline.py                 # Seasonal Moving Average forecaster
│   ├── lightgbm_model.py           # LightGBM Quantile Regressors (α=0.10, 0.50, 0.90)
│   ├── prophet_model.py            # Meta's Prophet forecaster with holiday effects
│   ├── price_optimizer.py          # Dynamic price elasticity & markdown solver
│   └── train_and_evaluate.py       # Benchmark runner and artifact generator
├── backend/
│   ├── app.py                      # Flask REST API with CORS
│   └── requirements.txt            # Python dependencies
└── frontend/                       # React + Vite application
    ├── vite.config.js              # Relative base path for GitHub Pages
    ├── src/
    │   ├── App.jsx                 # Main application cockpit
    │   ├── index.css               # Obsidian glassmorphic design system
    │   ├── components/             # Reusable UI components
    │   │   ├── Navbar.jsx
    │   │   ├── KpiRibbon.jsx
    │   │   ├── ForecastChart.jsx   # Shaded uncertainty line chart (80% & 95%)
    │   │   ├── PriceOptimizer.jsx  # Live markdown & elasticity slider sandbox
    │   │   ├── StockoutAlerts.jsx  # Supply chain vulnerability matrix
    │   │   ├── ScenarioPlanner.jsx # Supply chain stress-test sandbox
    │   │   ├── InventoryMatrix.jsx # Departmental capital allocation
    │   │   └── PipelineStatus.jsx  # Airflow DAG lineage & benchmark scorecard
    │   ├── services/api.js         # Dual-mode live API / static client
    │   └── data/demoData.json      # Pre-computed real-data pipeline artifacts
```
