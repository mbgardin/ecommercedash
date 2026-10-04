import React, { useState, useEffect, useMemo } from 'react';
import { 
  Percent, 
  DollarSign, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles, 
  Check, 
  AlertCircle, 
  Calculator 
} from 'lucide-react';
import { simulatePriceScenario } from '../services/api';

export default function PriceOptimizer({ 
  skuId, 
  pricingMeta, 
  forecastData 
}) {
  const [markdownPct, setMarkdownPct] = useState(0);
  const [simulation, setSimulation] = useState(null);
  const [appliedMarkdown, setAppliedMarkdown] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Initialize markdown with optimal recommendation when SKU changes
  useEffect(() => {
    if (pricingMeta) {
      const optimal = pricingMeta.optimal_markdown_pct || 0;
      setMarkdownPct(optimal);
      runSimulation(optimal);
      setAppliedMarkdown(null);
    }
  }, [skuId, pricingMeta]);

  const runSimulation = async (pct) => {
    if (!pricingMeta) return;
    setIsSimulating(true);
    try {
      const res = await simulatePriceScenario({
        sku_id: skuId,
        test_markdown_pct: Number(pct),
        current_price: pricingMeta.current_price,
        unit_cost: pricingMeta.unit_cost,
        current_stock: pricingMeta.current_stock
      });
      setSimulation(res);
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSliderChange = (e) => {
    const val = Number(e.target.value);
    setMarkdownPct(val);
    runSimulation(val);
  };

  const currentPrice = pricingMeta?.current_price || 100.0;
  const unitCost = pricingMeta?.unit_cost || 50.0;
  const elasticity = pricingMeta?.elasticity || -1.65;
  const userScenario = simulation?.user_scenario;
  const sweepCurve = pricingMeta?.sweep_curve || [];

  const simPrice = userScenario ? userScenario.simulated_price : currentPrice;
  const simDemand = userScenario ? userScenario.projected_30d_demand : 0;
  const revDelta = userScenario ? userScenario.revenue_delta : 0;
  const profitDelta = userScenario ? userScenario.profit_delta : 0;

  // Render Mini Demand vs Revenue Curve SVG
  const curveSvg = useMemo(() => {
    if (sweepCurve.length === 0) return null;
    const width = 640;
    const height = 180;
    const padding = { top: 15, right: 25, bottom: 25, left: 45 };

    const maxProfit = Math.max(...sweepCurve.map(c => c.gross_profit));
    const minProfit = Math.min(...sweepCurve.map(c => c.gross_profit));
    const profitRange = (maxProfit - minProfit) || 1;

    const getX = (i) => padding.left + (i / (sweepCurve.length - 1)) * (width - padding.left - padding.right);
    const getY = (val) => padding.top + (height - padding.top - padding.bottom) - ((val - minProfit) / profitRange) * (height - padding.top - padding.bottom);

    const pathPoints = sweepCurve.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(pt.gross_profit)}`).join(' ');

    // Find index of current markdown selection
    let closestIdx = 0;
    let minDiff = 999;
    sweepCurve.forEach((pt, i) => {
      const diff = Math.abs(pt.discount_pct - markdownPct);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    });

    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '180px', overflow: 'visible' }}>
        <path d={pathPoints} fill="none" stroke="#2563eb" strokeWidth="2.2" />
        {/* Fill area under profit curve */}
        <path 
          d={`${pathPoints} L ${getX(sweepCurve.length - 1)} ${height - padding.bottom} L ${getX(0)} ${height - padding.bottom} Z`} 
          fill="rgba(37, 99, 235, 0.08)" 
        />
        {/* Selected Markdown Pointer */}
        <circle 
          cx={getX(closestIdx)} 
          cy={getY(sweepCurve[closestIdx]?.gross_profit || 0)} 
          r="5.5" 
          fill="#2563eb" 
          stroke="#ffffff" 
          strokeWidth="2" 
        />
        <text 
          x={getX(closestIdx)} 
          y={getY(sweepCurve[closestIdx]?.gross_profit || 0) - 10} 
          fill="#0f172a" 
          fontSize="11" 
          textAnchor="middle" 
          fontWeight="700"
          className="font-mono"
        >
          ${sweepCurve[closestIdx]?.gross_profit?.toLocaleString()}
        </text>
        {/* Axis labels */}
        <text x={padding.left} y={height - 6} fill="#64748b" fontSize="10">+20% Price</text>
        <text x={width - padding.right} y={height - 6} fill="#64748b" fontSize="10" textAnchor="end">-40% Markdown</text>
      </svg>
    );
  }, [sweepCurve, markdownPct]);

  return (
    <div className="glass-panel simulator-card">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calculator size={18} color="#2563eb" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
              Dynamic Price Elasticity & Markdown Sandbox
            </h2>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
            Simulate price adjustments against empirical demand elasticity ε = {elasticity} to optimize gross profit and clearance.
          </p>
        </div>

        {/* Optimal Recommendation Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="badge-tag info font-mono">
            {pricingMeta?.elasticity_label || 'Elastic'} (ε = {elasticity})
          </span>
          <button
            onClick={() => {
              const opt = pricingMeta?.optimal_markdown_pct || 0;
              setMarkdownPct(opt);
              runSimulation(opt);
            }}
            className="btn-secondary"
            style={{ fontSize: '0.78rem' }}
          >
            <Sparkles size={13} color="#2563eb" />
            <span>Apply Recommended ({pricingMeta?.optimal_markdown_pct || 0}%)</span>
          </button>
        </div>
      </div>

      {/* Interactive Markdown Slider */}
      <div className="slider-container" style={{ background: '#f8fafc', padding: '18px 20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
            Test Markdown Discount / Price Adjustment
          </span>
          <span className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 700, color: markdownPct > 0 ? '#d97706' : markdownPct < 0 ? '#059669' : '#0f172a' }}>
            {markdownPct > 0 ? `-${markdownPct}% Markdown` : markdownPct < 0 ? `+${Math.abs(markdownPct)}% Price Hike` : '0% (Base Price)'}
          </span>
        </div>

        <input 
          id="markdown-slider"
          type="range"
          min="-20"
          max="40"
          step="2"
          value={markdownPct}
          onChange={handleSliderChange}
          className="range-slider"
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>
          <span>+20% Premium</span>
          <span>0% Base Price</span>
          <span>-20% Promotion</span>
          <span>-40% Clearance Liquidation</span>
        </div>
      </div>

      {/* Real-time What-If Financial Impact Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        {/* Effective Price */}
        <div className="glass-panel" style={{ padding: '16px' }}>
          <span style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Simulated Price</span>
          <div className="font-mono" style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
            ${simPrice.toFixed(2)}
          </div>
          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
            Base: ${currentPrice.toFixed(2)} | Cost: ${unitCost.toFixed(2)}
          </span>
        </div>

        {/* Projected 30-Day Demand */}
        <div className="glass-panel" style={{ padding: '16px' }}>
          <span style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>30d Projected Demand</span>
          <div className="font-mono" style={{ fontSize: '1.35rem', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}>
            {simDemand.toLocaleString()} units
          </div>
          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
            Demand Elasticity response
          </span>
        </div>

        {/* Revenue Impact */}
        <div className="glass-panel" style={{ padding: '16px' }}>
          <span style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Revenue Delta</span>
          <div 
            className="font-mono" 
            style={{ 
              fontSize: '1.35rem', 
              fontWeight: 700, 
              color: revDelta >= 0 ? '#059669' : '#dc2626', 
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {revDelta >= 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
            {revDelta >= 0 ? '+' : ''}${revDelta.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
            Total 30d: ${(userScenario?.simulated_revenue || 0).toLocaleString()}
          </span>
        </div>

        {/* Gross Profit Impact */}
        <div className="glass-panel" style={{ padding: '16px' }}>
          <span style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Gross Profit Delta</span>
          <div 
            className="font-mono" 
            style={{ 
              fontSize: '1.35rem', 
              fontWeight: 700, 
              color: profitDelta >= 0 ? '#059669' : '#dc2626', 
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {profitDelta >= 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
            {profitDelta >= 0 ? '+' : ''}${profitDelta.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
            After holding costs
          </span>
        </div>
      </div>

      {/* Demand & Profit Curve Visualizer */}
      <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
            Profit Optimization Curve: Margin vs Holding Cost Trade-off
          </span>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Optimal Point: {pricingMeta?.optimal_markdown_pct}% Markdown (${pricingMeta?.optimal_price})
          </span>
        </div>
        {curveSvg}
      </div>

      {/* Action Decision Execution */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', paddingTop: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={15} color="#d97706" />
          <span style={{ fontSize: '0.82rem', color: '#475569' }}>
            {pricingMeta?.recommendation_text || 'Pricing equilibrium maintained.'}
          </span>
        </div>

        <button
          id="apply-markdown-btn"
          onClick={() => {
            setAppliedMarkdown({
              skuId,
              markdownPct,
              simPrice,
              timestamp: new Date().toLocaleTimeString()
            });
          }}
          className="btn-primary"
        >
          <Check size={15} />
          <span>Apply {markdownPct}% Markdown to Catalog</span>
        </button>
      </div>

      {/* Confirmation Banner */}
      {appliedMarkdown && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '12px 16px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.82rem', color: '#065f46' }}>
            ✓ Markdown of {appliedMarkdown.markdownPct}% (${appliedMarkdown.simPrice.toFixed(2)}) applied to SKU <strong>{appliedMarkdown.skuId}</strong> at {appliedMarkdown.timestamp}.
          </span>
          <span className="badge-tag success">Campaign Active</span>
        </div>
      )}
    </div>
  );
}
