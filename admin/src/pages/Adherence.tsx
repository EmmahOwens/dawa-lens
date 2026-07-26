import { useState, useEffect } from 'react';
import { Download, FileText, BarChart3, CheckCircle, AlertCircle, Activity } from '../lib/icons';
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
      .catch(() => { toast.error('Failed to load adherence data'); setLoading(false); });
  }, [days]);

  const pieData = data ? [
    { name: 'Taken',   value: data.breakdown.taken },
    { name: 'Missed',  value: data.breakdown.missed },
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
    <div className="page-enter flex flex-col gap-4 h-full">

      {/* Page header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center shadow-inner">
            <Activity size={18} className="text-success" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground leading-tight">Adherence Tracker</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Platform-wide dose adherence patterns</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="text-xs bg-card border border-border/60 rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            id="adherence-export-csv"
            onClick={handleExportCSV}
            disabled={!!exporting}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-secondary border border-border/60 text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all"
          >
            <Download size={12} /> {exporting === 'csv' ? 'Exporting…' : 'CSV'}
          </button>
          <button
            id="adherence-export-pdf"
            onClick={handleExportPDF}
            disabled={!!exporting}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-secondary border border-border/60 text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all"
          >
            <FileText size={12} /> {exporting === 'pdf' ? 'Generating…' : 'PDF Report'}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        {/* Adherence rate */}
        <div className={`admin-card admin-card-hover text-center relative overflow-hidden ${data ? adherenceBg(data.adherenceRate) : ''}`}>
          <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-success/10 blur-xl pointer-events-none" />
          {loading ? (
            <div className="skeleton h-8 w-20 mx-auto rounded mb-2" />
          ) : (
            <p className="text-3xl font-bold text-success tabular-nums">{data?.adherenceRate ?? 0}%</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">Overall Adherence</p>
          {data && (
            <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-success rounded-full transition-all duration-700" style={{ width: `${data.adherenceRate}%` }} />
            </div>
          )}
        </div>

        {[
          { label: 'Doses Taken',   value: data?.breakdown.taken,   color: 'text-success',     bg: 'bg-success/10',     icon: CheckCircle },
          { label: 'Doses Missed',  value: data?.breakdown.missed,  color: 'text-destructive', bg: 'bg-destructive/10', icon: AlertCircle },
          { label: 'Doses Skipped', value: data?.breakdown.skipped, color: 'text-warning',     bg: 'bg-warning/10',     icon: Activity    },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className="admin-card admin-card-hover flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
              <Icon size={17} className={color} />
            </div>
            <div>
              {loading
                ? <div className="skeleton h-7 w-16 rounded" />
                : <p className={`text-2xl font-bold tabular-nums leading-none ${color}`}>{(value ?? 0).toLocaleString()}</p>
              }
              <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main content: heatmap + pie */}
      <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
        <div className="col-span-2 admin-card flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 size={14} className="text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Dose Activity Heatmap</h3>
            <span className="text-xs text-muted-foreground ml-auto">Day × Hour density</span>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="space-y-2 w-full">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="flex gap-1">
                      {Array.from({ length: 24 }).map((_, j) => (
                        <div key={j} className="skeleton h-5 flex-1 rounded" />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : data ? (
              <HeatmapGrid data={data.heatmap} />
            ) : null}
          </div>
        </div>

        <div className="admin-card flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Activity size={14} className="text-violet-400" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Dose Breakdown</h3>
          </div>
          <div className="flex-1 min-h-0" style={{ minHeight: 180 }}>
            {!loading && pieData.length > 0 ? (
              <AdminPieChart data={pieData} />
            ) : (
              <div className="h-full flex items-center justify-center">
                {loading ? (
                  <div className="w-32 h-32 rounded-full skeleton" />
                ) : (
                  <p className="text-sm text-muted-foreground">No data</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
