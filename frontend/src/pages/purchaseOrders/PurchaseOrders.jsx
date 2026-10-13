import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { poApi, clientApi, masterApi } from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';
import FilterBar, { SelectFilter } from '../../components/common/FilterBar';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import { ShoppingCartIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useForm } from 'react-hook-form';
import { PO_STATUS } from '../../constants';
import toast from 'react-hot-toast';

function POModal({ open, onClose, clients, brands, onDone }) {
  const { register, handleSubmit, reset } = useForm({ defaultValues: { po_date: new Date().toISOString().split('T')[0] } });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => v && fd.append(k, v));
      if (file) fd.append('file', file);
      await poApi.create(fd);
      toast.success('PO added'); reset(); setFile(null); onDone(); onClose();
    } catch { toast.error('Failed'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Purchase Order" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="label">PO Number <span className="text-red-500">*</span></label><input {...register('po_number', { required: true })} className="input" /></div>
        <div><label className="label">PO Date</label><input type="date" {...register('po_date')} className="input" /></div>
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
        <div><label className="label">PO Value (₹) <span className="text-red-500">*</span></label><input type="number" {...register('po_value', { required: true })} className="input" /></div>
        <div><label className="label">Remarks</label><textarea {...register('remarks')} className="input" rows={2} /></div>
        <div className="sm:col-span-2"><label className="label">Upload PO Document</label><input type="file" onChange={e => setFile(e.target.files[0])} className="input" /></div>
        <div className="sm:col-span-2 flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary">Add PO</button>
        </div>
      </form>
    </Modal>
  );
}

export default function PurchaseOrdersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [orderStatus, setOrderStatus] = useState('');
  const [addModal, setAddModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', page, orderStatus],
    queryFn: () => poApi.list({ page, limit: 20, order_status: orderStatus }).then(r => r.data),
  });
  const { data: clients } = useQuery({ queryKey: ['clients-list'], queryFn: () => clientApi.list({ limit: 300 }).then(r => r.data.data) });
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: () => masterApi.brands({ status: 'active' }).then(r => r.data.data) });

  const updateStatus = async (id, status) => {
    try { await poApi.updateStatus(id, status); toast.success('Status updated'); qc.invalidateQueries(['purchase-orders']); }
    catch { toast.error('Failed'); }
  };

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Purchase Orders</h1><p className="text-sm text-gray-500">{data?.pagination?.total || 0} POs</p></div>
        <button onClick={() => setAddModal(true)} className="btn-primary btn-sm"><PlusIcon className="w-4 h-4" /> Add PO</button>
      </div>

      <FilterBar onReset={() => setOrderStatus('')}>
        <SelectFilter label="All Status" value={orderStatus} onChange={setOrderStatus} options={Object.keys(PO_STATUS).map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))} />
      </FilterBar>

      {isLoading ? <PageSpinner /> : (
        <div className="card">
          {data?.data?.length === 0 ? <EmptyState title="No purchase orders" icon={ShoppingCartIcon} action={<button onClick={() => setAddModal(true)} className="btn-primary btn-sm">Add PO</button>} /> : (
            <>
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>PO Number</th><th>Farmer</th><th>Date</th><th>Value</th><th>Status</th><th>Salesperson</th><th>Actions</th></tr></thead>
                  <tbody>
                    {data.data.map(po => (
                      <tr key={po.id}>
                        <td className="font-medium">{po.po_number}</td>
                        <td>{po.company_name}</td>
                        <td className="text-gray-500">{po.po_date}</td>
                        <td className="font-semibold">₹{Number(po.po_value).toLocaleString('en-IN')}</td>
                        <td>
                          <select value={po.order_status} onChange={e => updateStatus(po.id, e.target.value)} className="input py-1 text-xs w-auto">
                            {Object.keys(PO_STATUS).map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                          </select>
                        </td>
                        <td className="text-gray-500">{po.salesperson_name}</td>
                        <td><Badge color={po.order_status === 'completed' ? 'green' : po.order_status === 'cancelled' ? 'red' : 'blue'}>{po.order_status}</Badge></td>
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

      <POModal open={addModal} onClose={() => setAddModal(false)} clients={clients} brands={brands} onDone={() => qc.invalidateQueries(['purchase-orders'])} />
    </div>
  );
}
