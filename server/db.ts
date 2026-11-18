import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import type {
  AppSettings,
  Assessment,
  MarkingSchemeVersion,
  QuestionEvaluation,
  QuestionItem,
  StudentSubmission,
} from '../src/shared/types';
import { createDemoAssessment } from './demoSeed';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'qubrix.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const uploadsDir = UPLOADS_DIR;

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    education_level TEXT NOT NULL,
    language TEXT NOT NULL,
    class_name TEXT NOT NULL,
    exam_date TEXT NOT NULL,
    is_demo INTEGER NOT NULL DEFAULT 0,
    active_scheme_version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    question_number TEXT NOT NULL,
    paper_set TEXT NOT NULL,
    topic TEXT NOT NULL,
    question_text TEXT NOT NULL,
    model_answer TEXT NOT NULL,
    max_marks REAL NOT NULL,
    criteria_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS marking_scheme_versions (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    label TEXT NOT NULL,
    created_at TEXT NOT NULL,
    notes TEXT NOT NULL,
    questions_snapshot_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    student_id_code TEXT NOT NULL,
    paper_set TEXT NOT NULL,
    language TEXT NOT NULL,
    status TEXT NOT NULL,
    source_file_name TEXT NOT NULL,
    source_file_url TEXT,
    ocr_warnings_json TEXT NOT NULL,
    missing_pages_json TEXT NOT NULL,
    ai_total_marks REAL NOT NULL,
    final_total_marks REAL NOT NULL,
    max_total_marks REAL NOT NULL,
    percentage REAL NOT NULL,
    grade TEXT NOT NULL,
    questions_attempted INTEGER NOT NULL,
    questions_total INTEGER NOT NULL,
    review_required_count INTEGER NOT NULL,
    submitted_at TEXT NOT NULL,
    is_demo INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS question_evaluations (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    question_number TEXT NOT NULL,
    question_text TEXT NOT NULL,
    topic TEXT NOT NULL,
    paper_set TEXT NOT NULL,
    max_marks REAL NOT NULL,
    original_student_answer TEXT NOT NULL,
    extracted_uncertain_text TEXT,
    is_attempted INTEGER NOT NULL,
    student_summary TEXT NOT NULL,
    model_summary TEXT NOT NULL,
    conceptual_understanding TEXT NOT NULL,
    criteria_results_json TEXT NOT NULL,
    ai_awarded_marks REAL NOT NULL,
    teacher_edited_marks REAL,
    final_marks REAL NOT NULL,
    teacher_reference_marks REAL,
    teacher_comment TEXT NOT NULL,
    is_approved INTEGER NOT NULL,
    incorrect_statements_json TEXT NOT NULL,
    missing_concepts_json TEXT NOT NULL,
    feedback TEXT NOT NULL,
    confidence_level TEXT NOT NULL,
    confidence_reason TEXT NOT NULL,
    regrade_previous_marks REAL,
    regrade_explanation TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL
  );
`);

export const DEFAULT_SETTINGS: AppSettings = {
  defaultLanguage: 'English',
  defaultEducationLevel: 'secondary',
  defaultSubject: 'Biology',
  feedbackInStudentLanguage: true,
  flagBorderlineThreshold: 0.5,
  showModelSummaryToTeacher: true,
};

export function initDatabaseIfNeeded(): void {
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM assessments WHERE is_demo = 1').get() as { cnt: number };
  if (countRow.cnt === 0) {
    saveAssessmentFull(createDemoAssessment());
  }
  const settingsRow = db.prepare("SELECT value_json FROM settings WHERE key = 'app_settings'").get() as { value_json: string } | undefined;
  if (!settingsRow) {
    db.prepare("INSERT INTO settings (key, value_json) VALUES ('app_settings', ?)").run(JSON.stringify(DEFAULT_SETTINGS));
  }
}

export function resetDemoAssessment(): Assessment {
  db.prepare('DELETE FROM assessments WHERE is_demo = 1').run();
  const demo = createDemoAssessment();
  saveAssessmentFull(demo);
  return demo;
}

export function saveAssessmentFull(assessment: Assessment): void {
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT OR REPLACE INTO assessments (
        id, title, subject, education_level, language, class_name, exam_date, is_demo, active_scheme_version, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      assessment.id,
      assessment.title,
      assessment.subject,
      assessment.educationLevel,
      assessment.language,
      assessment.className,
      assessment.examDate,
      assessment.isDemo ? 1 : 0,
      assessment.activeSchemeVersion,
      assessment.createdAt
    );

    db.prepare('DELETE FROM questions WHERE assessment_id = ?').run(assessment.id);
    const insertQ = db.prepare(`
      INSERT INTO questions (
        id, assessment_id, question_number, paper_set, topic, question_text, model_answer, max_marks, criteria_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const q of assessment.questions) {
      insertQ.run(
        q.id,
        assessment.id,
        q.questionNumber,
        q.paperSet,
        q.topic,
        q.questionText,
        q.modelAnswer,
        q.maxMarks,
        JSON.stringify(q.criteria)
      );
    }

    db.prepare('DELETE FROM marking_scheme_versions WHERE assessment_id = ?').run(assessment.id);
    const insertV = db.prepare(`
      INSERT INTO marking_scheme_versions (
        id, assessment_id, version_number, label, created_at, notes, questions_snapshot_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const v of assessment.schemeVersions) {
      insertV.run(
        v.id,
        assessment.id,
        v.versionNumber,
        v.label,
        v.createdAt,
        v.notes,
        JSON.stringify(v.questionsSnapshot)
      );
    }

    for (const sub of assessment.submissions) {
      upsertSubmission(sub);
    }
  });
  tx();
}

export function upsertSubmission(sub: StudentSubmission): void {
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT OR REPLACE INTO submissions (
        id, assessment_id, student_name, student_id_code, paper_set, language, status,
        source_file_name, source_file_url, ocr_warnings_json, missing_pages_json,
        ai_total_marks, final_total_marks, max_total_marks, percentage, grade,
        questions_attempted, questions_total, review_required_count, submitted_at, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sub.id,
      sub.assessmentId,
      sub.studentName,
      sub.studentIdCode,
      sub.paperSet,
      sub.language,
      sub.status,
      sub.sourceFileName,
      sub.sourceFileUrl ?? null,
      JSON.stringify(sub.ocrWarnings),
      JSON.stringify(sub.missingPages),
      sub.aiTotalMarks,
      sub.finalTotalMarks,
      sub.maxTotalMarks,
      sub.percentage,
      sub.grade,
      sub.questionsAttempted,
      sub.questionsTotal,
      sub.reviewRequiredCount,
      sub.submittedAt,
      sub.isDemo ? 1 : 0
    );

    db.prepare('DELETE FROM question_evaluations WHERE submission_id = ?').run(sub.id);
    const insertEv = db.prepare(`
      INSERT INTO question_evaluations (
        id, submission_id, question_id, question_number, question_text, topic, paper_set, max_marks,
        original_student_answer, extracted_uncertain_text, is_attempted, student_summary, model_summary,
        conceptual_understanding, criteria_results_json, ai_awarded_marks, teacher_edited_marks, final_marks,
        teacher_reference_marks, teacher_comment, is_approved, incorrect_statements_json,
        missing_concepts_json, feedback, confidence_level, confidence_reason,
        regrade_previous_marks, regrade_explanation
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const ev of sub.evaluations) {
      insertEv.run(
        ev.id,
        sub.id,
        ev.questionId,
        ev.questionNumber,
        ev.questionText,
        ev.topic,
        ev.paperSet,
        ev.maxMarks,
        ev.originalStudentAnswer,
        ev.extractedUncertainText ?? null,
        ev.isAttempted ? 1 : 0,
        ev.studentSummary,
        ev.modelSummary,
        ev.conceptualUnderstanding,
        JSON.stringify(ev.criteriaResults),
        ev.aiAwardedMarks,
        ev.teacherEditedMarks,
        ev.finalMarks,
        ev.teacherReferenceMarks,
        ev.teacherComment,
        ev.isApproved ? 1 : 0,
        JSON.stringify(ev.incorrectStatements),
        JSON.stringify(ev.missingConcepts),
        ev.feedback,
        ev.confidenceLevel,
        ev.confidenceReason,
        ev.regradePreviousMarks ?? null,
        ev.regradeExplanation ?? null
      );
    }
  });
  tx();
}

export function getAllAssessments(): Assessment[] {
  const rows = db.prepare('SELECT * FROM assessments ORDER BY is_demo ASC, created_at DESC').all() as any[];
  return rows.map((r) => hydrateAssessment(r));
}

export function getAssessmentById(id: string): Assessment | null {
  const row = db.prepare('SELECT * FROM assessments WHERE id = ?').get(id) as any;
  if (!row) return null;
  return hydrateAssessment(row);
}

function hydrateAssessment(row: any): Assessment {
  const qRows = db.prepare('SELECT * FROM questions WHERE assessment_id = ? ORDER BY paper_set, question_number').all(row.id) as any[];
  const questions: QuestionItem[] = qRows.map((q) => ({
    id: q.id,
    questionNumber: q.question_number,
    paperSet: q.paper_set,
    topic: q.topic,
    questionText: q.question_text,
    modelAnswer: q.model_answer,
    maxMarks: q.max_marks,
    criteria: JSON.parse(q.criteria_json),
  }));

  const vRows = db
    .prepare('SELECT * FROM marking_scheme_versions WHERE assessment_id = ? ORDER BY version_number DESC')
    .all(row.id) as any[];
  const schemeVersions: MarkingSchemeVersion[] = vRows.map((v) => ({
    id: v.id,
    assessmentId: v.assessment_id,
    versionNumber: v.version_number,
    label: v.label,
    createdAt: v.created_at,
    notes: v.notes,
    questionsSnapshot: JSON.parse(v.questions_snapshot_json),
  }));

  const subRows = db.prepare('SELECT * FROM submissions WHERE assessment_id = ? ORDER BY submitted_at ASC').all(row.id) as any[];
  const submissions: StudentSubmission[] = subRows.map((s) => hydrateSubmission(s));

  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    educationLevel: row.education_level,
    language: row.language,
    className: row.class_name,
    examDate: row.exam_date,
    isDemo: Boolean(row.is_demo),
    activeSchemeVersion: row.active_scheme_version,
    createdAt: row.created_at,
    questions,
    schemeVersions,
    submissions,
  };
}

function hydrateSubmission(s: any): StudentSubmission {
  const evRows = db
    .prepare('SELECT * FROM question_evaluations WHERE submission_id = ? ORDER BY question_number ASC')
    .all(s.id) as any[];
  const evaluations: QuestionEvaluation[] = evRows.map((e) => ({
    id: e.id,
    submissionId: e.submission_id,
    questionId: e.question_id,
    questionNumber: e.question_number,
    questionText: e.question_text,
    topic: e.topic,
    paperSet: e.paper_set,
    maxMarks: e.max_marks,
    originalStudentAnswer: e.original_student_answer,
    extractedUncertainText: e.extracted_uncertain_text ?? undefined,
    isAttempted: Boolean(e.is_attempted),
    studentSummary: e.student_summary,
    modelSummary: e.model_summary,
    conceptualUnderstanding: e.conceptual_understanding,
    criteriaResults: JSON.parse(e.criteria_results_json),
    aiAwardedMarks: e.ai_awarded_marks,
    teacherEditedMarks: e.teacher_edited_marks,
    finalMarks: e.final_marks,
    teacherReferenceMarks: e.teacher_reference_marks,
    teacherComment: e.teacher_comment,
    isApproved: Boolean(e.is_approved),
    incorrectStatements: JSON.parse(e.incorrect_statements_json),
    missingConcepts: JSON.parse(e.missing_concepts_json),
    feedback: e.feedback,
    confidenceLevel: e.confidence_level,
    confidenceReason: e.confidence_reason,
    regradePreviousMarks: e.regrade_previous_marks,
    regradeExplanation: e.regrade_explanation,
  }));

  return {
    id: s.id,
    assessmentId: s.assessment_id,
    studentName: s.student_name,
    studentIdCode: s.student_id_code,
    paperSet: s.paper_set,
    language: s.language,
    status: s.status,
    sourceFileName: s.source_file_name,
    sourceFileUrl: s.source_file_url ?? undefined,
    ocrWarnings: JSON.parse(s.ocr_warnings_json),
    missingPages: JSON.parse(s.missing_pages_json),
    aiTotalMarks: s.ai_total_marks,
    finalTotalMarks: s.final_total_marks,
    maxTotalMarks: s.max_total_marks,
    percentage: s.percentage,
    grade: s.grade,
    questionsAttempted: s.questions_attempted,
    questionsTotal: s.questions_total,
    reviewRequiredCount: s.review_required_count,
    submittedAt: s.submitted_at,
    isDemo: Boolean(s.is_demo),
    evaluations,
  };
}

export function getEvaluationWithSubmission(evaluationId: string): {
  evaluation: QuestionEvaluation;
  submission: StudentSubmission;
} | null {
  const evRow = db.prepare('SELECT * FROM question_evaluations WHERE id = ?').get(evaluationId) as any;
  if (!evRow) return null;
  const subRow = db.prepare('SELECT * FROM submissions WHERE id = ?').get(evRow.submission_id) as any;
  if (!subRow) return null;
  const submission = hydrateSubmission(subRow);
  const evaluation = submission.evaluations.find((e) => e.id === evaluationId)!;
  return { evaluation, submission };
}

export function updateEvaluationRecord(
  evaluationId: string,
  updates: {
    teacherEditedMarks?: number | null;
    finalMarks?: number;
    teacherComment?: string;
    isApproved?: boolean;
    teacherReferenceMarks?: number | null;
    confidenceLevel?: string;
  }
): StudentSubmission | null {
  const existing = getEvaluationWithSubmission(evaluationId);
  if (!existing) return null;

  const updatedEvals = existing.submission.evaluations.map((ev) => {
    if (ev.id !== evaluationId) return ev;
    const edited = updates.teacherEditedMarks !== undefined ? updates.teacherEditedMarks : ev.teacherEditedMarks;
    const finalM = updates.finalMarks !== undefined ? updates.finalMarks : edited !== null ? edited : ev.aiAwardedMarks;
    return {
      ...ev,
      teacherEditedMarks: edited,
      finalMarks: finalM,
      teacherComment: updates.teacherComment !== undefined ? updates.teacherComment : ev.teacherComment,
      isApproved: updates.isApproved !== undefined ? updates.isApproved : ev.isApproved,
      teacherReferenceMarks:
        updates.teacherReferenceMarks !== undefined ? updates.teacherReferenceMarks : ev.teacherReferenceMarks,
      confidenceLevel: (updates.confidenceLevel as any) ?? ev.confidenceLevel,
    };
  });

  // Recalculate submission totals cleanly
  let aiTotal = 0;
  let finalTotal = 0;
  let maxTotal = 0;
  let reviewReq = 0;
  for (const e of updatedEvals) {
    aiTotal += e.aiAwardedMarks;
    finalTotal += e.finalMarks;
    maxTotal += e.maxMarks;
    if (!e.isApproved && e.confidenceLevel !== 'high') reviewReq += 1;
  }
  const pct = maxTotal > 0 ? Math.round((finalTotal / maxTotal) * 1000) / 10 : 0;
  const status = reviewReq > 0 ? 'needs_review' : 'completed';

  const updatedSub: StudentSubmission = {
    ...existing.submission,
    aiTotalMarks: Math.round(aiTotal * 2) / 2,
    finalTotalMarks: Math.round(finalTotal * 2) / 2,
    maxTotalMarks: Math.round(maxTotal * 2) / 2,
    percentage: pct,
    status,
    reviewRequiredCount: reviewReq,
    evaluations: updatedEvals,
  };

  upsertSubmission(updatedSub);
  return updatedSub;
}

export function getSettings(): AppSettings {
  const row = db.prepare("SELECT value_json FROM settings WHERE key = 'app_settings'").get() as { value_json: string } | undefined;
  if (!row) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value_json) };
}

export function saveSettings(newSettings: Partial<AppSettings>): AppSettings {
  const merged = { ...getSettings(), ...newSettings };
  db.prepare("INSERT OR REPLACE INTO settings (key, value_json) VALUES ('app_settings', ?)").run(JSON.stringify(merged));
  return merged;
}

initDatabaseIfNeeded();
