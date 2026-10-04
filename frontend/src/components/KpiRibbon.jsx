import React from 'react';
import { 
  DollarSign, 
  AlertTriangle, 
  Package, 
  Archive, 
  ShieldCheck 
} from 'lucide-react';

export default function KpiRibbon({ summary, stockoutList }) {
  const kpis = summary?.kpis || {};
  const benchmarks = summary?.model_benchmarks || {};
  const ensembleBenchmark = benchmarks?.ensemble || { avg_wape_pct: 20.0, avg_rmse: 7.38 };

  const criticalCount = stockoutList.filter(s => s.risk_tier === 'CRITICAL' || s.risk_tier === 'HIGH').length;
  const overstockedCount = stockoutList.filter(s => s.risk_tier === 'OVERSTOCKED').length;

  return (
    <div className="kpi-grid">
      {/* 30-Day Projected Revenue */}
      <div className="glass-panel kpi-card">
        <div className="kpi-header">
          <span>Projected 30-Day Revenue</span>
          <DollarSign size={16} color="#2563eb" />
        </div>
        <div className="kpi-value font-mono">
          ${kpis.projected_30d_revenue?.toLocaleString() || '342,850'}
        </div>
        <div className="kpi-subtext">
          <span className="badge-tag success">Active</span>
          <span>across {kpis.total_skus || 12} SKUs</span>
        </div>
      </div>

      {/* Imminent Stockout Danger */}
      <div className={`glass-panel kpi-card ${criticalCount > 0 ? 'critical' : ''}`}>
        <div className="kpi-header">
          <span>Stockout Risk Items</span>
          <AlertTriangle size={16} color="#dc2626" />
        </div>
        <div className="kpi-value font-mono" style={{ color: criticalCount > 0 ? '#dc2626' : '#0f172a' }}>
          {criticalCount} <span style={{ fontSize: '0.95rem', fontWeight: 500, color: '#64748b' }}>SKUs</span>
        </div>
        <div className="kpi-subtext">
          <span className="badge-tag critical">Action Required</span>
          <span>Runway &lt; Lead Time</span>
        </div>
      </div>

      {/* Overstocked / Markdown Candidates */}
      <div className={`glass-panel kpi-card ${overstockedCount > 0 ? 'warning' : ''}`}>
        <div className="kpi-header">
          <span>Markdown Candidates</span>
          <Archive size={16} color="#d97706" />
        </div>
        <div className="kpi-value font-mono" style={{ color: overstockedCount > 0 ? '#d97706' : '#0f172a' }}>
          {overstockedCount} <span style={{ fontSize: '0.95rem', fontWeight: 500, color: '#64748b' }}>SKUs</span>
        </div>
        <div className="kpi-subtext">
          <span className="badge-tag warning">Excess Inventory</span>
          <span>Runway &gt; 40 days</span>
        </div>
      </div>

      {/* Model Benchmark Accuracy */}
      <div className="glass-panel kpi-card">
        <div className="kpi-header">
          <span>Forecast Model Accuracy</span>
          <ShieldCheck size={16} color="#059669" />
        </div>
        <div className="kpi-value font-mono" style={{ color: '#059669' }}>
          {ensembleBenchmark.avg_wape_pct}% <span style={{ fontSize: '0.95rem', fontWeight: 500, color: '#64748b' }}>WAPE</span>
        </div>
        <div className="kpi-subtext">
          <span className="badge-tag info">LightGBM + Prophet</span>
          <span>RMSE: {ensembleBenchmark.avg_rmse} units</span>
        </div>
      </div>
    </div>
  );
}
