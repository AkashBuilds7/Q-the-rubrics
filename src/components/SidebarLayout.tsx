import React, { useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FilePlus2,
  LayoutDashboard,
  Menu,
  Scale,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { QubrixLogo } from './QubrixLogo';
import { ThemeToggle } from './ThemeToggle';

export type NavSection =
  | 'dashboard'
  | 'new_evaluation'
  | 'results'
  | 'students'
  | 'reports'
  | 'marking_scheme'
  | 'fairness'
  | 'settings';

export const NAV_ITEMS: Array<{ id: NavSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'new_evaluation', label: 'New Evaluation', icon: FilePlus2 },
  { id: 'results', label: 'Results', icon: CheckCircle2 },
  { id: 'students', label: 'Students', icon: Users },
  { id: 'reports', label: 'Performance Reports', icon: BarChart3 },
  { id: 'marking_scheme', label: 'Marking Scheme', icon: ClipboardList },
  { id: 'fairness', label: 'Fairness & Accuracy', icon: Scale },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface SidebarLayoutProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
  onGoHome: () => void;
  activeAssessmentTitle?: string;
  isDemoActive?: boolean;
  children: React.ReactNode;
}

export function SidebarLayout({
  activeSection,
  onNavigate,
  onGoHome,
  activeAssessmentTitle,
  isDemoActive,
  children,
}: SidebarLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSelect = (id: NavSection) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  const navContent = (
    <div className="flex flex-col h-full p-4 justify-between">
      <div>
        <button
          type="button"
          onClick={onGoHome}
          className="w-full flex items-center gap-2.5 px-2 py-2.5 rounded-xl hover:bg-sky-50/70 dark:hover:bg-[#242F2A]/70 transition-colors text-left cursor-pointer"
        >
          <QubrixLogo size={30} />
          <div className="min-w-0">
            <div className="font-display font-semibold text-base text-slate-900 dark:text-[#F2F6F4] leading-tight whitespace-nowrap">
              QUBRIX AI
            </div>
            <div className="text-[11px] text-slate-500 dark:text-[#99A8A1] truncate">
              Answer Evaluation
            </div>
          </div>
        </button>

        <nav aria-label="Main workspace navigation" className="mt-6 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-sky-500/12 dark:bg-emerald-400/14 text-sky-700 dark:text-[#A7F3D0]'
                    : 'text-slate-600 dark:text-[#99A8A1] hover:bg-sky-50/80 dark:hover:bg-[#242F2A]/75 hover:text-slate-900 dark:hover:text-[#F2F6F4]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-sky-200/60 dark:border-emerald-300/12 space-y-3">
        {activeAssessmentTitle && (
          <div className="px-2.5 py-2 rounded-xl bg-sky-50/70 dark:bg-[#242F2A]/70 border border-sky-200/60 dark:border-emerald-300/12">
            <div className="text-[11px] font-medium text-slate-500 dark:text-[#99A8A1]">
              {isDemoActive ? 'Demonstration Data' : 'Active Assessment'}
            </div>
            <div className="text-xs font-medium text-slate-800 dark:text-[#F2F6F4] truncate mt-0.5">
              {activeAssessmentTitle}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">
      {/* Mobile Header (kept compact <= 15% viewport height) */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bento-card rounded-none border-x-0 border-t-0">
        <button
          type="button"
          onClick={onGoHome}
          className="flex items-center gap-2 font-display font-semibold text-base text-slate-900 dark:text-[#F2F6F4] whitespace-nowrap cursor-pointer"
        >
          <QubrixLogo size={26} />
          <span>QUBRIX AI</span>
        </button>
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="p-2 rounded-xl border border-sky-200/70 dark:border-emerald-300/20 text-slate-700 dark:text-[#D3DDD8] cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-slate-900/35 backdrop-blur-sm">
          <aside className="w-72 h-full bento-hero rounded-none">{navContent}</aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen p-3">
        <div className="bento-card h-full">{navContent}</div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-6 max-w-[1380px]">
        {children}
      </main>
    </div>
  );
}
