import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ApplicantDashboardComponent } from './applicant-dashboard.component';
import { AuthService } from '../../../core/services/auth.service';
import { ApplicationService } from '../../../core/services/application.service';
import { DocumentService } from '../../../core/services/document.service';
import { MeritService } from '../../../core/services/merit.service';
import { PaymentService } from '../../../core/services/payment.service';
import { AdmissionApplication } from '../../../core/models/application.model';
import { UploadedDocument } from '../../../core/models/document.model';

const sampleApplication: AdmissionApplication = {
  _id: 'application-1',
  applicationId: 'IEM-2026-ABCDE',
  academicSession: '2026-2027',
  personalInfo: {
    fullName: 'Stage Eight Applicant',
    dob: '2005-04-12',
    gender: 'Male',
    email: 'stage8@example.com',
    phone: '9830000001',
    address: 'Salt Lake Sector V',
    state: 'West Bengal',
    city: 'Kolkata',
    pincode: '700091'
  },
  academicInfo: {
    class10Board: 'ICSE',
    class10Percentage: 91.5,
    class12Board: 'ISC',
    class12Percentage: 93.2,
    class12PassingYear: 2024,
    entranceExamName: 'WBJEE',
    entranceExamScore: 'Rank 1520'
  },
  admissionInfo: {
    preferredDepartment: 'Information Technology',
    admissionCategory: 'General'
  },
  status: 'Submitted',
  submittedAt: '2026-05-01T10:00:00.000Z',
  documents: [],
  statusHistory: []
};

const sampleDocument: UploadedDocument = {
  _id: 'document-1',
  application: 'application-1',
  applicant: 'applicant-1',
  documentType: 'Class 12 Marksheet',
  originalFileName: 'marksheet.pdf',
  storedFileName: 'stored-marksheet.pdf',
  filePath: '/uploads/documents/stored-marksheet.pdf',
  mimeType: 'application/pdf',
  fileSize: 2048,
  uploadedAt: '2026-05-01T10:05:00.000Z'
};

const applicantUser = {
  _id: 'applicant-1',
  fullName: 'Stage Eight Applicant',
  email: 'stage8@example.com',
  role: 'applicant' as const
};

describe('ApplicantDashboardComponent', () => {
  let fixture: ComponentFixture<ApplicantDashboardComponent>;
  let component: ApplicantDashboardComponent;
  let applicationServiceMock: {
    getMyApplication: ReturnType<typeof vi.fn>;
  };
  let documentServiceMock: {
    getDocumentsByApplication: ReturnType<typeof vi.fn>;
    uploadDocument: ReturnType<typeof vi.fn>;
    viewDocument: ReturnType<typeof vi.fn>;
    downloadDocument: ReturnType<typeof vi.fn>;
    openBlobInNewTab: ReturnType<typeof vi.fn>;
    triggerBlobDownload: ReturnType<typeof vi.fn>;
  };
  let meritServiceMock: {
    getMyResult: ReturnType<typeof vi.fn>;
  };
  let paymentServiceMock: {
    getAdmissionReceipt: ReturnType<typeof vi.fn>;
    createOrder: ReturnType<typeof vi.fn>;
    verifyPayment: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    paymentServiceMock = {
      getAdmissionReceipt: vi.fn(() =>
        of({ success: true, data: { hasConfirmedAdmission: false, eligibility: null } })
      ),
      createOrder: vi.fn(() =>
        of({
          success: true,
          data: { orderId: 'order_test_999', amount: 25000, programmeName: 'B.Tech IT' }
        })
      ),
      verifyPayment: vi.fn(() =>
        of({
          success: true,
          data: {
            status: 'Successful',
            enrolment: { enrolmentNumber: 'ENR-2026-00001' }
          }
        })
      )
    };
    meritServiceMock = {
      getMyResult: vi.fn(() => of({ success: true, data: { hasPublishedResult: false } }))
    };
    applicationServiceMock = {
      getMyApplication: vi.fn(() =>
        of({ success: true, message: 'Application loaded.', data: sampleApplication })
      )
    };
    documentServiceMock = {
      getDocumentsByApplication: vi.fn(() =>
        of({ success: true, message: 'Documents loaded.', data: [sampleDocument] })
      ),
      uploadDocument: vi.fn(() =>
        of({ success: true, message: 'Document uploaded.', data: sampleDocument })
      ),
      viewDocument: vi.fn(() => of(new Blob(['pdf']))),
      downloadDocument: vi.fn(() => of(new Blob(['pdf']))),
      openBlobInNewTab: vi.fn(),
      triggerBlobDownload: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [ApplicantDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUserValue: applicantUser } },
        { provide: ApplicationService, useValue: applicationServiceMock },
        { provide: DocumentService, useValue: documentServiceMock },
        { provide: MeritService, useValue: meritServiceMock },
        { provide: PaymentService, useValue: paymentServiceMock }
      ]
    }).compileComponents();
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(ApplicantDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should render the application summary, status and uploaded documents', () => {
    createComponent();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Welcome, Stage Eight Applicant');
    expect(text).toContain('IEM-2026-ABCDE');
    expect(text).toContain('Under Review');
    expect(text).toContain('Information Technology');
    expect(text).toContain('marksheet.pdf');
    expect(text).toContain('Class 12 Marksheet');
    expect(component.documents).toHaveLength(1);
  });

  it('should show the empty state when no application exists', () => {
    applicationServiceMock.getMyApplication.mockReturnValue(
      of({ success: true, message: 'No application.', data: null })
    );

    createComponent();

    expect(fixture.nativeElement.querySelector('.state-card.empty')?.textContent).toContain(
      'No Admission Application Submitted Yet'
    );
    expect(documentServiceMock.getDocumentsByApplication).not.toHaveBeenCalled();
  });

  it('should provide navigation to the application form in the empty state', () => {
    applicationServiceMock.getMyApplication.mockReturnValue(
      of({ success: true, message: 'No application.', data: null })
    );

    createComponent();

    const applyLink = fixture.nativeElement.querySelector(
      '.state-card.empty a[routerLink="/applicant/apply"]'
    );
    expect(applyLink).toBeTruthy();
    expect(applyLink?.textContent).toContain('Start Admission Application');
  });

  it('should show an application load error with the backend message', () => {
    applicationServiceMock.getMyApplication.mockReturnValue(
      throwError(() => ({ error: { message: 'Database unavailable.' } }))
    );

    createComponent();

    expect(component.errorMessage).toBe('Database unavailable.');
    expect(fixture.nativeElement.querySelector('.alert-box.error')?.textContent).toContain(
      'Database unavailable.'
    );
  });

  it('should retry loading application data when retry button is clicked after API failure', () => {
    applicationServiceMock.getMyApplication.mockReturnValueOnce(
      throwError(() => ({ error: { message: 'Connection timeout.' } }))
    );

    createComponent();

    expect(component.errorMessage).toBe('Connection timeout.');
    const retryBtn = fixture.nativeElement.querySelector(
      '.alert-box.error .btn-retry-inline'
    );
    expect(retryBtn).toBeTruthy();

    applicationServiceMock.getMyApplication.mockReturnValue(
      of({ success: true, message: 'Application loaded.', data: sampleApplication })
    );
    retryBtn.click();
    fixture.detectChanges();

    expect(applicationServiceMock.getMyApplication).toHaveBeenCalledTimes(2);
    expect(component.errorMessage).toBe('');
    expect(component.application?.applicationId).toBe('IEM-2026-ABCDE');
    expect(fixture.nativeElement.textContent).toContain('IEM-2026-ABCDE');
  });

  it('should show a document load error and retry successfully', () => {
    documentServiceMock.getDocumentsByApplication.mockReturnValueOnce(
      throwError(() => ({ error: { message: 'Documents unavailable.' } }))
    );

    createComponent();

    expect(component.documentsError).toBe('Documents unavailable.');
    expect(fixture.nativeElement.querySelector('.alert-box.error')?.textContent).toContain(
      'Documents unavailable.'
    );

    documentServiceMock.getDocumentsByApplication.mockReturnValue(
      of({ success: true, message: 'Documents loaded.', data: [sampleDocument] })
    );
    fixture.nativeElement.querySelector('.btn-retry-inline').click();
    fixture.detectChanges();

    expect(documentServiceMock.getDocumentsByApplication).toHaveBeenCalledTimes(2);
    expect(component.documentsError).toBe('');
    expect(fixture.nativeElement.textContent).toContain('marksheet.pdf');
  });

  it('should reject a file larger than 5MB before upload', () => {
    createComponent();

    const oversized = new File([new Uint8Array(6 * 1024 * 1024)], 'large.pdf', {
      type: 'application/pdf'
    });
    component.onFileSelected({ target: { files: [oversized], value: 'C:\\fakepath\\large.pdf' } });

    expect(component.selectedFile).toBeNull();
    expect(component.uploadErrorMessage).toBe(
      'File size exceeds maximum permitted limit of 5MB.'
    );
  });

  it('should require a document type and file before uploading', () => {
    createComponent();

    const input = document.createElement('input');
    component.uploadDocument(input);

    expect(documentServiceMock.uploadDocument).not.toHaveBeenCalled();
    expect(component.uploadErrorMessage).toBe(
      'Please choose a document category and valid file.'
    );
  });

  it('should upload a valid document, reset the form and refresh the list', () => {
    createComponent();

    const input = document.createElement('input');
    input.value = 'C:\\fakepath\\marksheet.pdf';
    component.selectedDocType = 'Class 12 Marksheet';
    component.selectedFile = new File([new Uint8Array([1, 2, 3])], 'marksheet.pdf', {
      type: 'application/pdf'
    });

    component.uploadDocument(input);

    expect(documentServiceMock.uploadDocument).toHaveBeenCalledWith(
      'application-1',
      'Class 12 Marksheet',
      expect.any(File)
    );
    expect(component.uploadSuccessMessage).toContain('uploaded successfully');
    expect(component.selectedFile).toBeNull();
    expect(input.value).toBe('');
    expect(documentServiceMock.getDocumentsByApplication).toHaveBeenCalledTimes(2);
  });

  it('should toggle the full details panel', () => {
    createComponent();

    expect(component.showDetails).toBe(false);
    fixture.nativeElement.querySelector('.btn-toggle').click();
    fixture.detectChanges();

    expect(component.showDetails).toBe(true);
    expect(fixture.nativeElement.querySelector('.full-details-panel')).toBeTruthy();
  });

  it('should format file sizes for display', () => {
    createComponent();

    expect(component.formatBytes(0)).toBe('0 Bytes');
    expect(component.formatBytes(2048)).toBe('2 KB');
  });

  it('should display verification status and reviewer rejection remarks', () => {
    const rejectedDoc: UploadedDocument = {
      ...sampleDocument,
      verificationStatus: 'Rejected',
      verificationRemarks: 'Scan cut off at bottom'
    };
    documentServiceMock.getDocumentsByApplication.mockReturnValue(
      of({ success: true, message: '', data: [rejectedDoc] })
    );

    createComponent();

    const compiled = fixture.nativeElement as HTMLElement;
    const statusBadge = compiled.querySelector('.status-badge-doc');
    expect(statusBadge?.textContent).toContain('Rejected');

    const remarksText = compiled.querySelector('.rejection-remarks');
    expect(remarksText?.textContent).toContain('Scan cut off at bottom');

    const replaceBtn = compiled.querySelector('.btn-replace-doc') as HTMLButtonElement;
    expect(replaceBtn).toBeTruthy();
  });

  it('should prefill document category when applicant clicks replace on rejected document', () => {
    const rejectedDoc: UploadedDocument = {
      ...sampleDocument,
      documentType: 'Class 12 Marksheet',
      verificationStatus: 'Rejected',
      verificationRemarks: 'Illegible photo'
    };
    documentServiceMock.getDocumentsByApplication.mockReturnValue(
      of({ success: true, message: '', data: [rejectedDoc] })
    );

    createComponent();

    component.replaceDocument(rejectedDoc);
    expect(component.selectedDocType).toBe('Class 12 Marksheet');
    expect(component.uploadSuccessMessage).toContain('Replacing rejected Class 12 Marksheet');
  });

  it('should render published merit rank, composite score, and seat allocation when published', () => {
    meritServiceMock.getMyResult.mockReturnValue(
      of({
        success: true,
        data: {
          hasPublishedResult: true,
          candidateName: 'Stage Eight Applicant',
          applicationId: 'IEM-2026-ABCDE',
          category: 'General',
          class12Percentage: 93.2,
          compositeScore: 94.5,
          meritRank: 1,
          categoryRank: 1,
          allocationStatus: 'Allocated',
          allocatedCategory: 'General',
          allocationReason: 'Allocated under Open / General Merit Quota (Merit Rank #1)',
          seatNumber: 1,
          programme: {
            programmeName: 'B.Tech in Information Technology'
          },
          academicSession: '2026-2027',
          cutoffs: {
            highestScore: 94.5,
            lowestShortlistedScore: 82.0
          }
        }
      })
    );

    createComponent();

    const compiled = fixture.nativeElement as HTMLElement;
    const meritCard = compiled.querySelector('.merit-result-card');
    expect(meritCard).toBeTruthy();
    expect(meritCard?.textContent).toContain('Official Admission Merit & Allocation Outcome');
    expect(meritCard?.textContent).toContain('#1');
    expect(meritCard?.textContent).toContain('94.50');
    expect(meritCard?.textContent).toContain('Allocated under Open / General Merit Quota');
    expect(meritCard?.textContent).toContain('Seat #1');
  });

  it('should render admission offer card and initiate checkout when candidate is allocated and eligible', () => {
    paymentServiceMock.getAdmissionReceipt.mockReturnValue(
      of({
        success: true,
        data: {
          hasConfirmedAdmission: false,
          eligibility: {
            isEligible: true,
            programme: { programmeName: 'B.Tech in Information Technology' },
            allocation: { seatNumber: 1, allocatedCategory: 'General' },
            feeStructure: { admissionFee: 25000, totalProgrammeFee: 100000 }
          }
        }
      })
    );

    createComponent();

    const compiled = fixture.nativeElement as HTMLElement;
    const offerCard = compiled.querySelector('.admission-offer-card');
    expect(offerCard).toBeTruthy();
    expect(offerCard?.textContent).toContain('Provisional Seat Allocated');
    expect(offerCard?.textContent).toContain('₹25,000');

    // Initiate payment
    component.initiateAdmissionPayment();
    expect(paymentServiceMock.createOrder).toHaveBeenCalled();
    expect(component.showCheckoutModal).toBe(true);
  });

  it('should render confirmed permanent enrolment number and print receipt when enrolled', () => {
    paymentServiceMock.getAdmissionReceipt.mockReturnValue(
      of({
        success: true,
        data: {
          hasConfirmedAdmission: true,
          enrolmentNumber: 'ENR-2026-00001',
          applicationId: 'IEM-2026-ABCDE',
          programme: {
            programmeName: 'B.Tech in Information Technology',
            degree: 'B.Tech',
            department: 'Information Technology'
          },
          academicSession: '2026-2027',
          allocatedCategory: 'General',
          seatNumber: 1,
          feeAmountPaid: 25000,
          paymentReference: 'pay_sandbox_123',
          confirmedAt: new Date().toISOString()
        }
      })
    );

    createComponent();

    const compiled = fixture.nativeElement as HTMLElement;
    const enrolledCard = compiled.querySelector('.confirmed-enrolment-card');
    expect(enrolledCard).toBeTruthy();
    expect(enrolledCard?.textContent).toContain('Official Admission Confirmed');
    expect(enrolledCard?.textContent).toContain('ENR-2026-00001');
    expect(enrolledCard?.textContent).toContain('B.Tech in Information Technology');
    expect(enrolledCard?.textContent).toContain('₹25,000 Paid');
    expect(compiled.querySelector('.btn-print-receipt')).toBeTruthy();
  });

  describe('Admission Tracker Lifecycle Status Tests', () => {
    it('should derive Step 4 status strictly from published merit result and not fabricate it from enrolment', () => {
      paymentServiceMock.getAdmissionReceipt.mockReturnValue(
        of({
          success: true,
          data: {
            hasConfirmedAdmission: true,
            enrolmentNumber: 'ENR-2026-00001',
            programme: { programmeName: 'B.Tech IT' },
            feeAmountPaid: 25000,
            academicSession: '2026-2027',
            allocatedCategory: 'General',
            seatNumber: 1
          }
        })
      );
      // Merit result missing/not published
      meritServiceMock.getMyResult.mockReturnValue(
        of({ success: true, data: { hasPublishedResult: false } })
      );

      createComponent();

      // Step 8 (Confirmed) and Step 9 (Enrolment) are completed based on their records
      expect(component.getStepClass(8)).toBe('completed');
      expect(component.getStepClass(9)).toBe('completed');
      // But Step 4 is NOT fabricated as completed when merit result is missing
      expect(component.getStepClass(4)).not.toBe('completed');
    });

    it('should reflect Step 4 as completed when applicant has valid published merit result', () => {
      meritServiceMock.getMyResult.mockReturnValue(
        of({
          success: true,
          data: {
            hasPublishedResult: true,
            meritRank: 12,
            categoryRank: 4,
            compositeScore: 88.5,
            allocationStatus: 'Waitlisted'
          }
        })
      );

      createComponent();

      expect(component.getStepClass(4)).toBe('completed');
      expect(component.getStepStateLabel(4)).toBe('Completed');
    });

    it('should show Step 4 as in progress when documents are verified and waiting for merit publication', () => {
      createComponent();
      component.application = { ...sampleApplication, documentVerificationStatus: 'Verified' };
      component.documents = [{ ...sampleDocument, verificationStatus: 'Verified' }];
      component.meritResult = null;

      expect(component.getStepClass(4)).toBe('current');
      expect(component.getStepStateLabel(4)).toBe('In Progress');
    });
  });
});
