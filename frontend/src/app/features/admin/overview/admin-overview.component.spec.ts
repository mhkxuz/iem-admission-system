import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AdminOverviewComponent } from './admin-overview.component';
import { AdminService, AdminDashboardData } from '../../../core/services/admin.service';

const mockDashboardData: AdminDashboardData = {
  metrics: {
    totalApplications: 25,
    submitted: 10,
    underReview: 8,
    selected: 5,
    rejected: 2
  },
  statusDistribution: [],
  departmentDistribution: [],
  categoryDistribution: [],
  recentApplications: [],
  academicOverview: {
    totalProgrammes: 6,
    activeProgrammes: 5,
    programmesAcceptingApplications: 4,
    totalSessions: 3,
    activeSession: '2026-2027',
    activeSessionDetails: {
      sessionName: '2026-2027',
      sessionCode: 'AY2026-27',
      status: 'Active'
    },
    configuredFeeStructures: 5,
    programmesMissingFee: 0
  }
};

describe('AdminOverviewComponent', () => {
  let fixture: ComponentFixture<AdminOverviewComponent>;
  let component: AdminOverviewComponent;
  let adminServiceMock: {
    getDashboard: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    adminServiceMock = {
      getDashboard: vi.fn(() =>
        of({
          success: true,
          message: 'Metrics loaded.',
          data: mockDashboardData
        })
      )
    };

    await TestBed.configureTestingModule({
      imports: [AdminOverviewComponent],
      providers: [{ provide: AdminService, useValue: adminServiceMock }]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize and load institutional overview metrics', () => {
    expect(component).toBeTruthy();
    expect(component.isLoading).toBe(false);
    expect(component.overview?.activeSession).toBe('2026-2027');
    expect(component.overview?.totalProgrammes).toBe(6);
    expect(component.overview?.configuredFeeStructures).toBe(5);

    const el = fixture.nativeElement;
    expect(el.textContent).toContain('2026-2027');
    expect(el.textContent).toContain('6 Total');
    expect(el.textContent).toContain('5 Configured');
  });

  it('should emit navigateToTab when action buttons are clicked', () => {
    const emitSpy = vi.spyOn(component.navigateToTab, 'emit');
    const manageProgBtn = fixture.nativeElement.querySelector('.programme-card .btn-card-action');
    expect(manageProgBtn).toBeTruthy();
    manageProgBtn.click();

    expect(emitSpy).toHaveBeenCalledWith('programmes');
  });

  it('should handle error state and allow retry', () => {
    adminServiceMock.getDashboard.mockReturnValue(
      throwError(() => ({ error: { message: 'Network error occurred.' } }))
    );

    component.loadOverview();
    fixture.detectChanges();

    expect(component.isLoading).toBe(false);
    expect(component.errorMessage).toContain('Network error');
    expect(fixture.nativeElement.querySelector('.alert-box.error')?.textContent).toContain('Network error');
  });
});
