import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAndCalculateQuestionMarks,
  calculateSubmissionTotals,
  calculateQuadraticWeightedKappa,
  regradeEvaluationsWithNewScheme,
  detectDuplicateSubmissions,
} from './gradingMath';
import type { MarkingCriterion, QuestionEvaluation, StudentSubmission } from './types';

test('validateAndCalculateQuestionMarks clamps negative and over-max marks and computes sum independently', () => {
  const criteria: MarkingCriterion[] = [
    { id: 'c1', description: 'Meaning of photosynthesis', maxMarks: 2, importance: 'core' },
    { id: 'c2', description: 'Role of chlorophyll', maxMarks: 2, importance: 'standard' },
    { id: 'c3', description: 'Products formed', maxMarks: 1, importance: 'standard' },
  ];

  const result = validateAndCalculateQuestionMarks(
    criteria,
    [
      {
        criterionId: 'c1',
        recommendedMarks: 5, // exceeds max 2!
        status: 'correct',
        supportingEvidence: 'Plants convert light into chemical energy.',
        reasoning: 'Clear explanation',
      },
      {
        criterionId: 'c2',
        recommendedMarks: -1, // negative!
        status: 'incorrect',
        supportingEvidence: '',
        reasoning: 'Incorrect pigment',
      },
      {
        criterionId: 'c3',
        recommendedMarks: 1,
        status: 'correct',
        supportingEvidence: 'Produces glucose and oxygen.',
        reasoning: 'Accurate',
      },
    ],
    5,
    'high',
    'Plants convert light into chemical energy and produce glucose and oxygen.'
  );

  assert.equal(result.criteriaResults[0].awardedMarks, 2);
  assert.equal(result.criteriaResults[1].awardedMarks, 0);
  assert.equal(result.criteriaResults[2].awardedMarks, 1);
  assert.equal(result.aiAwardedMarks, 3);
  assert.equal(result.adjustedConfidence, 'needs_checking');
  assert.ok(result.validationWarnings.length >= 2);
});

test('validateAndCalculateQuestionMarks rejects marks when student answer is empty', () => {
  const criteria: MarkingCriterion[] = [
    { id: 'c1', description: 'Definition', maxMarks: 2, importance: 'core' },
  ];
  const result = validateAndCalculateQuestionMarks(
    criteria,
    [
      {
        criterionId: 'c1',
        recommendedMarks: 2,
        status: 'correct',
        supportingEvidence: 'Invented quote',
        reasoning: 'Hallucinated',
      },
    ],
    2,
    'high',
    '   '
  );
  assert.equal(result.aiAwardedMarks, 0);
  assert.equal(result.criteriaResults[0].status, 'missing');
});

test('calculateQuadraticWeightedKappa handles perfect agreement, partial agreement, insufficient samples, and constant scores', () => {
  // Insufficient samples (< 3)
  const lowSample = calculateQuadraticWeightedKappa([
    { submissionId: 's1', questionId: 'q1', studentName: 'A', questionNumber: 'Q1', aiMarks: 4, teacherMarks: 4, maxMarks: 5 },
    { submissionId: 's2', questionId: 'q1', studentName: 'B', questionNumber: 'Q1', aiMarks: 3, teacherMarks: 3, maxMarks: 5 },
  ]);
  assert.equal(lowSample.status, 'insufficient_data');
  assert.equal(lowSample.qwk, null);

  // Constant distribution (zero variance)
  const constant = calculateQuadraticWeightedKappa([
    { submissionId: 's1', questionId: 'q1', studentName: 'A', questionNumber: 'Q1', aiMarks: 5, teacherMarks: 5, maxMarks: 5 },
    { submissionId: 's2', questionId: 'q1', studentName: 'B', questionNumber: 'Q1', aiMarks: 5, teacherMarks: 5, maxMarks: 5 },
    { submissionId: 's3', questionId: 'q1', studentName: 'C', questionNumber: 'Q1', aiMarks: 5, teacherMarks: 5, maxMarks: 5 },
  ]);
  assert.equal(constant.status, 'constant_distribution');
  assert.equal(constant.qwk, null);

  // Perfect agreement with varied scores
  const perfect = calculateQuadraticWeightedKappa([
    { submissionId: 's1', questionId: 'q1', studentName: 'A', questionNumber: 'Q1', aiMarks: 0, teacherMarks: 0, maxMarks: 5 },
    { submissionId: 's2', questionId: 'q1', studentName: 'B', questionNumber: 'Q1', aiMarks: 2.5, teacherMarks: 2.5, maxMarks: 5 },
    { submissionId: 's3', questionId: 'q1', studentName: 'C', questionNumber: 'Q1', aiMarks: 5, teacherMarks: 5, maxMarks: 5 },
    { submissionId: 's4', questionId: 'q1', studentName: 'D', questionNumber: 'Q1', aiMarks: 4, teacherMarks: 4, maxMarks: 5 },
  ]);
  assert.equal(perfect.status, 'valid');
  assert.equal(perfect.qwk, 1);
  assert.equal(perfect.mae, 0);
  assert.equal(perfect.exactAgreementPct, 100);
});

test('regradeEvaluationsWithNewScheme preserves old marks and calculates new scaled marks', () => {
  const evals: QuestionEvaluation[] = [
    {
      id: 'ev1',
      submissionId: 's1',
      questionId: 'q1',
      questionNumber: 'Q1',
      questionText: 'What is photosynthesis?',
      topic: 'Plant Biology',
      paperSet: 'Set A',
      maxMarks: 4,
      originalStudentAnswer: 'Plants make food using sunlight and chlorophyll.',
      isAttempted: true,
      studentSummary: 'Mentions sunlight and chlorophyll',
      modelSummary: 'Full process',
      conceptualUnderstanding: 'Good',
      criteriaResults: [
        {
          criterionId: 'c1',
          description: 'Role of sunlight',
          maxMarks: 2,
          awardedMarks: 2,
          status: 'correct',
          supportingEvidence: 'using sunlight',
          reasoning: 'Clear',
        },
        {
          criterionId: 'c2',
          description: 'Role of chlorophyll',
          maxMarks: 2,
          awardedMarks: 2,
          status: 'correct',
          supportingEvidence: 'and chlorophyll',
          reasoning: 'Clear',
        },
      ],
      aiAwardedMarks: 4,
      teacherEditedMarks: null,
      finalMarks: 4,
      teacherReferenceMarks: null,
      teacherComment: '',
      isApproved: true,
      incorrectStatements: [],
      missingConcepts: [],
      feedback: 'Good job.',
      confidenceLevel: 'high',
      confidenceReason: 'Clear',
    },
  ];

  const newScheme = new Map([
    [
      'Q1',
      {
        maxMarks: 6,
        criteria: [
          { id: 'c1', description: 'Role of sunlight', maxMarks: 3, importance: 'core' as const },
          { id: 'c2', description: 'Role of chlorophyll', maxMarks: 2, importance: 'standard' as const },
          { id: 'c3', description: 'Glucose equation', maxMarks: 1, importance: 'standard' as const },
        ],
      },
    ],
  ]);

  const regraded = regradeEvaluationsWithNewScheme(evals, newScheme);
  assert.equal(regraded[0].regradePreviousMarks, 4);
  assert.equal(regraded[0].finalMarks, 5); // 3 + 2 + 0
  assert.equal(regraded[0].confidenceLevel, 'needs_checking');
  assert.ok(regraded[0].regradeExplanation?.includes('previous: 4/4'));
});

test('calculateSubmissionTotals and detectDuplicateSubmissions work accurately', () => {
  const sampleEval = (id: string, subId: string, ans: string, ai: number, edited: number | null): QuestionEvaluation => ({
    id,
    submissionId: subId,
    questionId: 'q1',
    questionNumber: 'Q1',
    questionText: 'Explain osmosis',
    topic: 'Biology',
    paperSet: 'Set A',
    maxMarks: 5,
    originalStudentAnswer: ans,
    isAttempted: ans.trim().length > 0,
    studentSummary: '',
    modelSummary: '',
    conceptualUnderstanding: '',
    criteriaResults: [],
    aiAwardedMarks: ai,
    teacherEditedMarks: edited,
    finalMarks: edited ?? ai,
    teacherReferenceMarks: null,
    teacherComment: '',
    isApproved: false,
    incorrectStatements: [],
    missingConcepts: [],
    feedback: '',
    confidenceLevel: 'high',
    confidenceReason: '',
  });

  const totals = calculateSubmissionTotals([sampleEval('e1', 's1', 'Water moves across semipermeable membrane', 4, 4.5)]);
  assert.equal(totals.aiTotalMarks, 4);
  assert.equal(totals.finalTotalMarks, 4.5);
  assert.equal(totals.percentage, 90);
  assert.equal(totals.grade, 'A+');

  const text = 'Osmosis is the net movement of water molecules across a selectively permeable membrane from higher water potential to lower water potential.';
  const subs: StudentSubmission[] = [
    {
      id: 's1',
      assessmentId: 'a1',
      studentName: 'Student One',
      studentIdCode: 'ST01',
      paperSet: 'Set A',
      language: 'English',
      status: 'completed',
      sourceFileName: 's1.txt',
      ocrWarnings: [],
      missingPages: [],
      aiTotalMarks: 5,
      finalTotalMarks: 5,
      maxTotalMarks: 5,
      percentage: 100,
      grade: 'A+',
      questionsAttempted: 1,
      questionsTotal: 1,
      reviewRequiredCount: 0,
      submittedAt: '2026-11-17',
      isDemo: true,
      evaluations: [sampleEval('e1', 's1', text, 5, null)],
    },
    {
      id: 's2',
      assessmentId: 'a1',
      studentName: 'Student Two',
      studentIdCode: 'ST02',
      paperSet: 'Set A',
      language: 'English',
      status: 'completed',
      sourceFileName: 's2.txt',
      ocrWarnings: [],
      missingPages: [],
      aiTotalMarks: 5,
      finalTotalMarks: 5,
      maxTotalMarks: 5,
      percentage: 100,
      grade: 'A+',
      questionsAttempted: 1,
      questionsTotal: 1,
      reviewRequiredCount: 0,
      submittedAt: '2026-11-17',
      isDemo: true,
      evaluations: [sampleEval('e2', 's2', text, 5, null)],
    },
  ];
  const dups = detectDuplicateSubmissions(subs);
  assert.equal(dups.get('s2'), 'Student One');
});
