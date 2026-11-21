import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { visitApi, clientApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
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

const DISEASE_OPTIONS = [
  'White muscle',
  'White gut',
  'Moulting',
  'Cramping',
  'Black gill',
  'Vibriosis',
  'EHP',
  'Hard shell',
  'Soft shell',
  'Black spots',
  'ASDS',
  'WSSV',
  'Loose shell',
];

export default function VisitForm() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('super_admin', 'admin');
  // ASM (Area Sales Manager) and Technical Executive roles: DOC is auto-calculated only
  const isDocAutoOnly = hasRole('sales_manager', 'sales_executive');
  const { id } = useParams();
  const [searchParams] = useSearchParams();
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

  const queryClient = useQueryClient();

  // 6. Harvest Details state
  const [partialHarvests, setPartialHarvests] = useState([]);
  const [previousPartialHarvests, setPreviousPartialHarvests] = useState([]);
  const [finalHarvest, setFinalHarvest] = useState({
    date: '',
    doc: '',
    count: '',
    abw: '',
    harvested_quantity: '',
    harvested_biomass: '',
    total_feed: '',
    fcr: '',
  });

  // 7. Disease Details state
  const [diseaseDetails, setDiseaseDetails] = useState({ diseases: [] });

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
  const showPartialHarvest = meetingType === 'partial_harvest' || meetingType === 'harvest_details' || meetingType === 'all';
  const showFinalHarvest = meetingType === 'final_harvest' || meetingType === 'harvest_details' || meetingType === 'all';
  const showHarvest = showPartialHarvest || showFinalHarvest;
  const showDisease = meetingType === 'disease' || meetingType === 'all';

  // Load clients
  const { data: clients } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => clientApi.list({ limit: 200, status: 'active' }).then(r => r.data.data),
  });

  // Load selected client's full details (tanks)
  const { data: selectedClient, isLoading: tanksLoading } = useQuery({
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
          const fh = existingVisit.harvest_details.final_harvest;
          const der = existingVisit.harvest_details.derived || {};
          setFinalHarvest(prev => ({
            ...prev,
            ...fh,
            total_feed: fh.total_feed ?? der.total_feed ?? (der.totalFeed ? String(der.totalFeed).replace(/kg/i, '').trim() : '') ?? existingVisit.feeding_details?.cumulative_feed ?? '',
            fcr: fh.fcr ?? der.fcr ?? existingVisit.feeding_details?.fcr ?? '',
          }));
        }
      }
      if (existingVisit.disease_details) {
        const dd = existingVisit.disease_details;
        const diseases = Array.isArray(dd?.diseases)
          ? dd.diseases
          : Array.isArray(dd)
            ? dd
            : typeof dd?.disease_identification === 'string'
              ? dd.disease_identification.split(',').map(s => s.trim()).filter(Boolean)
              : [];
        setDiseaseDetails({ diseases });
      }
    }
  }, [existingVisit, setValue]);

  // Pre-fill farmer from URL query parameter (e.g. from Map 1-Tap Log Visit)
  const paramClientId = searchParams.get('clientId');
  const paramTank = searchParams.get('tank');

  useEffect(() => {
    if (!isEdit && paramClientId) {
      setValue('client_id', Number(paramClientId) || paramClientId);
    }
  }, [paramClientId, isEdit, setValue]);

  // Pre-fill tank from URL query parameter when client ponds load
  useEffect(() => {
    if (!isEdit && paramTank && selectedClient?.ponds?.length) {
      const found = selectedClient.ponds.find(
        p => String(p.id) === String(paramTank) || p.tank_number === paramTank || p.pond_name === paramTank
      );
      if (found) {
        const tankIdentifier = found.tank_number || found.pond_name;
        setValue('tank_number', tankIdentifier);
        setValue('tank_id', found.id);

        if (found.seed_date && visitDate) {
          const seedDate = new Date(found.seed_date);
          const vDate = new Date(visitDate);
          const diffDays = Math.max(0, Math.floor((vDate - seedDate) / (1000 * 60 * 60 * 24)));
          setWaterQuality(prev => ({ ...prev, doc: diffDays }));
          setFeedingDetails(prev => ({ ...prev, doc: diffDays }));
        }

        if (found.stocking_quantity_lakhs) {
          setFeedingDetails(prev => ({ ...prev, seed_quantity: found.stocking_quantity_lakhs }));
        }

        const prevPartials = (found.partial_harvests || []).filter(
          ph => !isEdit || String(ph.visit_id) !== String(id)
        );
        setPreviousPartialHarvests(prevPartials);

        if (found.total_feed !== undefined && found.total_feed !== null) {
          setFeedingDetails(prev => ({
            ...prev,
            cumulative_feed: prev.cumulative_feed || (found.total_feed > 0 ? String(found.total_feed) : '')
          }));
        }
      }
    }
  }, [paramTank, selectedClient, isEdit, setValue, visitDate]);

  const findTankInPonds = (ponds, tankIdentifier, tankId) => {
    if (!ponds || !ponds.length) return null;
    const sIdent = tankIdentifier !== undefined && tankIdentifier !== null ? String(tankIdentifier).trim().toLowerCase() : '';
    const sId = tankId !== undefined && tankId !== null ? String(tankId).trim() : '';

    return ponds.find(p => {
      if (sId && String(p.id) === sId) return true;
      if (!sIdent) return false;
      const pTank = String(p.tank_number || '').trim().toLowerCase();
      const pName = String(p.pond_name || '').trim().toLowerCase();
      const pId = String(p.id || '').trim().toLowerCase();
      return pTank === sIdent || pName === sIdent || pId === sIdent ||
        (pTank && sIdent === `tank ${pTank}`) ||
        (pTank && `tank ${pTank}` === sIdent);
    });
  };

  const watchedTankNumber = watch('tank_number');
  const watchedTankId = watch('tank_id');

  // Sync previous partial harvests & tank details when selectedClient or tank changes
  useEffect(() => {
    if (!selectedClient?.ponds?.length) return;
    const targetTank = watchedTankNumber || watchedTankId || paramTank;
    if (!targetTank) return;

    const foundTank = findTankInPonds(selectedClient.ponds, targetTank, watchedTankId);
    if (foundTank) {
      if (!watchedTankId && foundTank.id) {
        setValue('tank_id', foundTank.id);
      }
      if (!watchedTankNumber) {
        setValue('tank_number', foundTank.tank_number || foundTank.pond_name);
      }

      if (foundTank.seed_date && visitDate) {
        const seedDate = new Date(foundTank.seed_date);
        const vDate = new Date(visitDate);
        const diffDays = Math.max(0, Math.floor((vDate - seedDate) / (1000 * 60 * 60 * 24)));
        setWaterQuality(prev => prev.doc === '' || prev.doc === undefined ? { ...prev, doc: diffDays } : prev);
        setFeedingDetails(prev => prev.doc === '' || prev.doc === undefined ? { ...prev, doc: diffDays } : prev);
      }

      if (foundTank.stocking_quantity_lakhs) {
        setFeedingDetails(prev => prev.seed_quantity ? prev : { ...prev, seed_quantity: foundTank.stocking_quantity_lakhs });
      }

      const prevPartials = (foundTank.partial_harvests || []).filter(
        ph => !isEdit || String(ph.visit_id) !== String(id)
      );
      setPreviousPartialHarvests(prevPartials);

      if (foundTank.total_feed !== undefined && foundTank.total_feed !== null && foundTank.total_feed > 0) {
        const feedStr = String(foundTank.total_feed);
        setFeedingDetails(prev => ({
          ...prev,
          cumulative_feed: prev.cumulative_feed || feedStr
        }));
        setFinalHarvest(prev => ({
          ...prev,
          total_feed: prev.total_feed || feedStr
        }));
      }
      if (foundTank.fcr) {
        const fcrStr = String(foundTank.fcr);
        setFeedingDetails(prev => ({ ...prev, fcr: prev.fcr || fcrStr }));
        setFinalHarvest(prev => ({ ...prev, fcr: prev.fcr || fcrStr }));
      }
    }
  }, [selectedClient, watchedTankNumber, watchedTankId, paramTank, isEdit, id, setValue, visitDate]);

  // Handle Tank selection and auto-calculate DOC & Seed Qty
  const handleTankSelection = (chosenTankNum) => {
    setValue('tank_number', chosenTankNum, { shouldDirty: true, shouldValidate: true });

    const foundTank = findTankInPonds(selectedClient?.ponds, chosenTankNum);

    if (foundTank) {
      setValue('tank_id', foundTank.id, { shouldDirty: true });

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

      // Load previous partial harvests from this tank (read-only history)
      const prevPartials = (foundTank.partial_harvests || []).filter(
        ph => !isEdit || String(ph.visit_id) !== String(id)
      );
      setPreviousPartialHarvests(prevPartials);

      // Auto-populate cumulative feed from tank history if available
      if (foundTank.total_feed !== undefined && foundTank.total_feed !== null && foundTank.total_feed > 0) {
        const feedStr = String(foundTank.total_feed);
        setFeedingDetails(prev => ({
          ...prev,
          cumulative_feed: prev.cumulative_feed || feedStr
        }));
        setFinalHarvest(prev => ({
          ...prev,
          total_feed: prev.total_feed || feedStr
        }));
      }
      if (foundTank.fcr) {
        const fcrStr = String(foundTank.fcr);
        setFeedingDetails(prev => ({ ...prev, fcr: prev.fcr || fcrStr }));
        setFinalHarvest(prev => ({ ...prev, fcr: prev.fcr || fcrStr }));
      }
    } else {
      setValue('tank_id', null, { shouldDirty: true });
      setPreviousPartialHarvests([]);
    }
  };

  // Reset tank when farmer changes (skip initial/edit hydration)
  const prevClientIdRef = useRef(clientId);
  useEffect(() => {
    if (prevClientIdRef.current && String(prevClientIdRef.current) !== String(clientId)) {
      if (!isEdit) {
        setValue('tank_number', '');
        setValue('tank_id', null);
        setPreviousPartialHarvests([]);
      }
    }
    prevClientIdRef.current = clientId;
  }, [clientId, isEdit, setValue]);

  // Auto-seed first new partial harvest when partial harvest is active and empty
  useEffect(() => {
    if (showPartialHarvest && !isEdit && partialHarvests.length === 0) {
      setPartialHarvests([
        {
          harvest_no: previousPartialHarvests.length + 1,
          date: visitDate || new Date().toISOString().split('T')[0],
          doc: waterQuality.doc || '',
          count: '',
          abw: '',
          harvested_quantity: '',
          harvested_biomass: '',
          remarks: '',
        }
      ]);
    }
  }, [showPartialHarvest, isEdit, previousPartialHarvests.length, visitDate, waterQuality.doc]);

  // Keep harvest_no aligned when previous harvests change
  useEffect(() => {
    if (!isEdit && partialHarvests.length > 0) {
      setPartialHarvests(prev => prev.map((item, idx) => ({
        ...item,
        harvest_no: previousPartialHarvests.length + idx + 1,
      })));
    }
  }, [previousPartialHarvests.length, isEdit]);

  // Auto calculate FCR and sync biomass & feed
  useEffect(() => {
    const allHarvests = [...previousPartialHarvests, ...partialHarvests];
    const finalBiomass = parseFloat(finalHarvest.harvested_biomass || finalHarvest.harvested_quantity) || 0;
    let totalHarvestBiomass = 0;
    allHarvests.forEach(p => {
      const b = parseFloat(p.harvested_biomass || p.harvested_quantity);
      if (!isNaN(b) && b > 0) totalHarvestBiomass += b;
    });
    totalHarvestBiomass += finalBiomass;

    const effectiveBiomass = totalHarvestBiomass > 0 ? totalHarvestBiomass : (parseFloat(feedingDetails.total_biomass) || 0);
    const effectiveFeed = parseFloat(finalHarvest.total_feed || feedingDetails.cumulative_feed) || 0;

    if (effectiveBiomass > 0 && String(feedingDetails.total_biomass) !== String(effectiveBiomass)) {
      setFeedingDetails(prev => ({ ...prev, total_biomass: String(effectiveBiomass) }));
    }

    if (effectiveFeed > 0 && effectiveBiomass > 0) {
      const calculatedFcr = (effectiveFeed / effectiveBiomass).toFixed(2);
      if (calculatedFcr !== feedingDetails.fcr) {
        setFeedingDetails(prev => ({ ...prev, fcr: calculatedFcr }));
      }
      if (calculatedFcr !== finalHarvest.fcr) {
        setFinalHarvest(prev => prev.fcr === calculatedFcr ? prev : { ...prev, fcr: calculatedFcr });
      }
    }
  }, [previousPartialHarvests, partialHarvests, finalHarvest.harvested_biomass, finalHarvest.harvested_quantity, finalHarvest.total_feed, feedingDetails.cumulative_feed]);

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
    if (partialHarvests.length >= 5) {
      toast.error('Maximum 5 partial harvest records');
      return;
    }
    setPartialHarvests(prev => [
      ...prev,
      {
        harvest_no: previousPartialHarvests.length + prev.length + 1,
        date: visitDate || new Date().toISOString().split('T')[0],
        doc: waterQuality.doc || '',
        count: '',
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

      if (field === 'count' && value) {
        const countVal = parseFloat(value);
        if (!isNaN(countVal) && countVal > 0 && (!updated.abw || updated.abw === '')) {
          updated.abw = (1000 / countVal).toFixed(2);
        }
      }
      if (field === 'abw' && value) {
        const abwVal = parseFloat(value);
        if (!isNaN(abwVal) && abwVal > 0 && (!updated.count || updated.count === '')) {
          updated.count = (1000 / abwVal).toFixed(1).replace(/\.0$/, '');
        }
      }

      if (field === 'harvested_quantity' || field === 'abw' || field === 'count') {
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
      return filtered.map((item, idx) => ({
        ...item,
        harvest_no: previousPartialHarvests.length + idx + 1,
      }));
    });
  };

  const updateFinalHarvest = (field, value) => {
    if (typeof isLocked !== 'undefined' && isLocked) return;
    setFinalHarvest(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'count' && value) {
        const countVal = parseFloat(value);
        if (!isNaN(countVal) && countVal > 0 && (!updated.abw || updated.abw === '')) {
          updated.abw = (1000 / countVal).toFixed(2);
        }
      }
      if (field === 'abw' && value) {
        const abwVal = parseFloat(value);
        if (!isNaN(abwVal) && abwVal > 0 && (!updated.count || updated.count === '')) {
          updated.count = (1000 / abwVal).toFixed(1).replace(/\.0$/, '');
        }
      }
      if (field === 'harvested_quantity') {
        updated.harvested_biomass = value;
      } else if (field === 'harvested_biomass') {
        updated.harvested_quantity = value;
      }

      if (field === 'total_feed') {
        setFeedingDetails(fd => ({ ...fd, cumulative_feed: value }));
        const feedVal = parseFloat(value);
        const biomassVal = parseFloat(updated.harvested_biomass || updated.harvested_quantity);
        if (!isNaN(feedVal) && !isNaN(biomassVal) && biomassVal > 0) {
          updated.fcr = (feedVal / biomassVal).toFixed(2);
        }
      }

      if (field === 'fcr') {
        const fcrVal = parseFloat(value);
        const biomassVal = parseFloat(updated.harvested_biomass || updated.harvested_quantity);
        if (!isNaN(fcrVal) && !isNaN(biomassVal) && biomassVal > 0) {
          const calcFeed = (fcrVal * biomassVal).toFixed(1);
          updated.total_feed = calcFeed;
          setFeedingDetails(fd => ({ ...fd, cumulative_feed: calcFeed }));
        }
      }

      if ((field === 'harvested_quantity' || field === 'harvested_biomass') && value) {
        const biomassVal = parseFloat(value);
        const feedVal = parseFloat(updated.total_feed || feedingDetails.cumulative_feed);
        if (!isNaN(biomassVal) && biomassVal > 0 && !isNaN(feedVal) && feedVal > 0) {
          updated.fcr = (feedVal / biomassVal).toFixed(2);
        }
      }

      return updated;
    });
  };

  // Harvest summary derived
  const harvestDerived = useMemo(() => {
    const allHarvests = [...previousPartialHarvests, ...partialHarvests];
    const finalBiomass = parseFloat(finalHarvest.harvested_biomass || finalHarvest.harvested_quantity) || 0;

    let totalBiomassVal = 0;
    let totalHarvestQty = 0;

    allHarvests.forEach(p => {
      const b = parseFloat(p.harvested_biomass || p.harvested_quantity);
      const q = parseFloat(p.harvested_quantity || p.harvested_biomass);
      if (!isNaN(b) && b > 0) totalBiomassVal += b;
      if (!isNaN(q) && q > 0) totalHarvestQty += q;
    });

    totalBiomassVal += finalBiomass;
    const finalQ = parseFloat(finalHarvest.harvested_quantity || finalHarvest.harvested_biomass) || 0;
    totalHarvestQty += finalQ;

    const totalFeedVal = parseFloat(finalHarvest.total_feed || feedingDetails.cumulative_feed) || 0;

    // FCR: Total Feed / Total Harvested Biomass (or final biomass)
    const effectiveBiomass = totalBiomassVal > 0 ? totalBiomassVal : finalBiomass;
    const finalFcr = (totalFeedVal > 0 && effectiveBiomass > 0)
      ? (totalFeedVal / effectiveBiomass).toFixed(2)
      : (finalHarvest.fcr && !isNaN(parseFloat(finalHarvest.fcr)) ? parseFloat(finalHarvest.fcr).toFixed(2) : '—');

    // Total Count: count of the final harvest
    const finalCount = (finalHarvest.count !== undefined && finalHarvest.count !== null && String(finalHarvest.count).trim() !== '')
      ? String(finalHarvest.count)
      : '—';

    let survivalPct = '—';
    const initialSeedLakhs = parseFloat(feedingDetails.seed_quantity);
    if (!isNaN(initialSeedLakhs) && initialSeedLakhs > 0 && totalHarvestQty > 0) {
      const totalInitialCount = initialSeedLakhs * 100000;
      survivalPct = ((totalHarvestQty / totalInitialCount) * 100).toFixed(1) + '%';
    }

    return {
      fcr: finalFcr,
      totalCount: finalCount,
      avgBiomass: totalBiomassVal > 0 ? totalBiomassVal.toFixed(1) : '—',
      totalBiomass: totalBiomassVal > 0 ? totalBiomassVal.toFixed(1) : '—',
      total_biomass: totalBiomassVal > 0 ? totalBiomassVal.toFixed(1) : '—',
      totalFeed: totalFeedVal > 0 ? `${totalFeedVal.toFixed(1)} kg` : '—',
      total_feed: totalFeedVal > 0 ? totalFeedVal.toFixed(1) : '—',
      total_harvest_qty: totalHarvestQty > 0 ? totalHarvestQty.toLocaleString() : '—',
      survival: survivalPct,
      survival_percentage: survivalPct,
    };
  }, [previousPartialHarvests, partialHarvests, finalHarvest, feedingDetails.cumulative_feed, feedingDetails.seed_quantity]);

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

    // Water quality mandatory field validation
    if (showWaterQuality) {
      const missing = [];
      if (!waterQuality.ph) missing.push('pH');
      if (!waterQuality.ammonia) missing.push('Ammonia');
      if (!waterQuality.salinity) missing.push('Salinity');
      if (!waterQuality.nitrite) missing.push('Nitrite');
      if (missing.length > 0) {
        toast.error(`Water quality fields are required: ${missing.join(', ')}`);
        setLoading(false);
        return;
      }
    }

    // Harvest details validations (separated for partial_harvest, final_harvest, and harvest_details)
    if (meetingType === 'partial_harvest') {
      if (partialHarvests.length === 0) {
        toast.error('Please add at least one partial harvest entry');
        setLoading(false);
        return;
      }
      for (let i = 0; i < partialHarvests.length; i++) {
        const ph = partialHarvests[i];
        if (!ph.count || String(ph.count).trim() === '') {
          toast.error(`Count is mandatory for Partial Harvest #${ph.harvest_no || (previousPartialHarvests.length + i + 1)}`);
          setLoading(false);
          return;
        }
      }
    } else if (meetingType === 'final_harvest') {
      if (!finalHarvest.count || String(finalHarvest.count).trim() === '') {
        toast.error('Count is mandatory for Final Harvest');
        setLoading(false);
        return;
      }
    } else if (meetingType === 'harvest_details') {
      const hasFinalInput = Boolean(
        finalHarvest.count || finalHarvest.date || finalHarvest.abw ||
        finalHarvest.harvested_quantity || finalHarvest.harvested_biomass
      );
      if (partialHarvests.length === 0 && !hasFinalInput) {
        toast.error('Please enter harvest details with a mandatory Count');
        setLoading(false);
        return;
      }
      for (let i = 0; i < partialHarvests.length; i++) {
        const ph = partialHarvests[i];
        if (!ph.count || String(ph.count).trim() === '') {
          toast.error(`Count is mandatory for Partial Harvest #${ph.harvest_no || (previousPartialHarvests.length + i + 1)}`);
          setLoading(false);
          return;
        }
      }
      if (hasFinalInput || partialHarvests.length === 0) {
        if (!finalHarvest.count || String(finalHarvest.count).trim() === '') {
          toast.error('Count is mandatory for Final Harvest');
          setLoading(false);
          return;
        }
      }
    } else if (showHarvest) {
      for (let i = 0; i < partialHarvests.length; i++) {
        const ph = partialHarvests[i];
        if (!ph.count || String(ph.count).trim() === '') {
          toast.error(`Count is mandatory for Partial Harvest #${ph.harvest_no || (previousPartialHarvests.length + i + 1)}`);
          setLoading(false);
          return;
        }
      }
      const hasFinalInput = Boolean(
        finalHarvest.count || finalHarvest.date || finalHarvest.abw ||
        finalHarvest.harvested_quantity || finalHarvest.harvested_biomass
      );
      if (hasFinalInput && (!finalHarvest.count || String(finalHarvest.count).trim() === '')) {
        toast.error('Count is mandatory for Final Harvest');
        setLoading(false);
        return;
      }
    }

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
      feeding_details: showFeeding ? feedingDetails : (showFinalHarvest && (finalHarvest.total_feed || finalHarvest.fcr || feedingDetails.cumulative_feed) ? {
        ...feedingDetails,
        cumulative_feed: finalHarvest.total_feed || feedingDetails.cumulative_feed || '',
        total_feed: finalHarvest.total_feed || feedingDetails.cumulative_feed || '',
        fcr: finalHarvest.fcr || feedingDetails.fcr || (harvestDerived.fcr !== '—' ? harvestDerived.fcr : ''),
        total_biomass: harvestDerived.totalBiomass !== '—' ? harvestDerived.totalBiomass : (finalHarvest.harvested_biomass || ''),
      } : null),
      medication_details: showMedication ? medications : null,
      disease_details: showDisease ? diseaseDetails : null,
      harvest_details: showHarvest ? {
        partial_harvests: showPartialHarvest ? partialHarvests.map((ph, idx) => ({
          ...ph,
          harvest_no: ph.harvest_no || (previousPartialHarvests.length + idx + 1),
        })) : [],
        final_harvest: showFinalHarvest ? {
          ...finalHarvest,
          total_feed: finalHarvest.total_feed || (harvestDerived.totalFeed !== '—' ? String(harvestDerived.totalFeed).replace(/kg/i, '').trim() : '') || feedingDetails.cumulative_feed || '',
          fcr: finalHarvest.fcr || (harvestDerived.fcr !== '—' ? harvestDerived.fcr : '') || feedingDetails.fcr || '',
          total_biomass: harvestDerived.totalBiomass !== '—' ? harvestDerived.totalBiomass : (finalHarvest.harvested_biomass || ''),
          survival_rate: harvestDerived.survival !== '—' ? String(harvestDerived.survival).replace('%', '').trim() : '',
        } : null,
        derived: harvestDerived,
      } : null,
    };

    try {
      queryClient.invalidateQueries({ queryKey: ['client'] });
      queryClient.invalidateQueries({ queryKey: ['clients-list'] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });

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
                  onChange={(e) => handleTankSelection(e.target.value)}
                  disabled={!clientId}
                  className="input text-xs py-1"
                >
                  <option value="">
                    {!clientId
                      ? 'Select farmer first'
                      : tanksLoading
                        ? 'Loading tanks...'
                        : selectedClient?.ponds?.length
                          ? 'Select tank...'
                          : 'No tanks found for this farmer'}
                  </option>
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
                  <option value="disease">Disease</option>
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
                  readOnly={isDocAutoOnly && !isEdit}
                  className={`input text-xs py-1 ${(isDocAutoOnly && !isEdit) ? 'bg-gray-50 text-gray-600 cursor-not-allowed' : ''}`}
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
                  readOnly={isDocAutoOnly && !isEdit}
                  className={`input text-xs py-1 ${(isDocAutoOnly && !isEdit) ? 'bg-gray-50 text-gray-600 cursor-not-allowed' : ''}`}
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

        {showDisease && (
          <div className="card">
            <div className="card-header py-2.5 px-4"><h3 className="font-semibold text-gray-900 text-sm">Disease</h3></div>
            <div className="card-body p-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                {DISEASE_OPTIONS.map((d) => {
                  const checked = (diseaseDetails.diseases || []).includes(d);
                  return (
                    <label key={d} className={`flex items-center gap-2 rounded border px-2 py-1.5 text-xs cursor-pointer select-none ${checked ? 'bg-gray-100 border-gray-400 text-gray-900 font-semibold' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 shrink-0"
                        checked={checked}
                        onChange={() => setDiseaseDetails((prev) => {
                          const cur = prev.diseases || [];
                          return { ...prev, diseases: checked ? cur.filter(x => x !== d) : [...cur, d] };
                        })}
                      />
                      <span className="leading-tight">{d}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Partial Harvest Section */}
        {showPartialHarvest && (
          <div className="card">
            <div className="card-header flex items-center justify-between py-2.5 px-4">
              <h3 className="font-semibold text-gray-900 text-sm">Partial Harvest</h3>
              <button
                type="button"
                onClick={addPartialHarvest}
                className="btn-secondary btn-sm py-1 px-2.5 text-xs flex items-center gap-1"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span>+ Partial Harvest</span>
              </button>
            </div>

            <div className="card-body p-4 space-y-3">
              {/* Previous Partial Harvests */}
              {previousPartialHarvests.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-gray-700 block">Previous Partial Harvests</span>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="table text-xs w-full bg-white">
                      <thead>
                        <tr className="bg-gray-50 text-gray-700">
                          <th className="py-2 px-3 text-left">Harvest #</th>
                          <th className="py-2 px-3 text-left">Date</th>
                          <th className="py-2 px-3 text-left">DOC</th>
                          <th className="py-2 px-3 text-left">Count</th>
                          <th className="py-2 px-3 text-left">ABW (g)</th>
                          <th className="py-2 px-3 text-left">Quantity (kg)</th>
                          <th className="py-2 px-3 text-left">Biomass (kg)</th>
                          <th className="py-2 px-3 text-left">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previousPartialHarvests.map((ph, idx) => (
                          <tr key={idx} className="border-t border-gray-100">
                            <td className="py-2 px-3 font-semibold text-gray-900">
                              #{ph.harvest_no || (idx + 1)}
                            </td>
                            <td className="py-2 px-3 text-gray-700">{ph.date || '—'}</td>
                            <td className="py-2 px-3 text-gray-700">{ph.doc || '—'}</td>
                            <td className="py-2 px-3 font-mono text-gray-900">{ph.count || '—'}</td>
                            <td className="py-2 px-3 text-gray-700">{ph.abw || '—'}</td>
                            <td className="py-2 px-3 text-gray-900">{ph.harvested_quantity || '—'}</td>
                            <td className="py-2 px-3 text-gray-900">{ph.harvested_biomass || '—'}</td>
                            <td className="py-2 px-3 text-gray-500">{ph.remarks || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* New Partial Harvest Entries */}
              {partialHarvests.map((ph, idx) => {
                const currentHarvestNum = previousPartialHarvests.length + idx + 1;
                return (
                  <div key={idx} className="p-2.5 rounded-lg bg-gray-50 border border-gray-100 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-gray-600 font-medium">
                      <span>Partial Harvest #{currentHarvestNum}</span>
                      {partialHarvests.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePartialHarvest(idx)}
                          className="text-gray-400 hover:text-gray-600 p-0.5"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 font-medium block mb-0.5">Date</label>
                        <input
                          type="date"
                          value={ph.date || ''}
                          onChange={e => updatePartialHarvest(idx, 'date', e.target.value)}
                          className="input text-xs py-1 w-full"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 font-medium block mb-0.5">DOC</label>
                        <input
                          type="number"
                          value={ph.doc ?? ''}
                          onChange={e => updatePartialHarvest(idx, 'doc', e.target.value)}
                          placeholder="DOC"
                          readOnly={isDocAutoOnly && !isEdit}
                          className={`input text-xs py-1 w-full ${(isDocAutoOnly && !isEdit) ? 'bg-gray-50 text-gray-600 cursor-not-allowed' : ''}`}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-700 font-medium block mb-0.5">
                          Count *
                        </label>
                        <input
                          type="number"
                          step="any"
                          required
                          value={ph.count ?? ''}
                          onChange={e => updatePartialHarvest(idx, 'count', e.target.value)}
                          placeholder="Count *"
                          className="input text-xs py-1 w-full"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 font-medium block mb-0.5">ABW (g)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={ph.abw ?? ''}
                          onChange={e => updatePartialHarvest(idx, 'abw', e.target.value)}
                          placeholder="ABW (g)"
                          className="input text-xs py-1 w-full"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 font-medium block mb-0.5">Quantity (kg)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={ph.harvested_quantity ?? ''}
                          onChange={e => updatePartialHarvest(idx, 'harvested_quantity', e.target.value)}
                          placeholder="Qty (kg)"
                          className="input text-xs py-1 w-full"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 font-medium block mb-0.5">Biomass (kg)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={ph.harvested_biomass ?? ''}
                          onChange={e => updatePartialHarvest(idx, 'harvested_biomass', e.target.value)}
                          placeholder="Biomass (kg)"
                          className="input text-xs py-1 font-mono w-full"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Final Harvest Section */}
        {showFinalHarvest && (
          <div className="card">
            <div className="card-header py-2.5 px-4">
              <h3 className="font-semibold text-gray-900 text-sm">Final Harvest</h3>
            </div>

            <div className="card-body p-4 space-y-3">
              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-gray-600 font-medium">
                  <span>Final Harvest</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 font-medium block mb-0.5">Date</label>
                    <input
                      type="date"
                      value={finalHarvest.date || ''}
                      onChange={e => updateFinalHarvest('date', e.target.value)}
                      className="input text-xs py-1 w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-medium block mb-0.5">DOC</label>
                    <input
                      type="number"
                      value={finalHarvest.doc ?? ''}
                      onChange={e => updateFinalHarvest('doc', e.target.value)}
                      placeholder="DOC"
                      readOnly={isDocAutoOnly && !isEdit}
                      className={`input text-xs py-1 w-full ${(isDocAutoOnly && !isEdit) ? 'bg-gray-50 text-gray-600 cursor-not-allowed' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-700 font-medium block mb-0.5">
                      Count *
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={finalHarvest.count ?? ''}
                      onChange={e => updateFinalHarvest('count', e.target.value)}
                      placeholder="Count *"
                      className="input text-xs py-1 w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-medium block mb-0.5">ABW (g)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={finalHarvest.abw ?? ''}
                      onChange={e => updateFinalHarvest('abw', e.target.value)}
                      placeholder="ABW (g)"
                      className="input text-xs py-1 w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-medium block mb-0.5">Quantity (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={finalHarvest.harvested_quantity ?? ''}
                      onChange={e => updateFinalHarvest('harvested_quantity', e.target.value)}
                      placeholder="Qty (kg)"
                      className="input text-xs py-1 w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-medium block mb-0.5">Biomass (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={finalHarvest.harvested_biomass ?? ''}
                      onChange={e => updateFinalHarvest('harvested_biomass', e.target.value)}
                      placeholder="Biomass (kg)"
                      className="input text-xs py-1 font-mono w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-medium block mb-0.5">Total Feed (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={finalHarvest.total_feed ?? feedingDetails.cumulative_feed ?? ''}
                      onChange={e => updateFinalHarvest('total_feed', e.target.value)}
                      placeholder="Feed (kg)"
                      className="input text-xs py-1 font-mono w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-medium block mb-0.5">FCR (Auto)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={finalHarvest.fcr || (harvestDerived.fcr !== '—' ? harvestDerived.fcr : '') || feedingDetails.fcr || ''}
                      onChange={e => updateFinalHarvest('fcr', e.target.value)}
                      placeholder="FCR"
                      className="input text-xs py-1 font-mono w-full bg-emerald-50/50 text-emerald-800 font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Production Summary Strip */}
              <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
                <div>Total Biomass: <span className="font-semibold text-gray-900 font-mono">{harvestDerived.totalBiomass} kg</span></div>
                <div>Total Feed: <span className="font-semibold text-gray-900 font-mono">{harvestDerived.totalFeed}</span></div>
                <div>FCR: <span className="font-semibold text-emerald-700 font-mono font-bold">{harvestDerived.fcr}</span></div>
                <div>Total Count: <span className="font-semibold text-gray-900 font-mono">{harvestDerived.totalCount}</span></div>
                <div>Survival: <span className="font-semibold text-gray-900 font-mono">{harvestDerived.survival}</span></div>
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
