import type {
  ConfidenceLevel,
  CriterionEvaluation,
  CriterionStatus,
  MarkingCriterion,
  PaperSet,
  QuestionEvaluation,
  QwkPair,
  QwkResult,
  SetComparisonRow,
  StudentSubmission,
} from './types';
import { computeLetterGrade } from './constants';

export interface AiCriterionRecommendation {
  criterionId: string;
  recommendedMarks: number;
  status: CriterionStatus;
  supportingEvidence: string;
  reasoning: string;
}

export interface ValidatedMarksOutput {
  criteriaResults: CriterionEvaluation[];
  aiAwardedMarks: number;
  validationWarnings: string[];
  adjustedConfidence: ConfidenceLevel;
}

/**
 * Independently validates AI-recommended marks against the teacher's marking scheme.
 * Never trusts an unvalidated AI-generated total.
 */
export function validateAndCalculateQuestionMarks(
  schemeCriteria: MarkingCriterion[],
  aiRecommendations: AiCriterionRecommendation[],
  questionMaxMarks: number,
  initialConfidence: ConfidenceLevel,
  studentAnswer: string
): ValidatedMarksOutput {
  const warnings: string[] = [];
  const trimmedAnswer = (studentAnswer || '').trim();
  const recMap = new Map<string, AiCriterionRecommendation>();
  for (const rec of aiRecommendations || []) {
    if (rec && rec.criterionId) {
      recMap.set(rec.criterionId, rec);
    }
  }

  let runningSum = 0;
  const criteriaResults: CriterionEvaluation[] = schemeCriteria.map((criterion) => {
    const rec = recMap.get(criterion.id);
    if (!rec) {
      warnings.push(`Missing AI evaluation for criterion "${criterion.description}". Defaulted to 0.`);
      return {
        criterionId: criterion.id,
        description: criterion.description,
        maxMarks: criterion.maxMarks,
        awardedMarks: 0,
        status: 'missing',
        supportingEvidence: '',
        reasoning: 'No evaluation returned for this criterion.',
      };
    }

    let rawMarks = Number.isFinite(rec.recommendedMarks) ? rec.recommendedMarks : 0;
    if (rawMarks < 0) {
      warnings.push(`Negative marks (${rawMarks}) clamped to 0 for "${criterion.description}".`);
      rawMarks = 0;
    }
    if (rawMarks > criterion.maxMarks) {
      warnings.push(
        `AI recommended ${rawMarks} > max ${criterion.maxMarks} for "${criterion.description}". Clamped to ${criterion.maxMarks}.`
      );
      rawMarks = criterion.maxMarks;
    }

    // Round to nearest 0.5 for clean educational marking
    const awardedMarks = Math.round(rawMarks * 2) / 2;
    let status: CriterionStatus = rec.status;
    let evidence = (rec.supportingEvidence || '').trim();

    // Guard against AI awarding full/partial marks with zero answer or fabricated evidence check
    if (trimmedAnswer.length === 0 && awardedMarks > 0) {
      warnings.push(`Student answer is empty; overridden awarded marks to 0 for "${criterion.description}".`);
      runningSum += 0;
      return {
        criterionId: criterion.id,
        description: criterion.description,
        maxMarks: criterion.maxMarks,
        awardedMarks: 0,
        status: 'missing',
        supportingEvidence: '',
        reasoning: 'Question was not attempted.',
      };
    }

    // Ensure status matches awarded marks consistently
    if (awardedMarks === 0 && status === 'correct') {
      status = 'incorrect';
    } else if (awardedMarks >= criterion.maxMarks && status !== 'correct') {
      status = 'correct';
    } else if (awardedMarks > 0 && awardedMarks < criterion.maxMarks && status === 'missing') {
      status = 'partially_correct';
    }

    // Verify evidence isn't empty when marks > 0
    if (awardedMarks > 0 && !evidence) {
      warnings.push(`Supporting quote missing for "${criterion.description}"; flagged for checking.`);
      evidence = '';
    }

    runningSum += awardedMarks;
    return {
      criterionId: criterion.id,
      description: criterion.description,
      maxMarks: criterion.maxMarks,
      awardedMarks,
      status,
      supportingEvidence: evidence,
      reasoning: (rec.reasoning || '').trim() || 'Evaluated against marking criterion.',
    };
  });

  // Cap question total independently against questionMaxMarks
  let aiAwardedMarks = Math.round(runningSum * 2) / 2;
  if (aiAwardedMarks > questionMaxMarks) {
    warnings.push(`Sum of criteria (${aiAwardedMarks}) exceeded question max (${questionMaxMarks}). Capped.`);
    aiAwardedMarks = questionMaxMarks;
  }
  if (aiAwardedMarks < 0) {
    aiAwardedMarks = 0;
  }

  let adjustedConfidence = initialConfidence;
  if (warnings.length > 0 && adjustedConfidence === 'high') {
    adjustedConfidence = 'needs_checking';
  }

  // Borderline marks check (e.g., exactly 50% or fractional uncertainty)
  if (
    adjustedConfidence === 'high' &&
    questionMaxMarks > 0 &&
    Math.abs(aiAwardedMarks / questionMaxMarks - 0.5) < 0.05 &&
    criteriaResults.some((c) => c.status === 'partially_correct')
  ) {
    // Keep high unless multiple warnings, or leave as provided
  }

  return {
    criteriaResults,
    aiAwardedMarks,
    validationWarnings: warnings,
    adjustedConfidence,
  };
}

/**
 * Computes overall submission totals independently from question evaluations.
 */
export function calculateSubmissionTotals(evaluations: QuestionEvaluation[]): {
  aiTotalMarks: number;
  finalTotalMarks: number;
  maxTotalMarks: number;
  percentage: number;
  grade: string;
  questionsAttempted: number;
  questionsTotal: number;
  reviewRequiredCount: number;
} {
  let aiTotalMarks = 0;
  let finalTotalMarks = 0;
  let maxTotalMarks = 0;
  let questionsAttempted = 0;
  let reviewRequiredCount = 0;

  for (const ev of evaluations) {
    const qMax = Math.max(0, ev.maxMarks);
    const aiQ = Math.min(qMax, Math.max(0, ev.aiAwardedMarks));
    const finalQ = Math.min(
      qMax,
      Math.max(0, ev.teacherEditedMarks !== null && ev.teacherEditedMarks !== undefined ? ev.teacherEditedMarks : aiQ)
    );

    aiTotalMarks += aiQ;
    finalTotalMarks += finalQ;
    maxTotalMarks += qMax;

    if (ev.isAttempted && (ev.originalStudentAnswer || '').trim().length > 0) {
      questionsAttempted += 1;
    }
    if (!ev.isApproved && ev.confidenceLevel !== 'high') {
      reviewRequiredCount += 1;
    }
  }

  aiTotalMarks = Math.round(aiTotalMarks * 2) / 2;
  finalTotalMarks = Math.round(finalTotalMarks * 2) / 2;
  maxTotalMarks = Math.round(maxTotalMarks * 2) / 2;

  const percentage = maxTotalMarks > 0 ? Math.round((finalTotalMarks / maxTotalMarks) * 1000) / 10 : 0;
  const grade = computeLetterGrade(percentage);

  return {
    aiTotalMarks,
    finalTotalMarks,
    maxTotalMarks,
    percentage,
    grade,
    questionsAttempted,
    questionsTotal: evaluations.length,
    reviewRequiredCount,
  };
}

/**
 * Regrades existing question evaluations proportionally when a marking scheme is updated,
 * preserving previous marks and providing clear explanations.
 */
export function regradeEvaluationsWithNewScheme(
  evaluations: QuestionEvaluation[],
  newQuestionsByNumber: Map<string, { maxMarks: number; criteria: MarkingCriterion[] }>
): QuestionEvaluation[] {
  return evaluations.map((ev) => {
    const updatedQ =
      newQuestionsByNumber.get(ev.questionId) ||
      newQuestionsByNumber.get(`${ev.paperSet}::${ev.questionNumber}`) ||
      newQuestionsByNumber.get(ev.questionNumber);
    if (!updatedQ) return ev;

    const oldMarks = ev.finalMarks;
    const oldCritMap = new Map(ev.criteriaResults.map((c) => [c.criterionId, c]));
    const oldCritByDesc = new Map(ev.criteriaResults.map((c) => [c.description.toLowerCase().trim(), c]));

    let newSum = 0;
    const newCriteriaResults: CriterionEvaluation[] = updatedQ.criteria.map((newCrit) => {
      const matched = oldCritMap.get(newCrit.id) || oldCritByDesc.get(newCrit.description.toLowerCase().trim());
      if (matched) {
        const ratio = matched.maxMarks > 0 ? matched.awardedMarks / matched.maxMarks : 0;
        const scaled = Math.min(newCrit.maxMarks, Math.round(ratio * newCrit.maxMarks * 2) / 2);
        newSum += scaled;
        return {
          criterionId: newCrit.id,
          description: newCrit.description,
          maxMarks: newCrit.maxMarks,
          awardedMarks: scaled,
          status: matched.status,
          supportingEvidence: matched.supportingEvidence,
          reasoning: matched.reasoning,
        };
      }

      // New criterion added after initial grading: flag for teacher/AI verification with 0 initial marks
      return {
        criterionId: newCrit.id,
        description: newCrit.description,
        maxMarks: newCrit.maxMarks,
        awardedMarks: 0,
        status: 'missing',
        supportingEvidence: '',
        reasoning: 'Newly added criterion in updated marking scheme — review or run AI re-check.',
      };
    });

    const cappedTotal = Math.min(updatedQ.maxMarks, Math.round(newSum * 2) / 2);
    const hasNewCriteria = updatedQ.criteria.some(
      (c) => !oldCritMap.has(c.id) && !oldCritByDesc.has(c.description.toLowerCase().trim())
    );
    const diff = Math.round((cappedTotal - oldMarks) * 2) / 2;
    const diffLabel = diff > 0 ? `+${diff}` : `${diff}`;
    const explanation =
      `Regraded under updated marking scheme (previous: ${oldMarks}/${ev.maxMarks}, new: ${cappedTotal}/${updatedQ.maxMarks}, change: ${diffLabel}).` +
      (hasNewCriteria ? ' New criteria were added and flagged for checking.' : '');

    return {
      ...ev,
      maxMarks: updatedQ.maxMarks,
      criteriaResults: newCriteriaResults,
      regradePreviousMarks: oldMarks,
      regradeExplanation: explanation,
      aiAwardedMarks: cappedTotal,
      teacherEditedMarks: null,
      finalMarks: cappedTotal,
      confidenceLevel: hasNewCriteria ? 'needs_checking' : ev.confidenceLevel,
      isApproved: hasNewCriteria ? false : ev.isApproved,
    };
  });
}

/**
 * Quadratic Weighted Kappa (QWK) implementation with rigorous edge-case handling.
 * Distinguishes agreement with teachers from ground-truth correctness.
 */
export function calculateQuadraticWeightedKappa(pairs: QwkPair[]): QwkResult {
  const validPairs = pairs.filter(
    (p) =>
      Number.isFinite(p.aiMarks) &&
      Number.isFinite(p.teacherMarks) &&
      Number.isFinite(p.maxMarks) &&
      p.maxMarks > 0
  );

  const n = validPairs.length;
  if (n < 3) {
    return {
      status: 'insufficient_data',
      qwk: null,
      mae: n > 0 ? round3(validPairs.reduce((acc, p) => acc + Math.abs(p.aiMarks - p.teacherMarks), 0) / n) : null,
      exactAgreementPct:
        n > 0
          ? round1((validPairs.filter((p) => Math.abs(p.aiMarks - p.teacherMarks) < 0.01).length / n) * 100)
          : null,
      withinOneMarkPct: null,
      sampleCount: n,
      interpretation:
        'At least 3 evaluated answers with teacher reference marks are required before QWK can be reliably calculated.',
      questionWise: computeQuestionWiseStats(validPairs),
    };
  }

  // Normalize all scores onto integer bins 0..10 (deciles / scaled marks) so mixed maxMarks questions combine cleanly
  // Or if all share small integer steps, scale to 0..20 half-mark bins on normalized 0..10 scale
  const NUM_BINS = 11; // 0..10 integer scale
  const aiBins = validPairs.map((p) => Math.min(10, Math.max(0, Math.round((p.aiMarks / p.maxMarks) * 10))));
  const teacherBins = validPairs.map((p) => Math.min(10, Math.max(0, Math.round((p.teacherMarks / p.maxMarks) * 10))));

  const mae = round3(validPairs.reduce((acc, p) => acc + Math.abs(p.aiMarks - p.teacherMarks), 0) / n);
  const exactAgreementPct = round1(
    (validPairs.filter((p) => Math.abs(p.aiMarks - p.teacherMarks) <= 0.25).length / n) * 100
  );
  const withinOneMarkPct = round1(
    (validPairs.filter((p) => Math.abs(p.aiMarks - p.teacherMarks) <= 1.0).length / n) * 100
  );

  // Build observed confusion matrix O and marginal histograms
  const O: number[][] = Array.from({ length: NUM_BINS }, () => Array(NUM_BINS).fill(0));
  const histAi = Array(NUM_BINS).fill(0);
  const histTeacher = Array(NUM_BINS).fill(0);

  for (let i = 0; i < n; i++) {
    const a = aiBins[i];
    const t = teacherBins[i];
    O[a][t] += 1;
    histAi[a] += 1;
    histTeacher[t] += 1;
  }

  // Check for constant distributions (zero variance in either rater)
  const aiUnique = histAi.filter((c) => c > 0).length;
  const teacherUnique = histTeacher.filter((c) => c > 0).length;

  let num = 0;
  let den = 0;
  const denomScale = (NUM_BINS - 1) * (NUM_BINS - 1);

  for (let i = 0; i < NUM_BINS; i++) {
    for (let j = 0; j < NUM_BINS; j++) {
      const w = ((i - j) * (i - j)) / denomScale;
      const expected = (histAi[i] * histTeacher[j]) / n;
      num += w * O[i][j];
      den += w * expected;
    }
  }

  if (den === 0 || aiUnique <= 1 || teacherUnique <= 1) {
    return {
      status: 'constant_distribution',
      qwk: null,
      mae,
      exactAgreementPct,
      withinOneMarkPct,
      sampleCount: n,
      interpretation:
        'Scores show zero variance (all answers received the same normalized mark). QWK cannot distinguish agreement beyond chance until more varied scores are available.',
      questionWise: computeQuestionWiseStats(validPairs),
    };
  }

  const qwk = round3(1 - num / den);
  let interpretation = '';
  if (n < 8) {
    interpretation = `Preliminary QWK is ${qwk.toFixed(2)} across ${n} answers (agreement with teacher marks, not independent proof of correctness). Add more teacher reference scores for stronger statistical confidence.`;
  } else if (qwk >= 0.8) {
    interpretation = `AI and teacher marks are strongly aligned (QWK ${qwk.toFixed(2)}) across ${n} reference-checked answers.`;
  } else if (qwk >= 0.6) {
    interpretation = `AI and teacher marks show substantial alignment (QWK ${qwk.toFixed(2)}). Review questions with larger mark differences below.`;
  } else if (qwk >= 0.4) {
    interpretation = `AI and teacher marks show moderate alignment (QWK ${qwk.toFixed(2)}). Adjusting marking criteria descriptions may improve consistency.`;
  } else {
    interpretation = `AI and teacher marks show low alignment (QWK ${qwk.toFixed(2)}). Teacher review is recommended for this assessment.`;
  }

  return {
    status: 'valid',
    qwk,
    mae,
    exactAgreementPct,
    withinOneMarkPct,
    sampleCount: n,
    interpretation,
    questionWise: computeQuestionWiseStats(validPairs),
  };
}

function computeQuestionWiseStats(pairs: QwkPair[]) {
  const byQ = new Map<string, QwkPair[]>();
  for (const p of pairs) {
    const arr = byQ.get(p.questionNumber) || [];
    arr.push(p);
    byQ.set(p.questionNumber, arr);
  }
  return Array.from(byQ.entries()).map(([questionNumber, list]) => {
    const count = list.length;
    const mae = round3(list.reduce((a, b) => a + Math.abs(b.aiMarks - b.teacherMarks), 0) / count);
    const exactAgreementPct = round1(
      (list.filter((p) => Math.abs(p.aiMarks - p.teacherMarks) <= 0.25).length / count) * 100
    );
    const avgDiff = round3(list.reduce((a, b) => a + (b.aiMarks - b.teacherMarks), 0) / count);
    return { questionNumber, sampleCount: count, mae, exactAgreementPct, avgDiff };
  });
}

/**
 * Compares Question Paper Sets using both question complexity & performance,
 * marking rankings as provisional if sample sizes are small. Never adjusts marks.
 */
export function buildSetComparison(
  submissions: StudentSubmission[],
  questions: Array<{ paperSet: PaperSet; maxMarks: number; criteria: MarkingCriterion[] }>
): SetComparisonRow[] {
  const sets: PaperSet[] = ['Set A', 'Set B', 'Set C', 'Set D'];
  const rows: SetComparisonRow[] = [];

  for (const paperSet of sets) {
    const setSubs = submissions.filter((s) => s.paperSet === paperSet);
    const setQs = questions.filter((q) => q.paperSet === paperSet);
    if (setSubs.length === 0 && setQs.length === 0) continue;

    const avgMarks =
      setSubs.length > 0
        ? round1(setSubs.reduce((acc, s) => acc + s.finalTotalMarks, 0) / setSubs.length)
        : 0;
    const maxMarks =
      setSubs.length > 0
        ? setSubs[0].maxTotalMarks
        : setQs.reduce((acc, q) => acc + q.maxMarks, 0);
    const perfPct = maxMarks > 0 && setSubs.length > 0 ? round1((avgMarks / maxMarks) * 100) : 0;

    // Question complexity heuristic based on criteria count & core weighting (not just low student scores!)
    const totalCriteria = setQs.reduce((acc, q) => acc + q.criteria.length, 0);
    const coreCriteria = setQs.reduce(
      (acc, q) => acc + q.criteria.filter((c) => c.importance === 'core').length,
      0
    );
    const complexityScore =
      setQs.length > 0 ? round1((totalCriteria / setQs.length) * 15 + (coreCriteria / setQs.length) * 10) : 50;

    // Combined difficulty index (complexity weighted alongside performance when enough samples exist)
    const isProvisional = setSubs.length < 5;
    let estimatedDifficulty: 'Easy' | 'Moderate' | 'Challenging' = 'Moderate';
    if (complexityScore >= 72 || (setSubs.length >= 5 && perfPct < 55 && complexityScore >= 55)) {
      estimatedDifficulty = 'Challenging';
    } else if (complexityScore <= 42 && perfPct >= 75) {
      estimatedDifficulty = 'Easy';
    }

    rows.push({
      paperSet,
      studentCount: setSubs.length,
      averageMarks: avgMarks,
      maxMarks,
      performancePercentage: perfPct,
      estimatedDifficulty,
      difficultyRank: 1,
      isProvisional,
      complexityScore,
    });
  }

  // Rank from most challenging (1) to easiest
  const sorted = [...rows].sort((a, b) => b.complexityScore - a.complexityScore);
  sorted.forEach((r, idx) => {
    r.difficultyRank = idx + 1;
  });

  return rows;
}

/**
 * Detects suspected duplicate student answer sheets using normalized token Jaccard similarity.
 */
export function detectDuplicateSubmissions(submissions: StudentSubmission[]): Map<string, string> {
  const duplicates = new Map<string, string>();
  const tokenSets = submissions.map((sub) => {
    const combined = sub.evaluations
      .map((e) => e.originalStudentAnswer)
      .join(' ')
      .toLowerCase()
      .replace(/[^a-z0-9\u0900-\u0d7f\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);
    return new Set(combined);
  });

  for (let i = 0; i < submissions.length; i++) {
    if (tokenSets[i].size < 8) continue;
    for (let j = i + 1; j < submissions.length; j++) {
      if (submissions[i].paperSet !== submissions[j].paperSet) continue;
      if (tokenSets[j].size < 8) continue;
      let intersection = 0;
      for (const tok of tokenSets[i]) {
        if (tokenSets[j].has(tok)) intersection += 1;
      }
      const union = tokenSets[i].size + tokenSets[j].size - intersection;
      const similarity = union > 0 ? intersection / union : 0;
      if (similarity >= 0.88) {
        duplicates.set(submissions[j].id, submissions[i].studentName);
      }
    }
  }
  return duplicates;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
