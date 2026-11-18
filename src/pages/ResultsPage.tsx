import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Download,
  Edit3,
  FileText,
  FlaskConical,
  HelpCircle,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import type {
  Assessment,
  ConfidenceLevel,
  CriterionStatus,
  PaperSet,
  QuestionEvaluation,
  StudentSubmission,
} from '../shared/types';
import { reviewEvaluation } from '../utils/api';
import { downloadStudentPdfReport } from '../utils/exportReports';

interface ResultsPageProps {
  assessments: Assessment[];
  activeAssessment: Assessment | null;
  onSelectAssessment: (id: string) => void;
  onSubmissionUpdated: (updatedSubmission: StudentSubmission) => void;
  selectedSubmissionId?: string | null;
}

function renderHighlightedAnswer(answerText: string, evidences: string[]): React.ReactNode {
  if (!answerText.trim()) {
    return <span className="italic text-slate-400 dark:text-[#6C7B74]">(Question not attempted by student)</span>;
  }

  const validQuotes = evidences
    .map((e) => e.trim())
    .filter((e) => e.length >= 4 && answerText.toLowerCase().includes(e.toLowerCase()));

  if (validQuotes.length === 0) {
    return answerText;
  }

  // Highlight first matching occurrences cleanly without overlapping spans
  const lower = answerText.toLowerCase();
  const ranges: Array<{ start: number; end: number }> = [];

  for (const quote of validQuotes) {
    const idx = lower.indexOf(quote.toLowerCase());
    if (idx !== -1) {
      const end = idx + quote.length;
      const overlaps = ranges.some((r) => !(end <= r.start || idx >= r.end));
      if (!overlaps) {
        ranges.push({ start: idx, end });
      }
    }
  }

  if (ranges.length === 0) return answerText;
  ranges.sort((a, b) => a.start - b.start);

  const segments: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((r, i) => {
    if (r.start > cursor) {
      segments.push(<span key={`t-${i}`}>{answerText.slice(cursor, r.start)}</span>);
    }
    segments.push(
      <mark
        key={`m-${i}`}
        className="px-1 py-0.5 rounded bg-sky-200/75 dark:bg-emerald-400/25 text-slate-900 dark:text-[#F2F6F4]"
      >
        {answerText.slice(r.start, r.end)}
      </mark>
    );
    cursor = r.end;
  });
  if (cursor < answerText.length) {
    segments.push(<span key="t-end">{answerText.slice(cursor)}</span>);
  }
  return segments;
}

function ConfidenceIndicator({ level }: { level: ConfidenceLevel }) {
  if (level === 'high') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>High confidence</span>
      </span>
    );
  }
  if (level === 'needs_checking') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
        <HelpCircle className="w-4 h-4 shrink-0" />
        <span>Needs checking</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 dark:text-rose-300">
      <ShieldAlert className="w-4 h-4 shrink-0" />
      <span>Teacher review required</span>
    </span>
  );
}

function CriterionBadge({ status }: { status: CriterionStatus }) {
  if (status === 'correct') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>Correct</span>
      </span>
    );
  }
  if (status === 'partially_correct') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>Partially correct</span>
      </span>
    );
  }
  if (status === 'missing') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-[#99A8A1]">
        <HelpCircle className="w-3.5 h-3.5 shrink-0" />
        <span>Missing</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 dark:text-rose-300">
      <XCircle className="w-3.5 h-3.5 shrink-0" />
      <span>Incorrect</span>
    </span>
  );
}

export function ResultsPage({
  assessments,
  activeAssessment,
  onSelectAssessment,
  onSubmissionUpdated,
  selectedSubmissionId,
}: ResultsPageProps) {
  const [setFilter, setSetFilter] = useState<'All' | PaperSet>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [subId, setSubId] = useState<string>('');
  const [questionIdx, setQuestionIdx] = useState<number>(0);

  // Teacher Review & Edit Marks state
  const [isEditingMarks, setIsEditingMarks] = useState(false);
  const [editedMarksInput, setEditedMarksInput] = useState<string>('');
  const [teacherCommentInput, setTeacherCommentInput] = useState<string>('');
  const [savingReview, setSavingReview] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [showDocRef, setShowDocRef] = useState(false);

  const filteredSubmissions = useMemo(() => {
    const subs = activeAssessment?.submissions || [];
    return subs.filter((s) => {
      const matchesSet = setFilter === 'All' || s.paperSet === setFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.studentIdCode.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSet && matchesSearch;
    });
  }, [activeAssessment, setFilter, searchQuery]);

  useEffect(() => {
    if (selectedSubmissionId && filteredSubmissions.some((s) => s.id === selectedSubmissionId)) {
      setSubId(selectedSubmissionId);
      setQuestionIdx(0);
    } else if (!filteredSubmissions.some((s) => s.id === subId)) {
      setSubId(filteredSubmissions[0]?.id || '');
      setQuestionIdx(0);
    }
  }, [filteredSubmissions, selectedSubmissionId, subId]);

  const activeSub = filteredSubmissions.find((s) => s.id === subId) || filteredSubmissions[0] || null;
  const activeEval: QuestionEvaluation | null = activeSub?.evaluations[questionIdx] || activeSub?.evaluations[0] || null;

  useEffect(() => {
    if (activeEval) {
      setEditedMarksInput(String(activeEval.finalMarks));
      setTeacherCommentInput(activeEval.teacherComment || '');
      setIsEditingMarks(false);
      setSaveNotice(null);
    }
  }, [activeEval?.id]);

  const handleSaveReview = async (approveFlag: boolean) => {
    if (!activeEval) return;
    const numeric = Number(editedMarksInput);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > activeEval.maxMarks) {
      setSaveNotice(`Please enter valid marks between 0 and ${activeEval.maxMarks}.`);
      return;
    }
    setSavingReview(true);
    setSaveNotice(null);
    try {
      const updated = await reviewEvaluation(activeEval.id, {
        teacherEditedMarks: numeric,
        teacherComment: teacherCommentInput,
        isApproved: approveFlag,
      });
      onSubmissionUpdated(updated);
      setIsEditingMarks(false);
      setSaveNotice(approveFlag ? 'Marks saved and evaluation approved.' : 'Updated marks saved.');
    } catch (err: any) {
      setSaveNotice(err?.message || 'Failed to save review.');
    } finally {
      setSavingReview(false);
    }
  };

  if (!activeAssessment || activeAssessment.submissions.length === 0) {
    return (
      <div className="bento-card p-10 text-center space-y-3">
        <h1 className="font-display font-semibold text-2xl">No Graded Results Yet</h1>
        <p className="text-sm text-slate-600 dark:text-[#99A8A1]">
          Select an assessment with evaluated student submissions or start a new evaluation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Control & Action Bar */}
      <div className="bento-hero p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-sky-700 dark:text-emerald-300">
              <span>Transparent Grading Results</span>
              {activeAssessment.isDemo && (
                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                  · <FlaskConical className="w-3.5 h-3.5" /> Demonstration Data
                </span>
              )}
            </div>
            <h1 className="font-display font-semibold text-2xl mt-0.5">{activeAssessment.title}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {activeSub && (
              <button
                type="button"
                onClick={() => downloadStudentPdfReport(activeAssessment, activeSub)}
                className="px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer inline-flex items-center gap-2 border border-sky-200/80 dark:border-emerald-300/20 bg-white/85 dark:bg-[#242F2A]/85 text-slate-800 dark:text-[#F2F6F4] hover:bg-sky-50 dark:hover:bg-[#2B3832]"
              >
                <Download className="w-4 h-4 shrink-0 text-sky-600 dark:text-emerald-300" />
                <span>Download Student Report</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsEditingMarks((v) => !v)}
              className="cta-primary px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer inline-flex items-center gap-2"
            >
              <Edit3 className="w-4 h-4 shrink-0" />
              <span>Review and Edit Marks</span>
            </button>
          </div>
        </div>

        {/* Selectors Row */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-sky-200/60 dark:border-emerald-300/12">
          <div>
            <label htmlFor="res-assess" className="block text-[11px] text-slate-500 dark:text-[#99A8A1] mb-1">
              Assessment
            </label>
            <select
              id="res-assess"
              value={activeAssessment.id}
              onChange={(e) => onSelectAssessment(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs bento-inset text-slate-900 dark:text-[#F2F6F4]"
            >
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="res-set" className="block text-[11px] text-slate-500 dark:text-[#99A8A1] mb-1">
              Question Paper Set
            </label>
            <select
              id="res-set"
              value={setFilter}
              onChange={(e) => setSetFilter(e.target.value as 'All' | PaperSet)}
              className="w-full px-3 py-2 rounded-xl text-xs bento-inset text-slate-900 dark:text-[#F2F6F4]"
            >
              <option value="All">All Sets</option>
              <option value="Set A">Set A</option>
              <option value="Set B">Set B</option>
              <option value="Set C">Set C</option>
              <option value="Set D">Set D</option>
            </select>
          </div>

          <div>
            <label htmlFor="res-student" className="block text-[11px] text-slate-500 dark:text-[#99A8A1] mb-1">
              Student
            </label>
            <select
              id="res-student"
              value={activeSub?.id || ''}
              onChange={(e) => {
                setSubId(e.target.value);
                setQuestionIdx(0);
              }}
              className="w-full px-3 py-2 rounded-xl text-xs bento-inset text-slate-900 dark:text-[#F2F6F4]"
            >
              {filteredSubmissions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.studentName} ({s.paperSet}) — {s.finalTotalMarks}/{s.maxTotalMarks}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="res-search" className="block text-[11px] text-slate-500 dark:text-[#99A8A1] mb-1">
              Filter Student
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="res-search"
                type="text"
                placeholder="Name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl text-xs bento-inset text-slate-900 dark:text-[#F2F6F4]"
              />
            </div>
          </div>
        </div>

        {/* Question Tabs */}
        {activeSub && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {activeSub.evaluations.map((ev, idx) => {
              const isSelected = idx === questionIdx;
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => setQuestionIdx(idx)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap cursor-pointer flex items-center gap-2 border ${
                    isSelected
                      ? 'bg-sky-600 border-sky-600 text-white dark:bg-emerald-400 dark:border-emerald-400 dark:text-[#0B1913]'
                      : 'bg-sky-50/75 dark:bg-[#242F2A]/75 border-sky-200/70 dark:border-emerald-300/15 text-slate-700 dark:text-[#D3DDD8] hover:bg-sky-100/80 dark:hover:bg-[#2B3832]'
                  }`}
                >
                  <span>{ev.questionNumber}</span>
                  <span className="font-mono-num opacity-90">
                    {ev.finalMarks}/{ev.maxMarks}
                  </span>
                  {ev.confidenceLevel !== 'high' && !ev.isApproved && (
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* TWO-COLUMN BENTO GRID: LEFT = STUDENT ANSWER, RIGHT = AI EVALUATION */}
      {activeSub && activeEval && (
        <div className="grid lg:grid-cols-12 gap-5 items-start">
          {/* LEFT PANEL — STUDENT ANSWER */}
          <section
            aria-label="Student Answer Panel"
            className="lg:col-span-5 bento-card p-6 space-y-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-sky-700 dark:text-emerald-300">
                  Student Answer · {activeEval.paperSet}
                </div>
                <h2 className="font-display font-semibold text-lg mt-0.5">
                  {activeSub.studentName} · {activeSub.studentIdCode}
                </h2>
                <div className="text-xs text-slate-500 dark:text-[#99A8A1] mt-0.5">
                  Language: {activeSub.language} · Overall: <span className="font-mono-num">{activeSub.finalTotalMarks}/{activeSub.maxTotalMarks} ({activeSub.percentage}%)</span>
                </div>
              </div>
            </div>

            {activeSub.ocrWarnings.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-100/70 dark:bg-amber-950/35 border border-amber-300/70 dark:border-amber-400/30 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>{activeSub.ocrWarnings.join(' ')}</div>
              </div>
            )}

            <div className="bento-inset p-4 space-y-1.5">
              <div className="text-xs font-medium text-slate-500 dark:text-[#99A8A1]">
                {activeEval.questionNumber} · {activeEval.topic} (Max {activeEval.maxMarks} marks)
              </div>
              <div className="text-sm font-medium text-slate-900 dark:text-[#F2F6F4] leading-relaxed">
                {activeEval.questionText}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600 dark:text-[#99A8A1]">
                  Original Student Answer (Highlighted Evidence)
                </span>
                <button
                  type="button"
                  onClick={() => setShowDocRef((v) => !v)}
                  className="text-xs font-medium text-sky-700 dark:text-emerald-300 hover:underline cursor-pointer inline-flex items-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{showDocRef ? 'Hide Source Ref' : 'Source Document'}</span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-white/80 dark:bg-[#161D1A] border border-sky-200/70 dark:border-emerald-300/15 student-answer-prose">
                {renderHighlightedAnswer(
                  activeEval.originalStudentAnswer,
                  activeEval.criteriaResults.map((c) => c.supportingEvidence)
                )}
              </div>

              {activeEval.extractedUncertainText && (
                <div className="text-xs text-amber-700 dark:text-amber-300">
                  Flagged uncertain phrase: <span className="font-mono-num">{activeEval.extractedUncertainText}</span>
                </div>
              )}

              {showDocRef && (
                <div className="bento-inset p-3 text-xs text-slate-600 dark:text-[#99A8A1] space-y-1">
                  <div>Source file: {activeSub.sourceFileName}</div>
                  {activeSub.sourceFileUrl ? (
                    <a
                      href={activeSub.sourceFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-700 dark:text-emerald-300 underline"
                    >
                      Open preserved uploaded file
                    </a>
                  ) : (
                    <div>Preserved reference text stored with this assessment record.</div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* RIGHT PANEL — AI EVALUATION */}
          <section
            aria-label="AI Evaluation Panel"
            className="lg:col-span-7 bento-card p-6 space-y-5"
          >
            {/* Score & Confidence Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-sky-200/60 dark:border-emerald-300/12">
              <div className="space-y-1">
                <ConfidenceIndicator level={activeEval.confidenceLevel} />
                <p className="text-xs text-slate-500 dark:text-[#99A8A1] max-w-md">
                  {activeEval.confidenceReason}
                </p>
              </div>

              <div className="text-right">
                <div className="text-xs text-slate-500 dark:text-[#99A8A1]">
                  {activeEval.teacherEditedMarks !== null ? 'Teacher-Adjusted Marks' : 'AI Awarded Marks'}
                </div>
                <div className="font-mono-num font-semibold text-2xl sm:text-3xl text-slate-900 dark:text-[#F2F6F4]">
                  {activeEval.finalMarks} <span className="text-base text-slate-500">/ {activeEval.maxMarks}</span>
                </div>
                {activeEval.teacherEditedMarks !== null && (
                  <div className="text-[11px] font-mono-num text-slate-500 dark:text-[#99A8A1]">
                    Original AI score: {activeEval.aiAwardedMarks} · {activeEval.isApproved ? 'Approved' : 'Draft edit'}
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic Regrade Notice if applicable */}
            {activeEval.regradeExplanation && (
              <div className="p-3.5 rounded-xl bg-sky-500/10 dark:bg-emerald-400/12 border border-sky-300/60 dark:border-emerald-300/25 text-xs text-slate-800 dark:text-[#D3DDD8]">
                <span className="font-semibold">Marking Scheme Regrade Applied: </span>
                {activeEval.regradeExplanation}
              </div>
            )}

            {/* Teacher Review & Edit Marks Drawer */}
            {isEditingMarks && (
              <div className="bento-inset p-4 space-y-3 border-sky-400/60 dark:border-emerald-300/35">
                <div className="font-display font-semibold text-sm">Teacher Review &amp; Mark Override</div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="edit-marks" className="block text-xs text-slate-600 dark:text-[#99A8A1] mb-1">
                      Final Marks (0 – {activeEval.maxMarks})
                    </label>
                    <input
                      id="edit-marks"
                      type="number"
                      step="0.5"
                      min="0"
                      max={activeEval.maxMarks}
                      value={editedMarksInput}
                      onChange={(e) => setEditedMarksInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-sm font-mono-num bg-white dark:bg-[#161D1A] border border-sky-200 dark:border-emerald-300/20"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="edit-comment" className="block text-xs text-slate-600 dark:text-[#99A8A1] mb-1">
                      Teacher Comment (Optional)
                    </label>
                    <input
                      id="edit-comment"
                      type="text"
                      placeholder="Explain mark adjustment or add personal guidance..."
                      value={teacherCommentInput}
                      onChange={(e) => setTeacherCommentInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-sm bg-white dark:bg-[#161D1A] border border-sky-200 dark:border-emerald-300/20"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={savingReview}
                    onClick={() => handleSaveReview(true)}
                    className="cta-primary px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save &amp; Approve Evaluation</span>
                  </button>
                  <button
                    type="button"
                    disabled={savingReview}
                    onClick={() => handleSaveReview(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium bento-card cursor-pointer"
                  >
                    Save Draft Marks
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingMarks(false)}
                    className="px-3 py-2 text-xs text-slate-500 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {saveNotice && (
              <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{saveNotice}</div>
            )}

            {/* AI Conceptual Summary */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="bento-inset p-3.5 space-y-1">
                <div className="text-[11px] font-medium text-slate-500 dark:text-[#99A8A1]">
                  AI Summary of Student Answer
                </div>
                <p className="text-xs leading-relaxed text-slate-800 dark:text-[#D3DDD8]">
                  {activeEval.studentSummary}
                </p>
              </div>
              <div className="bento-inset p-3.5 space-y-1">
                <div className="text-[11px] font-medium text-slate-500 dark:text-[#99A8A1]">
                  Conceptual Assessment
                </div>
                <p className="text-xs leading-relaxed text-slate-800 dark:text-[#D3DDD8]">
                  {activeEval.conceptualUnderstanding}
                </p>
              </div>
            </div>

            {/* Individual Marking Criteria Breakdown */}
            <div className="space-y-2.5">
              <h3 className="font-display font-semibold text-sm">Individual Marking Points</h3>
              <div className="space-y-2">
                {activeEval.criteriaResults.map((crit) => (
                  <div key={crit.criterionId} className="bento-inset p-3.5 space-y-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="font-medium text-sm text-slate-900 dark:text-[#F2F6F4] flex-1 min-w-0">
                        {crit.description}
                      </div>
                      <div className="flex items-center gap-3 shrink-0 whitespace-nowrap">
                        <CriterionBadge status={crit.status} />
                        <span className="font-mono-num text-xs font-semibold text-slate-900 dark:text-[#F2F6F4]">
                          {crit.awardedMarks} / {crit.maxMarks}
                        </span>
                      </div>
                    </div>
                    {crit.supportingEvidence && (
                      <div className="text-xs text-sky-800 dark:text-emerald-200">
                        Evidence: “{crit.supportingEvidence}”
                      </div>
                    )}
                    <div className="text-xs text-slate-600 dark:text-[#99A8A1]">{crit.reasoning}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Incorrect Statements & Missing Concepts */}
            {(activeEval.incorrectStatements.length > 0 || activeEval.missingConcepts.length > 0) && (
              <div className="grid sm:grid-cols-2 gap-3">
                {activeEval.incorrectStatements.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-500/25 space-y-1.5">
                    <div className="text-xs font-semibold text-rose-800 dark:text-rose-200">
                      Incorrect Statements
                    </div>
                    <ul className="text-xs text-rose-700 dark:text-rose-200 space-y-1 list-disc pl-4">
                      {activeEval.incorrectStatements.map((st, i) => (
                        <li key={i}>{st}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {activeEval.missingConcepts.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-500/25 space-y-1.5">
                    <div className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                      Missing Key Concepts
                    </div>
                    <ul className="text-xs text-amber-800 dark:text-amber-200 space-y-1 list-disc pl-4">
                      {activeEval.missingConcepts.map((mc, i) => (
                        <li key={i}>{mc}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Constructive Student Feedback */}
            <div className="p-4 rounded-xl bg-sky-500/10 dark:bg-emerald-400/10 border border-sky-300/60 dark:border-emerald-300/20 space-y-1">
              <div className="text-xs font-semibold text-sky-800 dark:text-emerald-300">
                Feedback for Student
              </div>
              <p className="text-sm leading-relaxed text-slate-800 dark:text-[#D3DDD8]">
                {activeEval.feedback}
              </p>
              {activeEval.teacherComment && (
                <p className="text-xs text-slate-600 dark:text-[#99A8A1] pt-1 border-t border-sky-200/60 dark:border-emerald-300/15 mt-2">
                  Teacher note: {activeEval.teacherComment}
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
