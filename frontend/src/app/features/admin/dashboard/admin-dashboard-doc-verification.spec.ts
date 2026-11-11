import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { AdminService } from '../../../core/services/admin.service';
import { DocumentService } from '../../../core/services/document.service';
import { MeritService } from '../../../core/services/merit.service';
import { PaymentService } from '../../../core/services/payment.service';
import { ReportService } from '../../../core/services/report.service';
import { AdmissionApplication } from '../../../core/models/application.model';
import { UploadedDocument } from '../../../core/models/document.model';

function makeDocument(overrides: Partial<UploadedDocument> = {}): UploadedDocument {
  return {
    _id: 'doc-001',
    application: 'app-001',
    applicant: 'applicant-001',
    documentType: 'Class 10 Marksheet',
    originalFileName: 'marksheet.pdf',
    storedFileName: 'stored.pdf',
    filePath: 'uploads/stored.pdf',
    mimeType: 'application/pdf',
    fileSize: 12345,
    uploadedAt: '2026-03-01T10:00:00.000Z',
    verificationStatus: 'Pending',
    ...overrides
  };
}

function makeApplication(overrides: Partial<AdmissionApplication> = {}): AdmissionApplication {
  return {
    _id: 'app-001',
    applicationId: 'IEM-2026-10001',
    academicSession: '2026-2027',
    personalInfo: {
      fullName: 'Test Candidate',
      dob: '2005-01-01',
      gender: 'Male',
      email: 'test@example.com',
      phone: '9830000001',
      address: 'Salt Lake',
      state: 'West Bengal',
      city: 'Kolkata',
      pincode: '700091'
    },
    academicInfo: {
      class10Board: 'CBSE',
      class10Percentage: 90,
      class12Board: 'CBSE',
      class12Percentage: 92,
      class12PassingYear: 2024,
      entranceExamName: 'JEE Main',
      entranceExamScore: 'Rank 5000'
    },
    admissionInfo: {
      preferredDepartment: 'Computer Science & Engineering',
      admissionCategory: 'General'
    },
    status: 'Submitted',
    submittedAt: '2026-03-01T10:00:00.000Z',
    documents: [],
    statusHistory: [],
    allowedNextStatuses: ['Under Review'],
    ...overrides
  };
}

describe('AdminDashboardComponent — Document Verification Controls', () => {
  let fixture: ComponentFixture<AdminDashboardComponent>;
  let component: AdminDashboardComponent;
  let adminServiceMock: {
    getDashboard: ReturnType<typeof vi.fn>;
    getApplications: ReturnType<typeof vi.fn>;
    getApplicationById: ReturnType<typeof vi.fn>;
    updateApplicationStatus: ReturnType<typeof vi.fn>;
  };
  let documentServiceMock: {
    viewDocument: ReturnType<typeof vi.fn>;
    downloadDocument: ReturnType<typeof vi.fn>;
    verifyDocument: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    adminServiceMock = {
      getDashboard: vi.fn().mockReturnValue(of({
        data: { metrics: { totalApplications: 1, submitted: 1, underReview: 0, selected: 0, rejected: 0 } }
      })),
      getApplications: vi.fn().mockReturnValue(of({ data: [], meta: null })),
      getApplicationById: vi.fn().mockReturnValue(of({ data: makeApplication() })),
      updateApplicationStatus: vi.fn()
    };
    documentServiceMock = {
      viewDocument: vi.fn().mockReturnValue(of(new Blob())),
      downloadDocument: vi.fn().mockReturnValue(of(new Blob())),
      verifyDocument: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent, HttpClientTestingModule],
      providers: [
        provideRouter([]),
        { provide: AdminService, useValue: adminServiceMock },
        { provide: DocumentService, useValue: documentServiceMock },
        { provide: MeritService, useValue: {} },
        { provide: PaymentService, useValue: {} },
        { provide: ReportService, useValue: {} }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  test('should show Approve and Reject buttons for Pending documents in the inspection modal', () => {
    const pendingDoc = makeDocument({ verificationStatus: 'Pending' });
    component.inspectedApp = makeApplication({ documents: [pendingDoc] });
    component.activeTab = 'applications';
    fixture.detectChanges();

    const html = fixture.nativeElement.innerHTML;
    expect(html).toContain('✓ Approve');
    expect(html).toContain('✗ Reject');
  });

  test('should NOT show Approve/Reject buttons for already-Verified documents', () => {
    const verifiedDoc = makeDocument({
      verificationStatus: 'Verified',
      verifiedBy: { _id: 'admin-1', fullName: 'Admin User', email: 'admin@test.edu', role: 'admin' },
      verifiedAt: '2026-03-02T10:00:00.000Z'
    });
    component.inspectedApp = makeApplication({ documents: [verifiedDoc] });
    component.activeTab = 'applications';
    fixture.detectChanges();

    const html = fixture.nativeElement.innerHTML;
    expect(html).not.toContain('✓ Approve');
    expect(html).not.toContain('✗ Reject');
    expect(html).toContain('✓ Document approved');
  });

  test('should call DocumentService.verifyDocument with Verified on approve click', () => {
    const approvedDoc = makeDocument({
      _id: 'doc-approve',
      verificationStatus: 'Verified',
      verifiedBy: { _id: 'a1', fullName: 'Admin', email: 'a@t.edu', role: 'admin' },
      verifiedAt: '2026-03-02T10:00:00.000Z',
      verificationRemarks: 'OK'
    });
    documentServiceMock.verifyDocument.mockReturnValue(of({ data: approvedDoc }));

    const pendingDoc = makeDocument({ _id: 'doc-approve' });
    component.inspectedApp = makeApplication({ documents: [pendingDoc] });
    component.activeTab = 'applications';
    component.docRemarksMap['doc-approve'] = 'Looks good';
    fixture.detectChanges();

    component.verifyDocumentAction(pendingDoc, 'Verified');

    expect(documentServiceMock.verifyDocument).toHaveBeenCalledWith('doc-approve', 'Verified', 'Looks good');
  });

  test('should require remarks for rejection and show error if empty', () => {
    const pendingDoc = makeDocument({ _id: 'doc-reject' });
    component.inspectedApp = makeApplication({ documents: [pendingDoc] });
    component.activeTab = 'applications';
    component.docRemarksMap['doc-reject'] = '';
    fixture.detectChanges();

    component.verifyDocumentAction(pendingDoc, 'Rejected');

    expect(documentServiceMock.verifyDocument).not.toHaveBeenCalled();
    expect(component.docVerifyError).toBe('Remarks are mandatory when rejecting a document.');
    expect(component.docVerifyErrorId).toBe('doc-reject');
  });

  test('should call DocumentService.verifyDocument with Rejected when remarks are provided', () => {
    const rejectedDoc = makeDocument({
      _id: 'doc-rej2',
      verificationStatus: 'Rejected',
      verifiedBy: { _id: 'a1', fullName: 'Admin', email: 'a@t.edu', role: 'admin' },
      verifiedAt: '2026-03-02T10:00:00.000Z',
      verificationRemarks: 'Blurry scan'
    });
    documentServiceMock.verifyDocument.mockReturnValue(of({ data: rejectedDoc }));

    const pendingDoc = makeDocument({ _id: 'doc-rej2' });
    component.inspectedApp = makeApplication({ documents: [pendingDoc] });
    component.activeTab = 'applications';
    component.docRemarksMap['doc-rej2'] = 'Blurry scan';
    fixture.detectChanges();

    component.verifyDocumentAction(pendingDoc, 'Rejected');

    expect(documentServiceMock.verifyDocument).toHaveBeenCalledWith('doc-rej2', 'Rejected', 'Blurry scan');
  });

  test('should update the document in the inspected app after successful verification', () => {
    const updatedDoc = makeDocument({
      _id: 'doc-upd',
      verificationStatus: 'Verified',
      verifiedBy: { _id: 'admin-1', fullName: 'Head Admin', email: 'admin@iem.edu', role: 'admin' },
      verifiedAt: '2026-03-02T12:00:00.000Z',
      verificationRemarks: 'Perfect'
    });
    documentServiceMock.verifyDocument.mockReturnValue(of({ data: updatedDoc }));

    const pendingDoc = makeDocument({ _id: 'doc-upd' });
    component.inspectedApp = makeApplication({ documents: [pendingDoc] });
    component.activeTab = 'applications';
    fixture.detectChanges();

    component.verifyDocumentAction(pendingDoc, 'Verified');

    const docInApp = component.inspectedApp!.documents![0] as any;
    expect(docInApp.verificationStatus).toBe('Verified');
    expect(docInApp.verifiedBy.role).toBe('admin');
    expect(docInApp.verifiedBy.fullName).toBe('Head Admin');
  });

  test('should display verification error on API failure', () => {
    documentServiceMock.verifyDocument.mockReturnValue(
      throwError(() => ({ error: { message: 'Server error during verification.' } }))
    );

    const pendingDoc = makeDocument({ _id: 'doc-err' });
    component.inspectedApp = makeApplication({ documents: [pendingDoc] });
    component.activeTab = 'applications';
    fixture.detectChanges();

    component.verifyDocumentAction(pendingDoc, 'Verified');

    expect(component.docVerifyError).toBe('Server error during verification.');
    expect(component.docVerifyErrorId).toBe('doc-err');
    expect(component.docVerifyingId).toBeNull();
  });

  test('should show Approve/Reject for Rejected documents (re-verification after replacement)', () => {
    const rejectedDoc = makeDocument({
      verificationStatus: 'Rejected',
      verifiedBy: { _id: 'r1', fullName: 'Reviewer', email: 'r@t.edu', role: 'reviewer' },
      verificationRemarks: 'Wrong document'
    });
    component.inspectedApp = makeApplication({ documents: [rejectedDoc] });
    component.activeTab = 'applications';
    fixture.detectChanges();

    const html = fixture.nativeElement.innerHTML;
    expect(html).toContain('✓ Approve');
    expect(html).toContain('✗ Reject');
  });

  test('should display the verifier role in the document info', () => {
    const verifiedDoc = makeDocument({
      verificationStatus: 'Verified',
      verifiedBy: { _id: 'admin-1', fullName: 'Head of Admissions', email: 'admin@iem.edu', role: 'admin' },
      verifiedAt: '2026-03-02T10:00:00.000Z'
    });
    component.inspectedApp = makeApplication({ documents: [verifiedDoc] });
    component.activeTab = 'applications';
    fixture.detectChanges();

    const html = fixture.nativeElement.innerHTML;
    expect(html).toContain('Head of Admissions');
    expect(html).toContain('(admin)');
  });
});
