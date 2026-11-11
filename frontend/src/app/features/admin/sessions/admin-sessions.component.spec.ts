import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AdminSessionsComponent } from './admin-sessions.component';
import { AdminService } from '../../../core/services/admin.service';
import { AcademicSession } from '../../../core/models/session.model';

const mockSessions: AcademicSession[] = [
  {
    _id: 'sess-1',
    sessionName: '2026-2027',
    sessionCode: 'AY2026-27',
    status: 'Active',
    isActive: true,
    startDate: '2026-07-01T00:00:00.000Z',
    endDate: '2027-06-30T00:00:00.000Z',
    applicationStartDate: '2026-01-01T00:00:00.000Z',
    applicationEndDate: '2026-12-31T00:00:00.000Z'
  },
  {
    _id: 'sess-2',
    sessionName: '2027-2028',
    sessionCode: 'AY2027-28',
    status: 'Draft',
    isActive: false
  }
];

describe('AdminSessionsComponent', () => {
  let fixture: ComponentFixture<AdminSessionsComponent>;
  let component: AdminSessionsComponent;
  let adminServiceMock: {
    getSessions: ReturnType<typeof vi.fn>;
    createSession: ReturnType<typeof vi.fn>;
    updateSession: ReturnType<typeof vi.fn>;
    activateSession: ReturnType<typeof vi.fn>;
    closeSession: ReturnType<typeof vi.fn>;
    deleteSession: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    adminServiceMock = {
      getSessions: vi.fn(() =>
        of({
          success: true,
          message: 'Loaded',
          data: mockSessions
        })
      ),
      createSession: vi.fn(() => of({ success: true, message: 'Created', data: mockSessions[1] })),
      updateSession: vi.fn(() => of({ success: true, message: 'Updated', data: mockSessions[0] })),
      activateSession: vi.fn(() => of({ success: true, message: 'Activated', data: mockSessions[1] })),
      closeSession: vi.fn(() => of({ success: true, message: 'Closed', data: mockSessions[0] })),
      deleteSession: vi.fn(() => of({ success: true, message: 'Deleted', data: mockSessions[1] }))
    };

    await TestBed.configureTestingModule({
      imports: [AdminSessionsComponent],
      providers: [{ provide: AdminService, useValue: adminServiceMock }]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminSessionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize and display admission sessions list and active banner', () => {
    expect(component).toBeTruthy();
    expect(component.sessions.length).toBe(2);
    expect(component.activeSession?.sessionName).toBe('2026-2027');

    const el = fixture.nativeElement;
    expect(el.textContent).toContain('2026-2027');
    expect(el.textContent).toContain('AY2026-27');
    expect(el.textContent).toContain('CURRENTLY ACTIVE SESSION');
  });

  it('should validate date ranges before saving session', () => {
    component.openCreateModal();
    component.formData.startDate = '2027-06-30';
    component.formData.endDate = '2026-07-01'; // End before start

    component.saveSession();

    expect(component.modalError).toContain('start date must be before end date');
    expect(adminServiceMock.createSession).not.toHaveBeenCalled();
  });

  it('should activate session with confirmation dialog', () => {
    component.confirmActivate(mockSessions[1]);
    expect(component.showConfirmModal).toBe(true);
    expect(component.confirmTitle).toContain('Activate Admission Session');

    component.executeConfirmedAction();

    expect(adminServiceMock.activateSession).toHaveBeenCalledWith('sess-2');
  });

  it('should close session with confirmation dialog', () => {
    component.confirmClose(mockSessions[0]);
    expect(component.showConfirmModal).toBe(true);
    expect(component.confirmTitle).toContain('Close Admission Session');

    component.executeConfirmedAction();

    expect(adminServiceMock.closeSession).toHaveBeenCalledWith('sess-1');
  });

  it('should delete session with confirmation dialog', () => {
    component.confirmDelete(mockSessions[1]);
    expect(component.showConfirmModal).toBe(true);
    expect(component.confirmTitle).toContain('Delete Admission Session');

    component.executeConfirmedAction();

    expect(adminServiceMock.deleteSession).toHaveBeenCalledWith('sess-2');
  });
});
