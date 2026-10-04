/**
 * Dual-Mode Data Client
 * Seamlessly supports both Live Flask Backend API (port 5001)
 * and Static Offline / GitHub Pages Mode using pre-computed real-data pipeline artifacts.
 */

import demoData from '../data/demoData.json';

const API_BASE = '/api';

// Cache connection mode: 'auto', 'live', 'static'
let preferredMode = localStorage.getItem('retail_app_mode') || 'auto';
let isBackendReachable = false;

// Probe backend health
export async function checkBackendConnection() {
  if (preferredMode === 'static') {
    isBackendReachable = false;
    return false;
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      isBackendReachable = true;
      return true;
    }
  } catch (err) {
    isBackendReachable = false;
  }
  return false;
}

export function getAppMode() {
  return preferredMode;
}

export function setAppMode(mode) {
  preferredMode = mode;
  localStorage.setItem('retail_app_mode', mode);
}

export function getBackendStatus() {
  return isBackendReachable;
}

// Fetch Portfolio Summary & KPIs
export async function fetchSystemSummary() {
  if (isBackendReachable && preferredMode !== 'static') {
    try {
      const res = await fetch(`${API_BASE}/summary`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend summary request failed, falling back to static dataset.', e);
    }
  }
  return demoData.system_summary;
}

// Fetch All SKUs
export async function fetchSkus() {
  if (isBackendReachable && preferredMode !== 'static') {
    try {
      const res = await fetch(`${API_BASE}/skus`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend SKUs request failed, falling back to static dataset.', e);
    }
  }
  return demoData.system_summary.sku_catalog;
}

// Fetch SKU Forecast with Uncertainty Intervals
export async function fetchSkuForecast(skuId, model = 'ensemble') {
  if (isBackendReachable && preferredMode !== 'static') {
    try {
      const res = await fetch(`${API_BASE}/forecast?sku=${encodeURIComponent(skuId)}&model=${encodeURIComponent(model)}`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend forecast request failed, falling back to static dataset.', e);
    }
  }

  // Fallback to static model artifacts
  const skuData = demoData.forecasts_by_sku[skuId] || Object.values(demoData.forecasts_by_sku)[0];
  const modelKeyMap = {
    ensemble: 'forecast_ensemble',
    lightgbm: 'forecast_lightgbm',
    prophet: 'forecast_prophet',
    baseline: 'forecast_baseline'
  };
  const targetKey = modelKeyMap[model] || 'forecast_ensemble';

  return {
    sku_id: skuData.sku_id,
    product_name: skuData.product_name,
    category: skuData.category,
    unit_price: skuData.unit_price,
    unit_cost: skuData.unit_cost,
    current_stock: skuData.current_stock,
    selected_model: model,
    history: skuData.history,
    forecast: skuData[targetKey],
    all_models: {
      ensemble: skuData.forecast_ensemble,
      lightgbm: skuData.forecast_lightgbm,
      prophet: skuData.forecast_prophet,
      baseline: skuData.forecast_baseline
    },
    summary: skuData.summary
  };
}

// Fetch Stockout Risk Matrix
export async function fetchStockoutRisks(category = 'ALL') {
  if (isBackendReachable && preferredMode !== 'static') {
    try {
      const res = await fetch(`${API_BASE}/stockout-risk?category=${encodeURIComponent(category)}`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend stockout risk failed, falling back to static data.', e);
    }
  }

  let risks = demoData.stockout_risk;
  if (category && category !== 'ALL') {
    risks = risks.filter(r => r.category.toUpperCase() === category.toUpperCase());
  }
  return risks;
}

// Fetch Price & Markdown Optimization for SKU
export async function fetchPricingOptimization(skuId) {
  if (isBackendReachable && preferredMode !== 'static') {
    try {
      const res = await fetch(`${API_BASE}/pricing-optimization?sku=${encodeURIComponent(skuId)}`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend pricing optimization request failed, falling back to static.', e);
    }
  }
  return demoData.pricing_optimizations[skuId] || Object.values(demoData.pricing_optimizations)[0];
}

// Dynamic Price Optimization What-If Simulator
export async function simulatePriceScenario(payload) {
  const { sku_id, test_markdown_pct, current_price, unit_cost, current_stock } = payload;

  if (isBackendReachable && preferredMode !== 'static') {
    try {
      const res = await fetch(`${API_BASE}/optimize-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend optimize-price failed, evaluating client-side.', e);
    }
  }

  // Exact Client-side Elasticity Engine (for 100% fidelity on GitHub Pages!)
  const skuMeta = demoData.pricing_optimizations[sku_id] || { elasticity: -1.65 };
  const elasticity = skuMeta.elasticity || -1.65;
  const skuForecast = demoData.forecasts_by_sku[sku_id];
  const base30dDemand = skuForecast ? skuForecast.summary.total_30d_demand : 600.0;
  const baseDailyDemand = base30dDemand / 30.0;

  const P0 = current_price;
  const C = unit_cost;
  const discRatio = 1.0 - (test_markdown_pct / 100.0);
  const P_sim = Math.round(P0 * discRatio * 100) / 100;
  const priceRatio = P_sim / P0;

  // Q(P) = Q0 * (P / P0) ^ elasticity
  const demandMult = Math.pow(priceRatio, elasticity);
  const sim30dDemand = Math.round(base30dDemand * demandMult * 10) / 10;
  const simDailyDemand = sim30dDemand / 30.0;

  const soldUnits = Math.min(current_stock, sim30dDemand);
  const remainingStock = Math.max(0, current_stock - soldUnits);
  const holdingDailyRate = (C * 0.22) / 365.0;

  const simRevenue = Math.round(soldUnits * P_sim * 100) / 100;
  const simProfit = Math.round((simRevenue - (soldUnits * C) - (remainingStock * holdingDailyRate * 30)) * 100) / 100;

  // Baseline at 0%
  const baseSold = Math.min(current_stock, base30dDemand);
  const baseRevenue = Math.round(baseSold * P0 * 100) / 100;
  const baseProfit = Math.round((baseRevenue - (baseSold * C) - ((current_stock - baseSold) * holdingDailyRate * 30)) * 100) / 100;

  const newDaysRunway = simDailyDemand > 0 ? Math.round((current_stock / simDailyDemand) * 10) / 10 : 999;

  return {
    ...skuMeta,
    user_scenario: {
      test_markdown_pct,
      simulated_price: P_sim,
      projected_30d_demand: sim30dDemand,
      simulated_revenue: simRevenue,
      simulated_profit: simProfit,
      revenue_delta: Math.round((simRevenue - baseRevenue) * 100) / 100,
      profit_delta: Math.round((simProfit - baseProfit) * 100) / 100,
      new_days_of_inventory: newDaysRunway
    }
  };
}

// Trigger Simulated Pipeline Run
export async function triggerPipelineRun() {
  if (isBackendReachable && preferredMode !== 'static') {
    try {
      const res = await fetch(`${API_BASE}/pipeline/trigger`, { method: 'POST' });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend trigger failed, simulating client run.', e);
    }
  }

  // Simulated run for GitHub Pages demo
  await new Promise(r => setTimeout(r, 1600));
  return {
    run_id: `gh_pages_sim_${Date.now()}`,
    status: 'SUCCESS',
    duration_seconds: 1.6,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    records_ingested: 4380,
    features_engineered: 36,
    skus_evaluated: 12,
    mode: 'Client-side Pipeline Simulation (Static Portfolio Mode)'
  };
}
