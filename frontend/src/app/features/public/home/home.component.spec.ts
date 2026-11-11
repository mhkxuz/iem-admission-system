import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { vi } from 'vitest';
import { HomeComponent } from './home.component';
import { PublicAdmissionService } from '../../../core/services/public-admission.service';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/user.model';
import { Programme } from '../../../core/models/programme.model';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let component: HomeComponent;
  let currentUser$: BehaviorSubject<User | null>;
  let admissionServiceMock: {
    getActiveSession: ReturnType<typeof vi.fn>;
    getProgrammes: ReturnType<typeof vi.fn>;
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
      durationUnit: 'years',
      seatCapacity: { total: 120 }
    }
  ];

  beforeEach(async () => {
    currentUser$ = new BehaviorSubject<User | null>(null);
    admissionServiceMock = {
      getActiveSession: vi.fn(() =>
        of({
          success: true,
          data: {
            sessionName: '2026-2027',
            sessionCode: 'AY2026-27',
            isApplicationOpen: true,
            applicationStartDate: '2026-01-01',
            applicationEndDate: '2026-12-31'
          }
        })
      ),
      getProgrammes: vi.fn(() => of({ success: true, data: sampleProgrammes }))
    };

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        { provide: PublicAdmissionService, useValue: admissionServiceMock },
        { provide: AuthService, useValue: { currentUser$ } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render the hero section with IEM title and call-to-actions', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Institute of Engineering & Management');
    expect(text).toContain('Explore Programmes');
    expect(text).toContain('Apply Now');
  });

  it('should render the active session banner and dates', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Academic Session 2026-2027');
    expect(text).toContain('AY2026-27');
    expect(text).toContain('Admissions Open');
  });

  it('should render featured programme cards', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('B.Tech in Computer Science & Engineering');
    expect(text).toContain('120 Seats');
  });

  it('should render the 8-step admission journey', () => {
    const steps = fixture.nativeElement.querySelectorAll('.journey-step');
    expect(steps.length).toBe(8);
    expect(fixture.nativeElement.textContent).toContain('Account Registration');
    expect(fixture.nativeElement.textContent).toContain('Online Admission Journey');
  });
});
