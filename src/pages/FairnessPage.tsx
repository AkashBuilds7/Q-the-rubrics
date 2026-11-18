import React, { useEffect, useState } from 'react';
import { FlaskConical, Info, Save } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Assessment, QwkPair, QwkResult, StudentSubmission } from '../shared/types';
import { fetchFairnessMetrics, reviewEvaluation } from '../utils/api';
import { useTheme } from '../components/ThemeContext';

interface FairnessPageProps {
  activeAssessment: Assessment | null;
  onSubmissionUpdated: (updatedSubmission: StudentSubmission) => void;
}

export function FairnessPage({ activeAssessment, onSubmissionUpdated }: FairnessPageProps) {
  const { theme } = useTheme();
  const [result, setResult] = useState<QwkResult | null>(null);
  const [pairs, setPairs] = useState<QwkPair[]>([]);
  const [editingRefs, setEditingRefs] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadMetrics = () => {
    if (!activeAssessment) return;
    fetchFairnessMetrics(activeAssessment.id)
      .then((res) => {
        setResult(res.result);
        setPairs(res.pairs || []);
      })
      .catch(() => {
        setResult(null);
        setPairs([]);
      });
  };

  useEffect(() => {
    loadMetrics();
  }, [activeAssessment?.id, activeAssessment?.submissions]);

  if (!activeAssessment) {
    return (
      <div className="bento-card p-10 text-center text-sm text-slate-500">
        Select an assessment to inspect QWK fairness metrics.
      </div>
    );
  }

  const allEvals = activeAssessment.submissions.flatMap((s) =>
    s.evaluations.map((ev) => ({ submission: s, ev }))
  );

  const handleSaveReferenceMark = async (evId: string, maxMarks: number) => {
    const raw = editingRefs[evId];
    if (raw === undefined) return;
    const val = raw.trim() === '' ? null : Number(raw);
    if (val !== null && (!Number.isFinite(val) || val < 0 || val > maxMarks)) return;
    setSavingId(evId);
    try {
      const updated = await reviewEvaluation(evId, { teacherReferenceMarks: val });
      onSubmissionUpdated(updated);
      loadMetrics();
    } finally {
      setSavingId(null);
    }
  };

  const chartData = pairs.map((p, idx) => ({
    item: `${p.studentName.split(' ')[0]} ${p.questionNumber.split('·').pop()?.trim() || idx + 1}`,
    ai: p.aiMarks,
    teacher: p.teacherMarks,
  }));

  return (
    <div className="space-y-6">
      <div className="bento-hero p-6">
        <div className="flex items-center gap-2 text-xs font-medium text-sky-700 dark:text-emerald-300">
          <span>Agreement &amp; Reliability Analysis</span>
          {activeAssessment.isDemo && (
            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
              · <FlaskConical className="w-3.5 h-3.5" /> Demonstration Data
            </span>
          )}
        </div>
        <h1 className="font-display font-semibold text-2xl sm:text-3xl mt-1">
          Fairness &amp; Accuracy (QWK)
        </h1>
        <p className="text-sm text-slate-600 dark:text-[#99A8A1] mt-1 max-w-3xl">
          Quadratic Weighted Kappa (QWK) measures how closely AI marks align with human teacher reference marks. Alignment reflects consistency with teachers—always review flagged answers for final correctness.
        </p>
      </div>

      {/* QWK Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bento-card p-5">
          <div className="text-xs text-slate-500 dark:text-[#99A8A1]">QWK Agreement Score</div>
          <div className="font-mono-num font-semibold text-3xl text-sky-700 dark:text-emerald-300 mt-1.5">
            {result?.status === 'valid' && result.qwk !== null ? result.qwk.toFixed(3) : '—'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-[#99A8A1] mt-1">
            {result?.status === 'valid' ? 'Scale: -1.0 to 1.0' : result?.status === 'constant_distribution' ? 'Zero score variance' : 'Need ≥ 3 samples'}
          </div>
        </div>

        <div className="bento-card p-5">
          <div className="text-xs text-slate-500 dark:text-[#99A8A1]">Mean Absolute Error</div>
          <div className="font-mono-num font-semibold text-3xl mt-1.5">
            {result?.mae !== null && result?.mae !== undefined ? result.mae.toFixed(2) : '—'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-[#99A8A1] mt-1">Average mark difference</div>
        </div>

        <div className="bento-card p-5">
          <div className="text-xs text-slate-500 dark:text-[#99A8A1]">Exact Agreement</div>
          <div className="font-mono-num font-semibold text-3xl mt-1.5">
            {result?.exactAgreementPct !== null && result?.exactAgreementPct !== undefined
              ? `${result.exactAgreementPct}%`
              : '—'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-[#99A8A1] mt-1">Within ±0.25 marks</div>
        </div>

        <div className="bento-card p-5">
          <div className="text-xs text-slate-500 dark:text-[#99A8A1]">Reference Answers</div>
          <div className="font-mono-num font-semibold text-3xl mt-1.5">{result?.sampleCount ?? 0}</div>
          <div className="text-[11px] text-slate-500 dark:text-[#99A8A1] mt-1">Teacher-scored answers</div>
        </div>
      </div>

      {/* Plain-English Interpretation */}
      {result && (
        <div className="bento-card p-5 flex items-start gap-3 text-sm text-slate-800 dark:text-[#D3DDD8]">
          <Info className="w-5 h-5 text-sky-600 dark:text-emerald-300 shrink-0 mt-0.5" />
          <div>{result.interpretation}</div>
        </div>
      )}

      {/* AI vs Teacher Line Chart + Question-wise Agreement */}
      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bento-card p-6">
          <h2 className="font-display font-semibold text-lg mb-4">AI vs. Teacher Marks Comparison</h2>
          {chartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                  <XAxis dataKey="item" tick={{ fontSize: 11, fill: theme === 'dark' ? '#99A8A1' : '#64748B' }} />
                  <YAxis tick={{ fontSize: 12, fill: theme === 'dark' ? '#99A8A1' : '#64748B' }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="ai"
                    name="AI Marks"
                    stroke={theme === 'dark' ? '#6EE7B7' : '#0284C7'}
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="teacher"
                    name="Teacher Reference"
                    stroke={theme === 'dark' ? '#FDE68A' : '#6366F1'}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Enter teacher reference marks below to plot comparison.</p>
          )}
        </div>

        <div className="lg:col-span-5 bento-card p-6">
          <h2 className="font-display font-semibold text-lg mb-3">Question-wise Alignment</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-sky-200/70 dark:border-emerald-300/15 text-slate-500">
                  <th className="py-2 pr-2">Question</th>
                  <th className="py-2 px-2 text-right">Samples</th>
                  <th className="py-2 px-2 text-right">MAE</th>
                  <th className="py-2 pl-2 text-right">Exact %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100/70 dark:divide-emerald-300/10">
                {(result?.questionWise || []).map((qw) => (
                  <tr key={qw.questionNumber}>
                    <td className="py-2.5 pr-2 font-medium">{qw.questionNumber}</td>
                    <td className="py-2.5 px-2 text-right font-mono-num">{qw.sampleCount}</td>
                    <td className="py-2.5 px-2 text-right font-mono-num">{qw.mae.toFixed(2)}</td>
                    <td className="py-2.5 pl-2 text-right font-mono-num">{qw.exactAgreementPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Reference Marks Editor Table */}
      <div className="bento-card p-6 space-y-4">
        <div>
          <h2 className="font-display font-semibold text-lg">Teacher Reference Marks Entry</h2>
          <p className="text-xs text-slate-500 dark:text-[#99A8A1]">
            Enter or adjust human reference marks for any answer to update QWK, MAE, and alignment metrics live.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-sky-200/70 dark:border-emerald-300/15 text-slate-500">
                <th className="py-2.5 px-3">Student</th>
                <th className="py-2.5 px-3">Question</th>
                <th className="py-2.5 px-3 text-right">AI Marks</th>
                <th className="py-2.5 px-3 text-right">Max</th>
                <th className="py-2.5 px-3 text-right">Teacher Reference</th>
                <th className="py-2.5 px-3 text-right">Difference</th>
                <th className="py-2.5 px-3 text-right">Save</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100/70 dark:divide-emerald-300/10">
              {allEvals.map(({ submission, ev }) => {
                const currentRef =
                  editingRefs[ev.id] !== undefined
                    ? editingRefs[ev.id]
                    : ev.teacherReferenceMarks !== null && ev.teacherReferenceMarks !== undefined
                    ? String(ev.teacherReferenceMarks)
                    : '';
                const diff =
                  currentRef !== '' && Number.isFinite(Number(currentRef))
                    ? Math.round((ev.aiAwardedMarks - Number(currentRef)) * 10) / 10
                    : null;

                return (
                  <tr key={ev.id}>
                    <td className="py-2.5 px-3 font-medium">{submission.studentName}</td>
                    <td className="py-2.5 px-3">
                      {ev.paperSet} · {ev.questionNumber}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num">{ev.aiAwardedMarks}</td>
                    <td className="py-2.5 px-3 text-right font-mono-num">{ev.maxMarks}</td>
                    <td className="py-2.5 px-3 text-right">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max={ev.maxMarks}
                        value={currentRef}
                        placeholder="—"
                        aria-label={`Teacher reference mark for ${submission.studentName} ${ev.questionNumber}`}
                        onChange={(e) => setEditingRefs((prev) => ({ ...prev, [ev.id]: e.target.value }))}
                        className="w-20 px-2 py-1 rounded-lg text-right font-mono-num bento-inset"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num">
                      {diff !== null ? (diff > 0 ? `+${diff}` : diff) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        disabled={savingId === ev.id}
                        onClick={() => handleSaveReferenceMark(ev.id, ev.maxMarks)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bento-inset hover:bg-sky-100 dark:hover:bg-[#2B3832] cursor-pointer inline-flex items-center gap-1"
                      >
                        <Save className="w-3 h-3" />
                        <span>Update</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
