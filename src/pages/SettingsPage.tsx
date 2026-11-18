import React, { useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { EDUCATION_LEVELS, SUBJECTS, SUPPORTED_LANGUAGES } from '../shared/constants';
import type { AppSettings, Assessment, EducationLevel } from '../shared/types';
import { ThemeToggle } from '../components/ThemeToggle';
import { resetDemoData, updateSettings } from '../utils/api';

interface SettingsPageProps {
  settings: AppSettings;
  onSettingsUpdated: (s: AppSettings) => void;
  onDemoReset: (demo: Assessment) => void;
}

export function SettingsPage({ settings, onSettingsUpdated, onDemoReset }: SettingsPageProps) {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    try {
      const saved = await updateSettings(draft);
      onSettingsUpdated(saved);
      setStatusMsg('Settings saved successfully.');
    } catch (err: any) {
      setStatusMsg(err?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDemo = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      const demo = await resetDemoData();
      onDemoReset(demo);
      setStatusMsg('Demonstration assessment restored to initial sample state.');
    } catch (err: any) {
      setStatusMsg(err?.message || 'Failed to reset demonstration data.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bento-hero p-6">
        <div className="text-xs font-medium text-sky-700 dark:text-emerald-300">
          Workspace Preferences
        </div>
        <h1 className="font-display font-semibold text-2xl sm:text-3xl mt-1">Settings</h1>
      </div>

      {/* Theme Appearance Card */}
      <div className="bento-card p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-semibold text-lg">Visual Theme</h2>
          <p className="text-xs text-slate-500 dark:text-[#99A8A1] mt-0.5">
            Switch between Minimalist Light Pale Blue Aurora and Obsidian Dark Light-Green Radiance.
          </p>
        </div>
        <ThemeToggle />
      </div>

      {/* Grading Defaults Form */}
      <form onSubmit={handleSave} className="bento-card p-6 space-y-5">
        <h2 className="font-display font-semibold text-lg">Default Evaluation Preferences</h2>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="set-lang" className="block text-xs text-slate-600 dark:text-[#99A8A1] mb-1">
              Default Language
            </label>
            <select
              id="set-lang"
              value={draft.defaultLanguage}
              onChange={(e) => setDraft({ ...draft, defaultLanguage: e.target.value })}
              className="w-full px-3 py-2 rounded-xl text-sm bento-inset text-slate-900 dark:text-[#F2F6F4]"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.name} value={l.name}>
                  {l.name} ({l.nativeName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="set-level" className="block text-xs text-slate-600 dark:text-[#99A8A1] mb-1">
              Default Education Level
            </label>
            <select
              id="set-level"
              value={draft.defaultEducationLevel}
              onChange={(e) => setDraft({ ...draft, defaultEducationLevel: e.target.value as EducationLevel })}
              className="w-full px-3 py-2 rounded-xl text-sm bento-inset text-slate-900 dark:text-[#F2F6F4]"
            >
              {EDUCATION_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="set-subj" className="block text-xs text-slate-600 dark:text-[#99A8A1] mb-1">
              Default Subject
            </label>
            <select
              id="set-subj"
              value={draft.defaultSubject}
              onChange={(e) => setDraft({ ...draft, defaultSubject: e.target.value })}
              className="w-full px-3 py-2 rounded-xl text-sm bento-inset text-slate-900 dark:text-[#F2F6F4]"
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={draft.feedbackInStudentLanguage}
            onChange={(e) => setDraft({ ...draft, feedbackInStudentLanguage: e.target.checked })}
            className="w-4 h-4 rounded accent-sky-600 dark:accent-emerald-400"
          />
          <span>Generate student feedback in the detected/selected answer language</span>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="cta-primary px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer inline-flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Save Preferences</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleResetDemo}
            className="px-4 py-2.5 rounded-xl text-xs font-medium bento-inset hover:bg-sky-50 dark:hover:bg-[#2B3832] cursor-pointer inline-flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demonstration Assessment</span>
          </button>
        </div>

        {statusMsg && (
          <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{statusMsg}</div>
        )}
      </form>
    </div>
  );
}
