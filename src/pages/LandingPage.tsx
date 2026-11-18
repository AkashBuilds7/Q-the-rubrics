import React from 'react';
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  FileSearch,
  Languages,
  Play,
  Scale,
  Sparkles,
} from 'lucide-react';
import { QubrixLogo } from '../components/QubrixLogo';
import { ThemeToggle } from '../components/ThemeToggle';
import { PrismaticDivider } from '../components/AuroraBackground';

interface LandingPageProps {
  onStartEvaluation: () => void;
  onTryDemo: () => void;
  onOpenDashboard: () => void;
}

export function LandingPage({ onStartEvaluation, onTryDemo, onOpenDashboard }: LandingPageProps) {
  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      {/* Clean 3-Zone Top Bar Contract */}
      <header className="max-w-[1220px] w-full mx-auto px-5 sm:px-8 py-5 flex items-center justify-between gap-8">
        <a
          href="#top"
          className="flex items-center gap-2.5 font-display font-semibold text-lg text-slate-900 dark:text-[#F2F6F4] whitespace-nowrap shrink-0"
        >
          <QubrixLogo size={28} />
          <span>QUBRIX AI</span>
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-[#99A8A1]">
          <a href="#workflow" className="hover:text-slate-900 dark:hover:text-[#F2F6F4] transition-colors whitespace-nowrap shrink-0">
            How It Works
          </a>
          <a href="#features" className="hover:text-slate-900 dark:hover:text-[#F2F6F4] transition-colors whitespace-nowrap shrink-0">
            Capabilities
          </a>
          <a href="#preview" className="hover:text-slate-900 dark:hover:text-[#F2F6F4] transition-colors whitespace-nowrap shrink-0">
            Results Preview
          </a>
          <button
            type="button"
            onClick={onOpenDashboard}
            className="hover:text-slate-900 dark:hover:text-[#F2F6F4] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Dashboard
          </button>
        </nav>

        <button
          type="button"
          onClick={onStartEvaluation}
          className="cta-primary px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-2"
        >
          <span>Start Evaluation</span>
          <ArrowRight className="w-4 h-4 shrink-0" />
        </button>
      </header>

      <main className="flex-1 max-w-[1220px] w-full mx-auto px-5 sm:px-8 pt-6 pb-16">
        {/* Hero Section */}
        <section id="top" className="bento-hero p-7 sm:p-10 lg:p-12">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="text-xs font-medium text-sky-700 dark:text-emerald-300 tracking-tight">
              AI-Powered Answer Evaluation · Conceptual Grading · Evidence &amp; QWK
            </div>
            <ThemeToggle />
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-5">
              <h1 className="font-display font-semibold text-3xl sm:text-5xl leading-[1.12] text-slate-900 dark:text-[#F2F6F4]">
                Beyond Keywords. Understanding Knowledge.
              </h1>
              <p className="text-base sm:text-lg leading-relaxed text-slate-600 dark:text-[#D3DDD8] max-w-2xl">
                QUBRIX AI reads question papers, model answers, marking schemes, and handwritten or typed student sheets—then grades conceptual understanding with exact supporting evidence and clear, encouraging feedback.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onStartEvaluation}
                  className="cta-primary px-6 py-3 rounded-xl text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-2"
                >
                  <span>Start Evaluation</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={onTryDemo}
                  className="px-5 py-3 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-2 border border-sky-200/90 dark:border-emerald-300/25 bg-white/80 dark:bg-[#242F2A]/85 text-slate-800 dark:text-[#F2F6F4] hover:bg-sky-50 dark:hover:bg-[#2B3832] transition-colors"
                >
                  <Play className="w-4 h-4 text-sky-600 dark:text-emerald-300 shrink-0" />
                  <span>Try Demo Assessment</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 bento-inset p-5 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#99A8A1]">
                <span>Conceptual vs. Keyword Check</span>
                <span className="font-mono-num">Q1 · 5.0 / 5.0</span>
              </div>
              <div className="text-sm text-slate-700 dark:text-[#D3DDD8] leading-relaxed">
                “Plants capture light energy from the sun using green chlorophyll pigments and turn CO₂ plus water into sugar while releasing oxygen.”
              </div>
              <div className="pt-3 border-t border-sky-200/70 dark:border-emerald-300/15 space-y-2 text-xs">
                <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    Equivalent explanation accepted
                  </span>
                  <span className="font-mono-num">5/5</span>
                </div>
                <p className="text-slate-500 dark:text-[#99A8A1]">
                  Full marks awarded even without textbook phrasing. Verified against all 5 rubric criteria.
                </p>
              </div>
            </div>
          </div>
        </section>

        <PrismaticDivider className="my-4" />

        {/* Workflow Section */}
        <section id="workflow" className="py-4">
          <div className="mb-6">
            <h2 className="font-display font-semibold text-2xl sm:text-3xl">
              Upload to Report in Four Simple Steps
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-[#99A8A1] mt-1">
              Designed for teachers—powerful conceptual grading inside, effortless workflow outside.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                step: '01',
                title: 'Upload Documents',
                desc: 'Drop PDF, DOCX, XLSX, CSV, or handwritten sheet photos across Set A–D.',
              },
              {
                step: '02',
                title: 'Review Extraction',
                desc: 'Verify extracted answers, catch smudged handwriting warnings, and confirm sets.',
              },
              {
                step: '03',
                title: 'AI Evaluates Concepts',
                desc: 'Scores each rubric criterion independently with verbatim evidence quotes.',
              },
              {
                step: '04',
                title: 'Approve & Download',
                desc: 'Edit borderline marks, run QWK alignment checks, and export PDF, CSV, or Excel.',
              },
            ].map((item) => (
              <div key={item.step} className="bento-card p-6 space-y-2.5">
                <div className="font-mono-num text-xs font-semibold text-sky-600 dark:text-emerald-300">
                  {item.step}
                </div>
                <h3 className="font-display font-semibold text-lg">{item.title}</h3>
                <p className="text-sm text-slate-600 dark:text-[#99A8A1] leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        <PrismaticDivider className="my-4" />

        {/* Key Features Bento Grid */}
        <section id="features" className="py-4">
          <div className="mb-6">
            <h2 className="font-display font-semibold text-2xl sm:text-3xl">
              Built for Fair, Transparent Academic Grading
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="bento-card p-6 md:col-span-2 space-y-3">
              <div className="flex items-center gap-2.5 text-sky-600 dark:text-emerald-300">
                <BookOpenCheck className="w-5 h-5 shrink-0" />
                <h3 className="font-display font-semibold text-lg">Evidence-Backed Conceptual Grading</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-[#D3DDD8] leading-relaxed">
                Short, accurate answers earn full marks while long, keyword-stuffed essays with misconceptions do not. Every awarded mark cites the exact phrase written by the student, and the backend independently validates criterion limits before summing totals.
              </p>
            </div>

            <div className="bento-card p-6 space-y-3">
              <div className="flex items-center gap-2.5 text-sky-600 dark:text-emerald-300">
                <Languages className="w-5 h-5 shrink-0" />
                <h3 className="font-display font-semibold text-lg">23 Languages</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-[#D3DDD8] leading-relaxed">
                Supports English and 22 Indian languages with original script preservation, language-aware grading, and honest beta indicators where OCR needs review.
              </p>
            </div>

            <div className="bento-card p-6 space-y-3">
              <div className="flex items-center gap-2.5 text-sky-600 dark:text-emerald-300">
                <FileSearch className="w-5 h-5 shrink-0" />
                <h3 className="font-display font-semibold text-lg">OCR &amp; Confidence Flags</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-[#D3DDD8] leading-relaxed">
                Unclear handwriting or missing pages are explicitly flagged as “Needs checking” or “Teacher review required” instead of silently guessing.
              </p>
            </div>

            <div className="bento-card p-6 md:col-span-2 space-y-3">
              <div className="flex items-center gap-2.5 text-sky-600 dark:text-emerald-300">
                <Scale className="w-5 h-5 shrink-0" />
                <h3 className="font-display font-semibold text-lg">Dynamic Regrade &amp; Quadratic Weighted Kappa</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-[#D3DDD8] leading-relaxed">
                Adjust rubric criteria anytime after grading—QUBRIX AI preserves historical versions, shows old vs. new marks, and recalculates QWK, MAE, and exact agreement against teacher reference scores.
              </p>
            </div>
          </div>
        </section>

        <PrismaticDivider className="my-4" />

        {/* Results Interface Preview */}
        <section id="preview" className="py-4">
          <div className="bento-card p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="font-display font-semibold text-xl sm:text-2xl">
                  Transparent Two-Panel Results View
                </h2>
                <p className="text-sm text-slate-600 dark:text-[#99A8A1] mt-1">
                  Original student answers sit side-by-side with highlighted evidence and criterion marks.
                </p>
              </div>
              <button
                type="button"
                onClick={onTryDemo}
                className="cta-primary px-5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Explore Live Demo Results</span>
              </button>
            </div>

            <div className="grid lg:grid-cols-2 gap-5">
              <div className="bento-inset p-5 space-y-3">
                <div className="text-xs font-medium text-slate-500 dark:text-[#99A8A1]">
                  Left Panel · Student Answer (Aarav Mehta · Set A · Q2)
                </div>
                <p className="student-answer-prose">
                  <mark className="px-1 rounded bg-sky-200/70 dark:bg-emerald-400/25 text-slate-900 dark:text-[#F2F6F4]">
                    Heat from the sun turns liquid ocean water into vapour through evaporation.
                  </mark>{' '}
                  <mark className="px-1 rounded bg-sky-200/70 dark:bg-emerald-400/25 text-slate-900 dark:text-[#F2F6F4]">
                    Up in the cold sky this vapour condenses into clouds.
                  </mark>{' '}
                  Once droplets get heavy they fall back down as rain or snow.
                </p>
              </div>

              <div className="bento-inset p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-[#99A8A1]">
                    Right Panel · AI Criterion Breakdown
                  </span>
                  <span className="font-mono-num text-sm font-semibold text-sky-700 dark:text-emerald-300">
                    4.0 / 5.0
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-700 dark:text-emerald-300 font-medium">Correct · Evaporation driven by solar heat</span>
                    <span className="font-mono-num">1.5 / 1.5</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-700 dark:text-emerald-300 font-medium">Correct · Condensation into clouds</span>
                    <span className="font-mono-num">1.5 / 1.5</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-700 dark:text-emerald-300 font-medium">Correct · Precipitation</span>
                    <span className="font-mono-num">1.0 / 1.0</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-amber-700 dark:text-amber-300 font-medium">Missing · Collection / runoff continuity</span>
                    <span className="font-mono-num">0.0 / 1.0</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
