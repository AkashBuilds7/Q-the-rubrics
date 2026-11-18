export type ThemeMode = 'light' | 'dark';

export type EducationLevel =
  | 'primary'
  | 'middle'
  | 'secondary'
  | 'higher_secondary'
  | 'undergraduate'
  | 'postgraduate'
  | 'professional';

export type PaperSet = 'Set A' | 'Set B' | 'Set C' | 'Set D';

export type CriterionStatus = 'correct' | 'partially_correct' | 'missing' | 'incorrect';

export type ConfidenceLevel = 'high' | 'needs_checking' | 'teacher_review_required';

export type SubmissionStatus =
  | 'waiting'
  | 'processing'
  | 'completed'
  | 'needs_review'
  | 'failed';

export type CriterionImportance = 'core' | 'standard' | 'bonus';

export interface MarkingCriterion {
  id: string;
  description: string;
  maxMarks: number;
  importance: CriterionImportance;
}

export interface QuestionItem {
  id: string;
  questionNumber: string;
  paperSet: PaperSet;
  topic: string;
  questionText: string;
  modelAnswer: string;
  maxMarks: number;
  criteria: MarkingCriterion[];
}

export interface MarkingSchemeVersion {
  id: string;
  assessmentId: string;
  versionNumber: number;
  label: string;
  createdAt: string;
  notes: string;
  questionsSnapshot: QuestionItem[];
}

export interface CriterionEvaluation {
  criterionId: string;
  description: string;
  maxMarks: number;
  awardedMarks: number;
  status: CriterionStatus;
  supportingEvidence: string;
  reasoning: string;
}

export interface QuestionEvaluation {
  id: string;
  submissionId: string;
  questionId: string;
  questionNumber: string;
  questionText: string;
  topic: string;
  paperSet: PaperSet;
  maxMarks: number;
  originalStudentAnswer: string;
  extractedUncertainText?: string;
  isAttempted: boolean;
  studentSummary: string;
  modelSummary: string;
  conceptualUnderstanding: string;
  criteriaResults: CriterionEvaluation[];
  aiAwardedMarks: number;
  teacherEditedMarks: number | null;
  finalMarks: number;
  teacherReferenceMarks: number | null;
  teacherComment: string;
  isApproved: boolean;
  incorrectStatements: string[];
  missingConcepts: string[];
  feedback: string;
  confidenceLevel: ConfidenceLevel;
  confidenceReason: string;
  regradePreviousMarks?: number | null;
  regradeExplanation?: string | null;
}

export interface StudentSubmission {
  id: string;
  assessmentId: string;
  studentName: string;
  studentIdCode: string;
  paperSet: PaperSet;
  language: string;
  status: SubmissionStatus;
  sourceFileName: string;
  sourceFileUrl?: string;
  ocrWarnings: string[];
  missingPages: number[];
  aiTotalMarks: number;
  finalTotalMarks: number;
  maxTotalMarks: number;
  percentage: number;
  grade: string;
  questionsAttempted: number;
  questionsTotal: number;
  reviewRequiredCount: number;
  submittedAt: string;
  isDuplicateSuspected?: boolean;
  duplicateOfName?: string;
  isDemo: boolean;
  evaluations: QuestionEvaluation[];
}

export interface Assessment {
  id: string;
  title: string;
  subject: string;
  educationLevel: EducationLevel;
  language: string;
  className: string;
  examDate: string;
  isDemo: boolean;
  activeSchemeVersion: number;
  createdAt: string;
  questions: QuestionItem[];
  schemeVersions: MarkingSchemeVersion[];
  submissions: StudentSubmission[];
}

export interface QwkPair {
  submissionId: string;
  questionId: string;
  studentName: string;
  questionNumber: string;
  aiMarks: number;
  teacherMarks: number;
  maxMarks: number;
}

export interface QwkResult {
  status: 'valid' | 'insufficient_data' | 'constant_distribution';
  qwk: number | null;
  mae: number | null;
  exactAgreementPct: number | null;
  withinOneMarkPct: number | null;
  sampleCount: number;
  interpretation: string;
  questionWise: Array<{
    questionNumber: string;
    sampleCount: number;
    mae: number;
    exactAgreementPct: number;
    avgDiff: number;
  }>;
}

export interface SetComparisonRow {
  paperSet: PaperSet;
  studentCount: number;
  averageMarks: number;
  maxMarks: number;
  performancePercentage: number;
  estimatedDifficulty: 'Easy' | 'Moderate' | 'Challenging';
  difficultyRank: number;
  isProvisional: boolean;
  complexityScore: number;
}

export interface AppSettings {
  defaultLanguage: string;
  defaultEducationLevel: EducationLevel;
  defaultSubject: string;
  feedbackInStudentLanguage: boolean;
  flagBorderlineThreshold: number;
  showModelSummaryToTeacher: boolean;
}

export interface ExtractedDocumentResult {
  category: 'question_paper' | 'model_answers' | 'marking_scheme' | 'student_sheet';
  fileName: string;
  fileSize: number;
  mimeType: string;
  storedFileUrl: string;
  rawText: string;
  detectedLanguage: string;
  detectedSet?: PaperSet;
  detectedStudentName?: string;
  detectedStudentId?: string;
  uncertainWarnings: string[];
  missingPages: number[];
  hasMathExpressions: boolean;
  isHandwritten: boolean;
  parsedQuestions?: Array<{
    questionNumber: string;
    questionText: string;
    maxMarks: number;
    modelAnswer?: string;
    topic?: string;
    criteria?: Array<{ description: string; maxMarks: number }>;
  }>;
  parsedAnswers?: Array<{
    questionNumber: string;
    answerText: string;
    uncertainText?: string;
  }>;
}
