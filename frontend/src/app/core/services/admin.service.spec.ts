import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminService } from './admin.service';

describe('AdminService — Stage 6 status workflow API', () => {
  let service: AdminService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(AdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should PATCH the administrator status endpoint with the selected status and remarks', () => {
    let responseBody: unknown;

    service
      .updateApplicationStatus('application-123', {
        status: 'Under Review',
        remarks: 'Documents verified.'
      })
      .subscribe(res => {
        responseBody = res;
      });

    const req = httpMock.expectOne(
      'http://localhost:5000/api/admin/applications/application-123/status'
    );

    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      status: 'Under Review',
      remarks: 'Documents verified.'
    });

    req.flush({
      success: true,
      message: "Application status updated from 'Submitted' to 'Under Review'.",
      data: {
        application: { _id: 'application-123', status: 'Under Review' },
        history: { previousStatus: 'Submitted', newStatus: 'Under Review' },
        previousStatus: 'Submitted',
        newStatus: 'Under Review',
        allowedNextStatuses: ['Selected', 'Rejected']
      }
    });

    expect(responseBody).toBeDefined();
  });
});
