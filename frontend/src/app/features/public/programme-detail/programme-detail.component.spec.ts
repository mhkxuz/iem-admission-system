import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProgrammeDetailComponent } from './programme-detail.component';
import { PublicAdmissionService } from '../../../core/services/public-admission.service';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/user.model';
import { Programme } from '../../../core/models/programme.model';
import { FeeStructure } from '../../../core/models/fee.model';

describe('ProgrammeDetailComponent', () => {
  let fixture: ComponentFixture<ProgrammeDetailComponent>;
  let component: ProgrammeDetailComponent;
  let currentUser$: BehaviorSubject<User | null>;
  let admissionServiceMock: {
    getProgrammeById: ReturnType<typeof vi.fn>;
    getProgrammeByCode: ReturnType<typeof vi.fn>;
    getProgrammeFee: ReturnType<typeof vi.fn>;
  };

  const sampleProgramme: Programme = {
    _id: '673000111222333444555666',
    programmeName: 'B.Tech in Computer Science & Engineering',
    programmeCode: 'BTECH-CSE',
    degreeLevel: 'Undergraduate',
    department: 'Computer Science & Engineering',
    degree: 'B.Tech',
    duration: 4,
    durationUnit: 'years',
    isApplicationOpen: true,
    eligibility: {
      minClass12Percentage: 60,
      requiredClass12Subjects: ['Physics', 'Mathematics', 'Chemistry'],
      acceptedEntranceExams: ['WBJEE', 'JEE Main'],
      minEntranceScore: 'Rank under 15000'
    },
    seatCapacity: {
      total: 120,
      categoryAllocations: [
        { category: 'General', seats: 60 },
        { category: 'OBC', seats: 30 }
      ]
    },
    requiredDocuments: ['Class 10 Marksheet', 'Class 12 Marksheet']
  };

  const sampleFee: FeeStructure = {
    _id: 'fee-1',
    programme: {
      _id: '673000111222333444555666',
      programmeName: 'B.Tech in Computer Science & Engineering',
      programmeCode: 'BTECH-CSE'
    },
    academicSession: {
      _id: 's1',
      sessionName: '2026-2027',
      sessionCode: 'AY2026-27'
    },
    applicationFee: 1000,
    admissionFee: 25000,
    semesterFees: [{ semesterNumber: 1, amount: 65000 }],
    additionalFees: [{ feeName: 'Lab Deposit', amount: 5000 }],
    totalProgrammeFee: 95000,
    currency: 'INR',
    paymentInstructions: 'Payable via Demand Draft.',
    isActive: true
  };

  beforeEach(async () => {
    currentUser$ = new BehaviorSubject<User | null>(null);
    admissionServiceMock = {
      getProgrammeById: vi.fn(() => of({ success: true, data: sampleProgramme })),
      getProgrammeByCode: vi.fn(() => of({ success: true, data: sampleProgramme })),
      getProgrammeFee: vi.fn(() => of({ success: true, data: sampleFee }))
    };

    await TestBed.configureTestingModule({
      imports: [ProgrammeDetailComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'id' ? '673000111222333444555666' : null)
              }
            }
          }
        },
        { provide: PublicAdmissionService, useValue: admissionServiceMock },
        { provide: AuthService, useValue: { currentUser$ } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProgrammeDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render programme header, department, and specifications', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('B.Tech in Computer Science & Engineering');
    expect(text).toContain('BTECH-CSE');
    expect(text).toContain('Computer Science & Engineering');
    expect(text).toContain('4 years');
  });

  it('should render verified eligibility requirements', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('60% or equivalent grade');
    expect(text).toContain('Physics, Mathematics, Chemistry');
    expect(text).toContain('WBJEE, JEE Main');
    expect(text).toContain('Rank under 15000');
  });

  it('should render fee breakdown table and total programme fee', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Total Programme Fee');
    expect(text).toContain('INR 95,000');
    expect(text).toContain('Admission Fee (One-Time)');
    expect(text).toContain('Semester 1');
  });

  it('should clearly indicate when fee information is pending publication', () => {
    admissionServiceMock.getProgrammeFee.mockReturnValue(
      throwError(() => ({ status: 404, error: { message: 'No fee found' } }))
    );

    component.loadProgrammeFee('673000111222333444555666');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Fee Schedule Notice');
    expect(text).toContain('Official fee breakdown for this academic session has not yet been published');
  });
});
