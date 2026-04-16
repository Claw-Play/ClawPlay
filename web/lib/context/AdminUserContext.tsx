"use client";
import { createContext, useContext } from "react";

export const AdminUserContext = createContext<{
  currentUserId: number | null;
}>({ currentUserId: null });

export function useAdminUser() {
  return useContext(AdminUserContext);
}
