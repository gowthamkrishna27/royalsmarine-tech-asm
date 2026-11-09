import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Modal from './Modal';
import Spinner from './Spinner';
import {
  MapPinIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  PlayIcon,
  FlagIcon,
  ArrowPathIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  CursorArrowRaysIcon,
  ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline';
import {
  MapPinIcon as MapPinSolidIcon,
  PlayIcon as PlaySolidIcon,
  CheckCircleIcon as CheckCircleSolidIcon,
} from '@heroicons/react/24/solid';

const getLeaflet = () => (typeof L !== 'undefined' ? L : (typeof window !== 'undefined' ? window.L : null));

// Haversine distance in meters
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Planar projection around origin for high-precision local farm pond area calculation
function calculatePolygonAreaAcres(points) {
  if (!points || points.length < 3) return { sqMeters: 0, acres: 0, cents: 0 };
  const lat0 = points[0].lat;
  const lon0 = points[0].lng;
  const R = 6371000;
  const cosLat0 = Math.cos((lat0 * Math.PI) / 180);

  const xy = points.map((p) => ({
    x: (p.lng - lon0) * (Math.PI / 180) * R * cosLat0,
    y: (p.lat - lat0) * (Math.PI / 180) * R,
  }));

  let area = 0;
  const n = xy.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += xy[i].x * xy[j].y;
    area -= xy[j].x * xy[i].y;
  }
  const sqMeters = Math.abs(area) / 2;
  const acres = sqMeters * 0.000247105;
  const cents = acres * 100;
  return { sqMeters, acres, cents };
}

// Centroid calculation (average of polygon coordinates)
function calculateCentroid(points) {
  if (!points || points.length === 0) return null;
  let latSum = 0;
  let lngSum = 0;
  points.forEach((p) => {
    latSum += p.lat;
    lngSum += p.lng;
  });
  return { lat: latSum / points.length, lng: lngSum / points.length };
}

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

export default function TankMapPickerModal({
  open,
  onClose,
  tankName = 'Tank',
  initialCoords = null,
  defaultCenter = null,
  initialMode = 'pin', // 'pin' | 'walk'
  onConfirm,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const searchContainerRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Mode: 'pin' (Option 1: Pin a Tank) | 'walk' (Option 2: Walk around the tank)
  const [activeMode, setActiveMode] = useState(initialMode || 'pin');

  // Mode 1: Pin a Tank state
  const [pinCoords, setPinCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const pinMarkerRef = useRef(null);

  // Search state for pin mode
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Mode 2: Walk around the tank state
  // walkState: 'idle' | 'recording' | 'finished' | 'editing'
  const [walkState, setWalkState] = useState('idle');
  const [pathPoints, setPathPoints] = useState([]);
  const [liveGps, setLiveGps] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [walkSeconds, setWalkSeconds] = useState(0);
  const [totalDistanceMeters, setTotalDistanceMeters] = useState(0);

  // Leaflet layer refs for Walk mode
  const watchIdRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const walkPolylineRef = useRef(null);
  const walkPolygonRef = useRef(null);
  const liveLocationMarkerRef = useRef(null);
  const centroidMarkerRef = useRef(null);
  const vertexMarkersRef = useRef([]);

  // Sync mode and coordinates when modal opens
  useEffect(() => {
    if (open) {
      setActiveMode(initialMode || 'pin');
      setWalkState('idle');
      setPathPoints([]);
      setWalkSeconds(0);
      setTotalDistanceMeters(0);
      setGpsError(null);
      setSearchQuery('');
      setSearchResults([]);
      setShowDropdown(false);

      if (initialCoords?.latitude && initialCoords?.longitude) {
        setPinCoords({
          latitude: parseFloat(initialCoords.latitude),
          longitude: parseFloat(initialCoords.longitude),
        });
      } else if (defaultCenter?.latitude && defaultCenter?.longitude) {
        setPinCoords({
          latitude: parseFloat(defaultCenter.latitude),
          longitude: parseFloat(defaultCenter.longitude),
        });
      } else {
        setPinCoords({ latitude: 16.5062, longitude: 80.6480 });
      }
    }
  }, [open, initialCoords, defaultCenter, initialMode]);

  // Clean up GPS watcher and timer on unmount / close
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, []);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!open) return;

    const leafletObj = getLeaflet();
    if (!leafletObj || !mapContainerRef.current) return;

    const hasInitial = initialCoords?.latitude && initialCoords?.longitude;
    const hasDefault = defaultCenter?.latitude && defaultCenter?.longitude;

    const centerLat = hasInitial
      ? parseFloat(initialCoords.latitude)
      : hasDefault
      ? parseFloat(defaultCenter.latitude)
      : 16.5062;

    const centerLng = hasInitial
      ? parseFloat(initialCoords.longitude)
      : hasDefault
      ? parseFloat(defaultCenter.longitude)
      : 80.648;

    const zoom = hasInitial || hasDefault ? 17 : 12;

    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (e) {
        // ignore
      }
      mapInstanceRef.current = null;
    }

    const map = leafletObj.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom,
      zoomControl: true,
    });

    // High resolution Satellite Hybrid (Default)
    const googleHybrid = leafletObj.tileLayer(
      'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&scale=2',
      {
        maxNativeZoom: 19,
        maxZoom: 22,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        keepBuffer: 8,
        attribution: '&copy; Google Maps Hybrid HD',
      }
    );

    const googlePureSat = leafletObj.tileLayer(
      'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&scale=2',
      {
        maxNativeZoom: 19,
        maxZoom: 22,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        keepBuffer: 8,
        attribution: '&copy; Google Satellite HD',
      }
    );

    const esriSat = leafletObj.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxNativeZoom: 19,
        maxZoom: 22,
        keepBuffer: 8,
        attribution: '&copy; Esri World Imagery',
      }
    );

    const roadmapLayer = leafletObj.tileLayer(
      'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&scale=2',
      {
        maxNativeZoom: 19,
        maxZoom: 22,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        keepBuffer: 8,
        attribution: '&copy; Google Maps',
      }
    );

    googleHybrid.addTo(map);

    const baseMaps = {
      '🛰️ Google Hybrid HD': googleHybrid,
      '🌍 Pure Satellite HD': googlePureSat,
      '🌾 Esri Clarity HD': esriSat,
      '🏙️ Google Streets': roadmapLayer,
    };

    leafletObj.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);

    // Initial Pin marker setup
    const initialPinIcon = leafletObj.divIcon({
      className: 'tank-pin-marker',
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%, -100%);">
          <div style="background:#ef4444;color:#fff;border-radius:50%;padding:6px;box-shadow:0 3px 8px rgba(0,0,0,0.4);border:2px solid #ffffff;">
            <svg style="width:20px;height:20px;" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>
          <div style="width:4px;height:4px;background:#000;border-radius:50%;opacity:0.3;margin-top:2px;"></div>
        </div>
      `,
      iconSize: [32, 42],
      iconAnchor: [16, 42],
    });

    const pinMarker = leafletObj.marker([centerLat, centerLng], {
      draggable: true,
      icon: initialPinIcon,
      zIndexOffset: 600,
    });

    pinMarker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      setPinCoords({ latitude: pos.lat, longitude: pos.lng });
    });

    pinMarker.addTo(map);
    pinMarkerRef.current = pinMarker;

    // Handle map click: In "pin" mode, clicking on the tank directly places the pin there!
    map.on('click', (e) => {
      if (activeModeRef.current === 'pin') {
        const { lat, lng } = e.latlng;
        setPinCoords({ latitude: lat, longitude: lng });
        if (pinMarkerRef.current) {
          pinMarkerRef.current.setLatLng([lat, lng]);
        }
      }
    });

    mapInstanceRef.current = map;

    // Size invalidation
    const t1 = setTimeout(() => map.invalidateSize(), 80);
    const t2 = setTimeout(() => map.invalidateSize(), 300);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      try {
        map.remove();
      } catch (e) {
        // ignore
      }
      mapInstanceRef.current = null;
    };
  }, [open]);

  // Keep a ref to activeMode for Leaflet event listeners
  const activeModeRef = useRef(activeMode);
  useEffect(() => {
    activeModeRef.current = activeMode;
    if (mapInstanceRef.current) {
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 60);

      if (pinMarkerRef.current) {
        if (activeMode === 'pin') {
          pinMarkerRef.current.addTo(mapInstanceRef.current);
        } else {
          pinMarkerRef.current.remove();
        }
      }
    }
  }, [activeMode]);

  // --- Real-time Search for Pin Mode ---
  const executeSearch = async (queryText) => {
    const q = (queryText || searchQuery).trim();
    if (!q) return [];

    const directCoords = parseCoordinates(q);
    if (directCoords) {
      const coordItem = {
        title: `GPS: ${directCoords.latitude.toFixed(5)}, ${directCoords.longitude.toFixed(5)}`,
        subtitle: 'Direct Coordinate Jump',
        lat: directCoords.latitude,
        lon: directCoords.longitude,
      };
      setSearchResults([coordItem]);
      setShowDropdown(true);
      return [coordItem];
    }

    if (q.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return [];
    }

    setIsSearching(true);
    try {
      const currentCenter = pinCoords || { latitude: 16.5, longitude: 80.6 };
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
        q
      )}&limit=6&lat=${currentCenter.latitude}&lon=${currentCenter.longitude}`;

      const res = await fetch(photonUrl);
      if (res.ok) {
        const data = await res.json();
        if (data?.features && data.features.length > 0) {
          const items = data.features.map((f) => {
            const parts = [
              f.properties.name,
              f.properties.district || f.properties.county || f.properties.city,
              f.properties.state,
              f.properties.country,
            ].filter(Boolean);
            const uniqueParts = parts.filter((p, i) => parts.indexOf(p) === i);
            return {
              title: f.properties.name || uniqueParts[0] || 'Location',
              subtitle: uniqueParts.slice(1).join(', ') || f.properties.country || '',
              lat: f.geometry.coordinates[1],
              lon: f.geometry.coordinates[0],
            };
          });
          setSearchResults(items);
          setShowDropdown(true);
          return items;
        }
      }
      setSearchResults([]);
      setShowDropdown(false);
      return [];
    } catch (err) {
      setSearchResults([]);
      setShowDropdown(false);
      return [];
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    const direct = parseCoordinates(val);
    if (direct) {
      setSearchResults([
        {
          title: `GPS: ${direct.latitude.toFixed(5)}, ${direct.longitude.toFixed(5)}`,
          subtitle: 'Click to jump to coordinates',
          lat: direct.latitude,
          lon: direct.longitude,
        },
      ]);
      setShowDropdown(true);
      return;
    }
    if (!val.trim() || val.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => executeSearch(val), 300);
  };

  const handleSelectLocation = (item) => {
    const lat = typeof item.lat === 'number' ? item.lat : parseFloat(item.lat);
    const lon = typeof item.lon === 'number' ? item.lon : parseFloat(item.lon);
    if (!isNaN(lat) && !isNaN(lon)) {
      setPinCoords({ latitude: lat, longitude: lon });
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([lat, lon], 17, { duration: 1.2 });
      }
      if (pinMarkerRef.current) {
        pinMarkerRef.current.setLatLng([lat, lon]);
      }
      setShowDropdown(false);
      setSearchQuery(item.title);
    }
  };

  // User location trigger for Pin mode
  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        const map = mapInstanceRef.current;
        if (!map) return;
        setPinCoords({ latitude, longitude });
        map.flyTo([latitude, longitude], 17, { duration: 1 });
        if (pinMarkerRef.current) {
          pinMarkerRef.current.setLatLng([latitude, longitude]);
        }
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Save in Pin Mode
  const handleSavePin = () => {
    if (pinCoords && onConfirm) {
      onConfirm({
        latitude: pinCoords.latitude,
        longitude: pinCoords.longitude,
      });
    }
    onClose();
  };

  // ==========================================
  // MODE 2: WALK AROUND THE TANK FUNCTIONALITY
  // ==========================================

  // Update live polyline on map as user walks
  const updateWalkPolyline = useCallback((points) => {
    const map = mapInstanceRef.current;
    const LObj = getLeaflet();
    if (!map || !LObj) return;

    const latlngs = points.map((p) => [p.lat, p.lng]);

    if (!walkPolylineRef.current) {
      walkPolylineRef.current = LObj.polyline(latlngs, {
        color: '#10b981',
        weight: 4,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
    } else {
      walkPolylineRef.current.setLatLngs(latlngs);
    }
  }, []);

  // Update closed polygon on finish or edit
  const updateWalkPolygon = useCallback((points) => {
    const map = mapInstanceRef.current;
    const LObj = getLeaflet();
    if (!map || !LObj) return;

    if (walkPolylineRef.current) {
      walkPolylineRef.current.remove();
      walkPolylineRef.current = null;
    }

    const latlngs = points.map((p) => [p.lat, p.lng]);

    if (!walkPolygonRef.current) {
      walkPolygonRef.current = LObj.polygon(latlngs, {
        color: '#10b981',
        fillColor: '#10b981',
        fillOpacity: 0.25,
        weight: 3.5,
      }).addTo(map);
    } else {
      walkPolygonRef.current.setLatLngs(latlngs);
    }

    const centroid = calculateCentroid(points);
    const area = calculatePolygonAreaAcres(points);

    if (centroid) {
      if (centroidMarkerRef.current) {
        centroidMarkerRef.current.setLatLng([centroid.lat, centroid.lng]);
      } else {
        const centroidIcon = LObj.divIcon({
          className: 'centroid-tank-badge',
          html: `
            <div style="background:#047857;color:#ffffff;padding:4px 8px;border-radius:8px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:1.5px solid #ffffff;transform:translate(-50%, -50%);">
              📍 ${tankName}: ${area.acres.toFixed(2)} Ac
            </div>
          `,
          iconSize: [110, 26],
          iconAnchor: [55, 13],
        });
        centroidMarkerRef.current = LObj.marker([centroid.lat, centroid.lng], {
          icon: centroidIcon,
          zIndexOffset: 500,
        }).addTo(map);
      }
    }
  }, [tankName]);

  // Clean all walk layers
  const clearWalkLayers = useCallback(() => {
    if (walkPolylineRef.current) {
      walkPolylineRef.current.remove();
      walkPolylineRef.current = null;
    }
    if (walkPolygonRef.current) {
      walkPolygonRef.current.remove();
      walkPolygonRef.current = null;
    }
    if (centroidMarkerRef.current) {
      centroidMarkerRef.current.remove();
      centroidMarkerRef.current = null;
    }
    vertexMarkersRef.current.forEach((m) => m.remove());
    vertexMarkersRef.current = [];
  }, []);

  // Update live GPS marker
  const updateLiveMarker = useCallback((lat, lng, accuracy) => {
    const map = mapInstanceRef.current;
    const LObj = getLeaflet();
    if (!map || !LObj) return;

    if (!liveLocationMarkerRef.current) {
      const liveIcon = LObj.divIcon({
        className: 'live-gps-pulse',
        html: `
          <div style="position:relative;width:20px;height:20px;">
            <div style="position:absolute;inset:0;background:#3b82f6;border-radius:50%;opacity:0.4;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="position:relative;width:14px;height:14px;top:3px;left:3px;background:#2563eb;border:2.5px solid #ffffff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      liveLocationMarkerRef.current = LObj.marker([lat, lng], {
        icon: liveIcon,
        zIndexOffset: 700,
      }).addTo(map);
    } else {
      liveLocationMarkerRef.current.setLatLng([lat, lng]);
    }
  }, []);

  // 1. START WALK
  const handleStartWalk = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser or device.');
      return;
    }

    setGpsError(null);
    setWalkState('recording');
    setPathPoints([]);
    setWalkSeconds(0);
    setTotalDistanceMeters(0);
    clearWalkLayers();

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setWalkSeconds((prev) => prev + 1);
    }, 1000);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        setLiveGps({ lat, lng });
        setGpsAccuracy(accuracy);
        updateLiveMarker(lat, lng, accuracy);

        setPathPoints((prev) => {
          if (prev.length === 0) {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.flyTo([lat, lng], 19, { duration: 1 });
            }
            const firstPt = { lat, lng, accuracy, time: Date.now() };
            updateWalkPolyline([firstPt]);
            return [firstPt];
          }

          const last = prev[prev.length - 1];
          const dist = haversineMeters(last.lat, last.lng, lat, lng);

          if (dist >= 1.5) {
            setTotalDistanceMeters((d) => d + dist);
            const newPt = { lat, lng, accuracy, time: Date.now() };
            const nextPoints = [...prev, newPt];
            updateWalkPolyline(nextPoints);
            return nextPoints;
          }
          return prev;
        });
      },
      (err) => {
        setGpsError(`GPS tracking error: ${err.message}. Ensure location permissions are allowed.`);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // 2. FINISH WALK
  const handleFinishWalk = () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (pathPoints.length < 3) {
      setGpsError('Please walk and record at least 3 points around the tank to form a closed polygon boundary.');
      setWalkState('idle');
      return;
    }

    setWalkState('finished');
    updateWalkPolygon(pathPoints);

    if (mapInstanceRef.current && pathPoints.length > 0) {
      const latlngs = pathPoints.map((p) => [p.lat, p.lng]);
      mapInstanceRef.current.fitBounds(latlngs, { padding: [35, 35], maxZoom: 19 });
    }
  };

  // 3. RESTART WALK
  const handleRestartWalk = () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setWalkState('idle');
    setPathPoints([]);
    setWalkSeconds(0);
    setTotalDistanceMeters(0);
    setGpsError(null);
    clearWalkLayers();
  };

  // 4. EDIT WALK BOUNDARY
  const handleStartEdit = () => {
    setWalkState('editing');
    const map = mapInstanceRef.current;
    const LObj = getLeaflet();
    if (!map || !LObj || pathPoints.length === 0) return;

    vertexMarkersRef.current.forEach((m) => m.remove());
    vertexMarkersRef.current = [];

    pathPoints.forEach((pt, idx) => {
      const handleIcon = LObj.divIcon({
        className: 'walk-vertex-handle',
        html: `
          <div style="width:14px;height:14px;background:#10b981;border:2.5px solid #ffffff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4);cursor:grab;"></div>
        `,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const marker = LObj.marker([pt.lat, pt.lng], {
        draggable: true,
        icon: handleIcon,
        zIndexOffset: 650,
      });

      marker.on('drag', (e) => {
        const newPos = e.target.getLatLng();
        setPathPoints((prev) => {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], lat: newPos.lat, lng: newPos.lng };
          updateWalkPolygon(updated);
          return updated;
        });
      });

      marker.addTo(map);
      vertexMarkersRef.current.push(marker);
    });
  };

  // Done Editing
  const handleDoneEditing = () => {
    vertexMarkersRef.current.forEach((m) => m.remove());
    vertexMarkersRef.current = [];
    setWalkState('finished');
    updateWalkPolygon(pathPoints);
  };

  // Resume Walking from Editing/Finished
  const handleResumeWalk = () => {
    vertexMarkersRef.current.forEach((m) => m.remove());
    vertexMarkersRef.current = [];
    setWalkState('recording');

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setWalkSeconds((prev) => prev + 1);
    }, 1000);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        setLiveGps({ lat, lng });
        setGpsAccuracy(accuracy);
        updateLiveMarker(lat, lng, accuracy);

        setPathPoints((prev) => {
          if (prev.length === 0) return [{ lat, lng, accuracy, time: Date.now() }];
          const last = prev[prev.length - 1];
          const dist = haversineMeters(last.lat, last.lng, lat, lng);
          if (dist >= 1.5) {
            setTotalDistanceMeters((d) => d + dist);
            const updated = [...prev, { lat, lng, accuracy, time: Date.now() }];
            updateWalkPolyline(updated);
            return updated;
          }
          return prev;
        });
      },
      (err) => setGpsError(err.message),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // Undo Last Point during Edit
  const handleUndoPoint = () => {
    if (pathPoints.length <= 3) return;
    setPathPoints((prev) => {
      const updated = prev.slice(0, prev.length - 1);
      updateWalkPolygon(updated);
      return updated;
    });
  };

  // 5. ADD TANK ON MAP (AFTER FINISH)
  const handleAddTankOnMap = () => {
    if (pathPoints.length < 3) return;
    const centroid = calculateCentroid(pathPoints);
    const area = calculatePolygonAreaAcres(pathPoints);

    if (centroid && onConfirm) {
      onConfirm({
        latitude: centroid.lat,
        longitude: centroid.lng,
        area_acres: parseFloat(area.acres.toFixed(2)),
        polygon_coordinates: pathPoints,
        perimeter_meters: Math.round(totalDistanceMeters),
      });
    }
    onClose();
  };

  // Computed walk stats
  const areaStats = calculatePolygonAreaAcres(pathPoints);
  const centroidCoords = calculateCentroid(pathPoints);

  const formatTimer = (sec) => {
    const mins = Math.floor(sec / 60);
    const remainingSec = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSec.toString().padStart(2, '0')}`;
  };

  return (
    <Modal open={open} onClose={onClose} title={`${tankName} Location & Mapping`} size="lg">
      <div className="space-y-3">
        {/* Top Mode Segmented Switcher: Option 1. Pin a Tank | Option 2. Walk Around the Tank */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveMode('pin')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              activeMode === 'pin'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <MapPinSolidIcon className="w-4 h-4 text-red-500" />
            <span>1. Pin a Tank</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('walk')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              activeMode === 'walk'
                ? 'bg-white text-emerald-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <PlaySolidIcon className="w-3.5 h-3.5 text-emerald-600" />
            <span>2. Walk Around the Tank</span>
          </button>
        </div>

        {/* ==================================================== */}
        {/* OPTION 1: PIN A TANK TOOLBAR                         */}
        {/* ==================================================== */}
        {activeMode === 'pin' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {/* Real-time search box */}
              <div ref={searchContainerRef} className="relative flex-1">
                <div className="relative flex items-center">
                  <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search village, town, or paste GPS coords..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() => {
                      if (searchResults.length > 0) setShowDropdown(true);
                    }}
                    className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                  {isSearching ? (
                    <div className="absolute right-2.5">
                      <Spinner size="xs" />
                    </div>
                  ) : searchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                      className="absolute right-2 text-gray-400 hover:text-gray-600"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>

                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 z-[1000] max-h-48 overflow-y-auto divide-y divide-gray-100">
                    {searchResults.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectLocation(item)}
                        className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-start gap-2 transition"
                      >
                        <MapPinIcon className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                        <div className="truncate flex-1">
                          <span className="font-medium text-gray-900 block truncate">{item.title}</span>
                          {item.subtitle && (
                            <span className="text-[11px] text-gray-500 block truncate">
                              {item.subtitle}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* My Location button */}
              <button
                type="button"
                onClick={handleLocateMe}
                disabled={locating}
                className="btn-secondary btn-sm py-1.5 px-2.5 text-xs flex items-center gap-1 font-medium shrink-0"
                title="Locate my current position"
              >
                {locating ? <Spinner size="xs" /> : <MapPinIcon className="w-3.5 h-3.5 text-blue-600" />}
                <span className="hidden sm:inline">My Location</span>
              </button>
            </div>

            <div className="text-[11px] text-gray-500 flex items-center gap-1 bg-blue-50/70 border border-blue-100 px-2.5 py-1 rounded-md">
              <CursorArrowRaysIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Click or tap directly on the tank in the satellite map to position the pin.</span>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* OPTION 2: WALK AROUND THE TANK TOOLBAR & CONTROLS    */}
        {/* ==================================================== */}
        {activeMode === 'walk' && (
          <div className="space-y-2">
            {/* Status & Live Metrics Banner */}
            <div className="bg-emerald-50/80 border border-emerald-200 p-2.5 rounded-xl flex items-center justify-between gap-3 text-xs flex-wrap">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    walkState === 'recording'
                      ? 'bg-emerald-500 animate-pulse'
                      : walkState === 'finished'
                      ? 'bg-blue-500'
                      : walkState === 'editing'
                      ? 'bg-amber-500'
                      : 'bg-gray-400'
                  }`}
                />
                <span className="font-bold text-gray-900 capitalize">
                  {walkState === 'recording'
                    ? 'Walking & Tracking Route...'
                    : walkState === 'finished'
                    ? 'Walk Completed'
                    : walkState === 'editing'
                    ? 'Editing Boundary Handles'
                    : 'Ready to Walk'}
                </span>
                {walkState === 'recording' && (
                  <span className="bg-emerald-200/70 text-emerald-800 font-mono font-bold px-2 py-0.5 rounded text-[11px]">
                    ⏱️ {formatTimer(walkSeconds)}
                  </span>
                )}
              </div>

              {/* Metrics */}
              <div className="flex items-center gap-3 text-gray-700 font-medium">
                <span>
                  Points: <strong>{pathPoints.length}</strong>
                </span>
                {totalDistanceMeters > 0 && (
                  <span>
                    Dist: <strong>{Math.round(totalDistanceMeters)} m</strong>
                  </span>
                )}
                {areaStats.acres > 0 && (
                  <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                    {areaStats.acres.toFixed(2)} Ac (~{Math.round(areaStats.cents)} Cts)
                  </span>
                )}
              </div>
            </div>

            {/* GPS Error Message if any */}
            {gpsError && (
              <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-1.5">
                <XMarkIcon className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span>{gpsError}</span>
                </div>
              </div>
            )}

            {/* Three Main Options: Start, Finish, Restart / Edit */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Option A: START */}
              {walkState === 'idle' && (
                <button
                  type="button"
                  onClick={handleStartWalk}
                  className="btn-success btn-sm py-2 px-4 text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <PlayIcon className="w-4 h-4" />
                  <span>Start Walk</span>
                </button>
              )}

              {/* Option B: FINISH */}
              {walkState === 'recording' && (
                <button
                  type="button"
                  onClick={handleFinishWalk}
                  className="btn-primary btn-sm py-2 px-4 text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <FlagIcon className="w-4 h-4 text-yellow-300" />
                  <span>Finish Walk</span>
                </button>
              )}

              {/* Option C: RESTART OR EDIT (available when finished or editing) */}
              {(walkState === 'finished' || walkState === 'editing') && (
                <>
                  {walkState === 'finished' ? (
                    <button
                      type="button"
                      onClick={handleStartEdit}
                      className="btn-secondary btn-sm py-2 px-3 text-xs font-semibold flex items-center gap-1.5 border-gray-300 hover:border-gray-400"
                    >
                      <PencilSquareIcon className="w-4 h-4 text-amber-600" />
                      <span>Edit Boundary</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleDoneEditing}
                      className="btn-primary btn-sm py-2 px-3 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                      <span>Done Editing</span>
                    </button>
                  )}

                  {walkState === 'editing' && (
                    <>
                      <button
                        type="button"
                        onClick={handleResumeWalk}
                        className="btn-secondary btn-sm py-2 px-3 text-xs font-medium flex items-center gap-1"
                      >
                        <PlayIcon className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Resume Walk</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleUndoPoint}
                        disabled={pathPoints.length <= 3}
                        className="btn-secondary btn-sm py-2 px-2.5 text-xs disabled:opacity-40"
                        title="Undo last point"
                      >
                        <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </>
              )}

              {/* RESTART BUTTON */}
              {walkState !== 'idle' && (
                <button
                  type="button"
                  onClick={handleRestartWalk}
                  className="btn-secondary btn-sm py-2 px-3 text-xs font-medium text-gray-700 hover:text-red-700 hover:bg-red-50 flex items-center gap-1 ml-auto"
                >
                  <ArrowPathIcon className="w-3.5 h-3.5" />
                  <span>Restart</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* LEAFLET MAP CANVAS                                   */}
        {/* ==================================================== */}
        <div
          className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-900 shadow-inner"
          style={{ height: '320px', width: '100%', minHeight: '320px' }}
        >
          <div
            ref={mapContainerRef}
            style={{ height: '100%', width: '100%', minHeight: '320px' }}
            className="z-0"
          />
        </div>

        {/* ==================================================== */}
        {/* BOTTOM ACTION BAR                                    */}
        {/* ==================================================== */}
        <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
          {/* Coordinates / Acreage readout */}
          <div className="text-xs text-gray-700 font-mono font-medium bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-2">
            {activeMode === 'pin' ? (
              pinCoords ? (
                <span>
                  📍 {Number(pinCoords.latitude).toFixed(5)}, {Number(pinCoords.longitude).toFixed(5)}
                </span>
              ) : (
                <span className="text-gray-400">Click on map to pin tank</span>
              )
            ) : centroidCoords ? (
              <span>
                📍 Centroid: {Number(centroidCoords.lat).toFixed(5)},{' '}
                {Number(centroidCoords.lng).toFixed(5)}
                {areaStats.acres > 0 && ` (${areaStats.acres.toFixed(2)} Ac)`}
              </span>
            ) : (
              <span className="text-gray-400">Walk boundary to map tank</span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button type="button" onClick={onClose} className="btn-secondary btn-sm px-4 py-1.5">
              Cancel
            </button>

            {/* In Pin Mode: Save Pin button */}
            {activeMode === 'pin' && (
              <button
                type="button"
                onClick={handleSavePin}
                disabled={!pinCoords}
                className="btn-primary btn-sm px-4 py-1.5 shadow-xs flex items-center gap-1 font-semibold"
              >
                <CheckCircleIcon className="w-4 h-4" />
                <span>Save Pin</span>
              </button>
            )}

            {/* In Walk Mode: Add Tank on Map button after finish */}
            {activeMode === 'walk' && (
              <button
                type="button"
                onClick={handleAddTankOnMap}
                disabled={walkState !== 'finished' || pathPoints.length < 3}
                className="btn-success btn-sm px-4 py-1.5 shadow-xs flex items-center gap-1.5 font-bold disabled:opacity-50"
              >
                <CheckCircleSolidIcon className="w-4 h-4" />
                <span>Add Tank on Map</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
