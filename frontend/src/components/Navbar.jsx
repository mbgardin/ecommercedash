import React from 'react';
import { 
  TrendingUp, 
  Layers, 
  RefreshCw 
} from 'lucide-react';

export default function Navbar({ 
  skus, 
  selectedSkuId, 
  onSelectSku, 
  backendOnline, 
  appMode, 
  onToggleMode,
  onTriggerPipeline,
  isTriggering
}) {
  return (
    <header className="header-nav">
      <div className="brand-section">
        <div className="brand-logo-badge">
          <TrendingUp size={20} color="#ffffff" />
        </div>
        <div className="brand-title-wrap">
          <h1>ApexRetail Ops</h1>
          <p>Dynamic Price Optimization & Inventory Predictor</p>
        </div>
      </div>

      <div className="header-controls">
        {/* SKU Selector Quick Jump */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={15} color="#64748b" />
          <select 
            id="sku-selector"
            className="select-control"
            value={selectedSkuId}
            onChange={(e) => onSelectSku(e.target.value)}
          >
            {skus.map((sku) => (
              <option key={sku.sku_id} value={sku.sku_id}>
                {sku.sku_id} — {sku.name} (${sku.base_price?.toFixed(2)})
              </option>
            ))}
          </select>
        </div>

        {/* Dual Mode Connection Badge */}
        <button 
          id="mode-toggle-btn"
          className="mode-toggle-pill"
          onClick={onToggleMode}
          title="Click to toggle between Live Flask API and Static Pre-computed Artifacts"
        >
          <span className={`status-dot ${backendOnline && appMode !== 'static' ? 'online' : 'offline'}`} />
          <span>
            {backendOnline && appMode !== 'static' 
              ? '● Live API (Port 5001)' 
              : '○ Portfolio Showcase (GitHub Pages Mode)'}
          </span>
        </button>

        {/* Trigger Pipeline Button */}
        <button 
          id="pipeline-trigger-btn"
          className="btn-secondary"
          onClick={onTriggerPipeline}
          disabled={isTriggering}
          title="Trigger Airflow daily ETL and model retraining simulation"
        >
          <RefreshCw size={13} className={isTriggering ? 'spin' : ''} />
          <span>{isTriggering ? 'Running ETL...' : 'Run Pipeline'}</span>
        </button>
      </div>
    </header>
  );
}
