import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import {
  getAllAssessments,
  getAssessmentById,
  getSettings,
  resetDemoAssessment,
  saveAssessmentFull,
  saveSettings,
  updateEvaluationRecord,
  uploadsDir,
  upsertSubmission,
} from './server/db';
import { evaluateAnswerWithGemini, formatGeminiError } from './server/gemini';
import { MAX_FILE_SIZE_BYTES, processUploadedDocument, validateUploadedFile } from './server/fileParser';
import {
  buildSetComparison,
  calculateQuadraticWeightedKappa,
  calculateSubmissionTotals,
  detectDuplicateSubmissions,
  regradeEvaluationsWithNewScheme,
  validateAndCalculateQuestionMarks,
} from './src/shared/gradingMath';
import type {
  Assessment,
  EducationLevel,
  MarkingSchemeVersion,
  PaperSet,
  QuestionEvaluation,
  QuestionItem,
  QwkPair,
  StudentSubmission,
} from './src/shared/types';

const app = express();
app.use(express.json({ limit: '10mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

// Serve preserved original uploaded documents safely
app.get('/api/uploads/:filename', (req, res) => {
  const safeName = path.basename(req.params.filename);
  const fullPath = path.join(uploadsDir, safeName);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'Uploaded document not found.' });
  }
  return res.sendFile(fullPath);
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
  });
});

app.get('/api/assessments', (_req, res) => {
  try {
    const list = getAllAssessments().map((assessment) => {
      const dupMap = detectDuplicateSubmissions(assessment.submissions);
      return {
        ...assessment,
        submissions: assessment.submissions.map((s) => ({
          ...s,
          isDuplicateSuspected: dupMap.has(s.id),
          duplicateOfName: dupMap.get(s.id),
        })),
      };
    });
    res.json({ assessments: list });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load assessments.' });
  }
});

app.get('/api/assessments/:id', (req, res) => {
  const assessment = getAssessmentById(req.params.id);
  if (!assessment) {
    return res.status(404).json({ error: 'Assessment not found.' });
  }
  const dupMap = detectDuplicateSubmissions(assessment.submissions);
  res.json({
    assessment: {
      ...assessment,
      submissions: assessment.submissions.map((s) => ({
        ...s,
        isDuplicateSuspected: dupMap.has(s.id),
        duplicateOfName: dupMap.get(s.id),
      })),
    },
  });
});

app.post('/api/assessments', (req, res) => {
  try {
    const body = req.body;
    if (!body?.title || !Array.isArray(body?.questions) || body.questions.length === 0) {
      return res.status(400).json({ error: 'Assessment title and at least one question are required.' });
    }
    const id = body.id || `assess-${Date.now()}`;
    const now = new Date().toISOString();
    const questions: QuestionItem[] = body.questions.map((q: any, idx: number) => {
      const criteria = Array.isArray(q.criteria) && q.criteria.length > 0
        ? q.criteria.map((c: any, ci: number) => ({
            id: c.id || `crit-${idx + 1}-${ci + 1}-${Date.now()}`,
            description: String(c.description || 'Core concept').trim(),
            maxMarks: Math.max(0.5, Number(c.maxMarks) || 1),
            importance: c.importance || 'standard',
          }))
        : [
            {
              id: `crit-${idx + 1}-1-${Date.now()}`,
              description: 'Conceptual understanding and accuracy',
              maxMarks: Math.max(1, Number(q.maxMarks) || 5),
              importance: 'core' as const,
            },
          ];
      const maxMarks = Math.round(criteria.reduce((s: number, c: any) => s + c.maxMarks, 0) * 2) / 2;
      return {
        id: q.id || `q-${idx + 1}-${Date.now()}`,
        questionNumber: String(q.questionNumber || `Q${idx + 1}`),
        paperSet: (q.paperSet || 'Set A') as PaperSet,
        topic: String(q.topic || body.subject || 'General'),
        questionText: String(q.questionText || '').trim(),
        modelAnswer: String(q.modelAnswer || '').trim(),
        maxMarks,
        criteria,
      };
    });

    const assessment: Assessment = {
      id,
      title: String(body.title).trim(),
      subject: String(body.subject || 'General').trim(),
      educationLevel: (body.educationLevel || 'secondary') as EducationLevel,
      language: String(body.language || 'English'),
      className: String(body.className || 'Class 10').trim(),
      examDate: String(body.examDate || now.slice(0, 10)),
      isDemo: false,
      activeSchemeVersion: 1,
      createdAt: now,
      questions,
      schemeVersions: [
        {
          id: `sv-${Date.now()}`,
          assessmentId: id,
          versionNumber: 1,
          label: 'v1 — Initial Marking Scheme',
          createdAt: now,
          notes: 'Created with assessment.',
          questionsSnapshot: questions,
        },
      ],
      submissions: [],
    };
    saveAssessmentFull(assessment);
    res.status(201).json({ assessment });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to save assessment.' });
  }
});

// Document Upload + Extraction Endpoint
app.post('/api/upload/extract', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    const validation = validateUploadedFile(file.originalname, file.size);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    const category = (req.body.category || 'student_sheet') as
      | 'question_paper'
      | 'model_answers'
      | 'marking_scheme'
      | 'student_sheet';
    const hintLanguage = req.body.language || 'English';

    const extracted = await processUploadedDocument({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      category,
      hintLanguage,
    });

    res.json({ extracted });
  } catch (err) {
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// Evaluate one or more student submissions using Gemini AI + Backend Independent Validation
app.post('/api/evaluate', async (req, res) => {
  try {
    const { assessmentId, submissions: incomingSubs } = req.body as {
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
        answers: Array<{
          questionNumber: string;
          answerText: string;
          uncertainText?: string;
        }>;
      }>;
    };

    const assessment = getAssessmentById(assessmentId);
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found.' });
    }
    if (!Array.isArray(incomingSubs) || incomingSubs.length === 0) {
      return res.status(400).json({ error: 'At least one student submission is required.' });
    }

    const settings = getSettings();
    const createdSubmissions: StudentSubmission[] = [];

    for (const subInput of incomingSubs) {
      const subId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const setQuestions = assessment.questions.filter((q) => q.paperSet === subInput.paperSet);
      const targetQuestions = setQuestions.length > 0 ? setQuestions : assessment.questions;

      const evaluations: QuestionEvaluation[] = [];

      for (const question of targetQuestions) {
        const matchedAns = subInput.answers.find(
          (a) => a.questionNumber.trim().toLowerCase() === question.questionNumber.trim().toLowerCase()
        );
        const studentAnswer = (matchedAns?.answerText || '').trim();
        const isAttempted = studentAnswer.length > 0;
        const ocrWarnings = subInput.ocrWarnings || [];

        if (!isAttempted) {
          evaluations.push({
            id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            submissionId: subId,
            questionId: question.id,
            questionNumber: question.questionNumber,
            questionText: question.questionText,
            topic: question.topic,
            paperSet: question.paperSet,
            maxMarks: question.maxMarks,
            originalStudentAnswer: '',
            isAttempted: false,
            studentSummary: 'Question not attempted.',
            modelSummary: question.modelAnswer.slice(0, 180),
            conceptualUnderstanding: 'No response provided.',
            criteriaResults: question.criteria.map((c) => ({
              criterionId: c.id,
              description: c.description,
              maxMarks: c.maxMarks,
              awardedMarks: 0,
              status: 'missing',
              supportingEvidence: '',
              reasoning: 'Question was left blank.',
            })),
            aiAwardedMarks: 0,
            teacherEditedMarks: null,
            finalMarks: 0,
            teacherReferenceMarks: null,
            teacherComment: '',
            isApproved: true,
            incorrectStatements: [],
            missingConcepts: ['Question not attempted'],
            feedback: `This question (${question.questionNumber}) was not attempted. Review "${question.topic}" and practice writing the core steps.`,
            confidenceLevel: 'high',
            confidenceReason: 'Blank answer confirmed.',
          });
          continue;
        }

        const aiEval = await evaluateAnswerWithGemini({
          subject: assessment.subject,
          educationLevel: assessment.educationLevel,
          language: subInput.language || assessment.language,
          feedbackInStudentLanguage: settings.feedbackInStudentLanguage,
          questionNumber: question.questionNumber,
          questionText: question.questionText,
          modelAnswer: question.modelAnswer,
          maxMarks: question.maxMarks,
          criteria: question.criteria,
          studentAnswer,
          ocrWarnings,
        });

        // Backend independently validates every criterion mark & sums totals
        const validated = validateAndCalculateQuestionMarks(
          question.criteria,
          aiEval.criteriaRecommendations,
          question.maxMarks,
          aiEval.confidenceLevel,
          studentAnswer
        );

        const finalConfidence =
          ocrWarnings.length > 0 || matchedAns?.uncertainText
            ? validated.adjustedConfidence === 'high'
              ? 'needs_checking'
              : validated.adjustedConfidence
            : validated.adjustedConfidence;

        evaluations.push({
          id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          submissionId: subId,
          questionId: question.id,
          questionNumber: question.questionNumber,
          questionText: question.questionText,
          topic: question.topic,
          paperSet: question.paperSet,
          maxMarks: question.maxMarks,
          originalStudentAnswer: studentAnswer,
          extractedUncertainText: matchedAns?.uncertainText,
          isAttempted: true,
          studentSummary: aiEval.studentSummary,
          modelSummary: aiEval.modelSummary,
          conceptualUnderstanding: aiEval.conceptualUnderstanding,
          criteriaResults: validated.criteriaResults,
          aiAwardedMarks: validated.aiAwardedMarks,
          teacherEditedMarks: null,
          finalMarks: validated.aiAwardedMarks,
          teacherReferenceMarks: null,
          teacherComment: '',
          isApproved: finalConfidence === 'high',
          incorrectStatements: aiEval.incorrectStatements,
          missingConcepts: aiEval.missingConcepts,
          feedback: aiEval.feedback,
          confidenceLevel: finalConfidence,
          confidenceReason:
            validated.validationWarnings.length > 0
              ? `${aiEval.confidenceReason} (${validated.validationWarnings.join(' ')})`
              : aiEval.confidenceReason,
        });
      }

      const totals = calculateSubmissionTotals(evaluations);
      const submission: StudentSubmission = {
        id: subId,
        assessmentId,
        studentName: subInput.studentName.trim() || 'Unnamed Student',
        studentIdCode: subInput.studentIdCode.trim() || `STU-${Math.floor(100 + Math.random() * 900)}`,
        paperSet: subInput.paperSet,
        language: subInput.language || assessment.language,
        status: totals.reviewRequiredCount > 0 ? 'needs_review' : 'completed',
        sourceFileName: subInput.sourceFileName || 'uploaded_sheet.txt',
        sourceFileUrl: subInput.sourceFileUrl,
        ocrWarnings: subInput.ocrWarnings || [],
        missingPages: subInput.missingPages || [],
        submittedAt: new Date().toISOString(),
        isDemo: false,
        evaluations,
        ...totals,
      };

      upsertSubmission(submission);
      createdSubmissions.push(submission);
    }

    res.status(201).json({ submissions: createdSubmissions });
  } catch (err) {
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// Teacher Review, Edit Marks, Approve, or Update Reference Score
app.patch('/api/evaluations/:id/review', (req, res) => {
  try {
    const { teacherEditedMarks, teacherComment, isApproved, teacherReferenceMarks } = req.body;
    if (teacherEditedMarks !== undefined && teacherEditedMarks !== null && Number(teacherEditedMarks) < 0) {
      return res.status(400).json({ error: 'Marks cannot be negative.' });
    }
    const updatedSub = updateEvaluationRecord(req.params.id, {
      teacherEditedMarks:
        teacherEditedMarks === undefined ? undefined : teacherEditedMarks === null ? null : Number(teacherEditedMarks),
      teacherComment,
      isApproved,
      teacherReferenceMarks:
        teacherReferenceMarks === undefined
          ? undefined
          : teacherReferenceMarks === null
          ? null
          : Number(teacherReferenceMarks),
      confidenceLevel: isApproved ? 'high' : undefined,
    });
    if (!updatedSub) {
      return res.status(404).json({ error: 'Evaluation record not found.' });
    }
    res.json({ submission: updatedSub });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update evaluation review.' });
  }
});

// Save Marking Scheme Version & Trigger Dynamic Regrade
app.post('/api/assessments/:id/regrade', (req, res) => {
  try {
    const assessment = getAssessmentById(req.params.id);
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found.' });
    }
    const { questions: updatedQuestions, label, notes } = req.body as {
      questions: QuestionItem[];
      label?: string;
      notes?: string;
    };

    if (!Array.isArray(updatedQuestions) || updatedQuestions.length === 0) {
      return res.status(400).json({ error: 'Updated questions with marking criteria are required.' });
    }

    // Validate no negative marks or zero-criteria totals
    const sanitizedQuestions: QuestionItem[] = updatedQuestions.map((q) => {
      const cleanCriteria = q.criteria.map((c) => ({
        ...c,
        maxMarks: Math.max(0.5, Math.round(Number(c.maxMarks) * 2) / 2),
      }));
      const totalMax = Math.round(cleanCriteria.reduce((acc, c) => acc + c.maxMarks, 0) * 2) / 2;
      return {
        ...q,
        criteria: cleanCriteria,
        maxMarks: totalMax,
      };
    });

    const nextVersionNumber = assessment.activeSchemeVersion + 1;
    const newVersion: MarkingSchemeVersion = {
      id: `sv-${Date.now()}`,
      assessmentId: assessment.id,
      versionNumber: nextVersionNumber,
      label: label?.trim() || `v${nextVersionNumber} — Updated Marking Scheme`,
      createdAt: new Date().toISOString(),
      notes: notes?.trim() || 'Criteria or mark weights updated by teacher.',
      questionsSnapshot: sanitizedQuestions,
    };

    const schemeMap = new Map<string, { maxMarks: number; criteria: QuestionItem['criteria'] }>();
    for (const q of sanitizedQuestions) {
      schemeMap.set(q.id, { maxMarks: q.maxMarks, criteria: q.criteria });
      schemeMap.set(`${q.paperSet}::${q.questionNumber}`, { maxMarks: q.maxMarks, criteria: q.criteria });
    }

    const regradedSubmissions = assessment.submissions.map((sub) => {
      const updatedEvals = regradeEvaluationsWithNewScheme(sub.evaluations, schemeMap);
      const totals = calculateSubmissionTotals(updatedEvals);
      return {
        ...sub,
        ...totals,
        status: totals.reviewRequiredCount > 0 ? ('needs_review' as const) : ('completed' as const),
        evaluations: updatedEvals,
      };
    });

    const updatedAssessment: Assessment = {
      ...assessment,
      activeSchemeVersion: nextVersionNumber,
      questions: sanitizedQuestions,
      schemeVersions: [newVersion, ...assessment.schemeVersions],
      submissions: regradedSubmissions,
    };

    saveAssessmentFull(updatedAssessment);
    res.json({ assessment: updatedAssessment });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to apply dynamic regrade.' });
  }
});

// Analytics & Set Comparison Endpoint
app.get('/api/analytics', (req, res) => {
  try {
    const assessmentId = req.query.assessmentId as string | undefined;
    const assessments = getAllAssessments();
    const target = assessmentId ? assessments.find((a) => a.id === assessmentId) : assessments[0];
    if (!target) {
      return res.json({ setComparison: [], summary: null });
    }
    const setComparison = buildSetComparison(target.submissions, target.questions);
    const dupMap = detectDuplicateSubmissions(target.submissions);
    res.json({
      assessmentId: target.id,
      isDemo: target.isDemo,
      setComparison,
      duplicatesCount: dupMap.size,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to compute analytics.' });
  }
});

// Fairness & Accuracy (QWK) Endpoint
app.get('/api/fairness', (req, res) => {
  try {
    const assessmentId = req.query.assessmentId as string | undefined;
    const assessments = getAllAssessments();
    const target = assessmentId ? assessments.find((a) => a.id === assessmentId) : assessments[0];
    if (!target) {
      return res.json({ qwk: null, pairs: [] });
    }

    const pairs: QwkPair[] = [];
    for (const sub of target.submissions) {
      for (const ev of sub.evaluations) {
        if (ev.teacherReferenceMarks !== null && ev.teacherReferenceMarks !== undefined) {
          pairs.push({
            submissionId: sub.id,
            questionId: ev.questionId,
            studentName: sub.studentName,
            questionNumber: `${sub.paperSet} · ${ev.questionNumber}`,
            aiMarks: ev.aiAwardedMarks,
            teacherMarks: ev.teacherReferenceMarks,
            maxMarks: ev.maxMarks,
          });
        }
      }
    }

    const result = calculateQuadraticWeightedKappa(pairs);
    res.json({
      assessmentId: target.id,
      isDemo: target.isDemo,
      result,
      pairs,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to compute QWK metrics.' });
  }
});

app.get('/api/settings', (_req, res) => {
  res.json({ settings: getSettings() });
});

app.put('/api/settings', (req, res) => {
  const updated = saveSettings(req.body || {});
  res.json({ settings: updated });
});

app.post('/api/demo/reset', (_req, res) => {
  const demo = resetDemoAssessment();
  res.json({ assessment: demo });
});

async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QUBRIX AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
