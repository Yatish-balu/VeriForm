import React, { useState, useRef, useEffect } from 'react';
import {
  Building2,
  Check,
  ChevronDown,
  HelpCircle,
  History,
  LogOut,
  Upload,
  User,
  X,
} from 'lucide-react';
import { BranchTreeIcon, QueueListIcon } from './Icons';

export default function Sidebar({
  activePath,
  onNavigate,
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
  openDoubtsCount,
  onOpenHelp,
  backendStatus,
  userEmail,
  authMode,
  onSignOut,
  mobileOpen,
  onCloseMobile,
}) {
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const wsRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (wsRef.current && !wsRef.current.contains(e.target)) {
        setWsDropdownOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const navItems = [
    { path: '/upload', label: 'Upload B-Form', icon: Upload },
    {
      path: '/review',
      label: 'Review Queue',
      icon: QueueListIcon,
      badge: openDoubtsCount,
    },
    { path: '/rooms', label: 'Room Summaries', icon: Building2 },
    { path: '/branches', label: 'Branch Summaries', icon: BranchTreeIcon },
    { path: '/history', label: 'Form History', icon: History },
  ];

  const handleNavClick = (path) => {
    onNavigate(path);
    onCloseMobile?.();
  };

  const sidebarContent = (
    <aside className="w-[253px] h-full bg-[#F1F0EC] border-r border-[#E4E2DC] flex flex-col px-[18px] pt-[22px] pb-[18px] select-none">
      {/* Brand Lockup */}
      <div className="flex items-start justify-between">
        <button
          type="button"
          onClick={() => handleNavClick('/upload')}
          className="text-left group focus:outline-none"
        >
          <div className="flex items-center gap-[11px]">
            <span className="w-[32px] h-[32px] rounded-[9px] bg-[#293F2D] text-white flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
              <Check className="w-[18px] h-[18px]" strokeWidth={2.5} />
            </span>
            <span className="text-[21px] font-bold tracking-[-0.025em] text-[#111827] leading-none">
              VeriForm
            </span>
          </div>
          <div className="mt-[8px] text-[10px] font-semibold tracking-[0.12em] text-[#6E726B] uppercase pl-[1px]">
            ROLL CALL AI
          </div>
        </button>

        {mobileOpen && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="lg:hidden p-1.5 rounded-lg text-[#64748B] hover:bg-[#E7E4DA] hover:text-[#111827]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Workspace Selector */}
      <div className="relative mt-[18px]" ref={wsRef}>
        <button
          type="button"
          onClick={() => setWsDropdownOpen((v) => !v)}
          aria-expanded={wsDropdownOpen}
          className="w-full bg-[#FAF9F7] border border-[#E3E1DA] rounded-[12px] px-[12px] py-[10px] flex items-center gap-2.5 text-left hover:border-[#CFCBC0] transition-colors"
        >
          <Building2 className="w-[17px] h-[17px] text-[#374151] shrink-0" strokeWidth={1.7} />
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-semibold text-[#111827] leading-tight truncate">
              {activeWorkspace.name}
            </div>
            <div className="text-[11px] text-[#64748B] leading-tight mt-[2px] truncate">
              {activeWorkspace.subtitle}
            </div>
          </div>
          <ChevronDown
            className={`w-[15px] h-[15px] text-[#64748B] shrink-0 transition-transform ${
              wsDropdownOpen ? 'rotate-180' : ''
            }`}
            strokeWidth={1.8}
          />
        </button>

        {wsDropdownOpen && (
          <div className="absolute left-0 right-0 mt-1.5 bg-white border border-[#E5E7EB] rounded-[12px] shadow-[0_10px_25px_-5px_rgba(17,24,39,0.1)] p-1.5 z-40">
            <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">
              Switch workspace
            </div>
            {workspaces.map((ws) => {
              const selected = ws.id === activeWorkspace.id;
              return (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => {
                    onSelectWorkspace(ws);
                    setWsDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-[8px] text-left transition-colors ${
                    selected
                      ? 'bg-[#E2E7DC] text-[#111827]'
                      : 'hover:bg-[#F7F7F5] text-[#111827]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold truncate">{ws.name}</div>
                    <div className="text-[11px] text-[#64748B] truncate">{ws.subtitle}</div>
                  </div>
                  {selected && <Check className="w-3.5 h-3.5 text-[#293F2D] shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Workspace Navigation */}
      <div className="mt-[24px]">
        <div className="px-[10px] text-[10.5px] font-semibold tracking-[0.08em] text-[#6E726B] uppercase mb-[8px]">
          WORKSPACE
        </div>
        <nav className="space-y-[3px]" aria-label="Workspace Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activePath === item.path ||
              (item.path === '/upload' && activePath === '/');
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNavClick(item.path)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center gap-[10px] px-[11px] py-[9px] rounded-[10px] text-[13px] transition-colors ${
                  isActive
                    ? 'bg-[#E2E7DC] text-[#111827] font-semibold'
                    : 'text-[#4B5563] font-medium hover:bg-[#E8E6DF] hover:text-[#111827]'
                }`}
              >
                <Icon
                  className={`w-[16px] h-[16px] shrink-0 ${
                    isActive ? 'text-[#1F2E21]' : 'text-[#64748B]'
                  }`}
                  strokeWidth={1.75}
                />
                <span className="truncate">{item.label}</span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[22px] h-[21px] px-1.5 rounded-[6px] bg-[#EDE2C6] text-[#8A5A19] text-[11.5px] font-semibold font-mono-tech leading-none">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="mt-auto pt-4">
        <div className="bg-[#E8E5DC] rounded-[12px] px-[14px] py-[14px] mb-[12px]">
          <div className="text-[12.5px] font-semibold text-[#1F2937] leading-[1.35]">
            A little AI. A lot less admin.
          </div>
          <p className="mt-[5px] text-[11.5px] text-[#64748B] leading-[1.45]">
            Turn attendance sheets into records you can rely on.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenHelp}
          className="w-full flex items-center gap-2.5 px-[10px] py-[8px] rounded-[8px] text-[12.5px] font-medium text-[#64748B] hover:text-[#111827] hover:bg-[#E8E6DF] transition-colors mb-[10px]"
        >
          <HelpCircle className="w-[16px] h-[16px] text-[#64748B]" strokeWidth={1.7} />
          <span>Help &amp; documentation</span>
        </button>

        <div className="border-t border-[#E3E1DA] pt-[12px] relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((v) => !v)}
            aria-expanded={profileOpen}
            className="w-full flex items-center gap-2.5 px-[4px] py-[4px] rounded-[10px] hover:bg-[#E8E6DF] transition-colors text-left"
          >
            <User className="w-[16px] h-[16px] text-[#374151] shrink-0" strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-[#111827] leading-tight truncate">
                Exam Coordinator
              </div>
              <div className="text-[10.8px] text-[#64748B] leading-tight mt-[2px] tracking-[-0.01em] truncate">
                {userEmail || 'coordinator@institution.edu'}
              </div>
            </div>
            <ChevronDown
              className={`w-[14px] h-[14px] text-[#64748B] shrink-0 transition-transform ${
                profileOpen ? 'rotate-180' : ''
              }`}
              strokeWidth={1.8}
            />
          </button>

          {profileOpen && (
            <div className="absolute left-0 right-0 bottom-full mb-2 bg-white border border-[#E5E7EB] rounded-[12px] shadow-[0_10px_25px_-5px_rgba(17,24,39,0.12)] p-2 z-40">
              <div className="px-2.5 py-1.5 border-b border-[#F1F0EC]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-[#111827]">Exam Coordinator</span>
                  {authMode === 'dev-mock' && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#FDF5E4] text-[#92400E]">
                      Dev Auth
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-[#64748B] truncate">
                  {userEmail || 'coordinator@institution.edu'}
                </div>
              </div>
              <div className="px-2.5 py-2 flex items-center justify-between text-[11px]">
                <span className="text-[#64748B]">API Status</span>
                <span
                  className={`inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-full ${
                    backendStatus?.connected
                      ? 'bg-[#EAF2E8] text-[#166534]'
                      : 'bg-[#FBF1DC] text-[#92400E]'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      backendStatus?.connected ? 'bg-[#166534]' : 'bg-[#92400E]'
                    }`}
                  />
                  {backendStatus?.connected ? 'Connected' : 'Mock Mode'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  onOpenHelp();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-[8px] text-[12px] text-[#374151] hover:bg-[#F7F7F5]"
              >
                Workspace preferences &amp; docs
              </button>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  onSignOut?.();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 mt-0.5 rounded-[8px] text-[12px] font-medium text-[#991B1B] hover:bg-[#F9E4E4]/60 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <div className="hidden lg:block h-screen sticky top-0 shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile & Tablet slide-over drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#111827]/30"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
