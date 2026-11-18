import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import type { Assessment, StudentSubmission } from '../shared/types';

export function downloadStudentPdfReport(assessment: Assessment, submission: StudentSubmission): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 42;
  const maxLineWidth = pageWidth - margin * 2;
  let y = 46;

  const ensureSpace = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 48) {
      doc.addPage();
      y = 46;
    }
  };

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(2, 132, 199);
  doc.text('QUBRIX AI — Student Evaluation Report', margin, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Beyond Keywords. Understanding Knowledge.${submission.isDemo ? '  |  DEMONSTRATION DATA' : ''}`,
    margin,
    y
  );
  y += 20;

  // Student summary box
  doc.setDrawColor(191, 211, 232);
  doc.setFillColor(243, 247, 252);
  doc.roundedRect(margin, y, maxLineWidth, 84, 6, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text(`${submission.studentName} (${submission.studentIdCode})`, margin + 14, y + 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`Assessment: ${assessment.title}`, margin + 14, y + 40);
  doc.text(
    `Subject: ${assessment.subject}  ·  Class: ${assessment.className}  ·  Paper Set: ${submission.paperSet}`,
    margin + 14,
    y + 56
  );
  doc.text(
    `Score: ${submission.finalTotalMarks} / ${submission.maxTotalMarks} (${submission.percentage}%)  ·  Grade: ${submission.grade}  ·  Attempted: ${submission.questionsAttempted}/${submission.questionsTotal}`,
    margin + 14,
    y + 72
  );
  y += 104;

  // Strengths & Topics to revise
  const strongTopics = Array.from(
    new Set(
      submission.evaluations
        .filter((e) => e.maxMarks > 0 && e.finalMarks / e.maxMarks >= 0.75)
        .map((e) => e.topic)
    )
  );
  const weakTopics = Array.from(
    new Set(
      submission.evaluations
        .filter((e) => e.maxMarks > 0 && e.finalMarks / e.maxMarks < 0.65)
        .map((e) => e.topic)
    )
  );

  ensureSpace(64);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('Learning Insights', margin, y);
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Strong areas: ${strongTopics.length > 0 ? strongTopics.join(', ') : 'Developing across topics'}`, margin, y);
  y += 15;
  doc.text(`Topics to revise: ${weakTopics.length > 0 ? weakTopics.join(', ') : 'None flagged — strong overall'}`, margin, y);
  y += 24;

  // Question-by-question breakdown
  for (const ev of submission.evaluations) {
    ensureSpace(140);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(2, 132, 199);
    doc.text(
      `${ev.questionNumber} (${ev.topic}) — ${ev.finalMarks} / ${ev.maxMarks} marks`,
      margin,
      y
    );
    y += 15;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    const qLines = doc.splitTextToSize(`Question: ${ev.questionText}`, maxLineWidth);
    doc.text(qLines, margin, y);
    y += qLines.length * 13 + 4;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const ansText = ev.isAttempted ? ev.originalStudentAnswer : '(Not attempted)';
    const ansLines = doc.splitTextToSize(`Student Answer: ${ansText}`, maxLineWidth);
    ensureSpace(ansLines.length * 13 + 24);
    doc.text(ansLines, margin, y);
    y += ansLines.length * 13 + 6;

    const fbLines = doc.splitTextToSize(`Feedback: ${ev.feedback}`, maxLineWidth);
    ensureSpace(fbLines.length * 13 + 20);
    doc.setTextColor(15, 118, 110);
    doc.text(fbLines, margin, y);
    y += fbLines.length * 13 + 8;

    if (ev.teacherComment) {
      const tcLines = doc.splitTextToSize(`Teacher Comment: ${ev.teacherComment}`, maxLineWidth);
      ensureSpace(tcLines.length * 13 + 12);
      doc.setTextColor(30, 41, 59);
      doc.text(tcLines, margin, y);
      y += tcLines.length * 13 + 8;
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 18;
  }

  const safeName = submission.studentName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  doc.save(`qubrix_report_${safeName}.pdf`);
}

export function exportClassResultsCsv(assessment: Assessment): void {
  const headers = [
    'Student ID',
    'Student Name',
    'Paper Set',
    'Language',
    'AI Total Marks',
    'Final Total Marks',
    'Max Marks',
    'Percentage',
    'Grade',
    'Attempted',
    'Needs Review',
    'Data Type',
  ];
  const rows = assessment.submissions.map((s) => [
    s.studentIdCode,
    s.studentName,
    s.paperSet,
    s.language,
    s.aiTotalMarks,
    s.finalTotalMarks,
    s.maxTotalMarks,
    `${s.percentage}%`,
    s.grade,
    `${s.questionsAttempted}/${s.questionsTotal}`,
    s.reviewRequiredCount,
    s.isDemo ? 'Demonstration Data' : 'Live Evaluation',
  ]);

  const csvContent = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `qubrix_results_${assessment.id}.csv`);
}

export function exportClassResultsExcel(assessment: Assessment): void {
  const summaryRows = assessment.submissions.map((s) => ({
    'Student ID': s.studentIdCode,
    'Student Name': s.studentName,
    'Paper Set': s.paperSet,
    Language: s.language,
    'AI Marks': s.aiTotalMarks,
    'Final Marks': s.finalTotalMarks,
    'Max Marks': s.maxTotalMarks,
    'Percentage (%)': s.percentage,
    Grade: s.grade,
    Attempted: `${s.questionsAttempted}/${s.questionsTotal}`,
    'Pending Review': s.reviewRequiredCount,
    'Source Type': s.isDemo ? 'Demonstration Data' : 'Live Evaluation',
  }));

  const detailRows = assessment.submissions.flatMap((s) =>
    s.evaluations.map((ev) => ({
      'Student Name': s.studentName,
      'Paper Set': ev.paperSet,
      Question: ev.questionNumber,
      Topic: ev.topic,
      'AI Marks': ev.aiAwardedMarks,
      'Final Marks': ev.finalMarks,
      'Max Marks': ev.maxMarks,
      Confidence: ev.confidenceLevel,
      Approved: ev.isApproved ? 'Yes' : 'No',
      Feedback: ev.feedback,
    }))
  );

  const wb = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  const wsDetail = XLSX.utils.json_to_sheet(detailRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Class Results');
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Question Breakdown');
  XLSX.writeFile(wb, `qubrix_results_${assessment.id}.xlsx`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
