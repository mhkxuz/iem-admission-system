import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AdminMeritComponent } from './admin-merit.component';
import { MeritService } from '../../../core/services/merit.service';
import { AdminService } from '../../../core/services/admin.service';

describe('AdminMeritComponent', () => {
  let component: AdminMeritComponent;
  let fixture: ComponentFixture<AdminMeritComponent>;
  let mockMeritService: any;
  let mockAdminService: any;

  const mockProgrammes = [
    {
      _id: 'prog-1',
      programmeName: 'B.Tech in Computer Science & Engineering',
      programmeCode: 'BTECH-CSE'
    }
  ];

  const mockSessions = [
    {
      _id: 'sess-1',
      sessionName: '2026-2027',
      status: 'Active'
    }
  ];

  const mockMeritConfig = {
    class12Weightage: 60,
    entranceExamWeightage: 40,
    normalizationMethod: 'Rank-Based',
    maxEntranceRank: 50000,
    unfilledSeatRule: 'Keep Vacant',
    version: 1
  };

  const mockMeritList = {
    _id: 'list-1',
    status: 'Draft',
    entries: [
      {
        applicationId: 'IEM-2026-00001',
        candidateName: 'Rohan Sharma',
        category: 'General',
        compositeScore: 92.5,
        meritRank: 1,
        categoryRank: 1,
        eligibilityStatus: 'Eligible',
        eligibilityRemarks: ''
      }
    ],
    cutoffs: {
      highestScore: 92.5,
      lowestShortlistedScore: 92.5,
      totalEligible: 1,
      totalIneligible: 0,
      totalPendingDocs: 0,
      categoryCutoffs: [{ category: 'General', highestScore: 92.5, lowestScore: 92.5, eligibleApplicants: 1 }]
    }
  };

  const mockAllocation = {
    _id: 'alloc-1',
    status: 'Draft',
    totalSeats: 3,
    allocatedSeats: 1,
    remainingSeats: 2,
    unfilledSeatRule: 'Keep Vacant',
    categorySummary: [{ category: 'General', totalSeats: 1, allocatedSeats: 1, remainingSeats: 0 }],
    allocations: [
      {
        applicationId: 'IEM-2026-00001',
        candidateName: 'Rohan Sharma',
        meritRank: 1,
        appliedCategory: 'General',
        allocatedCategory: 'General',
        compositeScore: 92.5,
        allocationStatus: 'Allocated',
        allocationReason: 'Allocated under General Merit Quota',
        seatNumber: 1
      }
    ],
    history: [{ action: 'Generated', timestamp: new Date().toISOString(), remarks: 'Initial generation' }]
  };

  beforeEach(async () => {
    mockAdminService = {
      getProgrammes: vi.fn(() => of({ success: true, data: { programmes: mockProgrammes } })),
      getSessions: vi.fn(() => of({ success: true, data: mockSessions }))
    };

    mockMeritService = {
      getConfiguration: vi.fn(() => of({ success: true, data: mockMeritConfig })),
      saveConfiguration: vi.fn((payload) => of({ success: true, data: { ...payload, version: 2 } })),
      generateMeritList: vi.fn(() => of({ success: true, data: mockMeritList })),
      getMeritLists: vi.fn(() => of({ success: true, data: [mockMeritList] })),
      publishMeritList: vi.fn(() => of({ success: true, data: { ...mockMeritList, status: 'Published' } })),
      generateSeatAllocation: vi.fn(() => of({ success: true, data: mockAllocation })),
      getSeatAllocations: vi.fn(() => of({ success: true, data: [mockAllocation] })),
      approveSeatAllocation: vi.fn(() => of({ success: true, data: { ...mockAllocation, status: 'Approved' } })),
      publishSeatAllocation: vi.fn(() => of({ success: true, data: { ...mockAllocation, status: 'Published' } }))
    };

    await TestBed.configureTestingModule({
      imports: [AdminMeritComponent],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
        { provide: MeritService, useValue: mockMeritService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminMeritComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates component and loads programmes and sessions on init', () => {
    expect(component).toBeTruthy();
    expect(mockAdminService.getProgrammes).toHaveBeenCalled();
    expect(mockAdminService.getSessions).toHaveBeenCalled();
    expect(component.selectedProgrammeId).toBe('prog-1');
    expect(component.selectedSessionName).toBe('2026-2027');
    expect(mockMeritService.getConfiguration).toHaveBeenCalledWith('prog-1', '2026-2027');
  });

  it('validates 100% total weightage and saves configuration', () => {
    component.meritConfig.class12Weightage = 50;
    component.meritConfig.entranceExamWeightage = 50;
    expect(component.totalWeightage).toBe(100);

    component.saveConfiguration();
    expect(mockMeritService.saveConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({
        programmeId: 'prog-1',
        academicSession: '2026-2027',
        class12Weightage: 50,
        entranceExamWeightage: 50
      })
    );
    expect(component.successMessage).toMatch(/Version #2/i);
  });

  it('blocks saving configuration when total weightage does not equal 100', () => {
    component.meritConfig.class12Weightage = 60;
    component.meritConfig.entranceExamWeightage = 20; // 80% != 100%
    component.saveConfiguration();

    expect(mockMeritService.saveConfiguration).not.toHaveBeenCalled();
    expect(component.errorMessage).toMatch(/must sum to exactly 100%/i);
  });

  it('generates draft merit list', () => {
    component.generateMeritList();
    expect(mockMeritService.generateMeritList).toHaveBeenCalledWith('prog-1', '2026-2027');
    expect(component.currentMeritList?.status).toBe('Draft');
    expect(component.activeSubTab).toBe('merit-list');
  });

  it('publishes merit list with user confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.currentMeritList = mockMeritList as any;

    component.publishMeritList();
    expect(mockMeritService.publishMeritList).toHaveBeenCalledWith('list-1');
    expect(component.currentMeritList?.status).toBe('Published');
  });

  it('cancels merit list publication if confirmation dialog is rejected', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    component.currentMeritList = mockMeritList as any;

    component.publishMeritList();
    expect(mockMeritService.publishMeritList).not.toHaveBeenCalled();
    expect(component.currentMeritList?.status).toBe('Draft');
  });

  it('handles publication error gracefully with error message', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockMeritService.publishMeritList.mockReturnValue(
      throwError(() => ({ error: { message: 'Merit list has no eligible candidates.' } }))
    );
    component.currentMeritList = mockMeritList as any;

    component.publishMeritList();
    expect(component.errorMessage).toBe('Merit list has no eligible candidates.');
    expect(component.isPublishingList).toBe(false);
  });

  it('generates seat allocation', () => {
    component.currentMeritList = mockMeritList as any;
    component.generateSeatAllocation();

    expect(mockMeritService.generateSeatAllocation).toHaveBeenCalledWith({
      programmeId: 'prog-1',
      academicSession: '2026-2027',
      meritListId: 'list-1',
      unfilledSeatRule: 'Keep Vacant'
    });
    expect(component.currentAllocation?.status).toBe('Draft');
  });

  it('approves and publishes seat allocation with remarks', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Approved by council');
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.currentAllocation = mockAllocation as any;
    component.approveSeatAllocation();
    expect(mockMeritService.approveSeatAllocation).toHaveBeenCalledWith('alloc-1', 'Approved by council');

    component.currentAllocation = { ...(mockAllocation as any), status: 'Approved' };
    component.publishSeatAllocation();
    expect(mockMeritService.publishSeatAllocation).toHaveBeenCalledWith('alloc-1', 'Approved by council');
  });
});
