import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { FeesComponent } from './fees.component';
import { PublicAdmissionService } from '../../../core/services/public-admission.service';
import { Programme } from '../../../core/models/programme.model';
import { FeeStructure } from '../../../core/models/fee.model';

describe('FeesComponent', () => {
  let fixture: ComponentFixture<FeesComponent>;
  let component: FeesComponent;
  let admissionServiceMock: {
    getProgrammes: ReturnType<typeof vi.fn>;
    getProgrammeFee: ReturnType<typeof vi.fn>;
  };

  const sampleProgrammes: Programme[] = [
    {
      _id: 'p1',
      programmeName: 'B.Tech in Computer Science & Engineering',
      programmeCode: 'BTECH-CSE',
      degreeLevel: 'Undergraduate',
      department: 'Computer Science & Engineering',
      degree: 'B.Tech',
      duration: 4,
      durationUnit: 'years'
    }
  ];

  const sampleFee: FeeStructure = {
    _id: 'fee-1',
    programme: {
      _id: 'p1',
      programmeName: 'B.Tech in Computer Science & Engineering',
      programmeCode: 'BTECH-CSE',
      department: 'Computer Science & Engineering',
      degree: 'B.Tech',
      duration: 4,
      durationUnit: 'years'
    },
    academicSession: {
      _id: 's1',
      sessionName: '2026-2027',
      sessionCode: 'AY2026-27'
    },
    applicationFee: 1000,
    admissionFee: 25000,
    semesterFees: [
      { semesterNumber: 1, amount: 65000 },
      { semesterNumber: 2, amount: 65000 }
    ],
    additionalFees: [
      { feeName: 'Library Security Deposit', amount: 5000, description: 'Refundable' }
    ],
    totalProgrammeFee: 160000,
    currency: 'INR',
    paymentInstructions: 'Bank NEFT or Demand Draft in favour of IEM.',
    isActive: true
  };

  beforeEach(async () => {
    admissionServiceMock = {
      getProgrammes: vi.fn(() => of({ success: true, data: sampleProgrammes })),
      getProgrammeFee: vi.fn(() => of({ success: true, data: sampleFee }))
    };

    await TestBed.configureTestingModule({
      imports: [FeesComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParams: {}
            }
          }
        },
        { provide: PublicAdmissionService, useValue: admissionServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FeesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should populate programme dropdown and select first programme by default', () => {
    expect(component.programmes.length).toBe(1);
    expect(component.selectedProgrammeId).toBe('p1');
    expect(component.selectedFee).toBeTruthy();
  });

  it('should render itemized fee components and total fee', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Total Programme Fee');
    expect(text).toContain('INR 160,000.00');
    expect(text).toContain('Semester 1');
    expect(text).toContain('Library Security Deposit');
    expect(text).toContain('Refundable');
  });

  it('should display pending publication message when no fee is available for selected course', () => {
    admissionServiceMock.getProgrammeFee.mockReturnValue(
      throwError(() => ({ status: 404, error: { message: 'No fee' } }))
    );

    component.onProgrammeSelect();
    fixture.detectChanges();

    expect(component.selectedFee).toBeNull();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Fee Information Pending Publication');
  });
});
