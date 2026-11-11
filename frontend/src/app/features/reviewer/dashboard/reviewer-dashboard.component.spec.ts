import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ReviewerDashboardComponent } from './reviewer-dashboard.component';
import { DocumentService } from '../../../core/services/document.service';
import { AuthService } from '../../../core/services/auth.service';
import { UploadedDocument } from '../../../core/models/document.model';

describe('ReviewerDashboardComponent', () => {
  let component: ReviewerDashboardComponent;
  let fixture: ComponentFixture<ReviewerDashboardComponent>;
  let mockDocumentService: any;
  let mockAuthService: any;

  const mockDocuments: UploadedDocument[] = [
    {
      _id: 'doc-1',
      application: { applicationId: 'IEM-2026-10001', status: 'Submitted' },
      applicant: { fullName: 'Siddhartha Sen', email: 'siddhartha@iem.edu', phone: '9830112233' },
      documentType: 'Class 12 Marksheet',
      originalFileName: 'class12.pdf',
      storedFileName: 'stored12.pdf',
      filePath: 'uploads/stored12.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      uploadedAt: new Date().toISOString(),
      verificationStatus: 'Pending'
    },
    {
      _id: 'doc-2',
      application: { applicationId: 'IEM-2026-10002', status: 'Under Review' },
      applicant: { fullName: 'Ananya Roy', email: 'ananya@iem.edu', phone: '9830112244' },
      documentType: 'Photograph',
      originalFileName: 'photo.jpg',
      storedFileName: 'stored_photo.jpg',
      filePath: 'uploads/stored_photo.jpg',
      mimeType: 'image/jpeg',
      fileSize: 2048,
      uploadedAt: new Date().toISOString(),
      verificationStatus: 'Verified',
      verifiedBy: { _id: 'rev-1', fullName: 'Dr. Reviewer', email: 'reviewer@iem.edu' },
      verifiedAt: new Date().toISOString()
    }
  ];

  beforeEach(async () => {
    mockDocumentService = {
      getReviewQueue: vi.fn(() =>
        of({
          success: true,
          message: 'Queue retrieved',
          data: mockDocuments,
          meta: { total: 2, page: 1, limit: 50, pages: 1 }
        })
      ),
      verifyDocument: vi.fn(() =>
        of({
          success: true,
          message: 'Document verified',
          data: { ...mockDocuments[0], verificationStatus: 'Verified' }
        })
      ),
      getVerificationHistory: vi.fn(() =>
        of({
          success: true,
          message: 'History retrieved',
          data: []
        })
      ),
      viewDocument: vi.fn(() => of(new Blob())),
      downloadDocument: vi.fn(() => of(new Blob())),
      openBlobInNewTab: vi.fn(),
      triggerBlobDownload: vi.fn()
    };

    mockAuthService = {
      currentUserValue: {
        _id: 'rev-1',
        fullName: 'Dr. Reviewer',
        email: 'reviewer@iem.edu',
        role: 'reviewer'
      }
    };

    await TestBed.configureTestingModule({
      imports: [ReviewerDashboardComponent],
      providers: [
        { provide: DocumentService, useValue: mockDocumentService },
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ReviewerDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates component and loads review queue on init', () => {
    expect(component).toBeTruthy();
    expect(mockDocumentService.getReviewQueue).toHaveBeenCalled();
    expect(component.documents.length).toBe(2);
    expect(component.counts.pending).toBe(1);
    expect(component.counts.verified).toBe(1);
  });

  it('filters queue by verification status', () => {
    component.setStatusFilter('Pending');
    expect(component.selectedStatus).toBe('Pending');
    expect(mockDocumentService.getReviewQueue).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Pending' })
    );
  });

  it('opens approval modal and submits document verification', () => {
    component.openApproveModal(mockDocuments[0]);
    expect(component.showApproveModal).toBe(true);
    expect(component.activeDoc).toEqual(mockDocuments[0]);

    component.verificationRemarks = 'Verified against council records';
    component.submitApproval();

    expect(mockDocumentService.verifyDocument).toHaveBeenCalledWith(
      'doc-1',
      'Verified',
      'Verified against council records'
    );
    expect(component.showApproveModal).toBe(false);
  });

  it('validates mandatory remarks when rejecting a document', () => {
    component.openRejectModal(mockDocuments[0]);
    expect(component.showRejectModal).toBe(true);

    component.verificationRemarks = '   ';
    component.submitRejection();

    expect(mockDocumentService.verifyDocument).not.toHaveBeenCalled();
    expect(component.modalError).toMatch(/mandatory/i);

    // Provide valid remarks
    component.verificationRemarks = 'Photo is blurred, please upload clear image';
    component.submitRejection();

    expect(mockDocumentService.verifyDocument).toHaveBeenCalledWith(
      'doc-1',
      'Rejected',
      'Photo is blurred, please upload clear image'
    );
    expect(component.showRejectModal).toBe(false);
  });

  it('handles queue loading error and allows retry', () => {
    mockDocumentService.getReviewQueue = vi.fn(() =>
      throwError(() => ({ error: { message: 'Network connection lost' } }))
    );

    component.loadQueue();
    expect(component.queueError).toBe('Network connection lost');
    expect(component.isLoading).toBe(false);
  });

  it('opens audit history modal and fetches history records', () => {
    component.openHistoryModal(mockDocuments[0]);
    expect(component.showHistoryModal).toBe(true);
    expect(mockDocumentService.getVerificationHistory).toHaveBeenCalledWith('doc-1');
  });
});
