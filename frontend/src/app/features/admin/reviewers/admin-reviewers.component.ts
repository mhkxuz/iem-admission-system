import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/user.model';

@Component({
  selector: 'app-admin-reviewers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="reviewers-container">
      <!-- Section Header -->
      <div class="section-header">
        <div>
          <h3>Reviewer &amp; Staff Access Management</h3>
          <p class="section-desc">Manage document verification staff, assign reviewer privileges, and inspect user roles</p>
        </div>
        <div class="header-actions">
          <a routerLink="/reviewer/dashboard" class="btn-reviewer-desk">
            Open Document Verification Desk &rarr;
          </a>
          <button type="button" class="btn-primary-action" (click)="openCreateModal()">
            + Add New Reviewer
          </button>
        </div>
      </div>

      <!-- Feedback Messages -->
      <div *ngIf="successMessage" class="alert-box success">
        <span>{{ successMessage }}</span>
        <button class="btn-close-alert" (click)="successMessage = ''">&times;</button>
      </div>
      <div *ngIf="errorMessage" class="alert-box error">
        <span>{{ errorMessage }}</span>
        <button class="btn-close-alert" (click)="errorMessage = ''">&times;</button>
      </div>

      <!-- Metric Cards -->
      <div class="metrics-grid">
        <div class="metric-card" (click)="setRoleFilter('reviewer')">
          <div class="metric-icon reviewer-icon">&#128100;</div>
          <div class="metric-body">
            <span class="metric-num">{{ reviewerCount }}</span>
            <span class="metric-label">Active Reviewers</span>
          </div>
        </div>
        <div class="metric-card" (click)="setRoleFilter('applicant')">
          <div class="metric-icon applicant-icon">&#127891;</div>
          <div class="metric-body">
            <span class="metric-num">{{ applicantCount }}</span>
            <span class="metric-label">Applicants</span>
          </div>
        </div>
        <div class="metric-card" (click)="setRoleFilter('all')">
          <div class="metric-icon total-icon">&#128101;</div>
          <div class="metric-body">
            <span class="metric-num">{{ totalUsers }}</span>
            <span class="metric-label">Total Registered Accounts</span>
          </div>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="toolbar-box">
        <div class="search-input-wrap">
          <input
            type="text"
            [(ngModel)]="searchQuery"
            (ngModelChange)="onSearchChange()"
            placeholder="Search by full name, email address or phone..."
          />
        </div>
        <div class="filter-controls">
          <select [(ngModel)]="selectedRole" (change)="applyFilter()">
            <option value="all">All Roles</option>
            <option value="reviewer">Reviewers Only</option>
            <option value="applicant">Applicants</option>
            <option value="admin">Administrators</option>
          </select>
          <button type="button" class="btn-refresh" (click)="loadUsers()">
            &#8635; Refresh
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="isLoading" class="state-card loading">
        <div class="spinner"></div>
        <p>Loading user accounts...</p>
      </div>

      <!-- Error State -->
      <div *ngIf="loadError && !isLoading" class="state-card error-card">
        <p>{{ loadError }}</p>
        <button class="btn-retry" (click)="loadUsers()">Retry</button>
      </div>

      <!-- Empty State -->
      <div *ngIf="!isLoading && !loadError && users.length === 0" class="state-card empty">
        <p>No user accounts found matching your search criteria.</p>
      </div>

      <!-- Users Table -->
      <div *ngIf="!isLoading && !loadError && users.length > 0" class="table-card">
        <div class="table-responsive">
          <table class="users-table">
            <thead>
              <tr>
                <th>User Details</th>
                <th>Email Address</th>
                <th>Phone</th>
                <th>Current Role</th>
                <th>Joined Date</th>
                <th class="actions-col">Role Management</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let user of users">
                <td>
                  <strong>{{ user.fullName }}</strong>
                  <span *ngIf="user._id === currentUserId" class="self-tag">(You)</span>
                </td>
                <td>{{ user.email }}</td>
                <td>{{ user.phone || 'N/A' }}</td>
                <td>
                  <span class="role-pill" [ngClass]="user.role">
                    {{ user.role | uppercase }}
                  </span>
                </td>
                <td>{{ user.createdAt | date:'mediumDate' }}</td>
                <td class="actions-col">
                  <!-- Actions for Applicant: Promote to Reviewer -->
                  <button
                    *ngIf="user.role === 'applicant'"
                    type="button"
                    class="btn-action btn-promote"
                    [disabled]="isUpdating"
                    (click)="changeRole(user, 'reviewer')"
                  >
                    Assign Reviewer Role
                  </button>

                  <!-- Actions for Reviewer: Revoke to Applicant -->
                  <button
                    *ngIf="user.role === 'reviewer'"
                    type="button"
                    class="btn-action btn-demote"
                    [disabled]="isUpdating"
                    (click)="changeRole(user, 'applicant')"
                  >
                    Revoke Reviewer Access
                  </button>

                  <span *ngIf="user.role === 'admin'" class="admin-badge-note">
                    Administrator
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Create Reviewer Modal -->
      <div *ngIf="showCreateModal" class="modal-backdrop">
        <div class="modal-card">
          <div class="modal-header">
            <h4>Provision Document Reviewer Account</h4>
            <button class="btn-modal-close" (click)="closeCreateModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div *ngIf="modalError" class="alert-box error">{{ modalError }}</div>
            <div class="form-group">
              <label for="revName">Full Name *</label>
              <input id="revName" type="text" [(ngModel)]="newReviewer.fullName" placeholder="e.g. Dr. Anirban Roy" />
            </div>
            <div class="form-group">
              <label for="revEmail">Email Address *</label>
              <input id="revEmail" type="email" [(ngModel)]="newReviewer.email" placeholder="e.g. anirban@iem.edu" />
            </div>
            <div class="form-group">
              <label for="revPass">Password *</label>
              <div class="password-input-wrap">
                <input
                  id="revPass"
                  [type]="showReviewerPassword ? 'text' : 'password'"
                  [(ngModel)]="newReviewer.password"
                  placeholder="At least 6 characters"
                />
                <button
                  type="button"
                  class="password-toggle-btn"
                  (click)="showReviewerPassword = !showReviewerPassword"
                  [attr.aria-label]="showReviewerPassword ? 'Hide password' : 'Show password'"
                  [title]="showReviewerPassword ? 'Hide password' : 'Show password'"
                >
                  <span *ngIf="!showReviewerPassword">&#128065;</span>
                  <span *ngIf="showReviewerPassword">&#128584;</span>
                </button>
              </div>
            </div>
            <div class="form-group">
              <label for="revPhone">Phone Number (Optional)</label>
              <input id="revPhone" type="text" [(ngModel)]="newReviewer.phone" placeholder="e.g. 9830112255" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" (click)="closeCreateModal()" [disabled]="isSubmittingModal">Cancel</button>
            <button
              class="btn-submit"
              (click)="submitCreateReviewer()"
              [disabled]="isSubmittingModal || !newReviewer.fullName || !newReviewer.email || !newReviewer.password"
            >
              <span *ngIf="!isSubmittingModal">Create Reviewer</span>
              <span *ngIf="isSubmittingModal">Creating...</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .reviewers-container {
      margin-top: 1rem;
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .section-header h3 {
      margin: 0;
      color: #0f2b48;
      font-size: 1.35rem;
    }
    .section-desc {
      margin: 0.35rem 0 0;
      color: #64748b;
      font-size: 0.9rem;
    }
    .header-actions {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .btn-reviewer-desk {
      background: #f1f5f9;
      color: #0f2b48;
      border: 1px solid #cbd5e1;
      padding: 0.6rem 1rem;
      border-radius: 4px;
      font-weight: 600;
      font-size: 0.85rem;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
    }
    .btn-reviewer-desk:hover {
      background: #e2e8f0;
    }
    .btn-primary-action {
      background: #0f2b48;
      color: #ffffff;
      border: none;
      padding: 0.6rem 1.25rem;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-primary-action:hover {
      background: #1a426e;
    }
    .alert-box {
      padding: 0.75rem 1rem;
      border-radius: 6px;
      margin-bottom: 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .alert-box.success { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
    .alert-box.error { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    .btn-close-alert { background: none; border: none; font-size: 1.25rem; cursor: pointer; color: inherit; }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .metric-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.25rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .metric-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 10px rgba(0,0,0,0.06);
    }
    .metric-icon {
      font-size: 1.75rem;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .reviewer-icon { background: #fef3c7; color: #b45309; }
    .applicant-icon { background: #e0f2fe; color: #0369a1; }
    .total-icon { background: #f1f5f9; color: #475569; }
    .metric-num {
      display: block;
      font-size: 1.5rem;
      font-weight: 700;
      color: #0f2b48;
    }
    .metric-label {
      font-size: 0.8rem;
      color: #64748b;
      font-weight: 600;
    }
    .toolbar-box {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1rem 1.25rem;
      margin-bottom: 1.5rem;
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .search-input-wrap { flex: 1; min-width: 280px; }
    .search-input-wrap input {
      width: 100%;
      padding: 0.6rem 0.85rem;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 0.9rem;
    }
    .filter-controls { display: flex; gap: 0.75rem; }
    .filter-controls select {
      padding: 0.6rem 0.85rem;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      background: #ffffff;
      font-size: 0.9rem;
    }
    .btn-refresh {
      background: #1a426e;
      color: #ffffff;
      border: none;
      padding: 0.6rem 1rem;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
    }
    .table-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    .table-responsive { overflow-x: auto; }
    .users-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    .users-table th {
      background: #f8fafc;
      color: #475569;
      padding: 0.85rem 1rem;
      text-align: left;
      font-weight: 600;
      border-bottom: 1px solid #e2e8f0;
    }
    .users-table td {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
      vertical-align: middle;
    }
    .self-tag {
      font-size: 0.75rem;
      color: #c98a2c;
      font-weight: 700;
      margin-left: 0.35rem;
    }
    .role-pill {
      display: inline-block;
      padding: 0.2rem 0.6rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .role-pill.admin { background: #e0e7ff; color: #3730a3; }
    .role-pill.reviewer { background: #fef3c7; color: #92400e; }
    .role-pill.applicant { background: #e0f2fe; color: #0369a1; }
    .actions-col { text-align: right; }
    .btn-action {
      padding: 0.35rem 0.75rem;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
    }
    .btn-promote {
      background: #fef3c7;
      color: #92400e;
      border-color: #fde68a;
    }
    .btn-promote:hover { background: #fde68a; }
    .btn-demote {
      background: #fee2e2;
      color: #991b1b;
      border-color: #fca5a5;
    }
    .btn-demote:hover { background: #fecaca; }
    .admin-badge-note {
      font-size: 0.8rem;
      color: #64748b;
      font-style: italic;
    }
    .state-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 3rem;
      text-align: center;
      color: #64748b;
    }
    .spinner {
      border: 3px solid #e2e8f0;
      border-top: 3px solid #0f2b48;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

    /* Modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 43, 72, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999;
      padding: 1rem;
    }
    .modal-card {
      background: #ffffff;
      border-radius: 8px;
      width: 100%;
      max-width: 480px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25);
    }
    .modal-header {
      background: #0f2b48;
      color: #ffffff;
      padding: 1rem 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .modal-header h4 { margin: 0; font-size: 1.1rem; }
    .btn-modal-close {
      background: none;
      border: none;
      color: #ffffff;
      font-size: 1.5rem;
      cursor: pointer;
    }
    .modal-body { padding: 1.25rem; display: flex; flex-direction: column; gap: 0.85rem; }
    .form-group { display: flex; flex-direction: column; gap: 0.35rem; }
    .form-group label { font-size: 0.85rem; font-weight: 600; color: #334155; }
    .form-group input { padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.9rem; }
    .modal-footer {
      padding: 1rem 1.25rem;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
    }
    .btn-cancel { padding: 0.5rem 1rem; background: #e2e8f0; border: none; border-radius: 4px; cursor: pointer; }
    .btn-submit { padding: 0.5rem 1.25rem; background: #0f2b48; color: #ffffff; border: none; border-radius: 4px; cursor: pointer; }
    .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
    .password-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    .password-input-wrap input {
      width: 100%;
      padding-right: 2.5rem;
    }
    .password-toggle-btn {
      position: absolute;
      right: 0.5rem;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1.1rem;
      padding: 0.25rem 0.4rem;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s;
    }
    .password-toggle-btn:hover {
      color: #0f2b48;
    }
  `]
})
export class AdminReviewersComponent implements OnInit {
  private adminService = inject(AdminService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  public currentUserId = this.authService.currentUserValue?._id;
  public users: User[] = [];
  public reviewerCount = 0;
  public applicantCount = 0;
  public totalUsers = 0;

  public isLoading = false;
  public loadError = '';
  public successMessage = '';
  public errorMessage = '';
  public isUpdating = false;

  // Filters
  public searchQuery = '';
  public selectedRole = 'all';

  // Modal State
  public showCreateModal = false;
  public isSubmittingModal = false;
  public modalError = '';
  public showReviewerPassword = false;
  public newReviewer = {
    fullName: '',
    email: '',
    password: '',
    phone: ''
  };

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.loadError = '';

    this.adminService
      .getUsers({
        role: this.selectedRole,
        search: this.searchQuery,
        limit: 100
      })
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.success && res.data) {
            this.users = res.data;
            this.totalUsers = res.meta?.total || this.users.length;
            this.computeRoleCounts();
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isLoading = false;
          this.loadError = err.error?.message || 'Failed to load user accounts.';
          this.cdr.markForCheck();
        }
      });
  }

  computeRoleCounts(): void {
    let r = 0, a = 0;
    for (const u of this.users) {
      if (u.role === 'reviewer') r++;
      else if (u.role === 'applicant') a++;
    }
    this.reviewerCount = r;
    this.applicantCount = a;
  }

  setRoleFilter(role: string): void {
    this.selectedRole = role;
    this.loadUsers();
  }

  onSearchChange(): void {
    this.loadUsers();
  }

  applyFilter(): void {
    this.loadUsers();
  }

  changeRole(user: User, newRole: 'applicant' | 'reviewer'): void {
    this.isUpdating = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.adminService.updateUserRole(user._id, newRole).subscribe({
      next: (res) => {
        this.isUpdating = false;
        this.successMessage = `User '${user.fullName}' role updated to '${newRole}'.`;
        user.role = newRole;
        this.computeRoleCounts();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isUpdating = false;
        this.errorMessage = err.error?.message || 'Failed to update user role.';
        this.cdr.markForCheck();
      }
    });
  }

  openCreateModal(): void {
    this.showCreateModal = true;
    this.modalError = '';
    this.newReviewer = { fullName: '', email: '', password: '', phone: '' };
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.modalError = '';
  }

  submitCreateReviewer(): void {
    if (!this.newReviewer.fullName || !this.newReviewer.email || !this.newReviewer.password) {
      this.modalError = 'Full name, email, and password are required.';
      return;
    }

    this.isSubmittingModal = true;
    this.modalError = '';

    this.adminService.createReviewer(this.newReviewer).subscribe({
      next: (res) => {
        this.isSubmittingModal = false;
        this.showCreateModal = false;
        this.successMessage = `Reviewer account '${this.newReviewer.email}' created successfully.`;
        this.loadUsers();
      },
      error: (err) => {
        this.isSubmittingModal = false;
        this.modalError = err.error?.message || 'Failed to create reviewer account.';
        this.cdr.markForCheck();
      }
    });
  }
}
