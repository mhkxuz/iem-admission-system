import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProgrammesComponent } from './programmes.component';
import { PublicAdmissionService } from '../../../core/services/public-admission.service';
import { Programme } from '../../../core/models/programme.model';

describe('ProgrammesComponent', () => {
  let fixture: ComponentFixture<ProgrammesComponent>;
  let component: ProgrammesComponent;
  let admissionServiceMock: {
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
      durationUnit: 'years'
    },
    {
      _id: 'p2',
      programmeName: 'B.Tech in Information Technology',
      programmeCode: 'BTECH-IT',
      degreeLevel: 'Undergraduate',
      department: 'Information Technology',
      degree: 'B.Tech',
      duration: 4,
      durationUnit: 'years'
    },
    {
      _id: 'p3',
      programmeName: 'Master of Computer Applications',
      programmeCode: 'MCA-01',
      degreeLevel: 'Postgraduate',
      department: 'Computer Applications',
      degree: 'MCA',
      duration: 2,
      durationUnit: 'years'
    }
  ];

  beforeEach(async () => {
    admissionServiceMock = {
      getProgrammes: vi.fn(() => of({ success: true, data: sampleProgrammes }))
    };

    await TestBed.configureTestingModule({
      imports: [ProgrammesComponent],
      providers: [
        provideRouter([]),
        { provide: PublicAdmissionService, useValue: admissionServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProgrammesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should list all loaded programmes initially', () => {
    expect(component.filteredProgrammes.length).toBe(3);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('B.Tech in Computer Science & Engineering');
    expect(text).toContain('BTECH-IT');
    expect(text).toContain('Master of Computer Applications');
  });

  it('should filter programmes by search query', () => {
    component.searchQuery = 'information';
    component.applyFilters();
    fixture.detectChanges();

    expect(component.filteredProgrammes.length).toBe(1);
    expect(component.filteredProgrammes[0].programmeCode).toBe('BTECH-IT');
  });

  it('should filter programmes by degree level', () => {
    component.selectedDegreeLevel = 'Postgraduate';
    component.applyFilters();
    fixture.detectChanges();

    expect(component.filteredProgrammes.length).toBe(1);
    expect(component.filteredProgrammes[0].programmeCode).toBe('MCA-01');
  });

  it('should show empty state when no programmes match the query', () => {
    component.searchQuery = 'NonExistentDegree123';
    component.applyFilters();
    fixture.detectChanges();

    expect(component.filteredProgrammes.length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('No Programmes Found');
  });

  it('should display error message and allow retry when API fails', () => {
    admissionServiceMock.getProgrammes.mockReturnValue(
      throwError(() => ({ error: { message: 'Network connection failed' } }))
    );

    component.loadProgrammes();
    fixture.detectChanges();

    expect(component.errorMessage).toBe('Network connection failed');
    expect(fixture.nativeElement.textContent).toContain('Unable to Load Programmes');

    // Click retry
    admissionServiceMock.getProgrammes.mockReturnValue(of({ success: true, data: sampleProgrammes }));
    fixture.nativeElement.querySelector('.btn-retry').click();
    expect(component.errorMessage).toBe('');
  });
});
