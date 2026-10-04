import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  Layers, 
  Cpu, 
  CheckCircle2, 
  Info 
} from 'lucide-react';

export default function ForecastChart({ 
  forecastData, 
  selectedModel, 
  onChangeModel 
}) {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [show95Confidence, setShow95Confidence] = useState(true);

  const history = forecastData?.history || [];
  const forecast = forecastData?.forecast || [];
  const summary = forecastData?.summary || {};
  const featureImportances = summary.feature_importance || [];

  // Combine history (last 35 points for visual punch) and 30-day forecast
  const visibleHistory = useMemo(() => history.slice(-35), [history]);

  // Compute SVG dimensions and coordinate scales
  const svgWidth = 900;
  const svgHeight = 360;
  const padding = { top: 25, right: 35, bottom: 45, left: 55 };

  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  // Find max Y across history and forecast bounds
  const maxY = useMemo(() => {
    let maxVal = 10;
    visibleHistory.forEach(h => { if (h.sales_units > maxVal) maxVal = h.sales_units; });
    forecast.forEach(f => {
      const up = show95Confidence ? (f.yhat_upper_95 || f.yhat_upper) : f.yhat_upper;
      if (up > maxVal) maxVal = up;
    });
    return Math.ceil(maxVal * 1.15);
  }, [visibleHistory, forecast, show95Confidence]);

  const totalPoints = visibleHistory.length + forecast.length;

  const getX = (index) => {
    return padding.left + (index / (totalPoints - 1)) * plotWidth;
  };

  const getY = (val) => {
    const clamped = Math.max(0, val);
    return padding.top + plotHeight - (clamped / maxY) * plotHeight;
  };

  // Generate SVG path strings
  // 1. History line
  const historyPath = useMemo(() => {
    if (visibleHistory.length === 0) return '';
    return visibleHistory.map((pt, i) => {
      const x = getX(i);
      const y = getY(pt.sales_units);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }, [visibleHistory, maxY]);

  // 2. Forecast median line
  const forecastPath = useMemo(() => {
    if (forecast.length === 0) return '';
    const startIdx = visibleHistory.length - 1;
    const startPt = visibleHistory[startIdx];
    const points = [];

    if (startPt) {
      points.push(`M ${getX(startIdx)} ${getY(startPt.sales_units)}`);
    }

    forecast.forEach((pt, i) => {
      const idx = visibleHistory.length + i;
      const x = getX(idx);
      const y = getY(pt.yhat);
      points.push(`${points.length === 0 ? 'M' : 'L'} ${x} ${y}`);
    });

    return points.join(' ');
  }, [visibleHistory, forecast, maxY]);

  // 3. Shaded 80% Uncertainty Band Area Path
  const uncertaintyArea80Path = useMemo(() => {
    if (forecast.length === 0) return '';
    const upperPoints = [];
    const lowerPoints = [];

    forecast.forEach((pt, i) => {
      const idx = visibleHistory.length + i;
      const x = getX(idx);
      const yUp = getY(pt.yhat_upper);
      const yLow = getY(pt.yhat_lower);
      upperPoints.push(`${x},${yUp}`);
      lowerPoints.unshift(`${x},${yLow}`);
    });

    return `M ${upperPoints.join(' L ')} L ${lowerPoints.join(' L ')} Z`;
  }, [visibleHistory, forecast, maxY]);

  // 4. Shaded 95% Uncertainty Band Area Path
  const uncertaintyArea95Path = useMemo(() => {
    if (forecast.length === 0 || !show95Confidence) return '';
    const upperPoints = [];
    const lowerPoints = [];

    forecast.forEach((pt, i) => {
      const idx = visibleHistory.length + i;
      const x = getX(idx);
      const yUp = getY(pt.yhat_upper_95 || pt.yhat_upper);
      const yLow = getY(pt.yhat_lower_95 || pt.yhat_lower);
      upperPoints.push(`${x},${yUp}`);
      lowerPoints.unshift(`${x},${yLow}`);
    });

    return `M ${upperPoints.join(' L ')} L ${lowerPoints.join(' L ')} Z`;
  }, [visibleHistory, forecast, maxY, show95Confidence]);

  // Horizontal Grid Lines
  const gridTicks = [0, 0.25, 0.5, 0.75, 1.0].map(ratio => Math.round(maxY * ratio));

  if (!forecastData || !forecastData.forecast) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: '#64748b' }}>Loading operational forecast data...</p>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      {/* Chart Control Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '18px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
              {forecastData.product_name}
            </h2>
            <span className="badge-tag info font-mono">{forecastData.sku_id}</span>
            <span className="badge-tag success">{forecastData.category}</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
            30-Day Operational Demand Forecast with 80% & 95% Prediction Intervals
          </p>
        </div>

        {/* Model Switcher & Interval Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            {[
              { id: 'ensemble', label: 'Ensemble' },
              { id: 'lightgbm', label: 'LightGBM' },
              { id: 'prophet', label: 'Prophet' },
              { id: 'baseline', label: 'Baseline (MA)' }
            ].map((m) => (
              <button
                key={m.id}
                id={`model-select-${m.id}`}
                onClick={() => onChangeModel(m.id)}
                style={{
                  padding: '5px 11px',
                  borderRadius: '4px',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: selectedModel === m.id ? '#2563eb' : 'transparent',
                  color: selectedModel === m.id ? '#ffffff' : '#475569',
                  transition: 'all 0.15s ease'
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#475569', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={show95Confidence}
              onChange={(e) => setShow95Confidence(e.target.checked)}
              style={{ accentColor: '#2563eb', cursor: 'pointer' }}
            />
            <span>Show 95% Band</span>
          </label>
        </div>
      </div>

      {/* Interactive SVG Chart */}
      <div className="chart-container" style={{ padding: 0 }}>
        <svg 
          viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
          className="chart-svg"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            {/* 80% CI Clean Fill */}
            <linearGradient id="uncertaintyClean" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.04" />
            </linearGradient>
            {/* 95% CI Clean Fill */}
            <linearGradient id="uncertaintyClean95" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines */}
          {gridTicks.map((val) => {
            const y = getY(val);
            return (
              <g key={val}>
                <line 
                  x1={padding.left} 
                  y1={y} 
                  x2={svgWidth - padding.right} 
                  y2={y} 
                  stroke="#e2e8f0" 
                  strokeDasharray="4 4"
                />
                <text 
                  x={padding.left - 12} 
                  y={y + 4} 
                  fill="#64748b" 
                  fontSize="10" 
                  textAnchor="end"
                  className="font-mono"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Divider between Historical and Forecast Horizon */}
          {visibleHistory.length > 0 && (
            <g>
              <line 
                x1={getX(visibleHistory.length - 1)} 
                y1={padding.top} 
                x2={getX(visibleHistory.length - 1)} 
                y2={svgHeight - padding.bottom} 
                stroke="#cbd5e1" 
                strokeDasharray="3 3"
              />
              <text 
                x={getX(visibleHistory.length - 1) - 8} 
                y={padding.top + 14} 
                fill="#059669" 
                fontSize="10" 
                fontWeight="600" 
                textAnchor="end"
              >
                ◀ Historical Actuals
              </text>
              <text 
                x={getX(visibleHistory.length - 1) + 8} 
                y={padding.top + 14} 
                fill="#2563eb" 
                fontSize="10" 
                fontWeight="600" 
                textAnchor="start"
              >
                30-Day Forecast Horizon ▶
              </text>
            </g>
          )}

          {/* 95% Confidence Shaded Area */}
          {show95Confidence && (
            <path d={uncertaintyArea95Path} fill="url(#uncertaintyClean95)" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 2" />
          )}

          {/* 80% Confidence Shaded Area */}
          <path d={uncertaintyArea80Path} fill="url(#uncertaintyClean)" stroke="rgba(37, 99, 235, 0.3)" strokeWidth="1" />

          {/* Historical Actuals Line */}
          <path d={historyPath} className="history-line" />

          {/* Forecast Median Line */}
          <path d={forecastPath} className="forecast-line" />

          {/* Forecast Interactive Points */}
          {forecast.map((pt, i) => {
            const idx = visibleHistory.length + i;
            const x = getX(idx);
            const y = getY(pt.yhat);
            const isHovered = hoveredPoint?.date === pt.date;

            return (
              <g 
                key={pt.date}
                onMouseEnter={() => setHoveredPoint({ ...pt, isForecast: true, x, y })}
                style={{ cursor: 'pointer' }}
              >
                <circle 
                  cx={x} 
                  cy={y} 
                  r={isHovered ? 5.5 : 3} 
                  fill={isHovered ? '#ffffff' : '#2563eb'} 
                  stroke="#2563eb" 
                  strokeWidth="2"
                  style={{ transition: 'all 0.15s ease' }}
                />
              </g>
            );
          })}

          {/* Historical Interactive Points */}
          {visibleHistory.map((pt, i) => {
            const x = getX(i);
            const y = getY(pt.sales_units);
            const isHovered = hoveredPoint?.date === pt.date;

            return (
              <g 
                key={pt.date}
                onMouseEnter={() => setHoveredPoint({ ...pt, isForecast: false, x, y })}
                style={{ cursor: 'pointer' }}
              >
                <circle 
                  cx={x} 
                  cy={y} 
                  r={isHovered ? 5 : 2} 
                  fill="#059669" 
                  opacity={isHovered ? 1 : 0.6}
                />
              </g>
            );
          })}

          {/* X Axis Labels */}
          {visibleHistory.length > 0 && (
            <text 
              x={padding.left} 
              y={svgHeight - 12} 
              fill="#64748b" 
              fontSize="10"
              className="font-mono"
            >
              {visibleHistory[0]?.date}
            </text>
          )}

          {forecast.length > 0 && (
            <>
              <text 
                x={getX(visibleHistory.length + 14)} 
                y={svgHeight - 12} 
                fill="#64748b" 
                fontSize="10" 
                textAnchor="middle"
                className="font-mono"
              >
                {forecast[14]?.date}
              </text>
              <text 
                x={svgWidth - padding.right} 
                y={svgHeight - 12} 
                fill="#64748b" 
                fontSize="10" 
                textAnchor="end"
                className="font-mono"
              >
                {forecast[forecast.length - 1]?.date}
              </text>
            </>
          )}
        </svg>

        {/* Hover Crosshair Tooltip */}
        {hoveredPoint && (
          <div 
            className="chart-tooltip"
            style={{
              left: `${Math.min(svgWidth - 210, Math.max(20, hoveredPoint.x - 85))}px`,
              top: `${Math.max(10, hoveredPoint.y - 120)}px`
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>{hoveredPoint.date}</span>
              <span className={`badge-tag ${hoveredPoint.isForecast ? 'info' : 'success'}`}>
                {hoveredPoint.isForecast ? 'Forecast' : 'Actual'}
              </span>
            </div>

            {hoveredPoint.isForecast ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2563eb', fontWeight: 700 }}>
                  <span>Forecast (ŷ):</span>
                  <span className="font-mono">{hoveredPoint.yhat} units</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                  <span>80% Range:</span>
                  <span className="font-mono">{hoveredPoint.yhat_lower} – {hoveredPoint.yhat_upper}</span>
                </div>
                {show95Confidence && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                    <span>95% Range:</span>
                    <span className="font-mono">{hoveredPoint.yhat_lower_95} – {hoveredPoint.yhat_upper_95}</span>
                  </div>
                )}
                <div style={{ fontSize: '0.7rem', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '4px', marginTop: '2px' }}>
                  Model: {hoveredPoint.model}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 700 }}>
                  <span>Actual Sold:</span>
                  <span className="font-mono">{hoveredPoint.sales_units} units</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                  <span>Unit Price:</span>
                  <span className="font-mono">${hoveredPoint.unit_price?.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                  <span>Day Revenue:</span>
                  <span className="font-mono">${hoveredPoint.revenue?.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chart Legend & Model Attribution */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#475569' }}>
            <span style={{ width: '12px', height: '3px', background: '#059669', borderRadius: '2px' }} />
            <span>Actual Sales</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#475569' }}>
            <span style={{ width: '12px', height: '3px', background: '#2563eb', borderRadius: '2px' }} />
            <span>Forecast ŷ (Median)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#475569' }}>
            <span style={{ width: '14px', height: '10px', background: 'rgba(37, 99, 235, 0.12)', border: '1px solid rgba(37, 99, 235, 0.35)', borderRadius: '2px' }} />
            <span>80% Confidence Zone</span>
          </div>
          {show95Confidence && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#475569' }}>
              <span style={{ width: '14px', height: '10px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '2px' }} />
              <span>95% Confidence Band</span>
            </div>
          )}
        </div>

        {/* Feature Importance Pills */}
        {featureImportances.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>TOP FEATURES:</span>
            {featureImportances.slice(0, 3).map((f) => (
              <span key={f.feature} className="badge-tag info font-mono" style={{ fontSize: '0.7rem' }}>
                {f.feature}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
