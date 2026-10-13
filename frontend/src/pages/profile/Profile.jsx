import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useForm } from 'react-hook-form';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Spinner from '../../components/common/Spinner';

export default function ProfilePage() {
  const { user, fetchMe } = useAuth();
  const [pwLoading, setPwLoading] = useState(false);
  const { register, handleSubmit, watch, reset } = useForm();

  const onChangePassword = async (data) => {
    if (data.new_password !== data.confirm_password) { toast.error('Passwords do not match'); return; }
    setPwLoading(true);
    try {
      await api.put(`/users/${user.id}/reset-password`, { password: data.new_password });
      toast.success('Password updated');
      reset();
    } catch { toast.error('Failed to update password'); }
    finally { setPwLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="page-title">My Profile</h1>

      <div className="card">
        <div className="card-header"><h3 className="font-semibold">Profile Information</h3></div>
        <div className="card-body space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
              {user?.full_name?.[0]}
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{user?.full_name}</p>
              <p className="text-sm text-gray-500 capitalize">{user?.role?.replace(/_/g, ' ')}</p>
            </div>
          </div>
          {[['Email', user?.email], ['Mobile', user?.mobile], ['Department', user?.department || '—']].map(([label, val]) => (
            <div key={label} className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">{label}</span>
              <span className="text-sm font-medium text-gray-900">{val}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3 className="font-semibold">Change Password</h3></div>
        <div className="card-body">
          <form onSubmit={handleSubmit(onChangePassword)} className="space-y-4">
            <div>
              <label className="label">New Password</label>
              <input type="password" {...register('new_password', { required: true, minLength: 6 })} className="input" />
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <input type="password" {...register('confirm_password', { required: true })} className="input" />
            </div>
            <button type="submit" disabled={pwLoading} className="btn-primary">
              {pwLoading ? <Spinner size="sm" /> : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
