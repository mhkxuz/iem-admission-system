export interface User {
  _id: string;
  fullName: string;
  email: string;
  role: 'applicant' | 'admin' | 'reviewer';
  phone?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: any;
}
