import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { opportunityApi, clientApi, masterApi, userApi } from '../../services/api';
import { OPPORTUNITY_STAGES } from '../../constants';
import toast from 'react-hot-toast';
import Spinner from '../../components/common/Spinner';

export default function OpportunityForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: { current_stage: 'identification' } });

  const { data: clients } = useQuery({ queryKey: ['clients-list'], queryFn: () => clientApi.list({ limit: 200 }).then(r => r.data.data) });
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: () => masterApi.brands({ status: 'active' }).then(r => r.data.data) });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => masterApi.categories({ status: 'active' }).then(r => r.data.data) });
  const { data: salespeople } = useQuery({ queryKey: ['salespeople'], queryFn: () => userApi.list({ role: 'sales_executive' }).then(r => r.data.data) });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await opportunityApi.create(data);
      toast.success('Opportunity created');
      navigate(`/opportunities/${res.data.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create');
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="page-header"><h1 className="page-title">Add Opportunity</h1></div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Opportunity Details</h3></div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Title <span className="text-red-500">*</span></label>
              <input {...register('title', { required: true })} className="input" placeholder="e.g. IT Infrastructure Supply - Acme Corp" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Farmer <span className="text-red-500">*</span></label>
              <select {...register('client_id', { required: true })} className={`input ${errors.client_id ? 'input-error' : ''}`}>
                <option value="">Select farmer</option>
                {clients?.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Brand</label>
              <select {...register('brand_id')} className="input">
                <option value="">Select brand</option>
                {brands?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select {...register('category_id')} className="input">
                <option value="">Select category</option>
                {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Estimated Value (₹)</label>
              <input type="number" {...register('estimated_value')} className="input" placeholder="0" />
            </div>
            <div>
              <label className="label">Expected Closing Date</label>
              <input type="date" {...register('expected_closing_date')} className="input" />
            </div>
            <div>
              <label className="label">Stage</label>
              <select {...register('current_stage')} className="input">
                {OPPORTUNITY_STAGES.filter(s => s.value !== 'won' && s.value !== 'lost').map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Assigned Salesperson</label>
              <select {...register('assigned_salesperson_id')} className="input">
                <option value="">Default (me)</option>
                {salespeople?.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Requirement Details</label>
              <textarea {...register('requirement_details')} className="input" rows={3} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Competitor Information</label>
              <textarea {...register('competitor_info')} className="input" rows={2} />
            </div>
            <div>
              <label className="label">Next Follow-up Date</label>
              <input type="date" {...register('next_followup_date')} className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Remarks</label>
              <textarea {...register('remarks')} className="input" rows={2} />
            </div>
          </div>
        </div>
        <div className="flex gap-3 justify-end sm:pr-20 pb-8 sm:pb-12">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? <><Spinner size="sm" /> Creating...</> : 'Create Opportunity'}
          </button>
        </div>
      </form>
    </div>
  );
}
