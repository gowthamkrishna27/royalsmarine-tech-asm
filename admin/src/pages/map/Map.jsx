import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import clientService from '../../services/clientService';
import { visitApi } from '../../services/api';
import Spinner, { PageSpinner } from '../../components/common/Spinner';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
    Square3Stack3DIcon,
  MapPinIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';

const getL = () => (typeof window !== 'undefined' ? window.L : null);

const parseCoordinates = (text) => {
  if (!text) return null;
  const cleaned = text.trim();
  const match = cleaned.match(/^([+-]?\d+(?:\.\d+)?)[,\s]+([+-]?\d+(?:\.\d+)?)$/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }
  return null;
};

export default function MapPage() {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const searchContainerRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const markerMapRef = useRef({});
  const suppressFitBoundsRef = useRef(false);

  const osmLayerRef = useRef(null);
  const satelliteLayerRef = useRef(null);
  const activeRangeLayersRef = useRef([]);

  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [mapMode, setMapMode] = useState('satellite'); // Satellite view by default
  const [isLeafletReady, setIsLeafletReady] = useState(Boolean(typeof window !== 'undefined' && window.L));

  // Regional & Personnel Filters (regions, asm's, techs, farmers)
  const [region, setRegion] = useState('');
  const [asmId, setAsmId] = useState('');
  const [techId, setTechId] = useState('');
  const [farmerId, setFarmerId] = useState('');

  // Fetch filter metadata (regions, ASMs, techs, farmers)
  const { data: filterMeta } = useQuery({
    queryKey: ['visit-filters'],
    queryFn: () => visitApi.getFilters().then((r) => r.data.data),
    staleTime: 60000,
  });

  // 1. Region dropdown options
  const regionOptions = useMemo(() => {
    return (filterMeta?.regions || []).map((r) => ({
      value: r,
      label: r,
    }));
  }, [filterMeta?.regions]);

  // 2. ASM dropdown options (filtered by selected Region)
  const asmOptions = useMemo(() => {
    const list = filterMeta?.asms || [];
    const filtered = region
      ? list.filter((a) => (a.region || '').toLowerCase() === region.toLowerCase())
      : list;
    return filtered.map((a) => ({
      value: String(a.id),
      label: a.name + (!region && a.region ? ` (${a.region})` : ''),
    }));
  }, [filterMeta?.asms, region]);

  // 3. Tech dropdown options (filtered by selected ASM, or by selected Region)
  const techOptions = useMemo(() => {
    let list = filterMeta?.techs || [];
    if (asmId) {
      list = list.filter((t) => String(t.manager_id) === String(asmId));
    } else if (region) {
      list = list.filter((t) => (t.region || '').toLowerCase() === region.toLowerCase());
    }
    return list.map((t) => ({
      value: String(t.id),
      label: t.name,
    }));
  }, [filterMeta?.techs, asmId, region]);

  // 4. Farmer dropdown options (filtered by selected Tech, or by selected ASM, or by selected Region)
  const farmerOptions = useMemo(() => {
    let list = filterMeta?.farmers || [];
    if (techId) {
      list = list.filter((f) => String(f.assigned_salesperson_id) === String(techId));
    } else if (asmId) {
      const techIdsUnderAsm = new Set(
        (filterMeta?.techs || [])
          .filter((t) => String(t.manager_id) === String(asmId))
          .map((t) => String(t.id))
      );
      list = list.filter(
        (f) =>
          String(f.assigned_manager_id) === String(asmId) ||
          techIdsUnderAsm.has(String(f.assigned_salesperson_id))
      );
    } else if (region) {
      list = list.filter((f) => (f.region || '').toLowerCase() === region.toLowerCase());
    }
    return list.map((f) => ({
      value: String(f.id),
      label: f.name,
    }));
  }, [filterMeta?.farmers, filterMeta?.techs, techId, asmId, region]);

  // Cascading change handlers
  const handleRegionChange = (newRegion) => {
    setRegion(newRegion);

    if (asmId && newRegion) {
      const currentAsm = (filterMeta?.asms || []).find((a) => String(a.id) === String(asmId));
      if (currentAsm && (currentAsm.region || '').toLowerCase() !== newRegion.toLowerCase()) {
        setAsmId('');
        setTechId('');
        setFarmerId('');
        return;
      }
    }
    if (techId && newRegion) {
      const currentTech = (filterMeta?.techs || []).find((t) => String(t.id) === String(techId));
      if (currentTech && (currentTech.region || '').toLowerCase() !== newRegion.toLowerCase()) {
        setTechId('');
        setFarmerId('');
        return;
      }
    }
    if (farmerId && newRegion) {
      const currentFarmer = (filterMeta?.farmers || []).find((f) => String(f.id) === String(farmerId));
      if (currentFarmer && (currentFarmer.region || '').toLowerCase() !== newRegion.toLowerCase()) {
        setFarmerId('');
      }
    }
  };

  const handleAsmChange = (newAsmId) => {
    setAsmId(newAsmId);

    if (newAsmId) {
      const chosenAsm = (filterMeta?.asms || []).find((a) => String(a.id) === String(newAsmId));
      if (chosenAsm?.region && !region) {
        setRegion(chosenAsm.region);
      }
    }

    if (techId && newAsmId) {
      const currentTech = (filterMeta?.techs || []).find((t) => String(t.id) === String(techId));
      if (currentTech && String(currentTech.manager_id) !== String(newAsmId)) {
        setTechId('');
        setFarmerId('');
        return;
      }
    }

    if (farmerId && newAsmId) {
      const techIdsUnderAsm = new Set(
        (filterMeta?.techs || [])
          .filter((t) => String(t.manager_id) === String(newAsmId))
          .map((t) => String(t.id))
      );
      const currentFarmer = (filterMeta?.farmers || []).find((f) => String(f.id) === String(farmerId));
      if (
        currentFarmer &&
        String(currentFarmer.assigned_manager_id) !== String(newAsmId) &&
        !techIdsUnderAsm.has(String(currentFarmer.assigned_salesperson_id))
      ) {
        setFarmerId('');
      }
    }
  };

  const handleTechChange = (newTechId) => {
    setTechId(newTechId);

    if (newTechId) {
      const chosenTech = (filterMeta?.techs || []).find((t) => String(t.id) === String(newTechId));
      if (chosenTech) {
        if (chosenTech.manager_id && !asmId) {
          setAsmId(String(chosenTech.manager_id));
        }
        if (chosenTech.region && !region) {
          setRegion(chosenTech.region);
        }
      }
    }

    if (farmerId && newTechId) {
      const currentFarmer = (filterMeta?.farmers || []).find((f) => String(f.id) === String(farmerId));
      if (currentFarmer && String(currentFarmer.assigned_salesperson_id) !== String(newTechId)) {
        setFarmerId('');
      }
    }
  };

  const handleFarmerChange = (newFarmerId) => {
    setFarmerId(newFarmerId);

    if (newFarmerId) {
      const chosenFarmer = (filterMeta?.farmers || []).find((f) => String(f.id) === String(newFarmerId));
      if (chosenFarmer) {
        if (chosenFarmer.assigned_salesperson_id && !techId) {
          setTechId(String(chosenFarmer.assigned_salesperson_id));
        }
        if (chosenFarmer.assigned_manager_id && !asmId) {
          setAsmId(String(chosenFarmer.assigned_manager_id));
        }
        if (chosenFarmer.region && !region) {
          setRegion(chosenFarmer.region);
        }
      }
    }
  };
  const handleResetFilters = () => {
    setRegion('');
    setAsmId('');
    setTechId('');
    setFarmerId('');
    setSelectedDate('');
  };

  const hasActiveFilters = Boolean(region || asmId || techId || farmerId || selectedDate);

  // Real-time geocoding & place search state
  const [geoResults, setGeoResults] = useState([]);
  const [isGeoSearching, setIsGeoSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [locating, setLocating] = useState(false);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleSearchClickOutside(event) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleSearchClickOutside);
    document.addEventListener('touchstart', handleSearchClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleSearchClickOutside);
      document.removeEventListener('touchstart', handleSearchClickOutside);
    };
  }, []);

  // Poll for Leaflet CDN script if loading
  useEffect(() => {
    if (typeof window !== 'undefined' && window.L) {
      setIsLeafletReady(true);
      return;
    }
    const timer = setInterval(() => {
      if (typeof window !== 'undefined' && window.L) {
        setIsLeafletReady(true);
        clearInterval(timer);
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['map-locations', selectedDate, region, asmId, techId, farmerId],
    queryFn: () =>
      clientService
        .getMapLocations({
          date: selectedDate || undefined,
          region: region || undefined,
          asm_id: asmId || undefined,
          tech_id: techId || undefined,
          farmer_id: farmerId || undefined,
        })
        .then((res) => res.data.data),
  });

  const clients = data?.clients || [];
  const ponds = data?.ponds || [];

  // Mappable items with valid coordinates
  const items = useMemo(() => {
    const list = [];

    clients.forEach(c => {
      const lat = parseFloat(c.latitude);
      const lng = parseFloat(c.longitude);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        list.push({
          id: `farmer-${c.id}`,
          rawId: c.id,
          type: 'farmer',
          name: c.company_name,
          contact_person: c.contact_person,
          mobile: c.mobile,
          city: c.city,
          state: c.state,
          address: c.address || c.gps_address,
          latitude: lat,
          longitude: lng,
        });
      }
    });

    ponds.forEach(p => {
      const lat = parseFloat(p.latitude);
      const lng = parseFloat(p.longitude);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        const parentFarmer = clients.find(c => c.id === p.client_id);
        list.push({
          id: `pond-${p.id}`,
          rawId: p.id,
          clientId: p.client_id,
          type: 'pond',
          name: p.pond_name,
          farmer_name: parentFarmer?.company_name,
          mobile: parentFarmer?.mobile,
          area_acres: p.area_acres || p.area,
          culture_type: p.culture_type,
          address: p.gps_address,
          latitude: lat,
          longitude: lng,
          has_test: Boolean(p.has_test || p.latest_visit_id),
          test_distance_meters: p.test_distance_meters != null ? p.test_distance_meters : null,
          test_latitude: p.test_latitude ? parseFloat(p.test_latitude) : null,
          test_longitude: p.test_longitude ? parseFloat(p.test_longitude) : null,
          test_date: p.test_date,
          test_time: p.test_time,
          tested_by_name: p.tested_by_name,
          tested_by_role: p.tested_by_role,
          tested_by_role_name: p.tested_by_role_name || (p.tested_by_role === 'sales_manager' ? 'ASM' : 'Technical Executive'),
          latest_visit_id: p.latest_visit_id,
        });
      }
    });

    return list;
  }, [clients, ponds]);

  // Auto-center and zoom to farmer when farmer is selected
  useEffect(() => {
    if (farmerId && items.length > 0 && mapInstanceRef.current) {
      const farmerItem = items.find(
        (i) => i.type === 'farmer' && String(i.rawId) === String(farmerId)
      );
      if (farmerItem) {
        suppressFitBoundsRef.current = true;
        mapInstanceRef.current.flyTo([farmerItem.latitude, farmerItem.longitude], 16, { duration: 1.2 });
        const marker = markerMapRef.current[farmerItem.id];
        if (marker) {
          setTimeout(() => marker.openPopup(), 1200);
        }
      }
    }
  }, [farmerId, items]);

  // Matching local farmers and ponds for real-time autocomplete
  const matchingLocalItems = useMemo(() => {
    if (!search.trim() || search.trim().length < 2) return [];
    const q = search.toLowerCase().trim();
    return items.filter(item => {
      const matchesName = item.name?.toLowerCase().includes(q);
      const matchesCity = item.city?.toLowerCase().includes(q);
      const matchesFarmer = item.farmer_name?.toLowerCase().includes(q);
      const matchesMobile = item.mobile?.includes(q);
      return matchesName || matchesCity || matchesFarmer || matchesMobile;
    }).slice(0, 5);
  }, [items, search]);

  // Direct GPS detection
  const directCoords = useMemo(() => parseCoordinates(search), [search]);

  // Real-time Geocoding Search (Photon API + Nominatim fallback)
  const executeGeoSearch = async (queryText) => {
    const q = queryText.trim();
    if (!q || q.length < 2 || parseCoordinates(q)) {
      setGeoResults([]);
      return [];
    }

    setIsGeoSearching(true);
    try {
      // 1. Try Photon (fast, biased toward Andhra Pradesh aquaculture center)
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
        q
      )}&limit=5&lat=16.5&lon=81.0`;
      const res = await fetch(photonUrl);
      if (res.ok) {
        const data = await res.json();
        if (data?.features && data.features.length > 0) {
          const list = data.features.map(f => {
            const parts = [
              f.properties.name,
              f.properties.district || f.properties.county || f.properties.city,
              f.properties.state,
              f.properties.country,
            ].filter(Boolean);
            const uniqueParts = parts.filter((p, i) => parts.indexOf(p) === i);
            return {
              title: f.properties.name || uniqueParts[0],
              subtitle: uniqueParts.slice(1).join(', ') || '',
              lat: f.geometry.coordinates[1],
              lon: f.geometry.coordinates[0],
            };
          });
          setGeoResults(list);
          return list;
        }
      }

      // 2. Fallback to Nominatim
      const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        q
      )}&limit=5&addressdetails=1`;
      const nomRes = await fetch(nomUrl);
      if (nomRes.ok) {
        const nomData = await nomRes.json();
        if (Array.isArray(nomData) && nomData.length > 0) {
          const list = nomData.map(item => {
            const parts = (item.display_name || '').split(',').map(s => s.trim());
            return {
              title: parts[0] || item.display_name,
              subtitle: parts.slice(1, 4).join(', '),
              lat: parseFloat(item.lat),
              lon: parseFloat(item.lon),
            };
          });
          setGeoResults(list);
          return list;
        }
      }
      setGeoResults([]);
      return [];
    } catch (e) {
      setGeoResults([]);
      return [];
    } finally {
      setIsGeoSearching(false);
    }
  };

  const handleSearchChange = (val) => {
    setSearch(val);
    setShowSearchDropdown(true);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!val.trim() || val.trim().length < 2 || parseCoordinates(val)) {
      setGeoResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      executeGeoSearch(val);
    }, 300);
  };

  const handleSelectLocalItem = (item) => {
    suppressFitBoundsRef.current = true;
    setShowSearchDropdown(false);
    setSearch(item.name);
    const map = mapInstanceRef.current;
    if (!map) return;

    map.flyTo([item.latitude, item.longitude], 17, { duration: 1.2 });
    const marker = markerMapRef.current[item.id];
    if (marker) {
      setTimeout(() => marker.openPopup(), 1200);
    }
  };

  const handleSelectGeoItem = (item) => {
    suppressFitBoundsRef.current = true;
    setShowSearchDropdown(false);
    setSearch(item.title);
    const map = mapInstanceRef.current;
    if (!map) return;

    map.flyTo([item.lat, item.lon], 14, { duration: 1.2 });
  };

  const handleSelectCoords = (coords) => {
    suppressFitBoundsRef.current = true;
    setShowSearchDropdown(false);
    const map = mapInstanceRef.current;
    if (!map) return;

    map.flyTo([coords.latitude, coords.longitude], 17, { duration: 1.2 });
  };

  const handleSearchSubmit = async (e) => {
    if (e) e.preventDefault();
    if (directCoords) {
      handleSelectCoords(directCoords);
      return;
    }
    if (matchingLocalItems.length > 0) {
      handleSelectLocalItem(matchingLocalItems[0]);
      return;
    }
    if (geoResults.length > 0) {
      handleSelectGeoItem(geoResults[0]);
      return;
    }
    if (search.trim()) {
      const results = await executeGeoSearch(search);
      if (results && results.length > 0) {
        handleSelectGeoItem(results[0]);
      }
    }
  };

  const currentLocationMarkerRef = useRef(null);

  const updateCurrentLocationMarker = (lat, lng, shouldFly = true) => {
    const L = getL();
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    if (currentLocationMarkerRef.current) {
      currentLocationMarkerRef.current.setLatLng([lat, lng]);
    } else {
      const locationIcon = L.icon({
        iconUrl: '/logo.png',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16],
        className: 'current-location-logo',
      });

      const popupContent = `
        <div style="font-family: inherit; font-size: 11px; text-align: center; padding: 2px;">
          <div style="font-weight: 600; color: #111827;">Current Location</div>
          <div style="font-size: 10px; color: #6b7280; font-family: monospace; margin-top: 2px;">
            ${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}
          </div>
        </div>
      `;

      const marker = L.marker([lat, lng], {
        icon: locationIcon,
        zIndexOffset: 1000,
        title: 'Current Location',
      });
      marker.bindPopup(popupContent);
      marker.addTo(map);
      currentLocationMarkerRef.current = marker;
    }

    if (shouldFly) {
      suppressFitBoundsRef.current = true;
      map.flyTo([lat, lng], 17, { duration: 1.2 });
      setTimeout(() => {
        if (currentLocationMarkerRef.current) {
          currentLocationMarkerRef.current.openPopup();
        }
      }, 1200);
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    suppressFitBoundsRef.current = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        updateCurrentLocationMarker(latitude, longitude, true);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Auto-detect current position on map load to place the logo marker
  useEffect(() => {
    if (isLeafletReady && mapInstanceRef.current && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          updateCurrentLocationMarker(latitude, longitude, false);
        },
        () => {},
        { enableHighAccuracy: false, timeout: 6000 }
      );
    }
  }, [isLeafletReady]);

  // Filtered items on map canvas
  const filtered = useMemo(() => {
    return items.filter(item => {
      if (search.trim() && !directCoords) {
        const q = search.toLowerCase();
        const matchesName = item.name?.toLowerCase().includes(q);
        const matchesCity = item.city?.toLowerCase().includes(q);
        const matchesFarmer = item.farmer_name?.toLowerCase().includes(q);
        const matchesMobile = item.mobile?.includes(q);
        if (!matchesName && !matchesCity && !matchesFarmer && !matchesMobile) return false;
      }
      return true;
    });
  }, [items, search, directCoords]);

  // Init map
  useEffect(() => {
    const L = getL();
    if (!isLeafletReady || !L || !mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [16.5062, 80.6480],
      zoom: 7,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    // Ultra-High Resolution Google Streets HD (2x Retina scale)
    const osmLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&scale=2', {
      maxNativeZoom: 19,
      maxZoom: 22,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      keepBuffer: 8,
      updateWhenIdle: false,
      updateWhenZooming: false,
      attribution: '&copy; Google Maps HD',
    });

    // Ultra-High Resolution Google Hybrid Satellite HD (2x Retina scale)
    const satelliteLayer = L.tileLayer(
      'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&scale=2',
      {
        maxNativeZoom: 19,
        maxZoom: 22,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        keepBuffer: 8,
        updateWhenIdle: false,
        updateWhenZooming: false,
        attribution: '&copy; Google Maps HD',
      }
    );

    // Pure Satellite HD (No labels, ideal for identifying aquaculture ponds)
    const pureSatLayer = L.tileLayer(
      'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&scale=2',
      {
        maxNativeZoom: 19,
        maxZoom: 22,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        keepBuffer: 8,
        updateWhenIdle: false,
        updateWhenZooming: false,
        attribution: '&copy; Google Satellite HD',
      }
    );

    // Esri World Imagery (High-Clarity Satellite for Agriculture & Farms)
    const esriLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxNativeZoom: 19,
        maxZoom: 22,
        keepBuffer: 8,
        attribution: '&copy; Esri World Imagery',
      }
    );

    osmLayerRef.current = osmLayer;
    satelliteLayerRef.current = satelliteLayer;

    if (mapMode === 'satellite') {
      satelliteLayer.addTo(map);
    } else {
      osmLayer.addTo(map);
    }

    const baseMaps = {
      '🛰️ Google Hybrid HD': satelliteLayer,
      '🌍 Pure Satellite HD': pureSatLayer,
      '🌾 Esri Clarity HD': esriLayer,
      '🏙️ Google Streets HD': osmLayer,
    };
    L.control.layers(baseMaps, null, { position: 'bottomright' }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    markersLayerRef.current = markersLayer;

    // Multi-stage size invalidation to guarantee full tile coverage
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 300);
    const t3 = setTimeout(() => map.invalidateSize(), 700);

    // Watch for flexbox layout adjustments and window resizes
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (resizeObserver) resizeObserver.disconnect();
      activeRangeLayersRef.current.forEach(layer => {
        try { map.removeLayer(layer); } catch {}
      });
      activeRangeLayersRef.current = [];
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
    };
  }, [isLeafletReady]);

  // Handle map mode switch (Roads vs Satellite)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const osm = osmLayerRef.current;
    const sat = satelliteLayerRef.current;
    if (!map || !osm || !sat) return;

    if (mapMode === 'satellite') {
      if (map.hasLayer(osm)) map.removeLayer(osm);
      if (!map.hasLayer(sat)) map.addLayer(sat);
    } else {
      if (map.hasLayer(sat)) map.removeLayer(sat);
      if (!map.hasLayer(osm)) map.addLayer(osm);
    }
  }, [mapMode]);

  // Handle window resize or container size updates
  useEffect(() => {
    if (mapInstanceRef.current) {
      const timer = setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [filtered.length]);

  // Update markers
  useEffect(() => {
    const L = getL();
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!isLeafletReady || !L || !map || !markersLayer) return;

    activeRangeLayersRef.current.forEach(layer => {
      try { map.removeLayer(layer); } catch {}
    });
    activeRangeLayersRef.current = [];
    markersLayer.clearLayers();
    markerMapRef.current = {};
    const bounds = L.latLngBounds([]);
    let hasBounds = false;

    filtered.forEach((item) => {
      const isFarmer = item.type === 'farmer';
      const color = isFarmer ? '#2563eb' : '#059669';

      const icon = L.divIcon({
        className: 'custom-pin',
        html: `<div style="
          background-color: ${color};
          width: 30px;
          height: 30px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 2.5px solid #fff;
          box-shadow: 0 3px 6px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="transform: rotate(45deg); width: 9px; height: 9px; background: #fff; border-radius: 50%;"></div>
        </div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30],
      });

      const popup = `
        <div style="font-family: inherit; font-size: 13px; min-width: 170px; padding: 2px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;">
            <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: ${
              isFarmer ? '#2563eb' : '#059669'
            };">
              ${isFarmer ? 'Farmer' : 'Pond'}
            </span>
            ${item.city ? `
              <span style="font-size: 10px; color: #d1d5db;">•</span>
              <span style="font-size: 11px; color: #6b7280; font-weight: 500;">${item.city}</span>
            ` : ''}
          </div>

          <p style="font-weight: 700; color: #111827; margin: 0 0 3px 0; font-size: 14px; line-height: 1.3;">
            ${item.name}
          </p>

          ${!isFarmer && item.farmer_name ? `
            <p style="color: #6b7280; font-size: 11px; margin: 0 0 2px 0;">
              ${item.farmer_name} ${item.area_acres ? `· ${item.area_acres} Ac` : ''}
            </p>
          ` : ''}

          ${item.mobile ? `
            <p style="margin: 3px 0 0 0; font-size: 12px;">
              <a href="tel:${item.mobile}" style="color: #4b5563; font-weight: 500; text-decoration: none;">
                ${item.mobile}
              </a>
            </p>
          ` : ''}

          ${!isFarmer ? `
            <div style="margin: 7px 0 5px 0; padding: 6px 8px; background: ${item.has_test ? '#f0fdf4' : '#f9fafb'}; border: 1px solid ${item.has_test ? '#bbf7d0' : '#e5e7eb'}; border-radius: 8px;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                <span style="font-size: 10px; font-weight: 700; color: ${item.has_test ? '#166534' : '#6b7280'}; text-transform: uppercase; letter-spacing: 0.03em;">
                  Test Range
                </span>
                ${item.test_distance_meters != null ? `
                  <span style="font-size: 11px; font-weight: 800; color: #15803d; background: #dcfce7; padding: 1.5px 6px; border-radius: 6px; border: 1px solid #86efac;">
                    ${item.test_distance_meters} m from tank
                  </span>
                ` : `
                  <span style="font-size: 10px; font-weight: 600; color: #9ca3af;">
                    No test logged
                  </span>
                `}
              </div>

              ${item.has_test ? `
                <div style="font-size: 11px; color: #374151; margin-top: 3px; line-height: 1.25;">
                  Tested by <strong style="color: #111827;">${item.tested_by_name || 'Executive'}</strong>
                  <span style="font-size: 10px; color: #6b7280;">(${item.tested_by_role_name || (item.tested_by_role === 'sales_manager' ? 'ASM' : 'Technical Executive')})</span>
                </div>
                ${item.test_date ? `
                  <div style="font-size: 10px; color: #6b7280; margin-top: 2px;">
                    Date: ${item.test_date}${item.test_time ? ` at ${item.test_time}` : ''}
                  </div>
                ` : ''}
              ` : `
                <div style="font-size: 10px; color: #6b7280; margin-top: 2px;">
                  No field test recorded yet
                </div>
              `}
            </div>
          ` : ''}

          <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}" 
               target="_blank" rel="noreferrer" 
               style="font-size: 11px; font-weight: 500; color: #4b5563; text-decoration: none;">
              Directions ↗
            </a>
            ${isFarmer ? `
              <a href="/clients/${item.rawId}" style="font-size: 11px; font-weight: 500; color: #4b5563; text-decoration: none;">
                Profile →
              </a>
            ` : item.clientId ? `
              <a href="/clients/${item.clientId}" style="font-size: 11px; font-weight: 500; color: #4b5563; text-decoration: none;">
                Farmer →
              </a>
            ` : ''}
          </div>
        </div>
      `;

      const marker = L.marker([item.latitude, item.longitude], { icon, title: item.name });
      marker.bindPopup(popup);

      if (!isFarmer && item.has_test && item.test_distance_meters != null) {
        // When filtered by date, show range circles directly on the map
        if (selectedDate) {
          const circleRadius = Math.max(Number(item.test_distance_meters), 6);
          const rangeCircle = L.circle([item.latitude, item.longitude], {
            radius: circleRadius,
            color: '#059669',
            fillColor: '#10b981',
            fillOpacity: 0.22,
            weight: 2,
            dashArray: '5, 5',
          }).addTo(map);
          activeRangeLayersRef.current.push(rangeCircle);

          if (item.test_latitude && item.test_longitude) {
            const line = L.polyline([
              [item.latitude, item.longitude],
              [item.test_latitude, item.test_longitude],
            ], {
              color: '#047857',
              weight: 2,
              dashArray: '3, 4',
            }).addTo(map);
            activeRangeLayersRef.current.push(line);

            const testDot = L.circleMarker([item.test_latitude, item.test_longitude], {
              radius: 6,
              color: '#065f46',
              fillColor: '#34d399',
              fillOpacity: 1,
              weight: 2,
            }).addTo(map);

            testDot.bindTooltip(
              `<b>Test Location:</b> ${item.test_distance_meters}m from tank<br/>${item.tested_by_name || 'Executive'} (${item.tested_by_role_name || 'ASM / Tech'})`,
              { permanent: false, direction: 'top' }
            );
            activeRangeLayersRef.current.push(testDot);
          }
        }
        marker.on('popupopen', () => {
          activeRangeLayersRef.current.forEach(layer => {
            try { map.removeLayer(layer); } catch {}
          });
          activeRangeLayersRef.current = [];

          const circleRadius = Math.max(Number(item.test_distance_meters), 6);
          const rangeCircle = L.circle([item.latitude, item.longitude], {
            radius: circleRadius,
            color: '#059669',
            fillColor: '#10b981',
            fillOpacity: 0.18,
            weight: 2,
            dashArray: '5, 5',
          }).addTo(map);
          activeRangeLayersRef.current.push(rangeCircle);

          if (item.test_latitude && item.test_longitude) {
            const line = L.polyline([
              [item.latitude, item.longitude],
              [item.test_latitude, item.test_longitude],
            ], {
              color: '#047857',
              weight: 2,
              dashArray: '3, 4',
            }).addTo(map);
            activeRangeLayersRef.current.push(line);

            const testDot = L.circleMarker([item.test_latitude, item.test_longitude], {
              radius: 6,
              color: '#065f46',
              fillColor: '#34d399',
              fillOpacity: 1,
              weight: 2,
            }).addTo(map);

            testDot.bindTooltip(
              `<b>Test Location:</b> ${item.test_distance_meters}m from tank<br/>${item.tested_by_name || 'Executive'} (${item.tested_by_role_name || 'ASM / Tech'})`,
              { permanent: false, direction: 'top' }
            );
            activeRangeLayersRef.current.push(testDot);
          }
        });

        marker.on('popupclose', () => {
          activeRangeLayersRef.current.forEach(layer => {
            try { map.removeLayer(layer); } catch {}
          });
          activeRangeLayersRef.current = [];
        });
      }

      marker.addTo(markersLayer);
      markerMapRef.current[item.id] = marker;

      bounds.extend([item.latitude, item.longitude]);
      hasBounds = true;
    });

    if (hasBounds && !suppressFitBoundsRef.current) {
      map.fitBounds(bounds, {
        paddingTopLeft: [40, 80],
        paddingBottomRight: [40, 90],
        maxZoom: 13,
      });
    }
    suppressFitBoundsRef.current = false;
  }, [filtered, isLeafletReady]);

  return (
    <div className="-m-4 sm:-m-6 -mb-28 sm:-mb-32 h-[calc(100vh-4rem)] relative overflow-hidden bg-slate-100">
      {/* Map Container - Full View */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70 backdrop-blur-xs">
          <PageSpinner />
        </div>
      )}

      {/* Floating Single-Row Controls Toolbar */}
      <div className="absolute top-3 sm:top-4 left-3 right-3 z-10 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto w-full overflow-x-auto pb-1 scrollbar-none">
          {/* Search Box with Real-Time Suggestions */}
          <div ref={searchContainerRef} className="relative min-w-[200px] flex-1 max-w-xs shrink-0">
            <form
              onSubmit={handleSearchSubmit}
              className="relative bg-white/95 backdrop-blur-md border border-gray-200/90 shadow-lg rounded-xl flex items-center px-3 py-2 h-10"
            >
              <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search farmer, pond, GPS..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => {
                  if (matchingLocalItems.length > 0 || geoResults.length > 0 || directCoords) {
                    setShowSearchDropdown(true);
                  }
                }}
                className="w-full bg-transparent border-0 p-0 pl-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-0"
              />
              {isGeoSearching ? (
                <div className="ml-1">
                  <Spinner size="xs" />
                </div>
              ) : search ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setGeoResults([]);
                    setShowSearchDropdown(false);
                  }}
                  className="text-gray-400 hover:text-gray-600 p-0.5 ml-1"
                  title="Clear search"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              ) : null}
            </form>

            {/* Suggestions Dropdown */}
            {showSearchDropdown &&
              (matchingLocalItems.length > 0 || geoResults.length > 0 || directCoords || isGeoSearching) && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200/90 max-h-80 overflow-y-auto divide-y divide-gray-100 z-50">
                  {directCoords && (
                    <button
                      type="button"
                      onClick={() => handleSelectCoords(directCoords)}
                      className="w-full px-3 py-2.5 text-left text-xs hover:bg-blue-50 flex items-center gap-2.5 text-gray-800 transition"
                    >
                      <span className="p-1 rounded bg-amber-100 text-amber-700">
                        <MapPinIcon className="w-4 h-4" />
                      </span>
                      <div className="truncate flex-1">
                        <span className="font-semibold block text-gray-900">
                          Jump to GPS Coordinates
                        </span>
                        <span className="text-[11px] text-gray-500 font-mono">
                          {directCoords.latitude.toFixed(5)}, {directCoords.longitude.toFixed(5)}
                        </span>
                      </div>
                    </button>
                  )}

                  {matchingLocalItems.length > 0 && (
                    <div>
                      <div className="px-3 py-1 bg-gray-50/80 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Farmers & Ponds
                      </div>
                      {matchingLocalItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectLocalItem(item)}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-blue-50 flex items-center gap-2.5 text-gray-800 transition"
                        >
                          <span
                            className={`px-1.5 py-0.5 rounded text-white text-[10px] font-bold uppercase ${
                              item.type === 'farmer' ? 'bg-blue-600' : 'bg-emerald-600'
                            }`}
                          >
                            {item.type === 'farmer' ? 'Farmer' : 'Pond'}
                          </span>
                          <div className="truncate flex-1">
                            <span className="font-semibold block text-gray-900 truncate">
                              {item.name}
                            </span>
                            <span className="text-[11px] text-gray-500 block truncate">
                              {item.farmer_name ? `${item.farmer_name} · ` : ''}
                              {item.city || item.address || 'On map'}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {geoResults.length > 0 && (
                    <div>
                      <div className="px-3 py-1 bg-gray-50/80 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Villages, Mandals & Places
                      </div>
                      {geoResults.map((geo, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectGeoItem(geo)}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-blue-50 flex items-center gap-2.5 text-gray-800 transition"
                        >
                          <MapPinIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                          <div className="truncate flex-1">
                            <span className="font-semibold block text-gray-900 truncate">
                              {geo.title}
                            </span>
                            {geo.subtitle && (
                              <span className="text-[11px] text-gray-500 block truncate">
                                {geo.subtitle}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {isGeoSearching && (
                    <div className="px-3 py-2 text-xs text-gray-500 flex items-center gap-2">
                      <Spinner size="xs" />
                      <span>Searching places in real time...</span>
                    </div>
                  )}
                </div>
              )}
          </div>

          {/* 1. Regions */}
          <select
            value={region}
            onChange={(e) => handleRegionChange(e.target.value)}
            className={`h-10 px-2.5 py-1 text-xs font-semibold rounded-xl bg-white/95 backdrop-blur-md border shadow-lg transition cursor-pointer min-w-[115px] shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
              region
                ? 'border-blue-500 bg-blue-50/90 text-blue-900 font-bold ring-1 ring-blue-200'
                : 'border-gray-200/90 text-gray-700 hover:border-gray-400'
            }`}
            title="Filter by Region"
          >
            <option value="">All Regions</option>
            {regionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* 2. ASM's */}
          <select
            value={asmId}
            onChange={(e) => handleAsmChange(e.target.value)}
            className={`h-10 px-2.5 py-1 text-xs font-semibold rounded-xl bg-white/95 backdrop-blur-md border shadow-lg transition cursor-pointer min-w-[115px] shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
              asmId
                ? 'border-blue-500 bg-blue-50/90 text-blue-900 font-bold ring-1 ring-blue-200'
                : 'border-gray-200/90 text-gray-700 hover:border-gray-400'
            }`}
            title="Filter by ASM"
          >
            <option value="">All ASM's</option>
            {asmOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* 3. Techs */}
          <select
            value={techId}
            onChange={(e) => handleTechChange(e.target.value)}
            className={`h-10 px-2.5 py-1 text-xs font-semibold rounded-xl bg-white/95 backdrop-blur-md border shadow-lg transition cursor-pointer min-w-[115px] shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
              techId
                ? 'border-blue-500 bg-blue-50/90 text-blue-900 font-bold ring-1 ring-blue-200'
                : 'border-gray-200/90 text-gray-700 hover:border-gray-400'
            }`}
            title="Filter by Technical Executive"
          >
            <option value="">All Techs</option>
            {techOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* 4. Farmers */}
          <select
            value={farmerId}
            onChange={(e) => handleFarmerChange(e.target.value)}
            className={`h-10 px-2.5 py-1 text-xs font-semibold rounded-xl bg-white/95 backdrop-blur-md border shadow-lg transition cursor-pointer min-w-[125px] shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
              farmerId
                ? 'border-blue-500 bg-blue-50/90 text-blue-900 font-bold ring-1 ring-blue-200'
                : 'border-gray-200/90 text-gray-700 hover:border-gray-400'
            }`}
            title="Filter by Farmer"
          >
            <option value="">All Farmers</option>
            {farmerOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* 5. Date Filter */}
          <div
            className={`h-10 px-2.5 shrink-0 bg-white/95 backdrop-blur-md border shadow-lg rounded-xl flex items-center gap-1.5 text-xs font-semibold transition ${
              selectedDate
                ? 'border-emerald-500 bg-emerald-50/90 text-emerald-800'
                : 'border-gray-200/90 text-gray-700 hover:bg-white'
            }`}
          >
            <CalendarDaysIcon className="w-4 h-4 text-emerald-600 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none text-xs font-semibold text-gray-800 focus:outline-none focus:ring-0 cursor-pointer p-0 w-28 sm:w-32"
              title="Select date to view tests submitted on that date"
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate('')}
                className="text-gray-400 hover:text-red-600 p-0.5 ml-0.5"
                title="Clear date filter"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Reset Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="h-10 px-3 bg-white/95 backdrop-blur-md border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 shadow-lg rounded-xl flex items-center gap-1 text-xs font-bold transition active:scale-95 shrink-0"
              title="Reset all filters"
            >
              <XMarkIcon className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

          {/* Map Layer Switcher (Satellite & Roads) */}
          <button
            type="button"
            title={
              mapMode === 'satellite'
                ? 'Map Layer: Satellite (Click to switch to Roads)'
                : 'Map Layer: Roads (Click to switch to Satellite)'
            }
            onClick={() => setMapMode((prev) => (prev === 'street' ? 'satellite' : 'street'))}
            className={`w-10 h-10 shrink-0 backdrop-blur-md border shadow-lg rounded-xl flex items-center justify-center transition active:scale-95 ${
              mapMode === 'satellite'
                ? 'bg-blue-600 border-blue-600 text-white shadow-blue-600/20'
                : 'bg-white/95 border-gray-200/90 text-gray-700 hover:text-blue-600 hover:bg-white'
            }`}
          >
            <Square3Stack3DIcon className="w-5 h-5" />
          </button>

          {/* My Location GPS Button */}
          <button
            type="button"
            title="Locate my position on map"
            onClick={handleLocateMe}
            disabled={locating}
            className="w-10 h-10 shrink-0 bg-white/95 backdrop-blur-md border border-gray-200/90 shadow-lg rounded-xl flex items-center justify-center text-gray-700 hover:text-blue-600 hover:bg-white transition active:scale-95 disabled:opacity-50"
          >
            {locating ? <Spinner size="xs" /> : <MapPinIcon className="w-5 h-5 text-gray-700" />}
          </button>
        </div>

        {/* Date Filter Active Status Banner */}
        {selectedDate && (
          <div className="mt-2.5 flex items-center gap-2 pointer-events-auto">
            <div
              className={`px-3 py-1.5 rounded-xl shadow-lg text-xs font-medium flex items-center gap-2 backdrop-blur-md border animate-in fade-in slide-in-from-top-2 ${
                filtered.filter((i) => i.type === 'pond').length > 0
                  ? 'bg-emerald-600/95 border-emerald-500 text-white'
                  : 'bg-amber-600/95 border-amber-500 text-white'
              }`}
            >
              <CalendarDaysIcon className="w-4 h-4 shrink-0" />
              <span>
                {filtered.filter((i) => i.type === 'pond').length > 0 ? (
                  <>
                    Tests submitted on{' '}
                    <b>
                      {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </b>
                    : <b>{filtered.filter((i) => i.type === 'pond').length}</b>{' '}
                    {filtered.filter((i) => i.type === 'pond').length === 1
                      ? 'tank test'
                      : 'tank tests'}
                  </>
                ) : (
                  <>
                    No tests submitted on{' '}
                    <b>
                      {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </b>
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={() => setSelectedDate('')}
                className="ml-1 px-1.5 py-0.5 bg-black/20 hover:bg-black/35 rounded text-[11px] font-bold uppercase transition"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
