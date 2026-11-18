import type { EducationLevel, PaperSet } from './types';

export interface LanguageSupportItem {
  name: string;
  nativeName: string;
  reliability: 'full' | 'beta';
  note: string;
}

export const SUPPORTED_LANGUAGES: LanguageSupportItem[] = [
  { name: 'English', nativeName: 'English', reliability: 'full', note: 'Full conceptual & OCR support' },
  { name: 'Hindi', nativeName: 'हिन्दी', reliability: 'full', note: 'Full Devanagari OCR & conceptual grading' },
  { name: 'Kannada', nativeName: 'ಕನ್ನಡ', reliability: 'full', note: 'Full Kannada script & conceptual grading' },
  { name: 'Telugu', nativeName: 'తెలుగు', reliability: 'full', note: 'Full Telugu script & conceptual grading' },
  { name: 'Tamil', nativeName: 'தமிழ்', reliability: 'full', note: 'Full Tamil script & conceptual grading' },
  { name: 'Malayalam', nativeName: 'മലയാളം', reliability: 'full', note: 'Full Malayalam script & conceptual grading' },
  { name: 'Marathi', nativeName: 'मराठी', reliability: 'full', note: 'Full Devanagari OCR & conceptual grading' },
  { name: 'Bengali', nativeName: 'বাংলা', reliability: 'full', note: 'Full Bengali script & conceptual grading' },
  { name: 'Gujarati', nativeName: 'ગુજરાતી', reliability: 'full', note: 'Full Gujarati script & conceptual grading' },
  { name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', reliability: 'full', note: 'Gurmukhi script & conceptual grading' },
  { name: 'Odia', nativeName: 'ଓଡ଼ିଆ', reliability: 'beta', note: 'Printed text supported; verify handwritten OCR carefully' },
  { name: 'Assamese', nativeName: 'অসমীয়া', reliability: 'beta', note: 'Printed text supported; verify handwritten OCR carefully' },
  { name: 'Urdu', nativeName: 'اردو', reliability: 'full', note: 'Perso-Arabic script & conceptual grading' },
  { name: 'Sanskrit', nativeName: 'संस्कृतम्', reliability: 'beta', note: 'Conceptual & verse meaning support; verify technical terms' },
  { name: 'Konkani', nativeName: 'कोंकणी', reliability: 'beta', note: 'Devanagari script supported; teacher review advised' },
  { name: 'Kashmiri', nativeName: 'कॉशुर / کٲشُر', reliability: 'beta', note: 'Limited handwriting OCR; review extracted text first' },
  { name: 'Manipuri', nativeName: 'মৈতৈলোন্', reliability: 'beta', note: 'Meitei/Bengali script beta; teacher verification advised' },
  { name: 'Nepali', nativeName: 'नेपाली', reliability: 'full', note: 'Devanagari script & conceptual grading' },
  { name: 'Bodo', nativeName: 'बड़ो', reliability: 'beta', note: 'Devanagari script beta; teacher review advised' },
  { name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', reliability: 'beta', note: 'Ol Chiki script beta; manual verification recommended' },
  { name: 'Dogri', nativeName: 'डोगरी', reliability: 'beta', note: 'Devanagari script beta; teacher verification advised' },
  { name: 'Maithili', nativeName: 'मैथिली', reliability: 'beta', note: 'Devanagari script beta; teacher review advised' },
  { name: 'Sindhi', nativeName: 'सिन्धी / سنڌي', reliability: 'beta', note: 'Devanagari & Arabic script beta; verify OCR output' },
];

export const EDUCATION_LEVELS: Array<{
  value: EducationLevel;
  label: string;
  grammarGuidance: string;
}> = [
  {
    value: 'primary',
    label: 'Primary School (Grades 1–5)',
    grammarGuidance: 'Focus purely on basic conceptual understanding; accept simple everyday explanations; do not penalize grammar or spelling.',
  },
  {
    value: 'middle',
    label: 'Middle School (Grades 6–8)',
    grammarGuidance: 'Prioritize core scientific/conceptual understanding; accept clear informal wording; ignore minor grammar issues.',
  },
  {
    value: 'secondary',
    label: 'Secondary School (Grades 9–10)',
    grammarGuidance: 'Expect clear conceptual reasoning and key process links; never deduct marks for grammar unless in rubric.',
  },
  {
    value: 'higher_secondary',
    label: 'Higher Secondary (Grades 11–12)',
    grammarGuidance: 'Verify scientific accuracy, equations, and logical steps; accept equivalent phrasing.',
  },
  {
    value: 'undergraduate',
    label: 'Undergraduate',
    grammarGuidance: 'Evaluate technical accuracy, domain terminology, and rigorous logical justification.',
  },
  {
    value: 'postgraduate',
    label: 'Postgraduate',
    grammarGuidance: 'Expect deep analytical precision, domain terminology, and nuanced theoretical synthesis.',
  },
  {
    value: 'professional',
    label: 'Professional Courses',
    grammarGuidance: 'Assess technical precision, applied correctness, and clear professional reasoning.',
  },
];

export const SUBJECTS: string[] = [
  'Biology',
  'Physics',
  'Chemistry',
  'Mathematics',
  'Computer Science',
  'Engineering',
  'English',
  'Languages',
  'History',
  'Geography',
  'Economics',
  'Business Studies',
  'Custom Subject',
];

export const PAPER_SETS: PaperSet[] = ['Set A', 'Set B', 'Set C', 'Set D'];

export function computeLetterGrade(percentage: number): string {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 40) return 'D';
  return 'Needs Support';
}
