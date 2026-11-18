import React, { useEffect, useState } from 'react';
import { ThemeProvider } from './components/ThemeContext';
import { AuroraBackground } from './components/AuroraBackground';
import { SidebarLayout, type NavSection } from './components/SidebarLayout';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { NewEvaluationPage } from './pages/NewEvaluationPage';
import { ResultsPage } from './pages/ResultsPage';
import { StudentsPage } from './pages/StudentsPage';
import { ReportsPage } from './pages/ReportsPage';
import { MarkingSchemePage } from './pages/MarkingSchemePage';
import { FairnessPage } from './pages/FairnessPage';
import { SettingsPage } from './pages/SettingsPage';
import { fetchAssessments, fetchSettings } from './utils/api';
import type { AppSettings, Assessment, StudentSubmission } from './shared/types';
import { calculateSubmissionTotals } from './shared/gradingMath';

const DEFAULT_SETTINGS: AppSettings = {
  defaultLanguage: 'English',
  defaultEducationLevel: 'secondary',
  defaultSubject: 'Biology',
  feedbackInStudentLanguage: true,
  flagBorderlineThreshold: 0.5,
  showModelSummaryToTeacher: true,
};

function QubrixAppShell() {
  const [inWorkspace, setInWorkspace] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('autostart') === '1';
  });
  const [section, setSection] = useState<NavSection>('dashboard');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [activeAssessmentId, setActiveAssessmentId] = useState<string>('');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [list, cfg] = await Promise.all([fetchAssessments(), fetchSettings()]);
      setAssessments(list);
      setSettings(cfg);
      if (list.length > 0) {
        setActiveAssessmentId((prev) =>
          prev && list.some((a) => a.id === prev) ? prev : list[0].id
        );
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load workspace data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const activeAssessment =
    assessments.find((a) => a.id === activeAssessmentId) || assessments[0] || null;

  const handleAssessmentUpdated = (updated: Assessment) => {
    setAssessments((prev) => {
      const exists = prev.some((a) => a.id === updated.id);
      return exists ? prev.map((a) => (a.id === updated.id ? updated : a)) : [updated, ...prev];
    });
    setActiveAssessmentId(updated.id);
  };

  const handleSubmissionUpdated = (updatedSub: StudentSubmission) => {
    setAssessments((prev) =>
      prev.map((a) => {
        if (a.id !== updatedSub.assessmentId) return a;
        const nextSubs = a.submissions.map((s) =>
          s.id === updatedSub.id
            ? { ...updatedSub, ...calculateSubmissionTotals(updatedSub.evaluations) }
            : s
        );
        return { ...a, submissions: nextSubs };
      })
    );
  };

  const handleTryDemo = () => {
    const demo = assessments.find((a) => a.isDemo) || assessments[0];
    if (demo) setActiveAssessmentId(demo.id);
    setInWorkspace(true);
    setSection('dashboard');
  };

  const handleStartEvaluation = () => {
    setInWorkspace(true);
    setSection('new_evaluation');
  };

  if (!inWorkspace) {
    return (
      <LandingPage
        onStartEvaluation={handleStartEvaluation}
        onTryDemo={handleTryDemo}
        onOpenDashboard={() => {
          setInWorkspace(true);
          setSection('dashboard');
        }}
      />
    );
  }

  return (
    <SidebarLayout
      activeSection={section}
      onNavigate={(s) => setSection(s)}
      onGoHome={() => setInWorkspace(false)}
      activeAssessmentTitle={activeAssessment?.title}
      isDemoActive={activeAssessment?.isDemo}
    >
      {loading && assessments.length === 0 ? (
        <div className="bento-card p-10 text-center text-sm text-slate-600 dark:text-[#99A8A1]">
          Loading QUBRIX AI workspace...
        </div>
      ) : loadError ? (
        <div className="bento-card p-8 text-center space-y-3">
          <div className="text-sm text-rose-600 dark:text-rose-300">{loadError}</div>
          <button
            type="button"
            onClick={loadAll}
            className="cta-primary px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {section === 'dashboard' && (
            <DashboardPage
              assessments={assessments}
              activeAssessment={activeAssessment}
              onSelectAssessment={(id) => setActiveAssessmentId(id)}
              onStartNewEvaluation={() => setSection('new_evaluation')}
              onViewResults={() => setSection('results')}
            />
          )}

          {section === 'new_evaluation' && (
            <NewEvaluationPage
              settings={settings}
              onEvaluationComplete={(created) => {
                handleAssessmentUpdated(created);
                setSelectedSubmissionId(created.submissions[0]?.id || null);
                setSection('results');
              }}
            />
          )}

          {section === 'results' && (
            <ResultsPage
              assessments={assessments}
              activeAssessment={activeAssessment}
              onSelectAssessment={(id) => {
                setActiveAssessmentId(id);
                setSelectedSubmissionId(null);
              }}
              onSubmissionUpdated={handleSubmissionUpdated}
              selectedSubmissionId={selectedSubmissionId}
            />
          )}

          {section === 'students' && (
            <StudentsPage
              activeAssessment={activeAssessment}
              onInspectStudentResult={(subId) => {
                setSelectedSubmissionId(subId);
                setSection('results');
              }}
            />
          )}

          {section === 'reports' && <ReportsPage activeAssessment={activeAssessment} />}

          {section === 'marking_scheme' && (
            <MarkingSchemePage
              activeAssessment={activeAssessment}
              onAssessmentUpdated={handleAssessmentUpdated}
            />
          )}

          {section === 'fairness' && (
            <FairnessPage
              activeAssessment={activeAssessment}
              onSubmissionUpdated={handleSubmissionUpdated}
            />
          )}

          {section === 'settings' && (
            <SettingsPage
              settings={settings}
              onSettingsUpdated={setSettings}
              onDemoReset={(demo) => handleAssessmentUpdated(demo)}
            />
          )}
        </>
      )}
    </SidebarLayout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuroraBackground />
      <QubrixAppShell />
    </ThemeProvider>
  );
}
