import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { AdminService } from '../../../core/services/admin.service';
import { DocumentService } from '../../../core/services/document.service';
import { MeritService } from '../../../core/services/merit.service';
import { PaymentService } from '../../../core/services/payment.service';
import { ReportService } from '../../../core/services/report.service';
import { AdmissionApplication, StatusHistoryEntry } from '../../../core/models/application.model';

function makeApplication(overrides: Partial<AdmissionApplication> = {}): AdmissionApplication {
  return {
    _id: 'application-1',
    applicationId: 'IEM-2026-10001',
    academicSession: '2026-2027',
    personalInfo: {
      fullName: 'Stage Six Candidate',
      dob: '2005-01-01',
      gender: 'Male',
      email: 'stage6@example.com',
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
      entranceExamName: 'WBJEE',
      entranceExamScore: 'Rank 1200'
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

const initialHistory: StatusHistoryEntry = {
  _id: 'history-1',
  previousStatus: 'Submitted',
  newStatus: 'Submitted',
  changedBy: {
    _id: 'applicant-1',
    fullName: 'Stage Six Candidate',
    role: 'applicant'
  },
  remarks: 'Application submitted by candidate',
  timestamp: '2026-03-01T10:00:00.000Z'
};

describe('AdminDashboardComponent — Stage 6 status workflow UI', () => {
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
  };

  beforeEach(async () => {
    adminServiceMock = {
      getDashboard: vi.fn(() =>
        of({
          success: true,
          message: 'Dashboard loaded.',
          data: {
            metrics: {
              totalApplications: 1,
              submitted: 1,
              underReview: 0,
              selected: 0,
              rejected: 0
            },
            recentApplications: []
          }
        })
      ),
      getApplications: vi.fn(() =>
        of({
          success: true,
          message: 'Applications loaded.',
          data: [],
          meta: {
            totalRecords: 0,
            page: 1,
            limit: 10,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false
          }
        })
      ),
      getApplicationById: vi.fn(() =>
        of({
          success: true,
          message: 'Application details loaded.',
          data: makeApplication()
        })
      ),
      updateApplicationStatus: vi.fn()
    };

    documentServiceMock = {
      viewDocument: vi.fn(() => of(new Blob())),
      downloadDocument: vi.fn(() => of(new Blob()))
    };

    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, AdminDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AdminService, useValue: adminServiceMock },
        { provide: DocumentService, useValue: documentServiceMock },
        {
          provide: MeritService,
          useValue: {
            getConfiguration: vi.fn(() => of({ success: true, data: {} })),
            getMeritLists: vi.fn(() => of({ success: true, data: [] })),
            getSeatAllocations: vi.fn(() => of({ success: true, data: [] }))
          }
        },
        {
          provide: PaymentService,
          useValue: {
            getAllEnrolments: vi.fn(() => of({ success: true, data: { enrolments: [], total: 0 } })),
            getAllPayments: vi.fn(() => of({ success: true, data: { payments: [], total: 0 } })),
            getStatistics: vi.fn(() => of({ success: true, data: { totalEnrolled: 0, totalFeesCollected: 0 } }))
          }
        },
        {
          provide: ReportService,
          useValue: {
            getOverview: vi.fn(() => of({ success: true, data: { kpis: {}, monthlyTrends: [] } })),
            getApplicationAnalytics: vi.fn(() => of({ success: true, data: {} })),
            getDocumentAnalytics: vi.fn(() => of({ success: true, data: {} })),
            getMeritAnalytics: vi.fn(() => of({ success: true, data: {} })),
            getPaymentAnalytics: vi.fn(() => of({ success: true, data: {} })),
            exportReport: vi.fn(() => of(new Blob())),
            triggerDownload: vi.fn()
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should display only permitted next statuses for a Submitted application', () => {
    component.inspectedApp = makeApplication({
      status: 'Submitted',
      allowedNextStatuses: ['Under Review']
    });
    fixture.detectChanges();

    const optionLabels = Array.from(
      fixture.nativeElement.querySelectorAll('.status-option') as NodeListOf<Element>
    ).map((option: Element) => option.textContent?.trim());

    expect(optionLabels).toEqual(['Under Review']);
    expect(optionLabels).not.toContain('Selected');
    expect(optionLabels).not.toContain('Rejected');
  });

  it('should display Selected and Rejected as the only next options for Under Review', () => {
    component.inspectedApp = makeApplication({
      status: 'Under Review',
      allowedNextStatuses: ['Selected', 'Rejected']
    });
    fixture.detectChanges();

    const optionLabels = Array.from(
      fixture.nativeElement.querySelectorAll('.status-option') as NodeListOf<Element>
    ).map((option: Element) => option.textContent?.trim());

    expect(optionLabels).toEqual(['Selected', 'Rejected']);
  });

  it('should bind the clicked radio option to the requested status', () => {
    component.inspectedApp = makeApplication({
      status: 'Submitted',
      allowedNextStatuses: ['Under Review']
    });
    fixture.detectChanges();

    const radio = fixture.nativeElement.querySelector(
      '.status-option input'
    ) as HTMLInputElement;

    radio.click();
    fixture.detectChanges();

    expect(component.selectedNextStatus).toBe('Under Review');
  });

  it('should send the selected transition and update the displayed status and history on success', () => {
    component.inspectedApp = makeApplication({
      status: 'Submitted',
      allowedNextStatuses: ['Under Review'],
      statusHistory: [initialHistory]
    });
    component.selectedNextStatus = 'Under Review';
    component.statusRemarks = 'Documents verified.';

    adminServiceMock.updateApplicationStatus.mockReturnValue(
      of({
        success: true,
        message: "Application status updated from 'Submitted' to 'Under Review'.",
        data: {
          application: makeApplication({ status: 'Under Review' }),
          history: {
            _id: 'history-2',
            previousStatus: 'Submitted',
            newStatus: 'Under Review',
            changedBy: {
              _id: 'admin-1',
              fullName: 'Admissions Administrator',
              role: 'admin'
            },
            remarks: 'Documents verified.',
            timestamp: '2026-03-02T10:00:00.000Z'
          },
          previousStatus: 'Submitted',
          newStatus: 'Under Review',
          allowedNextStatuses: ['Selected', 'Rejected']
        }
      })
    );

    component.updateStatus();
    fixture.detectChanges();

    expect(adminServiceMock.updateApplicationStatus).toHaveBeenCalledWith('application-1', {
      status: 'Under Review',
      remarks: 'Documents verified.'
    });
    expect(component.inspectedApp?.status).toBe('Under Review');
    expect(component.inspectedApp?.statusHistory?.length).toBe(2);
    expect(component.inspectedApp?.statusHistory?.[1].newStatus).toBe('Under Review');
    expect(component.allowedNextStatuses).toEqual(['Selected', 'Rejected']);
    expect(component.statusUpdateSuccess).toContain('updated');
    expect(component.selectedNextStatus).toBe('');
    expect(component.statusRemarks).toBe('');
  });

  it('should show a meaningful error and preserve the status when an update fails', () => {
    component.inspectedApp = makeApplication({
      status: 'Submitted',
      allowedNextStatuses: ['Under Review'],
      statusHistory: [initialHistory]
    });
    component.selectedNextStatus = 'Under Review';

    adminServiceMock.updateApplicationStatus.mockReturnValue(
      throwError(() => ({
        error: {
          message:
            "Invalid status transition from 'Submitted' to 'Selected'. Allowed next status(es): Under Review."
        }
      }))
    );

    component.updateStatus();
    fixture.detectChanges();

    expect(component.inspectedApp?.status).toBe('Submitted');
    expect(component.inspectedApp?.statusHistory?.length).toBe(1);
    expect(component.statusUpdateError).toContain('Invalid status transition');
    expect(component.statusUpdateSuccess).toBe('');
    expect(component.isUpdatingStatus).toBe(false);
  });

  it('should show the terminal-state message and no controls for Selected or Rejected applications', () => {
    component.inspectedApp = makeApplication({
      status: 'Selected',
      allowedNextStatuses: []
    });
    fixture.detectChanges();

    const radios = fixture.nativeElement.querySelectorAll('.status-option input');
    expect(radios.length).toBe(0);
    expect(fixture.nativeElement.querySelector('.terminal-note')?.textContent).toContain(
      'terminal status'
    );
  });
});
