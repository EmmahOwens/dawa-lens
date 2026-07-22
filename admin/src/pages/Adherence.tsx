import { useState, useEffect } from 'react';
import { Download, FileText, BarChart3 } from 'lucide-react';
import { HeatmapGrid } from '../components/charts/HeatmapGrid';
import { AdminPieChart } from '../components/charts/PieChart';
import { api } from '../services/adminApi';
import { adherenceBg } from '../lib/utils';
import { toast } from 'sonner';
import type { HeatmapCell, DoseBreakdown } from '../types';

export function Adherence() {
  const [data, setData] = useState<{ heatmap: HeatmapCell[]; breakdown: DoseBreakdown; adherenceRate: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

  useEffect(() => {
    setLoading(true);
    api.doseLogs.aggregate(days)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [days]);

  const pieData = data ? [
    { name: 'Taken', value: data.breakdown.taken },
    { name: 'Missed', value: data.breakdown.missed },
    { name: 'Skipped', value: data.breakdown.skipped },
  ].filter(d => d.value > 0) : [];

  const handleExportCSV = async () => {
    setExporting('csv');
    try { await api.export.adherenceCSV(days); toast.success('CSV downloaded'); }
    catch { toast.error('Export failed'); }
    finally { setExporting(null); }
  };

  const handleExportPDF = async () => {
    setExporting('pdf');
    try { await api.export.reportPDF(); toast.success('PDF report downloaded'); }
    catch { toast.error('PDF generation failed'); }
    finally { setExporting(null); }
  };

  return (
    <div className="page-enter space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Adherence Tracker</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Platform-wide dose adherence patterns</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period selector */}
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="text-xs bg-card border border-border/60 rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            id="adherence-export-csv"
            onClick={handleExportCSV}
            disabled={!!exporting}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
          >
            <Download size={12} /> {exporting === 'csv' ? 'Exporting…' : 'CSV'}
          </button>
          <button
            id="adherence-export-pdf"
            onClick={handleExportPDF}
            disabled={!!exporting}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
          >
            <FileText size={12} /> {exporting === 'pdf' ? 'Generating…' : 'PDF Report'}
          </button>
        </div>
      </div>

      {/* Stats row */}
      {data && (
        <div className="grid grid-cols-4 gap-4">
          <div className={`admin-card text-center ${adherenceBg(data.adherenceRate)}`}>
            <p className="text-2xl font-bold">{data.adherenceRate}%</p>
            <p className="text-xs mt-0.5">Overall Adherence</p>
          </div>
          {[
            { label: 'Taken', value: data.breakdown.taken, color: 'text-success' },
            { label: 'Missed', value: data.breakdown.missed, color: 'text-destructive' },
            { label: 'Skipped', value: data.breakdown.skipped, color: 'text-warning' },
          ].map(({ label, value, color }) => (
            <div key={label} className="admin-card text-center">
              <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Main: heatmap + pie */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 admin-card">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={14} className="text-primary" />
            <h3 className="text-sm font-semibold">Dose Activity Heatmap</h3>
            <span className="text-xs text-muted-foreground ml-auto">Day × Hour density</span>
          </div>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Building heatmap…</div>
          ) : data ? (
            <HeatmapGrid data={data.heatmap} />
          ) : null}
        </div>

        <div className="admin-card flex flex-col">
          <h3 className="text-sm font-semibold mb-4">Dose Breakdown</h3>
          <div className="flex-1" style={{ height: 220 }}>
            {!loading && pieData.length > 0 ? (
              <AdminPieChart data={pieData} />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                {loading ? 'Loading…' : 'No data'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
