import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  let service: PaymentService;
  let httpMock: HttpTestingController;
  const API_URL = 'http://localhost:5000/api/payments';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PaymentService]
    });
    service = TestBed.inject(PaymentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch admission confirmation eligibility', () => {
    const mockEligibility = {
      success: true,
      data: { isEligible: true, seatAllocation: { status: 'Allocated' } }
    };

    service.getEligibility().subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.data.isEligible).toBe(true);
    });

    const req = httpMock.expectOne(`${API_URL}/eligibility`);
    expect(req.request.method).toBe('GET');
    req.flush(mockEligibility);
  });

  it('should create payment order', () => {
    const mockOrder = {
      success: true,
      data: { orderId: 'order_123', amount: 25000, currency: 'INR' }
    };

    service.createOrder('idem-test').subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.data.orderId).toBe('order_123');
    });

    const req = httpMock.expectOne(`${API_URL}/order`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ idempotencyKey: 'idem-test' });
    req.flush(mockOrder);
  });

  it('should verify payment and complete enrolment', () => {
    const mockVerification = {
      success: true,
      data: {
        status: 'Successful',
        enrolment: { enrolmentNumber: 'ENR-2026-00001' }
      }
    };

    service.verifyPayment('order_123', 'pay_123', 'sig_123').subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.data.enrolment.enrolmentNumber).toBe('ENR-2026-00001');
    });

    const req = httpMock.expectOne(`${API_URL}/verify`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      orderId: 'order_123',
      paymentId: 'pay_123',
      signature: 'sig_123'
    });
    req.flush(mockVerification);
  });

  it('should retrieve confirmed admission receipt', () => {
    const mockReceipt = {
      success: true,
      data: { hasConfirmedAdmission: true, enrolmentNumber: 'ENR-2026-00001' }
    };

    service.getAdmissionReceipt().subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.data.hasConfirmedAdmission).toBe(true);
    });

    const req = httpMock.expectOne(`${API_URL}/receipt`);
    expect(req.request.method).toBe('GET');
    req.flush(mockReceipt);
  });

  it('should list all enrolments for admin', () => {
    const mockEnrolments = {
      success: true,
      data: { enrolments: [{ enrolmentNumber: 'ENR-2026-00001' }], total: 1 }
    };

    service.getAllEnrolments({ page: 1, limit: 10 }).subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.data.enrolments.length).toBe(1);
    });

    const req = httpMock.expectOne((r) => r.url === `${API_URL}/enrolments/all`);
    expect(req.request.method).toBe('GET');
    req.flush(mockEnrolments);
  });

  it('should reconcile payment', () => {
    const mockResponse = {
      success: true,
      data: { _id: 'pay1', status: 'Failed' }
    };

    service.reconcilePayment('pay1', 'Mark_Failed', 'Bank reconciliation timeout').subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.data.status).toBe('Failed');
    });

    const req = httpMock.expectOne(`${API_URL}/pay1/reconcile`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      action: 'Mark_Failed',
      remarks: 'Bank reconciliation timeout'
    });
    req.flush(mockResponse);
  });

  it('should fetch enrolment statistics', () => {
    const mockStats = {
      success: true,
      data: { totalEnrolled: 15, totalFeesCollected: 375000 }
    };

    service.getStatistics('2026-2027').subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.data.totalEnrolled).toBe(15);
    });

    const req = httpMock.expectOne((r) => r.url === `${API_URL}/enrolments/statistics`);
    expect(req.request.method).toBe('GET');
    req.flush(mockStats);
  });
});
