'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/context';

interface SkillDiagramPreviewProps {
  skillMdContent: string;
  /** Called with the raw mermaid text when generation succeeds */
  onGenerated?: (mermaid: string) => void;
  /** Called when loading status changes (loading=true → start, idle/error/success → done) */
  onLoadingChange?: (loading: boolean) => void;
  /** compact = hide generate button, used when button is placed outside */
  compact?: boolean;
}

const STORAGE_KEY = 'clawplay_draft_mermaid';
let mermaidInitialized = false;
let mermaidScriptLoaded = false;

export default function SkillDiagramPreview({
  skillMdContent,
  onGenerated,
  onLoadingChange,
  compact = false,
}: SkillDiagramPreviewProps) {
  const t = useT('submit');
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [mermaid, setMermaid] = useState<string>('');
  const [editMode, setEditMode] = useState(false);
  const [editedCode, setEditedCode] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [svg, setSvg] = useState<string>('');

  // Mark as mounted
  useEffect(() => setMounted(true), []);

  // Load mermaid.js from CDN once
  useEffect(() => {
    if (mermaidInitialized) return;
    mermaidInitialized = true;
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
    script.onload = () => {
      mermaidScriptLoaded = true;
      (window as Window & { mermaid?: { initialize(opts: unknown): void } }).mermaid?.initialize({
        startOnLoad: false,
        theme: 'neutral',
        flowchart: { useMaxWidth: true },
      });
    };
    document.head.appendChild(script);
  }, []);

  // Restore mermaid from localStorage after mount (always)
  useEffect(() => {
    if (!mounted) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setMermaid(parsed.mermaid || '');
        setSvg(parsed.svg || '');
        if (parsed.mermaid) setStatus('success');
      }
    } catch {}
  }, [mounted]);

  const renderSvg = useCallback(async (mermaidCode: string) => {
    const m = (window as Window & { mermaid?: { render(id: string, code: string): Promise<{ svg: string }> } }).mermaid;
    if (!m) {
      setErrorMsg(t('diagram_mermaid_loading'));
      return false;
    }
    try {
      const id = 'mermaid-' + Date.now();
      const { svg: renderedSvg } = await m.render(id, mermaidCode);
      setSvg(renderedSvg);
      setErrorMsg('');
      return true;
    } catch (err: unknown) {
      const msg = (err as Error)?.message || String(err);
      const descMatch = msg.match(/(No diagram type.*)$/m) || msg.match(/( parser error.*)$/m);
      const desc = descMatch ? descMatch[1] : t('diagram_syntax_error');
      setErrorMsg('Mermaid: ' + desc);
      setSvg('');
      return false;
    }
  }, [t]);

  // Re-render SVG when both mermaid and script are ready
  useEffect(() => {
    if (!mermaid || !mounted) return;
    if (status !== 'success') return;
    // Wait for mermaid script if not yet loaded
    if (!mermaidScriptLoaded) {
      const check = setInterval(() => {
        if (mermaidScriptLoaded) {
          clearInterval(check);
          const bare = mermaid.replace(/^```mermaid\s*([\s\S]*?)```\s*$/i, '$1').trim();
          renderSvg(bare);
        }
      }, 100);
      return () => clearInterval(check);
    }
    const bare = mermaid.replace(/^```mermaid\s*([\s\S]*?)```\s*$/i, '$1').trim();
    renderSvg(bare);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mermaid, mounted, status]);

  const handleGenerate = useCallback(async () => {
    if (!skillMdContent?.trim()) {
      setErrorMsg(t('diagram_input_required'));
      return;
    }
    setStatus('loading');
    setErrorMsg('');
    setSvg('');
    onLoadingChange?.(true);

    try {
      const res = await fetch('/api/skills/diagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillMdContent }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t('failed'));
      }
      const generated = data.mermaid || '';
      setMermaid(generated);
      setStatus('success');
      onGenerated?.(generated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mermaid: generated, svg: '' }));
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || t('failed'));
      setStatus('error');
    } finally {
      onLoadingChange?.(false);
    }
  }, [skillMdContent, onGenerated, onLoadingChange, t]);

  // Listen for external generate-diagram event (triggered from label row button)
  useEffect(() => {
    const handler = () => handleGenerate();
    window.addEventListener('generate-diagram', handler);
    return () => window.removeEventListener('generate-diagram', handler);
  }, [handleGenerate]);

  const handleSaveEdit = useCallback(async () => {
    const bare = editedCode.replace(/^```mermaid\s*([\s\S]*?)```\s*$/i, '$1').trim();
    const ok = await renderSvg(bare);
    if (ok) {
      const fenced = '```mermaid\n' + bare + '\n```';
      setMermaid(fenced);
      onGenerated?.(fenced);
      setEditMode(false);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mermaid: fenced, svg: '' }));
    }
  }, [editedCode, renderSvg, onGenerated]);

  return (
    <div className="space-y-3">
      {/* Generate button — hidden in compact mode (button lives in label row) */}
      {!compact && (
        <button
          onClick={handleGenerate}
          disabled={status === 'loading'}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {status === 'loading' ? t('diagram_loading') : t('diagram_generate')}
        </button>
      )}

      {/* Compact mode: empty-state hint */}
      {compact && !svg && !errorMsg && (
        <p className="text-xs text-[#a89888] font-body italic">
          {t('diagram_preview_label')} — {t('diagram_input_required')}
        </p>
      )}

      {/* Error */}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{errorMsg}</p>
          {mermaid && (
            <details className="mt-2">
              <summary className="text-xs text-red-500 cursor-pointer">{t('view_source')}</summary>
              <pre className="mt-1 p-2 bg-red-100 rounded text-xs overflow-x-auto">{mermaid}</pre>
            </details>
          )}
        </div>
      )}

      {/* SVG preview */}
      {svg && (
        <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
      )}

      {/* Source code — editable */}
      {mermaid && (
        <div className="text-xs">
          {!editMode ? (
            <div className="flex items-center justify-between">
              <button
                className="text-gray-500 hover:text-gray-700 transition-colors font-body"
                onClick={() => {
                  setEditedCode(mermaid);
                  setEditMode(true);
                }}
              >
                {t('view_source')}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono-custom text-gray-700 resize-y min-h-[120px] focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                value={editedCode}
                onChange={(e) => setEditedCode(e.target.value)}
                rows={Math.max(6, editedCode.split('\n').length + 1)}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {t('save')}
                </button>
                <button
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors"
                  onClick={() => setEditMode(false)}
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
