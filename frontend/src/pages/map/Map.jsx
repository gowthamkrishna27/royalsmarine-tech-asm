import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import clientService from '../../services/clientService';
import Spinner, { PageSpinner } from '../../components/common/Spinner';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  MapPinIcon,
  ChevronDownIcon,
  Square3Stack3DIcon,
  CheckIcon,
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

  const baseLayersRef = useRef({});
  const layerMenuRef = useRef(null);
  const activeRangeLayersRef = useRef([]);

  const [search, setSearch] = useState('');
  const [farmerId, setFarmerId] = useState('');
  const [activeLayer, setActiveLayer] = useState('hybrid');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [isLeafletReady, setIsLeafletReady] = useState(Boolean(typeof window !== 'undefined' && window.L));

  // Real-time geocoding & place search state
  const [geoResults, setGeoResults] = useState([]);
  const [isGeoSearching, setIsGeoSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [locating, setLocating] = useState(false);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSearchDropdown(false);
      }
      if (layerMenuRef.current && !layerMenuRef.current.contains(event.target)) {
        setShowLayerMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
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
    queryKey: ['map-locations'],
    queryFn: () => clientService.getMapLocations().then(res => res.data.data),
  });

  const clients = data?.clients || [];
  const ponds = data?.ponds || [];

  // Fetch technician's assigned active farmers
  const { data: techFarmers } = useQuery({
    queryKey: ['technician-farmers'],
    queryFn: () => clientService.list({ limit: 500, status: 'active' }).then(res => res.data.data),
  });

  const farmerOptions = useMemo(() => {
    const map = new Map();
    (techFarmers || []).forEach(c => {
      if (c && c.id) {
        map.set(String(c.id), {
          value: String(c.id),
          label: c.company_name || c.contact_person || `Farmer #${c.id}`,
          city: c.city || '',
        });
      }
    });
    (clients || []).forEach(c => {
      if (c && c.id && !map.has(String(c.id))) {
        map.set(String(c.id), {
          value: String(c.id),
          label: c.company_name || c.contact_person || `Farmer #${c.id}`,
          city: c.city || '',
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  }, [techFarmers, clients]);

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

  // Auto-center and zoom to farmer when farmer is selected
  useEffect(() => {
    if (farmerId && items.length > 0 && mapInstanceRef.current) {
      const farmerItem = items.find(
        (i) => i.type === 'farmer' && String(i.rawId) === String(farmerId)
      );
      const farmerPonds = items.filter(
        (i) => i.type === 'pond' && String(i.clientId) === String(farmerId)
      );

      suppressFitBoundsRef.current = true;

      if (farmerItem) {
        mapInstanceRef.current.flyTo([farmerItem.latitude, farmerItem.longitude], 16, { duration: 1.2 });
        const marker = markerMapRef.current[farmerItem.id];
        if (marker) {
          setTimeout(() => marker.openPopup(), 1200);
        }
      } else if (farmerPonds.length > 0) {
        if (farmerPonds.length === 1) {
          mapInstanceRef.current.flyTo([farmerPonds[0].latitude, farmerPonds[0].longitude], 16, { duration: 1.2 });
          const marker = markerMapRef.current[farmerPonds[0].id];
          if (marker) {
            setTimeout(() => marker.openPopup(), 1200);
          }
        } else {
          const L = getL();
          if (L) {
            const bounds = L.latLngBounds(farmerPonds.map(p => [p.latitude, p.longitude]));
            mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
          }
        }
      }
    }
  }, [farmerId, items]);

  // Filtered items on map canvas
  const filtered = useMemo(() => {
    return items.filter(item => {
      if (farmerId) {
        if (item.type === 'farmer' && String(item.rawId) !== String(farmerId)) return false;
        if (item.type === 'pond' && String(item.clientId) !== String(farmerId)) return false;
      }
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
  }, [items, farmerId, search, directCoords]);

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

    baseLayersRef.current = {
      hybrid: satelliteLayer,
      satellite: pureSatLayer,
      esri: esriLayer,
      street: osmLayer,
    };

    // Add default initial layer
    satelliteLayer.addTo(map);

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

  // Handle map layer change (Hybrid, Satellite, Esri, Street)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layers = baseLayersRef.current;
    if (!map || !layers) return;

    Object.entries(layers).forEach(([key, layer]) => {
      if (key === activeLayer) {
        if (!map.hasLayer(layer)) map.addLayer(layer);
      } else {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      }
    });
  }, [activeLayer]);

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

          <!-- 1-Tap Log Visit Button -->
          <a href="/visits/new?${isFarmer ? `clientId=${item.rawId}` : `clientId=${item.clientId}&tank=${encodeURIComponent(item.name)}`}" 
             style="display: flex; align-items: center; justify-content: center; gap: 4px; background: #2563eb; color: #ffffff; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 6px; text-decoration: none; margin-top: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
            <span>Log Visit</span>
            <span style="font-size: 12px; font-weight: 700;">+</span>
          </a>

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

      {/* Floating Top Controls (Search + Farmers + My Location) */}
      <div className="absolute top-3 sm:top-4 left-3 right-3 z-10 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto max-w-xl mx-auto sm:mx-0">
          {/* Search Box with Real-Time Suggestions */}
          <div ref={searchContainerRef} className="relative flex-1 min-w-0">
            <form
              onSubmit={handleSearchSubmit}
              className="relative bg-white/95 backdrop-blur-md border border-gray-200/90 shadow-md rounded-xl flex items-center px-3 py-2"
            >
              <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search farmer, pond, place, or GPS..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => {
                  if (matchingLocalItems.length > 0 || geoResults.length > 0 || directCoords) {
                    setShowSearchDropdown(true);
                  }
                }}
                className="w-full bg-transparent border-0 p-0 pl-2 text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-0"
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

          {/* Farmers Dropdown Filter */}
          <div className="relative shrink-0">
            <select
              value={farmerId}
              onChange={(e) => setFarmerId(e.target.value)}
              className={`h-9 sm:h-10 pl-2.5 sm:pl-3 pr-7 py-1 text-xs font-semibold rounded-xl bg-white/95 backdrop-blur-md border shadow-md transition cursor-pointer max-w-[125px] sm:max-w-[160px] truncate appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                farmerId
                  ? 'border-blue-500 bg-blue-50 text-blue-900 font-bold'
                  : 'border-gray-200/90 text-gray-700 hover:border-gray-400'
              }`}
              title="Filter by Farmer"
            >
              <option value="">All Farmers</option>
              {farmerOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}{opt.city ? ` (${opt.city})` : ''}
                </option>
              ))}
            </select>
            {farmerId ? (
              <button
                type="button"
                onClick={() => setFarmerId('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                title="Clear farmer filter"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            ) : (
              <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            )}
          </div>

          {/* Layer Changer Dropdown Button */}
          <div ref={layerMenuRef} className="relative shrink-0">
            <button
              type="button"
              title="Change Map Layer (Satellite, Pure Satellite, Esri, Roads)"
              onClick={() => setShowLayerMenu((prev) => !prev)}
              className={`w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 backdrop-blur-md border shadow-md rounded-xl flex items-center justify-center transition active:scale-95 ${
                showLayerMenu
                  ? 'bg-blue-600 border-blue-600 text-white shadow-blue-600/30'
                  : 'bg-white/95 border-gray-200/90 text-gray-700 hover:text-blue-600 hover:bg-white'
              }`}
            >
              <Square3Stack3DIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {showLayerMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 sm:w-60 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200/90 p-1.5 z-50 divide-y divide-gray-100 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Map Layers
                </div>
                <div className="py-1 space-y-0.5">
                  {[
                    { id: 'hybrid', label: 'Google Hybrid HD', desc: 'Satellite with Roads & Names', icon: '🛰️' },
                    { id: 'satellite', label: 'Pure Satellite HD', desc: 'Clean ponds without labels', icon: '🌍' },
                    { id: 'esri', label: 'Esri Clarity HD', desc: 'High-contrast agriculture', icon: '🌾' },
                    { id: 'street', label: 'Google Streets HD', desc: 'Road map & town boundaries', icon: '🏙️' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setActiveLayer(opt.id);
                        setShowLayerMenu(false);
                      }}
                      className={`w-full px-2.5 py-1.5 text-left rounded-lg text-xs flex items-center justify-between transition ${
                        activeLayer === opt.id
                          ? 'bg-blue-50 text-blue-900 font-bold'
                          : 'text-gray-700 hover:bg-gray-100/80'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-sm shrink-0">{opt.icon}</span>
                        <div className="truncate">
                          <p className="font-semibold leading-tight truncate">{opt.label}</p>
                          <p className="text-[10px] text-gray-500 font-normal leading-tight truncate">{opt.desc}</p>
                        </div>
                      </div>
                      {activeLayer === opt.id && (
                        <CheckIcon className="w-4 h-4 text-blue-600 shrink-0 ml-1.5" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* My Location GPS Button */}
          <button
            type="button"
            title="Locate my position on map"
            onClick={handleLocateMe}
            disabled={locating}
            className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 bg-white/95 backdrop-blur-md border border-gray-200/90 shadow-md rounded-xl flex items-center justify-center text-gray-700 hover:text-blue-600 hover:bg-white transition active:scale-95 disabled:opacity-50"
          >
            {locating ? <Spinner size="xs" /> : <MapPinIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />}
          </button>
        </div>
      </div>
    </div>
  );
}
