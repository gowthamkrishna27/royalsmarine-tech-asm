import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportApi, userApi, masterApi } from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';
import { downloadBlob } from '../../hooks/useApi';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import Badge from '../../components/common/Badge';
import toast from 'react-hot-toast';

const TABS = ['visits', 'opportunities', 'followups', 'billing', 'brand', 'mom'];
const TAB_LABELS = { visits: 'Visits', opportunities: 'Opportunities', followups: 'Follow-ups', billing: 'Billing', brand: 'Brand Report', mom: 'MOM Comparison' };
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_KEYS = ['m01','m02','m03','m04','m05','m06','m07','m08','m09','m10','m11','m12'];

export default function Reports() {
  const [tab, setTab] = useState('visits');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [salespersonId, setSalespersonId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [momYear, setMomYear] = useState(new Date().getFullYear().toString());

  const { data: salespeople } = useQuery({ queryKey: ['salespeople'], queryFn: () => userApi.list({ role: 'sales_executive' }).then(r => r.data.data) });
  const { data: brands } = useQuery({ queryKey: ['brands-list'], queryFn: () => masterApi.brands({ status: 'active' }).then(r => r.data.data) });

  const { data: visitReport, isLoading: visitLoading } = useQuery({
    queryKey: ['report-visits', fromDate, toDate, salespersonId],
    queryFn: () => reportApi.visits({ from_date: fromDate, to_date: toDate, salesperson_id: salespersonId }).then(r => r.data.data),
    enabled: tab === 'visits',
  });
  const { data: oppReport, isLoading: oppLoading } = useQuery({
    queryKey: ['report-opps', fromDate, toDate, salespersonId],
    queryFn: () => reportApi.opportunities({ from_date: fromDate, to_date: toDate, salesperson_id: salespersonId }).then(r => r.data.data),
    enabled: tab === 'opportunities',
  });
  const { data: followupReport, isLoading: fuLoading } = useQuery({
    queryKey: ['report-followups', fromDate, toDate, salespersonId],
    queryFn: () => reportApi.followups({ from_date: fromDate, to_date: toDate, salesperson_id: salespersonId }).then(r => r.data.data),
    enabled: tab === 'followups',
  });
  const { data: billingReport, isLoading: billLoading } = useQuery({
    queryKey: ['report-billing'],
    queryFn: () => reportApi.billing({ month: new Date().getMonth() + 1, year: new Date().getFullYear() }).then(r => r.data.data),
    enabled: tab === 'billing',
  });
  const { data: brandReport, isLoading: brandLoading } = useQuery({
    queryKey: ['report-brand', fromDate, toDate, brandId],
    queryFn: () => reportApi.brand({ from_date: fromDate, to_date: toDate, brand_id: brandId }).then(r => r.data.data),
    enabled: tab === 'brand',
  });
  const { data: momReport, isLoading: momLoading } = useQuery({
    queryKey: ['report-mom', momYear],
    queryFn: () => reportApi.mom({ year: momYear }).then(r => r.data.data),
    enabled: tab === 'mom',
  });

  const handleExport = async () => {
    try {
      const res = await reportApi.export({ type: tab, from_date: fromDate, to_date: toDate });
      downloadBlob(res.data, `${tab}-report.xlsx`);
    } catch { toast.error('Export failed'); }
  };

  const currentMonth = new Date().getMonth(); // 0-indexed

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <button onClick={handleExport} className="btn-secondary btn-sm">
          <ArrowDownTrayIcon className="w-4 h-4" /> Export Excel
        </button>
      </div>

      {/* Tabs — scrollable on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-max sm:w-fit">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap capitalize transition ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      {tab !== 'mom' && (
        <div className="flex flex-wrap gap-3">
          {tab !== 'brand' && (
            <select value={salespersonId} onChange={e => setSalespersonId(e.target.value)} className="input w-auto">
              <option value="">All Salespeople</option>
              {salespeople?.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          )}
          {(tab === 'brand') && (
            <select value={brandId} onChange={e => setBrandId(e.target.value)} className="input w-auto">
              <option value="">All Brands</option>
              {brands?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="input w-auto" />
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="input w-auto" />
        </div>
      )}

      {/* Visit Report */}
      {tab === 'visits' && (
        visitLoading ? <PageSpinner /> : (
          <div className="card">
            <div className="card-header"><h3 className="font-semibold">Salesperson Visit Report</h3></div>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Salesperson</th><th>Total Visits</th><th>Approved</th><th>Pending</th></tr></thead>
                <tbody>
                  {visitReport?.map(r => (
                    <tr key={r.salesperson}>
                      <td className="font-medium">{r.salesperson}</td>
                      <td>{r.total_visits}</td>
                      <td><Badge color="green">{r.approved}</Badge></td>
                      <td><Badge color="yellow">{r.pending}</Badge></td>
                    </tr>
                  ))}
                  {!visitReport?.length && <tr><td colSpan={4} className="text-center text-gray-400 py-8">No data</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Opportunity Report */}
      {tab === 'opportunities' && (
        oppLoading ? <PageSpinner /> : (
          <div className="space-y-4">
            <div className="card">
              <div className="card-header"><h3 className="font-semibold">Pipeline by Stage</h3></div>
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Stage</th><th>Count</th><th>Total Value</th></tr></thead>
                  <tbody>
                    {oppReport?.summary?.map(r => (
                      <tr key={r.current_stage}>
                        <td><Badge color="blue">{r.current_stage}</Badge></td>
                        <td>{r.count}</td>
                        <td className="font-semibold">₹{Number(r.total_value).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h3 className="font-semibold">Brand-wise Pipeline</h3></div>
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Brand</th><th>Opps</th><th>Value</th><th>Won</th><th>Lost</th></tr></thead>
                  <tbody>
                    {oppReport?.brandwise?.map(r => (
                      <tr key={r.brand}>
                        <td className="font-medium">{r.brand || 'Untagged'}</td>
                        <td>{r.count}</td>
                        <td className="font-semibold">₹{Number(r.value).toLocaleString('en-IN')}</td>
                        <td><Badge color="green">{r.won}</Badge></td>
                        <td><Badge color="red">{r.lost}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )}

      {/* Follow-up Report */}
      {tab === 'followups' && (
        fuLoading ? <PageSpinner /> : (
          <div className="card">
            <div className="card-header"><h3 className="font-semibold">Follow-up Report</h3></div>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Salesperson</th><th>Total</th><th>Completed</th><th>Overdue</th><th>Pending</th></tr></thead>
                <tbody>
                  {followupReport?.map(r => (
                    <tr key={r.salesperson}>
                      <td className="font-medium">{r.salesperson}</td>
                      <td>{r.total}</td>
                      <td><Badge color="green">{r.completed}</Badge></td>
                      <td><Badge color="red">{r.overdue}</Badge></td>
                      <td><Badge color="yellow">{r.pending}</Badge></td>
                    </tr>
                  ))}
                  {!followupReport?.length && <tr><td colSpan={5} className="text-center text-gray-400 py-8">No data</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Billing Report */}
      {tab === 'billing' && (
        billLoading ? <PageSpinner /> : (
          <div className="space-y-4">
            <div className="card">
              <div className="card-header"><h3 className="font-semibold">Farmer-wise Monthly Billing</h3></div>
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Farmer</th><th>Current Month</th><th>Previous Month</th><th>Growth</th></tr></thead>
                  <tbody>
                    {billingReport?.clientBilling?.map(r => (
                      <tr key={r.company_name}>
                        <td className="font-medium">{r.company_name}</td>
                        <td>₹{Number(r.current_month).toLocaleString('en-IN')}</td>
                        <td>₹{Number(r.prev_month).toLocaleString('en-IN')}</td>
                        <td><span className={`text-sm font-medium ${r.growth_pct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {r.growth_pct != null ? `${r.growth_pct >= 0 ? '▲' : '▼'} ${Math.abs(r.growth_pct)}%` : '—'}
                        </span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h3 className="font-semibold text-red-600">Overdue Payments</h3></div>
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Farmer</th><th>Invoice</th><th>Invoice Amt</th><th>Outstanding</th><th>Due Date</th><th>Days Overdue</th></tr></thead>
                  <tbody>
                    {billingReport?.overduePayments?.map(r => (
                      <tr key={r.invoice_number}>
                        <td className="font-medium">{r.company_name}</td>
                        <td className="text-gray-600">{r.invoice_number}</td>
                        <td>₹{Number(r.invoice_amount).toLocaleString('en-IN')}</td>
                        <td className="text-red-600 font-semibold">₹{Number(r.outstanding_amount).toLocaleString('en-IN')}</td>
                        <td>{r.due_date}</td>
                        <td><Badge color="red">{r.days_overdue} days</Badge></td>
                      </tr>
                    ))}
                    {!billingReport?.overduePayments?.length && <tr><td colSpan={6} className="text-center text-gray-400 py-6">No overdue payments</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )}

      {/* Brand Report */}
      {tab === 'brand' && (
        brandLoading ? <PageSpinner /> : (
          <div className="card">
            <div className="card-header"><h3 className="font-semibold">Brand-wise Performance Report</h3></div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Brand</th><th>Total Opps</th><th>Pipeline Value</th>
                    <th>Won</th><th>Won Value</th><th>Lost</th>
                    <th>🔥 Hot</th><th>🌡 Warm</th><th>New Farmers</th>
                  </tr>
                </thead>
                <tbody>
                  {brandReport?.map(r => (
                    <tr key={r.brand_id || r.brand_name}>
                      <td className="font-semibold text-gray-900">{r.brand_name || 'Untagged'}</td>
                      <td>{r.total_opportunities}</td>
                      <td className="font-medium">₹{Number(r.pipeline_value).toLocaleString('en-IN')}</td>
                      <td><Badge color="green">{r.won_count}</Badge></td>
                      <td className="text-green-700 font-medium">₹{Number(r.won_value).toLocaleString('en-IN')}</td>
                      <td><Badge color="red">{r.lost_count}</Badge></td>
                      <td><Badge color="orange">{r.hot_leads}</Badge></td>
                      <td><Badge color="blue">{r.warm_leads}</Badge></td>
                      <td>{r.new_customers_this_month}</td>
                    </tr>
                  ))}
                  {!brandReport?.length && <tr><td colSpan={9} className="text-center text-gray-400 py-8">No data</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* MOM Report */}
      {tab === 'mom' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="label mb-0">Year</label>
            <select value={momYear} onChange={e => setMomYear(e.target.value)} className="input w-auto">
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {momLoading ? <PageSpinner /> : (
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold">Month-over-Month Billing Comparison — {momYear}</h3>
                <p className="text-xs text-gray-500">Green = growth, Red = decline vs previous month</p>
              </div>
              <div className="table-container">
                <table className="table text-xs">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-gray-50 z-10">Farmer</th>
                      {MONTHS.slice(0, currentMonth + 1).map(m => <th key={m}>{m}</th>)}
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {momReport?.map(r => (
                      <tr key={r.client_id}>
                        <td className="font-medium text-gray-900 sticky left-0 bg-white whitespace-nowrap">{r.company_name}</td>
                        {MONTH_KEYS.slice(0, currentMonth + 1).map((mk, i) => {
                          const val = parseFloat(r[mk]) || 0;
                          const pctKey = `mom_${mk}_pct`;
                          const pct = r[pctKey];
                          const isGrowth = pct != null && pct >= 0;
                          const isDecline = pct != null && pct < 0;
                          return (
                            <td key={mk} className={`whitespace-nowrap ${i > 0 && val === 0 ? 'text-gray-300' : ''}`}>
                              <div>{val > 0 ? `₹${(val/1000).toFixed(0)}K` : '—'}</div>
                              {i > 0 && pct != null && (
                                <div className={`text-xs font-medium ${isGrowth ? 'text-green-600' : 'text-red-500'}`}>
                                  {isGrowth ? '▲' : '▼'}{Math.abs(pct)}%
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="font-bold text-gray-900">₹{Number(r.year_total).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                    {!momReport?.length && <tr><td colSpan={14} className="text-center text-gray-400 py-8">No billing data for {momYear}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
