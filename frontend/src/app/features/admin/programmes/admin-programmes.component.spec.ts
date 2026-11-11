import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AdminProgrammesComponent } from './admin-programmes.component';
import { AdminService } from '../../../core/services/admin.service';
import { Programme } from '../../../core/models/programme.model';

const sampleProgramme: Programme = {
  _id: 'prog-1',
  programmeName: 'B.Tech in Computer Science & Engineering',
  programmeCode: 'BTECH-CSE',
  degreeLevel: 'Undergraduate',
  department: 'Computer Science & Engineering',
  degree: 'B.Tech',
  duration: 4,
  durationUnit: 'years',
  isActive: true,
  isApplicationOpen: true,
  seatCapacity: {
    total: 120,
    categoryAllocations: [
      { category: 'General', seats: 60 },
      { category: 'OBC', seats: 30 },
      { category: 'SC', seats: 20 },
      { category: 'ST', seats: 10 }
    ]
  },
  eligibility: {
    minClass12Percentage: 60,
    acceptedAcademicStreams: ['Science (PCM)'],
    requiredClass12Subjects: ['Physics', 'Mathematics', 'Chemistry']
  }
};

describe('AdminProgrammesComponent', () => {
  let fixture: ComponentFixture<AdminProgrammesComponent>;
  let component: AdminProgrammesComponent;
  let adminServiceMock: {
    getProgrammes: ReturnType<typeof vi.fn>;
    getSessions: ReturnType<typeof vi.fn>;
    createProgramme: ReturnType<typeof vi.fn>;
    updateProgramme: ReturnType<typeof vi.fn>;
    activateProgramme: ReturnType<typeof vi.fn>;
    deactivateProgramme: ReturnType<typeof vi.fn>;
    deleteProgramme: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    adminServiceMock = {
      getProgrammes: vi.fn(() =>
        of({
          success: true,
          message: 'Loaded',
          data: {
            programmes: [sampleProgramme],
            total: 1,
            page: 1,
            limit: 10,
            totalPages: 1
          }
        })
      ),
      getSessions: vi.fn(() => of({ success: true, message: 'Sessions', data: [] })),
      createProgramme: vi.fn(() => of({ success: true, message: 'Created', data: sampleProgramme })),
      updateProgramme: vi.fn(() => of({ success: true, message: 'Updated', data: sampleProgramme })),
      activateProgramme: vi.fn(() => of({ success: true, message: 'Activated', data: sampleProgramme })),
      deactivateProgramme: vi.fn(() => of({ success: true, message: 'Deactivated', data: sampleProgramme })),
      deleteProgramme: vi.fn(() => of({ success: true, message: 'Deleted', data: sampleProgramme }))
    };

    await TestBed.configureTestingModule({
      imports: [AdminProgrammesComponent],
      providers: [{ provide: AdminService, useValue: adminServiceMock }]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminProgrammesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize and display programmes catalogue', () => {
    expect(component).toBeTruthy();
    expect(component.programmes.length).toBe(1);
    expect(component.programmes[0].programmeCode).toBe('BTECH-CSE');

    const el = fixture.nativeElement;
    expect(el.textContent).toContain('BTECH-CSE');
    expect(el.textContent).toContain('B.Tech in Computer Science & Engineering');
  });

  it('should open create modal and detect seat capacity overflow', () => {
    component.openCreateModal();
    expect(component.showModal).toBe(true);

    component.formData.seatCapacity.total = 50;
    component.formData.seatCapacity.categoryAllocations = [
      { category: 'General', seats: 40 },
      { category: 'OBC', seats: 20 } // sum = 60 > 50
    ];
    component.computeSeatBalance();

    expect(component.remainingSeats).toBe(-10);
    component.saveProgramme();
    expect(component.modalError).toContain('exceed total capacity');
    expect(adminServiceMock.createProgramme).not.toHaveBeenCalled();
  });

  it('should create a valid programme successfully', () => {
    component.openCreateModal();
    component.formData.programmeName = 'B.Tech in Information Technology';
    component.formData.programmeCode = 'BTECH-IT';
    component.formData.seatCapacity.total = 100;
    component.formData.seatCapacity.categoryAllocations = [
      { category: 'General', seats: 60 },
      { category: 'OBC', seats: 40 }
    ];

    component.saveProgramme();

    expect(adminServiceMock.createProgramme).toHaveBeenCalled();
    expect(component.successMessage).toContain('saved successfully');
  });

  it('should toggle programme active status', () => {
    component.toggleProgrammeActive(sampleProgramme);
    expect(adminServiceMock.deactivateProgramme).toHaveBeenCalledWith('prog-1');
  });

  it('should toggle application intake status', () => {
    component.toggleApplicationOpen(sampleProgramme);
    expect(adminServiceMock.updateProgramme).toHaveBeenCalledWith('prog-1', {
      isApplicationOpen: false
    });
  });

  it('should handle programme deletion with confirmation', () => {
    component.confirmDelete(sampleProgramme);
    expect(component.showDeleteModal).toBe(true);
    expect(component.programmeToDelete?._id).toBe('prog-1');

    component.executeDelete();
    expect(adminServiceMock.deleteProgramme).toHaveBeenCalledWith('prog-1');
  });
});
