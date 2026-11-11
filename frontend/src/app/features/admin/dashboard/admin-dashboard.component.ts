import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import {
  AdminService,
  AdminDashboardMetrics,
  CategoryDistributionEntry,
  DepartmentDistributionEntry,
  PaginationMeta,
  StatusDistributionEntry
} from '../../../core/services/admin.service';
import { DocumentService } from '../../../core/services/document.service';
import {
  AdmissionApplication,
  ApplicationStatus,
  StatusHistoryEntry
} from '../../../core/models/application.model';
import { UploadedDocument } from '../../../core/models/document.model';
import { AdminOverviewComponent } from '../overview/admin-overview.component';
import { AdminProgrammesComponent } from '../programmes/admin-programmes.component';
import { AdminSessionsComponent } from '../sessions/admin-sessions.component';
import { AdminFeesComponent } from '../fees/admin-fees.component';
import { AdminReviewersComponent } from '../reviewers/admin-reviewers.component';
import { AdminMeritComponent } from '../merit/admin-merit.component';
import { AdminEnrolmentComponent } from '../enrolment/admin-enrolment.component';
import { AdminReportsComponent } from '../reports/admin-reports.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    AdminOverviewComponent,
    AdminProgrammesComponent,
    AdminSessionsComponent,
    AdminFeesComponent,
    AdminReviewersComponent,
    AdminMeritComponent,
    AdminEnrolmentComponent,
    AdminReportsComponent
  ],
  template: `
    <div class="admin-page">
      <!-- Admin Page Header -->
      <div class="admin-header">
        <div class="header-titles">
          <h2>Admissions Administration Portal</h2>
          <p>Real-time applicant management, evaluation metrics and document inspection</p>
        </div>
        <div class="header-refresh">
          <button class="btn-refresh" (click)="loadAllData()" [disabled]="isLoadingMetrics || isLoadingApps">
            Refresh Data
          </button>
        </div>
      </div>

      <!-- Administrative Section Navigation Tabs -->
      <div class="admin-nav-tabs">
        <button
          type="button"
          class="admin-tab-btn"
          [class.active]="activeTab === 'applications'"
          (click)="setTab('applications')"
        >
          <span class="tab-icon">&#128196;</span>
          <span>Applications Directory</span>
        </button>

        <button
          type="button"
          class="admin-tab-btn"
          [class.active]="activeTab === 'programmes'"
          (click)="setTab('programmes')"
        >
          <span class="tab-icon">&#127891;</span>
          <span>Academic Programmes</span>
        </button>

        <button
          type="button"
          class="admin-tab-btn"
          [class.active]="activeTab === 'sessions'"
          (click)="setTab('sessions')"
        >
          <span class="tab-icon">&#128197;</span>
          <span>Admission Sessions</span>
        </button>

        <button
          type="button"
          class="admin-tab-btn"
          [class.active]="activeTab === 'fees'"
          (click)="setTab('fees')"
        >
          <span class="tab-icon">&#128179;</span>
          <span>Fee Structures</span>
        </button>

        <button
          type="button"
          class="admin-tab-btn"
          [class.active]="activeTab === 'overview'"
          (click)="setTab('overview')"
        >
          <span class="tab-icon">&#128202;</span>
          <span>Academic Overview</span>
        </button>

        <button
          type="button"
          class="admin-tab-btn"
          [class.active]="activeTab === 'reviewers'"
          (click)="setTab('reviewers')"
        >
          <span class="tab-icon">&#128101;</span>
          <span>Reviewer Management</span>
        </button>

        <button
          type="button"
          class="admin-tab-btn"
          [class.active]="activeTab === 'merit'"
          (click)="setTab('merit')"
        >
          <span class="tab-icon">&#128220;</span>
          <span>Merit & Seat Allocation</span>
        </button>

        <button
          type="button"
          class="admin-tab-btn"
          [class.active]="activeTab === 'enrolments'"
          (click)="setTab('enrolments')"
        >
          <span class="tab-icon">&#127891;</span>
          <span>Enrolments & Payments</span>
        </button>

        <button
          type="button"
          class="admin-tab-btn"
          [class.active]="activeTab === 'reports'"
          (click)="setTab('reports')"
        >
          <span class="tab-icon">&#128200;</span>
          <span>Reporting & Analytics</span>
        </button>
      </div>

      <!-- Tab Content 1: Applications Directory -->
      <div *ngIf="activeTab === 'applications'" class="tab-pane">

      <!-- Metric Cards (MongoDB count/metrics) -->
      <div class="metrics-grid">
        <div class="metric-card total" (click)="filterByStatus('')">
          <div class="metric-title">Total Applications</div>
          <div class="metric-number">{{ metrics.totalApplications }}</div>
          <div class="metric-footer">All submissions</div>
        </div>

        <div class="metric-card submitted" (click)="filterByStatus('Submitted')">
          <div class="metric-title">Submitted</div>
          <div class="metric-number">{{ metrics.submitted }}</div>
          <div class="metric-footer">Awaiting initial review</div>
        </div>

        <div class="metric-card review" (click)="filterByStatus('Under Review')">
          <div class="metric-title">Under Review</div>
          <div class="metric-number">{{ metrics.underReview }}</div>
          <div class="metric-footer">Evaluation in progress</div>
        </div>

        <div class="metric-card selected" (click)="filterByStatus('Selected')">
          <div class="metric-title">Selected</div>
          <div class="metric-number">{{ metrics.selected }}</div>
          <div class="metric-footer">Admitted candidates</div>
        </div>

        <div class="metric-card rejected" (click)="filterByStatus('Rejected')">
          <div class="metric-title">Rejected</div>
          <div class="metric-number">{{ metrics.rejected }}</div>
          <div class="metric-footer">Ineligible or closed</div>
        </div>
      </div>

      <!-- Aggregation-driven distribution statistics -->
      <div class="stats-state stats-loading" *ngIf="isLoadingMetrics">
        <div class="spinner"></div>
        <p>Loading dashboard statistics...</p>
      </div>

      <div class="stats-state stats-error" *ngIf="!isLoadingMetrics && metricsError">
        <p>{{ metricsError }}</p>
        <button type="button" class="btn-retry" (click)="fetchMetrics()">Retry</button>
      </div>

      <div
        class="stats-state stats-empty"
        *ngIf="!isLoadingMetrics && !metricsError && !hasApplications"
      >
        <p>No applications have been submitted yet. Distribution statistics will appear here.</p>
      </div>

      <div
        class="distribution-grid"
        *ngIf="!isLoadingMetrics && !metricsError && hasApplications"
      >
        <section class="distribution-card" aria-labelledby="status-distribution-title">
          <div class="distribution-header">
            <h3 id="status-distribution-title">Status Distribution</h3>
            <span class="distribution-total">{{ metrics.totalApplications }} total</span>
          </div>
          <div class="bar-list">
            <div class="bar-row" *ngFor="let item of statusDistribution">
              <span class="bar-label">{{ item.status }}</span>
              <div
                class="bar-track"
                role="img"
                [attr.aria-label]="item.status + ': ' + item.count + ' applications'"
              >
                <div
                  class="bar-fill status-fill"
                  [ngClass]="item.status.toLowerCase().replace(' ', '-')"
                  [style.width.%]="barPercentage(item.count)"
                ></div>
              </div>
              <span class="bar-value">{{ item.count }}</span>
            </div>
          </div>
        </section>

        <section class="distribution-card" aria-labelledby="department-distribution-title">
          <div class="distribution-header">
            <h3 id="department-distribution-title">Applications by Department</h3>
            <span class="distribution-total">{{ departmentDistribution.length }} groups</span>
          </div>
          <p class="distribution-empty" *ngIf="departmentDistribution.length === 0">
            No department data available.
          </p>
          <div class="bar-list" *ngIf="departmentDistribution.length > 0">
            <div class="bar-row" *ngFor="let item of departmentDistribution">
              <span class="bar-label" [title]="item.department">{{ item.department }}</span>
              <div
                class="bar-track"
                role="img"
                [attr.aria-label]="item.department + ': ' + item.count + ' applications'"
              >
                <div
                  class="bar-fill department-fill"
                  [style.width.%]="barPercentage(item.count)"
                ></div>
              </div>
              <span class="bar-value">{{ item.count }}</span>
            </div>
          </div>
        </section>

        <section class="distribution-card" aria-labelledby="category-distribution-title">
          <div class="distribution-header">
            <h3 id="category-distribution-title">Applications by Admission Category</h3>
            <span class="distribution-total">{{ categoryDistribution.length }} groups</span>
          </div>
          <p class="distribution-empty" *ngIf="categoryDistribution.length === 0">
            No admission category data available.
          </p>
          <div class="bar-list" *ngIf="categoryDistribution.length > 0">
            <div class="bar-row" *ngFor="let item of categoryDistribution">
              <span class="bar-label">{{ item.category }}</span>
              <div
                class="bar-track"
                role="img"
                [attr.aria-label]="item.category + ': ' + item.count + ' applications'"
              >
                <div class="bar-fill category-fill" [style.width.%]="barPercentage(item.count)"></div>
              </div>
              <span class="bar-value">{{ item.count }}</span>
            </div>
          </div>
        </section>
      </div>

      <!-- Filter & Search Toolbar -->
      <div class="toolbar-card">
        <div class="toolbar-row">
          <div class="search-box">
            <input
              type="text"
              [(ngModel)]="searchQuery"
              (ngModelChange)="onSearchChange()"
              placeholder="Search by candidate name, application ID or email..."
            />
          </div>

          <div class="filters-row">
            <select [(ngModel)]="selectedDepartment" (change)="onFilterChange()">
              <option value="">All Departments</option>
              <option value="Computer Science & Engineering">Computer Science & Engineering</option>
              <option value="Information Technology">Information Technology</option>
              <option value="Electronics & Communication Engineering">Electronics & Communication Engineering</option>
              <option value="Electrical Engineering">Electrical Engineering</option>
              <option value="Mechanical Engineering">Mechanical Engineering</option>
              <option value="Biotechnology">Biotechnology</option>
            </select>

            <select [(ngModel)]="selectedCategory" (change)="onFilterChange()">
              <option value="">All Categories</option>
              <option value="General">General</option>
              <option value="OBC">OBC</option>
              <option value="SC">SC</option>
              <option value="ST">ST</option>
              <option value="EWS">EWS</option>
              <option value="Management">Management</option>
            </select>

            <select [(ngModel)]="selectedStatus" (change)="onFilterChange()">
              <option value="">All Statuses</option>
              <option value="Submitted">Submitted</option>
              <option value="Under Review">Under Review</option>
              <option value="Selected">Selected</option>
              <option value="Rejected">Rejected</option>
            </select>

            <div class="sort-controls">
              <label for="sortBy">Sort by</label>
              <select id="sortBy" [(ngModel)]="sortBy" (change)="onSortChange()">
                <option value="submittedAt">Submission Date</option>
                <option value="applicationId">Application ID</option>
                <option value="name">Applicant Name</option>
                <option value="percentage">Class 12 %</option>
                <option value="status">Status</option>
              </select>
              <button
                type="button"
                class="btn-sort-order"
                (click)="toggleSortOrder()"
                [title]="sortOrder === 'asc' ? 'Currently ascending. Switch to descending.' : 'Currently descending. Switch to ascending.'"
              >
                {{ sortOrder === 'asc' ? 'Ascending ↑' : 'Descending ↓' }}
              </button>
            </div>

            <button class="btn-clear" (click)="resetFilters()">Reset</button>
          </div>
        </div>
      </div>

      <!-- Applications Management Table Card -->
      <div class="table-card">
        <div class="table-header">
          <h3>Applications Directory</h3>
          <div class="table-meta-info" *ngIf="pagination">
            Showing {{ ((pagination.page - 1) * pagination.limit) + (applications.length > 0 ? 1 : 0) }} -
            {{ ((pagination.page - 1) * pagination.limit) + applications.length }} of
            {{ pagination.totalRecords }} applications
          </div>
        </div>

        <div *ngIf="isLoadingApps" class="table-loading">
          <div class="spinner"></div>
          <p>Loading application records...</p>
        </div>

        <div *ngIf="!isLoadingApps && applicationsError" class="table-error">
          <p>{{ applicationsError }}</p>
          <button type="button" class="btn-retry" (click)="fetchApplications()">Retry</button>
        </div>

        <div
          *ngIf="!isLoadingApps && !applicationsError && applications.length === 0"
          class="table-empty"
        >
          <p>No applications match the current search and filter criteria.</p>
        </div>

        <div
          class="table-responsive"
          *ngIf="!isLoadingApps && !applicationsError && applications.length > 0"
        >
          <table class="admin-table">
            <thead>
              <tr>
                <th
                  class="sortable"
                  (click)="sortByColumn('applicationId')"
                  [attr.aria-sort]="ariaSort('applicationId')"
                >
                  App ID <span class="sort-indicator">{{ sortIcon('applicationId') }}</span>
                </th>
                <th
                  class="sortable"
                  (click)="sortByColumn('name')"
                  [attr.aria-sort]="ariaSort('name')"
                >
                  Candidate Name <span class="sort-indicator">{{ sortIcon('name') }}</span>
                </th>
                <th>Contact Email</th>
                <th>Department</th>
                <th>Category</th>
                <th
                  class="sortable"
                  (click)="sortByColumn('percentage')"
                  [attr.aria-sort]="ariaSort('percentage')"
                >
                  Class 12 % <span class="sort-indicator">{{ sortIcon('percentage') }}</span>
                </th>
                <th
                  class="sortable"
                  (click)="sortByColumn('submittedAt')"
                  [attr.aria-sort]="ariaSort('submittedAt')"
                >
                  Submitted Date <span class="sort-indicator">{{ sortIcon('submittedAt') }}</span>
                </th>
                <th
                  class="sortable"
                  (click)="sortByColumn('status')"
                  [attr.aria-sort]="ariaSort('status')"
                >
                  Status <span class="sort-indicator">{{ sortIcon('status') }}</span>
                </th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let app of applications">
                <td class="cell-id">
                  <strong>{{ app.applicationId }}</strong>
                </td>
                <td class="cell-name">
                  {{ app.personalInfo?.fullName }}
                </td>
                <td class="cell-email">{{ app.personalInfo?.email }}</td>
                <td class="cell-dept">{{ app.admissionInfo?.preferredDepartment }}</td>
                <td><span class="category-pill">{{ app.admissionInfo?.admissionCategory }}</span></td>
                <td class="cell-pct">{{ app.academicInfo?.class12Percentage }}%</td>
                <td>{{ app.submittedAt | date:'mediumDate' }}</td>
                <td>
                  <span class="status-badge" [ngClass]="app.status?.toLowerCase()?.replace(' ', '-')">
                    {{ app.status }}
                  </span>
                </td>
                <td class="text-right">
                  <button class="btn-inspect" (click)="inspectApplication(app)">
                    Inspect
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination Controls -->
        <div class="pagination-footer" *ngIf="pagination && pagination.totalPages > 1">
          <div class="page-size-selector">
            <label>Show</label>
            <select [(ngModel)]="pageSize" (change)="onPageSizeChange()">
              <option [ngValue]="10">10</option>
              <option [ngValue]="25">25</option>
              <option [ngValue]="50">50</option>
            </select>
            <label>per page</label>
          </div>

          <div class="pagination-actions">
            <button
              class="btn-page"
              [disabled]="!pagination.hasPrevPage"
              (click)="changePage(pagination.page - 1)"
            >
              &larr; Previous
            </button>
            <span class="page-indicator">
              Page {{ pagination.page }} of {{ pagination.totalPages }}
            </span>
            <button
              class="btn-page"
              [disabled]="!pagination.hasNextPage"
              (click)="changePage(pagination.page + 1)"
            >
              Next &rarr;
            </button>
          </div>
        </div>
      </div>

      <!-- Application Inspection Modal / Drawer -->
      <div class="modal-backdrop" *ngIf="inspectedApp" (click)="closeInspection()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <span class="modal-sub">Candidate Admission File</span>
              <h3>{{ inspectedApp.applicationId }} &bull; {{ inspectedApp.personalInfo?.fullName }}</h3>
            </div>
            <div class="header-right">
              <span class="status-badge" [ngClass]="inspectedApp.status?.toLowerCase()?.replace(' ', '-')">
                {{ inspectedApp.status }}
              </span>
              <button class="btn-close" (click)="closeInspection()">&times;</button>
            </div>
          </div>

          <div class="modal-body">
            <!-- Section 1: Personal Information -->
            <div class="inspection-section">
              <h4>1. Personal Information</h4>
              <div class="detail-grid">
                <div><span>Full Name:</span> {{ inspectedApp.personalInfo?.fullName }}</div>
                <div><span>Date of Birth:</span> {{ inspectedApp.personalInfo?.dob | date:'mediumDate' }}</div>
                <div><span>Gender:</span> {{ inspectedApp.personalInfo?.gender }}</div>
                <div><span>Contact Email:</span> {{ inspectedApp.personalInfo?.email }}</div>
                <div><span>Phone:</span> {{ inspectedApp.personalInfo?.phone }}</div>
                <div><span>Address:</span> {{ inspectedApp.personalInfo?.address }}, {{ inspectedApp.personalInfo?.city }}, {{ inspectedApp.personalInfo?.state }} - {{ inspectedApp.personalInfo?.pincode }}</div>
              </div>
            </div>

            <!-- Section 2: Academic Qualifications -->
            <div class="inspection-section">
              <h4>2. Academic Qualifications</h4>
              <div class="detail-grid">
                <div><span>Class 10 Board:</span> {{ inspectedApp.academicInfo?.class10Board }}</div>
                <div><span>Class 10 Percentage:</span> {{ inspectedApp.academicInfo?.class10Percentage }}%</div>
                <div><span>Class 12 Board:</span> {{ inspectedApp.academicInfo?.class12Board }}</div>
                <div><span>Class 12 Percentage:</span> {{ inspectedApp.academicInfo?.class12Percentage }}%</div>
                <div><span>Class 12 Passing Year:</span> {{ inspectedApp.academicInfo?.class12PassingYear }}</div>
                <div><span>Entrance Exam:</span> {{ inspectedApp.academicInfo?.entranceExamName }}</div>
                <div><span>Entrance Rank/Score:</span> {{ inspectedApp.academicInfo?.entranceExamScore }}</div>
              </div>
            </div>

            <!-- Section 3: Admission Choice -->
            <div class="inspection-section">
              <h4>3. Admission Choice &amp; Quota</h4>
              <div class="detail-grid">
                <div><span>Preferred Stream:</span> <strong>{{ inspectedApp.admissionInfo?.preferredDepartment }}</strong></div>
                <div><span>Admission Category:</span> {{ inspectedApp.admissionInfo?.admissionCategory }}</div>
                <div><span>Academic Session:</span> {{ inspectedApp.academicSession }}</div>
                <div><span>Application Date:</span> {{ inspectedApp.submittedAt | date:'medium' }}</div>
              </div>
            </div>

            <!-- Section 4: Attached Documents -->
            <div class="inspection-section">
              <h4>4. Uploaded Verification Documents ({{ inspectedApp.documents?.length || 0 }})</h4>
              <div *ngIf="!inspectedApp.documents || inspectedApp.documents.length === 0" class="no-docs-note">
                No documents uploaded by this applicant yet.
              </div>

              <div class="docs-inspection-list" *ngIf="inspectedApp.documents && inspectedApp.documents.length > 0">
                <div class="doc-item" *ngFor="let doc of inspectedApp.documents">
                  <div class="doc-info">
                    <span class="doc-badge">{{ doc.documentType }}</span>
                    <span class="doc-filename">{{ doc.originalFileName }}</span>
                    <small class="doc-size">({{ formatBytes(doc.fileSize) }})</small>
                    <span
                      class="doc-verify-badge"
                      [ngClass]="(doc.verificationStatus || 'Pending').toLowerCase()"
                    >
                      {{ doc.verificationStatus || 'Pending' }}
                    </span>
                    <div *ngIf="doc.verifiedBy" class="doc-verifier-text">
                      Verified by: <strong>{{ doc.verifiedBy?.fullName || doc.verifiedBy }}</strong>
                      <span *ngIf="doc.verifiedBy?.role"> ({{ doc.verifiedBy.role }})</span>
                      <span *ngIf="doc.verifiedAt"> on {{ doc.verifiedAt | date:'short' }}</span>
                    </div>
                    <div *ngIf="doc.verificationRemarks" class="doc-remarks-note">
                      "{{ doc.verificationRemarks }}"
                    </div>
                  </div>
                  <div class="doc-actions">
                    <button class="btn-doc-view" (click)="viewDocument(doc)">View Document</button>
                    <button class="btn-doc-download" (click)="downloadDocument(doc)">Download</button>
                  </div>
                  <div class="doc-verify-actions" *ngIf="doc.verificationStatus !== 'Verified'">
                    <div class="doc-verify-row">
                      <input
                        type="text"
                        class="doc-remarks-input"
                        [placeholder]="'Remarks' + (doc._id === docRejectingId ? ' (required for rejection)' : ' (optional)')"
                        [(ngModel)]="docRemarksMap[doc._id]"
                        [disabled]="docVerifyingId === doc._id"
                      />
                      <button
                        class="btn-doc-approve"
                        (click)="verifyDocumentAction(doc, 'Verified')"
                        [disabled]="docVerifyingId === doc._id"
                      >
                        {{ docVerifyingId === doc._id && docVerifyingAction === 'Verified' ? 'Approving...' : '✓ Approve' }}
                      </button>
                      <button
                        class="btn-doc-reject"
                        (click)="verifyDocumentAction(doc, 'Rejected')"
                        [disabled]="docVerifyingId === doc._id"
                      >
                        {{ docVerifyingId === doc._id && docVerifyingAction === 'Rejected' ? 'Rejecting...' : '✗ Reject' }}
                      </button>
                    </div>
                    <div class="alert-box error" *ngIf="docVerifyError && docVerifyErrorId === doc._id">{{ docVerifyError }}</div>
                  </div>
                  <div class="doc-verify-success" *ngIf="doc.verificationStatus === 'Verified'">
                    <span class="doc-verified-label">✓ Document approved</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Section 5: Status Management -->
            <div class="inspection-section status-management-section">
              <h4>5. Status Management</h4>

              <div class="current-status-row">
                <span class="current-status-label">Current status:</span>
                <span class="status-badge" [ngClass]="inspectedApp.status?.toLowerCase()?.replace(' ', '-')">
                  {{ inspectedApp.status }}
                </span>
              </div>

              <div *ngIf="allowedNextStatuses.length > 0; else terminalStatus" class="status-update-form">
                <p class="status-help">
                  Select the next permitted status. The backend enforces the workflow and rejects invalid transitions.
                </p>

                <div class="status-option-group">
                  <label class="status-option" *ngFor="let nextStatus of allowedNextStatuses">
                    <input
                      type="radio"
                      name="nextStatus"
                      [value]="nextStatus"
                      [(ngModel)]="selectedNextStatus"
                      [disabled]="isUpdatingStatus"
                    />
                    <span class="status-badge" [ngClass]="nextStatus.toLowerCase().replace(' ', '-')">
                      {{ nextStatus }}
                    </span>
                  </label>
                </div>

                <label class="remarks-label" for="statusRemarks">Administrator remarks (optional)</label>
                <textarea
                  id="statusRemarks"
                  name="statusRemarks"
                  rows="3"
                  maxlength="1000"
                  [(ngModel)]="statusRemarks"
                  [disabled]="isUpdatingStatus"
                  placeholder="Add context for this status decision..."
                ></textarea>

                <div class="status-update-actions">
                  <button
                    type="button"
                    class="btn-confirm-status"
                    (click)="updateStatus()"
                    [disabled]="!selectedNextStatus || isUpdatingStatus"
                  >
                    {{ isUpdatingStatus ? 'Updating...' : 'Confirm Status Update' }}
                  </button>
                </div>
              </div>

              <ng-template #terminalStatus>
                <div class="terminal-note">
                  This application is in the terminal status
                  <strong>{{ inspectedApp.status }}</strong>. No further status changes are permitted.
                </div>
              </ng-template>

              <div class="alert-box error" *ngIf="statusUpdateError">{{ statusUpdateError }}</div>
              <div class="alert-box success" *ngIf="statusUpdateSuccess">{{ statusUpdateSuccess }}</div>
            </div>

            <!-- Section 6: Status Audit Trail -->
            <div class="inspection-section">
              <h4>6. Status Audit Trail ({{ inspectedApp.statusHistory?.length || 0 }})</h4>
              <div *ngIf="!inspectedApp.statusHistory || inspectedApp.statusHistory.length === 0" class="no-docs-note">
                No status changes have been recorded for this application.
              </div>

              <div class="history-list" *ngIf="inspectedApp.statusHistory && inspectedApp.statusHistory.length > 0">
                <div class="history-item" *ngFor="let entry of inspectedApp.statusHistory">
                  <div class="history-status">
                    <span class="status-badge" [ngClass]="entry.previousStatus?.toLowerCase()?.replace(' ', '-')">
                      {{ entry.previousStatus }}
                    </span>
                    <span class="history-arrow">&rarr;</span>
                    <span class="status-badge" [ngClass]="entry.newStatus?.toLowerCase()?.replace(' ', '-')">
                      {{ entry.newStatus }}
                    </span>
                  </div>
                  <div class="history-meta">
                    <span>{{ entry.timestamp | date:'medium' }}</span>
                    <span *ngIf="entry.changedBy">
                      by {{ entry.changedBy.fullName }}
                      <ng-container *ngIf="entry.changedBy.role">({{ entry.changedBy.role }})</ng-container>
                    </span>
                  </div>
                  <div class="history-remarks" *ngIf="entry.remarks">{{ entry.remarks }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-close-bottom" (click)="closeInspection()">Close Inspection</button>
          </div>
        </div>
      </div>
      </div> <!-- End of tab-pane: applications -->

      <!-- Tab Content 2: Academic Programmes -->
      <div *ngIf="activeTab === 'programmes'" class="tab-pane">
        <app-admin-programmes></app-admin-programmes>
      </div>

      <!-- Tab Content 3: Admission Sessions -->
      <div *ngIf="activeTab === 'sessions'" class="tab-pane">
        <app-admin-sessions></app-admin-sessions>
      </div>

      <!-- Tab Content 4: Fee Structures -->
      <div *ngIf="activeTab === 'fees'" class="tab-pane">
        <app-admin-fees></app-admin-fees>
      </div>

      <!-- Tab Content 5: Academic Overview -->
      <div *ngIf="activeTab === 'overview'" class="tab-pane">
        <app-admin-overview (navigateToTab)="setTab($event)"></app-admin-overview>
      </div>

      <!-- Tab Content 6: Reviewer Management -->
      <div *ngIf="activeTab === 'reviewers'" class="tab-pane">
        <app-admin-reviewers></app-admin-reviewers>
      </div>

      <!-- Tab Content 7: Merit List & Seat Allocation -->
      <div *ngIf="activeTab === 'merit'" class="tab-pane">
        <app-admin-merit></app-admin-merit>
      </div>

      <!-- Tab Content 8: Enrolments & Payments Directory -->
      <div *ngIf="activeTab === 'enrolments'" class="tab-pane">
        <app-admin-enrolment></app-admin-enrolment>
      </div>

      <!-- Tab Content 9: Reporting, Analytics & Data Export -->
      <div *ngIf="activeTab === 'reports'" class="tab-pane">
        <app-admin-reports></app-admin-reports>
      </div>
    </div>
  `,
  styles: [`
    .admin-page {
      max-width: 1240px;
      margin: 1.5rem auto 3rem;
      padding: 0 1.5rem;
    }
    .doc-verify-badge {
      display: inline-block;
      padding: 0.15rem 0.5rem;
      border-radius: 10px;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      margin-left: 0.5rem;
    }
    .doc-verify-badge.pending { background: #fef3c7; color: #92400e; }
    .doc-verify-badge.verified { background: #d1fae5; color: #065f46; }
    .doc-verify-badge.rejected { background: #fee2e2; color: #991b1b; }
    .doc-verifier-text {
      font-size: 0.75rem;
      color: #64748b;
      margin-top: 0.25rem;
    }
    .doc-remarks-note {
      font-size: 0.75rem;
      color: #b91c1c;
      font-style: italic;
      margin-top: 0.2rem;
    }
    .admin-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 1rem;
    }
    .admin-nav-tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
      background: #ffffff;
      padding: 0.65rem 0.85rem;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      overflow-x: auto;
    }
    .admin-tab-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 0.6rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
      color: #64748b;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .admin-tab-btn:hover {
      background: #edf2f7;
      color: #0f2b48;
    }
    .admin-tab-btn.active {
      background: #0f2b48;
      color: #ffffff;
      border-color: #0f2b48;
    }
    .tab-icon {
      font-size: 1rem;
    }
    .header-titles h2 {
      margin: 0 0 0.25rem;
      font-size: 1.6rem;
      color: #0f2b48;
    }
    .header-titles p {
      margin: 0;
      color: #64748b;
      font-size: 0.9rem;
    }
    .btn-refresh {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      color: #0f2b48;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-refresh:hover:not(:disabled) {
      background: #f8fafc;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .metric-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 1.25rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.03);
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .metric-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 10px rgba(0,0,0,0.06);
    }
    .metric-card.total { border-top: 4px solid #0f2b48; }
    .metric-card.submitted { border-top: 4px solid #3b82f6; }
    .metric-card.review { border-top: 4px solid #f59e0b; }
    .metric-card.selected { border-top: 4px solid #10b981; }
    .metric-card.rejected { border-top: 4px solid #ef4444; }
    .metric-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.5px;
    }
    .metric-number {
      font-size: 2rem;
      font-weight: 800;
      color: #0f2b48;
      margin: 0.35rem 0;
    }
    .metric-footer {
      font-size: 0.75rem;
      color: #94a3b8;
    }
    .stats-state {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
      text-align: center;
      color: #64748b;
      font-size: 0.9rem;
    }
    .stats-state p {
      margin: 0 0 0.75rem;
    }
    .stats-state p:last-child {
      margin-bottom: 0;
    }
    .stats-state.stats-error {
      background: #fef2f2;
      border-color: #fca5a5;
      color: #991b1b;
    }
    .stats-state.stats-empty {
      background: #f8fafc;
    }
    .btn-retry {
      background: #0f2b48;
      color: #ffffff;
      border: none;
      padding: 0.45rem 0.9rem;
      border-radius: 4px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-retry:hover {
      background: #1a426e;
    }
    .distribution-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .distribution-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 1.1rem 1.25rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.03);
    }
    .distribution-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 0.75rem;
      margin-bottom: 0.9rem;
      border-bottom: 1px solid #edf2f7;
      padding-bottom: 0.5rem;
    }
    .distribution-header h3 {
      margin: 0;
      font-size: 0.95rem;
      color: #0f2b48;
    }
    .distribution-total {
      font-size: 0.72rem;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.4px;
      color: #94a3b8;
      white-space: nowrap;
    }
    .bar-list {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }
    .bar-row {
      display: grid;
      grid-template-columns: minmax(110px, 165px) 1fr 2.25rem;
      align-items: center;
      gap: 0.65rem;
    }
    .bar-label {
      font-size: 0.78rem;
      font-weight: 600;
      color: #475569;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bar-track {
      height: 10px;
      background: #eef2f7;
      border-radius: 999px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      min-width: 0;
      border-radius: 999px;
      background: #0f2b48;
      transition: width 0.3s ease;
    }
    .bar-fill.status-fill.submitted { background: #3b82f6; }
    .bar-fill.status-fill.under-review { background: #f59e0b; }
    .bar-fill.status-fill.selected { background: #10b981; }
    .bar-fill.status-fill.rejected { background: #ef4444; }
    .bar-fill.department-fill { background: #0f2b48; }
    .bar-fill.category-fill { background: #6366f1; }
    .bar-value {
      font-size: 0.8rem;
      font-weight: 700;
      color: #0f2b48;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .distribution-empty {
      margin: 0;
      font-size: 0.82rem;
      color: #94a3b8;
      font-style: italic;
    }
    @media (max-width: 640px) {
      .bar-row {
        grid-template-columns: minmax(90px, 120px) 1fr 2rem;
      }
    }
    .toolbar-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 1rem 1.25rem;
      margin-bottom: 1.25rem;
    }
    .toolbar-row {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: center;
    }
    .search-box {
      flex: 1;
      min-width: 280px;
    }
    .search-box input {
      width: 100%;
      padding: 0.6rem 0.85rem;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 0.9rem;
    }
    .filters-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .filters-row select {
      padding: 0.55rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 0.85rem;
      background: #ffffff;
    }
    .sort-controls {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      padding-left: 0.75rem;
      border-left: 1px solid #e2e8f0;
    }
    .sort-controls label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #64748b;
      white-space: nowrap;
    }
    .btn-sort-order {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      color: #0f2b48;
      padding: 0.55rem 0.7rem;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    .btn-sort-order:hover {
      background: #f8fafc;
    }
    .btn-clear {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      color: #475569;
      padding: 0.5rem 0.85rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }
    .table-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 1.25rem 1.5rem;
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
    }
    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }
    .table-header h3 {
      margin: 0;
      font-size: 1.15rem;
      color: #0f2b48;
    }
    .table-meta-info {
      font-size: 0.85rem;
      color: #64748b;
    }
    .table-responsive {
      overflow-x: auto;
    }
    .admin-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    .admin-table th {
      background: #f8fafc;
      padding: 0.75rem 0.85rem;
      text-align: left;
      font-weight: 600;
      color: #475569;
      border-bottom: 2px solid #e2e8f0;
      white-space: nowrap;
    }
    .admin-table th.sortable {
      cursor: pointer;
      user-select: none;
    }
    .admin-table th.sortable:hover {
      background: #f1f5f9;
      color: #0f2b48;
    }
    .sort-indicator {
      color: #94a3b8;
      font-size: 0.7rem;
      margin-left: 0.15rem;
    }
    .admin-table th[aria-sort="ascending"] .sort-indicator,
    .admin-table th[aria-sort="descending"] .sort-indicator {
      color: #0f2b48;
    }
    .admin-table td {
      padding: 0.75rem 0.85rem;
      border-bottom: 1px solid #edf2f7;
      color: #1e293b;
    }
    .admin-table tr:hover {
      background: #f8fafc;
    }
    .cell-id strong {
      color: #0f2b48;
    }
    .category-pill {
      background: #f1f5f9;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      color: #475569;
    }
    .status-badge {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.25rem 0.6rem;
      border-radius: 12px;
      letter-spacing: 0.3px;
      white-space: nowrap;
    }
    .status-badge.submitted { background: #dbeafe; color: #1e40af; }
    .status-badge.under-review { background: #fef3c7; color: #92400e; }
    .status-badge.selected { background: #dcfce7; color: #166534; }
    .status-badge.rejected { background: #fee2e2; color: #991b1b; }
    .btn-inspect {
      background: #0f2b48;
      color: #ffffff;
      border: none;
      padding: 0.35rem 0.75rem;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-inspect:hover {
      background: #1a426e;
    }
    .text-right { text-align: right; }
    .pagination-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 1.25rem;
      padding-top: 1rem;
      border-top: 1px solid #edf2f7;
    }
    .page-size-selector {
      font-size: 0.85rem;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .page-size-selector select {
      padding: 0.25rem 0.5rem;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
    }
    .pagination-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .btn-page {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      padding: 0.35rem 0.75rem;
      border-radius: 4px;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .btn-page:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .page-indicator {
      font-size: 0.85rem;
      color: #64748b;
    }
    /* Modal / Inspection Drawer */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 43, 72, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 2000;
      padding: 1rem;
    }
    .modal-card {
      background: #ffffff;
      border-radius: 8px;
      width: 100%;
      max-width: 840px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    }
    .modal-header {
      padding: 1.25rem 1.75rem;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      border-radius: 8px 8px 0 0;
    }
    .modal-sub {
      font-size: 0.75rem;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.5px;
    }
    .modal-header h3 {
      margin: 0.25rem 0 0;
      font-size: 1.25rem;
      color: #0f2b48;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .btn-close {
      background: transparent;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #64748b;
    }
    .modal-body {
      padding: 1.5rem 1.75rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .inspection-section h4 {
      margin: 0 0 0.75rem;
      font-size: 0.95rem;
      color: #0f2b48;
      border-bottom: 1px solid #edf2f7;
      padding-bottom: 0.35rem;
    }
    .detail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 0.65rem;
      font-size: 0.85rem;
      color: #334155;
    }
    .detail-grid span {
      color: #64748b;
      font-weight: 600;
      display: inline-block;
      min-width: 120px;
    }
    .docs-inspection-list {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .doc-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 0.75rem 1rem;
      border-radius: 4px;
    }
    .doc-badge {
      background: #e0f2fe;
      color: #0369a1;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      margin-right: 0.5rem;
    }
    .doc-filename {
      font-size: 0.85rem;
      font-weight: 600;
      color: #1e293b;
    }
    .doc-size {
      color: #64748b;
      margin-left: 0.35rem;
    }
    .btn-doc-view {
      background: #0369a1;
      color: #ffffff;
      border: none;
      padding: 0.35rem 0.65rem;
      border-radius: 4px;
      font-size: 0.8rem;
      cursor: pointer;
      margin-right: 0.5rem;
    }
    .btn-doc-download {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      color: #0f2b48;
      padding: 0.35rem 0.65rem;
      border-radius: 4px;
      font-size: 0.8rem;
      cursor: pointer;
    }
    .doc-item {
      flex-wrap: wrap;
    }
    .doc-verify-actions {
      width: 100%;
      margin-top: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px dashed #e2e8f0;
    }
    .doc-verify-row {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .doc-remarks-input {
      flex: 1;
      min-width: 180px;
      padding: 0.4rem 0.65rem;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 0.82rem;
      font-family: inherit;
    }
    .btn-doc-approve {
      background: #10b981;
      color: #ffffff;
      border: none;
      padding: 0.4rem 0.75rem;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    .btn-doc-approve:hover:not(:disabled) { background: #059669; }
    .btn-doc-approve:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-doc-reject {
      background: #ef4444;
      color: #ffffff;
      border: none;
      padding: 0.4rem 0.75rem;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    .btn-doc-reject:hover:not(:disabled) { background: #dc2626; }
    .btn-doc-reject:disabled { opacity: 0.6; cursor: not-allowed; }
    .doc-verify-success {
      width: 100%;
      margin-top: 0.35rem;
    }
    .doc-verified-label {
      font-size: 0.78rem;
      font-weight: 600;
      color: #059669;
    }
    .no-docs-note {
      font-size: 0.85rem;
      color: #64748b;
      font-style: italic;
    }
    .history-list {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .history-item {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 3px solid #94a3b8;
      border-radius: 4px;
      padding: 0.75rem 1rem;
    }
    .history-status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .history-arrow {
      color: #64748b;
      font-weight: 700;
    }
    .history-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-top: 0.4rem;
      font-size: 0.78rem;
      color: #64748b;
    }
    .history-remarks {
      margin-top: 0.35rem;
      font-size: 0.82rem;
      color: #334155;
    }
    .status-management-section {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 1rem 1.25rem;
    }
    .current-status-row {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin-bottom: 0.85rem;
    }
    .current-status-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: #475569;
    }
    .status-help {
      margin: 0 0 0.75rem;
      font-size: 0.82rem;
      color: #64748b;
    }
    .status-option-group {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-bottom: 0.85rem;
    }
    .status-option {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 0.4rem 0.65rem;
      cursor: pointer;
    }
    .status-option input {
      cursor: pointer;
    }
    .remarks-label {
      display: block;
      font-size: 0.82rem;
      font-weight: 600;
      color: #475569;
      margin-bottom: 0.35rem;
    }
    .status-management-section textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 0.6rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-family: inherit;
      font-size: 0.85rem;
      resize: vertical;
      margin-bottom: 0.75rem;
    }
    .status-update-actions {
      display: flex;
      justify-content: flex-end;
    }
    .btn-confirm-status {
      background: #0f2b48;
      color: #ffffff;
      border: none;
      padding: 0.55rem 1.1rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-confirm-status:hover:not(:disabled) {
      background: #1a426e;
    }
    .btn-confirm-status:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .terminal-note {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-left: 3px solid #94a3b8;
      border-radius: 4px;
      padding: 0.75rem 1rem;
      font-size: 0.85rem;
      color: #475569;
    }
    .alert-box {
      padding: 0.65rem 0.85rem;
      border-radius: 4px;
      font-size: 0.82rem;
      margin-top: 0.75rem;
    }
    .alert-box.error {
      background: #fee2e2;
      border: 1px solid #fca5a5;
      color: #991b1b;
    }
    .alert-box.success {
      background: #dcfce7;
      border: 1px solid #86efac;
      color: #166534;
    }
    .modal-footer {
      padding: 1rem 1.75rem;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      text-align: right;
      border-radius: 0 0 8px 8px;
    }
    .btn-close-bottom {
      background: #0f2b48;
      color: #ffffff;
      border: none;
      padding: 0.5rem 1.25rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #e2e8f0;
      border-top-color: #0f2b48;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 0.75rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .table-loading, .table-empty {
      padding: 3rem;
      text-align: center;
      color: #64748b;
    }
    .table-error {
      padding: 2rem;
      text-align: center;
      color: #991b1b;
      background: #fef2f2;
      border: 1px solid #fca5a5;
      border-radius: 6px;
    }
    .table-error p {
      margin: 0 0 0.75rem;
    }
  `]
})
export class AdminDashboardComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  private adminService = inject(AdminService);
  private documentService = inject(DocumentService);
  private route = inject(ActivatedRoute);

  public activeTab:
    | 'applications'
    | 'programmes'
    | 'sessions'
    | 'fees'
    | 'overview'
    | 'reviewers'
    | 'merit'
    | 'enrolments'
    | 'reports' = 'applications';

  public metrics: AdminDashboardMetrics = {
    totalApplications: 0,
    submitted: 0,
    underReview: 0,
    selected: 0,
    rejected: 0
  };

  public statusDistribution: StatusDistributionEntry[] = [];
  public departmentDistribution: DepartmentDistributionEntry[] = [];
  public categoryDistribution: CategoryDistributionEntry[] = [];
  public metricsError = '';
  public applicationsError = '';

  public applications: AdmissionApplication[] = [];
  public pagination: PaginationMeta | null = null;
  public inspectedApp: AdmissionApplication | null = null;

  public isLoadingMetrics = true;
  public isLoadingApps = true;

  // Status workflow controls
  public selectedNextStatus: ApplicationStatus | '' = '';
  public statusRemarks = '';
  public isUpdatingStatus = false;
  public statusUpdateError = '';
  public statusUpdateSuccess = '';

  // Document verification controls
  public docRemarksMap: { [docId: string]: string } = {};
  public docVerifyingId: string | null = null;
  public docVerifyingAction: 'Verified' | 'Rejected' | '' = '';
  public docVerifyError = '';
  public docVerifyErrorId: string | null = null;
  public docRejectingId: string | null = null;

  // Filter & Search bindings
  public searchQuery = '';
  public selectedDepartment = '';
  public selectedCategory = '';
  public selectedStatus = '';
  public sortBy = 'submittedAt';
  public sortOrder: 'asc' | 'desc' = 'desc';
  public pageSize = 10;
  public currentPage = 1;

  private searchDebounceTimer: any;

  ngOnInit(): void {
    const tabParam = this.route.snapshot.queryParams['tab'];
    if (
      tabParam &&
      [
        'applications',
        'programmes',
        'sessions',
        'fees',
        'overview',
        'reviewers',
        'merit',
        'enrolments',
        'reports'
      ].includes(tabParam)
    ) {
      this.activeTab = tabParam as any;
    }
    this.loadAllData();
  }

  setTab(tab: string): void {
    this.activeTab = tab as any;
    this.cdr.markForCheck();
  }

  get allowedNextStatuses(): ApplicationStatus[] {
    return this.inspectedApp?.allowedNextStatuses || [];
  }

  get hasApplications(): boolean {
    return this.metrics.totalApplications > 0;
  }

  /**
   * Convert an aggregated count into a bar width relative to the total number
   * of applications. The backend supplies the counts; this only controls the
   * visual proportion.
   */
  barPercentage(count: number): number {
    if (!this.metrics.totalApplications || this.metrics.totalApplications <= 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.round((count / this.metrics.totalApplications) * 1000) / 10
    );
  }

  loadAllData(): void {
    this.fetchMetrics();
    this.fetchApplications();
  }

  fetchMetrics(): void {
    this.isLoadingMetrics = true;
    this.metricsError = '';
    this.cdr.markForCheck();
    this.adminService.getDashboard().subscribe({
      next: (res) => {
        this.isLoadingMetrics = false;
        const data = res.data;

        if (!data || !data.metrics) {
          this.resetMetrics();
          this.metricsError = 'Dashboard statistics are currently unavailable.';
          this.cdr.markForCheck();
          return;
        }

        this.metrics = data.metrics;
        this.statusDistribution =
          data.statusDistribution && data.statusDistribution.length > 0
            ? data.statusDistribution
            : this.buildStatusDistributionFromMetrics(data.metrics);
        this.departmentDistribution = data.departmentDistribution || [];
        this.categoryDistribution = data.categoryDistribution || [];
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoadingMetrics = false;
        this.resetMetrics();
        this.metricsError =
          err?.error?.message ||
          'Unable to load dashboard statistics. Please try again.';
        this.cdr.markForCheck();
      }
    });
  }

  private resetMetrics(): void {
    this.metrics = {
      totalApplications: 0,
      submitted: 0,
      underReview: 0,
      selected: 0,
      rejected: 0
    };
    this.statusDistribution = [];
    this.departmentDistribution = [];
    this.categoryDistribution = [];
  }

  private buildStatusDistributionFromMetrics(
    metrics: AdminDashboardMetrics
  ): StatusDistributionEntry[] {
    return [
      { status: 'Submitted', count: metrics.submitted || 0 },
      { status: 'Under Review', count: metrics.underReview || 0 },
      { status: 'Selected', count: metrics.selected || 0 },
      { status: 'Rejected', count: metrics.rejected || 0 }
    ];
  }

  fetchApplications(): void {
    this.isLoadingApps = true;
    this.applicationsError = '';
    this.cdr.markForCheck();
    this.adminService
      .getApplications({
        search: this.searchQuery,
        department: this.selectedDepartment,
        category: this.selectedCategory,
        status: this.selectedStatus,
        sortBy: this.sortBy,
        sortOrder: this.sortOrder,
        page: this.currentPage,
        limit: this.pageSize
      })
      .subscribe({
        next: (res) => {
          this.isLoadingApps = false;
          const raw = res?.data;
          if (Array.isArray(raw)) {
            this.applications = raw;
          } else if (raw && Array.isArray((raw as any).applications)) {
            this.applications = (raw as any).applications;
          } else {
            this.applications = [];
          }

          if (res?.meta) {
            this.pagination = res.meta;
          } else if (raw && (raw as any).pagination) {
            this.pagination = (raw as any).pagination;
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isLoadingApps = false;
          this.applications = [];
          this.applicationsError =
            err?.error?.message ||
            'Unable to load applications. Please try again.';
          this.cdr.markForCheck();
        }
      });
  }

  onSearchChange(): void {
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.currentPage = 1;
      this.fetchApplications();
    }, 300);
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.fetchApplications();
  }

  onSortChange(): void {
    this.currentPage = 1;
    this.fetchApplications();
  }

  toggleSortOrder(): void {
    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    this.currentPage = 1;
    this.fetchApplications();
  }

  sortByColumn(field: string): void {
    if (this.sortBy === field) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = field;
      this.sortOrder = field === 'submittedAt' ? 'desc' : 'asc';
    }
    this.currentPage = 1;
    this.fetchApplications();
  }

  sortIcon(field: string): string {
    if (this.sortBy !== field) return '↕';
    return this.sortOrder === 'asc' ? '▲' : '▼';
  }

  ariaSort(field: string): 'ascending' | 'descending' | 'none' {
    if (this.sortBy !== field) return 'none';
    return this.sortOrder === 'asc' ? 'ascending' : 'descending';
  }

  filterByStatus(status: string): void {
    this.selectedStatus = status;
    this.currentPage = 1;
    this.fetchApplications();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.selectedDepartment = '';
    this.selectedCategory = '';
    this.selectedStatus = '';
    this.sortBy = 'submittedAt';
    this.sortOrder = 'desc';
    this.currentPage = 1;
    this.fetchApplications();
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.fetchApplications();
  }

  changePage(newPage: number): void {
    this.currentPage = newPage;
    this.fetchApplications();
  }

  inspectApplication(app: AdmissionApplication): void {
    if (!app._id) return;
    this.resetStatusForm();
    this.adminService.getApplicationById(app._id).subscribe({
      next: (res) => {
        this.inspectedApp = res.data;
        this.cdr.markForCheck();
      },
      error: () => {
        alert('Could not load application details.');
        this.cdr.markForCheck();
      }
    });
  }

  closeInspection(): void {
    this.inspectedApp = null;
    this.resetStatusForm();
    this.cdr.markForCheck();
  }

  updateStatus(): void {
    const application = this.inspectedApp;
    const nextStatus = this.selectedNextStatus;

    if (!application?._id || !nextStatus || this.isUpdatingStatus) {
      return;
    }

    this.isUpdatingStatus = true;
    this.statusUpdateError = '';
    this.statusUpdateSuccess = '';
    this.cdr.markForCheck();

    this.adminService
      .updateApplicationStatus(application._id, {
        status: nextStatus,
        remarks: this.statusRemarks.trim() || undefined
      })
      .subscribe({
        next: (res) => {
          this.isUpdatingStatus = false;
          const result = res.data;

          if (!result) {
            this.statusUpdateError = 'Status update completed without a confirmation response.';
            this.cdr.markForCheck();
            return;
          }

          const history = [...(application.statusHistory || [])];
          const newEntry: StatusHistoryEntry | undefined = result.history;

          if (
            newEntry &&
            (!newEntry._id || !history.some(entry => entry._id === newEntry._id))
          ) {
            history.push(newEntry);
          }

          history.sort(
            (a, b) =>
              new Date(a.timestamp || a.createdAt || 0).getTime() -
              new Date(b.timestamp || b.createdAt || 0).getTime()
          );

          this.inspectedApp = {
            ...application,
            status: result.newStatus,
            allowedNextStatuses: result.allowedNextStatuses || [],
            statusHistory: history
          };

          this.selectedNextStatus = '';
          this.statusRemarks = '';
          this.statusUpdateSuccess = res.message || 'Application status updated successfully.';
          this.cdr.markForCheck();
          this.fetchMetrics();
          this.fetchApplications();
        },
        error: (err) => {
          this.isUpdatingStatus = false;
          this.statusUpdateError =
            err.error?.message ||
            'Failed to update application status. Please refresh and try again.';
          this.cdr.markForCheck();
        }
      });
  }

  private resetStatusForm(): void {
    this.selectedNextStatus = '';
    this.statusRemarks = '';
    this.isUpdatingStatus = false;
    this.statusUpdateError = '';
    this.statusUpdateSuccess = '';
    this.cdr.markForCheck();
  }

  viewDocument(doc: UploadedDocument): void {
    this.documentService.viewDocument(doc._id).subscribe({
      next: (blob) => {
        this.documentService.openBlobInNewTab(blob);
      },
      error: () => {
        alert('Could not view document.');
      }
    });
  }

  downloadDocument(doc: UploadedDocument): void {
    this.documentService.downloadDocument(doc._id).subscribe({
      next: (blob) => {
        this.documentService.triggerBlobDownload(blob, doc.originalFileName);
      },
      error: () => {
        alert('Could not download document.');
      }
    });
  }

  verifyDocumentAction(doc: UploadedDocument, action: 'Verified' | 'Rejected'): void {
    const remarks = (this.docRemarksMap[doc._id] || '').trim();

    if (action === 'Rejected' && !remarks) {
      this.docVerifyError = 'Remarks are mandatory when rejecting a document.';
      this.docVerifyErrorId = doc._id;
      this.docRejectingId = doc._id;
      this.cdr.markForCheck();
      return;
    }

    this.docVerifyingId = doc._id;
    this.docVerifyingAction = action;
    this.docVerifyError = '';
    this.docVerifyErrorId = null;
    this.docRejectingId = null;
    this.cdr.markForCheck();

    this.documentService.verifyDocument(doc._id, action, remarks).subscribe({
      next: (res) => {
        this.docVerifyingId = null;
        this.docVerifyingAction = '';
        const updated = res.data;

        if (this.inspectedApp?.documents) {
          const idx = this.inspectedApp.documents.findIndex((d: UploadedDocument) => d._id === doc._id);
          if (idx !== -1 && updated) {
            this.inspectedApp.documents[idx] = {
              ...this.inspectedApp.documents[idx],
              verificationStatus: updated.verificationStatus,
              verifiedBy: updated.verifiedBy,
              verifiedAt: updated.verifiedAt,
              verificationRemarks: updated.verificationRemarks
            } as UploadedDocument;
          }
        }

        delete this.docRemarksMap[doc._id];
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.docVerifyingId = null;
        this.docVerifyingAction = '';
        this.docVerifyError = err?.error?.message || 'Failed to verify document. Please try again.';
        this.docVerifyErrorId = doc._id;
        this.cdr.markForCheck();
      }
    });
  }

  formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
