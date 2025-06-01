export interface User {
  userId: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  groups?: string[];
}

export interface FoodEntry {
  entryId: string;
  userId: string;
  date: string; // YYYY-MM-DD format
  name: string;
  protein: number; // in grams
  carbs: number; // in grams
  fats: number; // in grams
  calories: number;
  createdAt: string;
  updatedAt: string;
}

export enum UserGroup {
  REGULAR_USERS = 'regular-users',
  ADMIN_USERS = 'admin-users'
}

export interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
