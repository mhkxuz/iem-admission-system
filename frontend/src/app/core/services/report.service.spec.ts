import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReportService } from './report.service';

describe('ReportService', () => {
  let service: ReportService;
  let httpMock: HttpTestingController;
  const API_URL = 'http://localhost:5000/api/admin/reports';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ReportService]
    });
    service = TestBed.inject(ReportService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch overview analytics with query parameters', () => {
    const mockOverview = {
      success: true,
      message: 'Overview analytics retrieved successfully',
      data: {
        kpis: {
          totalApplications: 10,
          selectedApplications: 5,
          rejectedApplications: 2,
          submittedApplications: 3,
          underReviewApplications: 0,
          totalDocuments: 20,
          verifiedDocuments: 15,
          pendingDocuments: 3,
          rejectedDocuments: 2,
          confirmedEnrolments: 5,
          verifiedCollectedRevenue: 125000,
          completionRate: 50
        },
        monthlyTrends: []
      }
    };

    service.getOverview({ academicSession: '2026-2027' }).subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.data.kpis.totalApplications).toBe(10);
      expect(res.data.kpis.verifiedCollectedRevenue).toBe(125000);
    });

    const req = httpMock.expectOne(`${API_URL}/overview?academicSession=2026-2027`);
    expect(req.request.method).toBe('GET');
    req.flush(mockOverview);
  });

  it('should fetch application analytics', () => {
    const mockData = {
      success: true,
      message: 'Application analytics retrieved successfully',
      data: {
        total: 10,
        statusBreakdown: [{ _id: 'Selected', count: 5 }],
        programmeBreakdown: [],
        sessionBreakdown: [],
        categoryBreakdown: [],
        completionMetrics: { total: 10, completed: 5, pending: 5, completionRate: 50 },
        timelineTrends: []
      }
    };

    service.getApplicationAnalytics({ programmeId: 'prog_1' }).subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.data.total).toBe(10);
    });

    const req = httpMock.expectOne(`${API_URL}/applications?programmeId=prog_1`);
    expect(req.request.method).toBe('GET');
    req.flush(mockData);
  });

  it('should fetch document analytics', () => {
    const mockData = {
      success: true,
      message: 'Document analytics retrieved successfully',
      data: {
        totalDocuments: 10,
        verifiedCount: 8,
        pendingCount: 1,
        rejectedCount: 1,
        verificationRate: 80,
        documentTypeDistribution: [],
        reviewerWorkloads: [],
        outstandingRequirements: { pendingApplicationsCount: 1, unverifiedDocumentsCount: 2 }
      }
    };

    service.getDocumentAnalytics().subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.data.verificationRate).toBe(80);
    });

    const req = httpMock.expectOne(`${API_URL}/documents`);
    expect(req.request.method).toBe('GET');
    req.flush(mockData);
  });

  it('should fetch merit analytics', () => {
    const mockData = {
      success: true,
      message: 'Merit analytics retrieved successfully',
      data: {
        totalMeritLists: 2,
        totalCandidatesScreened: 20,
        totalAllocations: 10,
        totalConfirmedAllocations: 5,
        totalWaitlistedAllocations: 2,
        totalCancelledAllocations: 1,
        cutoffSummaries: [],
        programmeSeatUtilization: []
      }
    };

    service.getMeritAnalytics().subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.data.totalMeritLists).toBe(2);
    });

    const req = httpMock.expectOne(`${API_URL}/merit`);
    expect(req.request.method).toBe('GET');
    req.flush(mockData);
  });

  it('should fetch payment analytics', () => {
    const mockData = {
      success: true,
      message: 'Payment analytics retrieved successfully',
      data: {
        confirmedEnrolments: 5,
        verifiedCollectedRevenue: 125000,
        paymentStatusBreakdown: [],
        programmeCollections: [],
        categoryEnrolments: [],
        dailyRevenueTrends: [],
        reconciliationSummary: {
          totalTransactions: 6,
          successfulTransactions: 5,
          failedTransactions: 1,
          pendingTransactions: 0,
          reconciliationMatchRate: 83.33
        }
      }
    };

    service.getPaymentAnalytics().subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.data.verifiedCollectedRevenue).toBe(125000);
    });

    const req = httpMock.expectOne(`${API_URL}/payments`);
    expect(req.request.method).toBe('GET');
    req.flush(mockData);
  });

  it('should request CSV export blob', () => {
    const mockBlob = new Blob(['col1,col2\nval1,val2'], { type: 'text/csv' });

    service.exportReport('applications', 'csv', { academicSession: '2026-2027' }).subscribe((blob) => {
      expect(blob).toBeTruthy();
      expect(blob.type).toBe('text/csv');
    });

    const req = httpMock.expectOne(`${API_URL}/export/applications?academicSession=2026-2027&format=csv`);
    expect(req.request.method).toBe('GET');
    req.flush(mockBlob);
  });

  it('should request PDF export blob', () => {
    const mockBlob = new Blob(['%PDF-1.4 test'], { type: 'application/pdf' });

    service.exportReport('enrolments', 'pdf').subscribe((blob) => {
      expect(blob).toBeTruthy();
      expect(blob.type).toBe('application/pdf');
    });

    const req = httpMock.expectOne(`${API_URL}/export/enrolments?format=pdf`);
    expect(req.request.method).toBe('GET');
    req.flush(mockBlob);
  });
});
