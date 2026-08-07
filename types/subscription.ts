export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPlanFormValues {
  name: string;
  price: number;
  isActive?: boolean;
}
