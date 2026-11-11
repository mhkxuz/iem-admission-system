import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ApplicantMeritListComponent } from './applicant-merit-list.component';
import { MeritService } from '../../../core/services/merit.service';
import { ApplicantPublishedMeritListResponse } from '../../../core/models/merit.model';

describe('ApplicantMeritListComponent', () => {
  let component: ApplicantMeritListComponent;
  let fixture: ComponentFixture<ApplicantMeritListComponent>;
  let mockMeritService: {
    getPublishedMeritList: ReturnType<typeof vi.fn>;
  };

  const samplePublishedResponse: ApplicantPublishedMeritListResponse = {
    hasPublishedList: true,
    programme: {
      _id: 'prog-1',
      programmeName: 'B.Tech in Computer Science & Engineering',
      programmeCode: 'BTECH-CSE',
      degree: 'B.Tech',
      department: 'Computer Science & Engineering'
    },
    academicSession: '2026-2027',
    version: 1,
    round: 1,
    roundLabel: 'Round 1',
    status: 'Published',
    publishedAt: '2026-05-15T12:00:00.000Z',
    cutoffs: {
      highestScore: 95.5,
      lowestShortlistedScore: 82.0,
      totalEligible: 2,
      totalIneligible: 0,
      totalPendingDocs: 0,
      categoryCutoffs: [
        {
          category: 'General',
          highestScore: 95.5,
          lowestScore: 82.0,
          totalApplicants: 2,
          eligibleApplicants: 2
        }
      ]
    },
    myEntry: {
      _id: 'entry-1',
      meritRank: 1,
      categoryRank: 1,
      candidateName: 'Rohan Sharma',
      applicationId: 'IEM-2026-00001',
      category: 'General',
      class12Percentage: 92.5,
      rawEntranceScore: 'Rank 1200',
      compositeScore: 95.5,
      eligibilityStatus: 'Eligible',
      allocationStatus: 'Allocated',
      allocatedCategory: 'General',
      seatNumber: 1,
      isSelf: true
    },
    entries: [
      {
        _id: 'entry-1',
        meritRank: 1,
        categoryRank: 1,
        candidateName: 'Rohan Sharma',
        applicationId: 'IEM-2026-00001',
        category: 'General',
        class12Percentage: 92.5,
        rawEntranceScore: 'Rank 1200',
        compositeScore: 95.5,
        eligibilityStatus: 'Eligible',
        allocationStatus: 'Allocated',
        allocatedCategory: 'General',
        seatNumber: 1,
        isSelf: true
      },
      {
        _id: 'entry-2',
        meritRank: 2,
        categoryRank: 2,
        candidateName: 'Priya Mukherjee',
        applicationId: 'IEM-2026-00***',
        category: 'General',
        compositeScore: 88.0,
        eligibilityStatus: 'Eligible',
        allocationStatus: 'Pending',
        allocatedCategory: null,
        isSelf: false
      }
    ]
  };

  beforeEach(async () => {
    mockMeritService = {
      getPublishedMeritList: vi.fn(() =>
        of({ success: true, message: 'Loaded', data: samplePublishedResponse })
      )
    };

    await TestBed.configureTestingModule({
      imports: [ApplicantMeritListComponent],
      providers: [
        provideRouter([]),
        { provide: MeritService, useValue: mockMeritService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ApplicantMeritListComponent);
    component = fixture.componentInstance;
  });

  it('should initialize component and load published merit list', () => {
    fixture.detectChanges();

    expect(mockMeritService.getPublishedMeritList).toHaveBeenCalled();
    expect(component.isLoading).toBe(false);
    expect(component.publishedData?.hasPublishedList).toBe(true);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.merit-header-card')).toBeTruthy();
    expect(compiled.textContent).toContain('B.Tech in Computer Science & Engineering');
    expect(compiled.textContent).toContain('Round 1 (Version #1)');
  });

  it('should highlight the logged-in applicant result prominently', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const myCard = compiled.querySelector('.my-result-card');
    expect(myCard).toBeTruthy();
    expect(myCard?.textContent).toContain('Your Official Merit Standing');
    expect(myCard?.textContent).toContain('Rohan Sharma');
    expect(myCard?.textContent).toContain('IEM-2026-00001');
    expect(myCard?.textContent).toContain('#1'); // Overall rank
  });

  it('should render candidate rankings with masked IDs for other candidates', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const rows = compiled.querySelectorAll('.merit-table tbody tr');
    expect(rows.length).toBe(2);

    // Self row should have YOU badge
    expect(rows[0].querySelector('.you-badge')).toBeTruthy();
    expect(rows[0].textContent).toContain('IEM-2026-00001');

    // Other candidate should have masked ID
    expect(rows[1].textContent).toContain('IEM-2026-00***');
    expect(rows[1].querySelector('.you-badge')).toBeFalsy();
  });

  it('should filter candidate list by search text and category', () => {
    fixture.detectChanges();

    // Search by name
    component.searchText = 'Priya';
    expect(component.filteredEntries.length).toBe(1);
    expect(component.filteredEntries[0].candidateName).toBe('Priya Mukherjee');

    // Reset search, filter category
    component.searchText = '';
    component.selectedCategory = 'OBC';
    expect(component.filteredEntries.length).toBe(0);

    component.selectedCategory = 'General';
    expect(component.filteredEntries.length).toBe(2);
  });

  it('should render empty state message when no merit list is published yet', () => {
    mockMeritService.getPublishedMeritList.mockReturnValue(
      of({
        success: true,
        message: 'No published list',
        data: {
          hasPublishedList: false,
          message: 'No merit list has been published for your programme and academic session yet.'
        }
      })
    );

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.merit-header-card')).toBeFalsy();
    const emptyCard = compiled.querySelector('.state-card.empty');
    expect(emptyCard).toBeTruthy();
    expect(emptyCard?.textContent).toContain('Merit List Not Published Yet');
  });

  it('should display error message and retry on API failure', () => {
    mockMeritService.getPublishedMeritList.mockReturnValue(
      throwError(() => ({ error: { message: 'Server communication error.' } }))
    );

    fixture.detectChanges();

    expect(component.isLoading).toBe(false);
    expect(component.errorMessage).toBe('Server communication error.');

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.alert-box.error')).toBeTruthy();
  });
});
