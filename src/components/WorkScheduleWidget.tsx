import { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, Clock, MapPin, Users, Building2, Sparkles, 
  ChevronRight, Plus, CheckCircle2, AlertCircle, Filter, Tag,
  UserCheck, ShieldAlert
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate } from 'react-router';

export interface ScheduleEvent {
  id?: string;
  title: string;
  date: string; // YYYY-MM-DD or DD/MM/YYYY
  time: string; // e.g., '08:00' or '14:00'
  session: 'MORNING' | 'AFTERNOON' | 'EVENING';
  chairPerson: string; // e.g. Bí thư Đảng ủy, Phó Bí thư Thường trực
  attendees: string; // e.g. Ban Thường vụ, UBND phường
  location: string; // e.g. Phòng họp A, Hội trường UBND
  preparingUnit: string; // e.g. Văn phòng Đảng ủy
  isImportant?: boolean;
  isStandingBoard?: boolean; // Lịch Thường trực
  status?: 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED';
  createdAt?: any;
}

// Initial sample events for seed if DB is empty
const INITIAL_SCHEDULE_EVENTS: Omit<ScheduleEvent, 'id'>[] = [
  {
    title: 'Hội nghị Giao ban Thường trực Đảng ủy định kỳ tuần 35',
    date: '2026-08-25',
    time: '08:00',
    session: 'MORNING',
    chairPerson: 'Bí thư Đảng ủy',
    attendees: 'Thường trực Đảng ủy, HĐND, UBND, Chánh VP',
    location: 'Phòng họp Thường trực Đảng ủy',
    preparingUnit: 'Văn phòng Đảng ủy',
    isImportant: true,
    isStandingBoard: true,
    status: 'IN_PROGRESS'
  },
  {
    title: 'Dự lễ kỷ niệm & Duyệt nội dung chuẩn bị Đại hội Chi bộ nòng cốt',
    date: '2026-08-25',
    time: '14:00',
    session: 'AFTERNOON',
    chairPerson: 'Phó Bí thư Thường trực',
    attendees: 'BTV Đảng ủy, Trưởng các Đoàn thể',
    location: 'Hội trường Tầng 3 UBND phường',
    preparingUnit: 'Ban Tổ chức Đảng ủy',
    isImportant: true,
    isStandingBoard: true,
    status: 'UPCOMING'
  },
  {
    title: 'Kiểm tra thực địa công tác PCCC & ANTT tại các Khu phố trọng điểm',
    date: '2026-08-26',
    time: '08:30',
    session: 'MORNING',
    chairPerson: 'Chủ tịch UBND phường',
    attendees: 'Công an phường, Đội PCCC, Trưởng Khu phố 1, 2, 3',
    location: 'Địa bàn Khu phố 1 & Khu phố 3',
    preparingUnit: 'Công an phường & VP UBND',
    isImportant: false,
    isStandingBoard: false,
    status: 'UPCOMING'
  },
  {
    title: 'Họp tham mưu rà soát thủ tục cải cách hành chính 1 cửa cấp ủy',
    date: '2026-08-27',
    time: '09:00',
    session: 'MORNING',
    chairPerson: 'Chánh Văn phòng Đảng ủy',
    attendees: 'Chuyên viên Văn phòng, Cán bộ CNTT',
    location: 'Phòng làm việc Văn phòng',
    preparingUnit: 'Văn phòng Đảng ủy',
    isImportant: false,
    isStandingBoard: false,
    status: 'UPCOMING'
  },
  {
    title: 'Đối thoại trực tiếp giữa Bí thư Đảng ủy với nhân dân khu dân cư',
    date: '2026-08-28',
    time: '14:30',
    session: 'AFTERNOON',
    chairPerson: 'Bí thư Đảng ủy',
    attendees: 'Thường trực Đảng ủy, UB MTTQ, Đại diện nhân dân',
    location: 'Trung tâm Học tập Cộng đồng',
    preparingUnit: 'Khối Dân vận & UB MTTQ',
    isImportant: true,
    isStandingBoard: true,
    status: 'UPCOMING'
  }
];

export default function WorkScheduleWidget() {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'ALL' | 'IMPORTANT' | 'STANDING'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  // Form state
  const [newEvent, setNewEvent] = useState<Omit<ScheduleEvent, 'id'>>({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '08:00',
    session: 'MORNING',
    chairPerson: 'Bí thư Đảng ủy',
    attendees: 'Thường trực Đảng ủy, UBND phường',
    location: 'Phòng họp Thường trực',
    preparingUnit: 'Văn phòng Đảng ủy',
    isImportant: true,
    isStandingBoard: true,
    status: 'UPCOMING'
  });

  // Realtime Firestore subscription
  useEffect(() => {
    const q = query(collection(db, 'schedules'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleEvent));
      
      // Seed initial data if empty
      if (docs.length === 0 && snapshot.empty) {
        INITIAL_SCHEDULE_EVENTS.forEach(async (ev) => {
          try {
            await addDoc(collection(db, 'schedules'), {
              ...ev,
              createdAt: serverTimestamp()
            });
          } catch (e) {
            console.error("Error seeding schedule data:", e);
          }
        });
      } else {
        setEvents(docs);
      }
      setLoading(false);
    }, (err) => {
      console.error("Firestore schedule sync error:", err);
      // Fallback to initial events if error
      setEvents(INITIAL_SCHEDULE_EVENTS.map((e, idx) => ({ id: `init-${idx}`, ...e })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredEvents = useMemo(() => {
    let list = events;
    if (selectedTab === 'IMPORTANT') {
      list = list.filter(e => e.isImportant);
    } else if (selectedTab === 'STANDING') {
      list = list.filter(e => e.isStandingBoard);
    }
    return list;
  }, [events, selectedTab]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'schedules'), {
        ...newEvent,
        createdAt: serverTimestamp()
      });
      setShowAddModal(false);
      setNewEvent({
        title: '',
        date: new Date().toISOString().split('T')[0],
        time: '08:00',
        session: 'MORNING',
        chairPerson: 'Bí thư Đảng ủy',
        attendees: 'Thường trực Đảng ủy, UBND phường',
        location: 'Phòng họp Thường trực',
        preparingUnit: 'Văn phòng Đảng ủy',
        isImportant: true,
        isStandingBoard: true,
        status: 'UPCOMING'
      });
    } catch (err) {
      console.error("Lỗi khi thêm sự kiện lịch công tác:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (item: ScheduleEvent) => {
    if (!item.id) return;
    const nextStatus = item.status === 'COMPLETED' ? 'UPCOMING' : 'COMPLETED';
    try {
      if (item.id.startsWith('init-')) {
        setEvents(prev => prev.map(ev => ev.id === item.id ? { ...ev, status: nextStatus } : ev));
      } else {
        await updateDoc(doc(db, 'schedules', item.id), { status: nextStatus });
      }
    } catch (err) {
      console.error("Lỗi cập nhật trạng thái lịch:", err);
    }
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        return `${days[d.getDay()]}, ${parts[2]}/${parts[1]}`;
      }
    } catch (e) {
      // ignore
    }
    return dateStr;
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-blue-700 to-indigo-800 text-white rounded-2xl flex items-center justify-center shadow-md flex-shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-900 uppercase tracking-wide">
                Lịch Công Tác Trong Tuần
              </h3>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold rounded-md">
                Đồng bộ CSDL
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tổng hợp sự kiện chỉ đạo, cuộc họp Thường trực & công tác cơ quan trong tuần
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm sự kiện mới</span>
          </button>
          <button
            onClick={() => navigate('/ai-assistant')}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            title="Tạo lịch công tác tuần bằng AI"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Lập Lịch AI</span>
          </button>
        </div>
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-50 p-1.5 rounded-2xl border border-slate-200/80">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSelectedTab('ALL')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              selectedTab === 'ALL'
                ? 'bg-white text-blue-900 shadow-2xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả sự kiện ({events.length})
          </button>
          <button
            onClick={() => setSelectedTab('STANDING')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedTab === 'STANDING'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-indigo-700'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Lịch Thường trực ({events.filter(e => e.isStandingBoard).length})</span>
          </button>
          <button
            onClick={() => setSelectedTab('IMPORTANT')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedTab === 'IMPORTANT'
                ? 'bg-amber-500 text-white shadow-2xs'
                : 'text-slate-600 hover:text-amber-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Trọng tâm ({events.filter(e => e.isImportant).length})</span>
          </button>
        </div>

        <div className="text-[11px] font-medium text-slate-400 px-2 hidden md:block">
          Tuần 35 / Năm 2026
        </div>
      </div>

      {/* Events List */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400 space-y-2">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p>Đang tải dữ liệu Lịch công tác từ cơ sở dữ liệu...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="py-10 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 space-y-2">
          <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-bold text-slate-600">Không có sự kiện lịch công tác nào trong danh mục đã chọn.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="text-xs text-blue-600 font-bold hover:underline"
          >
            + Nhấn để tạo lịch mới ngay
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((item, index) => {
            const isDone = item.status === 'COMPLETED';
            return (
              <div
                key={item.id || index}
                className={`p-4 rounded-2xl border transition-all ${
                  isDone 
                    ? 'bg-slate-50 border-slate-200 opacity-75'
                    : item.isStandingBoard
                    ? 'bg-indigo-50/40 border-indigo-200/80 hover:border-indigo-300 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-2xs'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  {/* Left: Time & Date Badge */}
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      onClick={() => handleToggleStatus(item)}
                      className={`w-5 h-5 rounded-lg border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all cursor-pointer ${
                        isDone 
                          ? 'bg-emerald-600 border-emerald-600 text-white' 
                          : 'border-slate-300 hover:border-blue-500 bg-white'
                      }`}
                      title={isDone ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu đã hoàn thành'}
                    >
                      {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>

                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-blue-900 text-white text-[10px] font-black rounded-md flex items-center gap-1">
                          <Clock className="w-3 h-3 text-blue-300" />
                          {item.time} - {formatDateLabel(item.date)}
                        </span>

                        <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-md uppercase ${
                          item.session === 'MORNING' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}>
                          {item.session === 'MORNING' ? 'Sáng' : 'Chiều'}
                        </span>

                        {item.isStandingBoard && (
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-bold rounded-md flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3 text-indigo-600" />
                            Lịch Thường trực
                          </span>
                        )}

                        {item.isImportant && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-md flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            Trọng tâm
                          </span>
                        )}

                        {isDone && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md">
                            Đã hoàn thành
                          </span>
                        )}
                      </div>

                      <h4 className={`text-sm font-bold text-slate-900 leading-snug ${isDone ? 'line-through text-slate-500' : ''}`}>
                        {item.title}
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-slate-600 pt-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <UserCheck className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                          <span>Chủ trì: <strong className="text-slate-800">{item.chairPerson}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                          <MapPin className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                          <span>Đ.Điểm: <strong className="text-slate-800">{item.location}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                          <Building2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          <span>ĐV chuẩn bị: <strong className="text-slate-800">{item.preparingUnit}</strong></span>
                        </div>
                      </div>

                      {item.attendees && (
                        <div className="text-[11px] text-slate-500 flex items-start gap-1 pt-0.5">
                          <Users className="w-3 h-3 text-slate-400 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-1">Thành phần: {item.attendees}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Add Schedule Event */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-black text-slate-900">Thêm Sự Kiện Lịch Công Tác Mới</h3>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nội dung cuộc họp / sự kiện (*):</label>
                <input
                  type="text"
                  required
                  value={newEvent.title}
                  onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="Ví dụ: Giao ban Thường trực Đảng ủy tháng 8..."
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-800 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ngày diễn ra:</label>
                  <input
                    type="date"
                    required
                    value={newEvent.date}
                    onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Thời gian (Giờ):</label>
                  <input
                    type="text"
                    required
                    value={newEvent.time}
                    onChange={e => setNewEvent({ ...newEvent, time: e.target.value })}
                    placeholder="08:00 hoặc 14:00"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Buổi công tác:</label>
                  <select
                    value={newEvent.session}
                    onChange={e => setNewEvent({ ...newEvent, session: e.target.value as any })}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-800 font-medium"
                  >
                    <option value="MORNING">Sáng</option>
                    <option value="AFTERNOON">Chiều</option>
                    <option value="EVENING">Tối</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Chủ trì cuộc họp:</label>
                  <input
                    type="text"
                    value={newEvent.chairPerson}
                    onChange={e => setNewEvent({ ...newEvent, chairPerson: e.target.value })}
                    placeholder="Bí thư / Phó Bí thư / Chủ tịch..."
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Địa điểm:</label>
                  <input
                    type="text"
                    value={newEvent.location}
                    onChange={e => setNewEvent({ ...newEvent, location: e.target.value })}
                    placeholder="Phòng họp A, Hội trường..."
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Đơn vị chuẩn bị nội dung:</label>
                  <input
                    type="text"
                    value={newEvent.preparingUnit}
                    onChange={e => setNewEvent({ ...newEvent, preparingUnit: e.target.value })}
                    placeholder="Văn phòng Đảng ủy..."
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Thành phần tham dự:</label>
                <input
                  type="text"
                  value={newEvent.attendees}
                  onChange={e => setNewEvent({ ...newEvent, attendees: e.target.value })}
                  placeholder="Thường trực Đảng ủy, HĐND, UBND, Trưởng các ngành..."
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-800"
                />
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newEvent.isStandingBoard}
                    onChange={e => setNewEvent({ ...newEvent, isStandingBoard: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <span className="font-bold text-slate-800">Lịch Thường trực</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newEvent.isImportant}
                    onChange={e => setNewEvent({ ...newEvent, isImportant: e.target.checked })}
                    className="rounded text-amber-500 focus:ring-amber-500 w-4 h-4"
                  />
                  <span className="font-bold text-slate-800">Nội dung Trọng tâm</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu Sự Kiện Này'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
