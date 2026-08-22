import { useState, useMemo } from 'react';
import { 
  MapPin, Flame, AlertCircle, CheckCircle2, Activity, Filter, 
  Building2, Sparkles, Plus, ArrowRight, ExternalLink, RefreshCw, 
  Layers, Search, ShieldAlert, CheckSquare, FileText
} from 'lucide-react';
import { Link, useNavigate } from 'react-router';

export interface HotSpot {
  id: string;
  title: string;
  location: string;
  kp: string;
  category: 'Trật tự đô thị' | 'Môi trường' | 'An ninh trật tự' | 'Chuyển đổi số' | 'PCCC & An toàn';
  severity: 'Nóng' | 'Cảnh báo' | 'Bình thường';
  description: string;
  ideaTemplate: string;
  assignedUnit: string;
  x: string;
  y: string;
  lastUpdated: string;
}

export const WARD_HOT_SPOTS: HotSpot[] = [
  {
    id: 'spot-1',
    title: 'Lấn chiếm vỉa hè & lòng đường phố đi bộ Bạch Đằng',
    location: 'Chợ Thủ Dầu Một & Công viên Bạch Đằng, Phường Phú Cường',
    kp: 'Phường Phú Cường',
    category: 'Trật tự đô thị',
    severity: 'Nóng',
    description: 'Kinh doanh dịch vụ tự phát lấn chiếm lòng lề đường tuyến phố đi bộ Bạch Đằng và chợ Thủ Dầu Một gây mất mỹ quan đô thị và cản trở giao thông giờ cao điểm.',
    ideaTemplate: 'Giao Đội Trật tự Đô thị chủ trì phối hợp Công an Phường Phú Cường ra quân kiểm tra, xử lý dứt điểm tình trạng lấn chiếm vỉa hè tuyến phố Bạch Đằng và khu vực Chợ Thủ Dầu Một.',
    assignedUnit: 'Đội Trật tự Đô thị & Công an Phường Phú Cường',
    x: '32%',
    y: '52%',
    lastUpdated: '10 phút trước'
  },
  {
    id: 'spot-2',
    title: 'Khơi thông cống thoát nước & bảo vệ cảnh quan hẻm Bến Bạch Đằng',
    location: 'Hẻm 420 đường Nguyễn Tri Phương, Phường Chánh Nghĩa',
    kp: 'Phường Chánh Nghĩa',
    category: 'Môi trường',
    severity: 'Cảnh báo',
    description: 'Nước thải tồn đọng tắc nghẽn tuyến hẻm đô thị Chánh Nghĩa do rác thải sinh hoạt, ảnh hưởng vệ sinh môi trường khu vực ranh sông.',
    ideaTemplate: 'Giao Ủy ban nhân dân Phường Chánh Nghĩa phối hợp Mặt trận Tổ quốc ra quân nạo vét hệ thống thoát nước hẻm 420 Nguyễn Tri Phương, tuyên truyền người dân không xả rác bừa bãi.',
    assignedUnit: 'UBND & Mặt trận Tổ quốc Phường Chánh Nghĩa',
    x: '24%',
    y: '72%',
    lastUpdated: '25 phút trước'
  },
  {
    id: 'spot-3',
    title: 'An toàn PCCC & lối sạc xe điện dãy nhà trọ công nhân',
    location: 'Đường Lê Hồng Phong (Gần ĐH Thủ Dầu Một), Phường Phú Hòa',
    kp: 'Phường Phú Hòa',
    category: 'PCCC & An toàn',
    severity: 'Nóng',
    description: 'Khu vực tập trung đông sinh viên và công nhân trọ học, nhiều dãy nhà trọ chưa trang bị bình chữa cháy và lối thoát nạn thứ 2.',
    ideaTemplate: 'Yêu cầu Công an Phường Phú Hòa phối hợp Cảnh sát PCCC kiểm tra 100% các dãy nhà trọ công nhân đường Lê Hồng Phong, yêu cầu chủ trọ khắc phục ngay vi phạm an toàn PCCC.',
    assignedUnit: 'Công an Phường Phú Hòa & PCCC',
    x: '68%',
    y: '62%',
    lastUpdated: '15 phút trước'
  },
  {
    id: 'spot-4',
    title: 'Phân luồng giao thông & camera AI Ngã 6 Thủ Dầu Một',
    location: 'Vòng xoay Ngã 6 & Bưu điện, Phường Phú Cường - Hiệp Thành',
    kp: 'Phường Hiệp Thành',
    category: 'An ninh trật tự',
    severity: 'Cảnh báo',
    description: 'Tải lượng phương tiện tăng cao đột biến dịp cuối tuần tại Ngã 6 Thủ Dầu Một, xuất hiện tình trạng dồn ứ giao thông cục bộ.',
    ideaTemplate: 'Yêu cầu Công an Phường Hiệp Thành bố trí lực lượng phân luồng giờ cao điểm Ngã 6 Thủ Dầu Một, kết nối dữ liệu Camera AI giám sát an ninh trật tự.',
    assignedUnit: 'Công an Phường Hiệp Thành & Đội CSGT',
    x: '52%',
    y: '38%',
    lastUpdated: '1 giờ trước'
  },
  {
    id: 'spot-5',
    title: 'Trạm Kiosk Dịch vụ công QR & Wifi tốc độ cao miễn phí',
    location: 'Công viên Phú Cường & Trung tâm Một Cửa',
    kp: 'Phường Phú Cường',
    category: 'Chuyển đổi số',
    severity: 'Bình thường',
    description: 'Trang bị hạ tầng số Wifi công cộng và mã QR tra cứu hồ sơ thủ tục hành chính công trực tuyến phục vụ người dân và du khách.',
    ideaTemplate: 'Giao Tổ Chuyển đổi số Cộng đồng Phường Phú Cường duy trì vận hành Kiosk tra cứu mã QR và điểm Wifi công cộng tại khu vực Công viên Phú Cường.',
    assignedUnit: 'Tổ Chuyển đổi số Cộng đồng Phường Phú Cường',
    x: '42%',
    y: '30%',
    lastUpdated: '2 giờ trước'
  },
  {
    id: 'spot-6',
    title: 'Chỉnh trang hệ thống chiếu sáng & công viên cây xanh',
    location: 'Công viên Văn hóa Phú Lợi, Phường Phú Lợi',
    kp: 'Phường Phú Lợi',
    category: 'Môi trường',
    severity: 'Bình thường',
    description: 'Rà soát thay thế hệ thống đèn LED tiết kiệm điện và tỉa cành cây xanh phòng chống mưa bão khu vực công viên Phú Lợi.',
    ideaTemplate: 'Giao Bộ phận Đô thị Phường Phú Lợi phối hợp Đơn vị Chiếu sáng đô thị chỉnh trang công viên Phú Lợi đảm bảo mỹ quan và an toàn mùa mưa bão.',
    assignedUnit: 'Bộ phận Đô thị Phường Phú Lợi',
    x: '82%',
    y: '28%',
    lastUpdated: '30 phút trước'
  },
  {
    id: 'spot-7',
    title: 'Tuần tra an ninh trật tự khu đô thị & nhà ở công nhân',
    location: 'Tuyến đường Trần Ngọc Sương, Phường Định Hòa',
    kp: 'Phường Định Hòa',
    category: 'An ninh trật tự',
    severity: 'Cảnh báo',
    description: 'Tăng cường tuần tra đêm tại tuyến đường giáp ranh khu đô thị mới Định Hòa nhằm phòng ngừa trộm cắp và đua xe trái phép.',
    ideaTemplate: 'Yêu cầu Công an Phường Định Hòa tổ chức ca tuần tra mật phục phòng chống tội phạm, lập lại trật tự đô thị tuyến đường Trần Ngọc Sương.',
    assignedUnit: 'Công an Phường Định Hòa',
    x: '75%',
    y: '12%',
    lastUpdated: '45 phút trước'
  }
];

export default function DigitalMap() {
  const navigate = useNavigate();
  const [selectedSpot, setSelectedSpot] = useState<HotSpot | null>(WARD_HOT_SPOTS[0]);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const [mapType, setMapType] = useState<'ROADMAP' | 'SATELLITE' | 'TERRAIN'>('ROADMAP');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showTraffic, setShowTraffic] = useState<boolean>(true);

  const filteredSpots = useMemo(() => {
    return WARD_HOT_SPOTS.filter(spot => {
      if (categoryFilter !== 'ALL' && spot.category !== categoryFilter) return false;
      if (severityFilter !== 'ALL' && spot.severity !== severityFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          spot.title.toLowerCase().includes(term) ||
          spot.location.toLowerCase().includes(term) ||
          spot.kp.toLowerCase().includes(term) ||
          spot.description.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [categoryFilter, severityFilter, searchTerm]);

  const stats = useMemo(() => {
    const hotCount = WARD_HOT_SPOTS.filter(s => s.severity === 'Nóng').length;
    const warningCount = WARD_HOT_SPOTS.filter(s => s.severity === 'Cảnh báo').length;
    const normalCount = WARD_HOT_SPOTS.filter(s => s.severity === 'Bình thường').length;
    return { total: WARD_HOT_SPOTS.length, hotCount, warningCount, normalCount };
  }, []);

  const handleDraftDirective = (spot: HotSpot) => {
    navigate('/directive', { state: { presetIdea: spot.ideaTemplate, location: spot.location } });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 font-sans">
      {/* Top Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-2xl border border-blue-800/60 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              Google Maps GIS Số
            </span>
            <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 border border-blue-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Activity className="w-3 h-3 text-blue-300" />
              Thủ Dầu Một • Phường Phú Cường
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <MapPin className="w-6 h-6 text-red-500 animate-bounce" />
            <span>Bản Đồ Địa Bàn Google Maps & Điểm Nóng Chỉ Đạo</span>
          </h1>
          <p className="text-xs md:text-sm text-slate-200 max-w-2xl leading-relaxed font-medium">
            Giao diện bản đồ tương tác chuẩn Google Maps. Giám sát không gian địa bàn, giao thông, các điểm nóng phản ánh để kịp thời ban hành chỉ thị điều hành.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10 self-start md:self-center">
          <Link
            to="/directive"
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-500/30 active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Tạo Tham mưu Chỉ đạo</span>
          </Link>
          <Link
            to="/tasks"
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md active:scale-95"
          >
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <span>Theo dõi Nhiệm vụ</span>
          </Link>
        </div>
      </div>

      {/* Filter Bar & Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Search & Category Filter (8/12) */}
        <div className="lg:col-span-8 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm vị trí Google Maps, khu phố, điểm phản ánh..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 font-semibold placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-800 font-bold cursor-pointer"
            >
              <option value="ALL">Tất cả lĩnh vực</option>
              <option value="Trật tự đô thị">Trật tự đô thị</option>
              <option value="Môi trường">Môi trường</option>
              <option value="An ninh trật tự">An ninh trật tự</option>
              <option value="Chuyển đổi số">Chuyển đổi số</option>
              <option value="PCCC & An toàn">PCCC & An toàn</option>
            </select>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-800 font-bold cursor-pointer"
            >
              <option value="ALL">Tất cả mức độ</option>
              <option value="Nóng">🔴 Nóng ({stats.hotCount})</option>
              <option value="Cảnh báo">🟠 Cảnh báo ({stats.warningCount})</option>
              <option value="Bình thường">🔵 Bình thường ({stats.normalCount})</option>
            </select>
          </div>
        </div>

        {/* Status Counter Badges (4/12) */}
        <div className="lg:col-span-4 bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 flex items-center justify-around shadow-sm text-xs font-bold">
          <button 
            onClick={() => { setSeverityFilter('Nóng'); setCategoryFilter('ALL'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${severityFilter === 'Nóng' ? 'bg-red-500/30 text-red-300 ring-1 ring-red-500' : 'hover:bg-slate-800 text-red-400'}`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
            <span>Nóng: <strong>{stats.hotCount}</strong></span>
          </button>

          <button 
            onClick={() => { setSeverityFilter('Cảnh báo'); setCategoryFilter('ALL'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${severityFilter === 'Cảnh báo' ? 'bg-amber-500/30 text-amber-300 ring-1 ring-amber-500' : 'hover:bg-slate-800 text-amber-400'}`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span>Cảnh báo: <strong>{stats.warningCount}</strong></span>
          </button>

          <button 
            onClick={() => { setSeverityFilter('ALL'); setCategoryFilter('ALL'); setSearchTerm(''); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${severityFilter === 'ALL' && categoryFilter === 'ALL' ? 'bg-blue-500/30 text-blue-300 ring-1 ring-blue-500' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Tất cả: <strong>{stats.total}</strong></span>
          </button>
        </div>
      </div>

      {/* Main Interactive Map & Details Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Authentic Google Maps Canvas Container (8/12) */}
        <div className="lg:col-span-8 rounded-3xl border border-slate-300/80 shadow-2xl relative min-h-[500px] md:min-h-[560px] overflow-hidden flex flex-col justify-between bg-[#f3f2ee] select-none transition-all">
          
          {/* Top Floating Google Maps Controls Bar */}
          <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between gap-2 pointer-events-none">
            
            {/* Map Type Switcher Tabs (Google Maps Style) */}
            <div className="pointer-events-auto bg-white/95 backdrop-blur-md p-1 rounded-2xl shadow-md border border-slate-200/80 flex items-center gap-1 text-xs font-bold">
              <button
                onClick={() => setMapType('ROADMAP')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  mapType === 'ROADMAP'
                    ? 'bg-blue-600 text-white shadow-2xs font-extrabold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Bản đồ</span>
              </button>

              <button
                onClick={() => setMapType('SATELLITE')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  mapType === 'SATELLITE'
                    ? 'bg-blue-900 text-white shadow-2xs font-extrabold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Vệ tinh</span>
              </button>

              <button
                onClick={() => setMapType('TERRAIN')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  mapType === 'TERRAIN'
                    ? 'bg-amber-700 text-white shadow-2xs font-extrabold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Địa hình</span>
              </button>
            </div>

            {/* Google Logo Badge */}
            <div className="pointer-events-auto bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-md border border-slate-200/80 flex items-center gap-1.5">
              <span className="text-xs font-black tracking-tight text-slate-800">
                <span className="text-blue-600">G</span>
                <span className="text-red-500">o</span>
                <span className="text-amber-500">o</span>
                <span className="text-blue-600">g</span>
                <span className="text-emerald-600">l</span>
                <span className="text-red-500">e</span>
              </span>
              <span className="text-[11px] font-bold text-slate-600">Maps</span>
            </div>
          </div>

          {/* Right Side Zoom & Compass Controls */}
          <div className="absolute top-16 right-3 z-30 flex flex-col items-center gap-2 pointer-events-auto">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-md border border-slate-200/80 flex flex-col overflow-hidden text-slate-800">
              <button
                onClick={() => setZoomLevel(prev => Math.min(prev + 0.2, 1.8))}
                className="p-2.5 hover:bg-slate-100 active:bg-slate-200 transition-colors border-b border-slate-100 font-black text-sm cursor-pointer"
                title="Phóng to"
              >
                +
              </button>
              <button
                onClick={() => setZoomLevel(prev => Math.max(prev - 0.2, 0.8))}
                className="p-2.5 hover:bg-slate-100 active:bg-slate-200 transition-colors font-black text-sm cursor-pointer"
                title="Thu nhỏ"
              >
                −
              </button>
            </div>

            <button
              onClick={() => { setZoomLevel(1); setSelectedSpot(WARD_HOT_SPOTS[0]); }}
              className="p-2.5 bg-white/95 backdrop-blur-md rounded-2xl shadow-md border border-slate-200/80 hover:bg-slate-100 text-blue-600 font-bold text-xs cursor-pointer"
              title="Đặt lại góc nhìn Google Maps"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowTraffic(prev => !prev)}
              className={`p-2.5 backdrop-blur-md rounded-2xl shadow-md border transition-all cursor-pointer ${
                showTraffic 
                  ? 'bg-emerald-600 text-white border-emerald-500' 
                  : 'bg-white/95 text-slate-700 border-slate-200/80 hover:bg-slate-100'
              }`}
              title="Bật/Tắt Lớp Giao thông Google Traffic"
            >
              <Activity className="w-4 h-4" />
            </button>
          </div>

          {/* SVG Vector Map Ground with Google Maps Color Palette */}
          <div 
            className="absolute inset-0 transition-transform duration-300 ease-out"
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
          >
            {/* Background Canvas depend on mapType */}
            {mapType === 'ROADMAP' && (
              <div className="absolute inset-0 bg-[#f3f2ee]">
                {/* Land texture grid lines */}
                <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#d5d3ce_1px,transparent_1px),linear-gradient(to_bottom,#d5d3ce_1px,transparent_1px)] bg-[size:32px_32px]"></div>
              </div>
            )}

            {mapType === 'SATELLITE' && (
              <div className="absolute inset-0 bg-[#0b192c]">
                {/* Dark Satellite Imagery Background Overlay */}
                <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#1e3a5f_1px,transparent_1px)] bg-[size:16px_16px]"></div>
              </div>
            )}

            {mapType === 'TERRAIN' && (
              <div className="absolute inset-0 bg-[#e8e3d5]">
                {/* Contour Lines Texture */}
                <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#c2b8a3_2px,transparent_2px)] bg-[size:24px_24px]"></div>
              </div>
            )}

            {/* Google Maps Styled SVG Roads & Waterways */}
            <svg viewBox="0 0 800 500" className="absolute inset-0 w-full h-full" fill="none">
              
              {/* Parks & Greenery Areas (Google Maps Green #d2f0d0 or Dark Emerald) */}
              <path 
                d="M 220 200 Q 280 180 340 220 T 300 320 Q 240 330 200 280 Z" 
                fill={mapType === 'SATELLITE' ? '#064e3b' : mapType === 'TERRAIN' ? '#bbf7d0' : '#ccebc5'} 
                fillOpacity={mapType === 'SATELLITE' ? '0.7' : '0.85'}
              />
              <path 
                d="M 620 180 Q 720 170 760 240 T 680 310 Q 610 290 600 220 Z" 
                fill={mapType === 'SATELLITE' ? '#064e3b' : mapType === 'TERRAIN' ? '#bbf7d0' : '#ccebc5'} 
                fillOpacity={mapType === 'SATELLITE' ? '0.7' : '0.85'}
              />

              {/* Waterways - Sông Sài Gòn & Kênh Rạch (Google Maps Water Blue #aadaff or Deep Blue) */}
              <path 
                d="M 30 280 Q 180 250 280 380 T 480 490" 
                stroke={mapType === 'SATELLITE' ? '#0284c7' : '#aadaff'} 
                strokeWidth="28" 
                strokeLinecap="round" 
              />
              <path 
                d="M 30 280 Q 180 250 280 380 T 480 490" 
                stroke={mapType === 'SATELLITE' ? '#38bdf8' : '#7fcdff'} 
                strokeWidth="4" 
                fill="none" 
              />

              {/* Secondary Local Street Network (White roads) */}
              <path d="M 60 120 L 750 120" stroke={mapType === 'SATELLITE' ? '#334155' : '#ffffff'} strokeWidth="8" />
              <path d="M 120 400 Q 350 350 480 390 T 780 320" stroke={mapType === 'SATELLITE' ? '#334155' : '#ffffff'} strokeWidth="8" />
              <path d="M 180 60 L 180 450" stroke={mapType === 'SATELLITE' ? '#334155' : '#ffffff'} strokeWidth="6" />
              <path d="M 420 50 L 420 450" stroke={mapType === 'SATELLITE' ? '#334155' : '#ffffff'} strokeWidth="6" />
              <path d="M 640 50 L 640 450" stroke={mapType === 'SATELLITE' ? '#334155' : '#ffffff'} strokeWidth="6" />

              {/* Main Arterial Highways & Boulevards (Google Maps Yellow #fef0cd with #fbe7b2 border) */}
              {/* Route 1: Đại lộ Bình Dương / Nguyễn Tri Phương */}
              <path 
                d="M 50 160 Q 250 90 400 130 T 760 70" 
                stroke={mapType === 'SATELLITE' ? '#f59e0b' : '#f5d082'} 
                strokeWidth="12" 
              />
              <path 
                d="M 50 160 Q 250 90 400 130 T 760 70" 
                stroke={mapType === 'SATELLITE' ? '#fbbf24' : '#ffea9f'} 
                strokeWidth="8" 
              />

              {/* Route 2: Phố đi bộ Bến Bạch Đằng & Lê Hồng Phong */}
              <path 
                d="M 300 20 Q 320 240 280 480" 
                stroke={mapType === 'SATELLITE' ? '#f59e0b' : '#f5d082'} 
                strokeWidth="10" 
              />
              <path 
                d="M 300 20 Q 320 240 280 480" 
                stroke={mapType === 'SATELLITE' ? '#fbbf24' : '#ffea9f'} 
                strokeWidth="6" 
              />

              {/* Traffic Flow Overlay Lines (if enabled) */}
              {showTraffic && (
                <>
                  <path d="M 60 120 L 300 120" stroke="#22c55e" strokeWidth="3" strokeDasharray="8 4" />
                  <path d="M 300 120 L 500 120" stroke="#ef4444" strokeWidth="4" />
                  <path d="M 500 120 L 750 120" stroke="#eab308" strokeWidth="3.5" />
                  <path d="M 50 160 Q 250 90 400 130" stroke="#22c55e" strokeWidth="3" />
                  <path d="M 400 130 T 760 70" stroke="#ef4444" strokeWidth="4" />
                </>
              )}

              {/* Google Maps Style POI & Ward Labels */}
              <g fontFamily="system-ui, -apple-system, sans-serif" fontWeight="700">
                {/* Water Label */}
                <text x="70" y="295" fill={mapType === 'SATELLITE' ? '#38bdf8' : '#1a73e8'} fontSize="11" fontStyle="italic">
                  Sông Sài Gòn (Bến Bạch Đằng)
                </text>

                {/* Ward Administrative Labels */}
                <text x="240" y="210" fill={mapType === 'SATELLITE' ? '#e2e8f0' : '#3c4043'} fontSize="12" stroke="#ffffff" strokeWidth="3" paintOrder="stroke">
                  Phường Phú Cường
                </text>
                <text x="110" y="350" fill={mapType === 'SATELLITE' ? '#e2e8f0' : '#3c4043'} fontSize="12" stroke="#ffffff" strokeWidth="3" paintOrder="stroke">
                  Phường Chánh Nghĩa
                </text>
                <text x="440" y="150" fill={mapType === 'SATELLITE' ? '#e2e8f0' : '#3c4043'} fontSize="12" stroke="#ffffff" strokeWidth="3" paintOrder="stroke">
                  Phường Hiệp Thành
                </text>
                <text x="560" y="320" fill={mapType === 'SATELLITE' ? '#e2e8f0' : '#3c4043'} fontSize="12" stroke="#ffffff" strokeWidth="3" paintOrder="stroke">
                  Phường Phú Hòa
                </text>
                <text x="680" y="150" fill={mapType === 'SATELLITE' ? '#e2e8f0' : '#3c4043'} fontSize="12" stroke="#ffffff" strokeWidth="3" paintOrder="stroke">
                  Phường Phú Lợi
                </text>
                <text x="600" y="45" fill={mapType === 'SATELLITE' ? '#e2e8f0' : '#3c4043'} fontSize="12" stroke="#ffffff" strokeWidth="3" paintOrder="stroke">
                  Phường Định Hòa
                </text>

                {/* Major Landmark Labels */}
                <text x="350" y="270" fill="#1e293b" fontSize="10" stroke="#ffffff" strokeWidth="2" paintOrder="stroke">
                  🏛️ Chợ Thủ Dầu Một
                </text>
                <text x="490" y="220" fill="#1e293b" fontSize="10" stroke="#ffffff" strokeWidth="2" paintOrder="stroke">
                  ⭕ Ngã 6 Thủ Dầu Một
                </text>
              </g>
            </svg>

            {/* Hot Spot Google Maps Pin Markers & InfoWindows */}
            <div className="absolute inset-0 pointer-events-none">
              {filteredSpots.map((spot) => {
                const isSelected = selectedSpot?.id === spot.id;
                const pinBgColor = spot.severity === 'Nóng' 
                  ? '#ea4335' // Google Red
                  : spot.severity === 'Cảnh báo' 
                    ? '#f9ab00' // Google Amber/Yellow
                    : '#1a73e8'; // Google Blue

                return (
                  <div
                    key={spot.id}
                    style={{ left: spot.x, top: spot.y }}
                    className="absolute -translate-x-1/2 -translate-y-full pointer-events-auto z-20"
                  >
                    {/* Iconic Teardrop Google Maps Pin Marker */}
                    <button
                      onClick={() => setSelectedSpot(spot)}
                      className={`group relative focus:outline-none transition-transform cursor-pointer ${
                        isSelected ? 'scale-125 z-40' : 'hover:scale-110'
                      }`}
                    >
                      {/* Pulse ring for high severity pins */}
                      {spot.severity === 'Nóng' && (
                        <span 
                          className="absolute -inset-2 rounded-full opacity-60 animate-ping"
                          style={{ backgroundColor: pinBgColor }}
                        ></span>
                      )}

                      {/* Google Maps Pin SVG */}
                      <svg width="32" height="42" viewBox="0 0 32 42" fill="none" className="drop-shadow-lg">
                        <path 
                          d="M16 0C7.163 0 0 7.163 0 16c0 12 16 26 16 26s16-14 16-26c0-8.837-7.163-16-16-16z" 
                          fill={pinBgColor}
                          stroke="#ffffff"
                          strokeWidth="2"
                        />
                        <circle cx="16" cy="16" r="6" fill="#ffffff" />
                        {spot.severity === 'Nóng' && (
                          <circle cx="16" cy="16" r="3" fill="#ea4335" />
                        )}
                      </svg>
                    </button>

                    {/* Google Maps Floating InfoWindow Card (Appears when selected) */}
                    {isSelected && (
                      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-64 bg-white rounded-2xl p-3 shadow-2xl border border-slate-200/90 text-slate-900 z-50 animate-in fade-in zoom-in duration-150">
                        <div className="flex items-start justify-between gap-1 pb-1.5 border-b border-slate-100">
                          <div className="text-[10px] font-black uppercase text-blue-600 tracking-wider">
                            {spot.kp}
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                            spot.severity === 'Nóng'
                              ? 'bg-red-100 text-red-800'
                              : spot.severity === 'Cảnh báo'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-blue-100 text-blue-800'
                          }`}>
                            {spot.severity}
                          </span>
                        </div>

                        <h4 className="font-bold text-xs text-slate-900 mt-1 line-clamp-2 leading-tight">
                          {spot.title}
                        </h4>

                        <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                          <MapPin className="w-3 h-3 text-red-500 flex-shrink-0" />
                          <span className="truncate">{spot.location}</span>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <span className="text-[9px] text-slate-400 font-medium">{spot.lastUpdated}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDraftDirective(spot);
                            }}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-extrabold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                          >
                            <span>Tham mưu</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </button>
                        </div>

                        {/* Tip Pointer Arrow */}
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45 border-r border-b border-slate-200/90"></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Authentic Google Maps Footer Copyright Bar */}
          <div className="relative z-30 bg-white/90 backdrop-blur-md px-3 py-1.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between text-[10px] text-slate-500 font-medium">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">Google Maps GIS</span>
              <span>• Phường Phú Cường, Thành phố Thủ Dầu Một</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[9px]">
              <span>Dữ liệu bản đồ ©2026 Google</span>
              <span>• Điều khoản sử dụng</span>
              <span>• Báo lỗi bản đồ</span>
            </div>
          </div>
        </div>

        {/* Selected Spot Details & Action Card (4/12) */}
        <div className="lg:col-span-4 space-y-4 flex flex-col justify-between">
          {selectedSpot ? (
            <div className="bg-gradient-to-b from-blue-900 to-indigo-950 text-slate-100 rounded-3xl p-6 border border-blue-800/80 shadow-xl flex-1 flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                {/* Header Status */}
                <div className="flex items-center justify-between pb-3 border-b border-blue-800/80">
                  <span className="text-[11px] font-black uppercase tracking-wider text-blue-300">
                    {selectedSpot.kp} • {selectedSpot.category}
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                    selectedSpot.severity === 'Nóng' 
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse' 
                      : selectedSpot.severity === 'Cảnh báo'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  }`}>
                    {selectedSpot.severity === 'Nóng' && <Flame className="w-3 h-3 text-red-300" />}
                    <span>Mức độ: {selectedSpot.severity}</span>
                  </span>
                </div>

                {/* Spot Title & Location */}
                <div className="space-y-1.5">
                  <h3 className="text-base font-black text-white leading-snug">
                    {selectedSpot.title}
                  </h3>
                  <div className="text-xs text-blue-200/80 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                    <span className="font-medium text-blue-100">{selectedSpot.location}</span>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-blue-300/80 uppercase tracking-wider">Nội dung phản ánh địa bàn</div>
                  <p className="text-xs text-blue-50 leading-relaxed bg-blue-950/80 p-3.5 rounded-xl border border-blue-800/80">
                    {selectedSpot.description}
                  </p>
                </div>

                {/* Assigned Unit */}
                <div className="p-3 bg-blue-950/80 border border-blue-700/60 rounded-xl space-y-1">
                  <div className="text-[10px] font-bold text-blue-300 uppercase tracking-wider flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-blue-300" />
                    <span>Đơn vị chịu trách nhiệm xử lý</span>
                  </div>
                  <div className="text-xs font-bold text-white">{selectedSpot.assignedUnit}</div>
                </div>

                {/* Idea Template Preview */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-blue-300/80 uppercase tracking-wider">Khung dự thảo chỉ đạo đề xuất</div>
                  <p className="text-xs text-blue-100/90 italic leading-relaxed bg-blue-950/60 p-3 rounded-xl border border-blue-800/60 font-medium">
                    "{selectedSpot.ideaTemplate}"
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-blue-800/80 space-y-2">
                <button
                  onClick={() => handleDraftDirective(selectedSpot)}
                  className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40 active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Nạp vào Trợ lý Soạn thảo Chỉ đạo</span>
                </button>

                <Link
                  to="/tasks"
                  className="w-full py-2 bg-blue-800/80 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-blue-600/60"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Xem tiến độ trên bảng đôn đốc</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-b from-blue-900 to-indigo-950 text-slate-100 rounded-3xl p-8 border border-blue-800/80 text-center flex-1 flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-800/80 border border-blue-600/60 flex items-center justify-center text-blue-300">
                <MapPin className="w-6 h-6" />
              </div>
              <p className="text-xs text-blue-200/80">Nhấp chọn bất kỳ điểm nóng nào trên bản đồ để xem chi tiết.</p>
            </div>
          )}
        </div>
      </div>

      {/* List Table of Hot Spots */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-blue-600" />
              <span>Danh Sách Điểm Nóng & Vấn Đề Địa Bàn Đang Giám Sát</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Tổng hợp từ phản ánh nhân dân, khảo sát thực tế và báo cáo khu phố</p>
          </div>
          <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">
            {filteredSpots.length} địa điểm
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="p-4 pl-6">Mức độ</th>
                <th className="p-4">Địa điểm & Khu phố</th>
                <th className="p-4">Vấn đề phản ánh</th>
                <th className="p-4">Lĩnh vực</th>
                <th className="p-4">Đơn vị chủ trì</th>
                <th className="p-4 pr-6 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredSpots.map((spot) => (
                <tr 
                  key={spot.id} 
                  onClick={() => setSelectedSpot(spot)}
                  className={`hover:bg-blue-50/40 cursor-pointer transition-colors ${selectedSpot?.id === spot.id ? 'bg-blue-50/60 font-semibold' : ''}`}
                >
                  <td className="p-4 pl-6 whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase ${
                      spot.severity === 'Nóng'
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : spot.severity === 'Cảnh báo'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}>
                      {spot.severity}
                    </span>
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <div className="font-bold text-slate-900">{spot.location}</div>
                    <div className="text-[11px] text-blue-600 font-medium">{spot.kp}</div>
                  </td>
                  <td className="p-4 max-w-xs">
                    <div className="font-bold text-slate-800 line-clamp-1">{spot.title}</div>
                    <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{spot.description}</div>
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px]">
                      {spot.category}
                    </span>
                  </td>
                  <td className="p-4 whitespace-nowrap text-slate-700 font-medium">
                    {spot.assignedUnit}
                  </td>
                  <td className="p-4 pr-6 text-right whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDraftDirective(spot);
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs inline-flex items-center gap-1"
                    >
                      <span>Tham mưu</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredSpots.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Không tìm thấy điểm nóng phù hợp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
