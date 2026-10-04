import React from 'react';
import { 
  PieChart, 
  Layers, 
  Coins, 
  ShoppingBag, 
  ShieldAlert, 
  CheckCircle 
} from 'lucide-react';

export default function InventoryMatrix({ stockoutList, skus }) {
  // Aggregate portfolio capital and risk metrics by category
  const categoryStats = {};

  stockoutList.forEach((item) => {
    const cat = item.category || 'General';
    if (!categoryStats[cat]) {
      categoryStats[cat] = {
        category: cat,
        sku_count: 0,
        total_units: 0,
        asset_value: 0,
        revenue_potential: 0,
        critical_count: 0,
        overstocked_count: 0
      };
    }

    const value = item.current_stock * item.unit_cost;
    const rev = item.current_stock * item.unit_price;

    categoryStats[cat].sku_count += 1;
    categoryStats[cat].total_units += item.current_stock;
    categoryStats[cat].asset_value += value;
    categoryStats[cat].revenue_potential += rev;

    if (item.risk_tier === 'CRITICAL' || item.risk_tier === 'HIGH') {
      categoryStats[cat].critical_count += 1;
    }
    if (item.risk_tier === 'OVERSTOCKED') {
      categoryStats[cat].overstocked_count += 1;
    }
  });

  const catList = Object.values(categoryStats);
  const totalAssetValue = catList.reduce((acc, c) => acc + c.asset_value, 0);

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Coins size={18} color="#059669" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
              Category Capital Allocation & Portfolio Velocity
            </h2>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
            Working capital tied up in inventory, gross margin return on investment (GMROI), and departmental exposure.
          </p>
        </div>

        <div className="badge-tag success font-mono" style={{ fontSize: '0.85rem' }}>
          Total Working Capital: ${totalAssetValue.toLocaleString()}
        </div>
      </div>

      {/* Category Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {catList.map((cat) => {
          const sharePct = totalAssetValue > 0 ? Math.round((cat.asset_value / totalAssetValue) * 100) : 0;

          return (
            <div 
              key={cat.category}
              className="glass-panel"
              style={{ padding: '18px', background: '#ffffff', border: '1px solid #e2e8f0' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.92rem' }}>{cat.category}</span>
                <span className="badge-tag info font-mono">{sharePct}% Capital</span>
              </div>

              <div className="font-mono" style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                ${Math.round(cat.asset_value).toLocaleString()}
              </div>

              <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span>{cat.total_units.toLocaleString()} units ({cat.sku_count} SKUs)</span>
                <span>Pot. Rev: ${Math.round(cat.revenue_potential).toLocaleString()}</span>
              </div>

              {/* Vulnerability indicators */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                {cat.critical_count > 0 ? (
                  <span className="badge-tag critical" style={{ fontSize: '0.68rem' }}>
                    {cat.critical_count} Imminent Stockout
                  </span>
                ) : (
                  <span className="badge-tag success" style={{ fontSize: '0.68rem' }}>
                    0 Stockout Risks
                  </span>
                )}

                {cat.overstocked_count > 0 && (
                  <span className="badge-tag warning" style={{ fontSize: '0.68rem' }}>
                    {cat.overstocked_count} Excess Stock
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
