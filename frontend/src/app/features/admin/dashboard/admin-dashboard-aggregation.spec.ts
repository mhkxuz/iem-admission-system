import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { AdminDashboardData, AdminService } from '../../../core/services/admin.service';
import { DocumentService } from '../../../core/services/document.service';

const sampleDashboard: AdminDashboardData = {
  metrics: {
    totalApplications: 6,
    submitted: 2,
    underReview: 2,
    selected: 1,
    rejected: 1
  },
  statusDistribution: [
    { status: 'Submitted', count: 2 },
    { status: 'Under Review', count: 2 },
    { status: 'Selected', count: 1 },
    { status: 'Rejected', count: 1 }
  ],
  departmentDistribution: [
    { department: 'Computer Science & Engineering', count: 3 },
    { department: 'Information Technology', count: 2 },
    { department: 'Mechanical Engineering', count: 1 }
  ],
  categoryDistribution: [
    { category: 'General', count: 3 },
    { category: 'Management', count: 1 },
    { category: 'OBC', count: 1 },
    { category: 'SC', count: 1 }
  ],
  recentApplications: []
};

const emptyDashboard: AdminDashboardData = {
  metrics: {
    totalApplications: 0,
    submitted: 0,
    underReview: 0,
    selected: 0,
    rejected: 0
  },
  statusDistribution: [
    { status: 'Submitted', count: 0 },
    { status: 'Under Review', count: 0 },
    { status: 'Selected', count: 0 },
    { status: 'Rejected', count: 0 }
  ],
  departmentDistribution: [],
  categoryDistribution: [],
  recentApplications: []
};

describe('AdminDashboardComponent — Stage 7 aggregation statistics', () => {
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
      getDashboard: vi.fn(() => of(successResponse(sampleDashboard))),
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

  function successResponse(data: AdminDashboardData) {
    return {
      success: true,
      message: 'Admin dashboard metrics retrieved.',
      data
    };
  }

  function createComponent(dashboard$: Observable<unknown>): void {
    adminServiceMock.getDashboard.mockReturnValue(dashboard$);
    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function barTexts(cardIndex: number): string[] {
    const cards = fixture.nativeElement.querySelectorAll(
      '.distribution-card'
    ) as NodeListOf<HTMLElement>;
    return Array.from(cards[cardIndex].querySelectorAll('.bar-row')).map(row => {
      const label = row.querySelector('.bar-label')?.textContent?.trim() || '';
      const value = row.querySelector('.bar-value')?.textContent?.trim() || '';
      return `${label} ${value}`;
    });
  }

  it('should render total, status, department and category aggregation results', () => {
    createComponent(of(successResponse(sampleDashboard)));

    const metricNumbers = Array.from(
      fixture.nativeElement.querySelectorAll('.metric-number') as NodeListOf<HTMLElement>
    ).map(element => element.textContent?.trim());

    expect(metricNumbers).toEqual(['6', '2', '2', '1', '1']);

    const cards = fixture.nativeElement.querySelectorAll(
      '.distribution-card'
    ) as NodeListOf<HTMLElement>;
    expect(cards.length).toBe(3);

    expect(barTexts(0)).toEqual([
      'Submitted 2',
      'Under Review 2',
      'Selected 1',
      'Rejected 1'
    ]);

    expect(barTexts(1)).toEqual([
      'Computer Science & Engineering 3',
      'Information Technology 2',
      'Mechanical Engineering 1'
    ]);

    expect(barTexts(2)).toEqual([
      'General 3',
      'Management 1',
      'OBC 1',
      'SC 1'
    ]);
  });

  it('should show a loading state until dashboard statistics resolve', async () => {
    const dashboardSubject = new Subject<ReturnType<typeof successResponse>>();
    createComponent(dashboardSubject.asObservable());

    expect(fixture.nativeElement.querySelector('.stats-loading')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.distribution-grid')).toBeNull();

    dashboardSubject.next(successResponse(sampleDashboard));
    dashboardSubject.complete();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.stats-loading')).toBeNull();
    expect(fixture.nativeElement.querySelector('.distribution-grid')).toBeTruthy();
  });

  it('should show an empty state when no applications exist', () => {
    createComponent(of(successResponse(emptyDashboard)));

    expect(fixture.nativeElement.querySelector('.stats-empty')?.textContent).toContain(
      'No applications have been submitted yet'
    );
    expect(fixture.nativeElement.querySelector('.distribution-grid')).toBeNull();
  });

  it('should show an error state and retry the dashboard request', () => {
    createComponent(
      throwError(() => ({ error: { message: 'Aggregation failed.' } }))
    );

    expect(fixture.nativeElement.querySelector('.stats-error')?.textContent).toContain(
      'Aggregation failed.'
    );

    adminServiceMock.getDashboard.mockReturnValue(of(successResponse(sampleDashboard)));
    fixture.nativeElement.querySelector('.btn-retry').click();
    fixture.detectChanges();

    expect(adminServiceMock.getDashboard).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('.stats-error')).toBeNull();
    expect(fixture.nativeElement.querySelector('.distribution-grid')).toBeTruthy();
    expect(component.metrics.totalApplications).toBe(6);
  });
});
