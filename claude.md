# Project Charter & Operational Guidelines: Claude.md
## E-Commerce Dynamic Price Optimization & Inventory Predictor

This document serves as the single source of truth for design language, architectural standards, data science pipelines, backend services, frontend user experience, and deployment workflows. Consult this guide during all feature development and refactoring.

---

### 1. Project Vision & Architecture

**Goal**: Build an institutional-grade retail operations platform that ingests public retail transaction time-series (M5 Competition & real e-commerce benchmarks), forecasts 30-day SKU demand with quantified uncertainty intervals, flags imminent stockouts, and solves for dynamic price elasticity & optimal markdown timing.

```
┌────────────────────────────────┐
│   Public Retail Transaction    │
│    (M5 / E-Commerce Sales)     │
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐      ┌─────────────────────────────┐
│  Airflow Daily ETL Pipeline    │ ───► │ Feature Engineering Engine  │
│  (Ingestion, Streaming Sim)    │      │ (Lags, Rollings, Holidays)  │
└────────────────────────────────┘      └──────────────┬──────────────┘
                                                       │
                                                       ▼
                                        ┌─────────────────────────────┐
                                        │  Time-Series Model Ensemble │
                                        │  • Classical Baseline (MA)  │
                                        │  • LightGBM Quantile Regs   │
                                        │  • Meta's Prophet Engine    │
                                        └──────────────┬──────────────┘
                                                       │
                                                       ▼
                                        ┌─────────────────────────────┐
                                        │ Dynamic Price & Markdown    │
                                        │ Elasticity Optimizer        │
                                        └──────────────┬──────────────┘
                                                       │
                     ┌─────────────────────────────────┴─────────────────────────────────┐
                     ▼                                                                   ▼
       ┌───────────────────────────┐                                       ┌───────────────────────────┐
       │   Flask REST API Backend  │                                       │ Static Pre-computed JSON  │
       │   (Local & Cloud Deploy)  │                                       │ (GitHub Pages Showcase)   │
       └─────────────┬─────────────┘                                       └─────────────┬─────────────┘
                     │                                                                   │
                     └─────────────────────────────────┬─────────────────────────────────┘
                                                       ▼
                                        ┌─────────────────────────────┐
                                        │   React + Vite Admin UI     │
                                        │   • Shaded Uncertainty Zone │
                                        │   • Stockout Alert Matrix   │
                                        │   • Live Markdown Simulator │
                                        │   • Airflow Pipeline Telemetry
                                        └─────────────────────────────┘
```

---

### 2. Dual-Mode Operation (Local Dev & GitHub Pages Deployment)

To enable this system to be hosted as a **live portfolio project on GitHub Pages without requiring a paid server runtime**, the application implements a strict **Dual-Mode Data Client**:
1. **Live API Mode**: When the Flask server (`http://localhost:5001`) is running, the frontend queries real-time endpoints for on-the-fly model inference, pipeline trigger actions, and dynamic re-computation.
2. **Static Showcase Mode (GitHub Pages)**: When deployed statically or when the Flask server is offline, the frontend seamlessly falls back to pre-computed real-data pipeline artifacts (`demoData.json` / `forecasts.json`) with an in-browser deterministic elasticity simulator.
3. **Status Indicator**: An interactive badge in the header displays current mode (`● Live Flask API` or `○ Static Model Artifacts (GH Pages)`) with a manual override toggle.

---

### 3. Design System & Theming Ground Rules (Clean Enterprise Light Mode)

The visual presentation adheres to high-end enterprise B2B retail operations software standards (e.g., Stripe, Shopify Admin, Flexport, Datadog):
- **Core Directive**: Strict **Light Mode** styling. Avoid generic "AI-looking tropes" such as dark obsidian voids, neon purple hues, glowing borders, or artificial luminescence. Focus on clarity, operational utility, and high information density.
- **Color Palette**:
  - Background (Base Canvas): `#F8FAFC` (Slate-50)
  - Card & Panel Surface: `#FFFFFF` (Pure Crisp White)
  - Subtle Borders: `#E2E8F0` (Slate-200) with hover state `#CBD5E1` (Slate-300)
  - Primary Corporate Accent: `#2563EB` (Enterprise Royal Blue)
  - Primary Hover Accent: `#1D4ED8`
  - Shaded Uncertainty Zone (80% CI): `#EFF6FF` fill with `rgba(37, 99, 235, 0.35)` subtle bounding border
  - Shaded Uncertainty Zone (95% CI): `#F8FAFC` fill with `#CBD5E1` dashed border
  - Stockout Imminent Danger: `#DC2626` (Red-600) on `#FEF2F2` (Red-50) badge background
  - Warning / Excess Holding: `#D97706` (Amber-600) on `#FFFBEB` (Amber-50) badge background
  - Healthy / Growth / Profit Margin: `#059669` (Emerald-600) on `#ECFDF5` (Emerald-50) badge background
  - Text Primary: `#0F172A` (Slate-900, high contrast readability)
  - Text Secondary / Body: `#334155` (Slate-700)
  - Text Muted / Labels: `#64748B` (Slate-500)
  - Text Dim / Monospace Meta: `#94A3B8` (Slate-400)
- **Typography**:
  - Headings & KPI Numerals: `'Plus Jakarta Sans'`, system-ui, sans-serif with tabular figures (`font-variant-numeric: tabular-nums`)
  - Code & SKU IDs: `'JetBrains Mono'`, monospace
- **Clean Shadows & Elevation**:
  - Cards: `box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.02)`
  - Elevated Popovers / Dropdowns: `box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.03)`
  - No radial neon background blurs or glowing box shadows.

---

### 3.1 Repository & Remote Target
- **Remote URL**: `git@github.com:mbgardin/ecommercedash.git`
- **Primary Branch**: `main`
- **Deployment Target**: GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`)

---

### 4. Data Science & Machine Learning Standards

1. **Feature Engineering**:
   - **Lag Features**: $t-7, t-14, t-21, t-28$ (capturing weekly cyclical patterns).
   - **Rolling Window Statistics**: 7-day and 28-day rolling means and standard deviations (capturing short-term momentum and volatility).
   - **Calendar & Event Signals**: Day-of-week (one-hot or circular), month, quarter, weekend indicator, and retail holiday flags (Super Bowl, Labor Day, Black Friday, Cyber Monday, Christmas).
   - **Price Features**: Historical unit price, price ratio to 28-day rolling average price, promotional discount percentage.
2. **Forecasting Models**:
   - **Classical Baseline**: 28-day Seasonal Naive / Moving Average.
   - **LightGBM Quantile Regressors**: Separate models trained on pinball loss ($\alpha = 0.10, 0.50, 0.90$) to generate 80% empirical prediction intervals.
   - **Meta's Prophet**: Additive model with piecewise linear trend, weekly/yearly seasonalities, and holiday effects producing lower (`yhat_lower`) and upper (`yhat_upper`) uncertainty bands.
   - **Model Metrics**: Evaluate across RMSE, MAE, WAPE (Weighted Absolute Percentage Error), and Interval Coverage.
3. **Dynamic Pricing & Markdown Optimization**:
   - **Demand Elasticity Model**: Constant elasticity log-log specification:
     $$\ln(Q) = \alpha + \epsilon \cdot \ln(P) + \beta \cdot X + u$$
     where $\epsilon < 0$ is the price elasticity of demand.
   - **Revenue & Margin Optimization**: Given unit cost $c$ and inventory on hand $I_0$:
     $$\text{Profit}(P) = (P - c) \cdot \min(Q(P), I_0)$$
   - **Stockout & Clearance Logic**: If holding days until obsolescence or season end is less than forecasted inventory runway, compute the optimal markdown percentage to clear target stock without exceeding holding cost penalties.

---

### 5. Backend (Flask) Operations & API Contracts

- **Server Port**: Default `5001` (to avoid macOS AirPlay Receiver conflicts on port 5000).
- **CORS**: Enabled for all origin requests during local development.
- **REST Endpoints**:
  - `GET /api/health` -> System health, active model version, dataset timestamps.
  - `GET /api/skus` -> List all managed SKUs with category, current stock, velocity, and stockout risk score.
  - `GET /api/forecast?sku=<id>&model=<lgbm|prophet|ensemble>` -> 30-day daily forecast array with `date`, `yhat`, `yhat_lower`, `yhat_upper`, and historical actuals.
  - `POST /api/optimize-price` -> Payload: `{ sku, current_price, candidate_markdown_pct, unit_cost, current_stock }`. Returns projected demand, expected revenue delta, margin impact, and clearance runway.
  - `GET /api/stockout-risk` -> Ranked list of SKUs sorted by stockout probability, days of inventory remaining, and reorder urgency.
  - `POST /api/pipeline/trigger` -> Simulates Airflow daily ingestion and feature pipeline run.

---

### 6. Frontend Dashboard Modules & Utilities

1. **Executive KPI Ribbon**:
   - Total Active SKUs, High Stockout Risk Count, 30-Day Projected Revenue, Gross Margin Velocity, Pipeline ETL Status.
2. **Interactive 30-Day Forecast Visualizer**:
   - Historical sales timeline (60 days) + Forecast timeline (30 days).
   - Shaded uncertainty area (prediction interval: 80% & 95% confidence bands).
   - Toggle between LightGBM, Prophet, and Classical Baseline.
3. **High-Risk SKU Stockout Radar**:
   - Filterable by Category (Electronics, Apparel, Groceries, Home Goods).
   - Indicators: Days of Supply Remaining, Daily Burn Rate, Stockout Probability %, Suggested Reorder Quantity.
4. **Dynamic Price Elasticity & Markdown What-If Sandbox**:
   - Interactive Markdown % slider (-50% to +20%).
   - Live real-time demand response curve.
   - Revenue vs Margin Trade-off display.
   - "Apply Markdown" action button with exportable markdown recommendation log.
5. **Airflow Pipeline Telemetry & Data Lineage**:
   - Visual DAG status (Ingestion -> Feature Engineering -> Model Retraining -> Price Optimization).
   - Latest run timestamp, rows processed, simulation step trigger.
6. **Scenario & Supply Chain Delay Planner**:
   - Lead time shock simulator (+7 days supplier delay impact on stockout).
   - Holding cost vs markdown trade-off calculator.

---

### 7. Deployment Protocol (GitHub Pages)

- **Vite Configuration**: Set `base: './'` for agnostic relative asset resolution on `<username>.github.io/<repo-name>/`.
- **Pre-computed Artifacts**: The backend pipeline exports comprehensive datasets to `frontend/src/data/demoData.json` so the static build operates 100% autonomously on GitHub Pages.
- **Build & Preview**:
  ```bash
  cd frontend
  npm run build
  npm run preview
  ```
- **Deployment via GitHub Actions**: Automated workflow in `.github/workflows/deploy.yml` triggers on push to `main`.
