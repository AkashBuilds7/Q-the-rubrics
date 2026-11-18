import React, { useEffect, useState } from 'react';
import {
  GitMerge,
  History,
  Loader2,
  Plus,
  RefreshCw,
  Scissors,
  Trash2,
} from 'lucide-react';
import type { Assessment, CriterionImportance, QuestionItem } from '../shared/types';
import { regradeAssessmentScheme } from '../utils/api';

interface MarkingSchemePageProps {
  activeAssessment: Assessment | null;
  onAssessmentUpdated: (updated: Assessment) => void;
}

export function MarkingSchemePage({ activeAssessment, onAssessmentUpdated }: MarkingSchemePageProps) {
  const [draftQuestions, setDraftQuestions] = useState<QuestionItem[]>([]);
  const [versionLabel, setVersionLabel] = useState('');
  const [versionNotes, setVersionNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [regradeMessage, setRegradeMessage] = useState<string | null>(null);
  const [regradeDiffs, setRegradeDiffs] = useState<
    Array<{ student: string; question: string; oldMarks: number; newMarks: number; explanation: string }>
  >([]);

  useEffect(() => {
    if (activeAssessment) {
      setDraftQuestions(JSON.parse(JSON.stringify(activeAssessment.questions)));
      setVersionLabel(`v${activeAssessment.activeSchemeVersion + 1} — Revised Marking Scheme`);
      setVersionNotes('');
    }
  }, [activeAssessment?.id, activeAssessment?.activeSchemeVersion]);

  if (!activeAssessment) {
    return (
      <div className="bento-card p-10 text-center text-sm text-slate-500">
        Select an assessment to edit its marking scheme.
      </div>
    );
  }

  const updateCriterion = (qIdx: number, cIdx: number, field: string, value: any) => {
    setDraftQuestions((prev) =>
      prev.map((q, qi) => {
        if (qi !== qIdx) return q;
        const nextCriteria = q.criteria.map((c, ci) => (ci === cIdx ? { ...c, [field]: value } : c));
        const maxMarks = Math.round(nextCriteria.reduce((s, c) => s + Number(c.maxMarks || 0), 0) * 2) / 2;
        return { ...q, criteria: nextCriteria, maxMarks };
      })
    );
  };

  const addCriterion = (qIdx: number) => {
    setDraftQuestions((prev) =>
      prev.map((q, qi) => {
        if (qi !== qIdx) return q;
        const nextCriteria = [
          ...q.criteria,
          {
            id: `crit-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            description: 'Additional marking point',
            maxMarks: 1,
            importance: 'standard' as CriterionImportance,
          },
        ];
        const maxMarks = Math.round(nextCriteria.reduce((s, c) => s + c.maxMarks, 0) * 2) / 2;
        return { ...q, criteria: nextCriteria, maxMarks };
      })
    );
  };

  const deleteCriterion = (qIdx: number, cIdx: number) => {
    setDraftQuestions((prev) =>
      prev.map((q, qi) => {
        if (qi !== qIdx || q.criteria.length <= 1) return q;
        const nextCriteria = q.criteria.filter((_, ci) => ci !== cIdx);
        const maxMarks = Math.round(nextCriteria.reduce((s, c) => s + c.maxMarks, 0) * 2) / 2;
        return { ...q, criteria: nextCriteria, maxMarks };
      })
    );
  };

  const divideCriterion = (qIdx: number, cIdx: number) => {
    setDraftQuestions((prev) =>
      prev.map((q, qi) => {
        if (qi !== qIdx) return q;
        const target = q.criteria[cIdx];
        if (!target || target.maxMarks < 1) return q;
        const halfA = Math.round((target.maxMarks / 2) * 2) / 2;
        const halfB = Math.max(0.5, Math.round((target.maxMarks - halfA) * 2) / 2);
        const nextCriteria = [
          ...q.criteria.slice(0, cIdx),
          { ...target, description: `${target.description} (Part 1)`, maxMarks: halfA },
          {
            id: `crit-split-${Date.now()}`,
            description: `${target.description} (Part 2)`,
            maxMarks: halfB,
            importance: target.importance,
          },
          ...q.criteria.slice(cIdx + 1),
        ];
        const maxMarks = Math.round(nextCriteria.reduce((s, c) => s + c.maxMarks, 0) * 2) / 2;
        return { ...q, criteria: nextCriteria, maxMarks };
      })
    );
  };

  const combineWithNext = (qIdx: number, cIdx: number) => {
    setDraftQuestions((prev) =>
      prev.map((q, qi) => {
        if (qi !== qIdx || cIdx >= q.criteria.length - 1) return q;
        const first = q.criteria[cIdx];
        const second = q.criteria[cIdx + 1];
        const merged = {
          ...first,
          description: `${first.description} & ${second.description}`,
          maxMarks: Math.round((first.maxMarks + second.maxMarks) * 2) / 2,
        };
        const nextCriteria = [...q.criteria.slice(0, cIdx), merged, ...q.criteria.slice(cIdx + 2)];
        const maxMarks = Math.round(nextCriteria.reduce((s, c) => s + c.maxMarks, 0) * 2) / 2;
        return { ...q, criteria: nextCriteria, maxMarks };
      })
    );
  };

  const handleSaveAndRegrade = async () => {
    setSaving(true);
    setRegradeMessage(null);
    try {
      const updated = await regradeAssessmentScheme(activeAssessment.id, {
        questions: draftQuestions,
        label: versionLabel,
        notes: versionNotes,
      });

      const diffs: Array<{
        student: string;
        question: string;
        oldMarks: number;
        newMarks: number;
        explanation: string;
      }> = [];
      for (const sub of updated.submissions) {
        for (const ev of sub.evaluations) {
          if (ev.regradePreviousMarks !== null && ev.regradePreviousMarks !== undefined) {
            diffs.push({
              student: sub.studentName,
              question: `${ev.paperSet} · ${ev.questionNumber}`,
              oldMarks: ev.regradePreviousMarks,
              newMarks: ev.finalMarks,
              explanation: ev.regradeExplanation || '',
            });
          }
        }
      }
      setRegradeDiffs(diffs);
      onAssessmentUpdated(updated);
      setRegradeMessage(
        `Saved ${updated.schemeVersions[0]?.label || 'new marking scheme'} and recalculated ${updated.submissions.length} student submissions while preserving previous versions.`
      );
    } catch (err: any) {
      setRegradeMessage(err?.message || 'Failed to save marking scheme.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bento-hero p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-sky-700 dark:text-emerald-300">
            Flexible Rubric Editor &amp; Dynamic Regrade · Active v{activeAssessment.activeSchemeVersion}
          </div>
          <h1 className="font-display font-semibold text-2xl sm:text-3xl mt-1">
            Marking Scheme
          </h1>
          <p className="text-xs text-slate-600 dark:text-[#99A8A1] mt-1">
            Add, divide, combine, or re-weight criteria. Saving recalculates marks and preserves prior versions.
          </p>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={handleSaveAndRegrade}
          className="cta-primary px-5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          <span>Save Version &amp; Dynamic Regrade</span>
        </button>
      </div>

      {regradeMessage && (
        <div className="bento-card p-4 text-sm text-sky-800 dark:text-emerald-200 border-sky-300 dark:border-emerald-300/30">
          {regradeMessage}
        </div>
      )}

      {/* Version Metadata */}
      <div className="bento-card p-5 grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="scheme-label" className="block text-xs text-slate-500 dark:text-[#99A8A1] mb-1">
            New Version Label
          </label>
          <input
            id="scheme-label"
            type="text"
            value={versionLabel}
            onChange={(e) => setVersionLabel(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl text-sm bento-inset text-slate-900 dark:text-[#F2F6F4]"
          />
        </div>
        <div>
          <label htmlFor="scheme-notes" className="block text-xs text-slate-500 dark:text-[#99A8A1] mb-1">
            Change Reason / Notes
          </label>
          <input
            id="scheme-notes"
            type="text"
            placeholder="e.g., Adjusted weight for sunlight mechanism..."
            value={versionNotes}
            onChange={(e) => setVersionNotes(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl text-sm bento-inset text-slate-900 dark:text-[#F2F6F4]"
          />
        </div>
      </div>

      {/* Criteria Editor per Question */}
      <div className="space-y-4">
        {draftQuestions.map((q, qIdx) => (
          <div key={q.id} className="bento-card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-sky-700 dark:text-emerald-300">
                  {q.paperSet} · {q.questionNumber} · {q.topic}
                </div>
                <h2 className="font-display font-semibold text-base mt-0.5">{q.questionText}</h2>
              </div>
              <div className="font-mono-num text-sm font-semibold px-3 py-1.5 rounded-xl bento-inset">
                Max: {q.maxMarks} marks
              </div>
            </div>

            <div className="space-y-2.5">
              {q.criteria.map((c, cIdx) => (
                <div key={c.id} className="bento-inset p-3 flex flex-wrap lg:flex-nowrap items-center gap-2.5">
                  <input
                    type="text"
                    value={c.description}
                    aria-label={`Criterion description ${cIdx + 1}`}
                    onChange={(e) => updateCriterion(qIdx, cIdx, 'description', e.target.value)}
                    className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg text-sm bg-white/85 dark:bg-[#161D1A] border border-sky-200/70 dark:border-emerald-300/15"
                  />
                  <select
                    value={c.importance}
                    aria-label={`Criterion importance ${cIdx + 1}`}
                    onChange={(e) => updateCriterion(qIdx, cIdx, 'importance', e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg text-xs bg-white/85 dark:bg-[#161D1A] border border-sky-200/70 dark:border-emerald-300/15"
                  >
                    <option value="core">Core</option>
                    <option value="standard">Standard</option>
                    <option value="bonus">Bonus</option>
                  </select>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={c.maxMarks}
                    aria-label={`Criterion marks ${cIdx + 1}`}
                    onChange={(e) =>
                      updateCriterion(qIdx, cIdx, 'maxMarks', Math.max(0.5, Number(e.target.value) || 0.5))
                    }
                    className="w-20 px-2.5 py-1.5 rounded-lg text-sm font-mono-num bg-white/85 dark:bg-[#161D1A] border border-sky-200/70 dark:border-emerald-300/15"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      title="Divide criterion into two"
                      onClick={() => divideCriterion(qIdx, cIdx)}
                      className="p-1.5 rounded-lg hover:bg-sky-100 dark:hover:bg-[#2B3832] text-slate-600 dark:text-[#D3DDD8] cursor-pointer"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                    </button>
                    {cIdx < q.criteria.length - 1 && (
                      <button
                        type="button"
                        title="Combine with next criterion"
                        onClick={() => combineWithNext(qIdx, cIdx)}
                        className="p-1.5 rounded-lg hover:bg-sky-100 dark:hover:bg-[#2B3832] text-slate-600 dark:text-[#D3DDD8] cursor-pointer"
                      >
                        <GitMerge className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      title="Delete criterion"
                      onClick={() => deleteCriterion(qIdx, cIdx)}
                      className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => addCriterion(qIdx)}
              className="text-xs font-medium text-sky-700 dark:text-emerald-300 cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Criterion</span>
            </button>
          </div>
        ))}
      </div>

      {/* Dynamic Regrade Comparison Table */}
      {regradeDiffs.length > 0 && (
        <div className="bento-card p-6 space-y-3">
          <h2 className="font-display font-semibold text-lg">Old vs. New Regraded Marks</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-sky-200/70 dark:border-emerald-300/15 text-slate-500">
                  <th className="py-2.5 px-3">Student</th>
                  <th className="py-2.5 px-3">Question</th>
                  <th className="py-2.5 px-3 text-right">Previous</th>
                  <th className="py-2.5 px-3 text-right">Updated</th>
                  <th className="py-2.5 px-3">Explanation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100/70 dark:divide-emerald-300/10">
                {regradeDiffs.map((d, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 px-3 font-medium">{d.student}</td>
                    <td className="py-2.5 px-3">{d.question}</td>
                    <td className="py-2.5 px-3 text-right font-mono-num">{d.oldMarks}</td>
                    <td className="py-2.5 px-3 text-right font-mono-num font-semibold text-sky-700 dark:text-emerald-300">
                      {d.newMarks}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-[#99A8A1]">{d.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scheme Version History */}
      <div className="bento-card p-6 space-y-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-sky-600 dark:text-emerald-300" />
          <h2 className="font-display font-semibold text-lg">Saved Marking Scheme Versions</h2>
        </div>
        <div className="space-y-2">
          {activeAssessment.schemeVersions.map((v) => (
            <div key={v.id} className="bento-inset p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-semibold text-slate-900 dark:text-[#F2F6F4]">{v.label}</span>
                <span className="text-slate-500 dark:text-[#99A8A1] ml-2">{v.notes}</span>
              </div>
              <span className="font-mono-num text-slate-500 dark:text-[#99A8A1]">
                {v.createdAt.slice(0, 10)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
