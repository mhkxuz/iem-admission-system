import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/user.model';
import { UploadedDocument, DocumentVerificationHistory } from '../models/document.model';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private http = inject(HttpClient);
  private readonly API_URL = 'https://iem-admission-system-v2pf.onrender.com/api/documents';

  /**
   * Upload document with multipart/form-data
   */
  uploadDocument(
    applicationId: string,
    documentType: string,
    file: File
  ): Observable<ApiResponse<UploadedDocument>> {
    const formData = new FormData();
    formData.append('applicationId', applicationId);
    formData.append('documentType', documentType);
    formData.append('document', file);

    return this.http.post<ApiResponse<UploadedDocument>>(`${this.API_URL}/upload`, formData);
  }

  /**
   * Get all documents for an application
   */
  getDocumentsByApplication(applicationId: string): Observable<ApiResponse<UploadedDocument[]>> {
    return this.http.get<ApiResponse<UploadedDocument[]>>(`${this.API_URL}/application/${applicationId}`);
  }

  /**
   * Fetch reviewer inspection queue with filters and search
   */
  getReviewQueue(params?: {
    status?: string;
    search?: string;
    documentType?: string;
    page?: number;
    limit?: number;
  }): Observable<ApiResponse<UploadedDocument[]>> {
    let httpParams = new HttpParams();
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.documentType) httpParams = httpParams.set('documentType', params.documentType);
    if (params?.page) httpParams = httpParams.set('page', params.page.toString());
    if (params?.limit) httpParams = httpParams.set('limit', params.limit.toString());

    return this.http.get<ApiResponse<UploadedDocument[]>>(`${this.API_URL}/queue`, {
      params: httpParams
    });
  }

  /**
   * Verify or reject an uploaded document
   */
  verifyDocument(
    documentId: string,
    status: 'Verified' | 'Rejected',
    remarks?: string
  ): Observable<ApiResponse<UploadedDocument>> {
    return this.http.patch<ApiResponse<UploadedDocument>>(`${this.API_URL}/${documentId}/verify`, {
      status,
      remarks: remarks || ''
    });
  }

  /**
   * Retrieve verification audit trail history for a document
   */
  getVerificationHistory(documentId: string): Observable<ApiResponse<DocumentVerificationHistory[]>> {
    return this.http.get<ApiResponse<DocumentVerificationHistory[]>>(`${this.API_URL}/${documentId}/history`);
  }

  /**
   * Fetch document as Blob for authenticated inline viewing in a new tab
   */
  viewDocument(documentId: string): Observable<Blob> {
    return this.http.get(`${this.API_URL}/${documentId}/view`, {
      responseType: 'blob'
    });
  }

  /**
   * Fetch document as Blob for authenticated download
   */
  downloadDocument(documentId: string): Observable<Blob> {
    return this.http.get(`${this.API_URL}/${documentId}/download`, {
      responseType: 'blob'
    });
  }

  /**
   * Helper to trigger native browser download from blob
   */
  triggerBlobDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Helper to open blob in a new browser window/tab
   */
  openBlobInNewTab(blob: Blob): void {
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => window.URL.revokeObjectURL(url), 10000);
  }
}
