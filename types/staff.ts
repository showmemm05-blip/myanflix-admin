export type StaffRole = "SUPER_ADMIN" | "ADMIN" | "CONTENT_UPLOADER";
export type StaffStatus = "ACTIVE" | "SUSPENDED";

export interface StaffMember {
  id: string;
  username: string;
  role: StaffRole;
  status: StaffStatus;
  lastLoginAt: string | null;
  createdAt: string;
}
