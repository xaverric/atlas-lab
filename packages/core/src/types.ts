import type { UserRole } from './constants.js';

export interface User {
  id: string;
  keycloakId: string;
  email: string;
  name: string;
  role: UserRole;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
}

export interface ApiResponse<T = unknown> {
  data: T;
}

export interface ApiErrorResponse {
  error: string;
  details?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
