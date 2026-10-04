import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  BarChart2, 
  AlertOctagon, 
  Sliders, 
  GitBranch, 
  PieChart, 
  Layers, 
  SlidersHorizontal 
} from 'lucide-react';

import Navbar from './components/Navbar';
import KpiRibbon from './components/KpiRibbon';
import ForecastChart from './components/ForecastChart';
import StockoutAlerts from './components/StockoutAlerts';
import PriceOptimizer from './components/PriceOptimizer';
import PipelineStatus from './components/PipelineStatus';
import ScenarioPlanner from './components/ScenarioPlanner';
import InventoryMatrix from './components/InventoryMatrix';

import {
  checkBackendConnection,
  getAppMode,
  setAppMode,
  fetchSystemSummary,
  fetchSkus,
  fetchSkuForecast,
  fetchStockoutRisks,
  fetchPricingOptimization,
  triggerPipelineRun
} from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('forecast'); // 'forecast', 'stockout', 'pricing', 'scenario', 'pipeline', 'category'
  const [backendOnline, setBackendOnline] = useState(false);
  const [appMode, setAppModeState] = useState(getAppMode());

  const [summary, setSummary] = useState(null);
  const [skus, setSkus] = useState([]);
  const [selectedSkuId, setSelectedSkuId] = useState('ELEC-HP-100');
  const [selectedModel, setSelectedModel] = useState('ensemble');

  const [forecastData, setForecastData] = useState(null);
  const [stockoutList, setStockoutList] = useState([]);
  const [pricingMeta, setPricingMeta] = useState(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [pipelineToast, setPipelineToast] = useState(null);

  // Initialize App Data
  useEffect(() => {
    async function init() {
      const isOnline = await checkBackendConnection();
      setBackendOnline(isOnline);

      const [sumRes, skusRes, stockRes] = await Promise.all([
        fetchSystemSummary(),
        fetchSkus(),
        fetchStockoutRisks('ALL')
      ]);

      setSummary(sumRes);
      setSkus(skusRes || []);
      setStockoutList(stockRes || []);

      if (skusRes && skusRes.length > 0) {
        setSelectedSkuId(skusRes[0].sku_id);
      }
    }
    init();
  }, []);

  // Fetch SKU-specific Forecast and Pricing when selection changes
  useEffect(() => {
    if (!selectedSkuId) return;

    async function loadSkuDetails() {
      const [fc, pr] = await Promise.all([
        fetchSkuForecast(selectedSkuId, selectedModel),
        fetchPricingOptimization(selectedSkuId)
      ]);
      setForecastData(fc);
      setPricingMeta(pr);
    }
    loadSkuDetails();
  }, [selectedSkuId, selectedModel]);

  // Mode Toggle (Live API vs Static GH Pages Mode)
  const handleToggleMode = async () => {
    const nextMode = appMode === 'static' ? 'live' : 'static';
    setAppMode(nextMode);
    setAppModeState(nextMode);
    const isOnline = await checkBackendConnection();
    setBackendOnline(isOnline);

    // Refresh active data
    const [sumRes, fc, pr] = await Promise.all([
      fetchSystemSummary(),
      fetchSkuForecast(selectedSkuId, selectedModel),
      fetchPricingOptimization(selectedSkuId)
    ]);
    setSummary(sumRes);
    setForecastData(fc);
    setPricingMeta(pr);
  };

  // Pipeline Run Trigger
  const handleTriggerPipeline = async () => {
    setIsTriggering(true);
    setPipelineToast({ message: 'Airflow daily sales ingestion & model retraining in progress...', type: 'info' });
    try {
      const runRes = await triggerPipelineRun();
      setPipelineToast({ 
        message: `Pipeline completed successfully (${runRes.records_ingested || 4380} sales records processed in ${runRes.duration_seconds}s).`, 
        type: 'success' 
      });

      // Refresh data
      const [sumRes, stockRes, fc, pr] = await Promise.all([
        fetchSystemSummary(),
        fetchStockoutRisks('ALL'),
        fetchSkuForecast(selectedSkuId, selectedModel),
        fetchPricingOptimization(selectedSkuId)
      ]);
      setSummary(sumRes);
      setStockoutList(stockRes || []);
      setForecastData(fc);
      setPricingMeta(pr);
    } catch (err) {
      setPipelineToast({ message: 'Pipeline simulation failed: ' + err.message, type: 'error' });
    } finally {
      setIsTriggering(false);
      setTimeout(() => setPipelineToast(null), 5000);
    }
  };

  const handleOpenPricingSandbox = (skuId) => {
    setSelectedSkuId(skuId);
    setActiveTab('pricing');
  };

  return (
    <div className="app-layout">
      {/* Top Navigation */}
      <Navbar
        skus={skus}
        selectedSkuId={selectedSkuId}
        onSelectSku={setSelectedSkuId}
        backendOnline={backendOnline}
        appMode={appMode}
        onToggleMode={handleToggleMode}
        onTriggerPipeline={handleTriggerPipeline}
        isTriggering={isTriggering}
      />

      {/* Main Workspace */}
      <main className="main-content">
        {/* Pipeline Toast Notification */}
        {pipelineToast && (
          <div 
            style={{ 
              padding: '10px 18px', 
              borderRadius: '8px', 
              background: pipelineToast.type === 'success' ? '#ecfdf5' : '#eff6ff',
              border: `1px solid ${pipelineToast.type === 'success' ? '#a7f3d0' : '#bfdbfe'}`,
              color: pipelineToast.type === 'success' ? '#065f46' : '#1e40af',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}
          >
            <span style={{ fontWeight: 500 }}>{pipelineToast.message}</span>
            <span className="badge-tag info">Pipeline Status</span>
          </div>
        )}

        {/* Executive KPI Ribbon */}
        <KpiRibbon summary={summary} stockoutList={stockoutList} />

        {/* Dashboard Tabs Bar */}
        <div className="tabs-bar">
          <button 
            id="tab-forecast"
            className={`tab-btn ${activeTab === 'forecast' ? 'active' : ''}`}
            onClick={() => setActiveTab('forecast')}
          >
            <BarChart2 size={16} />
            <span>Demand Forecasts & Uncertainty</span>
          </button>

          <button 
            id="tab-pricing"
            className={`tab-btn ${activeTab === 'pricing' ? 'active' : ''}`}
            onClick={() => setActiveTab('pricing')}
          >
            <Sliders size={16} />
            <span>Price Elasticity & Markdowns</span>
          </button>

          <button 
            id="tab-stockout"
            className={`tab-btn ${activeTab === 'stockout' ? 'active' : ''}`}
            onClick={() => setActiveTab('stockout')}
          >
            <AlertOctagon size={16} />
            <span>Stockout Vulnerability Matrix</span>
          </button>

          <button 
            id="tab-scenario"
            className={`tab-btn ${activeTab === 'scenario' ? 'active' : ''}`}
            onClick={() => setActiveTab('scenario')}
          >
            <SlidersHorizontal size={16} />
            <span>Supply Chain Stress-Test</span>
          </button>

          <button 
            id="tab-category"
            className={`tab-btn ${activeTab === 'category' ? 'active' : ''}`}
            onClick={() => setActiveTab('category')}
          >
            <PieChart size={16} />
            <span>Portfolio Working Capital</span>
          </button>

          <button 
            id="tab-pipeline"
            className={`tab-btn ${activeTab === 'pipeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('pipeline')}
          >
            <GitBranch size={16} />
            <span>Airflow ETL & Benchmarks</span>
          </button>
        </div>

        {/* Tab 1: Demand Forecasts & Uncertainty */}
        {activeTab === 'forecast' && (
          <ForecastChart
            forecastData={forecastData}
            selectedModel={selectedModel}
            onChangeModel={setSelectedModel}
          />
        )}

        {/* Tab 2: Dynamic Price Elasticity & Markdowns */}
        {activeTab === 'pricing' && (
          <PriceOptimizer
            skuId={selectedSkuId}
            pricingMeta={pricingMeta}
            forecastData={forecastData}
          />
        )}

        {/* Tab 3: Stockout Vulnerability Matrix */}
        {activeTab === 'stockout' && (
          <StockoutAlerts
            stockoutList={stockoutList}
            onSelectSku={(id) => {
              setSelectedSkuId(id);
              setActiveTab('forecast');
            }}
            onOpenPricingSandbox={handleOpenPricingSandbox}
          />
        )}

        {/* Tab 4: Supply Chain Stress-Test */}
        {activeTab === 'scenario' && (
          <ScenarioPlanner
            stockoutList={stockoutList}
            skus={skus}
          />
        )}

        {/* Tab 5: Portfolio Capital Matrix */}
        {activeTab === 'category' && (
          <InventoryMatrix
            stockoutList={stockoutList}
            skus={skus}
          />
        )}

        {/* Tab 6: Airflow ETL & Benchmarks */}
        {activeTab === 'pipeline' && (
          <PipelineStatus
            summary={summary}
            onTriggerPipeline={handleTriggerPipeline}
            isTriggering={isTriggering}
          />
        )}
      </main>
    </div>
  );
}
