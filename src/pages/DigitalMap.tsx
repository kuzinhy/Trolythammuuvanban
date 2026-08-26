import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import { 
  MapPin, CheckCircle2, Filter, 
  Building2, Sparkles, Plus, Layers, Search, 
  CheckSquare, Navigation, Trash2, Compass, Radio, X, 
  ShieldCheck, Save, Sliders, Eye, EyeOff, Check,
  AlertTriangle, Flame, ShieldAlert, Loader2, Copy, Send, FileText, Zap, Users
} from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { db } from '../lib/firebase';
import { 
  collection, addDoc, updateDoc, deleteDoc, doc, 
  onSnapshot, serverTimestamp, query, orderBy 
} from 'firebase/firestore';
import { useAuthStore } from '../store/authStore';
import { safeFetchJson } from '../lib/safeFetch';

export interface IncidentResponseResult {
  threatLevel: string;
  escalationProbability: number;
  predictiveAnalysis: string;
  threePillarResponse: {
    partyMassMobilization: {
      leadOfficer: string;
      immediateActions: string[];
      timeline: string;
    };
    policeSecurity: {
      leadOfficer: string;
      immediateActions: string[];
      timeline: string;
    };
    governmentAdministration: {
      leadOfficer: string;
      immediateActions: string[];
      timeline: string;
    };
  };
  executiveSecretaryOrder: string;
}

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

export interface MapLayerDefinition {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  colorClass: string;
  badgeBg: string;
  description: string;
  matchFn: (marker: MapMarkerItem) => boolean;
}

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

// Definition of Leaflet LayerGroups
export const MAP_LAYERS: MapLayerDefinition[] = [
  {
    id: 'layer_co_quan',
    name: 'Cơ quan & Trụ sở hành chính',
    shortName: 'Cơ quan & Trụ sở',
    icon: '🏢',
    colorClass: 'text-purple-600 border-purple-300 bg-purple-50',
    badgeBg: 'bg-purple-600',
    description: 'Trụ sở Đảng ủy, UBND, Trung tâm hành chính, Bộ phận Một cửa, Điểm tiếp dân',
    matchFn: (m) => m.category === 'Trụ sở & Điểm tiếp dân'
  },
  {
    id: 'layer_diem_nong',
    name: 'Điểm nóng & An ninh trật tự',
    shortName: 'Điểm nóng & An ninh',
    icon: '🔥',
    colorClass: 'text-rose-600 border-rose-300 bg-rose-50',
    badgeBg: 'bg-rose-600',
    description: 'Điểm nóng vi phạm trật tự đô thị, buôn bán lấn chiếm, an ninh trật tự khu vực',
    matchFn: (m) => m.severity === 'Nóng' || m.category === 'Trật tự đô thị' || m.category === 'An ninh trật tự'
  },
  {
    id: 'layer_ha_tang',
    name: 'Hạ tầng, Môi trường & GPMB',
    shortName: 'Hạ tầng & Môi trường',
    icon: '🏗️',
    colorClass: 'text-emerald-600 border-emerald-300 bg-emerald-50',
    badgeBg: 'bg-emerald-600',
    description: 'Dự án giao thông, nạo vét kênh rạch, công trình GPMB, chuyển đổi số',
    matchFn: (m) => m.category === 'Môi trường' || m.category === 'GPMB & Hạ tầng' || m.category === 'Chuyển đổi số'
  },
  {
    id: 'layer_gps_xe',
    name: 'Phương tiện & Tuần tra GPS',
    shortName: 'Tuần tra & GPS Xe',
    icon: '🚗',
    colorClass: 'text-blue-600 border-blue-300 bg-blue-50',
    badgeBg: 'bg-blue-600',
    description: 'Đội tuần tra cơ động, xe công vụ, giám sát hành trình GPS trực tuyến',
    matchFn: (m) => m.isVehicleGPS === true || m.category === 'Tuần tra GPS & Phương tiện'
  },
  {
    id: 'layer_pccc',
    name: 'PCCC & Cứu nạn an toàn',
    shortName: 'PCCC & Cứu nạn',
    icon: '🚒',
    colorClass: 'text-amber-600 border-amber-300 bg-amber-50',
    badgeBg: 'bg-amber-600',
    description: 'Kiểm tra an toàn PCCC, cơ sở nhà trọ, họng nước cứu hỏa địa bàn',
    matchFn: (m) => m.category === 'PCCC & An toàn'
  }
];

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
  },
  {
    id: 'spot-gps-8',
    codeOrTitle: 'UBND-HCC-01',
    tagSubtext: 'Một Cửa',
    location: 'Trung tâm Phục vụ Hành chính công Phường',
    wardOrKp: 'Phường Phú Cường',
    category: 'Trụ sở & Điểm tiếp dân',
    color: 'purple',
    severity: 'Bình thường',
    speedText: 'Cố định',
    statusText: 'Bộ phận một cửa',
    description: 'Tiếp nhận và trả kết quả thủ tục hành chính công, dịch vụ công trực tuyến VNeID và tư vấn pháp lý cho nhân dân.',
    ideaTemplate: 'Tập trung nâng cao chỉ số hài lòng của người dân tại Bộ phận Một cửa, đảm bảo 100% hồ sơ giải quyết đúng và trước hạn.',
    assignedUnit: 'Bộ phận Tiếp nhận & Trả kết quả UBND Phường',
    lat: 10.9838,
    lng: 106.6538,
    isVehicleGPS: false,
    lastUpdated: 'Đang mở cửa'
  },
  {
    id: 'spot-gps-9',
    codeOrTitle: 'GPMB-HT-03',
    tagSubtext: 'Dự án',
    location: 'Dự án Cải tạo vỉa hè & Cây xanh đường Bạch Đằng',
    wardOrKp: 'Phường Phú Cường',
    category: 'GPMB & Hạ tầng',
    color: 'green',
    severity: 'Cảnh báo',
    speedText: 'Thi công',
    statusText: 'Đang thi công hạ tầng',
    description: 'Công trình lát đá hoa cương vỉa hè và hạ ngầm cáp viễn thông, tiến độ đạt 85%, dự kiến hoàn thành trước ngày 30.',
    ideaTemplate: 'Yêu cầu Ban Quản lý Dự án đôn đốc đơn vị thi công rào chắn an toàn, hoàn trả mặt bằng vệ sinh sạch sẽ cho người đi bộ.',
    assignedUnit: 'Ban Quản lý Dự án Đầu tư Xây dựng & Đô thị',
    lat: 10.9788,
    lng: 106.6552,
    isVehicleGPS: false,
    lastUpdated: 'Hôm nay'
  },
  {
    id: 'spot-gps-10',
    codeOrTitle: 'CAM-AI-09',
    tagSubtext: 'AI-Cam',
    location: 'Nút giao Đại lộ Bình Dương & Yersin',
    wardOrKp: 'Phường Hiệp Thành',
    category: 'An ninh trật tự',
    color: 'red',
    severity: 'Nóng',
    speedText: 'Camera 24/7',
    statusText: 'Phát hiện cảnh báo AI',
    description: 'Hệ thống Camera AI phát hiện phương tiện dừng đỗ trái phép gây ùn ứ cục bộ vào giờ tan tầm.',
    ideaTemplate: 'Chỉ đạo Công an phường trích xuất hình ảnh Camera AI xử lý phạt nguội các trường hợp vi phạm lặp lại nhiều lần.',
    assignedUnit: 'Công an Phường & Trung tâm Điều hành IOC',
    lat: 10.9855,
    lng: 106.6592,
    isVehicleGPS: false,
    lastUpdated: '1 phút trước'
  }
];

export default function DigitalMap() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const layerGroupsRef = useRef<Record<string, L.LayerGroup>>({});
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

  // Leaflet LayerGroup toggle state
  const [enabledLayers, setEnabledLayers] = useState<Record<string, boolean>>({
    layer_co_quan: true,
    layer_diem_nong: true,
    layer_ha_tang: true,
    layer_gps_xe: true,
    layer_pccc: true
  });
  const [showLayerPanel, setShowLayerPanel] = useState<boolean>(false);

  // Feature 3: Incident Response Playbook States
  const [showPlaybookModal, setShowPlaybookModal] = useState<boolean>(false);
  const [isLoadingPlaybook, setIsLoadingPlaybook] = useState<boolean>(false);
  const [playbookResult, setPlaybookResult] = useState<IncidentResponseResult | null>(null);
  const [playbookMarker, setPlaybookMarker] = useState<MapMarkerItem | null>(null);
  const [copiedPlaybookText, setCopiedPlaybookText] = useState<string | null>(null);

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

  // Filtered Markers (Search, Category Filter, Severity Filter)
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

  // Count markers per Leaflet LayerGroup
  const layerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    MAP_LAYERS.forEach(layer => {
      counts[layer.id] = markers.filter(m => layer.matchFn(m)).length;
    });
    return counts;
  }, [markers]);

  // Visible markers according to active Leaflet LayerGroups
  const visibleMarkers = useMemo(() => {
    return filteredMarkers.filter(m => {
      return MAP_LAYERS.some(layer => enabledLayers[layer.id] && layer.matchFn(m));
    });
  }, [filteredMarkers, enabledLayers]);

  // Toggle single Leaflet LayerGroup
  const handleToggleLayer = (layerId: string) => {
    setEnabledLayers(prev => {
      const nextState = !prev[layerId];
      const updated = { ...prev, [layerId]: nextState };
      const layerDef = MAP_LAYERS.find(l => l.id === layerId);
      setNotificationMsg(`Đã ${nextState ? 'bật' : 'tắt'} lớp dữ liệu: "${layerDef?.name}"`);
      setTimeout(() => setNotificationMsg(null), 2500);
      return updated;
    });
  };

  // Enable all Leaflet LayerGroups
  const handleEnableAllLayers = () => {
    const allEnabled: Record<string, boolean> = {};
    MAP_LAYERS.forEach(l => { allEnabled[l.id] = true; });
    setEnabledLayers(allEnabled);
    setNotificationMsg("Đã hiển thị tất cả các lớp dữ liệu trên bản đồ.");
    setTimeout(() => setNotificationMsg(null), 2500);
  };

  // Isolate a specific Leaflet LayerGroup
  const handleIsolateLayer = (layerId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isolated: Record<string, boolean> = {};
    MAP_LAYERS.forEach(l => { isolated[l.id] = l.id === layerId; });
    setEnabledLayers(isolated);
    const layerDef = MAP_LAYERS.find(l => l.id === layerId);
    setNotificationMsg(`Chỉ hiển thị lớp dữ liệu: "${layerDef?.name}"`);
    setTimeout(() => setNotificationMsg(null), 2500);
  };

  // Initialize Leaflet Map with LayerGroups
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
      attribution: '© OpenStreetMap contributors | GIS Đô Thị & Định vị GPS'
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Initialize each Leaflet LayerGroup for categories
    const groups: Record<string, L.LayerGroup> = {};
    MAP_LAYERS.forEach(layer => {
      const group = L.layerGroup();
      groups[layer.id] = group;
      group.addTo(map);
    });
    layerGroupsRef.current = groups;

    leafletMapRef.current = map;

    // Handle Map Click to Pin New Tag
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

  // Render Custom Pill Badges inside respective Leaflet LayerGroups
  useEffect(() => {
    if (!leafletMapRef.current || !layerGroupsRef.current) return;

    // Iterate through each LayerGroup
    MAP_LAYERS.forEach((layerDef) => {
      const group = layerGroupsRef.current[layerDef.id];
      if (!group) return;

      // Clear existing markers in this LayerGroup
      group.clearLayers();

      // If this layer is turned off by the user, remove it from Leaflet map
      if (!enabledLayers[layerDef.id]) {
        if (leafletMapRef.current?.hasLayer(group)) {
          leafletMapRef.current.removeLayer(group);
        }
        return;
      }

      // If enabled, ensure the LayerGroup is attached to the map
      if (!leafletMapRef.current?.hasLayer(group)) {
        group.addTo(leafletMapRef.current);
      }

      // Filter markers matching this LayerGroup's predicate
      const layerMarkers = filteredMarkers.filter(m => layerDef.matchFn(m));

      layerMarkers.forEach((marker) => {
        const isSelected = selectedMarker?.id === marker.id && showDetailPopup;
        const colorClass = getColorClasses(marker.color, isSelected);

        // Create Custom HTML Marker matching GPS pill design
        const iconHtml = `
          <div class="cursor-pointer transition-all duration-200" style="display: inline-block; transform: translate(-50%, -50%);">
            <div class="px-2 py-1 rounded-md border flex items-center gap-1.5 font-sans whitespace-nowrap select-none text-[11px] font-black ${colorClass}">
              <div class="w-3.5 h-3.5 rounded-full flex items-center justify-center bg-white/25 flex-shrink-0">
                <span style="font-size: 9px;">${marker.isVehicleGPS ? '🚗' : (layerDef.icon || '📍')}</span>
              </div>
              <span class="tracking-tight">${marker.codeOrTitle}</span>
              ${marker.speedText ? `<span class="bg-black/30 px-1 py-0.2 rounded text-[9px] font-mono">${marker.speedText}</span>` : ''}
              ${marker.tagSubtext ? `<span class="bg-white/25 px-1 py-0.2 rounded text-[8px] font-bold uppercase tracking-wider">${marker.tagSubtext}</span>` : ''}
            </div>
            ${isSelected ? '<div class="w-2.5 h-2.5 mx-auto mt-0.5 bg-amber-400 rounded-full animate-ping"></div>' : ''}
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

        // Marker Drag Handler (Repositioning pinned locations)
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

        // Add Marker directly to this specific Leaflet LayerGroup
        group.addLayer(leafletMarker);
      });
    });
  }, [filteredMarkers, enabledLayers, selectedMarker, showDetailPopup]);

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

  // AI Predict Incident Response Handler
  const handleGenerateIncidentPlaybook = async (markerToAnalyze?: MapMarkerItem) => {
    const target = markerToAnalyze || selectedMarker || markers[0];
    if (!target) return;
    setPlaybookMarker(target);
    setShowPlaybookModal(true);
    setIsLoadingPlaybook(true);

    try {
      const res = await safeFetchJson<IncidentResponseResult>('/api/ai-predict-incident-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marker: target,
          nearbyContext: markers
            .filter(m => m.id !== target.id)
            .slice(0, 4)
            .map(m => `${m.codeOrTitle} (${m.location}, Mức: ${m.severity})`)
            .join('; ')
        })
      });

      if (!res.ok || !res.data) throw new Error(res.error || "Không thể tạo kịch bản tác chiến.");
      const data: IncidentResponseResult = res.data;
      setPlaybookResult(data);
    } catch (err: any) {
      console.error(err);
      setNotificationMsg("Lỗi tạo kịch bản tác chiến 3 mũi AI.");
      setTimeout(() => setNotificationMsg(null), 3000);
    } finally {
      setIsLoadingPlaybook(false);
    }
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
      
      {/* Top Header Banner & Actions with Google Studio Flowing Gradient Border */}
      <div className="google-studio-border google-studio-glow">
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-600 rounded-[calc(1.25rem-2px)] p-3.5 md:p-4 text-white flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg shadow-blue-500/10">
          <div className="space-y-1 relative z-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white border border-white/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 backdrop-blur-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping"></span>
                Bản Đồ Định Vị GPS & OpenStreetMap
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-white/15 text-blue-50 border border-white/20 text-[10px] font-bold backdrop-blur-xs">
                {isLiveGPSSimulation ? `Trực tuyến (${markers.length} phương tiện & điểm ghim kết nối)` : 'Chế độ bản đồ tĩnh'}
              </span>
              <span className="text-[10px] text-amber-200 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-300" />
                Google Studio GIS
              </span>
            </div>
            <h1 className="text-base md:text-lg font-black tracking-tight text-white flex items-center gap-2 drop-shadow-xs">
              <MapPin className="w-5 h-5 text-emerald-300" />
              <span>Bản Đồ Định Vị GIS Toàn Cảnh Địa Bàn</span>
            </h1>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-2 relative z-10">
            <button
              type="button"
              onClick={() => handleGenerateIncidentPlaybook()}
              className="px-3 py-1.5 bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-xs cursor-pointer border border-rose-300/40"
              title="Dự báo nguy cơ và kích hoạt kịch bản tác chiến 3 mũi (Khối Vận - Công an - UBND)"
            >
              <ShieldAlert className="w-4 h-4 text-amber-200 animate-pulse" />
              <span>AI Tác Chiến 3 Mũi</span>
            </button>

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
                  : 'bg-emerald-500 hover:bg-emerald-400 text-white border border-emerald-400'
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
                  ? 'bg-white text-blue-900 border-white shadow-xs font-black'
                  : 'bg-white/15 text-white border-white/20 hover:bg-white/25 backdrop-blur-xs'
              }`}
              title="Bật/Tắt mô phỏng chuyển động phương tiện GPS"
            >
              <Radio className={`w-3.5 h-3.5 ${isLiveGPSSimulation ? 'text-emerald-500 animate-pulse' : 'text-blue-100'}`} />
              <span>{isLiveGPSSimulation ? 'Live GPS: Bật' : 'Live GPS: Tắt'}</span>
            </button>

            <Link
              id="btn-nav-directive"
              to="/directive"
              className="px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-900 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-xs border border-white/80 active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Tham mưu Chỉ đạo</span>
            </Link>
          </div>
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

      {/* Leaflet LayerGroups Quick Switcher Bar */}
      <div id="leaflet-layergroup-bar" className="bg-white p-2.5 md:p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-2 font-black text-slate-900">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Lớp Dữ Liệu Leaflet LayerGroups</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
              {Object.values(enabledLayers).filter(Boolean).length}/{MAP_LAYERS.length} lớp bật
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              id="btn-enable-all-layers"
              onClick={handleEnableAllLayers}
              className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors cursor-pointer border border-blue-200"
            >
              Bật tất cả lớp
            </button>
            <button
              id="btn-disable-all-layers"
              onClick={() => {
                const allOff: Record<string, boolean> = {};
                MAP_LAYERS.forEach(l => { allOff[l.id] = false; });
                setEnabledLayers(allOff);
                setNotificationMsg("Đã ẩn tất cả các lớp dữ liệu trên bản đồ.");
                setTimeout(() => setNotificationMsg(null), 2500);
              }}
              className="px-2.5 py-1 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer border border-slate-200"
            >
              Ẩn tất cả lớp
            </button>
            <button
              id="btn-toggle-layer-panel"
              onClick={() => setShowLayerPanel(!showLayerPanel)}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1 border ${
                showLayerPanel 
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Bảng lớp chi tiết</span>
            </button>
          </div>
        </div>

        {/* Quick Layer Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          {MAP_LAYERS.map((layer) => {
            const isEnabled = !!enabledLayers[layer.id];
            const count = layerCounts[layer.id] || 0;
            return (
              <button
                key={layer.id}
                id={`btn-layer-toggle-${layer.id}`}
                onClick={() => handleToggleLayer(layer.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border select-none ${
                  isEnabled
                    ? `${layer.colorClass} shadow-xs ring-1 ring-offset-1`
                    : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200/70 hover:text-slate-600'
                }`}
                title={`Bật/Tắt lớp: ${layer.name} (${layer.description})`}
              >
                <span className="text-sm">{layer.icon}</span>
                <span className={isEnabled ? 'font-black' : 'font-medium'}>{layer.shortName}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  isEnabled ? `${layer.badgeBg} text-white` : 'bg-slate-200 text-slate-600'
                }`}>
                  {count}
                </span>
                <span className={`text-[10px] font-bold ${isEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {isEnabled ? '● Bật' : '○ Tắt'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

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
            <option value="GPMB & Hạ tầng">🏗️ GPMB & Hạ tầng</option>
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
                <span>Bản Đồ Định Vị GIS & GPS Bình Anh</span>
              </div>
              <div className="text-[10px] text-slate-600 font-medium">
                {visibleMarkers.length}/{markers.length} điểm hiển thị • {isLiveGPSSimulation ? 'Trực tuyến kết nối' : 'Bản đồ sẵn sàng'}
              </div>
            </div>
          </div>

          {/* In-Map Top-Right Stats & Layer Button */}
          <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2 pointer-events-auto">
            <button
              id="btn-inmap-toggle-layers"
              onClick={() => setShowLayerPanel(!showLayerPanel)}
              className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-md hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Lớp GIS ({Object.values(enabledLayers).filter(Boolean).length})</span>
            </button>

            <div className="bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-white text-[10px] hidden sm:flex items-center gap-3 shadow-md">
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
          </div>

          {/* In-Map GIS Layer Manager Floating Panel */}
          {showLayerPanel && (
            <div 
              id="inmap-layer-manager-card"
              className="absolute top-14 right-3 z-[1100] w-84 max-w-[92vw] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-150 text-xs"
            >
              <div className="px-3.5 py-2.5 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span className="font-black text-xs">Quản Lý Lớp Bản Đồ Leaflet</span>
                </div>
                <button 
                  onClick={() => setShowLayerPanel(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 space-y-2 max-h-[420px] overflow-y-auto">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Bật / Tắt các Leaflet LayerGroup trên bản đồ:
                </div>
                {MAP_LAYERS.map((layer) => {
                  const isEnabled = !!enabledLayers[layer.id];
                  const count = layerCounts[layer.id] || 0;
                  return (
                    <div 
                      key={layer.id}
                      className={`p-2.5 rounded-xl border transition-all ${
                        isEnabled ? 'bg-slate-50 border-slate-200 shadow-2xs' : 'bg-slate-100/60 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label 
                          htmlFor={`inmap-switch-${layer.id}`}
                          className="flex items-center gap-2 cursor-pointer flex-1 select-none"
                        >
                          <input 
                            type="checkbox"
                            id={`inmap-switch-${layer.id}`}
                            checked={isEnabled}
                            onChange={() => handleToggleLayer(layer.id)}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <span className="text-base">{layer.icon}</span>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{layer.shortName}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${layer.badgeBg} text-white`}>
                                {count}
                              </span>
                            </div>
                          </div>
                        </label>

                        <button
                          onClick={(e) => handleIsolateLayer(layer.id, e)}
                          className="px-2 py-0.5 text-[10px] font-bold text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 cursor-pointer"
                          title="Chỉ hiển thị lớp này trên bản đồ"
                        >
                          Chỉ hiện
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 pl-6">
                        {layer.description}
                      </p>
                    </div>
                  );
                })}

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <button
                    onClick={handleEnableAllLayers}
                    className="text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                  >
                    Bật tất cả lớp
                  </button>
                  <button
                    onClick={() => {
                      const allOff: Record<string, boolean> = {};
                      MAP_LAYERS.forEach(l => { allOff[l.id] = false; });
                      setEnabledLayers(allOff);
                    }}
                    className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                  >
                    Tắt tất cả
                  </button>
                </div>
              </div>
            </div>
          )}

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

        {/* Quick Horizontal Strip of Current Tagged Points (Synchronized with visible Leaflet LayerGroups) */}
        <div id="quick-marker-strip" className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-900">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Danh sách thẻ vị trí hiển thị trên bản đồ ({visibleMarkers.length})</span>
            </span>
            <span className="text-[10px] text-slate-400">Nhấp vào thẻ để mở popup chi tiết và định vị trên bản đồ</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {visibleMarkers.length === 0 ? (
              <div className="py-2 text-[11px] text-slate-500 italic">
                Không có thẻ vị trí nào trong các lớp dữ liệu đang bật. Hãy bật thêm lớp dữ liệu ở trên.
              </div>
            ) : (
              visibleMarkers.map(m => (
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
              ))
            )}
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
                  onClick={() => handleGenerateIncidentPlaybook(selectedMarker)}
                  className="w-full sm:flex-1 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer border border-rose-500"
                >
                  <ShieldAlert className="w-4 h-4 text-amber-200" />
                  <span>Kịch Bản Tác Chiến 3 Mũi</span>
                </button>

                <button
                  type="button"
                  id="btn-popup-draft-directive"
                  onClick={() => handleDraftDirective(selectedMarker)}
                  className="w-full sm:flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Soạn Thảo Chỉ Đạo</span>
                </button>

                <button
                  type="button"
                  id="btn-popup-create-task"
                  onClick={() => handleCreateTaskFromMap(selectedMarker)}
                  className="w-full sm:flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-200 cursor-pointer"
                >
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                  <span>Tạo Nhiệm Vụ</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: AI 3-PILLAR INCIDENT RESPONSE PLAYBOOK */}
      {/* ========================================================================= */}
      {showPlaybookModal && playbookMarker && (
        <div className="fixed inset-0 z-[2600] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 md:p-5 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
            {/* Playbook Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-rose-950 via-slate-900 to-amber-950 text-white flex items-center justify-between gap-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <span>Kịch Bản Tác Chiến 3 Mũi & Dự Báo Nguy Cơ Cấp Ủy</span>
                    <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-400/30 text-[10px] font-bold rounded">
                      {playbookMarker.codeOrTitle}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Phối hợp đồng bộ: (1) Khối Vận/Chi bộ - (2) Công an Phường - (3) Chính quyền UBND
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPlaybookModal(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Playbook Body */}
            <div className="flex-1 bg-slate-50 p-4 md:p-6 overflow-y-auto space-y-4 text-xs">
              {isLoadingPlaybook ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-600">
                  <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
                  <p className="text-sm font-bold text-slate-800">AI đang đánh giá dữ liệu tọa độ, mức độ lan rộng & kích hoạt 3 mũi tác chiến...</p>
                  <p className="text-xs text-slate-400">Đang tạo Lệnh điều hành khẩn cấp của Bí thư Đảng ủy</p>
                </div>
              ) : playbookResult ? (
                <>
                  {/* Threat Level & Escalation Probability */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-1">
                      <div className="text-[10px] font-black text-slate-400 uppercase">Cấp độ đe dọa</div>
                      <div className="text-sm font-black text-rose-600 flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-rose-500" />
                        <span>{playbookResult.threatLevel}</span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-1">
                      <div className="text-[10px] font-black text-slate-400 uppercase">Xác suất leo thang</div>
                      <div className="text-sm font-black text-amber-600 flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-amber-500" />
                        <span>{playbookResult.escalationProbability}% Nguy cơ</span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-1">
                      <div className="text-[10px] font-black text-slate-400 uppercase">Vị trí điểm nóng</div>
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {playbookMarker.location}
                      </div>
                    </div>
                  </div>

                  {/* Predictive Risk Analysis */}
                  <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl text-rose-950 leading-relaxed space-y-1">
                    <div className="font-black text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>Dự Báo Nguy Cơ & Hệ Lụy Nếu Không Xử Lý Kịp Thời:</span>
                    </div>
                    <p className="font-medium text-xs">{playbookResult.predictiveAnalysis}</p>
                  </div>

                  {/* 3-Pillar Response Matrix */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-blue-600" />
                      <span>Ma Trận Tác Chiến Đồng Bộ 3 Mũi (Party - Police - Government)</span>
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Mũi 1: Khối Dân Vận & Chi Bộ */}
                      <div className="bg-white p-3.5 rounded-xl border border-purple-200 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between border-b border-purple-100 pb-1.5">
                          <span className="font-black text-purple-900 text-xs">Mũi 1: Khối Vận & Chi Bộ</span>
                          <Users className="w-3.5 h-3.5 text-purple-600" />
                        </div>
                        <div className="text-[11px] text-purple-950 font-bold">
                          Chỉ huy: {playbookResult.threePillarResponse.partyMassMobilization.leadOfficer}
                        </div>
                        <div className="text-[10px] text-purple-700 font-mono">
                          Thời gian: {playbookResult.threePillarResponse.partyMassMobilization.timeline}
                        </div>
                        <ul className="space-y-1 text-[11px] text-slate-700 list-disc list-inside">
                          {playbookResult.threePillarResponse.partyMassMobilization.immediateActions.map((act, i) => (
                            <li key={i}>{act}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Mũi 2: Công An Phường */}
                      <div className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between border-b border-rose-100 pb-1.5">
                          <span className="font-black text-rose-900 text-xs">Mũi 2: Công An Phường</span>
                          <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
                        </div>
                        <div className="text-[11px] text-rose-950 font-bold">
                          Chỉ huy: {playbookResult.threePillarResponse.policeSecurity.leadOfficer}
                        </div>
                        <div className="text-[10px] text-rose-700 font-mono">
                          Thời gian: {playbookResult.threePillarResponse.policeSecurity.timeline}
                        </div>
                        <ul className="space-y-1 text-[11px] text-slate-700 list-disc list-inside">
                          {playbookResult.threePillarResponse.policeSecurity.immediateActions.map((act, i) => (
                            <li key={i}>{act}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Mũi 3: Chính Quyền UBND */}
                      <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between border-b border-blue-100 pb-1.5">
                          <span className="font-black text-blue-900 text-xs">Mũi 3: Chính Quyền UBND</span>
                          <Building2 className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <div className="text-[11px] text-blue-950 font-bold">
                          Chỉ huy: {playbookResult.threePillarResponse.governmentAdministration.leadOfficer}
                        </div>
                        <div className="text-[10px] text-blue-700 font-mono">
                          Thời gian: {playbookResult.threePillarResponse.governmentAdministration.timeline}
                        </div>
                        <ul className="space-y-1 text-[11px] text-slate-700 list-disc list-inside">
                          {playbookResult.threePillarResponse.governmentAdministration.immediateActions.map((act, i) => (
                            <li key={i}>{act}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Executive Secretary Command Order */}
                  <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2 shadow-inner">
                    <div className="flex items-center justify-between">
                      <div className="font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5 text-xs">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span>Lệnh Chỉ Đạo Điều Hành Khẩn Cấp Của Bí Thư Đảng Ủy:</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(playbookResult.executiveSecretaryOrder);
                          setCopiedPlaybookText(playbookResult.executiveSecretaryOrder);
                          setTimeout(() => setCopiedPlaybookText(null), 2500);
                        }}
                        className="text-[11px] font-bold text-amber-200 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        {copiedPlaybookText ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedPlaybookText ? 'Đã chép lệnh' : 'Sao chép lệnh'}</span>
                      </button>
                    </div>

                    <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-slate-200 text-xs font-serif leading-relaxed italic whitespace-pre-line">
                      "{playbookResult.executiveSecretaryOrder}"
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Playbook Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
              <div className="text-xs text-slate-600 font-medium">
                Tích hợp chỉ đạo liên ngành Đảng ủy - Chính quyền - Lực lượng vũ trang
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleGenerateIncidentPlaybook(playbookMarker)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Loader2 className="w-3.5 h-3.5" />
                  <span>Phân tích lại</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (playbookResult) {
                      navigate('/directive', {
                        state: {
                          presetIdea: playbookResult.executiveSecretaryOrder,
                          location: playbookMarker.location
                        }
                      });
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Chuyển Sang Soạn Thảo Chỉ Đạo</span>
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
