import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { EDUCATION_LEVELS, PAPER_SETS, SUBJECTS, SUPPORTED_LANGUAGES } from '../shared/constants';
import type {
  AppSettings,
  Assessment,
  EducationLevel,
  ExtractedDocumentResult,
  PaperSet,
  SubmissionStatus,
} from '../shared/types';
import {
  createAssessment,
  evaluateSubmissions,
  uploadAndExtractDocument,
} from '../utils/api';

interface NewEvaluationPageProps {
  settings: AppSettings;
  onEvaluationComplete: (assessment: Assessment) => void;
}

interface EditableQuestionDraft {
  id: string;
  questionNumber: string;
  paperSet: PaperSet;
  topic: string;
  questionText: string;
  modelAnswer: string;
  criteria: Array<{ description: string; maxMarks: number; importance: 'core' | 'standard' | 'bonus' }>;
}

interface StudentDraft {
  id: string;
  studentName: string;
  studentIdCode: string;
  paperSet: PaperSet;
  language: string;
  sourceFileName: string;
  sourceFileUrl?: string;
  ocrWarnings: string[];
  missingPages: number[];
  answers: Array<{ questionNumber: string; answerText: string; uncertainText?: string }>;
  batchStatus: SubmissionStatus;
  errorMessage?: string;
}

const ACCEPTED_TYPES = '.pdf,.docx,.doc,.txt,.csv,.xlsx,.jpg,.jpeg,.png,.webp';

export function NewEvaluationPage({ settings, onEvaluationComplete }: NewEvaluationPageProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Assessment Setup
  const [title, setTitle] = useState('Unit Test — Conceptual Assessment');
  const [subject, setSubject] = useState(settings.defaultSubject || 'Biology');
  const [customSubject, setCustomSubject] = useState('');
  const [educationLevel, setEducationLevel] = useState<EducationLevel>(settings.defaultEducationLevel || 'secondary');
  const [language, setLanguage] = useState(settings.defaultLanguage || 'English');
  const [className, setClassName] = useState('Grade 10 — Section A');
  const [examDate, setExamDate] = useState(new Date().toISOString().slice(0, 10));
  const [defaultPaperSet, setDefaultPaperSet] = useState<PaperSet>('Set A');

  // Uploaded documents & previews
  const [extractedDocs, setExtractedDocs] = useState<ExtractedDocumentResult[]>([]);
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [previewDoc, setPreviewDoc] = useState<ExtractedDocumentResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Editable structured questions & student sheets
  const [questions, setQuestions] = useState<EditableQuestionDraft[]>([
    {
      id: 'draft-q1',
      questionNumber: 'Q1',
      paperSet: 'Set A',
      topic: 'Core Concept',
      questionText: 'What is photosynthesis? Explain the process and its inputs and outputs.',
      modelAnswer:
        'Photosynthesis is the process where green plants convert sunlight into chemical energy using chlorophyll, taking in carbon dioxide and water to produce glucose and oxygen.',
      criteria: [
        { description: 'Energy conversion meaning (light to chemical)', maxMarks: 1.5, importance: 'core' },
        { description: 'Role of sunlight & chlorophyll', maxMarks: 1.5, importance: 'standard' },
        { description: 'Inputs (CO2 & water) and outputs (glucose & oxygen)', maxMarks: 2, importance: 'core' },
      ],
    },
  ]);

  const [students, setStudents] = useState<StudentDraft[]>([
    {
      id: 'draft-s1',
      studentName: 'Sample Student',
      studentIdCode: 'STU-201',
      paperSet: 'Set A',
      language: settings.defaultLanguage || 'English',
      sourceFileName: 'manual_entry.txt',
      ocrWarnings: [],
      missingPages: [],
      answers: [
        {
          questionNumber: 'Q1',
          answerText:
            'Plants absorb sunlight with chlorophyll in their leaves and combine water and carbon dioxide to make sugar (glucose) while releasing oxygen.',
        },
      ],
      batchStatus: 'waiting',
    },
  ]);

  const [isEvaluating, setIsEvaluating] = useState(false);
  const [completedAssessment, setCompletedAssessment] = useState<Assessment | null>(null);

  const selectedLangInfo = SUPPORTED_LANGUAGES.find((l) => l.name === language);

  const handleFileUpload = async (
    files: FileList | null,
    category: 'question_paper' | 'model_answers' | 'marking_scheme' | 'student_sheet'
  ) => {
    if (!files || files.length === 0) return;
    setErrorMsg(null);
    setUploadingCategory(category);
    setUploadProgress(20);

    try {
      const results: ExtractedDocumentResult[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 15 * 1024 * 1024) {
          throw new Error(`"${file.name}" exceeds the 15 MB upload limit.`);
        }
        setUploadProgress(Math.round(((i + 0.5) / files.length) * 85));
        const extracted = await uploadAndExtractDocument(file, category, language);
        results.push(extracted);
      }
      setUploadProgress(100);
      setExtractedDocs((prev) => [...prev, ...results]);

      // Merge extracted structured data into drafts
      for (const doc of results) {
        if (doc.parsedQuestions && doc.parsedQuestions.length > 0) {
          if (category === 'question_paper' || category === 'marking_scheme') {
            setQuestions(
              doc.parsedQuestions.map((pq, idx) => ({
                id: `ext-q-${Date.now()}-${idx}`,
                questionNumber: pq.questionNumber || `Q${idx + 1}`,
                paperSet: doc.detectedSet || defaultPaperSet,
                topic: pq.topic || (subject === 'Custom Subject' ? customSubject || 'General' : subject),
                questionText: pq.questionText || '',
                modelAnswer: pq.modelAnswer || '',
                criteria:
                  pq.criteria && pq.criteria.length > 0
                    ? pq.criteria.map((c) => ({
                        description: c.description,
                        maxMarks: Math.max(0.5, Number(c.maxMarks) || 1),
                        importance: 'standard' as const,
                      }))
                    : [
                        {
                          description: 'Conceptual accuracy and completeness',
                          maxMarks: Math.max(1, Number(pq.maxMarks) || 5),
                          importance: 'core' as const,
                        },
                      ],
              }))
            );
          } else if (category === 'model_answers') {
            setQuestions((prev) =>
              prev.map((q) => {
                const match = doc.parsedQuestions?.find(
                  (pq) => pq.questionNumber.toLowerCase() === q.questionNumber.toLowerCase()
                );
                return match?.modelAnswer ? { ...q, modelAnswer: match.modelAnswer } : q;
              })
            );
          }
        }

        if (category === 'student_sheet') {
          const newDraft: StudentDraft = {
            id: `stu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            studentName: doc.detectedStudentName || doc.fileName.replace(/\.[^.]+$/, ''),
            studentIdCode: doc.detectedStudentId || `STU-${Math.floor(200 + Math.random() * 700)}`,
            paperSet: doc.detectedSet || defaultPaperSet,
            language: doc.detectedLanguage || language,
            sourceFileName: doc.fileName,
            sourceFileUrl: doc.storedFileUrl,
            ocrWarnings: doc.uncertainWarnings,
            missingPages: doc.missingPages,
            answers:
              doc.parsedAnswers && doc.parsedAnswers.length > 0
                ? doc.parsedAnswers
                : [{ questionNumber: questions[0]?.questionNumber || 'Q1', answerText: doc.rawText }],
            batchStatus: 'waiting',
          };
          setStudents((prev) => {
            // Replace initial sample stub if untouched
            if (prev.length === 1 && prev[0].id === 'draft-s1') {
              return [newDraft];
            }
            return [...prev, newDraft];
          });
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Document upload or extraction failed.');
    } finally {
      setUploadingCategory(null);
      setTimeout(() => setUploadProgress(0), 600);
    }
  };

  const removeExtractedDoc = (fileName: string) => {
    setExtractedDocs((prev) => prev.filter((d) => d.fileName !== fileName));
  };

  const handleRunEvaluation = async () => {
    setErrorMsg(null);
    setStep(4);
    setIsEvaluating(true);

    try {
      const resolvedSubject = subject === 'Custom Subject' ? customSubject.trim() || 'General' : subject;
      const created = await createAssessment({
        title: title.trim() || 'Untitled Assessment',
        subject: resolvedSubject,
        educationLevel,
        language,
        className: className.trim() || 'Class',
        examDate,
        questions: questions.map((q) => ({
          questionNumber: q.questionNumber,
          paperSet: q.paperSet,
          topic: q.topic,
          questionText: q.questionText,
          modelAnswer: q.modelAnswer,
          maxMarks: q.criteria.reduce((acc, c) => acc + c.maxMarks, 0),
          criteria: q.criteria,
        })),
      });

      const evaluatedSubs = [];
      for (let i = 0; i < students.length; i++) {
        const s = students[i];
        setStudents((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, batchStatus: 'processing' } : item))
        );
        try {
          const resSubs = await evaluateSubmissions({
            assessmentId: created.id,
            submissions: [
              {
                studentName: s.studentName,
                studentIdCode: s.studentIdCode,
                paperSet: s.paperSet,
                language: s.language,
                sourceFileName: s.sourceFileName,
                sourceFileUrl: s.sourceFileUrl,
                ocrWarnings: s.ocrWarnings,
                missingPages: s.missingPages,
                answers: s.answers,
              },
            ],
          });
          const graded = resSubs[0];
          evaluatedSubs.push(graded);
          setStudents((prev) =>
            prev.map((item, idx) =>
              idx === i ? { ...item, batchStatus: graded.status } : item
            )
          );
        } catch (err: any) {
          setStudents((prev) =>
            prev.map((item, idx) =>
              idx === i
                ? { ...item, batchStatus: 'failed', errorMessage: err?.message || 'Evaluation failed' }
                : item
            )
          );
          throw err;
        }
      }

      const finalAssessment: Assessment = {
        ...created,
        submissions: evaluatedSubs,
      };
      setCompletedAssessment(finalAssessment);
    } catch (err: any) {
      setErrorMsg(err?.message || 'AI evaluation failed. Check your Gemini API key or try again.');
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Stepper */}
      <div className="bento-hero p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-sky-700 dark:text-emerald-300">
              Guided Assessment Workflow
            </div>
            <h1 className="font-display font-semibold text-2xl sm:text-3xl mt-1">
              New Answer Evaluation
            </h1>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium flex-wrap">
            {[
              { id: 1, label: '1. Upload' },
              { id: 2, label: '2. Review Text' },
              { id: 3, label: '3. Marking Scheme' },
              { id: 4, label: '4. Evaluate' },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  if (s.id < 4 || completedAssessment) setStep(s.id as 1 | 2 | 3 | 4);
                }}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap cursor-pointer transition-colors ${
                  step === s.id
                    ? 'bg-sky-600 text-white dark:bg-emerald-400 dark:text-[#0B1913]'
                    : 'bento-inset text-slate-600 dark:text-[#99A8A1]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="bento-card p-4 border-rose-300 dark:border-rose-500/40 bg-rose-50/80 dark:bg-rose-950/30 flex items-start gap-3 text-sm text-rose-800 dark:text-rose-200"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Action Required</div>
            <p className="mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* STEP 1: SETUP & SMART DOCUMENT UPLOAD */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bento-card p-6 space-y-4">
            <h2 className="font-display font-semibold text-lg">Assessment Configuration</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label htmlFor="assess-title" className="block text-xs font-medium text-slate-600 dark:text-[#99A8A1] mb-1">
                  Assessment Title
                </label>
                <input
                  id="assess-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-sm bento-inset text-slate-900 dark:text-[#F2F6F4] focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-emerald-400"
                />
              </div>

              <div>
                <label htmlFor="assess-subject" className="block text-xs font-medium text-slate-600 dark:text-[#99A8A1] mb-1">
                  Subject
                </label>
                <select
                  id="assess-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-sm bento-inset text-slate-900 dark:text-[#F2F6F4]"
                >
                  {SUBJECTS.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
                {subject === 'Custom Subject' && (
                  <input
                    type="text"
                    placeholder="Enter custom subject..."
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    className="mt-2 w-full px-3 py-1.5 rounded-lg text-sm bento-inset"
                  />
                )}
              </div>

              <div>
                <label htmlFor="assess-level" className="block text-xs font-medium text-slate-600 dark:text-[#99A8A1] mb-1">
                  Educational Level
                </label>
                <select
                  id="assess-level"
                  value={educationLevel}
                  onChange={(e) => setEducationLevel(e.target.value as EducationLevel)}
                  className="w-full px-3.5 py-2 rounded-xl text-sm bento-inset text-slate-900 dark:text-[#F2F6F4]"
                >
                  {EDUCATION_LEVELS.map((lvl) => (
                    <option key={lvl.value} value={lvl.value}>
                      {lvl.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="assess-lang" className="block text-xs font-medium text-slate-600 dark:text-[#99A8A1] mb-1">
                  Language (23 Supported)
                </label>
                <select
                  id="assess-lang"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-sm bento-inset text-slate-900 dark:text-[#F2F6F4]"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.name} value={l.name}>
                      {l.name} ({l.nativeName}) {l.reliability === 'beta' ? '— Beta' : ''}
                    </option>
                  ))}
                </select>
                {selectedLangInfo && selectedLangInfo.reliability === 'beta' && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                    {selectedLangInfo.note}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="assess-class" className="block text-xs font-medium text-slate-600 dark:text-[#99A8A1] mb-1">
                  Class / Course
                </label>
                <input
                  id="assess-class"
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-sm bento-inset text-slate-900 dark:text-[#F2F6F4]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="assess-set" className="block text-xs font-medium text-slate-600 dark:text-[#99A8A1] mb-1">
                    Default Paper Set
                  </label>
                  <select
                    id="assess-set"
                    value={defaultPaperSet}
                    onChange={(e) => setDefaultPaperSet(e.target.value as PaperSet)}
                    className="w-full px-3 py-2 rounded-xl text-sm bento-inset text-slate-900 dark:text-[#F2F6F4]"
                  >
                    {PAPER_SETS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="assess-date" className="block text-xs font-medium text-slate-600 dark:text-[#99A8A1] mb-1">
                    Exam Date
                  </label>
                  <input
                    id="assess-date"
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm bento-inset text-slate-900 dark:text-[#F2F6F4]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 4 Smart Upload Categories */}
          <div className="bento-card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display font-semibold text-lg">Smart Document Upload</h2>
                <p className="text-xs text-slate-500 dark:text-[#99A8A1]">
                  Supports PDF, DOCX, DOC, TXT, CSV, XLSX, JPG, PNG, WEBP &amp; handwritten photos (max 15 MB per file).
                </p>
              </div>
              {uploadProgress > 0 && (
                <div className="text-xs font-mono-num text-sky-700 dark:text-emerald-300">
                  Extracting... {uploadProgress}%
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(
                [
                  { id: 'question_paper', title: '1. Question Paper', hint: 'Questions & marks' },
                  { id: 'model_answers', title: '2. Model Answers', hint: 'Reference explanations' },
                  { id: 'marking_scheme', title: '3. Marking Scheme', hint: 'Criteria & weights' },
                  { id: 'student_sheet', title: '4. Student Answer Sheets', hint: 'Multi-file or scans' },
                ] as const
              ).map((cat) => {
                const docs = extractedDocs.filter((d) => d.category === cat.id);
                const busy = uploadingCategory === cat.id;
                return (
                  <div
                    key={cat.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleFileUpload(e.dataTransfer.files, cat.id);
                    }}
                    className="bento-inset p-4 flex flex-col justify-between gap-3 border-dashed"
                  >
                    <div>
                      <div className="font-medium text-sm text-slate-900 dark:text-[#F2F6F4]">
                        {cat.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-[#99A8A1] mt-0.5">{cat.hint}</div>
                    </div>

                    <label className="w-full py-3 px-3 rounded-xl border border-sky-200/80 dark:border-emerald-300/20 bg-white/70 dark:bg-[#1D2622]/75 text-xs font-medium text-center cursor-pointer hover:bg-sky-50 dark:hover:bg-[#2B3832] transition-colors flex items-center justify-center gap-2">
                      {busy ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-sky-600 dark:text-emerald-300" />
                          <span>Reading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-sky-600 dark:text-emerald-300" />
                          <span>Drop or Browse</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept={ACCEPTED_TYPES}
                        multiple={cat.id === 'student_sheet'}
                        className="sr-only"
                        onChange={(e) => handleFileUpload(e.target.files, cat.id)}
                      />
                    </label>

                    {docs.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {docs.map((doc) => (
                          <div
                            key={doc.fileName}
                            className="flex items-center justify-between gap-1.5 text-xs bg-white/75 dark:bg-[#161D1A] px-2.5 py-1.5 rounded-lg"
                          >
                            <span className="truncate text-slate-700 dark:text-[#D3DDD8]">{doc.fileName}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setPreviewDoc(doc)}
                                aria-label={`Preview ${doc.fileName}`}
                                className="p-1 text-sky-600 dark:text-emerald-300 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeExtractedDoc(doc.fileName)}
                                aria-label={`Remove ${doc.fileName}`}
                                className="p-1 text-rose-500 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="cta-primary px-6 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap cursor-pointer inline-flex items-center gap-2"
            >
              <span>Review Extracted Information</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: REVIEW & CORRECT EXTRACTED QUESTIONS & STUDENT ANSWERS */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bento-card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display font-semibold text-lg">Extracted Questions &amp; Model Answers</h2>
                <p className="text-xs text-slate-500 dark:text-[#99A8A1]">
                  Verify or edit questions, paper sets, and model answers before evaluation.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setQuestions((prev) => [
                    ...prev,
                    {
                      id: `draft-q-${Date.now()}`,
                      questionNumber: `Q${prev.length + 1}`,
                      paperSet: defaultPaperSet,
                      topic: subject,
                      questionText: '',
                      modelAnswer: '',
                      criteria: [{ description: 'Core conceptual explanation', maxMarks: 5, importance: 'core' }],
                    },
                  ])
                }
                className="px-3.5 py-2 rounded-xl text-xs font-medium bento-inset cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Question</span>
              </button>
            </div>

            <div className="space-y-4">
              {questions.map((q, idx) => (
                <div key={q.id} className="bento-inset p-4 space-y-3">
                  <div className="grid sm:grid-cols-4 gap-3">
                    <input
                      type="text"
                      value={q.questionNumber}
                      aria-label={`Question ${idx + 1} number`}
                      onChange={(e) =>
                        setQuestions((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, questionNumber: e.target.value } : item))
                        )
                      }
                      className="px-3 py-1.5 rounded-lg text-sm bg-white/80 dark:bg-[#161D1A] border border-sky-200/70 dark:border-emerald-300/15"
                    />
                    <select
                      value={q.paperSet}
                      aria-label={`Question ${idx + 1} paper set`}
                      onChange={(e) =>
                        setQuestions((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, paperSet: e.target.value as PaperSet } : item))
                        )
                      }
                      className="px-3 py-1.5 rounded-lg text-sm bg-white/80 dark:bg-[#161D1A] border border-sky-200/70 dark:border-emerald-300/15"
                    >
                      {PAPER_SETS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={q.topic}
                      placeholder="Topic"
                      aria-label={`Question ${idx + 1} topic`}
                      onChange={(e) =>
                        setQuestions((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, topic: e.target.value } : item))
                        )
                      }
                      className="sm:col-span-2 px-3 py-1.5 rounded-lg text-sm bg-white/80 dark:bg-[#161D1A] border border-sky-200/70 dark:border-emerald-300/15"
                    />
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Question text..."
                    value={q.questionText}
                    onChange={(e) =>
                      setQuestions((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, questionText: e.target.value } : item))
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg text-sm bg-white/80 dark:bg-[#161D1A] border border-sky-200/70 dark:border-emerald-300/15"
                  />
                  <textarea
                    rows={2}
                    placeholder="Expected model answer..."
                    value={q.modelAnswer}
                    onChange={(e) =>
                      setQuestions((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, modelAnswer: e.target.value } : item))
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg text-sm bg-white/80 dark:bg-[#161D1A] border border-sky-200/70 dark:border-emerald-300/15"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bento-card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display font-semibold text-lg">Extracted Student Answer Sheets</h2>
                <p className="text-xs text-slate-500 dark:text-[#99A8A1]">
                  Unclear OCR words are highlighted. Correct any misread text before grading, without altering student intent.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setStudents((prev) => [
                    ...prev,
                    {
                      id: `stu-${Date.now()}`,
                      studentName: `Student ${prev.length + 1}`,
                      studentIdCode: `STU-${201 + prev.length}`,
                      paperSet: defaultPaperSet,
                      language,
                      sourceFileName: 'manual_entry.txt',
                      ocrWarnings: [],
                      missingPages: [],
                      answers: questions.map((q) => ({ questionNumber: q.questionNumber, answerText: '' })),
                      batchStatus: 'waiting',
                    },
                  ])
                }
                className="px-3.5 py-2 rounded-xl text-xs font-medium bento-inset cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Student Sheet</span>
              </button>
            </div>

            <div className="space-y-4">
              {students.map((stu, sIdx) => (
                <div key={stu.id} className="bento-inset p-4 space-y-3">
                  <div className="grid sm:grid-cols-4 gap-3">
                    <input
                      type="text"
                      value={stu.studentName}
                      placeholder="Student Name"
                      onChange={(e) =>
                        setStudents((prev) =>
                          prev.map((item, i) => (i === sIdx ? { ...item, studentName: e.target.value } : item))
                        )
                      }
                      className="px-3 py-1.5 rounded-lg text-sm bg-white/80 dark:bg-[#161D1A] border border-sky-200/70 dark:border-emerald-300/15"
                    />
                    <input
                      type="text"
                      value={stu.studentIdCode}
                      placeholder="Student ID"
                      onChange={(e) =>
                        setStudents((prev) =>
                          prev.map((item, i) => (i === sIdx ? { ...item, studentIdCode: e.target.value } : item))
                        )
                      }
                      className="px-3 py-1.5 rounded-lg text-sm bg-white/80 dark:bg-[#161D1A] border border-sky-200/70 dark:border-emerald-300/15"
                    />
                    <select
                      value={stu.paperSet}
                      onChange={(e) =>
                        setStudents((prev) =>
                          prev.map((item, i) => (i === sIdx ? { ...item, paperSet: e.target.value as PaperSet } : item))
                        )
                      }
                      className="px-3 py-1.5 rounded-lg text-sm bg-white/80 dark:bg-[#161D1A] border border-sky-200/70 dark:border-emerald-300/15"
                    >
                      {PAPER_SETS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <select
                      value={stu.language}
                      onChange={(e) =>
                        setStudents((prev) =>
                          prev.map((item, i) => (i === sIdx ? { ...item, language: e.target.value } : item))
                        )
                      }
                      className="px-3 py-1.5 rounded-lg text-sm bg-white/80 dark:bg-[#161D1A] border border-sky-200/70 dark:border-emerald-300/15"
                    >
                      {SUPPORTED_LANGUAGES.map((l) => (
                        <option key={l.name} value={l.name}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {stu.ocrWarnings.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-100/70 dark:bg-amber-950/40 border border-amber-300/70 dark:border-amber-400/30 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>{stu.ocrWarnings.join(' ')}</div>
                    </div>
                  )}

                  {stu.missingPages.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-rose-100/70 dark:bg-rose-950/40 text-xs text-rose-800 dark:text-rose-200">
                      Missing pages detected: Page {stu.missingPages.join(', ')}
                    </div>
                  )}

                  {stu.answers.map((ans, aIdx) => (
                    <div key={aIdx} className="space-y-1">
                      <div className="text-xs font-medium text-slate-600 dark:text-[#99A8A1]">
                        {ans.questionNumber} Answer ({stu.sourceFileName})
                      </div>
                      <textarea
                        rows={3}
                        value={ans.answerText}
                        onChange={(e) =>
                          setStudents((prev) =>
                            prev.map((item, i) =>
                              i === sIdx
                                ? {
                                    ...item,
                                    answers: item.answers.map((a, j) =>
                                      j === aIdx ? { ...a, answerText: e.target.value } : a
                                    ),
                                  }
                                : item
                            )
                          )
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl student-answer-prose bg-white/85 dark:bg-[#161D1A] border border-sky-200/70 dark:border-emerald-300/15"
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bento-card cursor-pointer inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Upload</span>
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="cta-primary px-6 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap cursor-pointer inline-flex items-center gap-2"
            >
              <span>Confirm Marking Scheme</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: CONFIRM MARKING SCHEME */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="bento-card p-6 space-y-5">
            <div>
              <h2 className="font-display font-semibold text-lg">Marking Scheme Confirmation</h2>
              <p className="text-xs text-slate-500 dark:text-[#99A8A1]">
                The AI evaluates each criterion separately; our backend validates limits and calculates totals independently.
              </p>
            </div>

            {questions.map((q, qIdx) => {
              const totalQ = q.criteria.reduce((acc, c) => acc + c.maxMarks, 0);
              return (
                <div key={q.id} className="bento-inset p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm text-slate-900 dark:text-[#F2F6F4]">
                      {q.questionNumber} ({q.paperSet}) — {q.questionText.slice(0, 90)}
                    </div>
                    <span className="font-mono-num text-sm font-semibold text-sky-700 dark:text-emerald-300">
                      Total: {totalQ} marks
                    </span>
                  </div>

                  <div className="space-y-2">
                    {q.criteria.map((c, cIdx) => (
                      <div key={cIdx} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                        <input
                          type="text"
                          value={c.description}
                          onChange={(e) =>
                            setQuestions((prev) =>
                              prev.map((item, i) =>
                                i === qIdx
                                  ? {
                                      ...item,
                                      criteria: item.criteria.map((cr, j) =>
                                        j === cIdx ? { ...cr, description: e.target.value } : cr
                                      ),
                                    }
                                  : item
                              )
                            )
                          }
                          className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg text-sm bg-white/85 dark:bg-[#161D1A] border border-sky-200/70 dark:border-emerald-300/15"
                        />
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={c.maxMarks}
                          onChange={(e) =>
                            setQuestions((prev) =>
                              prev.map((item, i) =>
                                i === qIdx
                                  ? {
                                      ...item,
                                      criteria: item.criteria.map((cr, j) =>
                                        j === cIdx ? { ...cr, maxMarks: Math.max(0.5, Number(e.target.value) || 0.5) } : cr
                                      ),
                                    }
                                  : item
                              )
                            )
                          }
                          className="w-24 px-3 py-1.5 rounded-lg text-sm font-mono-num bg-white/85 dark:bg-[#161D1A] border border-sky-200/70 dark:border-emerald-300/15"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setQuestions((prev) =>
                              prev.map((item, i) =>
                                i === qIdx && item.criteria.length > 1
                                  ? { ...item, criteria: item.criteria.filter((_, j) => j !== cIdx) }
                                  : item
                              )
                            )
                          }
                          aria-label="Delete criterion"
                          className="p-2 text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setQuestions((prev) =>
                        prev.map((item, i) =>
                          i === qIdx
                            ? {
                                ...item,
                                criteria: [
                                  ...item.criteria,
                                  { description: 'New criterion', maxMarks: 1, importance: 'standard' },
                                ],
                              }
                            : item
                        )
                      )
                    }
                    className="text-xs font-medium text-sky-700 dark:text-emerald-300 cursor-pointer inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Criterion</span>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bento-card cursor-pointer inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Review</span>
            </button>
            <button
              type="button"
              onClick={handleRunEvaluation}
              className="cta-primary px-6 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap cursor-pointer inline-flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Evaluate Answers</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: BATCH EVALUATION PROGRESS */}
      {step === 4 && (
        <div className="bento-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-semibold text-lg">
                {isEvaluating ? 'Evaluating Student Understanding...' : 'Batch Evaluation Status'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#99A8A1]">
                Analyzing concepts, extracting verbatim evidence, and validating rubric limits.
              </p>
            </div>
            {completedAssessment && (
              <button
                type="button"
                onClick={() => onEvaluationComplete(completedAssessment)}
                className="cta-primary px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap cursor-pointer inline-flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Open Graded Results</span>
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {students.map((s) => (
              <div key={s.id} className="bento-inset p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-4 h-4 text-sky-600 dark:text-emerald-300 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-slate-900 dark:text-[#F2F6F4] truncate">
                      {s.studentName} ({s.studentIdCode})
                    </div>
                    <div className="text-xs text-slate-500 dark:text-[#99A8A1]">
                      {s.paperSet} · {s.language} · {s.sourceFileName}
                    </div>
                    {s.errorMessage && (
                      <div className="text-xs text-rose-600 dark:text-rose-300 mt-1">{s.errorMessage}</div>
                    )}
                  </div>
                </div>

                <div className="text-xs font-medium whitespace-nowrap shrink-0">
                  {s.batchStatus === 'waiting' && <span className="text-slate-500">Waiting</span>}
                  {s.batchStatus === 'processing' && (
                    <span className="inline-flex items-center gap-1.5 text-sky-700 dark:text-emerald-300">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Processing
                    </span>
                  )}
                  {s.batchStatus === 'completed' && (
                    <span className="text-emerald-700 dark:text-emerald-300">Completed</span>
                  )}
                  {s.batchStatus === 'needs_review' && (
                    <span className="text-amber-700 dark:text-amber-300">Needs review</span>
                  )}
                  {s.batchStatus === 'failed' && <span className="text-rose-600 dark:text-rose-300">Failed</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uploaded Document Preview Modal */}
      {previewDoc && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bento-hero max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-lg">{previewDoc.fileName}</h3>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bento-inset cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="text-xs text-slate-500 dark:text-[#99A8A1]">
              Detected Language: {previewDoc.detectedLanguage}
              {previewDoc.detectedSet ? ` · ${previewDoc.detectedSet}` : ''}
              {previewDoc.isHandwritten ? ' · Handwriting detected' : ''}
            </div>
            {previewDoc.mimeType.startsWith('image/') && (
              <img
                src={previewDoc.storedFileUrl}
                alt={`Preview of ${previewDoc.fileName}`}
                className="w-full max-h-64 object-contain rounded-xl border border-sky-200/60 dark:border-emerald-300/15"
              />
            )}
            <pre className="bento-inset p-4 text-xs whitespace-pre-wrap font-sans leading-relaxed text-slate-800 dark:text-[#D3DDD8]">
              {previewDoc.rawText || '(No text extracted)'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
