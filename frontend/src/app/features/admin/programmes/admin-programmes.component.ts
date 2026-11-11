import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { Programme, CategoryAllocation } from '../../../core/models/programme.model';
import { AcademicSession } from '../../../core/models/session.model';

@Component({
  selector: 'app-admin-programmes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="programmes-mgmt-page">
      <!-- Section Header -->
      <div class="mgmt-header">
        <div>
          <h3>Academic Programmes Management</h3>
          <p>Configure degree offerings, eligibility benchmarks, seat allocations and application availability.</p>
        </div>
        <button type="button" class="btn-primary" (click)="openCreateModal()">
          + Create New Programme
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
        <div class="search-box">
          <input
            type="text"
            [(ngModel)]="searchQuery"
            (ngModelChange)="onFilterChange()"
            placeholder="Search by programme name, code or department..."
          />
        </div>

        <div class="filter-controls">
          <select [(ngModel)]="selectedDepartment" (change)="onFilterChange()">
            <option value="">All Departments</option>
            <option value="Computer Science & Engineering">Computer Science & Engineering</option>
            <option value="Information Technology">Information Technology</option>
            <option value="Electronics & Communication Engineering">Electronics & Communication Engineering</option>
            <option value="Electrical Engineering">Electrical Engineering</option>
            <option value="Mechanical Engineering">Mechanical Engineering</option>
            <option value="Biotechnology">Biotechnology</option>
          </select>

          <select [(ngModel)]="selectedDegreeLevel" (change)="onFilterChange()">
            <option value="">All Degree Levels</option>
            <option value="Undergraduate">Undergraduate</option>
            <option value="Postgraduate">Postgraduate</option>
            <option value="Diploma">Diploma</option>
            <option value="Doctoral">Doctoral</option>
          </select>

          <select [(ngModel)]="selectedActiveFilter" (change)="onFilterChange()">
            <option value="">All Statuses</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>

          <button type="button" class="btn-reset" (click)="resetFilters()">Reset</button>
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="isLoading" class="state-card loading">
        <div class="spinner"></div>
        <p>Loading programmes catalogue...</p>
      </div>

      <!-- Empty State -->
      <div *ngIf="!isLoading && programmes.length === 0" class="state-card empty">
        <h4>No Academic Programmes Found</h4>
        <p>No programmes match your current filters. Adjust your criteria or create a new programme.</p>
        <button type="button" class="btn-primary" (click)="openCreateModal()">Create Programme</button>
      </div>

      <!-- Programmes Table Grid -->
      <div *ngIf="!isLoading && programmes.length > 0" class="table-card">
        <table class="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Programme Name</th>
              <th>Degree &amp; Dept</th>
              <th>Duration</th>
              <th>Seat Capacity</th>
              <th>Min %</th>
              <th>App Status</th>
              <th>State</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let prog of programmes" [class.inactive-row]="!prog.isActive">
              <td>
                <span class="code-badge">{{ prog.programmeCode }}</span>
              </td>
              <td>
                <strong>{{ prog.programmeName }}</strong>
                <div class="text-muted sub-text" *ngIf="prog.academicSession">
                  Session: {{ prog.academicSession.sessionName }}
                </div>
              </td>
              <td>
                <div>{{ prog.degree }}</div>
                <small class="text-muted">{{ prog.department }}</small>
              </td>
              <td>{{ prog.duration }} {{ prog.durationUnit || 'years' }}</td>
              <td>
                <div class="seat-badge">
                  <strong>{{ prog.seatCapacity?.total || 0 }}</strong> total
                </div>
                <small class="text-muted" *ngIf="prog.seatCapacity?.categoryAllocations?.length">
                  {{ getAllocatedSeats(prog) }} allocated
                </small>
              </td>
              <td>{{ prog.eligibility?.minClass12Percentage || 60 }}%</td>
              <td>
                <span class="status-pill" [class.open]="prog.isApplicationOpen" [class.closed]="!prog.isApplicationOpen">
                  {{ prog.isApplicationOpen ? 'Open' : 'Closed' }}
                </span>
              </td>
              <td>
                <span class="status-pill" [class.active]="prog.isActive" [class.inactive]="!prog.isActive">
                  {{ prog.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="text-right actions-cell">
                <button type="button" class="btn-action edit" (click)="openEditModal(prog)" title="Edit Programme">
                  Edit
                </button>

                <button
                  type="button"
                  class="btn-action"
                  [class.activate]="!prog.isActive"
                  [class.deactivate]="prog.isActive"
                  (click)="toggleProgrammeActive(prog)"
                >
                  {{ prog.isActive ? 'Deactivate' : 'Activate' }}
                </button>

                <button
                  type="button"
                  class="btn-action toggle-app"
                  (click)="toggleApplicationOpen(prog)"
                  title="Toggle accepting applications"
                >
                  {{ prog.isApplicationOpen ? 'Close Apps' : 'Open Apps' }}
                </button>

                <button type="button" class="btn-action delete" (click)="confirmDelete(prog)" title="Delete Programme">
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Create / Edit Modal -->
      <div *ngIf="showModal" class="modal-backdrop">
        <div class="modal-card wide-modal">
          <div class="modal-header">
            <h4>{{ isEditing ? 'Edit Academic Programme' : 'Create New Academic Programme' }}</h4>
            <button type="button" class="btn-close-modal" (click)="closeModal()">&times;</button>
          </div>

          <form (ngSubmit)="saveProgramme()" class="modal-form">
            <!-- Basic Details -->
            <div class="form-section-title">1. Basic Identification &amp; Degree</div>
            <div class="form-grid-2">
              <div class="form-group">
                <label for="progName">Programme Name *</label>
                <input id="progName" type="text" [(ngModel)]="formData.programmeName" name="programmeName" required placeholder="e.g. B.Tech in Computer Science & Engineering" />
              </div>

              <div class="form-group">
                <label for="progCode">Programme Code * (Uppercase, Unique)</label>
                <input id="progCode" type="text" [(ngModel)]="formData.programmeCode" name="programmeCode" required placeholder="e.g. BTECH-CSE" [disabled]="isEditing" />
              </div>
            </div>

            <div class="form-grid-3">
              <div class="form-group">
                <label for="degreeLevel">Degree Level *</label>
                <select id="degreeLevel" [(ngModel)]="formData.degreeLevel" name="degreeLevel" required>
                  <option value="Undergraduate">Undergraduate</option>
                  <option value="Postgraduate">Postgraduate</option>
                  <option value="Diploma">Diploma</option>
                  <option value="Doctoral">Doctoral</option>
                </select>
              </div>

              <div class="form-group">
                <label for="degree">Degree Designation *</label>
                <input id="degree" type="text" [(ngModel)]="formData.degree" name="degree" required placeholder="e.g. B.Tech, M.Tech, BCA" />
              </div>

              <div class="form-group">
                <label for="dept">Department *</label>
                <select id="dept" [(ngModel)]="formData.department" name="department" required>
                  <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Electronics & Communication Engineering">Electronics & Communication Engineering</option>
                  <option value="Electrical Engineering">Electrical Engineering</option>
                  <option value="Mechanical Engineering">Mechanical Engineering</option>
                  <option value="Biotechnology">Biotechnology</option>
                </select>
              </div>
            </div>

            <div class="form-grid-3">
              <div class="form-group">
                <label for="duration">Duration (Numeric) *</label>
                <input id="duration" type="number" step="0.5" min="0.5" [(ngModel)]="formData.duration" name="duration" required placeholder="4" />
              </div>

              <div class="form-group">
                <label for="durationUnit">Duration Unit *</label>
                <select id="durationUnit" [(ngModel)]="formData.durationUnit" name="durationUnit" required>
                  <option value="years">Years</option>
                  <option value="semesters">Semesters</option>
                  <option value="months">Months</option>
                </select>
              </div>

              <div class="form-group">
                <label for="sessionRef">Primary Academic Session</label>
                <select id="sessionRef" [(ngModel)]="formData.academicSession" name="academicSession">
                  <option [ngValue]="null">-- Select Session --</option>
                  <option *ngFor="let s of availableSessions" [value]="s._id">
                    {{ s.sessionName }} ({{ s.sessionCode }})
                  </option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label for="desc">Programme Description</label>
              <textarea id="desc" rows="2" [(ngModel)]="formData.description" name="description" placeholder="Brief overview of the curriculum and objectives..."></textarea>
            </div>

            <!-- Seat Capacity & Category Allocations -->
            <div class="form-section-title">2. Seat Capacity &amp; Category Allocations</div>
            <div class="seat-allocation-box">
              <div class="form-grid-2">
                <div class="form-group">
                  <label for="totalSeats">Total Seat Capacity *</label>
                  <input id="totalSeats" type="number" min="1" [(ngModel)]="formData.seatCapacity.total" name="totalSeats" (input)="computeSeatBalance()" required placeholder="e.g. 120" />
                </div>

                <div class="seat-balance-indicator" [class.error]="remainingSeats < 0">
                  <span class="balance-label">Allocation Balance:</span>
                  <strong>{{ allocatedSeatsSum }} / {{ formData.seatCapacity.total || 0 }} seats allocated</strong>
                  <span class="unallocated" *ngIf="remainingSeats >= 0">({{ remainingSeats }} unallocated)</span>
                  <span class="overflow-err" *ngIf="remainingSeats < 0">&#9888; Exceeds total capacity by {{ -remainingSeats }} seats!</span>
                </div>
              </div>

              <div class="category-grid">
                <div class="cat-item" *ngFor="let cat of formData.seatCapacity.categoryAllocations; let idx = index">
                  <label>{{ cat.category }} Seats</label>
                  <input type="number" min="0" [(ngModel)]="cat.seats" [name]="'catSeats_' + idx" (input)="computeSeatBalance()" />
                </div>
              </div>
            </div>

            <!-- Eligibility Criteria -->
            <div class="form-section-title">3. Eligibility Requirements</div>
            <div class="form-grid-2">
              <div class="form-group">
                <label for="minPercentage">Minimum Class 12 Aggregate Percentage (%)</label>
                <input id="minPercentage" type="number" min="0" max="100" [(ngModel)]="formData.eligibility.minClass12Percentage" name="minClass12Percentage" placeholder="60" />
              </div>

              <div class="form-group">
                <label for="entranceExams">Accepted Entrance Exams (Comma-separated)</label>
                <input id="entranceExams" type="text" [(ngModel)]="rawAcceptedExams" name="rawAcceptedExams" placeholder="WBJEE, JEE Main" />
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label for="reqSubjects">Required Class 12 Subjects (Comma-separated)</label>
                <input id="reqSubjects" type="text" [(ngModel)]="rawRequiredSubjects" name="rawRequiredSubjects" placeholder="Physics, Mathematics, Chemistry" />
              </div>

              <div class="form-group">
                <label for="acceptedStreams">Accepted Academic Streams (Comma-separated)</label>
                <input id="acceptedStreams" type="text" [(ngModel)]="rawAcceptedStreams" name="rawAcceptedStreams" placeholder="Science (PCM), Science (General)" />
              </div>
            </div>

            <!-- Availability & Flags -->
            <div class="form-section-title">4. Flags &amp; Availability</div>
            <div class="form-grid-3">
              <div class="checkbox-group">
                <label>
                  <input type="checkbox" [(ngModel)]="formData.isActive" name="isActive" />
                  <span>Active Programme</span>
                </label>
              </div>

              <div class="checkbox-group">
                <label>
                  <input type="checkbox" [(ngModel)]="formData.isApplicationOpen" name="isApplicationOpen" />
                  <span>Accepting Applications</span>
                </label>
              </div>

              <div class="form-group">
                <label for="dispOrder">Display Order</label>
                <input id="dispOrder" type="number" min="0" [(ngModel)]="formData.displayOrder" name="displayOrder" />
              </div>
            </div>

            <div *ngIf="modalError" class="modal-error-banner">
              {{ modalError }}
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="closeModal()">Cancel</button>
              <button type="submit" class="btn-primary" [disabled]="isSaving || remainingSeats < 0">
                {{ isSaving ? 'Saving Programme...' : (isEditing ? 'Update Programme' : 'Create Programme') }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div *ngIf="showDeleteModal" class="modal-backdrop">
        <div class="modal-card confirm-modal">
          <div class="modal-header">
            <h4>Confirm Programme Deletion</h4>
            <button type="button" class="btn-close-modal" (click)="showDeleteModal = false">&times;</button>
          </div>
          <div class="modal-body">
            <p>
              Are you sure you want to delete programme <strong>{{ programmeToDelete?.programmeName }}</strong> ({{ programmeToDelete?.programmeCode }})?
            </p>
            <p class="warning-text">
              &#9888; If candidate applications reference this programme, deletion will be blocked by database integrity rules. Deactivation is recommended instead.
            </p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" (click)="showDeleteModal = false">Cancel</button>
            <button type="button" class="btn-danger" (click)="executeDelete()" [disabled]="isDeleting">
              {{ isDeleting ? 'Deleting...' : 'Delete Programme' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .programmes-mgmt-page {
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
    .toolbar-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1rem 1.25rem;
      margin-bottom: 1.5rem;
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: center;
      justify-content: space-between;
    }
    .search-box input {
      padding: 0.55rem 0.85rem;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 0.85rem;
      min-width: 280px;
    }
    .filter-controls {
      display: flex;
      gap: 0.65rem;
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
    .inactive-row {
      background: #fcfcfd;
      opacity: 0.75;
    }
    .code-badge {
      font-size: 0.75rem;
      font-weight: 700;
      background: #0f2b48;
      color: #ffffff;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
    }
    .text-muted { color: #64748b; }
    .sub-text { font-size: 0.75rem; margin-top: 0.2rem; }
    .status-pill {
      display: inline-block;
      padding: 0.2rem 0.55rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .status-pill.open, .status-pill.active {
      background: #dcfce7;
      color: #15803d;
    }
    .status-pill.closed, .status-pill.inactive {
      background: #fee2e2;
      color: #b91c1c;
    }
    .actions-cell {
      white-space: nowrap;
    }
    .text-right { text-align: right; }
    .btn-action {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 0.3rem 0.6rem;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      margin-left: 0.35rem;
      transition: all 0.15s;
    }
    .btn-action.edit {
      color: #0f2b48;
    }
    .btn-action.activate {
      color: #059669;
      border-color: #a7f3d0;
      background: #ecfdf5;
    }
    .btn-action.deactivate {
      color: #d97706;
      border-color: #fde68a;
      background: #fffbeb;
    }
    .btn-action.toggle-app {
      color: #2b6cb0;
    }
    .btn-action.delete {
      color: #dc2626;
      border-color: #fecaca;
      background: #fef2f2;
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
    /* Modal Styles */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
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
    .wide-modal { max-width: 840px; }
    .confirm-modal { max-width: 480px; padding: 1.5rem; }
    .modal-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid #edf2f7;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .modal-header h4 {
      margin: 0;
      color: #0f2b48;
      font-size: 1.15rem;
    }
    .btn-close-modal {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #64748b;
    }
    .modal-form {
      padding: 1.5rem;
    }
    .form-section-title {
      font-size: 0.85rem;
      font-weight: 700;
      color: #0f2b48;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 1.25rem 0 0.75rem;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 0.35rem;
    }
    .form-section-title:first-child { margin-top: 0; }
    .form-grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 0.75rem;
    }
    .form-grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 1rem;
      margin-bottom: 0.75rem;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      margin-bottom: 0.75rem;
    }
    .form-group label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #334155;
    }
    .form-group input, .form-group select, .form-group textarea {
      padding: 0.55rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 0.85rem;
    }
    .seat-allocation-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 1rem;
      margin-bottom: 1rem;
    }
    .seat-balance-indicator {
      display: flex;
      flex-direction: column;
      justify-content: center;
      background: #ffffff;
      padding: 0.5rem 0.85rem;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
      font-size: 0.85rem;
    }
    .seat-balance-indicator.error {
      border-color: #ef4444;
      background: #fef2f2;
    }
    .balance-label { font-size: 0.75rem; color: #64748b; }
    .unallocated { color: #059669; font-weight: 600; }
    .overflow-err { color: #dc2626; font-weight: 700; font-size: 0.8rem; }
    .category-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 0.75rem;
      margin-top: 0.75rem;
    }
    .cat-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .cat-item label { font-size: 0.75rem; color: #475569; font-weight: 600; }
    .cat-item input { padding: 0.4rem; font-size: 0.85rem; border: 1px solid #cbd5e1; border-radius: 4px; }
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
export class AdminProgrammesComponent implements OnInit {
  private adminService = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);

  public programmes: Programme[] = [];
  public availableSessions: AcademicSession[] = [];
  public isLoading = false;
  public errorMessage = '';
  public successMessage = '';

  // Filter state
  public searchQuery = '';
  public selectedDepartment = '';
  public selectedDegreeLevel = '';
  public selectedActiveFilter = '';

  // Modal state
  public showModal = false;
  public isEditing = false;
  public editingId = '';
  public isSaving = false;
  public modalError = '';

  public rawAcceptedExams = '';
  public rawRequiredSubjects = '';
  public rawAcceptedStreams = '';

  public formData: any = this.getFreshFormData();

  // Delete modal state
  public showDeleteModal = false;
  public programmeToDelete: Programme | null = null;
  public isDeleting = false;

  get allocatedSeatsSum(): number {
    return (this.formData.seatCapacity?.categoryAllocations || []).reduce(
      (acc: number, item: CategoryAllocation) => acc + (Number(item.seats) || 0),
      0
    );
  }

  get remainingSeats(): number {
    const total = Number(this.formData.seatCapacity?.total) || 0;
    return total - this.allocatedSeatsSum;
  }

  ngOnInit(): void {
    this.loadProgrammes();
    this.loadSessions();
  }

  loadProgrammes(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    this.adminService
      .getProgrammes({
        search: this.searchQuery,
        department: this.selectedDepartment,
        degreeLevel: this.selectedDegreeLevel,
        isActive: this.selectedActiveFilter,
        limit: 100
      })
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          this.programmes = res.data?.programmes || [];
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = err.error?.message || 'Failed to load programmes catalogue.';
          this.cdr.markForCheck();
        }
      });
  }

  loadSessions(): void {
    this.adminService.getSessions().subscribe({
      next: (res) => {
        this.availableSessions = res.data || [];
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  onFilterChange(): void {
    this.loadProgrammes();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.selectedDepartment = '';
    this.selectedDegreeLevel = '';
    this.selectedActiveFilter = '';
    this.loadProgrammes();
  }

  getAllocatedSeats(prog: Programme): number {
    return (prog.seatCapacity?.categoryAllocations || []).reduce(
      (sum, item) => sum + (item.seats || 0),
      0
    );
  }

  getFreshFormData(): any {
    return {
      programmeName: '',
      programmeCode: '',
      degreeLevel: 'Undergraduate',
      department: 'Computer Science & Engineering',
      degree: 'B.Tech',
      duration: 4,
      durationUnit: 'years',
      academicSession: null,
      description: '',
      displayOrder: 0,
      isActive: true,
      isApplicationOpen: true,
      seatCapacity: {
        total: 120,
        categoryAllocations: [
          { category: 'General', seats: 60 },
          { category: 'OBC', seats: 20 },
          { category: 'SC', seats: 18 },
          { category: 'ST', seats: 8 },
          { category: 'EWS', seats: 10 },
          { category: 'Management', seats: 4 }
        ]
      },
      eligibility: {
        minClass12Percentage: 60,
        acceptedAcademicStreams: ['Science (PCM)'],
        requiredClass12Subjects: ['Physics', 'Mathematics', 'Chemistry'],
        acceptedEntranceExams: ['WBJEE', 'JEE Main'],
        minEntranceScore: ''
      }
    };
  }

  openCreateModal(): void {
    this.isEditing = false;
    this.editingId = '';
    this.formData = this.getFreshFormData();
    this.rawAcceptedExams = 'WBJEE, JEE Main';
    this.rawRequiredSubjects = 'Physics, Mathematics, Chemistry';
    this.rawAcceptedStreams = 'Science (PCM)';
    this.modalError = '';
    this.showModal = true;
    this.cdr.markForCheck();
  }

  openEditModal(prog: Programme): void {
    this.isEditing = true;
    this.editingId = prog._id;
    this.formData = {
      programmeName: prog.programmeName,
      programmeCode: prog.programmeCode,
      degreeLevel: prog.degreeLevel,
      department: prog.department,
      degree: prog.degree,
      duration: prog.duration,
      durationUnit: prog.durationUnit || 'years',
      academicSession: prog.academicSession?._id || prog.academicSession || null,
      description: prog.description || '',
      displayOrder: prog.displayOrder || 0,
      isActive: prog.isActive !== false,
      isApplicationOpen: prog.isApplicationOpen !== false,
      seatCapacity: {
        total: prog.seatCapacity?.total || 60,
        categoryAllocations:
          prog.seatCapacity?.categoryAllocations && prog.seatCapacity.categoryAllocations.length > 0
            ? JSON.parse(JSON.stringify(prog.seatCapacity.categoryAllocations))
            : [
                { category: 'General', seats: 0 },
                { category: 'OBC', seats: 0 },
                { category: 'SC', seats: 0 },
                { category: 'ST', seats: 0 },
                { category: 'EWS', seats: 0 },
                { category: 'Management', seats: 0 }
              ]
      },
      eligibility: {
        minClass12Percentage: prog.eligibility?.minClass12Percentage || 60,
        minEntranceScore: prog.eligibility?.minEntranceScore || ''
      }
    };

    this.rawAcceptedExams = (prog.eligibility?.acceptedEntranceExams || []).join(', ');
    this.rawRequiredSubjects = (prog.eligibility?.requiredClass12Subjects || []).join(', ');
    this.rawAcceptedStreams = (prog.eligibility?.acceptedAcademicStreams || []).join(', ');

    this.modalError = '';
    this.showModal = true;
    this.cdr.markForCheck();
  }

  closeModal(): void {
    this.showModal = false;
    this.modalError = '';
    this.cdr.markForCheck();
  }

  computeSeatBalance(): void {
    this.cdr.markForCheck();
  }

  saveProgramme(): void {
    if (this.remainingSeats < 0) {
      this.modalError = `Category seat allocations exceed total capacity by ${-this.remainingSeats} seats.`;
      this.cdr.markForCheck();
      return;
    }

    this.isSaving = true;
    this.modalError = '';
    this.cdr.markForCheck();

    // Parse comma-separated fields
    const payload = { ...this.formData };
    payload.eligibility = {
      ...payload.eligibility,
      acceptedEntranceExams: this.rawAcceptedExams
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      requiredClass12Subjects: this.rawRequiredSubjects
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      acceptedAcademicStreams: this.rawAcceptedStreams
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    };

    const request$ = this.isEditing
      ? this.adminService.updateProgramme(this.editingId, payload)
      : this.adminService.createProgramme(payload);

    request$.subscribe({
      next: () => {
        this.isSaving = false;
        this.showModal = false;
        this.successMessage = `Programme '${payload.programmeCode}' saved successfully.`;
        this.loadProgrammes();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isSaving = false;
        this.modalError = err.error?.message || 'Failed to save academic programme.';
        this.cdr.markForCheck();
      }
    });
  }

  toggleProgrammeActive(prog: Programme): void {
    const action$ = prog.isActive
      ? this.adminService.deactivateProgramme(prog._id)
      : this.adminService.activateProgramme(prog._id);

    action$.subscribe({
      next: () => {
        this.successMessage = `Programme '${prog.programmeCode}' ${prog.isActive ? 'deactivated' : 'activated'} successfully.`;
        this.loadProgrammes();
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Failed to toggle programme active status.';
        this.cdr.markForCheck();
      }
    });
  }

  toggleApplicationOpen(prog: Programme): void {
    const newStatus = !prog.isApplicationOpen;
    this.adminService
      .updateProgramme(prog._id, { isApplicationOpen: newStatus })
      .subscribe({
        next: () => {
          this.successMessage = `Application status for '${prog.programmeCode}' updated to ${newStatus ? 'Open' : 'Closed'}.`;
          this.loadProgrammes();
        },
        error: (err) => {
          this.errorMessage = err.error?.message || 'Failed to update application status.';
          this.cdr.markForCheck();
        }
      });
  }

  confirmDelete(prog: Programme): void {
    this.programmeToDelete = prog;
    this.showDeleteModal = true;
    this.cdr.markForCheck();
  }

  executeDelete(): void {
    if (!this.programmeToDelete) return;

    this.isDeleting = true;
    this.cdr.markForCheck();

    this.adminService.deleteProgramme(this.programmeToDelete._id).subscribe({
      next: () => {
        this.isDeleting = false;
        this.showDeleteModal = false;
        this.successMessage = `Programme '${this.programmeToDelete?.programmeCode}' deleted successfully.`;
        this.programmeToDelete = null;
        this.loadProgrammes();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isDeleting = false;
        this.showDeleteModal = false;
        this.errorMessage = err.error?.message || 'Failed to delete programme.';
        this.programmeToDelete = null;
        this.cdr.markForCheck();
      }
    });
  }
}
