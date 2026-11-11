import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User, ApiResponse } from '../models/user.model';
import {
  AdmissionApplication,
  ApplicationStatus,
  StatusHistoryEntry
} from '../models/application.model';
import { Programme } from '../models/programme.model';
import { AcademicSession } from '../models/session.model';
import { FeeStructure } from '../models/fee.model';

export interface AdminDashboardMetrics {
  totalApplications: number;
  submitted: number;
  underReview: number;
  selected: number;
  rejected: number;
}

export interface StatusDistributionEntry {
  status: ApplicationStatus;
  count: number;
}

export interface DepartmentDistributionEntry {
  department: string;
  count: number;
}

export interface CategoryDistributionEntry {
  category: string;
  count: number;
}

export interface AcademicOverview {
  totalProgrammes: number;
  activeProgrammes: number;
  programmesAcceptingApplications: number;
  totalSessions: number;
  activeSession: string;
  activeSessionDetails?: any;
  configuredFeeStructures: number;
  programmesMissingFee: number;
}

export interface AdminDashboardData {
  metrics: AdminDashboardMetrics;
  statusDistribution: StatusDistributionEntry[];
  departmentDistribution: DepartmentDistributionEntry[];
  categoryDistribution: CategoryDistributionEntry[];
  recentApplications: AdmissionApplication[];
  academicOverview?: AcademicOverview;
}

export interface PaginationMeta {
  totalRecords: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface StatusUpdatePayload {
  status: ApplicationStatus;
  remarks?: string;
}

export interface StatusUpdateResult {
  application: AdmissionApplication;
  history: StatusHistoryEntry;
  previousStatus: ApplicationStatus;
  newStatus: ApplicationStatus;
  allowedNextStatuses: ApplicationStatus[];
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private http = inject(HttpClient);
  private readonly API_URL = 'https://iem-admission-system-v2pf.onrender.com/api/admin';

  /**
   * Fetch admin dashboard metrics and recent submissions
   */
  getDashboard(): Observable<ApiResponse<AdminDashboardData>> {
    return this.http.get<ApiResponse<AdminDashboardData>>(`${this.API_URL}/dashboard`);
  }

  /**
   * Fetch paginated applications with search, filter, and sort
   */
  getApplications(params: {
    search?: string;
    department?: string;
    category?: string;
    status?: string;
    session?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): Observable<ApiResponse<AdmissionApplication[]>> {
    let httpParams = new HttpParams();

    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.department) httpParams = httpParams.set('department', params.department);
    if (params.category) httpParams = httpParams.set('category', params.category);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.session) httpParams = httpParams.set('session', params.session);
    if (params.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);
    if (params.sortOrder) httpParams = httpParams.set('sortOrder', params.sortOrder);
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());

    return this.http.get<ApiResponse<AdmissionApplication[]>>(`${this.API_URL}/applications`, {
      params: httpParams
    });
  }

  /**
   * Fetch full application inspection details including documents & status history
   */
  getApplicationById(id: string): Observable<ApiResponse<AdmissionApplication>> {
    return this.http.get<ApiResponse<AdmissionApplication>>(`${this.API_URL}/applications/${id}`);
  }

  /**
   * Apply an administrator status transition. The backend validates the
   * workflow and derives the administrator identity from the JWT.
   */
  updateApplicationStatus(
    id: string,
    payload: StatusUpdatePayload
  ): Observable<ApiResponse<StatusUpdateResult>> {
    return this.http.patch<ApiResponse<StatusUpdateResult>>(
      `${this.API_URL}/applications/${id}/status`,
      payload
    );
  }

  // ==========================================
  // Academic Programmes Management APIs
  // ==========================================

  getProgrammes(params?: {
    search?: string;
    department?: string;
    degreeLevel?: string;
    isActive?: boolean | string;
    session?: string;
    page?: number;
    limit?: number;
  }): Observable<ApiResponse<{ programmes: Programme[]; total: number; page: number; limit: number; totalPages: number }>> {
    let httpParams = new HttpParams();
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.department) httpParams = httpParams.set('department', params.department);
    if (params?.degreeLevel) httpParams = httpParams.set('degreeLevel', params.degreeLevel);
    if (params?.isActive !== undefined && params?.isActive !== '') {
      httpParams = httpParams.set('isActive', params.isActive.toString());
    }
    if (params?.session) httpParams = httpParams.set('session', params.session);
    if (params?.page) httpParams = httpParams.set('page', params.page.toString());
    if (params?.limit) httpParams = httpParams.set('limit', params.limit.toString());

    return this.http.get<ApiResponse<{ programmes: Programme[]; total: number; page: number; limit: number; totalPages: number }>>(
      `${this.API_URL}/programmes`,
      { params: httpParams }
    );
  }

  getProgrammeById(id: string): Observable<ApiResponse<Programme>> {
    return this.http.get<ApiResponse<Programme>>(`${this.API_URL}/programmes/${id}`);
  }

  createProgramme(data: Partial<Programme>): Observable<ApiResponse<Programme>> {
    return this.http.post<ApiResponse<Programme>>(`${this.API_URL}/programmes`, data);
  }

  updateProgramme(id: string, data: Partial<Programme>): Observable<ApiResponse<Programme>> {
    return this.http.patch<ApiResponse<Programme>>(`${this.API_URL}/programmes/${id}`, data);
  }

  activateProgramme(id: string): Observable<ApiResponse<Programme>> {
    return this.http.patch<ApiResponse<Programme>>(`${this.API_URL}/programmes/${id}/activate`, {});
  }

  deactivateProgramme(id: string): Observable<ApiResponse<Programme>> {
    return this.http.patch<ApiResponse<Programme>>(`${this.API_URL}/programmes/${id}/deactivate`, {});
  }

  deleteProgramme(id: string): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.API_URL}/programmes/${id}`);
  }

  // ==========================================
  // Admission Sessions Management APIs
  // ==========================================

  getSessions(params?: { status?: string; isActive?: boolean }): Observable<ApiResponse<AcademicSession[]>> {
    let httpParams = new HttpParams();
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.isActive !== undefined) httpParams = httpParams.set('isActive', params.isActive.toString());

    return this.http.get<ApiResponse<AcademicSession[]>>(`${this.API_URL}/sessions`, {
      params: httpParams
    });
  }

  getSessionById(id: string): Observable<ApiResponse<AcademicSession>> {
    return this.http.get<ApiResponse<AcademicSession>>(`${this.API_URL}/sessions/${id}`);
  }

  createSession(data: Partial<AcademicSession>): Observable<ApiResponse<AcademicSession>> {
    return this.http.post<ApiResponse<AcademicSession>>(`${this.API_URL}/sessions`, data);
  }

  updateSession(id: string, data: Partial<AcademicSession>): Observable<ApiResponse<AcademicSession>> {
    return this.http.patch<ApiResponse<AcademicSession>>(`${this.API_URL}/sessions/${id}`, data);
  }

  activateSession(id: string): Observable<ApiResponse<AcademicSession>> {
    return this.http.patch<ApiResponse<AcademicSession>>(`${this.API_URL}/sessions/${id}/activate`, {});
  }

  closeSession(id: string): Observable<ApiResponse<AcademicSession>> {
    return this.http.patch<ApiResponse<AcademicSession>>(`${this.API_URL}/sessions/${id}/close`, {});
  }

  deleteSession(id: string): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.API_URL}/sessions/${id}`);
  }

  // ==========================================
  // Fee Structure Management APIs
  // ==========================================

  getFeeStructures(params?: { programme?: string; session?: string; isActive?: boolean }): Observable<ApiResponse<FeeStructure[]>> {
    let httpParams = new HttpParams();
    if (params?.programme) httpParams = httpParams.set('programme', params.programme);
    if (params?.session) httpParams = httpParams.set('session', params.session);
    if (params?.isActive !== undefined) httpParams = httpParams.set('isActive', params.isActive.toString());

    return this.http.get<ApiResponse<FeeStructure[]>>(`${this.API_URL}/fees`, {
      params: httpParams
    });
  }

  getFeeStructureById(id: string): Observable<ApiResponse<FeeStructure>> {
    return this.http.get<ApiResponse<FeeStructure>>(`${this.API_URL}/fees/${id}`);
  }

  createFeeStructure(data: any): Observable<ApiResponse<FeeStructure>> {
    return this.http.post<ApiResponse<FeeStructure>>(`${this.API_URL}/fees`, data);
  }

  updateFeeStructure(id: string, data: any): Observable<ApiResponse<FeeStructure>> {
    return this.http.patch<ApiResponse<FeeStructure>>(`${this.API_URL}/fees/${id}`, data);
  }

  activateFeeStructure(id: string): Observable<ApiResponse<FeeStructure>> {
    return this.http.patch<ApiResponse<FeeStructure>>(`${this.API_URL}/fees/${id}/activate`, {});
  }

  deactivateFeeStructure(id: string): Observable<ApiResponse<FeeStructure>> {
    return this.http.patch<ApiResponse<FeeStructure>>(`${this.API_URL}/fees/${id}/deactivate`, {});
  }

  deleteFeeStructure(id: string): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.API_URL}/fees/${id}`);
  }

  // User & Reviewer Role Management
  getUsers(params?: {
    role?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Observable<ApiResponse<User[]>> {
    let httpParams = new HttpParams();
    if (params?.role) httpParams = httpParams.set('role', params.role);
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.page) httpParams = httpParams.set('page', params.page.toString());
    if (params?.limit) httpParams = httpParams.set('limit', params.limit.toString());

    return this.http.get<ApiResponse<User[]>>(`${this.API_URL}/users`, {
      params: httpParams
    });
  }

  updateUserRole(
    userId: string,
    role: 'applicant' | 'reviewer' | 'admin'
  ): Observable<ApiResponse<User>> {
    return this.http.patch<ApiResponse<User>>(`${this.API_URL}/users/${userId}/role`, { role });
  }

  createReviewer(payload: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
  }): Observable<ApiResponse<User>> {
    return this.http.post<ApiResponse<User>>(`${this.API_URL}/users/reviewer`, payload);
  }
}
