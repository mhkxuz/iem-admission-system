import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/user.model';
import {
  AdmissionEligibility,
  PaymentOrderResponse,
  Payment,
  Enrolment,
  AdmissionReceipt,
  PaymentStatistics
} from '../models/payment.model';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private http = inject(HttpClient);
  private readonly API_URL = 'https://iem-admission-system-v2pf.onrender.com/api/payments';

  /**
   * Applicant: Check admission confirmation & fee eligibility
   */
  getEligibility(): Observable<ApiResponse<AdmissionEligibility>> {
    return this.http.get<ApiResponse<AdmissionEligibility>>(`${this.API_URL}/eligibility`);
  }

  /**
   * Applicant: Initiate payment order
   */
  createOrder(idempotencyKey?: string): Observable<ApiResponse<PaymentOrderResponse>> {
    return this.http.post<ApiResponse<PaymentOrderResponse>>(`${this.API_URL}/order`, {
      idempotencyKey
    });
  }

  /**
   * Applicant: Verify payment signature and complete enrolment
   */
  verifyPayment(
    orderId: string,
    paymentId: string,
    signature: string
  ): Observable<ApiResponse<{ status: string; enrolment: Enrolment; payment: Payment }>> {
    return this.http.post<ApiResponse<{ status: string; enrolment: Enrolment; payment: Payment }>>(
      `${this.API_URL}/verify`,
      { orderId, paymentId, signature }
    );
  }

  /**
   * Applicant: Retrieve confirmed admission receipt
   */
  getAdmissionReceipt(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.API_URL}/receipt`);
  }

  /**
   * Admin: List all payment transactions
   */
  getAllPayments(query?: {
    page?: number;
    limit?: number;
    status?: string;
    programmeId?: string;
    search?: string;
  }): Observable<ApiResponse<{ payments: Payment[]; total: number; page: number; totalPages: number }>> {
    let params = new HttpParams();
    if (query?.page) params = params.set('page', query.page.toString());
    if (query?.limit) params = params.set('limit', query.limit.toString());
    if (query?.status) params = params.set('status', query.status);
    if (query?.programmeId) params = params.set('programmeId', query.programmeId);
    if (query?.search) params = params.set('search', query.search);

    return this.http.get<ApiResponse<{ payments: Payment[]; total: number; page: number; totalPages: number }>>(
      this.API_URL,
      { params }
    );
  }

  /**
   * Admin: Retrieve payment details with audit history
   */
  getPaymentById(id: string): Observable<ApiResponse<Payment>> {
    return this.http.get<ApiResponse<Payment>>(`${this.API_URL}/${id}`);
  }

  /**
   * Admin: Reconcile payment status
   */
  reconcilePayment(
    id: string,
    action: string,
    remarks: string
  ): Observable<ApiResponse<Payment>> {
    return this.http.post<ApiResponse<Payment>>(`${this.API_URL}/${id}/reconcile`, {
      action,
      remarks
    });
  }

  /**
   * Admin: List permanent enrolments
   */
  getAllEnrolments(query?: {
    page?: number;
    limit?: number;
    programmeId?: string;
    academicSession?: string;
    search?: string;
  }): Observable<ApiResponse<{ enrolments: Enrolment[]; total: number; page: number; totalPages: number }>> {
    let params = new HttpParams();
    if (query?.page) params = params.set('page', query.page.toString());
    if (query?.limit) params = params.set('limit', query.limit.toString());
    if (query?.programmeId) params = params.set('programmeId', query.programmeId);
    if (query?.academicSession) params = params.set('academicSession', query.academicSession);
    if (query?.search) params = params.set('search', query.search);

    return this.http.get<ApiResponse<{ enrolments: Enrolment[]; total: number; page: number; totalPages: number }>>(
      `${this.API_URL}/enrolments/all`,
      { params }
    );
  }

  /**
   * Admin: Get admission & fee collection statistics
   */
  getStatistics(academicSession?: string): Observable<ApiResponse<PaymentStatistics>> {
    let params = new HttpParams();
    if (academicSession) params = params.set('academicSession', academicSession);

    return this.http.get<ApiResponse<PaymentStatistics>>(
      `${this.API_URL}/enrolments/statistics`,
      { params }
    );
  }
}
