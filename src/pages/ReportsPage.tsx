import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FlaskConical, Info } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Assessment, PaperSet, SetComparisonRow } from '../shared/types';
import { fetchAnalytics } from '../utils/api';
import { exportClassResultsCsv, exportClassResultsExcel } from '../utils/exportReports';
import { PrismaticDivider } from '../components/AuroraBackground';
import { useTheme } from '../components/ThemeContext';

interface ReportsPageProps {
  activeAssessment: Assessment | null;
}

export function ReportsPage({ activeAssessment }: ReportsPageProps) {
  const { theme } = useTheme();
  const [setFilter, setSetFilter] = useState<'All' | PaperSet>('All');
  const [setComparison, setSetComparison] = useState<SetComparisonRow[]>([]);

  useEffect(() => {
    if (!activeAssessment) return;
    fetchAnalytics(activeAssessment.id)
      .then((res) => setSetComparison(res.setComparison || []))
      .catch(() => setSetComparison([]));
  }, [activeAssessment]);

  const submissions = useMemo(() => {
    const subs = activeAssessment?.submissions || [];
    return setFilter === 'All' ? subs : subs.filter((s) => s.paperSet === setFilter);
  }, [activeAssessment, setFilter]);

  const stats = useMemo(() => {
    if (submissions.length === 0) return { avg: 0, high: 0, low: 0, maxMarks: 0 };
    const marks = submissions.map((s) => s.finalTotalMarks);
    return {
      avg: Math.round((marks.reduce((a, b) => a + b, 0) / marks.length) * 10) / 10,
      high: Math.max(...marks),
      low: Math.min(...marks),
      maxMarks: submissions[0].maxTotalMarks,
    };
  }, [submissions]);

  const distributionData = useMemo(() => {
    const buckets = [
      { range: '0–39%', count: 0 },
      { range: '40–59%', count: 0 },
      { range: '60–79%', count: 0 },
      { range: '80–100%', count: 0 },
    ];
    for (const s of submissions) {
      if (s.percentage < 40) buckets[0].count += 1;
      else if (s.percentage < 60) buckets[1].count += 1;
      else if (s.percentage < 80) buckets[2].count += 1;
      else buckets[3].count += 1;
    }
    return buckets;
  }, [submissions]);

  const questionPerfData = useMemo(() => {
    const map = new Map<string, { totalPct: number; count: number; topic: string }>();
    for (const s of submissions) {
      for (const ev of s.evaluations) {
        const key = `${ev.paperSet} ${ev.questionNumber}`;
        const prev = map.get(key) || { totalPct: 0, count: 0, topic: ev.topic };
        const pct = ev.maxMarks > 0 ? (ev.finalMarks / ev.maxMarks) * 100 : 0;
        map.set(key, { totalPct: prev.totalPct + pct, count: prev.count + 1, topic: ev.topic });
      }
    }
    return Array.from(map.entries()).map(([label, v]) => ({
      question: label,
      avgPct: Math.round((v.totalPct / v.count) * 10) / 10,
      topic: v.topic,
    }));
  }, [submissions]);

  const conceptGaps = useMemo(() => {
    const counts = new Map<string, number>();
    const mistakes = new Map<string, number>();
    for (const s of submissions) {
      for (const ev of s.evaluations) {
        for (const mc of ev.missingConcepts) {
          counts.set(mc, (counts.get(mc) || 0) + 1);
        }
        for (const inc of ev.incorrectStatements) {
          mistakes.set(inc, (mistakes.get(inc) || 0) + 1);
        }
      }
    }
    return {
      missed: Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6),
      mistakes: Array.from(mistakes.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [submissions]);

  if (!activeAssessment) {
    return (
      <div className="bento-card p-10 text-center text-sm text-slate-500">
        No assessment available for reporting.
      </div>
    );
  }

  const barColor = theme === 'dark' ? '#6EE7B7' : '#0284C7';
  const barSecondary = theme === 'dark' ? '#5EEAD4' : '#6366F1';
  const axisColor = theme === 'dark' ? '#99A8A1' : '#64748B';

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="bento-hero p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-sky-700 dark:text-emerald-300">
            <span>Class Performance Analytics &amp; Paper Set Comparison</span>
            {activeAssessment.isDemo && (
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                · <FlaskConical className="w-3.5 h-3.5" /> Demonstration Data
              </span>
            )}
          </div>
          <h1 className="font-display font-semibold text-2xl sm:text-3xl mt-1">
            Performance Reports
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <select
            value={setFilter}
            onChange={(e) => setSetFilter(e.target.value as 'All' | PaperSet)}
            aria-label="Filter analytics by paper set"
            className="px-3 py-2 rounded-xl text-xs bento-inset text-slate-900 dark:text-[#F2F6F4]"
          >
            <option value="All">All Sets</option>
            <option value="Set A">Set A</option>
            <option value="Set B">Set B</option>
            <option value="Set C">Set C</option>
            <option value="Set D">Set D</option>
          </select>

          <button
            type="button"
            onClick={() => exportClassResultsCsv(activeAssessment)}
            className="px-4 py-2 rounded-xl text-xs font-medium bento-card hover:bg-sky-50 dark:hover:bg-[#2B3832] cursor-pointer inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-sky-600 dark:text-emerald-300" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => exportClassResultsExcel(activeAssessment)}
            className="cta-primary px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bento-card p-5">
          <div className="text-xs text-slate-500 dark:text-[#99A8A1]">Average Marks</div>
          <div className="font-mono-num font-semibold text-2xl mt-1.5">
            {stats.avg} / {stats.maxMarks}
          </div>
        </div>
        <div className="bento-card p-5">
          <div className="text-xs text-slate-500 dark:text-[#99A8A1]">Highest Score</div>
          <div className="font-mono-num font-semibold text-2xl text-emerald-700 dark:text-emerald-300 mt-1.5">
            {stats.high} / {stats.maxMarks}
          </div>
        </div>
        <div className="bento-card p-5">
          <div className="text-xs text-slate-500 dark:text-[#99A8A1]">Lowest Score</div>
          <div className="font-mono-num font-semibold text-2xl text-amber-700 dark:text-amber-300 mt-1.5">
            {stats.low} / {stats.maxMarks}
          </div>
        </div>
        <div className="bento-card p-5">
          <div className="text-xs text-slate-500 dark:text-[#99A8A1]">Students in Filter</div>
          <div className="font-mono-num font-semibold text-2xl mt-1.5">{submissions.length}</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bento-card p-6">
          <h2 className="font-display font-semibold text-lg mb-4">Marks Distribution</h2>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.18} vertical={false} />
                <XAxis dataKey="range" tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
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
                />
                <Bar dataKey="count" fill={barColor} radius={[8, 8, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bento-card p-6">
          <h2 className="font-display font-semibold text-lg mb-4">Question-wise Performance (%)</h2>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={questionPerfData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.18} vertical={false} />
                <XAxis dataKey="question" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
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
                  formatter={(v: any) => [`${v}%`, 'Avg Score']}
                />
                <Bar dataKey="avgPct" fill={barSecondary} radius={[8, 8, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <PrismaticDivider />

      {/* Question Paper Set Comparison */}
      <div className="bento-card p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold text-lg">Question Paper Set Comparison</h2>
            <p className="text-xs text-slate-500 dark:text-[#99A8A1] mt-0.5">
              Compares sets using rubric complexity and cohort performance. Marks are never altered automatically across sets.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#99A8A1]">
            <Info className="w-3.5 h-3.5" />
            <span>Sets with &lt; 5 students are marked provisional</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-sky-200/70 dark:border-emerald-300/15 text-xs text-slate-500 dark:text-[#99A8A1]">
                <th className="py-3 px-4 font-medium">Set</th>
                <th className="py-3 px-4 font-medium text-right">Students</th>
                <th className="py-3 px-4 font-medium text-right">Avg Marks</th>
                <th className="py-3 px-4 font-medium text-right">Performance</th>
                <th className="py-3 px-4 font-medium">Estimated Difficulty</th>
                <th className="py-3 px-4 font-medium text-right">Difficulty Rank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100/70 dark:divide-emerald-300/10">
              {setComparison.map((row) => (
                <tr key={row.paperSet}>
                  <td className="py-3 px-4 font-medium">{row.paperSet}</td>
                  <td className="py-3 px-4 text-right font-mono-num">{row.studentCount}</td>
                  <td className="py-3 px-4 text-right font-mono-num">
                    {row.averageMarks} / {row.maxMarks}
                  </td>
                  <td className="py-3 px-4 text-right font-mono-num">{row.performancePercentage}%</td>
                  <td className="py-3 px-4 text-xs">
                    {row.estimatedDifficulty}
                    {row.isProvisional && (
                      <span className="ml-1.5 text-amber-700 dark:text-amber-300">(Provisional)</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono-num">#{row.difficultyRank}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Missed Concepts & Frequent Mistakes */}
      <div className="grid md:grid-cols-2 gap-5">
        <div className="bento-card p-6 space-y-3">
          <h2 className="font-display font-semibold text-lg">Commonly Missed Concepts</h2>
          {conceptGaps.missed.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {conceptGaps.missed.map(([concept, count]) => (
                <li key={concept} className="bento-inset px-4 py-2.5 flex items-center justify-between gap-3">
                  <span className="text-slate-700 dark:text-[#D3DDD8]">{concept}</span>
                  <span className="font-mono-num text-xs font-semibold text-amber-700 dark:text-amber-300 shrink-0">
                    {count} student{count > 1 ? 's' : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">No missing concepts recorded in this filter.</p>
          )}
        </div>

        <div className="bento-card p-6 space-y-3">
          <h2 className="font-display font-semibold text-lg">Frequently Identified Misconceptions</h2>
          {conceptGaps.mistakes.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {conceptGaps.mistakes.map(([mistake, count]) => (
                <li key={mistake} className="bento-inset px-4 py-2.5 flex items-center justify-between gap-3">
                  <span className="text-slate-700 dark:text-[#D3DDD8]">{mistake}</span>
                  <span className="font-mono-num text-xs font-semibold text-rose-700 dark:text-rose-300 shrink-0">
                    {count}×
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">No repeated conceptual errors flagged.</p>
          )}
        </div>
      </div>
    </div>
  );
}
