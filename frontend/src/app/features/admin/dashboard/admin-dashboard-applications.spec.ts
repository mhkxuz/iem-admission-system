import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { AdminDashboardData, AdminService } from '../../../core/services/admin.service';
import { DocumentService } from '../../../core/services/document.service';
import { AdmissionApplication } from '../../../core/models/application.model';

const emptyDashboard: AdminDashboardData = {
  metrics: {
    totalApplications: 0,
    submitted: 0,
    underReview: 0,
    selected: 0,
    rejected: 0
  },
  statusDistribution: [],
  departmentDistribution: [],
  categoryDistribution: [],
  recentApplications: []
};

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
  submittedAt: '2026-05-01T10:00:00.000Z'
};

describe('AdminDashboardComponent — application listing states', () => {
  let fixture: ComponentFixture<AdminDashboardComponent>;
  let component: AdminDashboardComponent;
  let adminServiceMock: {
    getDashboard: ReturnType<typeof vi.fn>;
    getApplications: ReturnType<typeof vi.fn>;
    getApplicationById: ReturnType<typeof vi.fn>;
    updateApplicationStatus: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    adminServiceMock = {
      getDashboard: vi.fn(() =>
        of({ success: true, message: 'Dashboard loaded.', data: emptyDashboard })
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
      getApplicationById: vi.fn(),
      updateApplicationStatus: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AdminService, useValue: adminServiceMock },
        {
          provide: DocumentService,
          useValue: { viewDocument: vi.fn(), downloadDocument: vi.fn() }
        }
      ]
    }).compileComponents();
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function successList(data: AdmissionApplication[], totalRecords = data.length) {
    return of({
      success: true,
      message: 'Applications loaded.',
      data,
      meta: {
        totalRecords,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false
      }
    });
  }

  it('should show the empty state and hide the loading spinner when no applications match', () => {
    adminServiceMock.getApplications.mockReturnValue(successList([]));
    createComponent();

    expect(component.isLoadingApps).toBe(false);
    expect(fixture.nativeElement.querySelector('.table-loading')).toBeNull();
    expect(fixture.nativeElement.querySelector('.table-error')).toBeNull();
    expect(fixture.nativeElement.querySelector('.table-responsive')).toBeNull();
    expect(fixture.nativeElement.querySelector('.table-empty')?.textContent).toContain(
      'No applications match the current search and filter criteria.'
    );
  });

  it('should render application rows returned by the API and hide the loading spinner', () => {
    adminServiceMock.getApplications.mockReturnValue(successList([sampleApplication]));

    createComponent();

    expect(component.isLoadingApps).toBe(false);
    expect(fixture.nativeElement.querySelector('.table-loading')).toBeNull();
    expect(fixture.nativeElement.querySelector('.table-empty')).toBeNull();
    expect(fixture.nativeElement.querySelector('.table-error')).toBeNull();

    const table = fixture.nativeElement.querySelector('.table-responsive');
    expect(table).toBeTruthy();

    const rows = fixture.nativeElement.querySelectorAll('.admin-table tbody tr');
    expect(rows.length).toBe(1);

    const meta = fixture.nativeElement.querySelector('.table-meta-info')?.textContent;
    expect(meta).toContain('Showing 1 - 1 of 1 applications');

    const rowText = rows[0].textContent;
    expect(rowText).toContain('IEM-2026-ABCDE');
    expect(rowText).toContain('Stage Eight Applicant');
    expect(rowText).toContain('stage8@example.com');
    expect(rowText).toContain('Information Technology');
    expect(rowText).toContain('General');
    expect(rowText).toContain('93.2%');
    expect(rowText).toContain('Submitted');
    expect(rows[0].querySelector('.btn-inspect')).toBeTruthy();
  });

  it('should handle asynchronous application loading and render the row when data arrives', async () => {
    const appsSubject = new Subject<any>();
    adminServiceMock.getApplications.mockReturnValue(appsSubject.asObservable());

    createComponent();

    // While request is in-flight, loading spinner must be visible
    expect(component.isLoadingApps).toBe(true);
    expect(fixture.nativeElement.querySelector('.table-loading')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.table-responsive')).toBeNull();

    // Deliver response asynchronously
    appsSubject.next({
      success: true,
      message: 'Applications loaded.',
      data: [sampleApplication],
      meta: {
        totalRecords: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false
      }
    });
    appsSubject.complete();
    fixture.detectChanges();

    expect(component.isLoadingApps).toBe(false);
    expect(fixture.nativeElement.querySelector('.table-loading')).toBeNull();
    expect(fixture.nativeElement.querySelector('.table-responsive')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.admin-table tbody tr')).toBeTruthy();
  });

  it('should support nested applications payload in data property', () => {
    adminServiceMock.getApplications.mockReturnValue(
      of({
        success: true,
        message: 'Applications loaded.',
        data: {
          applications: [sampleApplication],
          pagination: {
            totalRecords: 1,
            page: 1,
            limit: 10,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false
          }
        }
      } as any)
    );

    createComponent();

    expect(component.isLoadingApps).toBe(false);
    expect(component.applications.length).toBe(1);
    expect(fixture.nativeElement.querySelector('.table-loading')).toBeNull();
    expect(fixture.nativeElement.querySelector('.table-responsive')?.textContent).toContain(
      'IEM-2026-ABCDE'
    );
  });

  it('should show an application-list error and allow a successful retry', () => {
    adminServiceMock.getApplications.mockReturnValueOnce(
      throwError(() => ({ error: { message: 'Application query failed.' } }))
    );

    createComponent();

    expect(component.isLoadingApps).toBe(false);
    expect(component.applicationsError).toBe('Application query failed.');
    expect(fixture.nativeElement.querySelector('.table-loading')).toBeNull();
    expect(fixture.nativeElement.querySelector('.table-error')?.textContent).toContain(
      'Application query failed.'
    );
    expect(fixture.nativeElement.querySelector('.table-empty')).toBeNull();
    expect(fixture.nativeElement.querySelector('.table-responsive')).toBeNull();

    adminServiceMock.getApplications.mockReturnValue(successList([sampleApplication]));
    fixture.nativeElement.querySelector('.table-error .btn-retry').click();
    fixture.detectChanges();

    expect(adminServiceMock.getApplications).toHaveBeenCalledTimes(2);
    expect(component.isLoadingApps).toBe(false);
    expect(component.applicationsError).toBe('');
    expect(fixture.nativeElement.querySelector('.table-loading')).toBeNull();
    expect(fixture.nativeElement.querySelector('.table-error')).toBeNull();
    expect(fixture.nativeElement.querySelector('.table-responsive')?.textContent).toContain(
      'IEM-2026-ABCDE'
    );
  });

  it('should fall back to a generic message when the API returns no message', () => {
    adminServiceMock.getApplications.mockReturnValueOnce(throwError(() => ({})));

    createComponent();

    expect(component.applicationsError).toBe(
      'Unable to load applications. Please try again.'
    );
  });

  it('should reset pagination and request filtered results when a filter changes', () => {
    createComponent();
    adminServiceMock.getApplications.mockClear();

    component.currentPage = 3;
    component.selectedStatus = 'Under Review';
    component.onFilterChange();

    expect(component.currentPage).toBe(1);
    expect(adminServiceMock.getApplications).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Under Review',
        page: 1
      })
    );
  });

  it('should toggle the sort order and request sorted results', () => {
    createComponent();
    adminServiceMock.getApplications.mockClear();

    expect(component.sortOrder).toBe('desc');
    component.toggleSortOrder();

    expect(component.sortOrder).toBe('asc');
    expect(adminServiceMock.getApplications).toHaveBeenCalledWith(
      expect.objectContaining({
        sortBy: 'submittedAt',
        sortOrder: 'asc',
        page: 1
      })
    );
  });
});
