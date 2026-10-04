import React, { useState } from 'react';
import { 
  SlidersHorizontal, 
  AlertTriangle, 
  Truck, 
  Flame, 
  Download, 
  RotateCcw, 
  DollarSign 
} from 'lucide-react';

export default function ScenarioPlanner({ stockoutList, skus }) {
  const [leadTimeShockDays, setLeadTimeShockDays] = useState(0);
  const [demandMultiplierPct, setDemandMultiplierPct] = useState(0);
  const [holdingCostMultiplierPct, setHoldingCostMultiplierPct] = useState(0);

  // Recalculate scenario metrics
  const simulatedList = stockoutList.map((item) => {
    const adjustedLeadTime = item.lead_time_days + leadTimeShockDays;
    const adjustedBurnRate = Math.round(item.daily_burn_rate * (1 + demandMultiplierPct / 100) * 10) / 10;
    const adjustedDaysSupply = adjustedBurnRate > 0 ? Math.round((item.current_stock / adjustedBurnRate) * 10) / 10 : 999;

    let adjustedRisk = 'HEALTHY';
    if (adjustedDaysSupply <= adjustedLeadTime) {
      adjustedRisk = 'CRITICAL';
    } else if (adjustedDaysSupply <= adjustedLeadTime * 1.5) {
      adjustedRisk = 'HIGH';
    } else if (adjustedDaysSupply > 45) {
      adjustedRisk = 'OVERSTOCKED';
    }

    const reorderPoint = Math.round(adjustedBurnRate * adjustedLeadTime + item.safety_stock_units);
    const suggestedPO = Math.max(0, reorderPoint - item.current_stock);

    return {
      ...item,
      adjustedLeadTime,
      adjustedBurnRate,
      adjustedDaysSupply,
      adjustedRisk,
      suggestedPO
    };
  });

  const criticalCount = simulatedList.filter(s => s.adjustedRisk === 'CRITICAL').length;
  const totalSuggestedPOUnits = simulatedList.reduce((acc, curr) => acc + curr.suggestedPO, 0);

  const handleExportCSV = () => {
    const headers = ['SKU_ID', 'Product', 'Category', 'Stock_On_Hand', 'Adjusted_Burn_Rate', 'Adjusted_Lead_Time_Days', 'Adjusted_Days_Supply', 'Risk_Tier', 'Suggested_Reorder_Units'];
    const rows = simulatedList.map(s => [
      s.sku_id,
      `"${s.product_name}"`,
      s.category,
      s.current_stock,
      s.adjustedBurnRate,
      s.adjustedLeadTime,
      s.adjustedDaysSupply,
      s.adjustedRisk,
      s.suggestedPO
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `supply_chain_scenario_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setLeadTimeShockDays(0);
    setDemandMultiplierPct(0);
    setHoldingCostMultiplierPct(0);
  };

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <SlidersHorizontal size={18} color="#2563eb" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
              Supply Chain Stress-Test & Scenario Simulator
            </h2>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
            Simulate supplier delays, promotional demand surges, and holding cost inflation on your inventory runway.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={handleReset} className="btn-secondary" style={{ fontSize: '0.78rem' }}>
            <RotateCcw size={13} />
            <span>Reset Sliders</span>
          </button>
          <button onClick={handleExportCSV} className="btn-primary" style={{ fontSize: '0.78rem' }}>
            <Download size={13} />
            <span>Export Scenario CSV</span>
          </button>
        </div>
      </div>

      {/* Stress-Test Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Lead Time Delay Slider */}
        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Truck size={14} color="#d97706" /> Supplier Port Delay
            </span>
            <span className="font-mono" style={{ fontSize: '0.88rem', fontWeight: 700, color: leadTimeShockDays > 0 ? '#d97706' : '#0f172a' }}>
              +{leadTimeShockDays} days
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="21"
            step="1"
            value={leadTimeShockDays}
            onChange={(e) => setLeadTimeShockDays(Number(e.target.value))}
            className="range-slider"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
            <span>On-Time (0d)</span>
            <span>+7d Minor Delay</span>
            <span>+21d Severe Delay</span>
          </div>
        </div>

        {/* Demand Surge Slider */}
        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Flame size={14} color="#dc2626" /> Demand Surge (Promotional Shock)
            </span>
            <span className="font-mono" style={{ fontSize: '0.88rem', fontWeight: 700, color: demandMultiplierPct > 0 ? '#dc2626' : '#0f172a' }}>
              +{demandMultiplierPct}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="10"
            value={demandMultiplierPct}
            onChange={(e) => setDemandMultiplierPct(Number(e.target.value))}
            className="range-slider"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
            <span>Baseline (0%)</span>
            <span>+50% Spike</span>
            <span>+100% 2x Demand</span>
          </div>
        </div>

        {/* Holding Cost Inflation Slider */}
        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <DollarSign size={14} color="#059669" /> Storage / Holding Cost Hike
            </span>
            <span className="font-mono" style={{ fontSize: '0.88rem', fontWeight: 700, color: holdingCostMultiplierPct > 0 ? '#d97706' : '#0f172a' }}>
              +{holdingCostMultiplierPct}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="50"
            step="5"
            value={holdingCostMultiplierPct}
            onChange={(e) => setHoldingCostMultiplierPct(Number(e.target.value))}
            className="range-slider"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
            <span>Standard</span>
            <span>+25% Inflation</span>
            <span>+50% Warehouse Surge</span>
          </div>
        </div>
      </div>

      {/* Scenario Outcome Summary Pill */}
      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px 18px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={18} color="#dc2626" />
          <span style={{ fontSize: '0.85rem', color: '#991b1b' }}>
            Under this scenario: <strong>{criticalCount} SKUs</strong> enter immediate stockout crisis. Total emergency replenishment required: <strong>{totalSuggestedPOUnits.toLocaleString()} units</strong>.
          </span>
        </div>
        <span className="badge-tag critical">Stress Test Active</span>
      </div>

      {/* Stress-Tested Impact Table */}
      <div className="data-table-container">
        <table className="styled-table">
          <thead>
            <tr>
              <th>SKU / Product</th>
              <th>Category</th>
              <th>Current Stock</th>
              <th>Simulated Burn Rate</th>
              <th>Simulated Lead Time</th>
              <th>Simulated Runway</th>
              <th>Vulnerability Tier</th>
              <th>Emergency PO Needed</th>
            </tr>
          </thead>
          <tbody>
            {simulatedList.map((s) => {
              const isCrit = s.adjustedRisk === 'CRITICAL';
              const isHigh = s.adjustedRisk === 'HIGH';

              return (
                <tr key={s.sku_id}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{s.product_name}</span>
                      <span className="font-mono" style={{ fontSize: '0.72rem', color: '#64748b' }}>{s.sku_id}</span>
                    </div>
                  </td>
                  <td><span className="badge-tag info">{s.category}</span></td>
                  <td><span className="font-mono">{s.current_stock.toLocaleString()}</span></td>
                  <td><span className="font-mono">{s.adjustedBurnRate}/d</span></td>
                  <td><span className="font-mono">{s.adjustedLeadTime} days</span></td>
                  <td>
                    <span className="font-mono" style={{ fontWeight: 700, color: isCrit ? '#dc2626' : isHigh ? '#d97706' : '#059669' }}>
                      {s.adjustedDaysSupply}d
                    </span>
                  </td>
                  <td>
                    <span className={`badge-tag ${isCrit ? 'critical' : isHigh ? 'warning' : 'success'}`}>
                      {s.adjustedRisk}
                    </span>
                  </td>
                  <td>
                    {s.suggestedPO > 0 ? (
                      <span className="font-mono" style={{ color: '#dc2626', fontWeight: 700 }}>
                        +{s.suggestedPO.toLocaleString()} units
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>0 (Safe)</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
