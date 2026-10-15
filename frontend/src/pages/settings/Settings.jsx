import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { settingsApi } from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';
import {
  BuildingOffice2Icon,
  ShieldCheckIcon,
  BeakerIcon,
  UsersIcon,
  UserCircleIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

export default function Settings() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({});
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { data: settings, isLoading, isError, error } = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => settingsApi.get().then((r) => r.data.data),
  });

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data) => settingsApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['system-settings']);
      setSavedSuccess(true);
      setErrorMessage('');
      setTimeout(() => setSavedSuccess(false), 3500);
    },
    onError: (err) => {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to save settings');
    },
  });

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSavedSuccess(false);
    setErrorMessage('');
    updateMutation.mutate(formData);
  };

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage organization details, field operation rules, and aquaculture thresholds.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/profile"
            className="btn-secondary btn-sm flex items-center gap-1.5"
          >
            <UserCircleIcon className="w-4 h-4" />
            My Profile
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={updateMutation.isPending}
            className="btn-primary btn-sm flex items-center gap-1.5"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Alert Banners */}
      {savedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5 animate-in fade-in">
          <CheckCircleIcon className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="font-semibold">Settings saved successfully!</span>
        </div>
      )}

      {(errorMessage || isError) && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2.5">
          <ExclamationCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span>{errorMessage || error?.message || 'Error loading settings'}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Organization Profile */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-gray-100 pb-3">
            <BuildingOffice2Icon className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-gray-900">Organization Profile</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Company Name</label>
              <input
                type="text"
                value={formData.company_name || ''}
                onChange={(e) => handleChange('company_name', e.target.value)}
                placeholder="Royals Marine Tech"
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Support Email</label>
              <input
                type="email"
                value={formData.company_email || ''}
                onChange={(e) => handleChange('company_email', e.target.value)}
                placeholder="support@royalsmarine.com"
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Helpline Phone</label>
              <input
                type="text"
                value={formData.company_phone || ''}
                onChange={(e) => handleChange('company_phone', e.target.value)}
                placeholder="+91 98480 12345"
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Head Office Location</label>
              <input
                type="text"
                value={formData.head_office || ''}
                onChange={(e) => handleChange('head_office', e.target.value)}
                placeholder="Bhimavaram, Andhra Pradesh"
                className="input w-full"
              />
            </div>
          </div>
        </div>

        {/* Field Operations & Follow-ups */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-gray-100 pb-3">
            <ShieldCheckIcon className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-gray-900">Field Operations & Verification Rules</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Follow-up Escalation Threshold (Days)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={formData.followup_overdue_escalation_days || ''}
                onChange={(e) => handleChange('followup_overdue_escalation_days', e.target.value)}
                className="input w-full"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Days after which an incomplete follow-up is flagged as overdue to the ASM.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Require GPS on Field Visits
              </label>
              <select
                value={formData.gps_tracking_required || 'true'}
                onChange={(e) => handleChange('gps_tracking_required', e.target.value)}
                className="input w-full"
              >
                <option value="true">Mandatory (GPS location captured on visit)</option>
                <option value="false">Optional (Allow visits without GPS)</option>
              </select>
              <p className="text-[11px] text-gray-400 mt-1">
                Field executives must allow location access when submitting visit logs.
              </p>
            </div>
          </div>
        </div>

        {/* Aquaculture Safety Thresholds */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-gray-100 pb-3">
            <BeakerIcon className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-gray-900">Aquaculture Alert Thresholds</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Min Dissolved Oxygen (ppm)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.min_dissolved_oxygen_ppm || ''}
                onChange={(e) => handleChange('min_dissolved_oxygen_ppm', e.target.value)}
                placeholder="4.0"
                className="input w-full"
              />
              <p className="text-[11px] text-gray-400 mt-1">Critical threshold below which alert is triggered.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Optimal pH Range (Min - Max)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={formData.optimal_ph_min || ''}
                  onChange={(e) => handleChange('optimal_ph_min', e.target.value)}
                  placeholder="7.5"
                  className="input w-full"
                />
                <span className="text-gray-400 text-xs font-bold">to</span>
                <input
                  type="number"
                  step="0.1"
                  value={formData.optimal_ph_max || ''}
                  onChange={(e) => handleChange('optimal_ph_max', e.target.value)}
                  placeholder="8.5"
                  className="input w-full"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Standard safe shrimp pond pH limits.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Salinity Safe Range (ppt)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="1"
                  value={formData.optimal_salinity_min || ''}
                  onChange={(e) => handleChange('optimal_salinity_min', e.target.value)}
                  placeholder="5"
                  className="input w-full"
                />
                <span className="text-gray-400 text-xs font-bold">to</span>
                <input
                  type="number"
                  step="1"
                  value={formData.optimal_salinity_max || ''}
                  onChange={(e) => handleChange('optimal_salinity_max', e.target.value)}
                  placeholder="35"
                  className="input w-full"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Acceptable brackish culture salinity.</p>
            </div>
          </div>
        </div>

        {/* Administration Links */}
        <div className="card p-6 bg-gradient-to-r from-gray-50 to-blue-50/20 border border-gray-200">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Quick Admin Administration</h3>
          <p className="text-xs text-gray-500 mb-4">
            Manage individual users, roles, and technical team accounts.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/users"
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:text-blue-600 hover:border-blue-300 shadow-xs transition"
            >
              <UsersIcon className="w-4 h-4 text-blue-600" />
              Manage Users & Roles →
            </Link>
            <Link
              to="/profile"
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:text-blue-600 hover:border-blue-300 shadow-xs transition"
            >
              <UserCircleIcon className="w-4 h-4 text-emerald-600" />
              Update My Password & Profile →
            </Link>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="btn-primary"
          >
            {updateMutation.isPending ? 'Saving Settings...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
