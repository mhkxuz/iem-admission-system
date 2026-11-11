import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminReportsComponent } from './admin-reports.component';
import { ReportService } from '../../../core/services/report.service';
import { AdminService } from '../../../core/services/admin.service';

describe('AdminReportsComponent', () => {
  let component: AdminReportsComponent;
  let fixture: ComponentFixture<AdminReportsComponent>;
  let mockReportService: any;
  let mockAdminService: any;

  beforeEach(async () => {
    mockReportService = {
      getOverview: vi.fn(() =>
        of({
          success: true,
          data: {
            kpis: {
              totalApplications: 12,
              selectedApplications: 6,
              rejectedApplications: 2,
              submittedApplications: 4,
              underReviewApplications: 0,
              totalDocuments: 24,
              verifiedDocuments: 18,
              pendingDocuments: 4,
              rejectedDocuments: 2,
              confirmedEnrolments: 5,
              verifiedCollectedRevenue: 125000,
              completionRate: 67
            },
            monthlyTrends: [{ month: '2026-11', applications: 12, revenue: 125000 }]
          }
        })
      ),
      getApplicationAnalytics: vi.fn(() =>
        of({
          success: true,
          data: {
            total: 12,
            statusBreakdown: [{ _id: 'Selected', count: 6 }, { _id: 'Submitted', count: 4 }],
            programmeBreakdown: [{ _id: 'p1', programmeCode: 'BTECH-CSE', programmeName: 'B.Tech CSE', count: 12 }],
            sessionBreakdown: [{ _id: '2026-2027', count: 12 }],
            categoryBreakdown: [{ _id: 'General', count: 10 }, { _id: 'SC', count: 2 }],
            completionMetrics: { total: 12, completed: 8, pending: 4, completionRate: 67 },
            timelineTrends: [{ date: '2026-11-10', count: 12 }]
          }
        })
      ),
      getDocumentAnalytics: vi.fn(() =>
        of({
          success: true,
          data: {
            totalDocuments: 24,
            verifiedCount: 18,
            pendingCount: 4,
            rejectedCount: 2,
            verificationRate: 75,
            documentTypeDistribution: [{ _id: 'Class 10 Marksheet', total: 12, verified: 9, pending: 2, rejected: 1 }],
            reviewerWorkloads: [{ reviewerId: 'r1', name: 'Reviewer Test', email: 'rev@iem.edu', totalVerified: 18 }],
            outstandingRequirements: { pendingApplicationsCount: 4, unverifiedDocumentsCount: 6 }
          }
        })
      ),
      getMeritAnalytics: vi.fn(() =>
        of({
          success: true,
          data: {
            totalMeritLists: 2,
            totalCandidatesScreened: 24,
            totalAllocations: 10,
            totalConfirmedAllocations: 5,
            totalWaitlistedAllocations: 3,
            totalCancelledAllocations: 2,
            cutoffSummaries: [{
              programmeCode: 'BTECH-CSE',
              programmeName: 'B.Tech CSE',
              academicSession: '2026-2027',
              roundNumber: 1,
              status: 'Published',
              cutoffs: [{ category: 'General', minimumScore: 85 }]
            }],
            programmeSeatUtilization: [{
              programmeId: 'p1',
              programmeCode: 'BTECH-CSE',
              programmeName: 'B.Tech CSE',
              totalCapacity: 60,
              allocatedSeats: 10,
              confirmedSeats: 5,
              waitlistedSeats: 3,
              vacantSeats: 50,
              utilizationPercentage: 17,
              categoryBreakdown: []
            }]
          }
        })
      ),
      getPaymentAnalytics: vi.fn(() =>
        of({
          success: true,
          data: {
            confirmedEnrolments: 5,
            verifiedCollectedRevenue: 125000,
            paymentStatusBreakdown: [{ _id: 'Successful', count: 5, totalAmount: 125000 }],
            programmeCollections: [{
              programmeCode: 'BTECH-CSE',
              programmeName: 'B.Tech CSE',
              feeCollected: 125000,
              enrolledCount: 5
            }],
            categoryEnrolments: [{ category: 'General', count: 5, feeCollected: 125000 }],
            dailyRevenueTrends: [],
            reconciliationSummary: {
              totalTransactions: 6,
              successfulTransactions: 5,
              failedTransactions: 1,
              pendingTransactions: 0,
              reconciliationMatchRate: 83.33
            }
          }
        })
      ),
      exportReport: vi.fn(() => of(new Blob(['test-data'], { type: 'text/csv' }))),
      triggerDownload: vi.fn()
    };

    mockAdminService = {
      getSessions: vi.fn(() => of({ success: true, data: [{ sessionName: '2026-2027', status: 'Active' }] })),
      getProgrammes: vi.fn(() => of({ success: true, data: [{ _id: 'p1', programmeCode: 'BTECH-CSE', programmeName: 'B.Tech CSE' }] }))
    };

    await TestBed.configureTestingModule({
      imports: [AdminReportsComponent],
      providers: [
        { provide: ReportService, useValue: mockReportService },
        { provide: AdminService, useValue: mockAdminService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load overview KPIs on init', () => {
    expect(component).toBeTruthy();
    expect(mockReportService.getOverview).toHaveBeenCalled();
    expect(component.overviewData?.kpis.totalApplications).toBe(12);
    expect(component.overviewData?.kpis.verifiedCollectedRevenue).toBe(125000);
    expect(component.docVerificationRate).toBe(75);
  });

  it('should switch sub-tabs and load corresponding analytics', () => {
    component.setSubTab('applications');
    expect(component.activeSubTab).toBe('applications');
    expect(mockReportService.getApplicationAnalytics).toHaveBeenCalled();
    expect(component.applicationData?.total).toBe(12);

    component.setSubTab('documents');
    expect(component.activeSubTab).toBe('documents');
    expect(mockReportService.getDocumentAnalytics).toHaveBeenCalled();
    expect(component.documentData?.verificationRate).toBe(75);

    component.setSubTab('merit');
    expect(component.activeSubTab).toBe('merit');
    expect(mockReportService.getMeritAnalytics).toHaveBeenCalled();
    expect(component.meritData?.totalAllocations).toBe(10);

    component.setSubTab('financials');
    expect(component.activeSubTab).toBe('financials');
    expect(mockReportService.getPaymentAnalytics).toHaveBeenCalled();
    expect(component.paymentData?.verifiedCollectedRevenue).toBe(125000);
  });

  it('should apply and reset unified multi-dimensional filters', () => {
    component.filters.academicSession = '2026-2027';
    component.filters.category = 'General';
    component.applyFilters();
    expect(mockReportService.getOverview).toHaveBeenCalledWith(
      expect.objectContaining({ academicSession: '2026-2027', category: 'General' })
    );

    component.resetFilters();
    expect(component.filters.academicSession).toBe('');
    expect(component.filters.category).toBe('');
  });

  it('should trigger CSV and PDF report exports and invoke triggerDownload', () => {
    component.exportData('applications', 'csv');
    expect(mockReportService.exportReport).toHaveBeenCalledWith('applications', 'csv', expect.any(Object));
    expect(mockReportService.triggerDownload).toHaveBeenCalled();
    expect(component.successMessage).toContain('iem-applications-report-');

    component.exportData('enrolments', 'pdf');
    expect(mockReportService.exportReport).toHaveBeenCalledWith('enrolments', 'pdf', expect.any(Object));
    expect(mockReportService.triggerDownload).toHaveBeenCalledTimes(2);
  });
});
