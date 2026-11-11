import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DocumentService } from '../../../core/services/document.service';
import { AuthService } from '../../../core/services/auth.service';
import { UploadedDocument, DocumentVerificationHistory } from '../../../core/models/document.model';

@Component({
  selector: 'app-reviewer-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="reviewer-container">
      <!-- Header Banner -->
      <header class="reviewer-header">
        <div class="header-main">
          <div class="title-area">
            <h2>Document Verification Desk</h2>
            <p class="subtitle">Inspect, authenticate and verify submitted applicant credentials and marksheets</p>
          </div>
          <div class="user-meta" *ngIf="currentUser">
            <span class="user-name">{{ currentUser.fullName }}</span>
            <span class="badge-role">{{ currentUser.role | uppercase }}</span>
          </div>
        </div>

        <!-- Metric Summary Cards -->
        <div class="metrics-grid">
          <div class="metric-card card-pending" (click)="setStatusFilter('Pending')">
            <div class="metric-icon">&#9203;</div>
            <div class="metric-info">
              <span class="metric-val">{{ counts.pending }}</span>
              <span class="metric-lbl">Pending Review</span>
            </div>
          </div>
          <div class="metric-card card-verified" (click)="setStatusFilter('Verified')">
            <div class="metric-icon">&#10003;</div>
            <div class="metric-info">
              <span class="metric-val">{{ counts.verified }}</span>
              <span class="metric-lbl">Verified</span>
            </div>
          </div>
          <div class="metric-card card-rejected" (click)="setStatusFilter('Rejected')">
            <div class="metric-icon">&#10007;</div>
            <div class="metric-info">
              <span class="metric-val">{{ counts.rejected }}</span>
              <span class="metric-lbl">Rejected</span>
            </div>
          </div>
          <div class="metric-card card-total" (click)="setStatusFilter('all')">
            <div class="metric-icon">&#128196;</div>
            <div class="metric-info">
              <span class="metric-val">{{ counts.total }}</span>
              <span class="metric-lbl">Total Documents</span>
            </div>
          </div>
        </div>
      </header>

      <!-- Feedback Notifications -->
      <div *ngIf="actionSuccess" class="alert-box success">
        <span>{{ actionSuccess }}</span>
        <button class="btn-close-alert" (click)="actionSuccess = ''">&times;</button>
      </div>
      <div *ngIf="actionError" class="alert-box error">
        <span>{{ actionError }}</span>
        <button class="btn-close-alert" (click)="actionError = ''">&times;</button>
      </div>

      <!-- Controls & Filters Toolbar -->
      <section class="toolbar-card">
        <div class="toolbar-flex">
          <div class="search-box">
            <input
              type="text"
              [(ngModel)]="searchQuery"
              (ngModelChange)="onSearchChange()"
              placeholder="Search by candidate name, application ID or email..."
            />
          </div>

          <div class="filters-row">
            <select [(ngModel)]="selectedStatus" (change)="applyFilters()">
              <option value="all">All Statuses</option>
              <option value="Pending">Pending Verification</option>
              <option value="Verified">Verified Documents</option>
              <option value="Rejected">Rejected Documents</option>
            </select>

            <select [(ngModel)]="selectedDocType" (change)="applyFilters()">
              <option value="all">All Document Types</option>
              <option value="Class 10 Marksheet">Class 10 Marksheet</option>
              <option value="Class 12 Marksheet">Class 12 Marksheet</option>
              <option value="Entrance Examination Scorecard">Entrance Examination Scorecard</option>
              <option value="Photograph">Photograph</option>
              <option value="Other Supporting Documents">Other Supporting Documents</option>
            </select>

            <button type="button" class="btn-refresh" (click)="loadQueue()">
              &#8635; Refresh
            </button>
          </div>
        </div>
      </section>

      <!-- Loading State -->
      <div *ngIf="isLoading" class="state-card loading">
        <div class="spinner"></div>
        <p>Loading document queue...</p>
      </div>

      <!-- Error State -->
      <div *ngIf="queueError && !isLoading" class="state-card error-card">
        <p>{{ queueError }}</p>
        <button class="btn-retry" (click)="loadQueue()">Retry</button>
      </div>

      <!-- Empty State -->
      <div *ngIf="!isLoading && !queueError && documents.length === 0" class="state-card empty">
        <div class="empty-icon">&#128194;</div>
        <h3>No Documents Found</h3>
        <p>No documents match your current filter and search criteria.</p>
        <button class="btn-reset" (click)="resetFilters()">Clear Filters</button>
      </div>

      <!-- Queue Table -->
      <section *ngIf="!isLoading && !queueError && documents.length > 0" class="table-card">
        <div class="table-header">
          <h3>Verification Queue ({{ documents.length }} of {{ pagination.total }})</h3>
        </div>

        <div class="table-responsive">
          <table class="doc-table">
            <thead>
              <tr>
                <th>Document Type</th>
                <th>Application ID</th>
                <th>Applicant</th>
                <th>File Information</th>
                <th>Status</th>
                <th>Audit / Verifier</th>
                <th class="actions-col">Verification Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let doc of documents" [class.row-rejected]="doc.verificationStatus === 'Rejected'">
                <td>
                  <span class="type-badge">{{ doc.documentType }}</span>
                </td>
                <td class="app-cell">
                  <strong>{{ doc.application?.applicationId || 'N/A' }}</strong>
                  <small *ngIf="doc.application?.status" class="app-status-badge">
                    App: {{ doc.application?.status }}
                  </small>
                </td>
                <td class="applicant-cell">
                  <div class="applicant-name">{{ doc.applicant?.fullName || 'Candidate' }}</div>
                  <div class="applicant-email">{{ doc.applicant?.email }}</div>
                  <small *ngIf="doc.applicant?.phone">{{ doc.applicant?.phone }}</small>
                </td>
                <td class="file-cell">
                  <div class="filename" [title]="doc.originalFileName">{{ doc.originalFileName }}</div>
                  <small class="file-meta">{{ formatBytes(doc.fileSize) }} &bull; {{ doc.uploadedAt | date:'mediumDate' }}</small>
                </td>
                <td>
                  <span
                    class="status-pill"
                    [ngClass]="(doc.verificationStatus || 'Pending').toLowerCase()"
                  >
                    {{ doc.verificationStatus || 'Pending' }}
                  </span>
                </td>
                <td class="verifier-cell">
                  <ng-container *ngIf="doc.verifiedBy; else unverifiedMeta">
                    <div class="verifier-name">{{ getVerifierName(doc.verifiedBy) }}</div>
                    <small class="verifier-date">{{ doc.verifiedAt | date:'short' }}</small>
                    <div *ngIf="doc.verificationRemarks" class="remarks-tooltip" [title]="doc.verificationRemarks">
                      "{{ doc.verificationRemarks }}"
                    </div>
                  </ng-container>
                  <ng-template #unverifiedMeta>
                    <span class="text-muted">Awaiting Inspection</span>
                  </ng-template>
                </td>
                <td class="actions-col">
                  <div class="btn-group">
                    <button
                      type="button"
                      class="btn-action btn-view"
                      (click)="viewDocument(doc)"
                      title="Inspect Document"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      class="btn-action btn-download"
                      (click)="downloadDocument(doc)"
                      title="Download File"
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      class="btn-action btn-verify"
                      [disabled]="isProcessing"
                      (click)="openApproveModal(doc)"
                      title="Mark as Verified"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      class="btn-action btn-reject"
                      [disabled]="isProcessing"
                      (click)="openRejectModal(doc)"
                      title="Reject with remarks"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      class="btn-action btn-history"
                      (click)="openHistoryModal(doc)"
                      title="View Verification History"
                    >
                      History
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Approval Modal -->
      <div *ngIf="showApproveModal" class="modal-backdrop">
        <div class="modal-card">
          <div class="modal-header">
            <h3>Approve Document Verification</h3>
            <button class="btn-modal-close" (click)="closeModals()">&times;</button>
          </div>
          <div class="modal-body">
            <p>
              Are you sure you want to mark this <strong>{{ activeDoc?.documentType }}</strong> as
              <span class="text-success"><strong>Verified</strong></span>?
            </p>
            <div class="doc-summary-box">
              <div><strong>Application:</strong> {{ activeDoc?.application?.applicationId }}</div>
              <div><strong>Applicant:</strong> {{ activeDoc?.applicant?.fullName }}</div>
              <div><strong>File:</strong> {{ activeDoc?.originalFileName }}</div>
            </div>
            <div class="form-group">
              <label for="approveRemarks">Verification Remarks (Optional)</label>
              <textarea
                id="approveRemarks"
                [(ngModel)]="verificationRemarks"
                placeholder="e.g. Verified against original board marksheet or roll database."
                rows="3"
              ></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" (click)="closeModals()" [disabled]="isProcessing">Cancel</button>
            <button class="btn-confirm-approve" (click)="submitApproval()" [disabled]="isProcessing">
              <span *ngIf="!isProcessing">Confirm Verification</span>
              <span *ngIf="isProcessing">Processing...</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Rejection Modal -->
      <div *ngIf="showRejectModal" class="modal-backdrop">
        <div class="modal-card">
          <div class="modal-header reject-header">
            <h3>Reject Document</h3>
            <button class="btn-modal-close" (click)="closeModals()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="alert-box error" *ngIf="modalError">
              {{ modalError }}
            </div>
            <p>
              Please enter mandatory rejection remarks explaining why this <strong>{{ activeDoc?.documentType }}</strong> is being rejected.
              This explanation will be shown directly to the candidate so they can re-upload a compliant replacement.
            </p>
            <div class="doc-summary-box">
              <div><strong>Application:</strong> {{ activeDoc?.application?.applicationId }}</div>
              <div><strong>Applicant:</strong> {{ activeDoc?.applicant?.fullName }}</div>
              <div><strong>File:</strong> {{ activeDoc?.originalFileName }}</div>
            </div>
            <div class="form-group">
              <label for="rejectRemarks">Mandatory Rejection Remarks *</label>
              <textarea
                id="rejectRemarks"
                [(ngModel)]="verificationRemarks"
                placeholder="e.g. Scanned document is blurry, cut off, or illegible. Please re-upload a clear color scan."
                rows="4"
              ></textarea>
              <small class="field-hint">A clear reason is required so the applicant can submit a corrected copy.</small>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" (click)="closeModals()" [disabled]="isProcessing">Cancel</button>
            <button class="btn-confirm-reject" (click)="submitRejection()" [disabled]="isProcessing || !verificationRemarks?.trim()">
              <span *ngIf="!isProcessing">Reject Document</span>
              <span *ngIf="isProcessing">Processing...</span>
            </button>
          </div>
        </div>
      </div>

      <!-- History Modal -->
      <div *ngIf="showHistoryModal" class="modal-backdrop">
        <div class="modal-card modal-lg">
          <div class="modal-header">
            <h3>Verification Audit Trail</h3>
            <button class="btn-modal-close" (click)="closeModals()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="doc-summary-box">
              <div><strong>Document:</strong> {{ activeDoc?.documentType }} ({{ activeDoc?.originalFileName }})</div>
              <div><strong>Application:</strong> {{ activeDoc?.application?.applicationId }}</div>
              <div><strong>Applicant:</strong> {{ activeDoc?.applicant?.fullName }}</div>
            </div>

            <div *ngIf="isLoadingHistory" class="loading-mini">
              <div class="spinner"></div>
              <p>Loading history...</p>
            </div>

            <div *ngIf="!isLoadingHistory && historyRecords.length === 0" class="empty-docs">
              <p>No previous verification actions recorded for this document yet.</p>
            </div>

            <div *ngIf="!isLoadingHistory && historyRecords.length > 0" class="history-timeline">
              <div class="history-item" *ngFor="let item of historyRecords">
                <div class="history-header">
                  <span class="status-pill" [ngClass]="item.newStatus.toLowerCase()">
                    {{ item.newStatus }}
                  </span>
                  <span class="history-date">{{ item.timestamp | date:'medium' }}</span>
                </div>
                <div class="history-meta">
                  <span>Verifier: <strong>{{ item.verifiedBy?.fullName || 'Reviewer' }}</strong> ({{ item.verifiedBy?.email }})</span>
                  <span>Transition: {{ item.previousStatus }} &rarr; {{ item.newStatus }}</span>
                </div>
                <div class="history-remarks" *ngIf="item.remarks">
                  "{{ item.remarks }}"
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" (click)="closeModals()">Close</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .reviewer-container {
      max-width: 1200px;
      margin: 2rem auto;
      padding: 0 1.5rem;
    }
    .reviewer-header {
      background: #0f2b48;
      color: #ffffff;
      padding: 1.75rem 2rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
      box-shadow: 0 4px 12px rgba(15, 43, 72, 0.15);
    }
    .header-main {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .title-area h2 {
      margin: 0;
      font-size: 1.6rem;
      font-weight: 700;
      color: #ffffff;
    }
    .subtitle {
      margin: 0.35rem 0 0;
      color: #cbd5e1;
      font-size: 0.95rem;
    }
    .user-meta {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: rgba(255, 255, 255, 0.1);
      padding: 0.4rem 0.85rem;
      border-radius: 20px;
    }
    .user-name {
      font-size: 0.9rem;
      font-weight: 600;
    }
    .badge-role {
      background: #c98a2c;
      color: #0f2b48;
      font-weight: 800;
      font-size: 0.75rem;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }
    .metric-card {
      background: #ffffff;
      color: #1e293b;
      padding: 1rem 1.25rem;
      border-radius: 6px;
      display: flex;
      align-items: center;
      gap: 1rem;
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .metric-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
    }
    .metric-icon {
      font-size: 1.75rem;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
    }
    .card-pending .metric-icon { background: #fef3c7; color: #b45309; }
    .card-verified .metric-icon { background: #d1fae5; color: #047857; }
    .card-rejected .metric-icon { background: #fee2e2; color: #b91c1c; }
    .card-total .metric-icon { background: #e0f2fe; color: #0369a1; }
    .metric-val {
      display: block;
      font-size: 1.5rem;
      font-weight: 700;
      color: #0f2b48;
      line-height: 1.2;
    }
    .metric-lbl {
      font-size: 0.8rem;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .toolbar-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1rem 1.25rem;
      margin-bottom: 1.5rem;
    }
    .toolbar-flex {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .search-box {
      flex: 1;
      min-width: 280px;
    }
    .search-box input {
      width: 100%;
      padding: 0.65rem 0.9rem;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 0.9rem;
      outline: none;
    }
    .search-box input:focus {
      border-color: #0f2b48;
      box-shadow: 0 0 0 2px rgba(15, 43, 72, 0.15);
    }
    .filters-row {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .filters-row select {
      padding: 0.65rem 0.9rem;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 0.9rem;
      background: #ffffff;
      color: #1e293b;
    }
    .btn-refresh {
      background: #1a426e;
      color: #ffffff;
      border: none;
      padding: 0.65rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
    }
    .btn-refresh:hover { background: #0f2b48; }
    .alert-box {
      padding: 0.85rem 1.25rem;
      border-radius: 6px;
      margin-bottom: 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.95rem;
    }
    .alert-box.success { background: #d1fae5; border: 1px solid #6ee7b7; color: #065f46; }
    .alert-box.error { background: #fee2e2; border: 1px solid #fca5a5; color: #991b1b; }
    .btn-close-alert {
      background: none;
      border: none;
      font-size: 1.25rem;
      cursor: pointer;
      color: inherit;
    }
    .table-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    .table-header {
      padding: 1rem 1.25rem;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    .table-header h3 {
      margin: 0;
      font-size: 1.1rem;
      color: #0f2b48;
    }
    .table-responsive {
      overflow-x: auto;
    }
    .doc-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    .doc-table th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 600;
      padding: 0.85rem 1rem;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    .doc-table td {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }
    .row-rejected {
      background: #fffafa;
    }
    .type-badge {
      display: inline-block;
      background: #e2e8f0;
      color: #0f2b48;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .app-cell strong {
      display: block;
      color: #0f2b48;
    }
    .app-status-badge {
      display: inline-block;
      font-size: 0.75rem;
      color: #64748b;
    }
    .applicant-name {
      font-weight: 600;
      color: #1e293b;
    }
    .applicant-email {
      font-size: 0.8rem;
      color: #64748b;
    }
    .filename {
      font-weight: 600;
      color: #1e293b;
      max-width: 180px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .file-meta {
      color: #64748b;
      font-size: 0.75rem;
    }
    .status-pill {
      display: inline-block;
      padding: 0.25rem 0.65rem;
      border-radius: 12px;
      font-weight: 700;
      font-size: 0.75rem;
      text-transform: uppercase;
    }
    .status-pill.pending { background: #fef3c7; color: #92400e; }
    .status-pill.verified { background: #d1fae5; color: #065f46; }
    .status-pill.rejected { background: #fee2e2; color: #991b1b; }
    .verifier-name {
      font-weight: 600;
      color: #334155;
      font-size: 0.85rem;
    }
    .verifier-date {
      color: #64748b;
      font-size: 0.75rem;
    }
    .remarks-tooltip {
      font-size: 0.75rem;
      color: #b91c1c;
      font-style: italic;
      max-width: 160px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .actions-col {
      text-align: right;
    }
    .btn-group {
      display: inline-flex;
      gap: 0.35rem;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .btn-action {
      padding: 0.35rem 0.65rem;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      transition: background 0.15s;
    }
    .btn-view { background: #e2e8f0; color: #1e293b; }
    .btn-view:hover { background: #cbd5e1; }
    .btn-download { background: #f1f5f9; color: #475569; border-color: #cbd5e1; }
    .btn-download:hover { background: #e2e8f0; }
    .btn-verify { background: #10b981; color: #ffffff; }
    .btn-verify:hover { background: #059669; }
    .btn-reject { background: #ef4444; color: #ffffff; }
    .btn-reject:hover { background: #dc2626; }
    .btn-history { background: #64748b; color: #ffffff; }
    .btn-history:hover { background: #475569; }
    .btn-action:disabled { opacity: 0.6; cursor: not-allowed; }
    .state-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 3rem;
      text-align: center;
    }
    .empty-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
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
    .btn-retry, .btn-reset {
      margin-top: 1rem;
      background: #0f2b48;
      color: #ffffff;
      padding: 0.5rem 1.25rem;
      border: none;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
    }

    /* Modals */
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
      max-width: 520px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
      overflow: hidden;
    }
    .modal-lg { max-width: 680px; }
    .modal-header {
      padding: 1rem 1.5rem;
      background: #0f2b48;
      color: #ffffff;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .modal-header.reject-header { background: #991b1b; }
    .modal-header h3 { margin: 0; font-size: 1.15rem; }
    .btn-modal-close {
      background: none;
      border: none;
      color: #ffffff;
      font-size: 1.5rem;
      cursor: pointer;
    }
    .modal-body {
      padding: 1.25rem 1.5rem;
    }
    .doc-summary-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      font-size: 0.85rem;
      line-height: 1.5;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .form-group label {
      font-weight: 600;
      font-size: 0.85rem;
      color: #334155;
    }
    .form-group textarea {
      padding: 0.65rem;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 0.9rem;
      resize: vertical;
    }
    .field-hint {
      color: #64748b;
      font-size: 0.75rem;
    }
    .modal-footer {
      padding: 1rem 1.5rem;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
    }
    .btn-cancel {
      padding: 0.5rem 1rem;
      background: #e2e8f0;
      border: none;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-confirm-approve {
      padding: 0.5rem 1.25rem;
      background: #10b981;
      color: #ffffff;
      border: none;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-confirm-reject {
      padding: 0.5rem 1.25rem;
      background: #ef4444;
      color: #ffffff;
      border: none;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-confirm-reject:disabled { opacity: 0.5; cursor: not-allowed; }
    .text-success { color: #059669; }
    .history-timeline {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      max-height: 320px;
      overflow-y: auto;
    }
    .history-item {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 0.75rem 1rem;
    }
    .history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.35rem;
    }
    .history-date { font-size: 0.8rem; color: #64748b; }
    .history-meta { font-size: 0.85rem; color: #334155; }
    .history-remarks {
      margin-top: 0.35rem;
      font-size: 0.85rem;
      color: #b91c1c;
      font-style: italic;
      background: #fff1f2;
      padding: 0.35rem 0.5rem;
      border-radius: 4px;
    }
  `]
})
export class ReviewerDashboardComponent implements OnInit {
  private documentService = inject(DocumentService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  public currentUser = this.authService.currentUserValue;
  public documents: UploadedDocument[] = [];
  public counts = {
    pending: 0,
    verified: 0,
    rejected: 0,
    total: 0
  };

  public pagination = {
    total: 0,
    page: 1,
    limit: 50,
    pages: 1
  };

  public isLoading = false;
  public queueError = '';
  public actionSuccess = '';
  public actionError = '';
  public isProcessing = false;

  // Filters
  public searchQuery = '';
  public selectedStatus = 'all';
  public selectedDocType = 'all';

  // Modals state
  public showApproveModal = false;
  public showRejectModal = false;
  public showHistoryModal = false;
  public activeDoc: UploadedDocument | null = null;
  public verificationRemarks = '';
  public modalError = '';

  // History records
  public historyRecords: DocumentVerificationHistory[] = [];
  public isLoadingHistory = false;

  ngOnInit(): void {
    this.loadQueue();
  }

  loadQueue(): void {
    this.isLoading = true;
    this.queueError = '';
    this.actionError = '';

    this.documentService
      .getReviewQueue({
        status: this.selectedStatus,
        search: this.searchQuery,
        documentType: this.selectedDocType,
        page: this.pagination.page,
        limit: this.pagination.limit
      })
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.success && res.data) {
            this.documents = res.data;
            if (res.meta) {
              this.pagination = res.meta;
            }
            this.computeCounts();
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isLoading = false;
          this.queueError = err.error?.message || 'Failed to load document verification queue.';
          this.cdr.markForCheck();
        }
      });
  }

  computeCounts(): void {
    let p = 0, v = 0, r = 0;
    for (const d of this.documents) {
      const st = d.verificationStatus || 'Pending';
      if (st === 'Pending') p++;
      else if (st === 'Verified') v++;
      else if (st === 'Rejected') r++;
    }
    this.counts.pending = p;
    this.counts.verified = v;
    this.counts.rejected = r;
    this.counts.total = this.pagination.total || this.documents.length;
  }

  setStatusFilter(status: string): void {
    this.selectedStatus = status;
    this.loadQueue();
  }

  onSearchChange(): void {
    this.pagination.page = 1;
    this.loadQueue();
  }

  applyFilters(): void {
    this.pagination.page = 1;
    this.loadQueue();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.selectedStatus = 'all';
    this.selectedDocType = 'all';
    this.pagination.page = 1;
    this.loadQueue();
  }

  viewDocument(doc: UploadedDocument): void {
    this.documentService.viewDocument(doc._id).subscribe({
      next: (blob) => this.documentService.openBlobInNewTab(blob),
      error: () => {
        this.actionError = `Could not view ${doc.originalFileName}.`;
        this.cdr.markForCheck();
      }
    });
  }

  downloadDocument(doc: UploadedDocument): void {
    this.documentService.downloadDocument(doc._id).subscribe({
      next: (blob) => this.documentService.triggerBlobDownload(blob, doc.originalFileName),
      error: () => {
        this.actionError = `Could not download ${doc.originalFileName}.`;
        this.cdr.markForCheck();
      }
    });
  }

  openApproveModal(doc: UploadedDocument): void {
    this.activeDoc = doc;
    this.verificationRemarks = '';
    this.modalError = '';
    this.showApproveModal = true;
  }

  submitApproval(): void {
    if (!this.activeDoc) return;
    this.isProcessing = true;
    this.modalError = '';

    this.documentService
      .verifyDocument(this.activeDoc._id, 'Verified', this.verificationRemarks)
      .subscribe({
        next: (res) => {
          this.isProcessing = false;
          this.showApproveModal = false;
          this.actionSuccess = `Document '${this.activeDoc?.originalFileName}' successfully verified.`;
          this.activeDoc = null;
          this.loadQueue();
        },
        error: (err) => {
          this.isProcessing = false;
          this.modalError = err.error?.message || 'Failed to verify document.';
          this.cdr.markForCheck();
        }
      });
  }

  openRejectModal(doc: UploadedDocument): void {
    this.activeDoc = doc;
    this.verificationRemarks = '';
    this.modalError = '';
    this.showRejectModal = true;
  }

  submitRejection(): void {
    if (!this.activeDoc) return;
    if (!this.verificationRemarks || !this.verificationRemarks.trim()) {
      this.modalError = 'Rejection remarks are mandatory.';
      return;
    }
    this.isProcessing = true;
    this.modalError = '';

    this.documentService
      .verifyDocument(this.activeDoc._id, 'Rejected', this.verificationRemarks.trim())
      .subscribe({
        next: (res) => {
          this.isProcessing = false;
          this.showRejectModal = false;
          this.actionSuccess = `Document '${this.activeDoc?.originalFileName}' marked as Rejected. Applicant will be prompted to replace it.`;
          this.activeDoc = null;
          this.loadQueue();
        },
        error: (err) => {
          this.isProcessing = false;
          this.modalError = err.error?.message || 'Failed to reject document.';
          this.cdr.markForCheck();
        }
      });
  }

  openHistoryModal(doc: UploadedDocument): void {
    this.activeDoc = doc;
    this.showHistoryModal = true;
    this.isLoadingHistory = true;
    this.historyRecords = [];

    this.documentService.getVerificationHistory(doc._id).subscribe({
      next: (res) => {
        this.isLoadingHistory = false;
        if (res.success && res.data) {
          this.historyRecords = res.data;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoadingHistory = false;
        this.cdr.markForCheck();
      }
    });
  }

  closeModals(): void {
    this.showApproveModal = false;
    this.showRejectModal = false;
    this.showHistoryModal = false;
    this.activeDoc = null;
    this.verificationRemarks = '';
    this.modalError = '';
  }

  getVerifierName(verifier: any): string {
    if (!verifier) return 'Reviewer';
    if (typeof verifier === 'object' && verifier.fullName) return verifier.fullName;
    return 'Reviewer';
  }

  formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}
