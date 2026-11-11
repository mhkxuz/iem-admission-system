import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/user.model';
import {
  OverviewAnalytics,
  ApplicationAnalytics,
  DocumentAnalytics,
  MeritAnalytics,
  PaymentAnalytics,
  ReportFilterParams,
  ExportReportType,
  ExportFormat
} from '../models/report.model';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private http = inject(HttpClient);
  private readonly API_URL = 'https://iem-admission-system-y2pf.onrender.com/api/admin/reports';

  private buildParams(filters?: ReportFilterParams): HttpParams {
    let params = new HttpParams();
    if (!filters) return params;

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, value);
      }
    });

    return params;
  }

  /**
   * Get overview KPI summary and monthly trends
   */
  getOverview(filters?: ReportFilterParams): Observable<ApiResponse<OverviewAnalytics>> {
    const params = this.buildParams(filters);
    return this.http.get<ApiResponse<OverviewAnalytics>>(`${this.API_URL}/overview`, { params });
  }

  /**
   * Get multi-dimensional application analytics & trends
   */
  getApplicationAnalytics(filters?: ReportFilterParams): Observable<ApiResponse<ApplicationAnalytics>> {
    const params = this.buildParams(filters);
    return this.http.get<ApiResponse<ApplicationAnalytics>>(`${this.API_URL}/applications`, { params });
  }

  /**
   * Get document verification workflow analytics and reviewer workloads
   */
  getDocumentAnalytics(filters?: ReportFilterParams): Observable<ApiResponse<DocumentAnalytics>> {
    const params = this.buildParams(filters);
    return this.http.get<ApiResponse<DocumentAnalytics>>(`${this.API_URL}/documents`, { params });
  }

  /**
   * Get merit list cutoffs, allocations and seat utilization
   */
  getMeritAnalytics(filters?: ReportFilterParams): Observable<ApiResponse<MeritAnalytics>> {
    const params = this.buildParams(filters);
    return this.http.get<ApiResponse<MeritAnalytics>>(`${this.API_URL}/merit`, { params });
  }

  /**
   * Get payment reconciliation, verified revenue, and enrolment metrics
   */
  getPaymentAnalytics(filters?: ReportFilterParams): Observable<ApiResponse<PaymentAnalytics>> {
    const params = this.buildParams(filters);
    return this.http.get<ApiResponse<PaymentAnalytics>>(`${this.API_URL}/payments`, { params });
  }

  /**
   * Export report data as CSV or PDF binary stream
   */
  exportReport(type: ExportReportType, format: ExportFormat, filters?: ReportFilterParams): Observable<Blob> {
    let params = this.buildParams(filters);
    params = params.set('format', format);

    return this.http.get(`${this.API_URL}/export/${type}`, {
      params,
      responseType: 'blob'
    });
  }

  /**
   * Browser file download helper
   */
  triggerDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}
