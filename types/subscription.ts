export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  /** Length of one purchase in days; renewals stack this onto the current expiry. */
  durationDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPlanFormValues {
  name: string;
  price: number;
  durationDays: number;
  isActive?: boolean;
}
