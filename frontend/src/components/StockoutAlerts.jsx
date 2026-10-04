import React, { useState } from 'react';
import { 
  AlertOctagon, 
  AlertTriangle, 
  CheckCircle2, 
  Package, 
  Truck, 
  ExternalLink, 
  Sliders, 
  Filter 
} from 'lucide-react';

export default function StockoutAlerts({ 
  stockoutList, 
  onSelectSku, 
  onOpenPricingSandbox 
}) {
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [poOrdered, setPoOrdered] = useState({});

  const categories = ['ALL', 'Electronics', 'Apparel', 'Home & Kitchen', 'Grocery', 'Personal Care'];

  const filteredList = stockoutList.filter((item) => {
    if (categoryFilter === 'ALL') return true;
    return item.category.toUpperCase() === categoryFilter.toUpperCase();
  });

  const handleSimulatePO = (skuId, qty) => {
    setPoOrdered(prev => ({
      ...prev,
      [skuId]: qty
    }));
  };

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      {/* Table Header & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertOctagon size={18} color="#dc2626" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
              Supply Chain & Stockout Vulnerability Matrix
            </h2>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
            Real-time inventory runway vs. supplier lead times, stockout probabilities, and replenishment orders.
          </p>
        </div>

        {/* Category Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <Filter size={13} color="#94a3b8" />
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className="tab-btn"
              style={{
                padding: '4px 10px',
                fontSize: '0.78rem',
                borderRadius: '5px',
                background: categoryFilter === cat ? '#eff6ff' : 'transparent',
                borderColor: categoryFilter === cat ? '#bfdbfe' : 'transparent',
                color: categoryFilter === cat ? '#2563eb' : '#64748b'
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Responsive Table */}
      <div className="data-table-container">
        <table className="styled-table">
          <thead>
            <tr>
              <th>SKU / Product</th>
              <th>Category</th>
              <th>Stock on Hand</th>
              <th>Daily Burn Rate</th>
              <th>Runway (Days)</th>
              <th>Lead Time</th>
              <th>Stockout Prob</th>
              <th>Risk Tier</th>
              <th>Reorder Action</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredList.map((item) => {
              const isCritical = item.risk_tier === 'CRITICAL';
              const isHigh = item.risk_tier === 'HIGH';
              const isOverstocked = item.risk_tier === 'OVERSTOCKED';
              const isOrdered = !!poOrdered[item.sku_id];

              return (
                <tr key={item.sku_id}>
                  {/* SKU / Name */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.86rem' }}>
                        {item.product_name}
                      </span>
                      <span className="font-mono" style={{ fontSize: '0.73rem', color: '#64748b' }}>
                        {item.sku_id}
                      </span>
                    </div>
                  </td>

                  {/* Category */}
                  <td>
                    <span className="badge-tag info" style={{ fontSize: '0.7rem' }}>
                      {item.category}
                    </span>
                  </td>

                  {/* Stock On Hand */}
                  <td>
                    <span className="font-mono" style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.88rem' }}>
                      {item.current_stock.toLocaleString()} units
                    </span>
                  </td>

                  {/* Daily Burn Rate */}
                  <td>
                    <span className="font-mono" style={{ color: '#475569' }}>
                      {item.daily_burn_rate} /day
                    </span>
                  </td>

                  {/* Runway (Days of Supply) */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span 
                        className="font-mono" 
                        style={{ 
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          color: isCritical ? '#dc2626' : isHigh ? '#d97706' : isOverstocked ? '#2563eb' : '#059669' 
                        }}
                      >
                        {item.days_of_supply}d
                      </span>
                      {isCritical && <span className="badge-tag critical" style={{ fontSize: '0.65rem' }}>&lt; Lead Time</span>}
                    </div>
                  </td>

                  {/* Lead Time */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#64748b', fontSize: '0.78rem' }}>
                      <Truck size={13} />
                      <span>{item.lead_time_days} days</span>
                    </div>
                  </td>

                  {/* Stockout Probability */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '48px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            width: `${item.stockout_probability_pct}%`, 
                            height: '100%', 
                            background: isCritical ? '#dc2626' : isHigh ? '#d97706' : '#059669' 
                          }} 
                        />
                      </div>
                      <span className="font-mono" style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>
                        {item.stockout_probability_pct}%
                      </span>
                    </div>
                  </td>

                  {/* Risk Tier Badge */}
                  <td>
                    <span className={`badge-tag ${
                      isCritical ? 'critical' : isHigh ? 'warning' : isOverstocked ? 'info' : 'success'
                    }`}>
                      {item.risk_tier}
                    </span>
                  </td>

                  {/* Replenishment Reorder */}
                  <td>
                    {item.suggested_reorder_qty > 0 ? (
                      isOrdered ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#059669', fontSize: '0.76rem', fontWeight: 600 }}>
                          <CheckCircle2 size={13} />
                          <span>PO #{poOrdered[item.sku_id]} Placed</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSimulatePO(item.sku_id, item.suggested_reorder_qty)}
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '0.74rem', borderColor: '#fca5a5', color: '#dc2626' }}
                        >
                          Order +{item.suggested_reorder_qty}
                        </button>
                      )
                    ) : (
                      <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Adequate</span>
                    )}
                  </td>

                  {/* Drill-down Actions */}
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                      <button
                        onClick={() => onSelectSku(item.sku_id)}
                        className="btn-secondary"
                        title="View Detailed Demand Forecast"
                        style={{ padding: '4px 8px' }}
                      >
                        <ExternalLink size={12} />
                      </button>
                      <button
                        onClick={() => onOpenPricingSandbox(item.sku_id)}
                        className="btn-secondary"
                        title="Test Price Elasticity & Markdowns"
                        style={{ padding: '4px 8px' }}
                      >
                        <Sliders size={12} />
                      </button>
                    </div>
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
