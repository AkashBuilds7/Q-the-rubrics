import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  ExternalLink,
  FileWarning,
  FlaskConical,
  Search,
  X,
} from 'lucide-react';
import type { Assessment, PaperSet, StudentSubmission } from '../shared/types';
import { downloadStudentPdfReport } from '../utils/exportReports';

interface StudentsPageProps {
  activeAssessment: Assessment | null;
  onInspectStudentResult: (submissionId: string) => void;
}

export function StudentsPage({ activeAssessment, onInspectStudentResult }: StudentsPageProps) {
  const [search, setSearch] = useState('');
  const [setFilter, setSetFilter] = useState<'All' | PaperSet>('All');
  const [reportStudent, setReportStudent] = useState<StudentSubmission | null>(null);

  const submissions = activeAssessment?.submissions || [];
  const filtered = useMemo(() => {
    return submissions.filter((s) => {
      const matchSet = setFilter === 'All' || s.paperSet === setFilter;
      const matchQuery =
        !search.trim() ||
        s.studentName.toLowerCase().includes(search.toLowerCase()) ||
        s.studentIdCode.toLowerCase().includes(search.toLowerCase());
      return matchSet && matchQuery;
    });
  }, [submissions, setFilter, search]);

  const duplicateCount = submissions.filter((s) => s.isDuplicateSuspected).length;

  if (!activeAssessment) {
    return (
      <div className="bento-card p-10 text-center text-sm text-slate-600 dark:text-[#99A8A1]">
        No assessment selected.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bento-hero p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-sky-700 dark:text-emerald-300">
            <span>Student Roster &amp; Individual Reports</span>
            {activeAssessment.isDemo && (
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                · <FlaskConical className="w-3.5 h-3.5" /> Demonstration Data
              </span>
            )}
          </div>
          <h1 className="font-display font-semibold text-2xl sm:text-3xl mt-1">Students</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-xl text-xs bento-inset text-slate-900 dark:text-[#F2F6F4]"
            />
          </div>
          <select
            value={setFilter}
            onChange={(e) => setSetFilter(e.target.value as 'All' | PaperSet)}
            aria-label="Filter by paper set"
            className="px-3 py-2 rounded-xl text-xs bento-inset text-slate-900 dark:text-[#F2F6F4]"
          >
            <option value="All">All Sets</option>
            <option value="Set A">Set A</option>
            <option value="Set B">Set B</option>
            <option value="Set C">Set C</option>
            <option value="Set D">Set D</option>
          </select>
        </div>
      </div>

      {duplicateCount > 0 && (
        <div className="bento-card p-4 border-amber-300/80 dark:border-amber-400/30 flex items-center gap-3 text-xs text-amber-800 dark:text-amber-200">
          <FileWarning className="w-4 h-4 shrink-0" />
          <span>
            {duplicateCount} potential duplicate answer submission(s) detected by text similarity. Review flagged students below.
          </span>
        </div>
      )}

      <div className="bento-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-sky-200/70 dark:border-emerald-300/15 text-xs text-slate-500 dark:text-[#99A8A1]">
                <th className="py-3.5 px-5 font-medium">Student</th>
                <th className="py-3.5 px-4 font-medium">Paper Set</th>
                <th className="py-3.5 px-4 font-medium">Language</th>
                <th className="py-3.5 px-4 font-medium text-right">Score</th>
                <th className="py-3.5 px-4 font-medium text-right">Percentage</th>
                <th className="py-3.5 px-4 font-medium">Attempted</th>
                <th className="py-3.5 px-4 font-medium">Status</th>
                <th className="py-3.5 px-5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100/80 dark:divide-emerald-300/10">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-sky-50/50 dark:hover:bg-[#242F2A]/50 transition-colors">
                  <td className="py-3.5 px-5">
                    <div className="font-medium text-slate-900 dark:text-[#F2F6F4]">{s.studentName}</div>
                    <div className="text-xs text-slate-500 dark:text-[#99A8A1]">
                      {s.studentIdCode}
                      {s.isDuplicateSuspected ? ` · Possible duplicate of ${s.duplicateOfName}` : ''}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs">{s.paperSet}</td>
                  <td className="py-3.5 px-4 text-xs">{s.language}</td>
                  <td className="py-3.5 px-4 text-right font-mono-num font-medium">
                    {s.finalTotalMarks} / {s.maxTotalMarks}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono-num font-semibold text-sky-700 dark:text-emerald-300">
                    {s.percentage}% ({s.grade})
                  </td>
                  <td className="py-3.5 px-4 font-mono-num text-xs">
                    {s.questionsAttempted} / {s.questionsTotal}
                    {s.questionsAttempted < s.questionsTotal && (
                      <span className="ml-1.5 text-amber-700 dark:text-amber-300">· Missing answer</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-xs">
                    {s.reviewRequiredCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {s.reviewRequiredCount} review
                      </span>
                    ) : (
                      <span className="text-emerald-700 dark:text-emerald-300 font-medium">Completed</span>
                    )}
                  </td>
                  <td className="py-3.5 px-5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setReportStudent(s)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bento-inset hover:bg-sky-100/70 dark:hover:bg-[#2B3832] cursor-pointer"
                      >
                        Report
                      </button>
                      <button
                        type="button"
                        onClick={() => onInspectStudentResult(s.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-sky-700 dark:text-emerald-300 hover:underline cursor-pointer inline-flex items-center gap-1"
                      >
                        <span>Answers</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sm text-slate-500 dark:text-[#99A8A1]">
                    No students match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual Student Report Modal */}
      {reportStudent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Student Report for ${reportStudent.studentName}`}
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bento-hero max-w-3xl w-full p-6 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-sky-700 dark:text-emerald-300">
                  Individual Student Report {reportStudent.isDemo ? '· Demonstration Data' : ''}
                </div>
                <h2 className="font-display font-semibold text-2xl mt-0.5">
                  {reportStudent.studentName} ({reportStudent.studentIdCode})
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#99A8A1] mt-1">
                  {activeAssessment.subject} · {activeAssessment.className} · {reportStudent.paperSet} · {activeAssessment.title}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => downloadStudentPdfReport(activeAssessment, reportStudent)}
                  className="cta-primary px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  aria-label="Close report modal"
                  onClick={() => setReportStudent(null)}
                  className="p-2 rounded-xl bento-inset cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Overall Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bento-inset p-3.5">
                <div className="text-[11px] text-slate-500 dark:text-[#99A8A1]">Marks Obtained</div>
                <div className="font-mono-num font-semibold text-xl mt-1">
                  {reportStudent.finalTotalMarks} / {reportStudent.maxTotalMarks}
                </div>
              </div>
              <div className="bento-inset p-3.5">
                <div className="text-[11px] text-slate-500 dark:text-[#99A8A1]">Percentage</div>
                <div className="font-mono-num font-semibold text-xl text-sky-700 dark:text-emerald-300 mt-1">
                  {reportStudent.percentage}%
                </div>
              </div>
              <div className="bento-inset p-3.5">
                <div className="text-[11px] text-slate-500 dark:text-[#99A8A1]">Grade</div>
                <div className="font-mono-num font-semibold text-xl mt-1">{reportStudent.grade}</div>
              </div>
              <div className="bento-inset p-3.5">
                <div className="text-[11px] text-slate-500 dark:text-[#99A8A1]">Attempted</div>
                <div className="font-mono-num font-semibold text-xl mt-1">
                  {reportStudent.questionsAttempted} / {reportStudent.questionsTotal}
                </div>
              </div>
            </div>

            {/* Performance Analysis Dimensions */}
            {(() => {
              const evals = reportStudent.evaluations;
              const conceptualPct = Math.round(reportStudent.percentage);
              const incorrectCount = evals.reduce((a, e) => a + e.incorrectStatements.length, 0);
              const accuracyPct = Math.max(0, Math.min(100, conceptualPct - incorrectCount * 8));
              const attemptedRatio =
                evals.length > 0 ? Math.round((reportStudent.questionsAttempted / evals.length) * 100) : 0;
              const strengths = evals
                .filter((e) => e.maxMarks > 0 && e.finalMarks / e.maxMarks >= 0.75)
                .map((e) => `${e.questionNumber} (${e.topic})`);
              const weakAreas = evals
                .filter((e) => e.maxMarks > 0 && e.finalMarks / e.maxMarks < 0.65)
                .map((e) => `${e.questionNumber} (${e.topic})`);
              const missingList = evals.flatMap((e) => e.missingConcepts).slice(0, 5);

              return (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bento-inset p-4 space-y-2.5">
                    <h3 className="font-display font-semibold text-sm">Performance Dimensions</h3>
                    {[
                      { label: 'Conceptual Understanding', val: conceptualPct },
                      { label: 'Factual Accuracy', val: accuracyPct },
                      { label: 'Subject Knowledge', val: Math.round((conceptualPct + accuracyPct) / 2) },
                      { label: 'Explanation Quality', val: Math.min(100, conceptualPct + 4) },
                      { label: 'Completeness & Coverage', val: attemptedRatio },
                    ].map((dim) => (
                      <div key={dim.label} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{dim.label}</span>
                          <span className="font-mono-num">{dim.val}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-sky-600 dark:bg-emerald-400"
                            style={{ width: `${dim.val}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bento-inset p-4 space-y-2.5 text-xs">
                    <h3 className="font-display font-semibold text-sm">Learning Insights</h3>
                    <div>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-300">Strengths: </span>
                      <span>{strengths.length > 0 ? strengths.join(', ') : 'Developing foundational understanding'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-amber-700 dark:text-amber-300">Topics to Revise: </span>
                      <span>{weakAreas.length > 0 ? weakAreas.join(', ') : 'Strong across all evaluated topics'}</span>
                    </div>
                    {missingList.length > 0 && (
                      <div>
                        <span className="font-semibold">Key Concepts Missed: </span>
                        <span>{missingList.join('; ')}</span>
                      </div>
                    )}
                    <div>
                      <span className="font-semibold">Teacher Comments: </span>
                      <span>
                        {evals
                          .map((e) => e.teacherComment)
                          .filter(Boolean)
                          .join(' | ') || 'No manual override notes added yet.'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
