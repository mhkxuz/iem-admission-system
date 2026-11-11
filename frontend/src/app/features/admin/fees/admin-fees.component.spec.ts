import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AdminFeesComponent } from './admin-fees.component';
import { AdminService } from '../../../core/services/admin.service';
import { FeeStructure } from '../../../core/models/fee.model';

const sampleFee: FeeStructure = {
  _id: 'fee-1',
  programme: {
    _id: 'prog-1',
    programmeName: 'B.Tech in Computer Science & Engineering',
    programmeCode: 'BTECH-CSE'
  },
  academicSession: {
    _id: 'sess-1',
    sessionName: '2026-2027',
    sessionCode: 'AY2026-27'
  },
  applicationFee: 1000,
  admissionFee: 25000,
  semesterFees: [
    { semesterNumber: 1, amount: 60000 },
    { semesterNumber: 2, amount: 60000 }
  ],
  additionalFees: [
    { feeName: 'Lab Deposit', amount: 5000 }
  ],
  totalProgrammeFee: 151000,
  currency: 'INR',
  paymentInstructions: 'Online Transfer',
  isActive: true
};

describe('AdminFeesComponent', () => {
  let fixture: ComponentFixture<AdminFeesComponent>;
  let component: AdminFeesComponent;
  let adminServiceMock: {
    getFeeStructures: ReturnType<typeof vi.fn>;
    getProgrammes: ReturnType<typeof vi.fn>;
    getSessions: ReturnType<typeof vi.fn>;
    createFeeStructure: ReturnType<typeof vi.fn>;
    updateFeeStructure: ReturnType<typeof vi.fn>;
    activateFeeStructure: ReturnType<typeof vi.fn>;
    deactivateFeeStructure: ReturnType<typeof vi.fn>;
    deleteFeeStructure: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    adminServiceMock = {
      getFeeStructures: vi.fn(() => of({ success: true, message: 'Loaded', data: [sampleFee] })),
      getProgrammes: vi.fn(() => of({ success: true, message: 'Loaded', data: { programmes: [] } })),
      getSessions: vi.fn(() => of({ success: true, message: 'Loaded', data: [] })),
      createFeeStructure: vi.fn(() => of({ success: true, message: 'Created', data: sampleFee })),
      updateFeeStructure: vi.fn(() => of({ success: true, message: 'Updated', data: sampleFee })),
      activateFeeStructure: vi.fn(() => of({ success: true, message: 'Activated', data: sampleFee })),
      deactivateFeeStructure: vi.fn(() => of({ success: true, message: 'Deactivated', data: sampleFee })),
      deleteFeeStructure: vi.fn(() => of({ success: true, message: 'Deleted', data: sampleFee }))
    };

    await TestBed.configureTestingModule({
      imports: [AdminFeesComponent],
      providers: [{ provide: AdminService, useValue: adminServiceMock }]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminFeesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize and display fee structures list', () => {
    expect(component).toBeTruthy();
    expect(component.feeStructures.length).toBe(1);
    expect(component.feeStructures[0].programme.programmeCode).toBe('BTECH-CSE');

    const el = fixture.nativeElement;
    expect(el.textContent).toContain('BTECH-CSE');
    expect(el.textContent).toContain('2026-2027');
    expect(el.textContent).toContain('151,000');
  });

  it('should dynamically calculate total programme fee', () => {
    component.openCreateModal();
    component.formData.applicationFee = 1500;
    component.formData.admissionFee = 30000;
    component.formData.semesterFees = [
      { semesterNumber: 1, amount: 70000 },
      { semesterNumber: 2, amount: 70000 }
    ];
    component.formData.additionalFees = [
      { feeName: 'Exam Fee', amount: 3000 }
    ];

    expect(component.computedTotal).toBe(1500 + 30000 + 140000 + 3000);
  });

  it('should validate non-negative fee amounts before saving', () => {
    component.openCreateModal();
    component.formData.applicationFee = -500; // Negative amount

    component.saveFeeStructure();

    expect(component.modalError).toContain('must be non-negative');
    expect(adminServiceMock.createFeeStructure).not.toHaveBeenCalled();
  });

  it('should toggle fee schedule active status', () => {
    component.toggleFeeActive(sampleFee);
    expect(adminServiceMock.deactivateFeeStructure).toHaveBeenCalledWith('fee-1');
  });

  it('should delete fee schedule with confirmation', () => {
    component.confirmDelete(sampleFee);
    expect(component.showDeleteModal).toBe(true);

    component.executeDelete();
    expect(adminServiceMock.deleteFeeStructure).toHaveBeenCalledWith('fee-1');
  });
});
