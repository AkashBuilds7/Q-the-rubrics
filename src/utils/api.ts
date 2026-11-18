import type {
  AppSettings,
  Assessment,
  ExtractedDocumentResult,
  PaperSet,
  QuestionItem,
  QwkPair,
  QwkResult,
  SetComparisonRow,
  StudentSubmission,
} from '../shared/types';

async function handleJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function fetchHealth(): Promise<{ ok: boolean; aiConfigured: boolean }> {
  const res = await fetch('/api/health');
  return handleJson(res);
}

export async function fetchAssessments(): Promise<Assessment[]> {
  const res = await fetch('/api/assessments');
  const data = await handleJson<{ assessments: Assessment[] }>(res);
  return data.assessments;
}

export async function fetchAssessmentById(id: string): Promise<Assessment> {
  const res = await fetch(`/api/assessments/${encodeURIComponent(id)}`);
  const data = await handleJson<{ assessment: Assessment }>(res);
  return data.assessment;
}

export async function createAssessment(payload: {
  title: string;
  subject: string;
  educationLevel: string;
  language: string;
  className: string;
  examDate: string;
  questions: Array<{
    questionNumber: string;
    paperSet: PaperSet;
    topic: string;
    questionText: string;
    modelAnswer: string;
    maxMarks: number;
    criteria: Array<{ description: string; maxMarks: number; importance: 'core' | 'standard' | 'bonus' }>;
  }>;
}): Promise<Assessment> {
  const res = await fetch('/api/assessments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ assessment: Assessment }>(res);
  return data.assessment;
}

export async function uploadAndExtractDocument(
  file: File,
  category: 'question_paper' | 'model_answers' | 'marking_scheme' | 'student_sheet',
  language: string
): Promise<ExtractedDocumentResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('category', category);
  form.append('language', language);
  const res = await fetch('/api/upload/extract', {
    method: 'POST',
    body: form,
  });
  const data = await handleJson<{ extracted: ExtractedDocumentResult }>(res);
  return data.extracted;
}

export async function evaluateSubmissions(payload: {
  assessmentId: string;
  submissions: Array<{
    studentName: string;
    studentIdCode: string;
    paperSet: PaperSet;
    language: string;
    sourceFileName: string;
    sourceFileUrl?: string;
    ocrWarnings?: string[];
    missingPages?: number[];
    answers: Array<{ questionNumber: string; answerText: string; uncertainText?: string }>;
  }>;
}): Promise<StudentSubmission[]> {
  const res = await fetch('/api/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ submissions: StudentSubmission[] }>(res);
  return data.submissions;
}

export async function reviewEvaluation(
  evaluationId: string,
  updates: {
    teacherEditedMarks?: number | null;
    teacherComment?: string;
    isApproved?: boolean;
    teacherReferenceMarks?: number | null;
  }
): Promise<StudentSubmission> {
  const res = await fetch(`/api/evaluations/${encodeURIComponent(evaluationId)}/review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const data = await handleJson<{ submission: StudentSubmission }>(res);
  return data.submission;
}

export async function regradeAssessmentScheme(
  assessmentId: string,
  payload: { questions: QuestionItem[]; label: string; notes: string }
): Promise<Assessment> {
  const res = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}/regrade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ assessment: Assessment }>(res);
  return data.assessment;
}

export async function fetchAnalytics(assessmentId?: string): Promise<{
  assessmentId: string;
  isDemo: boolean;
  setComparison: SetComparisonRow[];
  duplicatesCount: number;
}> {
  const qs = assessmentId ? `?assessmentId=${encodeURIComponent(assessmentId)}` : '';
  const res = await fetch(`/api/analytics${qs}`);
  return handleJson(res);
}

export async function fetchFairnessMetrics(assessmentId?: string): Promise<{
  assessmentId: string;
  isDemo: boolean;
  result: QwkResult | null;
  pairs: QwkPair[];
}> {
  const qs = assessmentId ? `?assessmentId=${encodeURIComponent(assessmentId)}` : '';
  const res = await fetch(`/api/fairness${qs}`);
  return handleJson(res);
}

export async function fetchSettings(): Promise<AppSettings> {
  const res = await fetch('/api/settings');
  const data = await handleJson<{ settings: AppSettings }>(res);
  return data.settings;
}

export async function updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  const data = await handleJson<{ settings: AppSettings }>(res);
  return data.settings;
}

export async function resetDemoData(): Promise<Assessment> {
  const res = await fetch('/api/demo/reset', { method: 'POST' });
  const data = await handleJson<{ assessment: Assessment }>(res);
  return data.assessment;
}
