import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { ApiResponse } from '../models/user.model';
import { ActiveSession } from '../models/session.model';
import { Programme } from '../models/programme.model';
import { FeeStructure } from '../models/fee.model';

@Injectable({
  providedIn: 'root'
})
export class PublicAdmissionService {
  private http = inject(HttpClient);

  private readonly API_BASE = 'http://localhost:5000/api';

  /**
   * Fetch the currently active admission session and application availability window.
   */
  getActiveSession(): Observable<ApiResponse<ActiveSession | null>> {
    return this.http.get<ApiResponse<ActiveSession | null>>(`${this.API_BASE}/sessions/active`);
  }

  /**
   * Fetch list of active academic programmes with optional filters.
   */
  getProgrammes(filters?: {
    department?: string;
    degreeLevel?: string;
    session?: string;
  }): Observable<ApiResponse<Programme[]>> {
    let params = new HttpParams();
    if (filters?.department) {
      params = params.set('department', filters.department);
    }
    if (filters?.degreeLevel) {
      params = params.set('degreeLevel', filters.degreeLevel);
    }
    if (filters?.session) {
      params = params.set('session', filters.session);
    }

    return this.http.get<ApiResponse<Programme[]>>(`${this.API_BASE}/programmes`, { params });
  }

  /**
   * Retrieve active programme details by ID.
   */
  getProgrammeById(id: string): Observable<ApiResponse<Programme>> {
    return this.http.get<ApiResponse<Programme>>(`${this.API_BASE}/programmes/${id}`);
  }

  /**
   * Retrieve active programme details by unique code.
   */
  getProgrammeByCode(code: string): Observable<ApiResponse<Programme>> {
    return this.http.get<ApiResponse<Programme>>(`${this.API_BASE}/programmes/code/${code}`);
  }

  /**
   * Retrieve active fee structure for a programme.
   */
  getProgrammeFee(programmeId: string, session?: string): Observable<ApiResponse<FeeStructure>> {
    let params = new HttpParams();
    if (session) {
      params = params.set('session', session);
    }

    return this.http.get<ApiResponse<FeeStructure>>(
      `${this.API_BASE}/fees/programme/${programmeId}`,
      { params }
    );
  }

  /**
   * Public announcements. If not yet backed by a dedicated model, returns an empty list gracefully.
   */
  getAnnouncements(): Observable<ApiResponse<any[]>> {
    return of({
      success: true,
      message: 'No official announcements posted at this time.',
      data: []
    });
  }
}
