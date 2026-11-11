import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/user.model';
import {
  MeritConfiguration,
  MeritList,
  SeatAllocation,
  ApplicantMeritResult,
  ApplicantPublishedMeritListResponse
} from '../models/merit.model';

@Injectable({
  providedIn: 'root'
})
export class MeritService {
  private http = inject(HttpClient);
  private readonly API_URL = 'https://iem-admission-system-y2pf.onrender.com/api/merit';

  /**
   * Save or update programme-specific merit scoring configuration
   */
  saveConfiguration(
    config: Partial<MeritConfiguration> & { programmeId: string; academicSession: string }
  ): Observable<ApiResponse<MeritConfiguration>> {
    return this.http.post<ApiResponse<MeritConfiguration>>(`${this.API_URL}/configuration`, config);
  }

  /**
   * Get active merit scoring configuration for programme and session
   */
  getConfiguration(programmeId: string, academicSession: string): Observable<ApiResponse<MeritConfiguration>> {
    const params = new HttpParams()
      .set('programmeId', programmeId)
      .set('academicSession', academicSession);
    return this.http.get<ApiResponse<MeritConfiguration>>(`${this.API_URL}/configuration`, { params });
  }

  /**
   * Generate draft merit list for a programme and session
   */
  generateMeritList(programmeId: string, academicSession: string): Observable<ApiResponse<MeritList>> {
    return this.http.post<ApiResponse<MeritList>>(`${this.API_URL}/generate`, { programmeId, academicSession });
  }

  /**
   * List merit lists with optional filters
   */
  getMeritLists(programmeId?: string, academicSession?: string, status?: string): Observable<ApiResponse<MeritList[]>> {
    let params = new HttpParams();
    if (programmeId) params = params.set('programmeId', programmeId);
    if (academicSession) params = params.set('academicSession', academicSession);
    if (status) params = params.set('status', status);
    return this.http.get<ApiResponse<MeritList[]>>(`${this.API_URL}/lists`, { params });
  }

  /**
   * Retrieve merit list by ID
   */
  getMeritListById(id: string): Observable<ApiResponse<MeritList>> {
    return this.http.get<ApiResponse<MeritList>>(`${this.API_URL}/lists/${id}`);
  }

  /**
   * Publish a merit list
   */
  publishMeritList(id: string): Observable<ApiResponse<MeritList>> {
    return this.http.post<ApiResponse<MeritList>>(`${this.API_URL}/lists/${id}/publish`, {});
  }

  /**
   * Generate draft category-wise seat allocation
   */
  generateSeatAllocation(payload: {
    programmeId: string;
    academicSession: string;
    meritListId?: string;
    unfilledSeatRule?: 'Keep Vacant' | 'Convert to General';
  }): Observable<ApiResponse<SeatAllocation>> {
    return this.http.post<ApiResponse<SeatAllocation>>(`${this.API_URL}/allocation/generate`, payload);
  }

  /**
   * List seat allocations with optional filters
   */
  getSeatAllocations(
    programmeId?: string,
    academicSession?: string,
    status?: string
  ): Observable<ApiResponse<SeatAllocation[]>> {
    let params = new HttpParams();
    if (programmeId) params = params.set('programmeId', programmeId);
    if (academicSession) params = params.set('academicSession', academicSession);
    if (status) params = params.set('status', status);
    return this.http.get<ApiResponse<SeatAllocation[]>>(`${this.API_URL}/allocation`, { params });
  }

  /**
   * Retrieve seat allocation by ID
   */
  getSeatAllocationById(id: string): Observable<ApiResponse<SeatAllocation>> {
    return this.http.get<ApiResponse<SeatAllocation>>(`${this.API_URL}/allocation/${id}`);
  }

  /**
   * Approve draft seat allocation
   */
  approveSeatAllocation(id: string, remarks?: string): Observable<ApiResponse<SeatAllocation>> {
    return this.http.post<ApiResponse<SeatAllocation>>(`${this.API_URL}/allocation/${id}/approve`, { remarks });
  }

  /**
   * Publish approved seat allocation
   */
  publishSeatAllocation(id: string, remarks?: string): Observable<ApiResponse<SeatAllocation>> {
    return this.http.post<ApiResponse<SeatAllocation>>(`${this.API_URL}/allocation/${id}/publish`, { remarks });
  }

  /**
   * Applicant: Retrieve caller's personal published merit rank & seat allocation outcome
   */
  getMyResult(): Observable<ApiResponse<ApplicantMeritResult>> {
    return this.http.get<ApiResponse<ApplicantMeritResult>>(`${this.API_URL}/my-result`);
  }

  /**
   * Applicant: Retrieve full officially published merit list for programme & session
   */
  getPublishedMeritList(): Observable<ApiResponse<ApplicantPublishedMeritListResponse>> {
    return this.http.get<ApiResponse<ApplicantPublishedMeritListResponse>>(`${this.API_URL}/published-list`);
  }
}
