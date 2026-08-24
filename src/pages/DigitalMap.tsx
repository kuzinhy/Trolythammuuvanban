import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import { 
  MapPin, CheckCircle2, Filter, 
  Building2, Sparkles, Plus, Layers, Search, 
  CheckSquare, Navigation, Trash2, Compass, Radio, X, 
  ShieldCheck, Save
} from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { db } from '../lib/firebase';
import { 
  collection, addDoc, updateDoc, deleteDoc, doc, 
  onSnapshot, serverTimestamp, query, orderBy 
} from 'firebase/firestore';
import { useAuthStore } from '../store/authStore';

export type MarkerCategory = 
  | 'Tuần tra GPS & Phương tiện'
  | 'Trật tự đô thị' 
  | 'Môi trường' 
  | 'An ninh trật tự' 
  | 'Chuyển đổi số' 
  | 'PCCC & An toàn'
  | 'Trụ sở & Điểm tiếp dân'
  | 'GPMB & Hạ tầng';

export type MarkerColor = 'green' | 'blue' | 'orange' | 'purple' | 'red' | 'indigo' | 'amber';

export interface MapMarkerItem {
  id: string;
  codeOrTitle: string;
  tagSubtext?: string;
  location: string;
  wardOrKp: string;
  category: MarkerCategory;
  color: MarkerColor;
  severity: 'Nóng' | 'Cảnh báo' | 'Bình thường';
  speedText?: string;
  statusText?: string;
  description: string;
  ideaTemplate: string;
  assignedUnit: string;
  lat: number;
  lng: number;
  isVehicleGPS?: boolean;
  lastUpdated: string;
  createdAt?: any;
}

// Realistic default markers representing Ward & Patrol points matching GPS style
const DEFAULT_MAP_MARKERS: MapMarkerItem[] = [
  {
    id: 'spot-gps-1',
    codeOrTitle: '29B16827',
    tagSubtext: 'BA-GPS',
    location: 'Tuyến Phố đi bộ Bạch Đằng & Công viên Bạch Đằng',
    wardOrKp: 'Phường Phú Cường',
    category: 'Tuần tra GPS & Phương tiện',
    color: 'blue',
    severity: 'Bình thường',
    speedText: '41km/h',
    statusText: 'Đang tuần tra',
    description: 'Tổ tuần tra trật tự đô thị xe số 01 đang kiểm tra lòng lề đường, phát hiện nhắc nhở 03 trường hợp buôn bán tự phát.',
    ideaTemplate: 'Giao Đội Trật tự Đô thị duy trì ca tuần tra tuyến Bạch Đằng, kiên quyết xử lý dứt điểm tình trạng tái lấn chiếm vỉa hè giờ cao điểm.',
    assignedUnit: 'Đội Trật tự Đô thị & Công an Phường',
    lat: 10.9818,
    lng: 106.6532,
    isVehicleGPS: true,
    lastUpdated: 'Vừa cập nhật'
  },
  {
    id: 'spot-gps-2',
    codeOrTitle: '29B40240',
    tagSubtext: 'BA-GPS',
    location: 'Chợ Thủ Dầu Một & Tuyến đường Trần Hưng Đạo',
    wardOrKp: 'Phường Phú Cường',
    category: 'Tuần tra GPS & Phương tiện',
    color: 'green',
    severity: 'Bình thường',
    speedText: 'Đang đỗ',
    statusText: 'Chốt trực cố định',
    description: 'Tổ cơ động phân luồng và giám sát trật tự kinh doanh khu vực cổng chợ Thủ Dầu Một.',
    ideaTemplate: 'Đề nghị Ban Quản lý Chợ phối hợp Công an phường củng cố hàng rào trật tự, đảm bảo lối đi an toàn cho người dân mua sắm.',
    assignedUnit: 'Ban Quản lý Chợ & Công an Phường',
    lat: 10.9805,
    lng: 106.6508,
    isVehicleGPS: true,
    lastUpdated: '2 phút trước'
  },
  {
    id: 'spot-gps-3',
    codeOrTitle: '30H-889.12',
    tagSubtext: '52km/h',
    location: 'Vòng xoay Ngã 6 & Bưu điện Tỉnh',
    wardOrKp: 'Phường Hiệp Thành',
    category: 'Tuần tra GPS & Phương tiện',
    color: 'blue',
    severity: 'Cảnh báo',
    speedText: '52km/h',
    statusText: 'Cơ động phản ứng nhanh',
    description: 'Xe chỉ huy điều tiết giao thông và kiểm tra camera AI tại nút giao Ngã 6 trọng điểm.',
    ideaTemplate: 'Yêu cầu Công an Phường Hiệp Thành bố trí lực lượng phân luồng giờ cao điểm Ngã 6 Thủ Dầu Một, kết nối dữ liệu Camera AI giám sát.',
    assignedUnit: 'Công an Phường Hiệp Thành & CSGT',
    lat: 10.9842,
    lng: 106.6575,
    isVehicleGPS: true,
    lastUpdated: '5 phút trước'
  },
  {
    id: 'spot-gps-4',
    codeOrTitle: '30G-445.67',
    tagSubtext: 'Cơ động',
    location: 'Đường Lê Hồng Phong (Gần ĐH Thủ Dầu Một)',
    wardOrKp: 'Phường Phú Hòa',
    category: 'PCCC & An toàn',
    color: 'orange',
    severity: 'Nóng',
    speedText: 'Chốt trực',
    statusText: 'Kiểm tra PCCC',
    description: 'Khu vực tập trung đông sinh viên và công nhân trọ học, phát hiện 02 dãy nhà trọ chưa hoàn thiện lối thoát nạn thứ 2.',
    ideaTemplate: 'Yêu cầu Công an Phường phối hợp Cảnh sát PCCC kiểm tra 100% các dãy nhà trọ công nhân đường Lê Hồng Phong, buộc khắc phục ngay.',
    assignedUnit: 'Công an Phường & Cảnh sát PCCC',
    lat: 10.9765,
    lng: 106.6660,
    isVehicleGPS: true,
    lastUpdated: '8 phút trước'
  },
  {
    id: 'spot-gps-5',
    codeOrTitle: '30E-123.99',
    tagSubtext: 'BA-GPS',
    location: 'Hẻm 420 đường Nguyễn Tri Phương',
    wardOrKp: 'Phường Chánh Nghĩa',
    category: 'Môi trường',
    color: 'green',
    severity: 'Cảnh báo',
    speedText: 'Đang di chuyển',
    statusText: 'Xe công trình nạo vét',
    description: 'Đội thi công đang xử lý nạo vét bùn đất khơi thông dòng chảy thoát nước hẻm 420 Nguyễn Tri Phương.',
    ideaTemplate: 'Giao UBND Phường Chánh Nghĩa đôn đốc nhà thầu hoàn thành dứt điểm nạo vét trước mùa mưa bão, hoàn trả mặt bằng sạch đẹp.',
    assignedUnit: 'UBND & Bộ phận Đô thị Phường Chánh Nghĩa',
    lat: 10.9732,
    lng: 106.6502,
    isVehicleGPS: true,
    lastUpdated: '12 phút trước'
  },
  {
    id: 'spot-gps-6',
    codeOrTitle: '30K-777.89',
    tagSubtext: 'Chỉ huy',
    location: 'Trụ sở Đảng ủy - HĐND - UBND Phường',
    wardOrKp: 'Trung tâm Hành chính Phường',
    category: 'Trụ sở & Điểm tiếp dân',
    color: 'purple',
    severity: 'Bình thường',
    speedText: 'Văn phòng',
    statusText: 'Trung tâm chỉ huy',
    description: 'Trung tâm chỉ huy tiếp nhận ý kiến phản ánh của nhân dân và điều hành giải quyết thủ tục hành chính Một cửa.',
    ideaTemplate: 'Duy trì chế độ trực chỉ huy 24/7, số hóa 100% hồ sơ tiếp nhận tại Bộ phận Một cửa và đẩy mạnh kích hoạt VNeID mức 2.',
    assignedUnit: 'Văn phòng Đảng ủy & UBND Phường',
    lat: 10.9825,
    lng: 106.6520,
    isVehicleGPS: false,
    lastUpdated: 'Đang hoạt động'
  },
  {
    id: 'spot-gps-7',
    codeOrTitle: '29E80678',
    tagSubtext: '13km/h',
    location: 'Đường Cách Mạng Tháng Tám & Cầu Ông Đành',
    wardOrKp: 'Phường Phú Cường',
    category: 'Trật tự đô thị',
    color: 'blue',
    severity: 'Cảnh báo',
    speedText: '13km/h',
    statusText: 'Tuần tra đô thị',
    description: 'Phát hiện điểm tụ tập buôn bán rau củ tự phát khu vực đầu cầu Ông Đành, lực lượng đang tiến hành vận động di dời.',
    ideaTemplate: 'Giao UBND Phường bố trí lực lượng thường trực tại khu vực cầu Ông Đành, tuyên truyền tiểu thương vào kinh doanh đúng vị trí quy hoạch.',
    assignedUnit: 'Đội Trật tự Đô thị Phường',
    lat: 10.9830,
    lng: 106.6485,
    isVehicleGPS: true,
    lastUpdated: '3 phút trước'
  }
];

export default function DigitalMap() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markerLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // States
  const [markers, setMarkers] = useState<MapMarkerItem[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<MapMarkerItem | null>(null);
  const [showDetailPopup, setShowDetailPopup] = useState<boolean>(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [mapTileSource, setMapTileSource] = useState<'OSM' | 'CARTO_LIGHT' | 'CARTO_VOYAGER' | 'SATELLITE'>('OSM');
  const [isLiveGPSSimulation, setIsLiveGPSSimulation] = useState<boolean>(true);
  const [isAddPinMode, setIsAddPinMode] = useState<boolean>(false);
  const [pinnedCoords, setPinnedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // New Marker Form State
  const [newMarkerForm, setNewMarkerForm] = useState<Partial<MapMarkerItem>>({
    codeOrTitle: '',
    tagSubtext: 'BA-GPS',
    location: '',
    wardOrKp: 'Phường Phú Cường',
    category: 'Trật tự đô thị',
    color: 'blue',
    severity: 'Cảnh báo',
    speedText: '35km/h',
    statusText: 'Đang tuần tra',
    description: '',
    ideaTemplate: '',
    assignedUnit: 'UBND & Công an Phường',
    isVehicleGPS: false
  });

  // Load Markers from Firestore with fallback to default
  useEffect(() => {
    let isMounted = true;
    const q = query(collection(db, 'map_hotspots'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!isMounted) return;
      if (!snapshot.empty) {
        const firestoreMarkers: MapMarkerItem[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as MapMarkerItem));
        setMarkers(firestoreMarkers);
      } else {
        setMarkers(DEFAULT_MAP_MARKERS);
      }
    }, (err) => {
      console.warn("Firestore map_hotspots sync fallback:", err);
      setMarkers(DEFAULT_MAP_MARKERS);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Filtered Markers
  const filteredMarkers = useMemo(() => {
    return markers.filter(m => {
      if (categoryFilter !== 'ALL' && m.category !== categoryFilter) return false;
      if (severityFilter !== 'ALL' && m.severity !== severityFilter) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        return (
          m.codeOrTitle.toLowerCase().includes(term) ||
          m.location.toLowerCase().includes(term) ||
          m.wardOrKp.toLowerCase().includes(term) ||
          m.description.toLowerCase().includes(term) ||
          m.assignedUnit.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [markers, categoryFilter, severityFilter, searchTerm]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || leafletMapRef.current) return;

    // Center on Phu Cuong / Thu Dau Mot Center (Lat: 10.9815, Lng: 106.6525)
    const initialLat = 10.9815;
    const initialLng = 106.6525;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 15,
      zoomControl: false,
      attributionControl: true
    });

    // Add Zoom Control to Bottom Right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Default OpenStreetMap Tile
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors | Định vị GPS Bình Anh & GIS'
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Marker Layer Group
    const markerGroup = L.layerGroup().addTo(map);
    markerLayerGroupRef.current = markerGroup;

    leafletMapRef.current = map;

    // Handle Map Click to Pin New Tag (only if isAddPinMode is active or for general map click)
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setPinnedCoords({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });
      setNewMarkerForm(prev => ({
        ...prev,
        location: `Vị trí tọa độ (${lat.toFixed(4)}, ${lng.toFixed(4)}) - Phường Phú Cường`,
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6))
      }));
      setShowAddModal(true);
    });

    return () => {
      map.remove();
      leafletMapRef.current = null;
    };
  }, []);

  // Update Tile Layer when source changes
  useEffect(() => {
    if (!leafletMapRef.current || !tileLayerRef.current) return;

    leafletMapRef.current.removeLayer(tileLayerRef.current);

    let url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    let attr = '© OpenStreetMap | Định Vị GPS';

    if (mapTileSource === 'CARTO_VOYAGER') {
      url = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      attr = '© CARTO Voyager | OpenStreetMap';
    } else if (mapTileSource === 'CARTO_LIGHT') {
      url = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      attr = '© CARTO Positron | OpenStreetMap';
    } else if (mapTileSource === 'SATELLITE') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attr = '© Esri Satellite Imagery | GIS';
    }

    const newTile = L.tileLayer(url, { maxZoom: 19, attribution: attr }).addTo(leafletMapRef.current);
    tileLayerRef.current = newTile;
  }, [mapTileSource]);

  // Color Mapping Helper for Tag Pills
  const getColorClasses = (color: MarkerColor, isSelected: boolean) => {
    const ringClass = isSelected ? 'ring-2 ring-white scale-105 shadow-xl' : 'shadow-md hover:scale-105';
    switch (color) {
      case 'green':
        return `bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-emerald-400 ${ringClass}`;
      case 'blue':
        return `bg-gradient-to-r from-blue-600 to-indigo-700 text-white border-blue-400 ${ringClass}`;
      case 'orange':
        return `bg-gradient-to-r from-amber-600 to-orange-700 text-white border-amber-400 ${ringClass}`;
      case 'purple':
        return `bg-gradient-to-r from-purple-600 to-indigo-800 text-white border-purple-400 ${ringClass}`;
      case 'red':
        return `bg-gradient-to-r from-rose-600 to-red-700 text-white border-rose-400 ${ringClass}`;
      case 'indigo':
        return `bg-gradient-to-r from-indigo-600 to-slate-800 text-white border-indigo-400 ${ringClass}`;
      case 'amber':
        return `bg-gradient-to-r from-amber-500 to-yellow-600 text-white border-amber-300 ${ringClass}`;
      default:
        return `bg-gradient-to-r from-blue-600 to-indigo-700 text-white border-blue-400 ${ringClass}`;
    }
  };

  // Render Custom Pill Badges on Leaflet Map
  useEffect(() => {
    if (!leafletMapRef.current || !markerLayerGroupRef.current) return;

    markerLayerGroupRef.current.clearLayers();

    filteredMarkers.forEach((marker) => {
      const isSelected = selectedMarker?.id === marker.id && showDetailPopup;
      const colorClass = getColorClasses(marker.color, isSelected);

      // Create Custom HTML Marker matching GPS pill design
      const iconHtml = `
        <div class="cursor-pointer transition-all duration-200" style="display: inline-block; transform: translate(-50%, -50%);">
          <div class="px-2 py-1 rounded-md border flex items-center gap-1.5 font-sans whitespace-nowrap select-none text-[11px] font-black ${colorClass}">
            <div class="w-3 h-3 rounded-full flex items-center justify-center bg-white/25 flex-shrink-0">
              <span style="font-size: 8px;">${marker.isVehicleGPS ? '🚗' : '📍'}</span>
            </div>
            <span class="tracking-tight">${marker.codeOrTitle}</span>
            ${marker.speedText ? `<span class="bg-black/30 px-1 py-0.2 rounded text-[9px] font-mono">${marker.speedText}</span>` : ''}
            ${marker.tagSubtext ? `<span class="bg-white/25 px-1 py-0.2 rounded text-[8px] font-bold uppercase tracking-wider">${marker.tagSubtext}</span>` : ''}
          </div>
          ${isSelected ? '<div class="w-2 h-2 mx-auto mt-0.5 bg-amber-400 rounded-full animate-ping"></div>' : ''}
        </div>
      `;

      const customDivIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-gps-tag-marker',
        iconSize: [120, 30],
        iconAnchor: [60, 15]
      });

      const leafletMarker = L.marker([marker.lat, marker.lng], {
        icon: customDivIcon,
        draggable: true
      });

      // Marker Click Handler -> Opens the Floating Detail Popup
      leafletMarker.on('click', () => {
        setSelectedMarker(marker);
        setShowDetailPopup(true);
        leafletMapRef.current?.panTo([marker.lat, marker.lng], { animate: true, duration: 0.8 });
      });

      // Marker Drag Handler (Allows repositioning pinned locations)
      leafletMarker.on('dragend', async (e) => {
        const newLatLng = e.target.getLatLng();
        const updatedLat = Number(newLatLng.lat.toFixed(6));
        const updatedLng = Number(newLatLng.lng.toFixed(6));

        // Update local state
        setMarkers(prev => prev.map(m => m.id === marker.id ? { ...m, lat: updatedLat, lng: updatedLng } : m));
        if (selectedMarker?.id === marker.id) {
          setSelectedMarker(prev => prev ? { ...prev, lat: updatedLat, lng: updatedLng } : null);
        }

        // Update Firestore if exists
        try {
          const markerRef = doc(db, 'map_hotspots', marker.id);
          await updateDoc(markerRef, { lat: updatedLat, lng: updatedLng });
          setNotificationMsg(`Đã cập nhật tọa độ mới cho: "${marker.codeOrTitle}"`);
          setTimeout(() => setNotificationMsg(null), 3000);
        } catch (err) {
          // Local fallback
        }
      });

      markerLayerGroupRef.current?.addLayer(leafletMarker);
    });
  }, [filteredMarkers, selectedMarker, showDetailPopup]);

  // Live GPS Simulation Effect
  useEffect(() => {
    if (!isLiveGPSSimulation) return;

    const interval = setInterval(() => {
      setMarkers(prev => prev.map(m => {
        if (!m.isVehicleGPS) return m;
        const deltaLat = (Math.random() - 0.5) * 0.00012;
        const deltaLng = (Math.random() - 0.5) * 0.00012;
        return {
          ...m,
          lat: Number((m.lat + deltaLat).toFixed(6)),
          lng: Number((m.lng + deltaLng).toFixed(6))
        };
      }));
    }, 4000);

    return () => clearInterval(interval);
  }, [isLiveGPSSimulation]);

  // Center on Selected Marker & Open Popup
  const handleSelectMarker = (marker: MapMarkerItem) => {
    setSelectedMarker(marker);
    setShowDetailPopup(true);
    if (leafletMapRef.current) {
      leafletMapRef.current.flyTo([marker.lat, marker.lng], 16, { animate: true, duration: 1 });
    }
  };

  // Center on Ward Administrative Center
  const handleResetView = () => {
    if (leafletMapRef.current) {
      leafletMapRef.current.flyTo([10.9815, 106.6525], 15, { animate: true, duration: 1 });
    }
  };

  // Add New Pinned Marker
  const handleSaveNewPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMarkerForm.codeOrTitle?.trim() || !pinnedCoords) return;

    const newMarker: MapMarkerItem = {
      id: 'pin-' + Date.now(),
      codeOrTitle: newMarkerForm.codeOrTitle.trim(),
      tagSubtext: newMarkerForm.tagSubtext || 'BA-GPS',
      location: newMarkerForm.location || 'Địa bàn Phường Phú Cường',
      wardOrKp: newMarkerForm.wardOrKp || 'Phường Phú Cường',
      category: (newMarkerForm.category as MarkerCategory) || 'Trật tự đô thị',
      color: (newMarkerForm.color as MarkerColor) || 'blue',
      severity: (newMarkerForm.severity as any) || 'Cảnh báo',
      speedText: newMarkerForm.speedText || '35km/h',
      statusText: newMarkerForm.statusText || 'Đang tuần tra',
      description: newMarkerForm.description || 'Vị trí điểm nóng/phương tiện được gắn thẻ trực tiếp từ bản đồ.',
      ideaTemplate: newMarkerForm.ideaTemplate || `Giao ${newMarkerForm.assignedUnit || 'UBND Phường'} chủ trì kiểm tra, xử lý dứt điểm điểm gắn thẻ này.`,
      assignedUnit: newMarkerForm.assignedUnit || 'UBND & Công an Phường',
      lat: pinnedCoords.lat,
      lng: pinnedCoords.lng,
      isVehicleGPS: newMarkerForm.isVehicleGPS || false,
      lastUpdated: 'Vừa gắn thẻ'
    };

    try {
      await addDoc(collection(db, 'map_hotspots'), {
        ...newMarker,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null
      });
      setNotificationMsg(`Đã gắn thẻ thành công vị trí: "${newMarker.codeOrTitle}"`);
    } catch (err) {
      setMarkers(prev => [newMarker, ...prev]);
      setNotificationMsg(`Đã lưu thẻ định vị "${newMarker.codeOrTitle}" trên bản đồ.`);
    }

    setSelectedMarker(newMarker);
    setShowDetailPopup(true);
    setShowAddModal(false);
    setIsAddPinMode(false);
    setTimeout(() => setNotificationMsg(null), 3500);

    if (leafletMapRef.current) {
      leafletMapRef.current.panTo([newMarker.lat, newMarker.lng]);
    }
  };

  // Delete Marker
  const handleDeleteMarker = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Bạn có chắc chắn muốn xóa thẻ vị trí này khỏi bản đồ?")) return;

    try {
      await deleteDoc(doc(db, 'map_hotspots', id));
    } catch (_) {
      // Local fallback
    }

    setMarkers(prev => prev.filter(m => m.id !== id));
    if (selectedMarker?.id === id) {
      setSelectedMarker(null);
      setShowDetailPopup(false);
    }
    setNotificationMsg("Đã xóa thẻ vị trí khỏi bản đồ.");
    setTimeout(() => setNotificationMsg(null), 2500);
  };

  // Navigate to Directive Drafting with Pre-filled idea
  const handleDraftDirective = (marker: MapMarkerItem) => {
    navigate('/directive', {
      state: {
        presetIdea: marker.ideaTemplate || marker.description,
        location: marker.location
      }
    });
  };

  // Quick Task Creation for UBND
  const handleCreateTaskFromMap = async (marker: MapMarkerItem) => {
    try {
      await addDoc(collection(db, 'tasks'), {
        title: `Xử lý điểm gắn thẻ bản đồ: ${marker.codeOrTitle} (${marker.location})`,
        description: marker.description,
        assignedOrganization: marker.assignedUnit || "Ủy ban nhân dân phường",
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString('vi-VN'),
        status: 'PENDING',
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null
      });
      setNotificationMsg("Đã tạo nhiệm vụ chỉ đạo giao việc cho UBND thành công!");
      setTimeout(() => setNotificationMsg(null), 3500);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="w-full max-w-full mx-auto space-y-3 pb-8 font-sans px-2 md:px-4">
      
      {/* Top Header Banner & Actions */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 rounded-2xl p-3.5 md:p-4 text-white shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1 relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              Bản Đồ Định Vị GPS & OpenStreetMap
            </span>
            <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-200 border border-blue-400/30 text-[10px] font-bold">
              {isLiveGPSSimulation ? `Trực tuyến (${markers.length} phương tiện & điểm ghim kết nối)` : 'Chế độ bản đồ tĩnh'}
            </span>
          </div>
          <h1 className="text-base md:text-lg font-black tracking-tight text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-400" />
            <span>Bản Đồ Định Vị GIS Toàn Cảnh Địa Bàn</span>
          </h1>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 relative z-10">
          <button
            id="btn-add-pin-map"
            onClick={() => {
              setIsAddPinMode(!isAddPinMode);
              if (!isAddPinMode) {
                setNotificationMsg("Chế độ gắn thẻ đã BẬT: Nhấp vào bất kỳ điểm nào trên bản đồ để cắm ghim!");
              } else {
                setNotificationMsg(null);
              }
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
              isAddPinMode 
                ? 'bg-amber-400 text-slate-950 font-extrabold ring-2 ring-amber-300 animate-pulse' 
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>{isAddPinMode ? 'Đang bật gắn thẻ (Nhấp trên bản đồ)' : 'Gắn Thẻ Lên Bản Đồ'}</span>
          </button>

          <button
            id="btn-toggle-live-gps"
            onClick={() => setIsLiveGPSSimulation(!isLiveGPSSimulation)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
              isLiveGPSSimulation
                ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Bật/Tắt mô phỏng chuyển động phương tiện GPS"
          >
            <Radio className={`w-3.5 h-3.5 ${isLiveGPSSimulation ? 'text-emerald-300 animate-pulse' : 'text-slate-400'}`} />
            <span>{isLiveGPSSimulation ? 'Live GPS: Bật' : 'Live GPS: Tắt'}</span>
          </button>

          <Link
            id="btn-nav-directive"
            to="/directive"
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Tham mưu Chỉ đạo</span>
          </Link>
        </div>
      </div>

      {/* Notification Toast */}
      {notificationMsg && (
        <div id="map-notification-toast" className="p-2.5 bg-emerald-950 text-emerald-100 rounded-xl flex items-center justify-between gap-3 text-xs border border-emerald-600 shadow-md">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="font-bold">{notificationMsg}</span>
          </div>
          <button 
            onClick={() => setNotificationMsg(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Map Control Bar (Layers, Search, Category Filter) */}
      <div id="map-control-bar" className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="map-search-input"
            type="text"
            placeholder="Tìm biển số xe, mã GPS, vị trí, khu phố..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none"
          />
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            id="map-category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Tất cả loại thẻ ({markers.length})</option>
            <option value="Tuần tra GPS & Phương tiện">🚗 Tuần tra GPS & Xe công vụ</option>
            <option value="Trật tự đô thị">🏙️ Trật tự đô thị</option>
            <option value="PCCC & An toàn">🔥 PCCC & An toàn</option>
            <option value="Môi trường">🌿 Môi trường</option>
            <option value="An ninh trật tự">🚔 An ninh trật tự</option>
            <option value="Trụ sở & Điểm tiếp dân">🏢 Trụ sở & Điểm tiếp dân</option>
          </select>

          <select
            id="map-severity-filter"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="Nóng">🔴 Nóng / Khẩn cấp</option>
            <option value="Cảnh báo">🟠 Cảnh báo</option>
            <option value="Bình thường">🟢 Bình thường / Đang chạy</option>
          </select>

          {/* Map Layer Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setMapTileSource('OSM')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                mapTileSource === 'OSM' ? 'bg-white text-blue-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Bản đồ đường phố OpenStreetMap chuẩn"
            >
              Giao thông (OSM)
            </button>
            <button
              onClick={() => setMapTileSource('CARTO_VOYAGER')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                mapTileSource === 'CARTO_VOYAGER' ? 'bg-white text-blue-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Bản đồ đô thị sắc nét"
            >
              Đô thị (Voyager)
            </button>
            <button
              onClick={() => setMapTileSource('SATELLITE')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                mapTileSource === 'SATELLITE' ? 'bg-white text-blue-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Bản đồ ảnh vệ tinh"
            >
              Vệ tinh
            </button>
          </div>

          <button
            onClick={handleResetView}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            title="Quay về trung tâm phường"
          >
            <Compass className="w-4 h-4 text-blue-600" />
          </button>
        </div>
      </div>

      {/* FULL-WIDTH IMMERSIVE MAP CANVAS */}
      <div id="full-map-wrapper" className="relative w-full space-y-2">
        <div 
          id="map-canvas-container"
          className="relative w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-300 shadow-sm min-h-[600px] h-[680px] md:h-[720px] z-0"
        >
          {/* Leaflet Map Canvas */}
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* In-Map Top-Left Floating Header Badge */}
          <div className="absolute top-3 left-3 z-[1000] bg-white/90 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-lg border border-slate-200/80 pointer-events-auto flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <div className="space-y-0.5 text-left">
              <div className="text-[11px] font-black text-slate-900 flex items-center gap-1">
                <Navigation className="w-3 h-3 text-blue-600" />
                <span>Bản Đồ Định Vị GPS Bình Anh & OpenStreetMap</span>
              </div>
              <div className="text-[10px] text-slate-600 font-medium">
                {filteredMarkers.length} vị trí đang giám sát • {isLiveGPSSimulation ? 'Trực tuyến 34 phương tiện' : 'Sẵn sàng'}
              </div>
            </div>
          </div>

          {/* In-Map Top-Right Stats Pill */}
          <div className="absolute top-3 right-3 z-[1000] bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-white text-[10px] flex items-center gap-3 shadow-md pointer-events-auto">
            <div className="flex items-center gap-1 font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Địa bàn:</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>An toàn: <strong>{markers.filter(m => m.severity === 'Bình thường').length}</strong></span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>Cảnh báo: <strong>{markers.filter(m => m.severity === 'Cảnh báo').length}</strong></span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              <span>Nóng: <strong>{markers.filter(m => m.severity === 'Nóng').length}</strong></span>
            </div>
          </div>

          {/* In-Map Hint when Pin Mode is On */}
          {isAddPinMode && (
            <div className="absolute top-16 left-3 z-[1000] bg-amber-400 text-slate-950 px-3 py-1.5 rounded-xl text-[11px] font-black shadow-lg border border-amber-500 flex items-center gap-2 animate-bounce">
              <MapPin className="w-3.5 h-3.5 text-slate-950" />
              <span>Nhấp chuột vào vị trí bất kỳ trên bản đồ để cắm thẻ mới!</span>
            </div>
          )}

          {/* Quick Map Legend in Bottom Left */}
          <div className="absolute bottom-3 left-3 z-[1000] bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-white text-[10px] flex items-center gap-3 shadow-md pointer-events-auto">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>An toàn/BA-GPS</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              <span>Tuần tra</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>Cảnh báo</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              <span>Nóng/Khẩn</span>
            </div>
          </div>

        </div>

        {/* Quick Horizontal Strip of Current Tagged Points */}
        <div id="quick-marker-strip" className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-900">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Danh sách thẻ vị trí nhanh ({filteredMarkers.length})</span>
            </span>
            <span className="text-[10px] text-slate-400">Nhấp vào thẻ để mở popup chi tiết và định vị trên bản đồ</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {filteredMarkers.map(m => (
              <button
                key={m.id}
                onClick={() => handleSelectMarker(m)}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-black border whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                  selectedMarker?.id === m.id && showDetailPopup
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-300'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span>{m.isVehicleGPS ? '🚗' : '📍'}</span>
                <span>{m.codeOrTitle}</span>
                {m.speedText && <span className="opacity-75 font-mono">({m.speedText})</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FLOATING POPUP / MODAL: SELECTED LOCATION / VEHICLE DETAIL (POPS UP ON CLICK) */}
      {/* ========================================================================= */}
      {showDetailPopup && selectedMarker && (
        <div 
          id="marker-detail-popup-backdrop"
          className="fixed inset-0 z-[2500] bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-3 md:p-4 animate-in fade-in duration-150"
          onClick={() => setShowDetailPopup(false)}
        >
          <div 
            id="marker-detail-popup-modal"
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden space-y-0 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header of Selected Marker */}
            <div className="px-4 py-3 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white flex items-start justify-between gap-2 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase text-white ${
                    selectedMarker.color === 'green' ? 'bg-emerald-600' :
                    selectedMarker.color === 'orange' ? 'bg-amber-600' :
                    selectedMarker.color === 'red' ? 'bg-rose-600' :
                    selectedMarker.color === 'purple' ? 'bg-purple-600' : 'bg-blue-600'
                  }`}>
                    {selectedMarker.category}
                  </span>

                  {selectedMarker.speedText && (
                    <span className="px-1.5 py-0.5 bg-white/15 text-slate-100 text-[10px] font-mono font-bold rounded">
                      ⚡ {selectedMarker.speedText}
                    </span>
                  )}
                  {selectedMarker.tagSubtext && (
                    <span className="text-[10px] font-bold text-blue-200 bg-blue-500/30 px-1.5 py-0.5 rounded">
                      {selectedMarker.tagSubtext}
                    </span>
                  )}
                </div>

                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <span>{selectedMarker.isVehicleGPS ? '🚗' : '📍'}</span>
                  <span>{selectedMarker.codeOrTitle}</span>
                </h3>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleDeleteMarker(selectedMarker.id)}
                  className="p-1.5 hover:bg-red-500/20 text-slate-300 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                  title="Xóa thẻ này khỏi bản đồ"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowDetailPopup(false)}
                  className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                  title="Đóng popup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Popup Body Content */}
            <div className="p-4 md:p-5 space-y-3 text-xs max-h-[75vh] overflow-y-auto">
              {/* Location & Coordinates */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vị trí địa bàn:</div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="font-bold text-slate-900 flex items-start gap-1.5">
                    <MapPin className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                    <span className="text-xs">{selectedMarker.location}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono pl-5">
                    Tọa độ GPS: {selectedMarker.lat.toFixed(5)}, {selectedMarker.lng.toFixed(5)} ({selectedMarker.wardOrKp})
                  </div>
                </div>
              </div>

              {/* Status & Assigned Unit */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Trạng thái</div>
                  <div className="font-bold text-slate-800">{selectedMarker.statusText || 'Đang hoạt động'}</div>
                </div>
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Cập nhật</div>
                  <div className="font-bold text-slate-800">{selectedMarker.lastUpdated}</div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1 text-xs">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nội dung phản ánh / Tình hình:</div>
                <p className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs leading-relaxed font-medium">
                  {selectedMarker.description}
                </p>
              </div>

              {/* Assigned Unit */}
              <div className="space-y-1 text-xs">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đơn vị chủ trì:</div>
                <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-950 font-bold text-xs flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span>{selectedMarker.assignedUnit}</span>
                </div>
              </div>

              {/* Proposed Directive Template */}
              {selectedMarker.ideaTemplate && (
                <div className="space-y-1 text-xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đề xuất ý kiến chỉ đạo Bí thư:</div>
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-950 text-xs italic leading-relaxed font-medium">
                    "{selectedMarker.ideaTemplate}"
                  </div>
                </div>
              )}

              {/* Direct Action Buttons */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="button"
                  id="btn-popup-draft-directive"
                  onClick={() => handleDraftDirective(selectedMarker)}
                  className="w-full sm:flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Soạn Thảo Chỉ Đạo Cho Điểm Này</span>
                </button>

                <button
                  type="button"
                  id="btn-popup-create-task"
                  onClick={() => handleCreateTaskFromMap(selectedMarker)}
                  className="w-full sm:flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-200 cursor-pointer"
                >
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                  <span>Tạo Nhiệm Vụ UBND</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD NEW PINNED TAG ON MAP */}
      {/* ========================================================================= */}
      {showAddModal && pinnedCoords && (
        <div className="fixed inset-0 z-[2500] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden space-y-0 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-blue-950 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  Gắn Thẻ Mới Lên Bản Đồ
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveNewPin} className="p-4 md:p-5 space-y-3 text-xs max-h-[80vh] overflow-y-auto">
              
              {/* Coords Info Badge */}
              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 flex items-center justify-between font-mono text-[11px]">
                <span>Tọa độ đã chọn:</span>
                <span className="font-bold">{pinnedCoords.lat}, {pinnedCoords.lng}</span>
              </div>

              {/* Title / Code */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase tracking-wider block text-[10px]">
                  Tên thẻ / Biển số GPS / Mã điểm nóng (*):
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: 30H-999.88, Điểm lấn chiếm vỉa hè, Tổ Tuần tra số 2..."
                  value={newMarkerForm.codeOrTitle || ''}
                  onChange={(e) => setNewMarkerForm({ ...newMarkerForm, codeOrTitle: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-none"
                  required
                />
              </div>

              {/* Category & Color */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wider block text-[10px]">Lĩnh vực:</label>
                  <select
                    value={newMarkerForm.category}
                    onChange={(e) => setNewMarkerForm({ ...newMarkerForm, category: e.target.value as MarkerCategory })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    <option value="Tuần tra GPS & Phương tiện">🚗 Tuần tra GPS & Xe công vụ</option>
                    <option value="Trật tự đô thị">🏙️ Trật tự đô thị</option>
                    <option value="PCCC & An toàn">🔥 PCCC & An toàn</option>
                    <option value="Môi trường">🌿 Môi trường</option>
                    <option value="An ninh trật tự">🚔 An ninh trật tự</option>
                    <option value="Trụ sở & Điểm tiếp dân">🏢 Trụ sở & Điểm tiếp dân</option>
                    <option value="GPMB & Hạ tầng">🏗️ GPMB & Hạ tầng</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wider block text-[10px]">Màu sắc thẻ:</label>
                  <select
                    value={newMarkerForm.color}
                    onChange={(e) => setNewMarkerForm({ ...newMarkerForm, color: e.target.value as MarkerColor })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    <option value="green">🟢 Xanh lá (BA-GPS / An toàn)</option>
                    <option value="blue">🔵 Xanh dương (Tuần tra / Đang chạy)</option>
                    <option value="orange">🟠 Cam (Cảnh báo / Cần nhắc nhở)</option>
                    <option value="red">🔴 Đỏ (Điểm Nóng / Khẩn cấp)</option>
                    <option value="purple">🟣 Tím (Trụ sở / Điểm chỉ huy)</option>
                  </select>
                </div>
              </div>

              {/* Location Name */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase tracking-wider block text-[10px]">
                  Địa chỉ / Tuyến đường / Khu vực:
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Tuyến đường Bạch Đằng, Hẻm 420 Nguyễn Tri Phương..."
                  value={newMarkerForm.location || ''}
                  onChange={(e) => setNewMarkerForm({ ...newMarkerForm, location: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none"
                />
              </div>

              {/* Speed & Status */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wider block text-[10px]">Tốc độ / Ghi chú nhanh:</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 45km/h, Chốt trực, Đang tuần tra..."
                    value={newMarkerForm.speedText || ''}
                    onChange={(e) => setNewMarkerForm({ ...newMarkerForm, speedText: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-xs focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wider block text-[10px]">Đơn vị chủ trì:</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: UBND & Công an Phường..."
                    value={newMarkerForm.assignedUnit || ''}
                    onChange={(e) => setNewMarkerForm({ ...newMarkerForm, assignedUnit: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase tracking-wider block text-[10px]">Nội dung phản ánh / Tình hình cụ thể:</label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú chi tiết tình hình địa bàn..."
                  value={newMarkerForm.description || ''}
                  onChange={(e) => setNewMarkerForm({ ...newMarkerForm, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu Thẻ Lên Bản Đồ</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
