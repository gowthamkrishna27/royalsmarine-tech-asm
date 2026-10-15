import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import clientService from '../../services/clientService';
import submissionService from '../../services/submissionService';
import {
  XMarkIcon,
  MapPinIcon,
  BeakerIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

const TEST_TYPES = [
  'Water Quality Analysis',
  'Pond Diagnostics & Growth Check',
  'Plankton & Vibrio Screening',
  'Biomass & Harvest Assessment',
  'Feed Intake & Health Audit',
  'Soil & Sediment Test',
];

export default function SubmitTestModal({ isOpen, onClose, onSuccess, defaultCoords }) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [fetchingClients, setFetchingClients] = useState(false);
  const [clients, setClients] = useState([]);
  const [ponds, setPonds] = useState([]);
  const [fetchingPonds, setFetchingPonds] = useState(false);

  // Form State
  const [testType, setTestType] = useState('Water Quality Analysis');
  const [farmerId, setFarmerId] = useState('');
  const [tankId, setTankId] = useState('');
  const [locality, setLocality] = useState('');
  const [latitude, setLatitude] = useState(defaultCoords?.lat ? String(defaultCoords.lat) : '');
  const [longitude, setLongitude] = useState(defaultCoords?.lng ? String(defaultCoords.lng) : '');
  const [accuracy, setAccuracy] = useState('5.0');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('VERIFIED');

  // Submitter Role state: Allow agent or ASM
  const isUserAsm = user?.role === 'sales_manager' || (user?.role_name || '').includes('manager');
  const [submitterRole, setSubmitterRole] = useState(isUserAsm ? 'ASM' : 'Technical Executive');

  // Parameters State
  const [params, setParams] = useState({
    ph: '7.8',
    salinity_ppt: '14',
    ammonia_ppm: '0.02',
    nitrite_ppm: '0.00',
    dissolved_oxygen_ppm: '5.2',
    water_temp_c: '28.5',
    alkalinity_ppm: '120',
    doc: '75',
    abw_grams: '22',
    survival_rate_pct: '88',
    feed_intake: 'Active',
    mortality: 'None',
    secchi_disk_cm: '32',
    dominant_plankton: 'Green Algae',
    yellow_vibrio_cfu: 'Low (<50)',
    green_vibrio_cfu: 'Nil',
    est_biomass_tons: '2.5',
    expected_harvest_days: '30',
  });

  const handleParamChange = (field, val) => {
    setParams(prev => ({ ...prev, [field]: val }));
  };

  // Load clients on modal open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setFetchingClients(true);
    clientService.list({ limit: 100 })
      .then(res => {
        if (!isMounted) return;
        const list = res.data?.data || [];
        setClients(list);
        if (list.length > 0 && !farmerId) {
          setFarmerId(String(list[0].id));
          if (list[0].city || list[0].village) {
            setLocality(list[0].village || list[0].city || '');
          }
        }
      })
      .catch(err => {
        console.error('Failed to load clients', err);
      })
      .finally(() => {
        if (isMounted) setFetchingClients(false);
      });

    // Auto-detect GPS if coordinates not already set
    if (!latitude || !longitude) {
      detectGps();
    }

    return () => { isMounted = false; };
  }, [isOpen]);

  // Load ponds when farmerId changes
  useEffect(() => {
    if (!farmerId) {
      setPonds([]);
      setTankId('');
      return;
    }

    let isMounted = true;
    setFetchingPonds(true);
    clientService.listPonds(farmerId)
      .then(res => {
        if (!isMounted) return;
        const pondList = res.data?.data || [];
        setPonds(pondList);
        if (pondList.length > 0) {
          setTankId(String(pondList[0].id));
        } else {
          setTankId('');
        }
      })
      .catch(err => {
        console.error('Failed to load ponds', err);
        setPonds([]);
      })
      .finally(() => {
        if (isMounted) setFetchingPonds(false);
      });

    const selectedFarmer = clients.find(c => String(c.id) === String(farmerId));
    if (selectedFarmer) {
      if (selectedFarmer.village || selectedFarmer.city) {
        setLocality(selectedFarmer.village || selectedFarmer.city);
      }
    }
  }, [farmerId, clients]);

  // GPS detection
  const detectGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('Geolocation not supported by your browser');
      return;
    }
    setGpsLoading(true);
    setGpsStatus('Acquiring high-accuracy GPS coordinates...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(8));
        setLongitude(pos.coords.longitude.toFixed(8));
        setAccuracy(pos.coords.accuracy ? pos.coords.accuracy.toFixed(1) : '5.0');
        setGpsLoading(false);
        setGpsStatus(`GPS Captured: accuracy ±${Math.round(pos.coords.accuracy || 5)}m`);
      },
      (err) => {
        console.warn('GPS error:', err.message);
        setGpsLoading(false);
        // Fallback to Andhra Pradesh aquaculture belt (Bhimavaram) if denied in test environment
        if (!latitude || !longitude) {
          setLatitude('16.54480000');
          setLongitude('81.52120000');
          setAccuracy('10.0');
          setGpsStatus('Using aquaculture belt coordinates (GPS access restricted)');
        } else {
          setGpsStatus('Could not refresh GPS: ' + err.message);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Use selected pond coordinates if available
  const usePondCoordinates = () => {
    const selectedPond = ponds.find(p => String(p.id) === String(tankId));
    if (selectedPond && selectedPond.latitude && selectedPond.longitude) {
      setLatitude(String(selectedPond.latitude));
      setLongitude(String(selectedPond.longitude));
      setAccuracy('3.0');
      if (selectedPond.gps_address) setLocality(selectedPond.gps_address);
      setGpsStatus('Using Pond GPS coordinates');
      return;
    }
    const selectedFarmer = clients.find(c => String(c.id) === String(farmerId));
    if (selectedFarmer && selectedFarmer.latitude && selectedFarmer.longitude) {
      setLatitude(String(selectedFarmer.latitude));
      setLongitude(String(selectedFarmer.longitude));
      setAccuracy('5.0');
      if (selectedFarmer.city) setLocality(selectedFarmer.city);
      setGpsStatus('Using Farmer GPS coordinates');
    }
  };

  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!latitude || !longitude) {
      alert('Please provide valid latitude and longitude GPS coordinates.');
      return;
    }

    setLoading(true);
    try {
      // Pick relevant parameters based on test type
      let payloadParams = {};
      if (testType.includes('Water Quality')) {
        payloadParams = {
          ph: parseFloat(params.ph),
          ammonia_ppm: parseFloat(params.ammonia_ppm),
          salinity_ppt: parseFloat(params.salinity_ppt),
          nitrite_ppm: parseFloat(params.nitrite_ppm),
          dissolved_oxygen_ppm: parseFloat(params.dissolved_oxygen_ppm),
          water_temp_c: parseFloat(params.water_temp_c),
          alkalinity_ppm: parseFloat(params.alkalinity_ppm),
        };
      } else if (testType.includes('Growth') || testType.includes('Diagnostics')) {
        payloadParams = {
          doc: parseInt(params.doc, 10),
          abw_grams: parseFloat(params.abw_grams),
          survival_rate_pct: parseFloat(params.survival_rate_pct),
          feed_intake: params.feed_intake,
          mortality: params.mortality,
        };
      } else if (testType.includes('Plankton') || testType.includes('Vibrio')) {
        payloadParams = {
          secchi_disk_cm: parseFloat(params.secchi_disk_cm),
          dominant_plankton: params.dominant_plankton,
          yellow_vibrio_cfu: params.yellow_vibrio_cfu,
          green_vibrio_cfu: params.green_vibrio_cfu,
        };
      } else if (testType.includes('Biomass') || testType.includes('Harvest')) {
        payloadParams = {
          doc: parseInt(params.doc, 10),
          abw_grams: parseFloat(params.abw_grams),
          est_biomass_tons: parseFloat(params.est_biomass_tons),
          expected_harvest_days: parseInt(params.expected_harvest_days, 10),
        };
      } else {
        payloadParams = { ...params };
      }

      const isAsm = submitterRole.toLowerCase().includes('asm') || submitterRole.toLowerCase().includes('manager');

      const payload = {
        farmer_id: farmerId || null,
        tank_id: tankId || null,
        test_type: testType,
        user_name: user?.full_name || (isAsm ? 'Rajesh Kumar' : 'Amit Verma'),
        role: isAsm ? 'Area Sales Manager' : 'Technical Executive',
        agent_id: isAsm ? `ASM-${user?.id || '02'}` : `AGT-${String(user?.id || '04').padStart(2, '0')}`,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        accuracy: parseFloat(accuracy || 5.0),
        locality: locality || 'Field Location',
        status: status,
        data: payloadParams,
        review_notes: notes || 'Test successfully recorded in field.',
      };

      const res = await submissionService.create(payload);
      const createdItem = res.data?.data;

      if (onSuccess) {
        onSuccess(createdItem);
      }
      onClose();
    } catch (err) {
      console.error('Submission error:', err);
      alert('Failed to submit test: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 via-white to-purple-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                <BeakerIcon className="w-6 h-6" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Submit Field Test / Diagnostic</h3>
                <p className="text-xs text-gray-500">
                  Record test parameters with GPS coordinates to plot live on the map.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">

            {/* Submitter Role selection */}
            <div className="bg-gray-50/80 p-3.5 rounded-xl border border-gray-200/80">
              <label className="text-xs font-bold text-gray-700 block mb-1.5 uppercase tracking-wide">
                Submitter Identity (Agent or ASM)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSubmitterRole('Technical Executive')}
                  className={`flex items-center gap-2.5 p-3 rounded-lg border text-left transition ${
                    submitterRole === 'Technical Executive'
                      ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-xs'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                    submitterRole === 'Technical Executive' ? 'border-amber-600 bg-amber-600' : 'border-gray-400'
                  }`}>
                    {submitterRole === 'Technical Executive' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                  <div>
                    <span className="text-xs font-bold block">Agent / Technical Executive</span>
                    <span className="text-[10px] text-gray-500">Field Executive submitting test</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSubmitterRole('ASM')}
                  className={`flex items-center gap-2.5 p-3 rounded-lg border text-left transition ${
                    submitterRole === 'ASM'
                      ? 'bg-purple-50 border-purple-400 text-purple-900 shadow-xs'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                    submitterRole === 'ASM' ? 'border-purple-600 bg-purple-600' : 'border-gray-400'
                  }`}>
                    {submitterRole === 'ASM' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                  <div>
                    <span className="text-xs font-bold block">Area Sales Manager (ASM)</span>
                    <span className="text-[10px] text-gray-500">Manager monitoring / field inspection</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Test Type */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Test Category / Type
              </label>
              <select
                value={testType}
                onChange={(e) => setTestType(e.target.value)}
                className="input text-sm"
              >
                {TEST_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Farmer and Tank Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Farmer / Client
                </label>
                <select
                  value={farmerId}
                  onChange={(e) => setFarmerId(e.target.value)}
                  className="input text-sm"
                  disabled={fetchingClients}
                >
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.company_name} {c.city ? `(${c.city})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Pond / Tank
                </label>
                <select
                  value={tankId}
                  onChange={(e) => setTankId(e.target.value)}
                  className="input text-sm"
                  disabled={fetchingPonds || ponds.length === 0}
                >
                  {ponds.length > 0 ? (
                    ponds.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.pond_name || `Tank #${p.tank_number || p.id}`} {p.area_acres ? `(${p.area_acres} Ac)` : ''}
                      </option>
                    ))
                  ) : (
                    <option value="">No ponds found (Main Tank)</option>
                  )}
                </select>
              </div>
            </div>

            {/* GPS Location Section */}
            <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <MapPinIcon className="w-4 h-4 text-blue-600" />
                  Submission GPS Coordinates
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={usePondCoordinates}
                    className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                  >
                    Use Pond GPS
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={detectGps}
                    disabled={gpsLoading}
                    className="btn-secondary btn-xs text-[11px] flex items-center gap-1 text-blue-700 bg-white"
                  >
                    {gpsLoading ? (
                      <ArrowPathIcon className="w-3 h-3 animate-spin text-blue-600" />
                    ) : (
                      <SparklesIcon className="w-3 h-3 text-blue-600" />
                    )}
                    Detect GPS
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-bold block mb-0.5">Latitude</label>
                  <input
                    type="number"
                    step="0.00000001"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    required
                    placeholder="e.g. 16.5448"
                    className="input text-xs py-1.5"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-bold block mb-0.5">Longitude</label>
                  <input
                    type="number"
                    step="0.00000001"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    required
                    placeholder="e.g. 81.5212"
                    className="input text-xs py-1.5"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-[10px] text-gray-500 uppercase font-bold block mb-0.5">Locality / Landmark</label>
                  <input
                    type="text"
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    placeholder="e.g. Bhimavaram, AP"
                    className="input text-xs py-1.5"
                  />
                </div>
              </div>

              {gpsStatus && (
                <p className="text-[11px] text-blue-700 flex items-center gap-1">
                  <CheckCircleIcon className="w-3.5 h-3.5 text-blue-600" />
                  {gpsStatus}
                </p>
              )}
            </div>

            {/* Test Parameters depending on Test Type */}
            <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-200">
              <label className="text-xs font-bold text-gray-700 block mb-2 uppercase tracking-wide">
                Test Parameters & Results
              </label>

              {testType.includes('Water Quality') && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-0.5">pH Level</label>
                    <input
                      type="number"
                      step="0.1"
                      value={params.ph}
                      onChange={(e) => handleParamChange('ph', e.target.value)}
                      className="input text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-0.5">Salinity (ppt)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={params.salinity_ppt}
                      onChange={(e) => handleParamChange('salinity_ppt', e.target.value)}
                      className="input text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-0.5">Ammonia (ppm)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={params.ammonia_ppm}
                      onChange={(e) => handleParamChange('ammonia_ppm', e.target.value)}
                      className="input text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-0.5">Nitrite (ppm)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={params.nitrite_ppm}
                      onChange={(e) => handleParamChange('nitrite_ppm', e.target.value)}
                      className="input text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-0.5">Dissolved Oxygen (ppm)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={params.dissolved_oxygen_ppm}
                      onChange={(e) => handleParamChange('dissolved_oxygen_ppm', e.target.value)}
                      className="input text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-0.5">Water Temp (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={params.water_temp_c}
                      onChange={(e) => handleParamChange('water_temp_c', e.target.value)}
                      className="input text-xs py-1.5"
                    />
                  </div>
                </div>
              )}

              {(testType.includes('Growth') || testType.includes('Diagnostics')) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-0.5">DOC (Days of Culture)</label>
                    <input
                      type="number"
                      value={params.doc}
                      onChange={(e) => handleParamChange('doc', e.target.value)}
                      className="input text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-0.5">ABW (Grams)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={params.abw_grams}
                      onChange={(e) => handleParamChange('abw_grams', e.target.value)}
                      className="input text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-0.5">Survival Rate (%)</label>
                    <input
                      type="number"
                      value={params.survival_rate_pct}
                      onChange={(e) => handleParamChange('survival_rate_pct', e.target.value)}
                      className="input text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-0.5">Feed Intake</label>
                    <select
                      value={params.feed_intake}
                      onChange={(e) => handleParamChange('feed_intake', e.target.value)}
                      className="input text-xs py-1.5"
                    >
                      <option value="Active">Active</option>
                      <option value="Normal">Normal</option>
                      <option value="Slow">Slow</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-0.5">Mortality</label>
                    <select
                      value={params.mortality}
                      onChange={(e) => handleParamChange('mortality', e.target.value)}
                      className="input text-xs py-1.5"
                    >
                      <option value="None">None</option>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>
              )}

              {testType.includes('Plankton') && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-0.5">Secchi Disk (cm)</label>
                    <input
                      type="number"
                      value={params.secchi_disk_cm}
                      onChange={(e) => handleParamChange('secchi_disk_cm', e.target.value)}
                      className="input text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-0.5">Dominant Plankton</label>
                    <input
                      type="text"
                      value={params.dominant_plankton}
                      onChange={(e) => handleParamChange('dominant_plankton', e.target.value)}
                      className="input text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-0.5">Green Vibrio</label>
                    <input
                      type="text"
                      value={params.green_vibrio_cfu}
                      onChange={(e) => handleParamChange('green_vibrio_cfu', e.target.value)}
                      className="input text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-0.5">Yellow Vibrio</label>
                    <input
                      type="text"
                      value={params.yellow_vibrio_cfu}
                      onChange={(e) => handleParamChange('yellow_vibrio_cfu', e.target.value)}
                      className="input text-xs py-1.5"
                    />
                  </div>
                </div>
              )}

              {(testType.includes('Biomass') || testType.includes('Harvest') || testType.includes('Soil')) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-0.5">DOC (Days)</label>
                    <input
                      type="number"
                      value={params.doc}
                      onChange={(e) => handleParamChange('doc', e.target.value)}
                      className="input text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-0.5">ABW (Grams)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={params.abw_grams}
                      onChange={(e) => handleParamChange('abw_grams', e.target.value)}
                      className="input text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-0.5">Est. Biomass (Tons)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={params.est_biomass_tons}
                      onChange={(e) => handleParamChange('est_biomass_tons', e.target.value)}
                      className="input text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-0.5">Expected Harvest (Days)</label>
                    <input
                      type="number"
                      value={params.expected_harvest_days}
                      onChange={(e) => handleParamChange('expected_harvest_days', e.target.value)}
                      className="input text-xs py-1.5"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Notes & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Observations / Field Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes on water transparency, shrimp activity, aeration recommendations..."
                  className="input text-xs py-2"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Verification Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="input text-xs py-2"
                >
                  <option value="VERIFIED">VERIFIED</option>
                  <option value="PENDING_VERIFICATION">PENDING VERIFICATION</option>
                </select>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary text-xs"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !latitude || !longitude}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                {loading && <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />}
                Submit & Pin on Map
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
