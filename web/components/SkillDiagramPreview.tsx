'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/context';

interface SkillDiagramPreviewProps {
  initialMermaid?: string;
  className?: string;
  framed?: boolean;
}

const MERMAID_SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
let mermaidInitialized = false;
let mermaidScriptLoaded = false;

export function normalizeMermaidCode(code: string): string {
  return code.replace(/^```mermaid\s*([\s\S]*?)```\s*$/i, '$1').trim();
}

export async function validateMermaidCode(
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const mermaid = (window as Window & {
    mermaid?: {
      parse(code: string): Promise<unknown> | unknown;
    };
  }).mermaid;

  if (!mermaid) {
    return { ok: false, error: 'diagram_mermaid_loading' };
  }

  try {
    await mermaid.parse(code);
    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error: (err as Error)?.message || String(err) || 'diagram_syntax_error',
    };
  }
}

export default function SkillDiagramPreview({
  initialMermaid,
  className = '',
  framed = true,
}: SkillDiagramPreviewProps) {
  const t = useT('submit');
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [svg, setSvg] = useState('');

  const mermaidCode = normalizeMermaidCode(initialMermaid ?? '');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mermaidInitialized) return;
    mermaidInitialized = true;
    const script = document.createElement('script');
    script.src = MERMAID_SCRIPT_SRC;
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

  const renderSvg = useCallback(async (code: string) => {
    const mermaid = (window as Window & { mermaid?: { render(id: string, code: string): Promise<{ svg: string }> } }).mermaid;
    if (!mermaid) {
      setStatus('error');
      setErrorMsg(t('diagram_mermaid_loading'));
      setSvg('');
      return false;
    }

    try {
      const id = `mermaid-${Date.now()}`;
      const { svg: renderedSvg } = await mermaid.render(id, code);
      if (/Syntax error in text|mermaid version/i.test(renderedSvg)) {
        setStatus('error');
        setErrorMsg(t('diagram_syntax_error'));
        setSvg('');
        return false;
      }
      setSvg(renderedSvg);
      setErrorMsg('');
      setStatus('success');
      return true;
    } catch (err: unknown) {
      const msg = (err as Error)?.message || String(err);
      const descMatch = msg.match(/(No diagram type.*)$/m) || msg.match(/( parser error.*)$/m);
      const desc = descMatch ? descMatch[1] : t('diagram_syntax_error');
      setErrorMsg(`Mermaid: ${desc}`);
      setSvg('');
      setStatus('error');
      return false;
    }
  }, [t]);

  useEffect(() => {
    if (!mounted) return;
    if (!mermaidCode) {
      setStatus('idle');
      setSvg('');
      setErrorMsg('');
      return;
    }

    setStatus('loading');
    setErrorMsg('');
    setSvg('');

    if (mermaidScriptLoaded) {
      void (async () => {
        const validation = await validateMermaidCode(mermaidCode);
        if (!validation.ok) {
          setStatus('error');
          setErrorMsg(
            validation.error === 'diagram_mermaid_loading'
              ? t('diagram_mermaid_loading')
              : t('diagram_syntax_error'),
          );
          setSvg('');
          return;
        }
        await renderSvg(mermaidCode);
      })();
      return;
    }

    const timer = setInterval(() => {
      if (!mermaidScriptLoaded) return;
      clearInterval(timer);
      void (async () => {
        const validation = await validateMermaidCode(mermaidCode);
        if (!validation.ok) {
          setStatus('error');
          setErrorMsg(
            validation.error === 'diagram_mermaid_loading'
              ? t('diagram_mermaid_loading')
              : t('diagram_syntax_error'),
          );
          setSvg('');
          return;
        }
        await renderSvg(mermaidCode);
      })();
    }, 100);

    return () => clearInterval(timer);
  }, [mermaidCode, mounted]);

  if (!mermaidCode && status === 'idle') {
    return null;
  }

  return (
    <div className={className}>
      {status === 'loading' && !svg && !errorMsg && (
        <div className="flex items-center gap-3 rounded-lg border border-[#dbeafe] bg-[#eff6ff] px-4 py-3">
          <svg className="h-5 w-5 animate-spin text-[#1d4ed8]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-[#1e3a8a]">{t('diagram_mermaid_loading')}</span>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{errorMsg}</p>
          {mermaidCode && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-red-500">{t('view_source')}</summary>
              <pre className="mt-1 overflow-x-auto rounded bg-red-100 p-2 text-xs">{mermaidCode}</pre>
            </details>
          )}
        </div>
      )}

      {svg && (
        <div
          className={`overflow-x-auto bg-white ${
            framed ? "rounded-xl border border-gray-200 p-4 shadow-sm" : "p-0"
          }`}
        >
          <div className="[&_svg]:block [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
      )}
    </div>
  );
}
