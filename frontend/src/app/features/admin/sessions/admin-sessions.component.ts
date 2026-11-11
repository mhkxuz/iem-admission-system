import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { AcademicSession } from '../../../core/models/session.model';

@Component({
  selector: 'app-admin-sessions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sessions-mgmt-page">
      <!-- Section Header -->
      <div class="mgmt-header">
        <div>
          <h3>Admission Sessions Management</h3>
          <p>Configure academic years, application intake windows, and control active admission cycles.</p>
        </div>
        <button type="button" class="btn-primary" (click)="openCreateModal()">
          + Create Admission Session
        </button>
      </div>

      <!-- Feedback Banners -->
      <div *ngIf="successMessage" class="alert-banner success">
        <span>{{ successMessage }}</span>
        <button type="button" class="btn-close" (click)="successMessage = ''">&times;</button>
      </div>
      <div *ngIf="errorMessage" class="alert-banner error">
        <span>{{ errorMessage }}</span>
        <button type="button" class="btn-close" (click)="errorMessage = ''">&times;</button>
      </div>

      <!-- Active Session Banner -->
      <div class="active-session-banner" *ngIf="activeSession">
        <div class="active-badge">&#9733; CURRENTLY ACTIVE SESSION</div>
        <div class="active-details">
          <h4>{{ activeSession.sessionName }} ({{ activeSession.sessionCode }})</h4>
          <p>
            Applications Window:
            <strong>{{ (activeSession.applicationStartDate | date:'mediumDate') || 'Open' }}</strong>
            to
            <strong>{{ (activeSession.applicationEndDate | date:'mediumDate') || 'Ongoing' }}</strong>
            &bull; Status: <span class="badge active">{{ activeSession.status }}</span>
          </p>
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="isLoading" class="state-card loading">
        <div class="spinner"></div>
        <p>Loading admission sessions...</p>
      </div>

      <!-- Sessions Table -->
      <div *ngIf="!isLoading && sessions.length > 0" class="table-card">
        <table class="data-table">
          <thead>
            <tr>
              <th>Session Name</th>
              <th>Code</th>
              <th>Status</th>
              <th>Active</th>
              <th>Application Window</th>
              <th>Academic Term Dates</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of sessions" [class.active-row]="s.isActive">
              <td>
                <strong>{{ s.sessionName }}</strong>
                <span *ngIf="s.isActive" class="current-pill">Active</span>
              </td>
              <td><code>{{ s.sessionCode }}</code></td>
              <td>
                <span class="status-pill" [ngClass]="s.status.toLowerCase()">
                  {{ s.status }}
                </span>
              </td>
              <td>
                <span class="boolean-badge" [class.yes]="s.isActive" [class.no]="!s.isActive">
                  {{ s.isActive ? 'YES' : 'NO' }}
                </span>
              </td>
              <td>
                <div *ngIf="s.applicationStartDate || s.applicationEndDate">
                  {{ s.applicationStartDate | date:'shortDate' }} &ndash; {{ s.applicationEndDate | date:'shortDate' }}
                </div>
                <div *ngIf="!s.applicationStartDate && !s.applicationEndDate" class="text-muted">Not Set</div>
              </td>
              <td>
                <div *ngIf="s.startDate || s.endDate">
                  {{ s.startDate | date:'shortDate' }} &ndash; {{ s.endDate | date:'shortDate' }}
                </div>
                <div *ngIf="!s.startDate && !s.endDate" class="text-muted">Not Set</div>
              </td>
              <td class="text-right actions-cell">
                <button type="button" class="btn-action edit" (click)="openEditModal(s)">Edit</button>

                <button
                  *ngIf="!s.isActive && s.status !== 'Closed'"
                  type="button"
                  class="btn-action activate"
                  (click)="confirmActivate(s)"
                >
                  Activate
                </button>

                <button
                  *ngIf="s.status !== 'Closed'"
                  type="button"
                  class="btn-action close-sess"
                  (click)="confirmClose(s)"
                >
                  Close
                </button>

                <button
                  type="button"
                  class="btn-action delete"
                  (click)="confirmDelete(s)"
                  [disabled]="s.isActive"
                  title="Delete session"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Create / Edit Session Modal -->
      <div *ngIf="showModal" class="modal-backdrop">
        <div class="modal-card">
          <div class="modal-header">
            <h4>{{ isEditing ? 'Edit Admission Session' : 'Create New Admission Session' }}</h4>
            <button type="button" class="btn-close-modal" (click)="closeModal()">&times;</button>
          </div>

          <form (ngSubmit)="saveSession()" class="modal-form">
            <div class="form-grid-2">
              <div class="form-group">
                <label for="sessName">Session Name *</label>
                <input id="sessName" type="text" [(ngModel)]="formData.sessionName" name="sessionName" required placeholder="e.g. 2026-2027" [disabled]="isEditing" />
              </div>

              <div class="form-group">
                <label for="sessCode">Session Code * (Unique, Uppercase)</label>
                <input id="sessCode" type="text" [(ngModel)]="formData.sessionCode" name="sessionCode" required placeholder="e.g. AY2026-27" [disabled]="isEditing" />
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label for="appStart">Application Start Date</label>
                <input id="appStart" type="date" [(ngModel)]="formData.applicationStartDate" name="applicationStartDate" />
              </div>

              <div class="form-group">
                <label for="appEnd">Application End Date</label>
                <input id="appEnd" type="date" [(ngModel)]="formData.applicationEndDate" name="applicationEndDate" />
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label for="startDate">Academic Term Start Date</label>
                <input id="startDate" type="date" [(ngModel)]="formData.startDate" name="startDate" />
              </div>

              <div class="form-group">
                <label for="endDate">Academic Term End Date</label>
                <input id="endDate" type="date" [(ngModel)]="formData.endDate" name="endDate" />
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label for="status">Session Status</label>
                <select id="status" [(ngModel)]="formData.status" name="status">
                  <option value="Draft">Draft</option>
                  <option value="Active">Active</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              <div class="checkbox-group">
                <label>
                  <input type="checkbox" [(ngModel)]="formData.isActive" name="isActive" />
                  <span>Mark as Active Session immediately</span>
                </label>
              </div>
            </div>

            <div class="form-group">
              <label for="sessDesc">Description &amp; Notes</label>
              <textarea id="sessDesc" rows="2" [(ngModel)]="formData.description" name="description" placeholder="Administrative notes for this academic intake..."></textarea>
            </div>

            <div *ngIf="modalError" class="modal-error-banner">
              {{ modalError }}
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="closeModal()">Cancel</button>
              <button type="submit" class="btn-primary" [disabled]="isSaving">
                {{ isSaving ? 'Saving Session...' : (isEditing ? 'Update Session' : 'Create Session') }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Action Confirmation Dialog (Activate, Close, Delete) -->
      <div *ngIf="showConfirmModal" class="modal-backdrop">
        <div class="modal-card confirm-modal">
          <div class="modal-header">
            <h4>{{ confirmTitle }}</h4>
            <button type="button" class="btn-close-modal" (click)="showConfirmModal = false">&times;</button>
          </div>
          <div class="modal-body">
            <p>{{ confirmMessage }}</p>
            <p *ngIf="confirmWarning" class="warning-text">
              &#9888; {{ confirmWarning }}
            </p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" (click)="showConfirmModal = false">Cancel</button>
            <button
              type="button"
              [class]="confirmButtonClass"
              (click)="executeConfirmedAction()"
              [disabled]="isExecutingConfirm"
            >
              {{ isExecutingConfirm ? 'Processing...' : confirmButtonLabel }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .sessions-mgmt-page {
      padding: 0.5rem 0 2rem;
    }
    .mgmt-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      background: #ffffff;
      padding: 1.25rem 1.5rem;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .mgmt-header h3 {
      margin: 0 0 0.25rem;
      color: #0f2b48;
      font-size: 1.25rem;
    }
    .mgmt-header p {
      margin: 0;
      color: #64748b;
      font-size: 0.85rem;
    }
    .btn-primary {
      background: #0f2b48;
      color: #ffffff;
      border: none;
      padding: 0.65rem 1.25rem;
      border-radius: 4px;
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-primary:hover:not(:disabled) {
      background: #1a426e;
    }
    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .alert-banner {
      padding: 0.85rem 1.25rem;
      border-radius: 6px;
      margin-bottom: 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
    }
    .alert-banner.success {
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
    }
    .alert-banner.error {
      background: #fef2f2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }
    .btn-close {
      background: none;
      border: none;
      font-size: 1.2rem;
      cursor: pointer;
      color: inherit;
    }
    .active-session-banner {
      background: #0f2b48;
      color: #ffffff;
      border-radius: 8px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 4px 12px rgba(15, 43, 72, 0.12);
    }
    .active-badge {
      display: inline-block;
      background: #c98a2c;
      color: #0f2b48;
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.75px;
      padding: 0.2rem 0.5rem;
      border-radius: 3px;
      margin-bottom: 0.5rem;
    }
    .active-details h4 {
      margin: 0 0 0.35rem;
      font-size: 1.2rem;
      color: #ffffff;
    }
    .active-details p {
      margin: 0;
      color: #a4c2e0;
      font-size: 0.85rem;
    }
    .badge.active {
      background: #dcfce7;
      color: #15803d;
      padding: 0.1rem 0.4rem;
      border-radius: 3px;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .table-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow-x: auto;
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      text-align: left;
    }
    .data-table th, .data-table td {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid #edf2f7;
    }
    .data-table th {
      background: #f8fafc;
      color: #475569;
      font-weight: 700;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .active-row {
      background: #f0fdf4;
    }
    .current-pill {
      display: inline-block;
      background: #10b981;
      color: #ffffff;
      font-size: 0.65rem;
      font-weight: 800;
      padding: 0.1rem 0.4rem;
      border-radius: 10px;
      margin-left: 0.5rem;
      text-transform: uppercase;
    }
    .status-pill {
      display: inline-block;
      padding: 0.2rem 0.55rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .status-pill.draft { background: #f1f5f9; color: #475569; }
    .status-pill.active { background: #dcfce7; color: #15803d; }
    .status-pill.closed { background: #fee2e2; color: #b91c1c; }
    .boolean-badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.15rem 0.45rem;
      border-radius: 3px;
    }
    .boolean-badge.yes { background: #dcfce7; color: #15803d; }
    .boolean-badge.no { background: #f1f5f9; color: #94a3b8; }
    .text-muted { color: #94a3b8; }
    .text-right { text-align: right; }
    .actions-cell { white-space: nowrap; }
    .btn-action {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 0.3rem 0.6rem;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      margin-left: 0.35rem;
    }
    .btn-action.edit { color: #0f2b48; }
    .btn-action.activate {
      color: #059669;
      border-color: #a7f3d0;
      background: #ecfdf5;
    }
    .btn-action.close-sess {
      color: #b45309;
      border-color: #fde68a;
      background: #fffbeb;
    }
    .btn-action.delete {
      color: #dc2626;
      border-color: #fecaca;
      background: #fef2f2;
    }
    .btn-action.delete:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .state-card {
      background: #ffffff;
      padding: 3rem;
      text-align: center;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .spinner {
      border: 3px solid rgba(15,43,72,0.1);
      border-top: 3px solid #0f2b48;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 0.75rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    /* Modal */
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 43, 72, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }
    .modal-card {
      background: #ffffff;
      border-radius: 8px;
      width: 100%;
      max-width: 650px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    }
    .confirm-modal { max-width: 480px; padding: 1.5rem; }
    .modal-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid #edf2f7;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .modal-header h4 { margin: 0; color: #0f2b48; font-size: 1.15rem; }
    .btn-close-modal {
      background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748b;
    }
    .modal-form { padding: 1.5rem; }
    .form-grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 0.75rem;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      margin-bottom: 0.75rem;
    }
    .form-group label { font-size: 0.8rem; font-weight: 600; color: #334155; }
    .form-group input, .form-group select, .form-group textarea {
      padding: 0.55rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 0.85rem;
    }
    .checkbox-group {
      display: flex;
      align-items: center;
      height: 100%;
      padding-top: 1.25rem;
    }
    .checkbox-group label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }
    .modal-error-banner {
      background: #fee2e2;
      color: #991b1b;
      padding: 0.75rem 1rem;
      border-radius: 4px;
      font-size: 0.85rem;
      margin-top: 1rem;
    }
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1.5rem;
      border-top: 1px solid #edf2f7;
      padding-top: 1.25rem;
    }
    .btn-secondary {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      color: #334155;
      padding: 0.65rem 1.25rem;
      border-radius: 4px;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .btn-danger {
      background: #dc2626;
      color: #ffffff;
      border: none;
      padding: 0.65rem 1.25rem;
      border-radius: 4px;
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .btn-warning-action {
      background: #d97706;
      color: #ffffff;
      border: none;
      padding: 0.65rem 1.25rem;
      border-radius: 4px;
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .warning-text {
      color: #b45309;
      background: #fffbeb;
      padding: 0.75rem;
      border-radius: 4px;
      font-size: 0.8rem;
      margin-top: 0.75rem;
    }
  `]
})
export class AdminSessionsComponent implements OnInit {
  private adminService = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);

  public sessions: AcademicSession[] = [];
  public activeSession: AcademicSession | null = null;
  public isLoading = false;
  public errorMessage = '';
  public successMessage = '';

  // Modal State
  public showModal = false;
  public isEditing = false;
  public editingId = '';
  public isSaving = false;
  public modalError = '';

  public formData: any = this.getFreshFormData();

  // Confirmation Modal State
  public showConfirmModal = false;
  public confirmTitle = '';
  public confirmMessage = '';
  public confirmWarning = '';
  public confirmButtonLabel = '';
  public confirmButtonClass = 'btn-primary';
  public isExecutingConfirm = false;
  public pendingAction: (() => void) | null = null;

  ngOnInit(): void {
    this.loadSessions();
  }

  loadSessions(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    this.adminService.getSessions().subscribe({
      next: (res) => {
        this.isLoading = false;
        this.sessions = res.data || [];
        this.activeSession = this.sessions.find((s) => s.isActive) || null;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Failed to load admission sessions.';
        this.cdr.markForCheck();
      }
    });
  }

  getFreshFormData(): any {
    return {
      sessionName: '',
      sessionCode: '',
      startDate: '',
      endDate: '',
      applicationStartDate: '',
      applicationEndDate: '',
      status: 'Draft',
      isActive: false,
      description: ''
    };
  }

  openCreateModal(): void {
    this.isEditing = false;
    this.editingId = '';
    this.formData = this.getFreshFormData();
    this.modalError = '';
    this.showModal = true;
    this.cdr.markForCheck();
  }

  openEditModal(session: AcademicSession): void {
    this.isEditing = true;
    this.editingId = session._id || '';
    this.formData = {
      sessionName: session.sessionName,
      sessionCode: session.sessionCode,
      startDate: session.startDate ? session.startDate.split('T')[0] : '',
      endDate: session.endDate ? session.endDate.split('T')[0] : '',
      applicationStartDate: session.applicationStartDate
        ? session.applicationStartDate.split('T')[0]
        : '',
      applicationEndDate: session.applicationEndDate
        ? session.applicationEndDate.split('T')[0]
        : '',
      status: session.status || 'Draft',
      isActive: Boolean(session.isActive),
      description: session.description || ''
    };
    this.modalError = '';
    this.showModal = true;
    this.cdr.markForCheck();
  }

  closeModal(): void {
    this.showModal = false;
    this.modalError = '';
    this.cdr.markForCheck();
  }

  saveSession(): void {
    // Validate date ranges
    if (this.formData.startDate && this.formData.endDate) {
      if (new Date(this.formData.startDate) > new Date(this.formData.endDate)) {
        this.modalError = 'Academic term start date must be before end date.';
        this.cdr.markForCheck();
        return;
      }
    }

    if (this.formData.applicationStartDate && this.formData.applicationEndDate) {
      if (
        new Date(this.formData.applicationStartDate) >
        new Date(this.formData.applicationEndDate)
      ) {
        this.modalError = 'Application opening date must be before closing date.';
        this.cdr.markForCheck();
        return;
      }
    }

    this.isSaving = true;
    this.modalError = '';
    this.cdr.markForCheck();

    const request$ = this.isEditing
      ? this.adminService.updateSession(this.editingId, this.formData)
      : this.adminService.createSession(this.formData);

    request$.subscribe({
      next: () => {
        this.isSaving = false;
        this.showModal = false;
        this.successMessage = `Admission session '${this.formData.sessionName}' saved successfully.`;
        this.loadSessions();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isSaving = false;
        this.modalError = err.error?.message || 'Failed to save admission session.';
        this.cdr.markForCheck();
      }
    });
  }

  confirmActivate(session: AcademicSession): void {
    this.confirmTitle = 'Activate Admission Session';
    this.confirmMessage = `Are you sure you want to activate admission session '${session.sessionName}'?`;
    this.confirmWarning =
      'Activating this session will atomically deactivate any currently active session. All new candidate applications will be recorded under this session.';
    this.confirmButtonLabel = 'Confirm & Activate';
    this.confirmButtonClass = 'btn-primary';
    this.pendingAction = () => this.executeActivate(session);
    this.showConfirmModal = true;
    this.cdr.markForCheck();
  }

  executeActivate(session: AcademicSession): void {
    if (!session._id) return;
    this.isExecutingConfirm = true;
    this.cdr.markForCheck();

    this.adminService.activateSession(session._id).subscribe({
      next: () => {
        this.isExecutingConfirm = false;
        this.showConfirmModal = false;
        this.successMessage = `Admission session '${session.sessionName}' is now Active.`;
        this.loadSessions();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isExecutingConfirm = false;
        this.showConfirmModal = false;
        this.errorMessage = err.error?.message || 'Failed to activate session.';
        this.cdr.markForCheck();
      }
    });
  }

  confirmClose(session: AcademicSession): void {
    this.confirmTitle = 'Close Admission Session';
    this.confirmMessage = `Are you sure you want to close admission session '${session.sessionName}'?`;
    this.confirmWarning =
      'Closing this session will stop all new applicant submissions and set its active flag to false. Historical applications will remain intact.';
    this.confirmButtonLabel = 'Close Session';
    this.confirmButtonClass = 'btn-warning-action';
    this.pendingAction = () => this.executeClose(session);
    this.showConfirmModal = true;
    this.cdr.markForCheck();
  }

  executeClose(session: AcademicSession): void {
    if (!session._id) return;
    this.isExecutingConfirm = true;
    this.cdr.markForCheck();

    this.adminService.closeSession(session._id).subscribe({
      next: () => {
        this.isExecutingConfirm = false;
        this.showConfirmModal = false;
        this.successMessage = `Admission session '${session.sessionName}' closed successfully.`;
        this.loadSessions();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isExecutingConfirm = false;
        this.showConfirmModal = false;
        this.errorMessage = err.error?.message || 'Failed to close session.';
        this.cdr.markForCheck();
      }
    });
  }

  confirmDelete(session: AcademicSession): void {
    this.confirmTitle = 'Delete Admission Session';
    this.confirmMessage = `Are you sure you want to permanently delete session '${session.sessionName}'?`;
    this.confirmWarning =
      'If applications or programmes reference this session, deletion will be rejected by the backend to maintain data integrity.';
    this.confirmButtonLabel = 'Delete Session';
    this.confirmButtonClass = 'btn-danger';
    this.pendingAction = () => this.executeDelete(session);
    this.showConfirmModal = true;
    this.cdr.markForCheck();
  }

  executeDelete(session: AcademicSession): void {
    if (!session._id) return;
    this.isExecutingConfirm = true;
    this.cdr.markForCheck();

    this.adminService.deleteSession(session._id).subscribe({
      next: () => {
        this.isExecutingConfirm = false;
        this.showConfirmModal = false;
        this.successMessage = `Admission session '${session.sessionName}' deleted successfully.`;
        this.loadSessions();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isExecutingConfirm = false;
        this.showConfirmModal = false;
        this.errorMessage = err.error?.message || 'Failed to delete session.';
        this.cdr.markForCheck();
      }
    });
  }

  executeConfirmedAction(): void {
    if (this.pendingAction) {
      this.pendingAction();
    }
  }
}
