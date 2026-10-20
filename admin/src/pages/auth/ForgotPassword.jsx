import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { authApi } from '../../services/api';
import toast from 'react-hot-toast';
import Spinner from '../../components/common/Spinner';

export default function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async ({ email }) => {
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch {
      toast.error('Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Reset your password</h2>
        <p className="text-sm text-gray-500 mb-6">Enter your email and we'll send a reset link.</p>

        {sent ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <p className="text-sm text-gray-600">Check your email for reset instructions.</p>
            <Link to="/login" className="btn-primary mt-4 inline-flex">Back to Login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input type="email" {...register('email', { required: 'Email required' })} className="input" />
              {errors.email && <p className="form-error">{errors.email.message}</p>}
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <><Spinner size="sm" /> Sending...</> : 'Send Reset Link'}
            </button>
            <Link to="/login" className="block text-center text-sm text-blue-600 hover:underline">Back to Login</Link>
          </form>
        )}
      </div>
    </div>
  );
}
