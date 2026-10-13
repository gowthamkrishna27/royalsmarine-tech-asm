import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { quotationApi, clientApi, masterApi } from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';
import FilterBar, { SelectFilter } from '../../components/common/FilterBar';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import { DocumentTextIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useForm } from 'react-hook-form';
import { QUOTATION_STATUS } from '../../constants';
import toast from 'react-hot-toast';

function QuotationModal({ open, onClose, clients, brands, onDone }) {
  const { register, handleSubmit, reset } = useForm({ defaultValues: { quotation_date: new Date().toISOString().split('T')[0], status: 'draft' } });
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => v && fd.append(k, v));
      if (file) fd.append('file', file);
      await quotationApi.create(fd);
      toast.success('Quotation added');
      reset(); setFile(null); onDone(); onClose();
    } catch { toast.error('Failed'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Quotation" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="label">Quotation No <span className="text-red-500">*</span></label><input {...register('quotation_number', { required: true })} className="input" /></div>
        <div><label className="label">Farmer <span className="text-red-500">*</span></label>
          <select {...register('client_id', { required: true })} className="input">
            <option value="">Select farmer</option>
            {clients?.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
        </div>
        <div><label className="label">Brand</label>
          <select {...register('brand_id')} className="input">
            <option value="">Select brand</option>
            {brands?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div><label className="label">Date</label><input type="date" {...register('quotation_date')} className="input" /></div>
        <div><label className="label">Value (₹) <span className="text-red-500">*</span></label><input type="number" {...register('quotation_value', { required: true })} className="input" /></div>
        <div><label className="label">Status</label>
          <select {...register('status')} className="input">
            {Object.keys(QUOTATION_STATUS).map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2"><label className="label">Remarks</label><textarea {...register('remarks')} className="input" rows={2} /></div>
        <div className="sm:col-span-2"><label className="label">Upload Quotation File</label><input type="file" onChange={e => setFile(e.target.files[0])} className="input" /></div>
        <div className="sm:col-span-2 flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary">Add Quotation</button>
        </div>
      </form>
    </Modal>
  );
}

export default function QuotationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [addModal, setAddModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['quotations', page, status],
    queryFn: () => quotationApi.list({ page, limit: 20, status }).then(r => r.data),
  });
  const { data: clients } = useQuery({ queryKey: ['clients-list'], queryFn: () => clientApi.list({ limit: 300 }).then(r => r.data.data) });
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: () => masterApi.brands({ status: 'active' }).then(r => r.data.data) });

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Quotations</h1><p className="text-sm text-gray-500">{data?.pagination?.total || 0} quotations</p></div>
        <button onClick={() => setAddModal(true)} className="btn-primary btn-sm"><PlusIcon className="w-4 h-4" /> Add Quotation</button>
      </div>

      <FilterBar onReset={() => setStatus('')}>
        <SelectFilter label="All Status" value={status} onChange={setStatus} options={Object.keys(QUOTATION_STATUS).map(s => ({ value: s, label: s.replace(/_/g, ' ') }))} />
      </FilterBar>

      {isLoading ? <PageSpinner /> : (
        <div className="card">
          {data?.data?.length === 0 ? <EmptyState title="No quotations" icon={DocumentTextIcon} action={<button onClick={() => setAddModal(true)} className="btn-primary btn-sm">Add Quotation</button>} /> : (
            <>
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Quotation No</th><th>Farmer</th><th>Brand</th><th>Date</th><th>Value</th><th>Status</th><th>Salesperson</th></tr></thead>
                  <tbody>
                    {data.data.map(q => (
                      <tr key={q.id}>
                        <td className="font-medium">{q.quotation_number}</td>
                        <td>{q.company_name}</td>
                        <td>{q.brand_name || '—'}</td>
                        <td className="text-gray-500">{q.quotation_date}</td>
                        <td className="font-semibold">₹{Number(q.quotation_value).toLocaleString('en-IN')}</td>
                        <td><Badge color={q.status === 'accepted' || q.status === 'converted' ? 'green' : q.status === 'rejected' || q.status === 'lost' ? 'red' : q.status === 'sent' ? 'blue' : 'gray'}>{q.status.replace(/_/g,' ')}</Badge></td>
                        <td className="text-gray-500">{q.salesperson_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination meta={data.pagination} onPageChange={setPage} />
            </>
          )}
        </div>
      )}

      <QuotationModal open={addModal} onClose={() => setAddModal(false)} clients={clients} brands={brands} onDone={() => qc.invalidateQueries(['quotations'])} />
    </div>
  );
}
