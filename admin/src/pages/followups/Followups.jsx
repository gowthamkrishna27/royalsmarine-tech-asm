import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { followupApi, clientApi } from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';
import FilterBar, { SelectFilter } from '../../components/common/FilterBar';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import { BellIcon, PlusIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { FOLLOWUP_STATUS } from '../../constants';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

function CreateFollowupModal({ open, onClose, clients, onCreate }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await followupApi.create(data);
      toast.success('Follow-up created');
      reset();
      onCreate();
      onClose();
    } catch { toast.error('Failed to create'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Follow-up">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Title <span className="text-red-500">*</span></label>
          <input {...register('title', { required: true })} className="input" placeholder="Follow-up title" />
        </div>
        <div>
          <label className="label">Farmer <span className="text-red-500">*</span></label>
          <select {...register('client_id', { required: true })} className="input">
            <option value="">Select farmer</option>
            {clients?.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date <span className="text-red-500">*</span></label>
            <input type="date" {...register('followup_date', { required: true })} className="input" />
          </div>
          <div>
            <label className="label">Time</label>
            <input type="time" {...register('followup_time')} className="input" />
          </div>
        </div>
        <div>
          <label className="label">Priority</label>
          <select {...register('priority')} className="input">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label className="label">Remarks</label>
          <textarea {...register('remarks')} className="input" rows={2} />
        </div>
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary">Create Follow-up</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Followups() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [completeModal, setCompleteModal] = useState(null);
  const [completeNotes, setCompleteNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['followups', page, status, priority],
    queryFn: () => followupApi.list({ page, limit: 20, status, priority }).then(r => r.data),
  });
  const { data: todayData } = useQuery({ queryKey: ['followups-today'], queryFn: () => followupApi.today().then(r => r.data.data) });
  const { data: overdueData } = useQuery({ queryKey: ['followups-overdue'], queryFn: () => followupApi.overdue().then(r => r.data.data) });
  const { data: clients } = useQuery({ queryKey: ['clients-list'], queryFn: () => clientApi.list({ limit: 200 }).then(r => r.data.data) });

  const handleComplete = async () => {
    try {
      await followupApi.complete(completeModal, completeNotes);
      toast.success('Follow-up completed!');
      setCompleteModal(null);
      setCompleteNotes('');
      qc.invalidateQueries(['followups']);
      qc.invalidateQueries(['followups-today']);
      qc.invalidateQueries(['followups-overdue']);
    } catch { toast.error('Failed to complete'); }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Follow-ups</h1>
          <p className="text-sm text-gray-500">{data?.pagination?.total || 0} total</p>
        </div>
        <button onClick={() => setAddModal(true)} className="btn-primary btn-sm">
          <PlusIcon className="w-4 h-4" /> Add Follow-up
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4 flex items-center gap-3 border-l-4 border-blue-500">
          <BellIcon className="w-8 h-8 text-blue-500" />
          <div>
            <p className="text-2xl font-bold text-gray-900">{todayData?.length || 0}</p>
            <p className="text-sm text-gray-500">Today's Follow-ups</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3 border-l-4 border-red-500">
          <ExclamationTriangleIcon className="w-8 h-8 text-red-500" />
          <div>
            <p className="text-2xl font-bold text-gray-900">{overdueData?.length || 0}</p>
            <p className="text-sm text-gray-500">Overdue</p>
          </div>
        </div>
      </div>

      <FilterBar onReset={() => { setStatus(''); setPriority(''); }}>
        <SelectFilter label="All Status" value={status} onChange={setStatus} options={[
          { value: 'pending', label: 'Pending' }, { value: 'completed', label: 'Completed' },
          { value: 'overdue', label: 'Overdue' }, { value: 'cancelled', label: 'Cancelled' }
        ]} />
        <SelectFilter label="All Priority" value={priority} onChange={setPriority} options={[
          { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }
        ]} />
      </FilterBar>

      {isLoading ? <PageSpinner /> : (
        <div className="card">
          {data?.data?.length === 0 ? (
            <EmptyState title="No follow-ups" icon={BellIcon}
              action={<button onClick={() => setAddModal(true)} className="btn-primary btn-sm">Add Follow-up</button>} />
          ) : (
            <>
              <div className="divide-y divide-gray-50">
                {data.data.map(f => (
                  <div key={f.id} className="px-6 py-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-semibold text-gray-900">{f.title}</p>
                        <Badge color={f.priority === 'high' ? 'red' : f.priority === 'medium' ? 'blue' : 'gray'}>{f.priority}</Badge>
                        <Badge color={f.status === 'completed' ? 'green' : f.status === 'overdue' ? 'red' : f.status === 'cancelled' ? 'gray' : 'yellow'}>{f.status}</Badge>
                      </div>
                      <p className="text-sm text-gray-600">{f.company_name}</p>
                      <p className="text-xs text-gray-400 mt-1">{f.followup_date}{f.followup_time ? ` at ${f.followup_time}` : ''} · {f.salesperson_name}</p>
                    </div>
                    {f.status === 'pending' || f.status === 'overdue' ? (
                      <button onClick={() => setCompleteModal(f.id)} className="btn-success btn-sm flex-shrink-0">
                        <CheckCircleIcon className="w-4 h-4" /> Complete
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              <Pagination meta={data.pagination} onPageChange={setPage} />
            </>
          )}
        </div>
      )}

      <CreateFollowupModal open={addModal} onClose={() => setAddModal(false)} clients={clients}
        onCreate={() => qc.invalidateQueries(['followups'])} />

      <Modal open={Boolean(completeModal)} onClose={() => setCompleteModal(null)} title="Mark as Completed">
        <div className="space-y-4">
          <div>
            <label className="label">Completion Notes</label>
            <textarea value={completeNotes} onChange={e => setCompleteNotes(e.target.value)} className="input" rows={3} placeholder="What was discussed/achieved..." />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setCompleteModal(null)} className="btn-secondary">Cancel</button>
            <button onClick={handleComplete} className="btn-success">Mark Complete</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
