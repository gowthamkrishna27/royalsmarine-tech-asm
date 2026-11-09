import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { clientApi, userApi } from '../../services/api';
import { CLIENT_TYPES, SOIL_TYPES, POND_STATUSES } from '../../constants';
import toast from 'react-hot-toast';
import Spinner from '../../components/common/Spinner';
import Modal from '../../components/common/Modal';
import TankMapPickerModal from '../../components/common/TankMapPickerModal';
import { MapPinIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { MapPinIcon as MapPinSolidIcon, PlayIcon as PlaySolidIcon } from '@heroicons/react/24/solid';

export default function ClientForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isManagerOrAdmin = ['super_admin', 'admin', 'sales_manager'].includes(user?.role);
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [mapTarget, setMapTarget] = useState(null); // null | { type: 'farm' } | { type: 'tank', index: number, mode?: 'pin'|'walk' }
  const [mappingChoiceTarget, setMappingChoiceTarget] = useState(null); // null | { type: 'tank', index: number }

  const { data: teamUsers } = useQuery({
    queryKey: ['team-users'],
    queryFn: () => userApi.list({ limit: 100, status: 'active' }).then(r => r.data.data),
    enabled: isManagerOrAdmin,
  });
  const [tanks, setTanks] = useState(
    isEdit
      ? []
      : [
          {
            tank_number: 'Tank 1',
            pond_name: 'Tank 1',
            tank_size: '',
            area_acres: '',
            salinity: '',
            soil_type: 'loam',
            hatchery_name: '',
            brooder: '',
            seed_date: '',
            stocking_quantity_lakhs: '',
            feed_type: '',
            doc: '',
            status: 'active',
            latitude: '',
            longitude: '',
            gps_address: '',
            remarks: '',
          },
        ]
  );

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      status: 'active',
      client_type: 'new_prospect',
      number_of_tanks: isEdit ? '' : 1,
    }
  });

  const { data: existing } = useQuery({
    queryKey: ['client', id],
    queryFn: () => clientApi.get(id).then(r => r.data.data),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      Object.entries(existing).forEach(([k, v]) => {
        if (v !== null && k !== 'ponds' && k !== 'brands' && k !== 'categories') {
          setValue(k, v);
        }
      });
      if (existing.ponds && Array.isArray(existing.ponds)) {
        const loadedTanks = existing.ponds.map(p => ({
          ...p,
          tank_number: p.tank_number || p.pond_name || '',
          tank_size: p.tank_size !== undefined && p.tank_size !== null ? p.tank_size : (p.area_acres || ''),
          salinity: p.salinity ?? '',
          soil_type: p.soil_type || 'loam',
          hatchery_name: p.hatchery_name || '',
          brooder: p.brooder || '',
          seed_date: p.seed_date ? p.seed_date.substring(0, 10) : '',
          stocking_quantity_lakhs: p.stocking_quantity_lakhs ?? '',
          feed_type: p.feed_type || '',
          doc: p.doc ?? '',
        }));
        setTanks(loadedTanks);
        setValue('number_of_tanks', existing.number_of_tanks || loadedTanks.length);
      }
    }
  }, [existing, setValue]);

  const addTank = () => {
    setTanks(prev => {
      const nextNum = prev.length + 1;
      const newTanks = [
        ...prev,
        {
          tank_number: `Tank ${nextNum}`,
          pond_name: `Tank ${nextNum}`,
          tank_size: '',
          area_acres: '',
          salinity: '',
          soil_type: 'loam',
          hatchery_name: '',
          brooder: '',
          seed_date: '',
          stocking_quantity_lakhs: '',
          feed_type: '',
          doc: '',
          status: 'active',
          latitude: '',
          longitude: '',
          gps_address: '',
          remarks: '',
        }
      ];
      setValue('number_of_tanks', newTanks.length, { shouldValidate: true });
      return newTanks;
    });
  };

  const updateTankField = (index, field, value) => {
    setTanks(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      if (field === 'tank_number') {
        copy[index].pond_name = value;
      }
      if (field === 'tank_size') {
        copy[index].area_acres = value;
      }
      return copy;
    });
  };

  const removeTank = (index) => {
    setTanks(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      setValue('number_of_tanks', filtered.length, { shouldValidate: true });
      return filtered;
    });
  };

  const handleTankCountChange = (e) => {
    const rawVal = e.target.value;
    setValue('number_of_tanks', rawVal, { shouldValidate: true });
    const count = parseInt(rawVal, 10);
    if (!isNaN(count) && count >= 0) {
      setTanks(prev => {
        if (count === prev.length) return prev;
        if (count > prev.length) {
          const additional = Array.from({ length: count - prev.length }, (_, i) => {
            const nextNum = prev.length + i + 1;
            return {
              tank_number: `Tank ${nextNum}`,
              pond_name: `Tank ${nextNum}`,
              tank_size: '',
              area_acres: '',
              salinity: '',
              soil_type: 'loam',
              hatchery_name: '',
              brooder: '',
              seed_date: '',
              stocking_quantity_lakhs: '',
              feed_type: '',
              doc: '',
              status: 'active',
              latitude: '',
              longitude: '',
              gps_address: '',
              remarks: '',
            };
          });
          return [...prev, ...additional];
        } else {
          return prev.slice(0, count);
        }
      });
    } else if (rawVal === '') {
      setTanks([]);
    }
  };

  const onSubmit = async (data) => {
    setLoading(true);
    const payload = {
      ...data,
      number_of_tanks: tanks.length > 0 ? tanks.length : (data.number_of_tanks || 0),
      ponds: tanks.map(t => ({
        ...t,
        pond_name: t.tank_number || t.pond_name,
        area_acres: t.tank_size || t.area_acres || null,
        tank_size: t.tank_size || t.area_acres || null,
      })),
    };

    try {
      if (isEdit) {
        await clientApi.update(id, payload);
        await Promise.all([
          qc.invalidateQueries({ queryKey: ['clients'] }),
          qc.invalidateQueries({ queryKey: ['clients-list'] }),
          qc.invalidateQueries({ queryKey: ['client', id] }),
          qc.invalidateQueries({ queryKey: ['client-profile', id] }),
        ]);
        toast.success('Farmer updated successfully');
      } else {
        const res = await clientApi.create(payload);
        await Promise.all([
          qc.invalidateQueries({ queryKey: ['clients'] }),
          qc.invalidateQueries({ queryKey: ['clients-list'] }),
        ]);
        toast.success('Farmer created successfully');
        navigate(`/clients/${res.data.data.id}`);
        return;
      }
      navigate(`/clients/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save farmer');
    } finally {
      setLoading(false);
    }
  };

  const lat = watch('latitude');
  const lng = watch('longitude');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="page-header">
        <h1 className="page-title">{isEdit ? 'Edit Farmer' : 'Add New Farmer'}</h1>
        <p className="text-sm text-gray-500">Record farmer details and tank information</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* 1. Basic Information */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900">1. Basic Information</h3>
          </div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Farmer Name */}
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="label">Farmer Name <span className="text-red-500">*</span></label>
              <input
                {...register('company_name', { required: 'Farmer name is required' })}
                placeholder="e.g. Ramesh Reddy"
                className={`input ${errors.company_name ? 'input-error' : ''}`}
              />
              {errors.company_name && <p className="form-error">{errors.company_name.message}</p>}
            </div>

            {/* Phone Number */}
            <div>
              <label className="label">Phone Number <span className="text-red-500">*</span></label>
              <input
                {...register('mobile', { required: 'Phone number is required' })}
                type="tel"
                placeholder="e.g. 9876543210"
                className={`input ${errors.mobile ? 'input-error' : ''}`}
              />
              {errors.mobile && <p className="form-error">{errors.mobile.message}</p>}
            </div>

            {/* Area */}
            <div>
              <label className="label">Area / Mandal <span className="text-red-500">*</span></label>
              <input
                {...register('area', { required: 'Area is required' })}
                placeholder="e.g. Bapatla"
                className={`input ${errors.area ? 'input-error' : ''}`}
              />
              {errors.area && <p className="form-error">{errors.area.message}</p>}
            </div>

            {/* Village */}
            <div>
              <label className="label">Village</label>
              <input
                {...register('village')}
                placeholder="e.g. Pedagadelavaripalem"
                className="input"
              />
            </div>

            {/* Farm Extent in Acres */}
            <div>
              <label className="label">Farm Extent (in Acres) <span className="text-red-500">*</span></label>
              <input
                {...register('farm_extent_acres', { required: 'Farm extent in acres is required' })}
                type="number"
                step="0.01"
                placeholder="e.g. 5.5"
                className={`input ${errors.farm_extent_acres ? 'input-error' : ''}`}
              />
              {errors.farm_extent_acres && <p className="form-error">{errors.farm_extent_acres.message}</p>}
            </div>

            {/* Number of Tanks */}
            <div>
              <label className="label">Number of Tanks <span className="text-red-500">*</span></label>
              <input
                {...register('number_of_tanks', {
                  required: 'Number of tanks is required',
                  min: { value: 1, message: 'Must have at least 1 tank' }
                })}
                type="number"
                min="1"
                placeholder="e.g. 4"
                onChange={handleTankCountChange}
                className={`input ${errors.number_of_tanks ? 'input-error' : ''}`}
              />
              {errors.number_of_tanks && <p className="form-error">{errors.number_of_tanks.message}</p>}
            </div>

            {/* Alternate Phone */}
            <div>
              <label className="label">Alternate Phone</label>
              <input
                {...register('alternate_mobile')}
                type="tel"
                placeholder="Optional secondary phone"
                className="input"
              />
            </div>

            {/* Farmer Type */}
            <div>
              <label className="label">Farmer Type</label>
              <select {...register('client_type')} className="input">
                {CLIENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="label">Status</label>
              <select {...register('status')} className="input">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="forcely_closed">Forcely Closed</option>
              </select>
            </div>

            {/* Assigned Salesperson (Visible to Managers and Admins) */}
            {isManagerOrAdmin && (
              <div>
                <label className="label">Assigned Technical Executive</label>
                <select {...register('assigned_salesperson_id')} className="input">
                  <option value="">Self / Default ({user?.full_name || 'Current User'})</option>
                  {teamUsers?.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role?.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* GPS Location Capture */}
            <div className="sm:col-span-2 lg:col-span-3 flex items-center justify-between pt-2 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMapTarget({ type: 'farm' })}
                  className="btn-secondary btn-sm flex items-center gap-1.5"
                >
                  <MapPinIcon className="w-4 h-4 text-gray-400" />
                  <span>{lat ? 'Location Set ✓' : 'Pin Farm on Map'}</span>
                </button>
                {lat && lng && (
                  <span className="text-xs text-gray-500 font-mono">
                    {Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Tank Information */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">2. Tank Information</h3>
              <p className="text-xs text-gray-500">{tanks.length} tank{tanks.length === 1 ? '' : 's'} registered</p>
            </div>
            <button
              type="button"
              onClick={addTank}
              className="btn-primary btn-sm flex items-center gap-1"
            >
              <PlusIcon className="w-4 h-4" /> Add Tank
            </button>
          </div>

          <div className="p-4 space-y-4">
            {tanks.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg">
                <p className="text-sm text-gray-500 mb-2">No tanks added yet</p>
                <button
                  type="button"
                  onClick={addTank}
                  className="btn-secondary btn-sm inline-flex items-center gap-1"
                >
                  <PlusIcon className="w-4 h-4" /> Add First Tank
                </button>
              </div>
            ) : (
              tanks.map((tank, idx) => (
                <div
                  key={idx}
                  className="p-4 border border-gray-200 rounded-lg bg-gray-50/60 space-y-3 relative"
                >
                  {/* Tank Header */}
                  <div className="flex items-center justify-between border-b border-gray-200/80 pb-2">
                    <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                      Tank #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeTank(idx)}
                      className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                      title="Remove tank"
                    >
                      <TrashIcon className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>

                  {/* Tank Fields Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Tank Number */}
                    <div>
                      <label className="label text-xs">Tank Number <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={tank.tank_number || ''}
                        onChange={(e) => updateTankField(idx, 'tank_number', e.target.value)}
                        placeholder="e.g. Tank 1 / T-1"
                        className="input py-1.5 text-sm"
                        required
                      />
                    </div>

                    {/* Tank Size */}
                    <div>
                      <label className="label text-xs">Tank Size (in Acres)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={tank.tank_size ?? ''}
                        onChange={(e) => updateTankField(idx, 'tank_size', e.target.value)}
                        placeholder="e.g. 1.25"
                        className="input py-1.5 text-sm"
                      />
                    </div>

                    {/* Salinity */}
                    <div>
                      <label className="label text-xs">Salinity (ppt)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={tank.salinity ?? ''}
                        onChange={(e) => updateTankField(idx, 'salinity', e.target.value)}
                        placeholder="e.g. 12"
                        className="input py-1.5 text-sm"
                      />
                    </div>

                    {/* Soil Type */}
                    <div>
                      <label className="label text-xs">Soil Type</label>
                      <select
                        value={tank.soil_type || 'loam'}
                        onChange={(e) => updateTankField(idx, 'soil_type', e.target.value)}
                        className="input py-1.5 text-sm"
                      >
                        {SOIL_TYPES.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Hatchery Name */}
                    <div>
                      <label className="label text-xs">Hatchery Name</label>
                      <input
                        type="text"
                        value={tank.hatchery_name || ''}
                        onChange={(e) => updateTankField(idx, 'hatchery_name', e.target.value)}
                        placeholder="e.g. BMR / Golden"
                        className="input py-1.5 text-sm"
                      />
                    </div>

                    {/* Brooder */}
                    <div>
                      <label className="label text-xs">Brooder</label>
                      <input
                        type="text"
                        value={tank.brooder || ''}
                        onChange={(e) => updateTankField(idx, 'brooder', e.target.value)}
                        placeholder="e.g. Kona Bay / SIS"
                        className="input py-1.5 text-sm"
                      />
                    </div>

                    {/* Seed Date */}
                    <div>
                      <label className="label text-xs">Seed Date</label>
                      <input
                        type="date"
                        value={tank.seed_date || ''}
                        onChange={(e) => updateTankField(idx, 'seed_date', e.target.value)}
                        className="input py-1.5 text-sm"
                      />
                    </div>

                    {/* DOC (Day of Culture) */}
                    <div>
                      <label className="label text-xs">DOC (Day of Culture)</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={tank.doc ?? ''}
                        onChange={(e) => updateTankField(idx, 'doc', e.target.value)}
                        placeholder="e.g. 15"
                        className="input py-1.5 text-sm"
                      />
                      {tank.doc !== '' && tank.doc != null && !tank.seed_date && (
                        <p className="text-[10px] text-blue-600 mt-0.5">Auto-increments daily from today when saved</p>
                      )}
                    </div>

                    {/* Seed Stocking Quantity in Lakhs */}
                    <div>
                      <label className="label text-xs">Seed Stocking Quantity (in Lakhs)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={tank.stocking_quantity_lakhs ?? ''}
                        onChange={(e) => updateTankField(idx, 'stocking_quantity_lakhs', e.target.value)}
                        placeholder="e.g. 1.50"
                        className="input py-1.5 text-sm"
                      />
                    </div>

                    {/* Feed Type */}
                    <div>
                      <label className="label text-xs">Feed Type</label>
                      <input
                        type="text"
                        value={tank.feed_type || ''}
                        onChange={(e) => updateTankField(idx, 'feed_type', e.target.value)}
                        placeholder="e.g. CP / Avanti / Starter"
                        className="input py-1.5 text-sm"
                      />
                    </div>
                  </div>

                  {/* Tank Coordinates & Mapping Action */}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setMappingChoiceTarget({ type: 'tank', index: idx })}
                      className="btn-secondary btn-sm py-1.5 px-3 text-xs flex items-center gap-1.5 hover:border-blue-500 hover:text-blue-700 transition shadow-xs"
                      title="Choose mapping method: Pin on Map or Walk around the tank"
                    >
                      <MapPinIcon className="w-3.5 h-3.5 text-blue-600" />
                      <span className="font-semibold">{tank.latitude ? 'Location Set ✓' : 'Pin on Map'}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      {tank.latitude && tank.longitude && (
                        <span className="text-xs text-gray-500 font-mono">
                          {Number(tank.latitude).toFixed(4)}, {Number(tank.longitude).toFixed(4)}
                        </span>
                      )}
                      {tank.area_acres && (
                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          {Number(tank.area_acres).toFixed(2)} Ac
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Remarks / Notes */}
        <div className="card">
          <div className="card-header"><h3 className="font-semibold text-gray-900">Remarks & Notes</h3></div>
          <div className="card-body">
            <textarea
              {...register('notes')}
              rows={2}
              placeholder="Any additional notes about the farmer or farm..."
              className="input"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end sm:pr-20 pb-8 sm:pb-12">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? <><Spinner size="sm" /> Saving...</> : isEdit ? 'Update Farmer' : 'Create Farmer'}
          </button>
        </div>
      </form>

      {/* Choice Modal: 1. Pin a tank | 2. Walk around the tank */}
      {mappingChoiceTarget && (
        <Modal
          open={Boolean(mappingChoiceTarget)}
          onClose={() => setMappingChoiceTarget(null)}
          title={`Map Location: ${
            tanks[mappingChoiceTarget.index]?.tank_number || `Tank ${mappingChoiceTarget.index + 1}`
          }`}
          size="sm"
        >
          <div className="space-y-3 py-1">
            <p className="text-xs text-gray-600">
              Choose how you want to set the location for{' '}
              <strong className="text-gray-900">
                {tanks[mappingChoiceTarget.index]?.tank_number || `Tank ${mappingChoiceTarget.index + 1}`}
              </strong>
              :
            </p>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Option 1: Pin a Tank */}
              <button
                type="button"
                onClick={() => {
                  const target = mappingChoiceTarget;
                  setMappingChoiceTarget(null);
                  setMapTarget({ ...target, mode: 'pin' });
                }}
                className="w-full p-3.5 rounded-xl border border-gray-200 hover:border-blue-500 hover:bg-blue-50/50 transition text-left flex items-start gap-3 group focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-xs"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <MapPinSolidIcon className="w-5 h-5 text-red-600" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-gray-900 group-hover:text-blue-700">
                      1. Pin a Tank
                    </h4>
                    <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">
                      Satellite Tap
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Click anywhere directly on the satellite map to pinpoint the tank location.
                  </p>
                </div>
              </button>

              {/* Option 2: Walk around the tank */}
              <button
                type="button"
                onClick={() => {
                  const target = mappingChoiceTarget;
                  setMappingChoiceTarget(null);
                  setMapTarget({ ...target, mode: 'walk' });
                }}
                className="w-full p-3.5 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition text-left flex items-start gap-3 group focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-xs"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <PlaySolidIcon className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-gray-900 group-hover:text-emerald-700">
                      2. Walk around the tank
                    </h4>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                      Live GPS Walk
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Walk around the tank perimeter with Start, Finish, Restart / Edit to track the route and auto-calculate acreage.
                  </p>
                </div>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setMappingChoiceTarget(null)}
                className="btn-secondary btn-sm px-4 py-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Map Picker Modal for Farm or Tank */}
      {mapTarget && (
        <TankMapPickerModal
          open={Boolean(mapTarget)}
          onClose={() => setMapTarget(null)}
          tankName={
            mapTarget.type === 'farm'
              ? 'Farm'
              : (tanks[mapTarget.index]?.tank_number || `Tank ${mapTarget.index + 1}`)
          }
          initialMode={mapTarget.mode || 'pin'}
          initialCoords={
            mapTarget.type === 'farm'
              ? (lat && lng ? { latitude: lat, longitude: lng } : null)
              : (tanks[mapTarget.index]?.latitude && tanks[mapTarget.index]?.longitude
                  ? {
                      latitude: tanks[mapTarget.index].latitude,
                      longitude: tanks[mapTarget.index].longitude,
                    }
                  : null)
          }
          defaultCenter={
            lat && lng ? { latitude: lat, longitude: lng } : null
          }
          onConfirm={(coords) => {
            if (mapTarget.type === 'farm') {
              setValue('latitude', coords.latitude);
              setValue('longitude', coords.longitude);
              setValue('gps_captured_at', new Date().toISOString());
              toast.success('Farm coordinates set from map');
            } else if (mapTarget.type === 'tank') {
              const targetIdx = mapTarget.index;
              updateTankField(targetIdx, 'latitude', coords.latitude);
              updateTankField(targetIdx, 'longitude', coords.longitude);
              if (coords.area_acres) {
                updateTankField(targetIdx, 'tank_size', String(coords.area_acres));
                updateTankField(targetIdx, 'area_acres', String(coords.area_acres));
              }
              if (coords.polygon_coordinates) {
                updateTankField(targetIdx, 'polygon_coordinates', coords.polygon_coordinates);
              }
              toast.success(
                `Tank mapped successfully${
                  coords.area_acres ? ` (${coords.area_acres} Ac)` : ''
                } for ${tanks[targetIdx]?.tank_number || 'Tank'}`
              );
            }
          }}
        />
      )}
    </div>
  );
}
