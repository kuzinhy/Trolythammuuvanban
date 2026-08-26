import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { 
  Building2, ChevronDown, Check, Plus, Search, ShieldAlert, 
  MapPin, Phone, Mail, Sparkles, Sliders, Landmark, ExternalLink
} from 'lucide-react';
import { useWardStore, isSuperAdmin, isWardAdmin } from '../store/wardStore';
import { useAuthStore } from '../store/authStore';
import { WardUnit } from '../types';
import { cn } from '../lib/utils';

export default function WardSwitcher() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { wards, activeWardId, setActiveWardId, getActiveWard } = useWardStore();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeWard = getActiveWard();
  const isSuper = isSuperAdmin(user);
  const isWardAdm = isWardAdmin(user, activeWardId);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredWards = wards.filter(w => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return w.name.toLowerCase().includes(q) ||
           w.shortName.toLowerCase().includes(q) ||
           w.code.toLowerCase().includes(q) ||
           w.districtName.toLowerCase().includes(q);
  });

  const handleSelectWard = (ward: WardUnit) => {
    setActiveWardId(ward.id);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Switcher Button Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-2xl border transition-all cursor-pointer group shadow-2xs",
          isOpen
            ? "bg-blue-50 border-blue-300 ring-2 ring-blue-500/20 text-blue-900"
            : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
        )}
        title={isSuper ? "Chuyển đổi Đơn vị / Phường quản lý (SuperAdmin)" : `Đơn vị: ${activeWard?.name}`}
      >
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
          <Landmark className="w-3.5 h-3.5" />
        </div>

        <div className="flex flex-col items-start text-left max-w-[140px] sm:max-w-[200px] md:max-w-[240px]">
          <div className="flex items-center gap-1.5 w-full">
            <span className="text-[11px] font-black text-slate-900 truncate leading-tight">
              {activeWard?.shortName || activeWard?.name || 'Đảng ủy Phường Phú Cường'}
            </span>
            {isSuper ? (
              <span className="px-1.5 py-0.2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[8px] font-black uppercase rounded shadow-xs">
                SUPER
              </span>
            ) : isWardAdm ? (
              <span className="px-1.5 py-0.2 bg-blue-600 text-white text-[8px] font-black uppercase rounded">
                ADMIN
              </span>
            ) : null}
          </div>
          <span className="text-[9px] text-slate-400 font-bold truncate leading-tight">
            {activeWard?.districtName || 'TP. Thủ Dầu Một'}
          </span>
        </div>

        {isSuper && (
          <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform duration-200", isOpen && "rotate-180 text-blue-600")} />
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-blue-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-300" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  {isSuper ? 'Chuyển Đổi Đơn Vị / Phường' : 'Thông Tin Đơn Vị Quản Lý'}
                </h3>
              </div>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white/10 text-blue-200">
                {wards.length} Đơn vị
              </span>
            </div>
            <p className="text-[10px] text-blue-200/90 mt-1">
              {isSuper 
                ? 'Quyền SuperAdmin: Bạn có toàn quyền quản lý, chuyển đổi và cấu hình cho tất cả các phường.'
                : 'Bạn đang thao tác trong phạm vi quản lý của đơn vị được phân quyền.'
              }
            </p>
          </div>

          {isSuper ? (
            <>
              {/* Search Box */}
              <div className="p-3 border-b border-slate-100 bg-slate-50/70">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm phường / đơn vị..."
                    className="w-full pl-8.5 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
              </div>

              {/* Wards List */}
              <div className="max-h-72 overflow-y-auto p-2 divide-y divide-slate-50 space-y-1">
                {filteredWards.map(ward => {
                  const isCurrent = ward.id === activeWardId;
                  return (
                    <button
                      key={ward.id}
                      type="button"
                      onClick={() => handleSelectWard(ward)}
                      className={cn(
                        "w-full text-left p-2.5 rounded-2xl transition-all flex items-center justify-between gap-3 group cursor-pointer",
                        isCurrent
                          ? "bg-blue-50/90 border border-blue-200 text-blue-900 font-black shadow-2xs"
                          : "hover:bg-slate-50 text-slate-700 font-medium"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold",
                          isCurrent 
                            ? "bg-blue-600 text-white shadow-xs" 
                            : "bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700"
                        )}>
                          <Landmark className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate flex items-center gap-1.5">
                            <span>{ward.name}</span>
                            {ward.status === 'INACTIVE' && (
                              <span className="px-1 py-0.2 bg-slate-200 text-slate-600 text-[8px] rounded">Tạm dừng</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate flex items-center gap-2">
                            <span>{ward.districtName}</span>
                            <span>•</span>
                            <span className="text-slate-500 font-mono text-[9px]">{ward.code}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isCurrent && (
                          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Popover Footer Action Links */}
              <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/admin?tab=wards');
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Quản lý & Thêm Phường</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/admin?tab=system');
                  }}
                  className="px-2.5 py-1.5 text-slate-600 hover:text-blue-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Sliders className="w-3 h-3" />
                  <span>Cấu hình Phường này</span>
                </button>
              </div>
            </>
          ) : (
            /* Non-SuperAdmin View: Info Card */
            <div className="p-4 space-y-3">
              <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-200">
                <div className="text-xs font-black text-blue-900">{activeWard?.name}</div>
                <div className="text-[11px] text-blue-700 font-medium mt-0.5">{activeWard?.parentOrg}</div>
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <span className="text-[11px]">{activeWard?.officeAddress}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-[11px] font-mono font-bold">{activeWard?.contactPhone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-[11px]">{activeWard?.contactEmail}</span>
                </div>
              </div>

              {isWardAdm && (
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      navigate('/admin?tab=system');
                    }}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Cài đặt & Quản lý Phường {activeWard?.shortName}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
