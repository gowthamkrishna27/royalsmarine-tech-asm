import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { masterApi } from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import { TagIcon, PlusIcon, CubeIcon } from '@heroicons/react/24/outline';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

function BrandModal({ open, onClose, onDone }) {
  const { register, handleSubmit, reset } = useForm();
  const onSubmit = async (data) => {
    try { await masterApi.createBrand(data); toast.success('Brand created'); reset(); onDone(); onClose(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Add Brand">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div><label className="label">Brand Name <span className="text-red-500">*</span></label><input {...register('name', { required: true })} className="input" /></div>
        <div><label className="label">Description</label><textarea {...register('description')} className="input" rows={2} /></div>
        <div className="flex gap-3 justify-end"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">Create Brand</button></div>
      </form>
    </Modal>
  );
}

function CategoryModal({ open, onClose, onDone, categories }) {
  const { register, handleSubmit, reset } = useForm();
  const onSubmit = async (data) => {
    try { await masterApi.createCategory(data); toast.success('Category created'); reset(); onDone(); onClose(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Add Category">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div><label className="label">Name <span className="text-red-500">*</span></label><input {...register('name', { required: true })} className="input" /></div>
        <div><label className="label">Parent Category</label>
          <select {...register('parent_id')} className="input">
            <option value="">Top level</option>
            {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><label className="label">Description</label><textarea {...register('description')} className="input" rows={2} /></div>
        <div className="flex gap-3 justify-end"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">Create Category</button></div>
      </form>
    </Modal>
  );
}

export default function Brands() {
  const qc = useQueryClient();
  const [brandModal, setBrandModal] = useState(false);
  const [catModal, setCatModal] = useState(false);

  const { data: brands, isLoading: brandsLoading } = useQuery({ queryKey: ['brands-all'], queryFn: () => masterApi.brands({ limit: 100 }).then(r => r.data.data) });
  const { data: categories, isLoading: catsLoading } = useQuery({ queryKey: ['categories-all'], queryFn: () => masterApi.categories().then(r => r.data.data) });

  const invalidate = () => { qc.invalidateQueries(['brands-all']); qc.invalidateQueries(['categories-all']); };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Brands & Categories</h1>
        <div className="flex gap-2">
          <button onClick={() => setCatModal(true)} className="btn-secondary btn-sm"><CubeIcon className="w-4 h-4" /> Add Category</button>
          <button onClick={() => setBrandModal(true)} className="btn-primary btn-sm"><PlusIcon className="w-4 h-4" /> Add Brand</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><h3 className="font-semibold text-gray-900 flex items-center gap-2"><TagIcon className="w-5 h-5 text-blue-500" /> Brands ({brands?.length || 0})</h3></div>
          {brandsLoading ? <PageSpinner /> : (
            <div className="divide-y divide-gray-50">
              {brands?.map(b => (
                <div key={b.id} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{b.name}</p>
                    {b.description && <p className="text-xs text-gray-400 mt-0.5">{b.description}</p>}
                  </div>
                  <Badge color={b.status === 'active' ? 'green' : 'red'}>{b.status}</Badge>
                </div>
              ))}
              {!brands?.length && <p className="px-6 py-8 text-sm text-gray-400 text-center">No brands yet</p>}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header"><h3 className="font-semibold text-gray-900 flex items-center gap-2"><CubeIcon className="w-5 h-5 text-purple-500" /> Categories ({categories?.length || 0})</h3></div>
          {catsLoading ? <PageSpinner /> : (
            <div className="divide-y divide-gray-50">
              {categories?.map(c => (
                <div key={c.id} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    {c.parent_name && <p className="text-xs text-gray-400">Under: {c.parent_name}</p>}
                  </div>
                  <Badge color={c.status === 'active' ? 'green' : 'red'}>{c.status}</Badge>
                </div>
              ))}
              {!categories?.length && <p className="px-6 py-8 text-sm text-gray-400 text-center">No categories yet</p>}
            </div>
          )}
        </div>
      </div>

      <BrandModal open={brandModal} onClose={() => setBrandModal(false)} onDone={invalidate} />
      <CategoryModal open={catModal} onClose={() => setCatModal(false)} onDone={invalidate} categories={categories} />
    </div>
  );
}
