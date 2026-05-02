"use client";
import { type InputHTMLAttributes } from "react";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label?: string;
  error?: string;
  id?: string;
  bg?: string;
  p?: string;
}

export function Input({ label, error, className = "", id: providedId, bg, p = "px-8 py-3.5", ...props }: InputProps) {
  const inputId = providedId ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-semibold text-[#1f2b45]">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`
          w-full ${p} input-radius border text-[#1f2b45]
          ${bg ?? "bg-white"} placeholder-[#6d7891]
          focus:outline-none focus:ring-2 focus:ring-[#2d67f7]/30 focus:border-[#2d67f7]
          transition-colors disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? "border-red-400 focus:ring-red-300" : "border-[#c8d7f7]"}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  bg?: string;
}

export function Textarea({ label, error, className = "", id, bg, ...props }: TextareaProps) {
  const textareaId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-semibold text-[#1f2b45]">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`
          w-full px-8 py-3.5 rounded-[24px] border text-[#1f2b45]
          ${bg ?? "bg-white"} placeholder-[#6d7891]
          focus:outline-none focus:ring-2 focus:ring-[#2d67f7]/30 focus:border-[#2d67f7]
          transition-colors resize-none
          ${error ? "border-red-400 focus:ring-red-300" : "border-[#c8d7f7]"}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
