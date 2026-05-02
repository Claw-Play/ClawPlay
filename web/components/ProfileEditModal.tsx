"use client";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n/context";
import { CloseIcon } from "@/components/icons";

const MAX_AVATAR_SIZE = 500 * 1024; // 500KB

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
  initialName: string;
  initialAvatarUrl: string | null;
  onSave: (data: {
    name: string;
    avatarUrl: string | null;
    avatarInitials: string;
  }) => Promise<void>;
}

export function ProfileEditModal({
  isOpen,
  onClose,
  userId,
  initialName,
  initialAvatarUrl,
  onSave,
}: ProfileEditModalProps) {
  const t = useT("dashboard");
  const tCommon = useT("common");
  const [name, setName] = useState(initialName);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayUrl = previewUrl ?? avatarUrl;
  const isCustom = !!previewUrl;
  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setAvatarUrl(initialAvatarUrl);
      setPreviewUrl(null);
      setError(null);
      setSaving(false);
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialName, initialAvatarUrl]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open, compensate scrollbar width to avoid layout shift
  useEffect(() => {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [isOpen]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError(t("invalid_file"));
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      setError(t("file_too_large"));
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setPreviewUrl(result);
      setAvatarUrl(result);
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveAvatar() {
    setPreviewUrl(null);
    setAvatarUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 32) {
      setError(t("save_error"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: trimmed, avatarUrl: isCustom ? avatarUrl : null, avatarInitials: "" });
      onClose();
    } catch {
      setError(t("save_error"));
    } finally {
      setSaving(false);
    }
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-edit-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#1a1a2e]/40 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative w-full max-w-md bg-[#f8faff] rounded-[32px] shadow-[0px_8px_40px_rgba(25,43,87,0.18)] border border-[rgba(219,229,247,0.2)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-4">
          <h2
            id="profile-edit-title"
            className="text-2xl font-extrabold font-heading text-[#1a1a2e]"
          >
            {t("edit_profile")}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#edf4ff] flex items-center justify-center text-[#1f2b45] hover:bg-[#dbe5f7] transition-colors"
            aria-label={t("close")}
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Avatar Preview */}
        <div className="flex flex-col items-center px-8 pb-4">
          <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center mb-2 select-none">
            {displayUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayUrl}
                alt="Avatar preview"
                className="w-full h-full object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${userId}&backgroundColor=ff6b35,fa7025,a23f00`}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <p className="text-xs text-[#a89070] font-body text-center">{t("avatar_hint")}</p>
        </div>

        {/* Form */}
        <div className="px-8 pb-2 space-y-5">
          {/* Name field */}
          <div>
            <label
              htmlFor="profile-name"
              className="block text-sm font-semibold text-[#1f2b45] mb-2 font-body"
            >
              {t("user_name")}
            </label>
            <input
              ref={inputRef}
              id="profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              maxLength={32}
              className="w-full bg-white border border-[#c8d7f7] rounded-full px-6 py-3 text-[#1f2b45] font-body placeholder-[#6d7891] focus:outline-none focus:ring-2 focus:ring-[#2d67f7]/30 focus:border-[#2d67f7] transition-colors"
              placeholder={t("user_name")}
            />
          </div>

          {/* Avatar upload */}
          <div>
            <p className="block text-sm font-semibold text-[#1f2b45] mb-3 font-body">
              {t("upload_avatar")}
            </p>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                className="hidden"
                id="avatar-upload"
              />
              <label
                htmlFor="avatar-upload"
                className="flex-1 py-2.5 rounded-full border-2 border-[#c8d7f7] text-[#1f2b45] font-semibold font-body text-center cursor-pointer hover:bg-[#edf4ff] transition-colors"
              >
                {t("upload_avatar")}
              </label>
              {displayUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="px-4 py-2.5 rounded-full border-2 border-red-200 text-red-500 font-semibold font-body hover:bg-red-50 transition-colors text-sm"
                >
                  {t("remove_avatar")}
                </button>
              )}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-600 font-body">{error}</p>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex gap-3 px-8 pb-8 pt-4">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3 rounded-full border-2 border-[#c8d7f7] text-[#1f2b45] font-semibold font-body hover:bg-[#edf4ff] transition-colors disabled:opacity-50"
          >
            {tCommon("cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || name.trim().length < 2}
            className="flex-1 py-3 rounded-full bg-gradient-to-r from-[#2d67f7] to-[#4f82f7] text-white font-semibold font-heading shadow-[0_4px_12px_rgba(45,103,247,0.25)] hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t("saving")}
              </>
            ) : (
              t("save")
            )}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  return null;
}
