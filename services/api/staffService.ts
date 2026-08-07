import { apiClient } from "./apiClient";
import type { StaffMember, StaffRole, StaffStatus } from "@/types/staff";

export const staffService = {
  async getStaff(): Promise<StaffMember[]> {
    const res = await apiClient.get<{ items: StaffMember[] }>("/staff");
    return res.items;
  },

  createStaff(username: string, password: string, role: StaffRole): Promise<StaffMember> {
    return apiClient.post<StaffMember>("/staff", { username, password, role });
  },

  updateStaff(id: string, updates: { username?: string; role?: StaffRole }): Promise<StaffMember> {
    return apiClient.patch<StaffMember>(`/staff/${id}`, updates);
  },

  resetPassword(id: string, newPassword: string): Promise<{ reset: boolean }> {
    return apiClient.patch<{ reset: boolean }>(`/staff/${id}/password`, { newPassword });
  },

  updateStatus(id: string, status: StaffStatus): Promise<StaffMember> {
    return apiClient.patch<StaffMember>(`/staff/${id}/status`, { status });
  },

  deleteStaff(id: string): Promise<{ deleted: boolean }> {
    return apiClient.delete<{ deleted: boolean }>(`/staff/${id}`);
  },
};
