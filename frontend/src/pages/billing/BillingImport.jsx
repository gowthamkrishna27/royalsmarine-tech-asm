import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { billingApi, clientApi } from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import { CloudArrowUpIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function BillingImport() {
  const qc = useQueryClient();
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [mapModal, setMapModal] = useState(null);
  const [mapClientId, setMapClientId] = useState('');

  const { data: imports, isLoading } = useQuery({
    queryKey: ['billing-imports'],
    queryFn: () => billingApi.imports().then(r => r.data.data),
  });
  const { data: unmatched } = useQuery({
    queryKey: ['billing-unmatched'],
    queryFn: () => billingApi.unmatched().then(r => r.data.data),
  });
  const { data: clients } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => clientApi.list({ limit: 300 }).then(r => r.data.data),
  });

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await billingApi.import(fd);
      setResult(res.data.data);
      toast.success('Import complete');
      qc.invalidateQueries(['billing-imports']);
      qc.invalidateQueries(['billing-unmatched']);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setUploading(false);
      fileRef.current.value = '';
    }
  };

  const handleMap = async () => {
    if (!mapClientId) return;
    try {
      await billingApi.map(mapModal.id, { client_id: mapClientId });
      toast.success('Record mapped');
      setMapModal(null);
      setMapClientId('');
      qc.invalidateQueries(['billing-unmatched']);
    } catch { toast.error('Failed to map'); }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Billing Import</h1>
      </div>

      {/* Upload */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Import from Tally (Excel/CSV)</h3>
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition cursor-pointer" onClick={() => fileRef.current.click()}>
          <CloudArrowUpIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600 font-medium">Click to upload Excel / CSV file</p>
          <p className="text-xs text-gray-400 mt-1">Columns: Invoice No, Date, Farmer Name, Code, Technical Executive, Brand, Category, Invoice Amt, Paid, Outstanding, Due Date</p>
          {uploading && <p className="text-sm text-blue-600 mt-3">Importing...</p>}
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} className="hidden" />

        {result && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Total Rows', result.total, 'blue'],
              ['Imported', result.imported, 'green'],
              ['Failed', result.failed, 'red'],
              ['Unmatched Farmers', result.unmatched, 'yellow'],
            ].map(([label, val, color]) => (
              <div key={label} className="card p-3 text-center">
                <p className={`text-2xl font-bold text-${color}-600`}>{val}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unmatched */}
      {unmatched?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900">Unmatched Records ({unmatched.length})</h3>
            <p className="text-sm text-gray-500">Map these to existing farmers</p>
          </div>
          <div className="divide-y divide-gray-50">
            {unmatched.map(r => (
              <div key={r.id} className="px-6 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.client_name}</p>
                  <p className="text-xs text-gray-400">{r.invoice_number} · ₹{Number(r.invoice_amount).toLocaleString('en-IN')} · {r.invoice_date}</p>
                </div>
                <button onClick={() => setMapModal(r)} className="btn-secondary btn-sm">Map Farmer</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import History */}
      <div className="card">
        <div className="card-header"><h3 className="font-semibold text-gray-900">Import History</h3></div>
        {isLoading ? <PageSpinner /> : (
          <div className="divide-y divide-gray-50">
            {imports?.map(imp => (
              <div key={imp.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{imp.original_name}</p>
                  <p className="text-xs text-gray-400">{new Date(imp.created_at).toLocaleString()} · by {imp.imported_by_name}</p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500">{imp.total_records} rows</span>
                  <Badge color="green">{imp.imported_records} ok</Badge>
                  {imp.failed_records > 0 && <Badge color="red">{imp.failed_records} failed</Badge>}
                  <Badge color={imp.status === 'completed' ? 'green' : imp.status === 'failed' ? 'red' : 'yellow'}>{imp.status}</Badge>
                </div>
              </div>
            ))}
            {!imports?.length && <p className="px-6 py-8 text-sm text-gray-400 text-center">No imports yet</p>}
          </div>
        )}
      </div>

      <Modal open={Boolean(mapModal)} onClose={() => setMapModal(null)} title="Map to Farmer">
        <div className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg text-sm">
            <p className="font-medium">{mapModal?.client_name}</p>
            <p className="text-gray-500">{mapModal?.invoice_number} · ₹{Number(mapModal?.invoice_amount).toLocaleString('en-IN')}</p>
          </div>
          <div>
            <label className="label">Select Matching Farmer</label>
            <select value={mapClientId} onChange={e => setMapClientId(e.target.value)} className="input">
              <option value="">Choose farmer...</option>
              {clients?.map(c => <option key={c.id} value={c.id}>{c.company_name} — {c.city}</option>)}
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setMapModal(null)} className="btn-secondary">Cancel</button>
            <button onClick={handleMap} disabled={!mapClientId} className="btn-primary">
              <CheckCircleIcon className="w-4 h-4" /> Map Farmer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
