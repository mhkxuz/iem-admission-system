import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminEnrolmentComponent } from './admin-enrolment.component';
import { PaymentService } from '../../../core/services/payment.service';
import { AdminService } from '../../../core/services/admin.service';

describe('AdminEnrolmentComponent', () => {
  let component: AdminEnrolmentComponent;
  let fixture: ComponentFixture<AdminEnrolmentComponent>;
  let mockPaymentService: any;
  let mockAdminService: any;

  beforeEach(async () => {
    mockPaymentService = {
      getAllEnrolments: vi.fn(() =>
        of({
          success: true,
          data: {
            enrolments: [
              {
                _id: 'enr1',
                enrolmentNumber: 'ENR-2026-00001',
                applicationId: 'IEM-2026-00001',
                applicant: { fullName: 'Test Candidate', email: 'test@candidate.com' },
                programme: { programmeCode: 'BTECH-CSE', programmeName: 'B.Tech CSE' },
                allocatedCategory: 'General',
                seatNumber: 1,
                feeAmountPaid: 25000,
                confirmedAt: new Date().toISOString()
              }
            ],
            total: 1,
            page: 1,
            totalPages: 1
          }
        })
      ),
      getAllPayments: vi.fn(() =>
        of({
          success: true,
          data: {
            payments: [
              {
                _id: 'pay1',
                orderId: 'order_test_123',
                applicant: { fullName: 'Test Candidate', email: 'test@candidate.com' },
                programme: { programmeCode: 'BTECH-CSE', programmeName: 'B.Tech CSE' },
                amount: 25000,
                currency: 'INR',
                status: 'Successful',
                gateway: 'sandbox',
                createdAt: new Date().toISOString(),
                auditHistory: []
              }
            ],
            total: 1,
            page: 1,
            totalPages: 1
          }
        })
      ),
      getPaymentById: vi.fn(() =>
        of({
          success: true,
          data: {
            _id: 'pay1',
            orderId: 'order_test_123',
            amount: 25000,
            status: 'Successful'
          }
        })
      ),
      reconcilePayment: vi.fn(() =>
        of({
          success: true,
          data: { _id: 'pay_pending', status: 'Failed' }
        })
      ),
      getStatistics: vi.fn(() =>
        of({
          success: true,
          data: {
            totalEnrolled: 1,
            totalFeesCollected: 25000,
            totalPaymentsSuccessful: 1,
            totalPaymentsPending: 0,
            totalPaymentsFailed: 0
          }
        })
      )
    };

    mockAdminService = {
      getProgrammes: vi.fn(() =>
        of({
          success: true,
          data: {
            programmes: [{ _id: 'p1', programmeCode: 'BTECH-CSE', programmeName: 'B.Tech CSE' }],
            total: 1,
            page: 1,
            limit: 10,
            totalPages: 1
          }
        })
      ),
      getSessions: vi.fn(() =>
        of({
          success: true,
          data: [{ _id: 's1', sessionName: '2026-2027', status: 'Active' }]
        })
      )
    };

    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, AdminEnrolmentComponent],
      providers: [
        { provide: PaymentService, useValue: mockPaymentService },
        { provide: AdminService, useValue: mockAdminService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminEnrolmentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load initial data', () => {
    expect(component).toBeTruthy();
    expect(mockPaymentService.getStatistics).toHaveBeenCalled();
    expect(mockPaymentService.getAllEnrolments).toHaveBeenCalled();
    expect(mockPaymentService.getAllPayments).toHaveBeenCalled();
    expect(component.enrolments.length).toBe(1);
    expect(component.payments.length).toBe(1);
    expect(component.statistics?.totalEnrolled).toBe(1);
  });

  it('should switch between enrolments and payments tabs', () => {
    expect(component.activeTab).toBe('enrolments');
    component.switchTab('payments');
    expect(component.activeTab).toBe('payments');
    component.switchTab('enrolments');
    expect(component.activeTab).toBe('enrolments');
  });

  it('should open and close payment inspection modal', () => {
    const testPayment = component.payments[0];
    component.inspectPayment(testPayment);
    expect(component.inspectingPayment).toBeTruthy();
    expect(component.inspectingPayment?.orderId).toBe('order_test_123');

    component.closeInspectionModal();
    expect(component.inspectingPayment).toBeNull();
  });

  it('should submit reconciliation and refresh data', () => {
    const testPayment = {
      _id: 'pay_pending',
      orderId: 'order_recon',
      status: 'Pending'
    } as any;

    component.openReconciliationModal(testPayment);
    expect(component.reconcilingPayment).toBe(testPayment);

    component.reconciliationAction = 'MarkFailed';
    component.reconciliationRemarks = 'Bank payment reconciliation timeout';

    component.submitReconciliation();
    expect(mockPaymentService.reconcilePayment).toHaveBeenCalledWith(
      'pay_pending',
      'MarkFailed',
      'Bank payment reconciliation timeout'
    );
    expect(component.reconcilingPayment).toBeNull();
  });
});
