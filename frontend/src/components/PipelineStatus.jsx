import React from 'react';
import { 
  GitBranch, 
  CheckCircle2, 
  Clock, 
  Database, 
  Cpu, 
  BarChart3, 
  Play, 
  Layers 
} from 'lucide-react';

export default function PipelineStatus({ 
  summary, 
  onTriggerPipeline, 
  isTriggering 
}) {
  const benchmarks = summary?.model_benchmarks || {};
  const dateHorizon = summary?.date_horizon || {};

  const pipelineStages = [
    { id: 1, name: 'Sales Ingestion', tech: 'Daily Airflow Streamer', status: 'COMPLETED', metric: '4,380 Rows / 365 Days' },
    { id: 2, name: 'Feature Engineering', tech: 'Pandas & NumPy Vectorized', status: 'COMPLETED', metric: '36 Features (Lags, Rollings, Holidays)' },
    { id: 3, name: 'Model Retraining', tech: 'LightGBM + Prophet Ensemble', status: 'COMPLETED', metric: '80% & 95% Quantile Bands' },
    { id: 4, name: 'Price Elasticity', tech: 'Log-Log Ridge Demand Curve', status: 'COMPLETED', metric: 'Profit-Maximizing Markdowns' },
    { id: 5, name: 'Artifact Publishing', tech: 'Flask REST & GitHub Pages', status: 'COMPLETED', metric: 'Zero-Latency JSON Sync' },
  ];

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '22px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <GitBranch size={18} color="#2563eb" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
              Apache Airflow MLOps Pipeline & Benchmark Telemetry
            </h2>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
            Automated daily data orchestration, feature pipeline DAG, and statistical model evaluation.
          </p>
        </div>

        <button
          onClick={onTriggerPipeline}
          disabled={isTriggering}
          className="btn-primary"
          style={{ fontSize: '0.8rem' }}
        >
          <Play size={13} />
          <span>{isTriggering ? 'Executing DAG...' : 'Simulate Daily Airflow Run'}</span>
        </button>
      </div>

      {/* Visual DAG Lineage Stages */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '28px' }}>
        {pipelineStages.map((stage) => (
          <div 
            key={stage.id} 
            className="glass-panel" 
            style={{ 
              padding: '14px', 
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span className="font-mono" style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 700 }}>
                STEP 0{stage.id}
              </span>
              <CheckCircle2 size={13} color="#059669" />
            </div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
              {stage.name}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
              {stage.tech}
            </div>
            <div className="font-mono" style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '6px', borderTop: '1px solid #e2e8f0', paddingTop: '4px' }}>
              {stage.metric}
            </div>
          </div>
        ))}
      </div>

      {/* Model Benchmark Accuracy Matrix */}
      <div>
        <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={15} color="#059669" />
          <span>Out-of-Sample Holdout Benchmark Scorecard (28-Day Backtest)</span>
        </h3>

        <div className="data-table-container">
          <table className="styled-table">
            <thead>
              <tr>
                <th>Model Architecture</th>
                <th>Type</th>
                <th>RMSE (Units)</th>
                <th>MAE (Units)</th>
                <th>WAPE %</th>
                <th>80% Prediction Interval Coverage</th>
                <th>Rank</th>
              </tr>
            </thead>
            <tbody>
              {[
                { key: 'ensemble', name: 'Weighted Ensemble', type: 'LightGBM (55%) + Prophet (35%) + Baseline (10%)', rank: '★ 1st Place (Production Model)' },
                { key: 'lightgbm', name: 'LightGBM Quantile Regressors', type: 'Gradient Boosted Trees (α=0.10, 0.50, 0.90)', rank: '2nd Place (Fastest Inference)' },
                { key: 'prophet', name: 'Meta Prophet', type: 'Additive Piecewise Trend + US Holiday Seasonality', rank: '3rd Place (Strong Long-term Trend)' },
                { key: 'baseline', name: 'Classical Baseline', type: '28-Day Seasonal Moving Average', rank: 'Benchmark Baseline' }
              ].map((m) => {
                const b = benchmarks[m.key] || { avg_rmse: '-', avg_mae: '-', avg_wape_pct: '-', avg_interval_coverage_pct: '-' };
                const isBest = m.key === 'ensemble' || m.key === 'lightgbm';

                return (
                  <tr key={m.key}>
                    <td>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{m.name}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.76rem', color: '#64748b' }}>{m.type}</span>
                    </td>
                    <td>
                      <span className="font-mono" style={{ fontWeight: 600, color: '#0f172a' }}>{b.avg_rmse}</span>
                    </td>
                    <td>
                      <span className="font-mono" style={{ color: '#475569' }}>{b.avg_mae}</span>
                    </td>
                    <td>
                      <span className="font-mono" style={{ fontWeight: 700, color: isBest ? '#059669' : '#475569' }}>
                        {b.avg_wape_pct}%
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '45px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${b.avg_interval_coverage_pct}%`, height: '100%', background: '#2563eb' }} />
                        </div>
                        <span className="font-mono" style={{ fontSize: '0.8rem', color: '#334155' }}>{b.avg_interval_coverage_pct}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge-tag ${m.key === 'ensemble' ? 'success' : 'info'}`}>
                        {m.rank}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
