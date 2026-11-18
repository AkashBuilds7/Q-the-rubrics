import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FilePlus2,
  FlaskConical,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Assessment } from '../shared/types';
import { PrismaticDivider } from '../components/AuroraBackground';
import { useTheme } from '../components/ThemeContext';

interface DashboardPageProps {
  assessments: Assessment[];
  activeAssessment: Assessment | null;
  onSelectAssessment: (id: string) => void;
  onStartNewEvaluation: () => void;
  onViewResults: () => void;
}

export function DashboardPage({
  assessments,
  activeAssessment,
  onSelectAssessment,
  onStartNewEvaluation,
  onViewResults,
}: DashboardPageProps) {
  const { theme } = useTheme();
  const allSubmissions = assessments.flatMap((a) => a.submissions);
  const totalStudents = allSubmissions.length;
  const totalAssessments = assessments.length;
  const completedCount = allSubmissions.filter((s) => s.status === 'completed').length;
  const needsReviewAnswers = allSubmissions.reduce((acc, s) => acc + s.reviewRequiredCount, 0);
  const avgPct =
    totalStudents > 0
      ? Math.round((allSubmissions.reduce((acc, s) => acc + s.percentage, 0) / totalStudents) * 10) / 10
      : 0;

  const activeSubs = activeAssessment?.submissions || [];
  const scoreChartData = activeSubs.map((s) => ({
    name: s.studentName.split(' ')[0],
    percentage: s.percentage,
    set: s.paperSet,
  }));

  const chartBarColor = theme === 'dark' ? '#6EE7B7' : '#0284C7';
  const axisColor = theme === 'dark' ? '#99A8A1' : '#64748B';
  const gridColor = theme === 'dark' ? 'rgba(167,243,208,0.08)' : 'rgba(148,163,184,0.2)';

  return (
    <div className="space-y-6">
      {/* Header & Prominent Actions */}
      <div className="bento-hero p-6 sm:p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div>
          <div className="text-xs font-medium text-sky-700 dark:text-emerald-300">
            Teacher Workspace · Overview
          </div>
          <h1 className="font-display font-semibold text-2xl sm:text-3xl mt-1">
            Evaluation Dashboard
          </h1>
          <p className="text-sm text-slate-600 dark:text-[#99A8A1] mt-1">
            Upload papers, review conceptual marks with evidence, and export reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onStartNewEvaluation}
            className="cta-primary px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-2"
          >
            <FilePlus2 className="w-4 h-4 shrink-0" />
            <span>Start New Evaluation</span>
          </button>
          <button
            type="button"
            onClick={onViewResults}
            className="px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-2 border border-sky-200/80 dark:border-emerald-300/20 bg-white/80 dark:bg-[#242F2A]/80 text-slate-800 dark:text-[#F2F6F4] hover:bg-sky-50 dark:hover:bg-[#2B3832] transition-colors"
          >
            <span>View Previous Results</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </div>

      {/* KPI Bento Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bento-card p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#99A8A1]">
            <span>Students Evaluated</span>
            <Users className="w-4 h-4 text-sky-600 dark:text-emerald-300 shrink-0" />
          </div>
          <div className="font-mono-num font-semibold text-2xl sm:text-3xl text-slate-900 dark:text-[#F2F6F4] mt-2">
            {totalStudents}
          </div>
        </div>

        <div className="bento-card p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#99A8A1]">
            <span>Assessments</span>
            <ClipboardCheck className="w-4 h-4 text-sky-600 dark:text-emerald-300 shrink-0" />
          </div>
          <div className="font-mono-num font-semibold text-2xl sm:text-3xl text-slate-900 dark:text-[#F2F6F4] mt-2">
            {totalAssessments}
          </div>
        </div>

        <div className="bento-card p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#99A8A1]">
            <span>Average Class Score</span>
            <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-emerald-300 shrink-0" />
          </div>
          <div className="font-mono-num font-semibold text-2xl sm:text-3xl text-slate-900 dark:text-[#F2F6F4] mt-2">
            {avgPct}%
          </div>
        </div>

        <div className="bento-card p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#99A8A1]">
            <span>Completed Sheets</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-300 shrink-0" />
          </div>
          <div className="font-mono-num font-semibold text-2xl sm:text-3xl text-slate-900 dark:text-[#F2F6F4] mt-2">
            {completedCount}
          </div>
        </div>

        <div className="bento-card p-5 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#99A8A1]">
            <span>Needs Review</span>
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-300 shrink-0" />
          </div>
          <div className="font-mono-num font-semibold text-2xl sm:text-3xl text-amber-700 dark:text-amber-300 mt-2">
            {needsReviewAnswers}
          </div>
        </div>
      </div>

      <PrismaticDivider />

      {/* Chart + Recent Assessments Bento Row */}
      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bento-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="font-display font-semibold text-lg">Student Score Snapshot</h2>
              <p className="text-xs text-slate-500 dark:text-[#99A8A1]">
                {activeAssessment?.title || 'No assessment selected'}
                {activeAssessment?.isDemo ? ' · Demonstration Data' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onViewResults}
              className="text-xs font-medium text-sky-700 dark:text-emerald-300 hover:underline cursor-pointer whitespace-nowrap"
            >
              Inspect Answers
            </button>
          </div>

          {scoreChartData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreChartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip
                    cursor={{
                      fill: theme === 'dark' ? 'rgba(110, 231, 183, 0.08)' : 'rgba(2, 132, 199, 0.07)',
                    }}
                    contentStyle={{
                      backgroundColor: theme === 'dark' ? '#161D1A' : '#FFFFFF',
                      border: theme === 'dark' ? '1px solid rgba(167,243,208,0.2)' : '1px solid rgba(191,211,232,0.8)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: theme === 'dark' ? '#F2F6F4' : '#1E293B',
                    }}
                    formatter={(val: any) => [`${val}%`, 'Score']}
                  />
                  <Bar dataKey="percentage" fill={chartBarColor} radius={[8, 8, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex flex-col items-center justify-center text-sm text-slate-500 dark:text-[#99A8A1]">
              No evaluated student sheets yet. Start a new evaluation to see performance bars.
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bento-card p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-display font-semibold text-lg mb-1">Recent Assessments</h2>
            <p className="text-xs text-slate-500 dark:text-[#99A8A1] mb-4">
              Select an assessment to inspect results, regrade, or run QWK alignment.
            </p>

            <div className="space-y-2.5">
              {assessments.map((a) => {
                const isSelected = a.id === activeAssessment?.id;
                const avg =
                  a.submissions.length > 0
                    ? Math.round(
                        (a.submissions.reduce((acc, s) => acc + s.percentage, 0) / a.submissions.length) * 10
                      ) / 10
                    : 0;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onSelectAssessment(a.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500/10 dark:bg-emerald-400/12 border-sky-400/60 dark:border-emerald-300/40'
                        : 'bento-inset hover:bg-sky-50/90 dark:hover:bg-[#2B3832]/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-slate-900 dark:text-[#F2F6F4] truncate">
                          {a.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-[#99A8A1] mt-1">
                          {a.subject} · {a.submissions.length} students · {a.examDate}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono-num text-sm font-semibold text-sky-700 dark:text-emerald-300">
                          {avg}%
                        </div>
                        {a.isDemo && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                            <FlaskConical className="w-3 h-3" />
                            Demo
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-sky-200/60 dark:border-emerald-300/12 text-xs text-slate-500 dark:text-[#99A8A1]">
            Demonstration assessments are clearly labeled and kept separate from your uploaded exams.
          </div>
        </div>
      </div>
    </div>
  );
}
