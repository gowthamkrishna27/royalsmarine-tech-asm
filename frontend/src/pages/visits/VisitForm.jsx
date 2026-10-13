import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { visitApi, clientApi } from '../../services/api';
import toast from 'react-hot-toast';
import Spinner from '../../components/common/Spinner';
import { MapPinIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

const WATER_COLOUR_OPTIONS = [
  'Light Green',
  'Dark Green',
  'Brownish Green',
  'Brown',
  'Clear',
  'Turbid',
  'Golden Brown',
  'Other',
];

const MEDICATION_CATEGORIES = [
  { value: 'probiotics', label: 'Probiotics' },
  { value: 'minerals', label: 'Minerals' },
  { value: 'feed_supplements', label: 'Feed Supplements' },
  { value: 'sanitizers', label: 'Sanitizers' },
  { value: 'toxic_gas_controllers', label: 'Toxic Gas Controllers' },
  { value: 'other', label: 'Other' },
];

export default function VisitForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsCoords, setGpsCoords] = useState(null);

  // 3. Water Quality state
  const [waterQuality, setWaterQuality] = useState({
    date: new Date().toISOString().split('T')[0],
    doc: '',
    salinity: '',
    ph: '',
    alkalinity: '',
    hardness: '',
    ammonia: '',
    nitrite: '',
    dissolved_oxygen: '',
    potassium: '',
    hydrogen_sulphide: '',
    chlorine: '',
    iron: '',
    water_colour: 'Light Green',
  });

  // 4. Feeding Details state
  const [feedingDetails, setFeedingDetails] = useState({
    doc: '',
    date: new Date().toISOString().split('T')[0],
    seed_quantity: '',
    abw: '',
    daily_feed_quantity: '',
    cumulative_feed: '',
    total_biomass: '',
    fcr: '',
    check_tray_feed_quantity: '',
    check_tray_observation_time: '',
    remarks: '',
  });

  // 5. Medication Details state
  const [medications, setMedications] = useState([]);

  // 6. Harvest Details state
  const [partialHarvests, setPartialHarvests] = useState([]);
  const [finalHarvest, setFinalHarvest] = useState({
    date: '',
    doc: '',
    abw: '',
    harvested_quantity: '',
    harvested_biomass: '',
  });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      visit_date: new Date().toISOString().split('T')[0],
      visit_time: new Date().toTimeString().slice(0, 5),
      meeting_type: 'casual',
    }
  });

  const clientId = watch('client_id');
  const visitDate = watch('visit_date');
  const meetingType = watch('meeting_type') || 'casual';

  // Conditional visibility based on meeting/visit type
  const showWaterQuality = meetingType === 'water_quality' || meetingType === 'all';
  const showFeeding = meetingType === 'feeding_details' || meetingType === 'all';
  const showMedication = meetingType === 'medication_details' || meetingType === 'all';
  const showHarvest = meetingType === 'harvest_details' || meetingType === 'all';

  // Load clients
  const { data: clients } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => clientApi.list({ limit: 200, status: 'active' }).then(r => r.data.data),
  });

  // Load selected client's full details (tanks)
  const { data: selectedClient } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => clientApi.get(clientId).then(r => r.data.data),
    enabled: Boolean(clientId),
  });

  // Load existing visit
  const { data: existingVisit } = useQuery({
    queryKey: ['visit', id],
    queryFn: () => visitApi.get(id).then(r => r.data.data),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existingVisit) {
      Object.entries(existingVisit).forEach(([k, v]) => {
        if (v !== null && k !== 'water_quality' && k !== 'feeding_details' && k !== 'medication_details' && k !== 'harvest_details') {
          setValue(k, v);
        }
      });
      if (existingVisit.latitude && existingVisit.longitude) {
        setGpsCoords({ lat: parseFloat(existingVisit.latitude), lng: parseFloat(existingVisit.longitude) });
      }
      if (existingVisit.water_quality) {
        setWaterQuality(prev => ({ ...prev, ...existingVisit.water_quality }));
      }
      if (existingVisit.feeding_details) {
        setFeedingDetails(prev => ({ ...prev, ...existingVisit.feeding_details }));
      }
      if (existingVisit.medication_details && Array.isArray(existingVisit.medication_details)) {
        setMedications(existingVisit.medication_details);
      }
      if (existingVisit.harvest_details) {
        if (Array.isArray(existingVisit.harvest_details.partial_harvests)) {
          setPartialHarvests(existingVisit.harvest_details.partial_harvests);
        }
        if (existingVisit.harvest_details.final_harvest) {
          setFinalHarvest(prev => ({ ...prev, ...existingVisit.harvest_details.final_harvest }));
        }
      }
    }
  }, [existingVisit, setValue]);

  // Handle Tank selection and auto-calculate DOC & Seed Qty
  const handleTankSelection = (e) => {
    const chosenTankNum = e.target.value;
    setValue('tank_number', chosenTankNum);

    const foundTank = selectedClient?.ponds?.find(
      p => (p.tank_number || p.pond_name) === chosenTankNum
    );

    if (foundTank) {
      setValue('tank_id', foundTank.id);

      if (foundTank.seed_date && visitDate) {
        const seedDate = new Date(foundTank.seed_date);
        const vDate = new Date(visitDate);
        const diffDays = Math.max(0, Math.floor((vDate - seedDate) / (1000 * 60 * 60 * 24)));
        setWaterQuality(prev => ({ ...prev, doc: diffDays }));
        setFeedingDetails(prev => ({ ...prev, doc: diffDays }));
      }

      if (foundTank.stocking_quantity_lakhs) {
        setFeedingDetails(prev => ({ ...prev, seed_quantity: foundTank.stocking_quantity_lakhs }));
      }
    }
  };

  // Auto calculate FCR
  useEffect(() => {
    const cumFeed = parseFloat(feedingDetails.cumulative_feed);
    const biomass = parseFloat(feedingDetails.total_biomass);
    if (!isNaN(cumFeed) && !isNaN(biomass) && biomass > 0) {
      const calculatedFcr = (cumFeed / biomass).toFixed(2);
      if (calculatedFcr !== feedingDetails.fcr) {
        setFeedingDetails(prev => ({ ...prev, fcr: calculatedFcr }));
      }
    }
  }, [feedingDetails.cumulative_feed, feedingDetails.total_biomass]);

  // Medication handlers
  const addMedication = () => {
    setMedications(prev => [
      ...prev,
      {
        id: Date.now(),
        treatment_type: 'preventive',
        category: 'probiotics',
        product_name: '',
        dosage: '',
        disease_identification: '',
        remarks: '',
      }
    ]);
  };

  const updateMedication = (index, field, value) => {
    setMedications(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const removeMedication = (index) => {
    setMedications(prev => prev.filter((_, i) => i !== index));
  };

  // Harvest handlers
  const addPartialHarvest = () => {
    if (partialHarvests.length >= 3) {
      toast.error('Maximum 3 partial harvest records');
      return;
    }
    setPartialHarvests(prev => [
      ...prev,
      {
        harvest_no: prev.length + 1,
        date: visitDate || new Date().toISOString().split('T')[0],
        doc: waterQuality.doc || '',
        abw: '',
        harvested_quantity: '',
        harvested_biomass: '',
      }
    ]);
  };

  const updatePartialHarvest = (index, field, value) => {
    setPartialHarvests(prev => {
      const copy = [...prev];
      const updated = { ...copy[index], [field]: value };

      if (field === 'harvested_quantity' || field === 'abw') {
        const qty = parseFloat(field === 'harvested_quantity' ? value : updated.harvested_quantity);
        const abwVal = parseFloat(field === 'abw' ? value : updated.abw);
        if (!isNaN(qty) && !isNaN(abwVal) && qty > 0 && abwVal > 0) {
          updated.harvested_biomass = ((qty * abwVal) / 1000).toFixed(2);
        }
      }

      copy[index] = updated;
      return copy;
    });
  };

  const removePartialHarvest = (index) => {
    setPartialHarvests(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((item, idx) => ({ ...item, harvest_no: idx + 1 }));
    });
  };

  const updateFinalHarvest = (field, value) => {
    setFinalHarvest(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'harvested_quantity' || field === 'abw') {
        const qty = parseFloat(field === 'harvested_quantity' ? value : updated.harvested_quantity);
        const abwVal = parseFloat(field === 'abw' ? value : updated.abw);
        if (!isNaN(qty) && !isNaN(abwVal) && qty > 0 && abwVal > 0) {
          updated.harvested_biomass = ((qty * abwVal) / 1000).toFixed(2);
        }
      }
      return updated;
    });
  };

  // Harvest summary derived
  const harvestDerived = useMemo(() => {
    let totalBiomass = 0;
    let totalHarvestQty = 0;

    partialHarvests.forEach(p => {
      const b = parseFloat(p.harvested_biomass);
      const q = parseFloat(p.harvested_quantity);
      if (!isNaN(b)) totalBiomass += b;
      if (!isNaN(q)) totalHarvestQty += q;
    });

    const finalB = parseFloat(finalHarvest.harvested_biomass);
    const finalQ = parseFloat(finalHarvest.harvested_quantity);
    if (!isNaN(finalB)) totalBiomass += finalB;
    if (!isNaN(finalQ)) totalHarvestQty += finalQ;

    const totalFeed = parseFloat(feedingDetails.cumulative_feed) || 0;
    const fcr = totalBiomass > 0 && totalFeed > 0 ? (totalFeed / totalBiomass).toFixed(2) : '—';

    let survivalPct = '—';
    const initialSeedLakhs = parseFloat(feedingDetails.seed_quantity);
    if (!isNaN(initialSeedLakhs) && initialSeedLakhs > 0 && totalHarvestQty > 0) {
      const totalInitialCount = initialSeedLakhs * 100000;
      survivalPct = ((totalHarvestQty / totalInitialCount) * 100).toFixed(1) + '%';
    }

    return {
      total_biomass: totalBiomass > 0 ? totalBiomass.toFixed(2) : '—',
      total_feed: totalFeed > 0 ? totalFeed.toFixed(2) : '—',
      fcr,
      total_harvest_qty: totalHarvestQty > 0 ? totalHarvestQty.toLocaleString() : '—',
      survival_percentage: survivalPct,
    };
  }, [partialHarvests, finalHarvest, feedingDetails.cumulative_feed, feedingDetails.seed_quantity]);

  // GPS Capture helper
  const captureGPS = async () => {
    setGpsLoading(true);
    try {
      const { gpsService } = await import('../../services/gpsService');
      const pos = await gpsService.getCurrentCoordinates();
      const coords = { lat: pos.lat, lng: pos.lng };
      setGpsCoords(coords);
      setValue('latitude', coords.lat);
      setValue('longitude', coords.lng);
      setValue('gps_captured_at', pos.timestamp);

      gpsService.reverseGeocode(coords.lat, coords.lng).then(addr => {
        setValue('gps_address', addr);
      }).catch(() => {});

      return coords;
    } catch (err) {
      console.warn('GPS auto-capture:', err?.message || err);
      return null;
    } finally {
      setGpsLoading(false);
    }
  };

  // Silently initiate background GPS capture on load for new visits
  useEffect(() => {
    if (!isEdit && !gpsCoords) {
      captureGPS();
    }
  }, []);

  const onSubmit = async (data) => {
    setLoading(true);

    // Auto-capture GPS if not already present
    let activeCoords = gpsCoords;
    if (!activeCoords) {
      try {
        activeCoords = await captureGPS();
      } catch {
        activeCoords = null;
      }
    }

    const payload = {
      ...data,
      latitude: activeCoords?.lat || data.latitude || null,
      longitude: activeCoords?.lng || data.longitude || null,
      gps_captured_at: data.gps_captured_at || (activeCoords ? new Date().toISOString() : null),
      gps_denied_reason: activeCoords ? null : (data.gps_denied_reason || 'Location unavailable'),
      water_quality: showWaterQuality ? waterQuality : null,
      feeding_details: showFeeding ? feedingDetails : null,
      medication_details: showMedication ? medications : null,
      harvest_details: showHarvest ? {
        partial_harvests: partialHarvests,
        final_harvest: finalHarvest,
        derived: harvestDerived,
      } : null,
    };

    try {
      if (isEdit) {
        await visitApi.update(id, payload);
        toast.success('Visit updated successfully');
      } else {
        const res = await visitApi.create(payload);
        toast.success('Visit logged successfully');
        navigate(`/visits/${res.data.data.id}`);
        return;
      }
      navigate(`/visits/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save visit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="page-header">
        <h1 className="page-title">{isEdit ? 'Edit Visit' : 'Log Visit'}</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Visit Details */}
        <div className="card">
          <div className="card-header py-2.5 px-4"><h3 className="font-semibold text-gray-900 text-sm">Visit Details</h3></div>
          <div className="card-body p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="label text-[11px] mb-1">Date <span className="text-red-500">*</span></label>
                <input type="date" {...register('visit_date', { required: true })} className="input text-xs py-1" />
              </div>
              <div>
                <label className="label text-[11px] mb-1">Time <span className="text-red-500">*</span></label>
                <input type="time" {...register('visit_time', { required: true })} className="input text-xs py-1" />
              </div>
              <div>
                <label className="label text-[11px] mb-1">Farmer <span className="text-red-500">*</span></label>
                <select {...register('client_id', { required: 'Farmer required' })} className={`input text-xs py-1 ${errors.client_id ? 'input-error' : ''}`}>
                  <option value="">Select farmer...</option>
                  {clients?.map(c => <option key={c.id} value={c.id}>{c.company_name} — {c.city || c.area || ''}</option>)}
                </select>
                {errors.client_id && <p className="form-error">{errors.client_id.message}</p>}
              </div>
              <div>
                <label className="label text-[11px] mb-1">Tank / Pond</label>
                <select
                  {...register('tank_number')}
                  onChange={handleTankSelection}
                  className="input text-xs py-1"
                >
                  <option value="">Select tank...</option>
                  {selectedClient?.ponds?.map(p => (
                    <option key={p.id} value={p.tank_number || p.pond_name}>
                      {p.tank_number || p.pond_name} {p.area_acres ? `(${p.area_acres} ac)` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Meeting Type & GPS Row */}
            <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <div className="w-full sm:w-80">
                <label className="label text-[11px] mb-1">Meeting / Visit Type</label>
                <select {...register('meeting_type')} className="input text-xs py-1">
                  <option value="casual">Casual Visit</option>
                  <option value="water_quality">Water Quality</option>
                  <option value="feeding_details">Feeding Details</option>
                  <option value="medication_details">Medication & Treatments</option>
                  <option value="harvest_details">Harvest Details</option>
                  <option value="all">All Details (Full Inspection)</option>
                </select>
              </div>

              {/* Automatic GPS Indicator */}
              <div className="flex items-center gap-1.5 self-end text-xs text-gray-500">
                <MapPinIcon className="w-3.5 h-3.5 text-gray-400" />
                {gpsCoords ? (
                  <span className="font-mono text-gray-600">
                    {gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)} ✓
                  </span>
                ) : (
                  <span className="text-gray-400">
                    {gpsLoading ? 'Acquiring GPS...' : 'Auto-captured on submit'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Water Quality (Only displays when selected) */}
        {showWaterQuality && (
          <div className="card">
            <div className="card-header py-2.5 px-4"><h3 className="font-semibold text-gray-900 text-sm">Water Quality</h3></div>
            <div className="card-body p-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              <div>
                <label className="label text-[11px] mb-1">Test Date</label>
                <input
                  type="date"
                  value={waterQuality.date || ''}
                  onChange={e => setWaterQuality(p => ({ ...p, date: e.target.value }))}
                  className="input text-xs py-1"
                />
              </div>
              <div>
                <label className="label text-[11px] mb-1">DOC</label>
                <input
                  type="number"
                  value={waterQuality.doc ?? ''}
                  onChange={e => setWaterQuality(p => ({ ...p, doc: e.target.value }))}
                  placeholder="DOC"
                  className="input text-xs py-1"
                />
              </div>
              <div>
                <label className="label text-[11px] mb-1">Salinity (ppt)</label>
                <input
                  type="number"
                  step="0.1"
                  value={waterQuality.salinity ?? ''}
                  onChange={e => setWaterQuality(p => ({ ...p, salinity: e.target.value }))}
                  placeholder="ppt"
                  className="input text-xs py-1"
                />
              </div>
              <div>
                <label className="label text-[11px] mb-1">pH</label>
                <input
                  type="number"
                  step="0.01"
                  value={waterQuality.ph ?? ''}
                  onChange={e => setWaterQuality(p => ({ ...p, ph: e.target.value }))}
                  placeholder="pH"
                  className="input text-xs py-1"
                />
              </div>
              <div>
                <label className="label text-[11px] mb-1">Alkalinity (ppm)</label>
                <input
                  type="number"
                  value={waterQuality.alkalinity ?? ''}
                  onChange={e => setWaterQuality(p => ({ ...p, alkalinity: e.target.value }))}
                  placeholder="ppm"
                  className="input text-xs py-1"
                />
              </div>
              <div>
                <label className="label text-[11px] mb-1">Hardness (ppm)</label>
                <input
                  type="number"
                  value={waterQuality.hardness ?? ''}
                  onChange={e => setWaterQuality(p => ({ ...p, hardness: e.target.value }))}
                  placeholder="ppm"
                  className="input text-xs py-1"
                />
              </div>
              <div>
                <label className="label text-[11px] mb-1">Ammonia (ppm)</label>
                <input
                  type="number"
                  step="0.01"
                  value={waterQuality.ammonia ?? ''}
                  onChange={e => setWaterQuality(p => ({ ...p, ammonia: e.target.value }))}
                  placeholder="ppm"
                  className="input text-xs py-1"
                />
              </div>
              <div>
                <label className="label text-[11px] mb-1">Nitrite (ppm)</label>
                <input
                  type="number"
                  step="0.01"
                  value={waterQuality.nitrite ?? ''}
                  onChange={e => setWaterQuality(p => ({ ...p, nitrite: e.target.value }))}
                  placeholder="ppm"
                  className="input text-xs py-1"
                />
              </div>
              <div>
                <label className="label text-[11px] mb-1">DO (ppm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={waterQuality.dissolved_oxygen ?? ''}
                  onChange={e => setWaterQuality(p => ({ ...p, dissolved_oxygen: e.target.value }))}
                  placeholder="ppm"
                  className="input text-xs py-1"
                />
              </div>
              <div>
                <label className="label text-[11px] mb-1">Potassium (K)</label>
                <input
                  type="number"
                  step="0.1"
                  value={waterQuality.potassium ?? ''}
                  onChange={e => setWaterQuality(p => ({ ...p, potassium: e.target.value }))}
                  placeholder="ppm"
                  className="input text-xs py-1"
                />
              </div>
              <div>
                <label className="label text-[11px] mb-1">H₂S (ppm)</label>
                <input
                  type="number"
                  step="0.001"
                  value={waterQuality.hydrogen_sulphide ?? ''}
                  onChange={e => setWaterQuality(p => ({ ...p, hydrogen_sulphide: e.target.value }))}
                  placeholder="ppm"
                  className="input text-xs py-1"
                />
              </div>
              <div>
                <label className="label text-[11px] mb-1">Chlorine (Cl)</label>
                <input
                  type="number"
                  step="0.01"
                  value={waterQuality.chlorine ?? ''}
                  onChange={e => setWaterQuality(p => ({ ...p, chlorine: e.target.value }))}
                  placeholder="ppm"
                  className="input text-xs py-1"
                />
              </div>
              <div>
                <label className="label text-[11px] mb-1">Iron (Fe)</label>
                <input
                  type="number"
                  step="0.01"
                  value={waterQuality.iron ?? ''}
                  onChange={e => setWaterQuality(p => ({ ...p, iron: e.target.value }))}
                  placeholder="ppm"
                  className="input text-xs py-1"
                />
              </div>
              <div>
                <label className="label text-[11px] mb-1">Water Colour</label>
                <select
                  value={waterQuality.water_colour || 'Light Green'}
                  onChange={e => setWaterQuality(p => ({ ...p, water_colour: e.target.value }))}
                  className="input text-xs py-1"
                >
                  {WATER_COLOUR_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Feeding Details (Only displays when selected) */}
        {showFeeding && (
          <div className="card">
            <div className="card-header py-2.5 px-4"><h3 className="font-semibold text-gray-900 text-sm">Feeding Details</h3></div>
            <div className="card-body p-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
              <div>
                <label className="label text-[11px] mb-1">DOC</label>
                <input
                  type="number"
                  value={feedingDetails.doc ?? ''}
                  onChange={e => setFeedingDetails(p => ({ ...p, doc: e.target.value }))}
                  placeholder="DOC"
                  className="input text-xs py-1"
                />
              </div>
              <div>
                <label className="label text-[11px] mb-1">Date</label>
                <input
                  type="date"
                  value={feedingDetails.date || ''}
                  onChange={e => setFeedingDetails(p => ({ ...p, date: e.target.value }))}
                  className="input text-xs py-1"
                />
              </div>
              <div>
                <label className="label text-[11px] mb-1">Seed Qty (Lakhs)</label>
                <input
                  type="number"
                  step="0.01"
                  value={feedingDetails.seed_quantity ?? ''}
                  onChange={e => setFeedingDetails(p => ({ ...p, seed_quantity: e.target.value }))}
                  placeholder="Lakhs"
                  className="input text-xs py-1"
                />
              </div>
              <div>
                <label className="label text-[11px] mb-1">ABW (g)</label>
                <input
                  type="number"
                  step="0.01"
                  value={feedingDetails.abw ?? ''}
                  onChange={e => setFeedingDetails(p => ({ ...p, abw: e.target.value }))}
                  placeholder="grams"
                  className="input text-xs py-1"
                />
              </div>
              <div>
                <label className="label text-[11px] mb-1">Daily Feed (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={feedingDetails.daily_feed_quantity ?? ''}
                  onChange={e => setFeedingDetails(p => ({ ...p, daily_feed_quantity: e.target.value }))}
                  placeholder="kg"
                  className="input text-xs py-1"
                />
              </div>
              <div>
                <label className="label text-[11px] mb-1">Cumulative Feed (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={feedingDetails.cumulative_feed ?? ''}
                  onChange={e => setFeedingDetails(p => ({ ...p, cumulative_feed: e.target.value }))}
                  placeholder="kg"
                  className="input text-xs py-1"
                />
              </div>
              <div>
                <label className="label text-[11px] mb-1">Total Biomass (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={feedingDetails.total_biomass ?? ''}
                  onChange={e => setFeedingDetails(p => ({ ...p, total_biomass: e.target.value }))}
                  placeholder="kg"
                  className="input text-xs py-1"
                />
              </div>
              <div>
                <label className="label text-[11px] mb-1">FCR (Auto)</label>
                <input
                  type="text"
                  readOnly
                  value={feedingDetails.fcr || '—'}
                  className="input text-xs py-1 bg-gray-50 text-gray-700 font-mono"
                />
              </div>
              <div>
                <label className="label text-[11px] mb-1">Check-Tray Qty</label>
                <input
                  type="text"
                  value={feedingDetails.check_tray_feed_quantity || ''}
                  onChange={e => setFeedingDetails(p => ({ ...p, check_tray_feed_quantity: e.target.value }))}
                  placeholder="e.g. 150g"
                  className="input text-xs py-1"
                />
              </div>
              <div>
                <label className="label text-[11px] mb-1">Check-Tray Obs. Time</label>
                <input
                  type="text"
                  value={feedingDetails.check_tray_observation_time || ''}
                  onChange={e => setFeedingDetails(p => ({ ...p, check_tray_observation_time: e.target.value }))}
                  placeholder="e.g. 1.5 hrs"
                  className="input text-xs py-1"
                />
              </div>
              <div className="col-span-2 sm:col-span-4 lg:col-span-5">
                <input
                  type="text"
                  value={feedingDetails.remarks || ''}
                  onChange={e => setFeedingDetails(p => ({ ...p, remarks: e.target.value }))}
                  placeholder="Feeding remarks..."
                  className="input text-xs py-1"
                />
              </div>
            </div>
          </div>
        )}

        {/* Medication Details (Only displays when selected) */}
        {showMedication && (
          <div className="card">
            <div className="card-header flex items-center justify-between py-2.5 px-4">
              <h3 className="font-semibold text-gray-900 text-sm">Medication & Treatments</h3>
              <button
                type="button"
                onClick={addMedication}
                className="btn-secondary btn-sm py-1 px-2.5 text-xs flex items-center gap-1"
              >
                <PlusIcon className="w-3 h-3" />
                <span>Add Entry</span>
              </button>
            </div>
            <div className="card-body p-4 space-y-2">
              {medications.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No medication entries added. Click &quot;Add Entry&quot; to add.</p>
              ) : (
                medications.map((med, idx) => (
                  <div key={med.id || idx} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-center p-2 rounded-lg bg-gray-50 border border-gray-100">
                    <select
                      value={med.treatment_type || 'preventive'}
                      onChange={e => updateMedication(idx, 'treatment_type', e.target.value)}
                      className="input text-xs py-1"
                    >
                      <option value="preventive">Preventive</option>
                      <option value="curative">Curative</option>
                    </select>

                    <select
                      value={med.category || 'probiotics'}
                      onChange={e => updateMedication(idx, 'category', e.target.value)}
                      className="input text-xs py-1"
                    >
                      {MEDICATION_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>

                    <input
                      type="text"
                      value={med.product_name || ''}
                      onChange={e => updateMedication(idx, 'product_name', e.target.value)}
                      placeholder="Product name"
                      className="input text-xs py-1"
                    />

                    <input
                      type="text"
                      value={med.dosage || ''}
                      onChange={e => updateMedication(idx, 'dosage', e.target.value)}
                      placeholder="Dosage"
                      className="input text-xs py-1"
                    />

                    <input
                      type="text"
                      value={med.disease_identification || ''}
                      onChange={e => updateMedication(idx, 'disease_identification', e.target.value)}
                      placeholder="Disease / target"
                      className="input text-xs py-1"
                    />

                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={med.remarks || ''}
                        onChange={e => updateMedication(idx, 'remarks', e.target.value)}
                        placeholder="Remarks"
                        className="input text-xs py-1 flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => removeMedication(idx)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Harvest Details (Only displays when selected) */}
        {showHarvest && (
          <div className="card">
            <div className="card-header flex items-center justify-between py-2.5 px-4">
              <h3 className="font-semibold text-gray-900 text-sm">Harvest Details</h3>
              {partialHarvests.length < 3 && (
                <button
                  type="button"
                  onClick={addPartialHarvest}
                  className="btn-secondary btn-sm py-1 px-2.5 text-xs flex items-center gap-1"
                >
                  <PlusIcon className="w-3 h-3" />
                  <span>+ Partial Harvest</span>
                </button>
              )}
            </div>

            <div className="card-body p-4 space-y-3">
              {partialHarvests.map((ph, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-gray-50 border border-gray-100 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-gray-600 font-medium">
                    <span>Partial Harvest #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removePartialHarvest(idx)}
                      className="text-gray-400 hover:text-red-600 p-0.5"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <input
                      type="date"
                      value={ph.date || ''}
                      onChange={e => updatePartialHarvest(idx, 'date', e.target.value)}
                      className="input text-xs py-1"
                    />
                    <input
                      type="number"
                      value={ph.doc ?? ''}
                      onChange={e => updatePartialHarvest(idx, 'doc', e.target.value)}
                      placeholder="DOC"
                      className="input text-xs py-1"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={ph.abw ?? ''}
                      onChange={e => updatePartialHarvest(idx, 'abw', e.target.value)}
                      placeholder="ABW (g)"
                      className="input text-xs py-1"
                    />
                    <input
                      type="number"
                      value={ph.harvested_quantity ?? ''}
                      onChange={e => updatePartialHarvest(idx, 'harvested_quantity', e.target.value)}
                      placeholder="Qty (pcs)"
                      className="input text-xs py-1"
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={ph.harvested_biomass ?? ''}
                      onChange={e => updatePartialHarvest(idx, 'harvested_biomass', e.target.value)}
                      placeholder="Biomass (kg)"
                      className="input text-xs py-1 font-mono"
                    />
                  </div>
                </div>
              ))}

              {/* Final Harvest */}
              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100 space-y-1.5">
                <span className="text-xs text-gray-600 font-medium block">Final Harvest</span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <input
                    type="date"
                    value={finalHarvest.date || ''}
                    onChange={e => updateFinalHarvest('date', e.target.value)}
                    className="input text-xs py-1"
                  />
                  <input
                    type="number"
                    value={finalHarvest.doc ?? ''}
                    onChange={e => updateFinalHarvest('doc', e.target.value)}
                    placeholder="DOC"
                    className="input text-xs py-1"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={finalHarvest.abw ?? ''}
                    onChange={e => updateFinalHarvest('abw', e.target.value)}
                    placeholder="ABW (g)"
                    className="input text-xs py-1"
                  />
                  <input
                    type="number"
                    value={finalHarvest.harvested_quantity ?? ''}
                    onChange={e => updateFinalHarvest('harvested_quantity', e.target.value)}
                    placeholder="Qty (pcs)"
                    className="input text-xs py-1"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={finalHarvest.harvested_biomass ?? ''}
                    onChange={e => updateFinalHarvest('harvested_biomass', e.target.value)}
                    placeholder="Biomass (kg)"
                    className="input text-xs py-1 font-mono"
                  />
                </div>
              </div>

              {/* Minimal Summary Strip */}
              <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
                <div>Total Biomass: <span className="font-semibold text-gray-900 font-mono">{harvestDerived.total_biomass} kg</span></div>
                <div>Total Feed: <span className="font-semibold text-gray-900 font-mono">{harvestDerived.total_feed} kg</span></div>
                <div>Overall FCR: <span className="font-semibold text-gray-900 font-mono">{harvestDerived.fcr}</span></div>
                <div>Total Pieces: <span className="font-semibold text-gray-900 font-mono">{harvestDerived.total_harvest_qty}</span></div>
                <div>Survival: <span className="font-semibold text-gray-900 font-mono">{harvestDerived.survival_percentage}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Meeting Notes */}
        <div className="card">
          <div className="card-header py-2.5 px-4"><h3 className="font-semibold text-gray-900 text-sm">Notes</h3></div>
          <div className="card-body p-4 space-y-3">
            <textarea {...register('meeting_highlights')} className="input text-xs" rows={2} placeholder="Meeting highlights / discussion..." />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input {...register('visit_outcome')} className="input text-xs py-1" placeholder="Visit outcome" />
              <input {...register('next_action')} className="input text-xs py-1" placeholder="Next action" />
              <input type="date" {...register('next_followup_date')} className="input text-xs py-1" />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 justify-end pb-8">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary btn-sm">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary btn-sm">
            {loading ? <><Spinner size="xs" /> Saving...</> : isEdit ? 'Update Visit' : 'Submit Visit'}
          </button>
        </div>
      </form>
    </div>
  );
}
