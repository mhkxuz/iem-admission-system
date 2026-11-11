import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { FeeStructure, SemesterFee, AdditionalFee } from '../../../core/models/fee.model';
import { Programme } from '../../../core/models/programme.model';
import { AcademicSession } from '../../../core/models/session.model';

@Component({
  selector: 'app-admin-fees',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fees-mgmt-page">
      <!-- Section Header -->
      <div class="mgmt-header">
        <div>
          <h3>Fee Structures &amp; Schedules Management</h3>
          <p>Configure admission fees, semester tuition breakdowns, additional institutional charges and payment terms.</p>
        </div>
        <button type="button" class="btn-primary" (click)="openCreateModal()">
          + Configure Fee Schedule
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

      <!-- Filter Toolbar -->
      <div class="toolbar-card">
        <div class="filter-controls">
          <select [(ngModel)]="filterProgrammeId" (change)="onFilterChange()">
            <option value="">All Programmes</option>
            <option *ngFor="let p of availableProgrammes" [value]="p._id">
              {{ p.programmeName }} ({{ p.programmeCode }})
            </option>
          </select>

          <select [(ngModel)]="filterSessionId" (change)="onFilterChange()">
            <option value="">All Sessions</option>
            <option *ngFor="let s of availableSessions" [value]="s._id">
              {{ s.sessionName }} ({{ s.sessionCode }})
            </option>
          </select>

          <select [(ngModel)]="filterActiveStatus" (change)="onFilterChange()">
            <option value="">All Statuses</option>
            <option value="true">Active Fee Schedules</option>
            <option value="false">Inactive / Historical</option>
          </select>

          <button type="button" class="btn-reset" (click)="resetFilters()">Reset Filters</button>
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="isLoading" class="state-card loading">
        <div class="spinner"></div>
        <p>Loading fee structures...</p>
      </div>

      <!-- Empty State -->
      <div *ngIf="!isLoading && feeStructures.length === 0" class="state-card empty">
        <h4>No Fee Structures Found</h4>
        <p>No fee schedules have been configured matching the selected filters.</p>
        <button type="button" class="btn-primary" (click)="openCreateModal()">Configure New Fee Structure</button>
      </div>

      <!-- Fee Structures Grid / Cards -->
      <div *ngIf="!isLoading && feeStructures.length > 0" class="fees-grid">
        <div *ngFor="let fee of feeStructures" class="fee-card-item" [class.inactive]="!fee.isActive">
          <div class="card-header">
            <div>
              <span class="prog-code-badge">{{ fee.programme?.programmeCode || 'PROG' }}</span>
              <span class="session-pill">{{ fee.academicSession?.sessionName || 'Session' }}</span>
            </div>
            <span class="status-pill" [class.active]="fee.isActive" [class.inactive]="!fee.isActive">
              {{ fee.isActive ? 'Active Schedule' : 'Inactive / Archived' }}
            </span>
          </div>

          <h4 class="prog-title">{{ fee.programme?.programmeName || 'Academic Programme' }}</h4>

          <div class="fee-summary-numbers">
            <div class="num-box">
              <span class="label">Total Programme Fee</span>
              <strong class="total-amount">&#8377;{{ fee.totalProgrammeFee | number:'1.0-0' }}</strong>
            </div>
            <div class="num-box">
              <span class="label">Admission Fee</span>
              <strong>&#8377;{{ fee.admissionFee | number:'1.0-0' }}</strong>
            </div>
            <div class="num-box">
              <span class="label">Application Fee</span>
              <strong>&#8377;{{ fee.applicationFee | number:'1.0-0' }}</strong>
            </div>
          </div>

          <!-- Semester Breakdown Accordion / Details -->
          <div class="semesters-breakdown" *ngIf="fee.semesterFees?.length">
            <h5>Semester Tuition Schedule ({{ fee.semesterFees.length }} Semesters)</h5>
            <div class="sem-chips">
              <span class="sem-chip" *ngFor="let s of fee.semesterFees">
                Sem {{ s.semesterNumber }}: &#8377;{{ s.amount | number:'1.0-0' }}
              </span>
            </div>
          </div>

          <!-- Additional Charges -->
          <div class="charges-breakdown" *ngIf="fee.additionalFees?.length">
            <h5>Additional Institutional Charges</h5>
            <div class="charges-chips">
              <span class="charge-chip" *ngFor="let ch of fee.additionalFees">
                {{ ch.feeName }}: &#8377;{{ ch.amount | number:'1.0-0' }}
              </span>
            </div>
          </div>

          <div class="instructions-snippet" *ngIf="fee.paymentInstructions">
            <small><strong>Payment Instructions:</strong> {{ fee.paymentInstructions }}</small>
          </div>

          <div class="card-actions">
            <button type="button" class="btn-action edit" (click)="openEditModal(fee)">Edit</button>
            <button
              type="button"
              class="btn-action"
              [class.activate]="!fee.isActive"
              [class.deactivate]="fee.isActive"
              (click)="toggleFeeActive(fee)"
            >
              {{ fee.isActive ? 'Deactivate' : 'Activate' }}
            </button>
            <button type="button" class="btn-action delete" (click)="confirmDelete(fee)">Delete</button>
          </div>
        </div>
      </div>

      <!-- Create / Edit Fee Structure Modal -->
      <div *ngIf="showModal" class="modal-backdrop">
        <div class="modal-card wide-modal">
          <div class="modal-header">
            <h4>{{ isEditing ? 'Edit Fee Structure Schedule' : 'Configure New Fee Structure' }}</h4>
            <button type="button" class="btn-close-modal" (click)="closeModal()">&times;</button>
          </div>

          <form (ngSubmit)="saveFeeStructure()" class="modal-form">
            <!-- Programme & Session Linking -->
            <div class="form-section-title">1. Programme &amp; Academic Session Association</div>
            <div class="form-grid-2">
              <div class="form-group">
                <label for="feeProg">Academic Programme *</label>
                <select id="feeProg" [(ngModel)]="formData.programme" name="programme" required [disabled]="isEditing">
                  <option value="">-- Choose Academic Programme --</option>
                  <option *ngFor="let p of availableProgrammes" [value]="p._id">
                    {{ p.programmeName }} ({{ p.programmeCode }})
                  </option>
                </select>
              </div>

              <div class="form-group">
                <label for="feeSess">Academic Admission Session *</label>
                <select id="feeSess" [(ngModel)]="formData.academicSession" name="academicSession" required [disabled]="isEditing">
                  <option value="">-- Choose Admission Session --</option>
                  <option *ngFor="let s of availableSessions" [value]="s._id">
                    {{ s.sessionName }} ({{ s.sessionCode }})
                  </option>
                </select>
              </div>
            </div>

            <!-- Base Entry Fees -->
            <div class="form-section-title">2. Application &amp; Admission Entry Fees</div>
            <div class="form-grid-2">
              <div class="form-group">
                <label for="appFee">Application Processing Fee (&#8377;) *</label>
                <input id="appFee" type="number" min="0" [(ngModel)]="formData.applicationFee" name="applicationFee" (input)="recalculateTotal()" required />
              </div>

              <div class="form-group">
                <label for="admFee">One-Time Admission &amp; Enrollment Fee (&#8377;) *</label>
                <input id="admFee" type="number" min="0" [(ngModel)]="formData.admissionFee" name="admissionFee" (input)="recalculateTotal()" required />
              </div>
            </div>

            <!-- Semester-wise Tuition Fees -->
            <div class="form-section-title">
              <span>3. Semester-Wise Tuition Fees</span>
              <button type="button" class="btn-add-row" (click)="addSemesterRow()">+ Add Semester</button>
            </div>

            <div class="dynamic-rows-container">
              <div class="dynamic-row" *ngFor="let sem of formData.semesterFees; let idx = index">
                <div class="col-num">
                  <label>Semester #</label>
                  <input type="number" min="1" [(ngModel)]="sem.semesterNumber" [name]="'semNum_' + idx" />
                </div>
                <div class="col-amt">
                  <label>Tuition Fee (&#8377;)</label>
                  <input type="number" min="0" [(ngModel)]="sem.amount" [name]="'semAmt_' + idx" (input)="recalculateTotal()" />
                </div>
                <button type="button" class="btn-del-row" (click)="removeSemesterRow(idx)" title="Remove semester">&times;</button>
              </div>
            </div>

            <!-- Additional Charges -->
            <div class="form-section-title">
              <span>4. Additional Institutional Charges (Optional)</span>
              <button type="button" class="btn-add-row" (click)="addChargeRow()">+ Add Charge</button>
            </div>

            <div class="dynamic-rows-container" *ngIf="formData.additionalFees?.length">
              <div class="dynamic-row" *ngFor="let ch of formData.additionalFees; let idx = index">
                <div class="col-name">
                  <label>Fee Component Name</label>
                  <input type="text" [(ngModel)]="ch.feeName" [name]="'chName_' + idx" placeholder="e.g. Laboratory Deposit" />
                </div>
                <div class="col-amt">
                  <label>Amount (&#8377;)</label>
                  <input type="number" min="0" [(ngModel)]="ch.amount" [name]="'chAmt_' + idx" (input)="recalculateTotal()" />
                </div>
                <button type="button" class="btn-del-row" (click)="removeChargeRow(idx)" title="Remove charge">&times;</button>
              </div>
            </div>

            <!-- Total Programme Fee Banner -->
            <div class="computed-total-banner">
              <div>
                <span class="total-label">Total Computed Programme Fee:</span>
                <span class="total-big-val">&#8377;{{ computedTotal | number:'1.0-0' }}</span>
              </div>
              <small class="total-hint">
                Sum of Application Fee + Admission Fee + {{ formData.semesterFees?.length || 0 }} Semesters + {{ formData.additionalFees?.length || 0 }} Charges
              </small>
            </div>

            <!-- Terms & Active Flag -->
            <div class="form-section-title">5. Payment Instructions &amp; Policy</div>
            <div class="form-group">
              <label for="payInstructions">Payment Instructions &amp; Bank Transfer Details</label>
              <textarea id="payInstructions" rows="2" [(ngModel)]="formData.paymentInstructions" name="paymentInstructions" placeholder="DD payable at Kolkata or Online NEFT/RTGS IFSC code..."></textarea>
            </div>

            <div class="checkbox-group">
              <label>
                <input type="checkbox" [(ngModel)]="formData.isActive" name="isActive" />
                <span>Mark as Active Fee Schedule for this Programme and Session</span>
              </label>
            </div>

            <div *ngIf="modalError" class="modal-error-banner">
              {{ modalError }}
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="closeModal()">Cancel</button>
              <button type="submit" class="btn-primary" [disabled]="isSaving">
                {{ isSaving ? 'Saving Fee Structure...' : (isEditing ? 'Update Fee Structure' : 'Create Fee Structure') }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div *ngIf="showDeleteModal" class="modal-backdrop">
        <div class="modal-card confirm-modal">
          <div class="modal-header">
            <h4>Confirm Fee Schedule Deletion</h4>
            <button type="button" class="btn-close-modal" (click)="showDeleteModal = false">&times;</button>
          </div>
          <div class="modal-body">
            <p>Are you sure you want to delete this fee structure schedule?</p>
            <p class="warning-text">
              &#9888; Deactivation is recommended if you wish to preserve historical auditing for past admissions.
            </p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" (click)="showDeleteModal = false">Cancel</button>
            <button type="button" class="btn-danger" (click)="executeDelete()" [disabled]="isDeleting">
              {{ isDeleting ? 'Deleting...' : 'Delete Fee Schedule' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .fees-mgmt-page {
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
    .toolbar-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1rem 1.25rem;
      margin-bottom: 1.5rem;
    }
    .filter-controls {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .filter-controls select {
      padding: 0.55rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 0.85rem;
      background: #ffffff;
    }
    .btn-reset {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 0.55rem 0.85rem;
      border-radius: 4px;
      font-size: 0.8rem;
      cursor: pointer;
    }
    .fees-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 1.25rem;
    }
    .fee-card-item {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.35rem;
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .fee-card-item.inactive {
      opacity: 0.75;
      background: #fcfcfd;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .prog-code-badge {
      font-size: 0.75rem;
      font-weight: 700;
      background: #0f2b48;
      color: #ffffff;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      margin-right: 0.4rem;
    }
    .session-pill {
      font-size: 0.75rem;
      color: #64748b;
      background: #f1f5f9;
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
    }
    .status-pill {
      display: inline-block;
      padding: 0.2rem 0.55rem;
      border-radius: 12px;
      font-size: 0.7rem;
      font-weight: 700;
    }
    .status-pill.active { background: #dcfce7; color: #15803d; }
    .status-pill.inactive { background: #fee2e2; color: #b91c1c; }
    .prog-title {
      margin: 0 0 1rem;
      font-size: 1.05rem;
      color: #1e293b;
    }
    .fee-summary-numbers {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 0.5rem;
      background: #f8fafc;
      padding: 0.75rem;
      border-radius: 6px;
      margin-bottom: 1rem;
    }
    .num-box {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .num-box .label { font-size: 0.7rem; color: #64748b; }
    .total-amount { color: #059669; font-size: 1.05rem; }
    .semesters-breakdown, .charges-breakdown {
      margin-bottom: 0.85rem;
    }
    .semesters-breakdown h5, .charges-breakdown h5 {
      margin: 0 0 0.4rem;
      font-size: 0.8rem;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .sem-chips, .charges-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }
    .sem-chip, .charge-chip {
      background: #e0f2fe;
      color: #0369a1;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
    }
    .instructions-snippet {
      background: #fdf8eb;
      padding: 0.5rem 0.75rem;
      border-radius: 4px;
      font-size: 0.75rem;
      color: #92400e;
      margin-bottom: 1rem;
    }
    .card-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.4rem;
      border-top: 1px solid #edf2f7;
      padding-top: 0.85rem;
      margin-top: 0.5rem;
    }
    .btn-action {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 0.3rem 0.65rem;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-action.edit { color: #0f2b48; }
    .btn-action.activate { color: #059669; background: #ecfdf5; border-color: #a7f3d0; }
    .btn-action.deactivate { color: #d97706; background: #fffbeb; border-color: #fde68a; }
    .btn-action.delete { color: #dc2626; background: #fef2f2; border-color: #fecaca; }
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
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    }
    .wide-modal { max-width: 800px; }
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
    .form-section-title {
      font-size: 0.85rem;
      font-weight: 700;
      color: #0f2b48;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 1.25rem 0 0.75rem;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 0.35rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .form-section-title:first-child { margin-top: 0; }
    .btn-add-row {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      cursor: pointer;
      color: #0f2b48;
      font-weight: 600;
    }
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
    .dynamic-rows-container {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .dynamic-row {
      display: flex;
      gap: 0.75rem;
      align-items: flex-end;
      background: #f8fafc;
      padding: 0.5rem 0.75rem;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }
    .dynamic-row .col-num { width: 110px; }
    .dynamic-row .col-amt { flex: 1; }
    .dynamic-row .col-name { flex: 2; }
    .dynamic-row label { font-size: 0.7rem; color: #64748b; margin-bottom: 0.2rem; display: block; }
    .dynamic-row input {
      width: 100%;
      padding: 0.4rem 0.6rem;
      font-size: 0.85rem;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      box-sizing: border-box;
    }
    .btn-del-row {
      background: #fee2e2;
      color: #dc2626;
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 4px;
      font-size: 1.1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .computed-total-banner {
      background: #ecfdf5;
      border: 1px solid #10b981;
      border-radius: 6px;
      padding: 1rem 1.25rem;
      margin: 1.25rem 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .total-label { font-size: 0.9rem; font-weight: 700; color: #065f46; margin-right: 0.5rem; }
    .total-big-val { font-size: 1.4rem; font-weight: 800; color: #047857; }
    .total-hint { color: #059669; font-size: 0.8rem; }
    .checkbox-group { margin: 0.75rem 0 1rem; }
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
export class AdminFeesComponent implements OnInit {
  private adminService = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);

  public feeStructures: FeeStructure[] = [];
  public availableProgrammes: Programme[] = [];
  public availableSessions: AcademicSession[] = [];
  public isLoading = false;
  public errorMessage = '';
  public successMessage = '';

  // Filter state
  public filterProgrammeId = '';
  public filterSessionId = '';
  public filterActiveStatus = '';

  // Modal State
  public showModal = false;
  public isEditing = false;
  public editingId = '';
  public isSaving = false;
  public modalError = '';

  public formData: any = this.getFreshFormData();

  // Delete State
  public showDeleteModal = false;
  public feeToDelete: FeeStructure | null = null;
  public isDeleting = false;

  get computedTotal(): number {
    const appFee = Number(this.formData.applicationFee) || 0;
    const admFee = Number(this.formData.admissionFee) || 0;
    const semSum = (this.formData.semesterFees || []).reduce(
      (sum: number, s: SemesterFee) => sum + (Number(s.amount) || 0),
      0
    );
    const addSum = (this.formData.additionalFees || []).reduce(
      (sum: number, a: AdditionalFee) => sum + (Number(a.amount) || 0),
      0
    );
    return appFee + admFee + semSum + addSum;
  }

  ngOnInit(): void {
    this.loadFeeStructures();
    this.loadAuxiliaryData();
  }

  loadFeeStructures(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    this.adminService
      .getFeeStructures({
        programme: this.filterProgrammeId,
        session: this.filterSessionId,
        isActive: this.filterActiveStatus !== '' ? this.filterActiveStatus === 'true' : undefined
      })
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          this.feeStructures = res.data || [];
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = err.error?.message || 'Failed to load fee structures.';
          this.cdr.markForCheck();
        }
      });
  }

  loadAuxiliaryData(): void {
    this.adminService.getProgrammes({ limit: 100 }).subscribe({
      next: (res) => {
        this.availableProgrammes = res.data?.programmes || [];
        this.cdr.markForCheck();
      },
      error: () => {}
    });

    this.adminService.getSessions().subscribe({
      next: (res) => {
        this.availableSessions = res.data || [];
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  onFilterChange(): void {
    this.loadFeeStructures();
  }

  resetFilters(): void {
    this.filterProgrammeId = '';
    this.filterSessionId = '';
    this.filterActiveStatus = '';
    this.loadFeeStructures();
  }

  getFreshFormData(): any {
    return {
      programme: '',
      academicSession: '',
      applicationFee: 1000,
      admissionFee: 25000,
      semesterFees: [
        { semesterNumber: 1, amount: 60000 },
        { semesterNumber: 2, amount: 60000 },
        { semesterNumber: 3, amount: 60000 },
        { semesterNumber: 4, amount: 60000 },
        { semesterNumber: 5, amount: 60000 },
        { semesterNumber: 6, amount: 60000 },
        { semesterNumber: 7, amount: 60000 },
        { semesterNumber: 8, amount: 60000 }
      ],
      additionalFees: [
        { feeName: 'Library & Laboratory Deposit', amount: 5000 }
      ],
      paymentInstructions: 'Payable via Online Banking (NEFT/RTGS) or DD in favour of Institute of Engineering & Management payable at Kolkata.',
      isActive: true
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

  openEditModal(fee: FeeStructure): void {
    this.isEditing = true;
    this.editingId = fee._id;
    this.formData = {
      programme: fee.programme?._id || fee.programme,
      academicSession: fee.academicSession?._id || fee.academicSession,
      applicationFee: fee.applicationFee,
      admissionFee: fee.admissionFee,
      semesterFees: fee.semesterFees ? JSON.parse(JSON.stringify(fee.semesterFees)) : [],
      additionalFees: fee.additionalFees ? JSON.parse(JSON.stringify(fee.additionalFees)) : [],
      paymentInstructions: fee.paymentInstructions || '',
      isActive: fee.isActive !== false
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

  addSemesterRow(): void {
    const nextNum = (this.formData.semesterFees?.length || 0) + 1;
    this.formData.semesterFees.push({ semesterNumber: nextNum, amount: 60000 });
    this.cdr.markForCheck();
  }

  removeSemesterRow(idx: number): void {
    this.formData.semesterFees.splice(idx, 1);
    this.cdr.markForCheck();
  }

  addChargeRow(): void {
    if (!this.formData.additionalFees) this.formData.additionalFees = [];
    this.formData.additionalFees.push({ feeName: '', amount: 0 });
    this.cdr.markForCheck();
  }

  removeChargeRow(idx: number): void {
    this.formData.additionalFees.splice(idx, 1);
    this.cdr.markForCheck();
  }

  recalculateTotal(): void {
    this.cdr.markForCheck();
  }

  saveFeeStructure(): void {
    // Non-negative validation
    if (this.formData.applicationFee < 0 || this.formData.admissionFee < 0) {
      this.modalError = 'Application and Admission fees must be non-negative.';
      this.cdr.markForCheck();
      return;
    }

    for (const sem of this.formData.semesterFees || []) {
      if (sem.amount < 0) {
        this.modalError = `Semester ${sem.semesterNumber} fee cannot be negative.`;
        this.cdr.markForCheck();
        return;
      }
    }

    this.isSaving = true;
    this.modalError = '';
    this.cdr.markForCheck();

    const payload = {
      ...this.formData,
      totalProgrammeFee: this.computedTotal
    };

    const request$ = this.isEditing
      ? this.adminService.updateFeeStructure(this.editingId, payload)
      : this.adminService.createFeeStructure(payload);

    request$.subscribe({
      next: () => {
        this.isSaving = false;
        this.showModal = false;
        this.successMessage = 'Fee structure saved successfully.';
        this.loadFeeStructures();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isSaving = false;
        this.modalError = err.error?.message || 'Failed to save fee structure.';
        this.cdr.markForCheck();
      }
    });
  }

  toggleFeeActive(fee: FeeStructure): void {
    const action$ = fee.isActive
      ? this.adminService.deactivateFeeStructure(fee._id)
      : this.adminService.activateFeeStructure(fee._id);

    action$.subscribe({
      next: () => {
        this.successMessage = `Fee structure ${fee.isActive ? 'deactivated' : 'activated'} successfully.`;
        this.loadFeeStructures();
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Failed to toggle fee schedule status.';
        this.cdr.markForCheck();
      }
    });
  }

  confirmDelete(fee: FeeStructure): void {
    this.feeToDelete = fee;
    this.showDeleteModal = true;
    this.cdr.markForCheck();
  }

  executeDelete(): void {
    if (!this.feeToDelete) return;
    this.isDeleting = true;
    this.cdr.markForCheck();

    this.adminService.deleteFeeStructure(this.feeToDelete._id).subscribe({
      next: () => {
        this.isDeleting = false;
        this.showDeleteModal = false;
        this.successMessage = 'Fee structure deleted successfully.';
        this.feeToDelete = null;
        this.loadFeeStructures();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isDeleting = false;
        this.showDeleteModal = false;
        this.errorMessage = err.error?.message || 'Failed to delete fee structure.';
        this.feeToDelete = null;
        this.cdr.markForCheck();
      }
    });
  }
}
