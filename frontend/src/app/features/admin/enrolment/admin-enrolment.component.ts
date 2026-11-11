import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentService } from '../../../core/services/payment.service';
import { AdminService } from '../../../core/services/admin.service';
import {
  Payment,
  Enrolment,
  PaymentStatistics
} from '../../../core/models/payment.model';
import { Programme } from '../../../core/models/programme.model';
import { AcademicSession } from '../../../core/models/session.model';

@Component({
  selector: 'app-admin-enrolment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-enrolment-root">
      <!-- Section Header -->
      <div class="enrolment-header">
        <div class="header-content">
          <h3>Admission Confirmation & Final Enrolment Directory</h3>
          <p>Inspect fee transactions, manage permanent student enrolments, track revenue collections, and perform manual reconciliation.</p>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div class="kpi-grid">
        <div class="kpi-card kpi-enrolled">
          <div class="kpi-icon">🎓</div>
          <div class="kpi-body">
            <span class="kpi-label">Total Enrolled Students</span>
            <span class="kpi-value">{{ statistics?.totalEnrolled ?? 0 }}</span>
          </div>
        </div>

        <div class="kpi-card kpi-collection">
          <div class="kpi-icon">₹</div>
          <div class="kpi-body">
            <span class="kpi-label">Total Fees Collected</span>
            <span class="kpi-value">₹{{ (statistics?.totalFeesCollected ?? 0).toLocaleString() }}</span>
          </div>
        </div>

        <div class="kpi-card kpi-pending">
          <div class="kpi-icon">⏳</div>
          <div class="kpi-body">
            <span class="kpi-label">Pending Payments</span>
            <span class="kpi-value">{{ statistics?.totalPaymentsPending ?? 0 }}</span>
          </div>
        </div>

        <div class="kpi-card kpi-failed">
          <div class="kpi-icon">⚠️</div>
          <div class="kpi-body">
            <span class="kpi-label">Failed / Cancelled</span>
            <span class="kpi-value">{{ statistics?.totalPaymentsFailed ?? 0 }}</span>
          </div>
        </div>
      </div>

      <!-- Navigation Tabs: Enrolments vs Payments -->
      <div class="nav-tabs">
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab === 'enrolments'"
          (click)="switchTab('enrolments')"
        >
          🎓 Confirmed Enrolments Directory ({{ enrolmentsTotal }})
        </button>
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab === 'payments'"
          (click)="switchTab('payments')"
        >
          💳 Payment Transactions ({{ paymentsTotal }})
        </button>
      </div>

      <!-- Alert / Flash Message -->
      <div *ngIf="message" class="alert-box" [ngClass]="messageType">
        <span>{{ message }}</span>
        <button type="button" class="close-alert" (click)="message = ''">&times;</button>
      </div>

      <!-- TAB 1: ENROLMENTS DIRECTORY -->
      <div *ngIf="activeTab === 'enrolments'" class="tab-content">
        <!-- Filter Controls -->
        <div class="filter-bar">
          <div class="filter-group search-input">
            <label for="enrolmentSearch">Search Directory:</label>
            <input
              id="enrolmentSearch"
              type="text"
              [(ngModel)]="enrolmentSearchQuery"
              placeholder="Search by Enrolment No, Candidate Name, or App ID..."
              (keyup.enter)="loadEnrolments(1)"
            />
          </div>

          <div class="filter-group">
            <label for="enrolmentProgFilter">Programme:</label>
            <select id="enrolmentProgFilter" [(ngModel)]="enrolmentSelectedProgramme" (change)="loadEnrolments(1)">
              <option value="">All Programmes</option>
              <option *ngFor="let prog of programmes" [value]="prog._id">
                {{ prog.programmeCode }} — {{ prog.programmeName }}
              </option>
            </select>
          </div>

          <div class="filter-actions">
            <button class="btn-primary" (click)="loadEnrolments(1)" [disabled]="isLoading">
              {{ isLoading ? 'Loading...' : 'Apply Filter' }}
            </button>
            <button class="btn-secondary" (click)="resetEnrolmentFilters()" [disabled]="isLoading">
              Reset
            </button>
          </div>
        </div>

        <!-- Enrolments Table -->
        <div class="table-container" *ngIf="!isLoading && enrolments.length > 0">
          <table class="data-table">
            <thead>
              <tr>
                <th>Enrolment Number</th>
                <th>Application ID</th>
                <th>Candidate Name</th>
                <th>Programme</th>
                <th>Category</th>
                <th>Seat #</th>
                <th>Fee Paid</th>
                <th>Confirmed On</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of enrolments">
                <td>
                  <span class="enrolment-badge">{{ item.enrolmentNumber }}</span>
                </td>
                <td><strong>{{ item.application?.applicationId || item.applicationId }}</strong></td>
                <td>
                  <div class="candidate-meta">
                    <span class="name">{{ item.applicant?.fullName || 'N/A' }}</span>
                    <span class="email">{{ item.applicant?.email }}</span>
                  </div>
                </td>
                <td>
                  <span class="prog-code">{{ item.programme?.programmeCode }}</span>
                  <small class="prog-name">{{ item.programme?.programmeName }}</small>
                </td>
                <td>
                  <span class="category-pill">{{ item.allocatedCategory }}</span>
                </td>
                <td>
                  <span class="seat-badge" *ngIf="item.seatNumber">#{{ item.seatNumber }}</span>
                  <span class="text-muted" *ngIf="!item.seatNumber">—</span>
                </td>
                <td>
                  <strong class="fee-text">₹{{ (item.payment?.amount || item.feeAmountPaid || 0).toLocaleString() }}</strong>
                </td>
                <td>
                  <span class="date-text">{{ item.confirmedAt | date:'mediumDate' }}</span>
                  <small class="time-text">{{ item.confirmedAt | date:'shortTime' }}</small>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Empty State for Enrolments -->
        <div class="empty-state" *ngIf="!isLoading && enrolments.length === 0">
          <div class="empty-icon">🎓</div>
          <h4>No confirmed enrolments found</h4>
          <p>No candidates have confirmed admission with the selected filters.</p>
        </div>

        <!-- Pagination -->
        <div class="pagination-bar" *ngIf="enrolmentsTotalPages > 1">
          <button
            class="btn-page"
            [disabled]="enrolmentsPage <= 1 || isLoading"
            (click)="loadEnrolments(enrolmentsPage - 1)"
          >
            &laquo; Previous
          </button>
          <span class="page-indicator">Page {{ enrolmentsPage }} of {{ enrolmentsTotalPages }} ({{ enrolmentsTotal }} records)</span>
          <button
            class="btn-page"
            [disabled]="enrolmentsPage >= enrolmentsTotalPages || isLoading"
            (click)="loadEnrolments(enrolmentsPage + 1)"
          >
            Next &raquo;
          </button>
        </div>
      </div>

      <!-- TAB 2: PAYMENTS DIRECTORY -->
      <div *ngIf="activeTab === 'payments'" class="tab-content">
        <!-- Filter Controls -->
        <div class="filter-bar">
          <div class="filter-group search-input">
            <label for="paymentSearch">Search Transactions:</label>
            <input
              id="paymentSearch"
              type="text"
              [(ngModel)]="paymentSearchQuery"
              placeholder="Search by Order ID, Payment ID, or Candidate..."
              (keyup.enter)="loadPayments(1)"
            />
          </div>

          <div class="filter-group">
            <label for="paymentStatusFilter">Transaction Status:</label>
            <select id="paymentStatusFilter" [(ngModel)]="paymentSelectedStatus" (change)="loadPayments(1)">
              <option value="">All Statuses</option>
              <option value="Successful">Successful</option>
              <option value="Initiated">Initiated</option>
              <option value="Pending">Pending</option>
              <option value="Failed">Failed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div class="filter-actions">
            <button class="btn-primary" (click)="loadPayments(1)" [disabled]="isLoading">
              {{ isLoading ? 'Loading...' : 'Apply Filter' }}
            </button>
            <button class="btn-secondary" (click)="resetPaymentFilters()" [disabled]="isLoading">
              Reset
            </button>
          </div>
        </div>

        <!-- Payments Table -->
        <div class="table-container" *ngIf="!isLoading && payments.length > 0">
          <table class="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Candidate</th>
                <th>Programme</th>
                <th>Amount</th>
                <th>Gateway</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let p of payments">
                <td>
                  <code>{{ p.orderId }}</code>
                  <div *ngIf="p.paymentId" class="sub-code">
                    <small>Pay ID: {{ p.paymentId }}</small>
                  </div>
                </td>
                <td>
                  <div class="candidate-meta">
                    <span class="name">{{ p.applicant?.fullName || 'N/A' }}</span>
                    <span class="email">{{ p.applicant?.email }}</span>
                  </div>
                </td>
                <td>
                  <span class="prog-code">{{ p.programme?.programmeCode }}</span>
                  <small class="prog-name">{{ p.programme?.programmeName }}</small>
                </td>
                <td>
                  <strong class="fee-text">₹{{ p.amount.toLocaleString() }}</strong>
                </td>
                <td>
                  <span class="gateway-tag">{{ p.gateway || 'Sandbox' }}</span>
                </td>
                <td>
                  <span class="status-pill" [ngClass]="p.status.toLowerCase()">
                    {{ p.status }}
                  </span>
                </td>
                <td>
                  <span class="date-text">{{ p.createdAt | date:'mediumDate' }}</span>
                  <small class="time-text">{{ p.createdAt | date:'shortTime' }}</small>
                </td>
                <td>
                  <div class="action-buttons">
                    <button class="btn-inspect" (click)="inspectPayment(p)">
                      Inspect
                    </button>
                    <button
                      *ngIf="p.status !== 'Successful'"
                      class="btn-reconcile"
                      (click)="openReconciliationModal(p)"
                    >
                      Reconcile
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Empty State for Payments -->
        <div class="empty-state" *ngIf="!isLoading && payments.length === 0">
          <div class="empty-icon">💳</div>
          <h4>No payment transactions found</h4>
          <p>No payment records match the current filter criteria.</p>
        </div>

        <!-- Pagination -->
        <div class="pagination-bar" *ngIf="paymentsTotalPages > 1">
          <button
            class="btn-page"
            [disabled]="paymentsPage <= 1 || isLoading"
            (click)="loadPayments(paymentsPage - 1)"
          >
            &laquo; Previous
          </button>
          <span class="page-indicator">Page {{ paymentsPage }} of {{ paymentsTotalPages }} ({{ paymentsTotal }} records)</span>
          <button
            class="btn-page"
            [disabled]="paymentsPage >= paymentsTotalPages || isLoading"
            (click)="loadPayments(paymentsPage + 1)"
          >
            Next &raquo;
          </button>
        </div>
      </div>

      <!-- INSPECT PAYMENT MODAL -->
      <div *ngIf="inspectingPayment" class="modal-overlay" (click)="closeInspectionModal()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h4>Payment Transaction Details</h4>
            <button class="modal-close-btn" (click)="closeInspectionModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="inspect-grid">
              <div class="inspect-item">
                <span class="label">Order ID:</span>
                <span class="val"><code>{{ inspectingPayment.orderId }}</code></span>
              </div>
              <div class="inspect-item">
                <span class="label">Payment ID:</span>
                <span class="val">{{ inspectingPayment.paymentId || 'Pending Gateway Return' }}</span>
              </div>
              <div class="inspect-item">
                <span class="label">Amount & Currency:</span>
                <span class="val font-bold">₹{{ inspectingPayment.amount.toLocaleString() }} {{ inspectingPayment.currency }}</span>
              </div>
              <div class="inspect-item">
                <span class="label">Status:</span>
                <span class="status-pill" [ngClass]="inspectingPayment.status.toLowerCase()">
                  {{ inspectingPayment.status }}
                </span>
              </div>
              <div class="inspect-item">
                <span class="label">Candidate:</span>
                <span class="val">{{ inspectingPayment.applicant?.fullName }} ({{ inspectingPayment.applicant?.email }})</span>
              </div>
              <div class="inspect-item">
                <span class="label">Programme:</span>
                <span class="val">{{ inspectingPayment.programme?.programmeName }} ({{ inspectingPayment.programme?.programmeCode }})</span>
              </div>
              <div class="inspect-item" *ngIf="inspectingPayment.failureReason">
                <span class="label">Failure Reason:</span>
                <span class="val text-danger">{{ inspectingPayment.failureReason }}</span>
              </div>
            </div>

            <!-- Fee Snapshot -->
            <div class="fee-snapshot-box" *ngIf="inspectingPayment.feeSnapshot">
              <h5>Fee Snapshot (Recorded at Order Initiation)</h5>
              <div class="snapshot-row">
                <span>Admission Fee:</span>
                <strong>₹{{ (inspectingPayment.feeSnapshot.admissionFee ?? inspectingPayment.amount).toLocaleString() }}</strong>
              </div>
              <div class="snapshot-row" *ngIf="inspectingPayment.feeSnapshot.totalProgrammeFee">
                <span>Total Programme Fee:</span>
                <span>₹{{ inspectingPayment.feeSnapshot.totalProgrammeFee.toLocaleString() }}</span>
              </div>
            </div>

            <!-- Audit Trail -->
            <div class="audit-trail-section" *ngIf="inspectingPayment.auditHistory?.length">
              <h5>Audit Timeline & State Transitions</h5>
              <div class="timeline">
                <div *ngFor="let audit of inspectingPayment.auditHistory" class="timeline-item">
                  <div class="timeline-dot"></div>
                  <div class="timeline-content">
                    <div class="timeline-meta">
                      <strong>{{ audit.action }}</strong>
                      <span class="date">{{ audit.timestamp | date:'medium' }}</span>
                    </div>
                    <p class="details">{{ audit.details || audit.remarks }}</p>
                    <small *ngIf="audit.source" class="source">Source: {{ audit.source }}</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="closeInspectionModal()">Close</button>
            <button
              *ngIf="inspectingPayment.status !== 'Successful'"
              class="btn-primary"
              (click)="openReconciliationModal(inspectingPayment)"
            >
              Reconcile Status
            </button>
          </div>
        </div>
      </div>

      <!-- RECONCILIATION MODAL -->
      <div *ngIf="reconcilingPayment" class="modal-overlay" (click)="closeReconciliationModal()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h4>Manual Transaction Reconciliation</h4>
            <button class="modal-close-btn" (click)="closeReconciliationModal()">&times;</button>
          </div>
          <div class="modal-body">
            <p class="reconcile-desc">
              Override transaction status for Order <code>{{ reconcilingPayment.orderId }}</code>.
              Permanent Enrolment will be triggered atomically if status is marked as <strong>MarkSuccessful</strong>.
            </p>

            <div class="form-group">
              <label for="reconAction">Reconciliation Action:</label>
              <select id="reconAction" [(ngModel)]="reconciliationAction">
                <option value="MarkSuccessful">Mark Successful (Confirm Admission & Generate Enrolment)</option>
                <option value="MarkFailed">Mark Failed</option>
                <option value="Cancel">Cancel Transaction</option>
              </select>
            </div>

            <div class="form-group">
              <label for="reconRemarks">
                Mandatory Administrative Remarks:
                <span class="required">*</span>
              </label>
              <textarea
                id="reconRemarks"
                [(ngModel)]="reconciliationRemarks"
                rows="3"
                placeholder="Specify justification, bank reference number, or transaction audit logs..."
              ></textarea>
              <small class="field-hint" *ngIf="!reconciliationRemarks.trim()">
                Remarks are strictly mandatory for compliance and audit logs.
              </small>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="closeReconciliationModal()" [disabled]="isReconciling">
              Cancel
            </button>
            <button
              class="btn-danger-confirm"
              [disabled]="!reconciliationRemarks.trim() || isReconciling"
              (click)="submitReconciliation()"
            >
              {{ isReconciling ? 'Processing...' : 'Confirm Reconciliation' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-enrolment-root {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      color: #1e293b;
    }

    .enrolment-header {
      background: #ffffff;
      padding: 1.5rem 2rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      border-left: 5px solid #002b49;
    }

    .header-content h3 {
      margin: 0 0 0.4rem 0;
      color: #002b49;
      font-size: 1.4rem;
      font-weight: 700;
    }

    .header-content p {
      margin: 0;
      color: #64748b;
      font-size: 0.95rem;
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
    }

    .kpi-card {
      background: #ffffff;
      padding: 1.25rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      display: flex;
      align-items: center;
      gap: 1rem;
      border-top: 3px solid #cbd5e1;
    }

    .kpi-card.kpi-enrolled { border-top-color: #0284c7; }
    .kpi-card.kpi-collection { border-top-color: #16a34a; }
    .kpi-card.kpi-pending { border-top-color: #eab308; }
    .kpi-card.kpi-failed { border-top-color: #dc2626; }

    .kpi-icon {
      font-size: 2rem;
      width: 50px;
      height: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
      border-radius: 50%;
    }

    .kpi-body {
      display: flex;
      flex-direction: column;
    }

    .kpi-label {
      font-size: 0.8rem;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .kpi-value {
      font-size: 1.5rem;
      font-weight: 800;
      color: #002b49;
    }

    /* Navigation Tabs */
    .nav-tabs {
      display: flex;
      gap: 0.5rem;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 0.25rem;
    }

    .tab-btn {
      padding: 0.75rem 1.5rem;
      border: none;
      background: transparent;
      font-size: 0.95rem;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      border-bottom: 3px solid transparent;
      transition: all 0.2s;
    }

    .tab-btn:hover {
      color: #002b49;
    }

    .tab-btn.active {
      color: #002b49;
      border-bottom-color: #002b49;
      font-weight: 700;
    }

    /* Filter Bar */
    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: flex-end;
      background: #ffffff;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .filter-group.search-input {
      flex: 1;
      min-width: 250px;
    }

    .filter-group label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #475569;
    }

    .filter-group input,
    .filter-group select {
      padding: 0.55rem 0.85rem;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 0.9rem;
      color: #1e293b;
      outline: none;
    }

    .filter-group input:focus,
    .filter-group select:focus {
      border-color: #002b49;
      box-shadow: 0 0 0 2px rgba(0, 43, 73, 0.1);
    }

    .filter-actions {
      display: flex;
      gap: 0.5rem;
    }

    /* Buttons */
    .btn-primary {
      background: #002b49;
      color: #ffffff;
      padding: 0.55rem 1.25rem;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-primary:hover:not(:disabled) {
      background: #00406c;
    }

    .btn-secondary {
      background: #f1f5f9;
      color: #475569;
      padding: 0.55rem 1.25rem;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #e2e8f0;
    }

    .btn-inspect {
      background: #e0f2fe;
      color: #0284c7;
      padding: 0.3rem 0.75rem;
      border: none;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-inspect:hover {
      background: #bae6fd;
    }

    .btn-reconcile {
      background: #fef3c7;
      color: #d97706;
      padding: 0.3rem 0.75rem;
      border: none;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-reconcile:hover {
      background: #fde68a;
    }

    .btn-danger-confirm {
      background: #dc2626;
      color: #ffffff;
      padding: 0.6rem 1.25rem;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-danger-confirm:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Table */
    .table-container {
      background: #ffffff;
      border-radius: 8px;
      overflow-x: auto;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    .data-table th {
      background: #f8fafc;
      padding: 0.85rem 1rem;
      font-size: 0.8rem;
      font-weight: 700;
      color: #475569;
      border-bottom: 2px solid #e2e8f0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .data-table td {
      padding: 0.9rem 1rem;
      font-size: 0.88rem;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }

    .data-table tbody tr:hover {
      background: #f8fafc;
    }

    /* Badges & Pills */
    .enrolment-badge {
      display: inline-block;
      font-family: monospace;
      font-size: 0.88rem;
      font-weight: 700;
      background: #ecfdf5;
      color: #047857;
      padding: 0.25rem 0.6rem;
      border-radius: 4px;
      border: 1px solid #a7f3d0;
    }

    .category-pill {
      background: #f1f5f9;
      color: #334155;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.2rem 0.55rem;
      border-radius: 12px;
    }

    .seat-badge {
      background: #e0e7ff;
      color: #4338ca;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
    }

    .status-pill {
      display: inline-block;
      padding: 0.25rem 0.65rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
    }

    .status-pill.successful { background: #dcfce7; color: #15803d; }
    .status-pill.initiated { background: #e0f2fe; color: #0369a1; }
    .status-pill.pending { background: #fef9c3; color: #a16207; }
    .status-pill.failed { background: #fee2e2; color: #b91c1c; }
    .status-pill.cancelled { background: #f1f5f9; color: #64748b; }

    .gateway-tag {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      color: #475569;
      font-size: 0.75rem;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      text-transform: uppercase;
      font-weight: 600;
    }

    .candidate-meta {
      display: flex;
      flex-direction: column;
    }

    .candidate-meta .name { font-weight: 600; color: #1e293b; }
    .candidate-meta .email { font-size: 0.78rem; color: #64748b; }

    .prog-code { font-weight: 600; color: #002b49; }
    .prog-name { display: block; font-size: 0.78rem; color: #64748b; }

    .fee-text { color: #0f172a; font-size: 0.92rem; }
    .date-text { display: block; font-weight: 500; color: #334155; }
    .time-text { font-size: 0.75rem; color: #94a3b8; }

    .action-buttons {
      display: flex;
      gap: 0.4rem;
    }

    /* Empty state */
    .empty-state {
      background: #ffffff;
      padding: 3rem 2rem;
      text-align: center;
      border-radius: 8px;
    }

    .empty-icon { font-size: 3rem; margin-bottom: 0.75rem; }
    .empty-state h4 { margin: 0 0 0.3rem 0; color: #334155; }
    .empty-state p { margin: 0; color: #94a3b8; font-size: 0.9rem; }

    /* Pagination */
    .pagination-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #ffffff;
      padding: 0.85rem 1.5rem;
      border-radius: 8px;
    }

    .btn-page {
      padding: 0.4rem 0.9rem;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-page:disabled { opacity: 0.4; cursor: not-allowed; }

    .page-indicator {
      font-size: 0.85rem;
      color: #64748b;
    }

    /* Modals */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 1rem;
    }

    .modal-card {
      background: #ffffff;
      width: 100%;
      max-width: 650px;
      max-height: 90vh;
      overflow-y: auto;
      border-radius: 8px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
      display: flex;
      flex-direction: column;
    }

    .modal-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .modal-header h4 {
      margin: 0;
      color: #002b49;
      font-size: 1.2rem;
      font-weight: 700;
    }

    .modal-close-btn {
      background: transparent;
      border: none;
      font-size: 1.5rem;
      line-height: 1;
      color: #94a3b8;
      cursor: pointer;
    }

    .modal-body {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .modal-footer {
      padding: 1rem 1.5rem;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      background: #f8fafc;
    }

    .inspect-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .inspect-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .inspect-item .label {
      font-size: 0.75rem;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
    }

    .inspect-item .val {
      font-size: 0.9rem;
      color: #1e293b;
    }

    .fee-snapshot-box {
      background: #f8fafc;
      padding: 1rem;
      border-radius: 6px;
      border-left: 4px solid #0284c7;
    }

    .fee-snapshot-box h5 {
      margin: 0 0 0.5rem 0;
      color: #0f172a;
      font-size: 0.9rem;
    }

    .snapshot-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.88rem;
      padding: 0.25rem 0;
    }

    /* Timeline */
    .audit-trail-section h5 {
      margin: 0 0 0.75rem 0;
      color: #0f172a;
      font-size: 0.9rem;
    }

    .timeline {
      position: relative;
      padding-left: 1.5rem;
      border-left: 2px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .timeline-item {
      position: relative;
    }

    .timeline-dot {
      position: absolute;
      left: -1.85rem;
      top: 0.25rem;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #0284c7;
      border: 2px solid #ffffff;
      box-shadow: 0 0 0 2px #bae6fd;
    }

    .timeline-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.82rem;
      margin-bottom: 0.2rem;
    }

    .timeline-content .details {
      margin: 0;
      font-size: 0.85rem;
      color: #475569;
    }

    .timeline-content .source {
      font-size: 0.75rem;
      color: #94a3b8;
    }

    /* Form in Modal */
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .form-group label {
      font-size: 0.85rem;
      font-weight: 600;
      color: #334155;
    }

    .form-group select,
    .form-group textarea {
      padding: 0.6rem 0.85rem;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 0.9rem;
      outline: none;
    }

    .field-hint {
      color: #ef4444;
      font-size: 0.78rem;
    }

    .required { color: #dc2626; }
    .font-bold { font-weight: 700; }
    .text-danger { color: #dc2626; }

    /* Alert Box */
    .alert-box {
      padding: 0.85rem 1.25rem;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.9rem;
      font-weight: 500;
    }

    .alert-box.success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .alert-box.error { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }

    .close-alert {
      background: transparent;
      border: none;
      font-size: 1.25rem;
      color: inherit;
      cursor: pointer;
    }
  `]
})
export class AdminEnrolmentComponent implements OnInit {
  private paymentService = inject(PaymentService);
  private adminService = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);

  activeTab: 'enrolments' | 'payments' = 'enrolments';
  isLoading = false;
  message = '';
  messageType: 'success' | 'error' = 'success';

  // Master Data
  programmes: Programme[] = [];
  sessions: AcademicSession[] = [];
  statistics: PaymentStatistics | null = null;

  // Enrolments Tab State
  enrolments: Enrolment[] = [];
  enrolmentSearchQuery = '';
  enrolmentSelectedProgramme = '';
  enrolmentsPage = 1;
  enrolmentsTotal = 0;
  enrolmentsTotalPages = 1;

  // Payments Tab State
  payments: Payment[] = [];
  paymentSearchQuery = '';
  paymentSelectedStatus = '';
  paymentsPage = 1;
  paymentsTotal = 0;
  paymentsTotalPages = 1;

  // Inspection Modal State
  inspectingPayment: Payment | null = null;

  // Reconciliation Modal State
  reconcilingPayment: Payment | null = null;
  reconciliationAction = 'MarkSuccessful';
  reconciliationRemarks = '';
  isReconciling = false;

  ngOnInit(): void {
    this.loadMasterData();
    this.loadStatistics();
    this.loadEnrolments(1);
    this.loadPayments(1);
  }

  switchTab(tab: 'enrolments' | 'payments'): void {
    this.activeTab = tab;
  }

  loadMasterData(): void {
    this.adminService.getProgrammes().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.programmes = (res.data as any).programmes || (res.data as any) || [];
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });

    this.adminService.getSessions().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.sessions = res.data;
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });
  }

  loadStatistics(): void {
    this.paymentService.getStatistics().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.statistics = res.data;
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });
  }

  loadEnrolments(page: number = 1): void {
    this.isLoading = true;
    this.enrolmentsPage = page;

    this.paymentService
      .getAllEnrolments({
        page,
        limit: 10,
        search: this.enrolmentSearchQuery || undefined,
        programmeId: this.enrolmentSelectedProgramme || undefined
      })
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.success && res.data) {
            this.enrolments = res.data.enrolments || [];
            this.enrolmentsTotal = res.data.total || 0;
            this.enrolmentsTotalPages = res.data.totalPages || 1;
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isLoading = false;
          this.showMessage(err.error?.message || 'Failed to load enrolment records.', 'error');
          this.cdr.markForCheck();
        }
      });
  }

  resetEnrolmentFilters(): void {
    this.enrolmentSearchQuery = '';
    this.enrolmentSelectedProgramme = '';
    this.loadEnrolments(1);
  }

  loadPayments(page: number = 1): void {
    this.isLoading = true;
    this.paymentsPage = page;

    this.paymentService
      .getAllPayments({
        page,
        limit: 10,
        search: this.paymentSearchQuery || undefined,
        status: this.paymentSelectedStatus || undefined
      })
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.success && res.data) {
            this.payments = res.data.payments || [];
            this.paymentsTotal = res.data.total || 0;
            this.paymentsTotalPages = res.data.totalPages || 1;
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isLoading = false;
          this.showMessage(err.error?.message || 'Failed to load payment transactions.', 'error');
          this.cdr.markForCheck();
        }
      });
  }

  resetPaymentFilters(): void {
    this.paymentSearchQuery = '';
    this.paymentSelectedStatus = '';
    this.loadPayments(1);
  }

  inspectPayment(p: Payment): void {
    this.paymentService.getPaymentById(p._id).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.inspectingPayment = res.data;
        } else {
          this.inspectingPayment = p;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.inspectingPayment = p;
        this.cdr.markForCheck();
      }
    });
  }

  closeInspectionModal(): void {
    this.inspectingPayment = null;
  }

  openReconciliationModal(p: Payment): void {
    this.closeInspectionModal();
    this.reconcilingPayment = p;
    this.reconciliationAction = 'MarkSuccessful';
    this.reconciliationRemarks = '';
  }

  closeReconciliationModal(): void {
    this.reconcilingPayment = null;
    this.reconciliationRemarks = '';
    this.isReconciling = false;
  }

  submitReconciliation(): void {
    if (!this.reconcilingPayment || !this.reconciliationRemarks.trim()) {
      return;
    }

    this.isReconciling = true;
    this.paymentService
      .reconcilePayment(
        this.reconcilingPayment._id,
        this.reconciliationAction,
        this.reconciliationRemarks.trim()
      )
      .subscribe({
        next: (res) => {
          this.isReconciling = false;
          this.closeReconciliationModal();
          this.showMessage('Payment successfully reconciled and updated.', 'success');
          this.loadStatistics();
          this.loadPayments(this.paymentsPage);
          this.loadEnrolments(1);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isReconciling = false;
          this.showMessage(err.error?.message || 'Payment reconciliation failed.', 'error');
          this.cdr.markForCheck();
        }
      });
  }

  showMessage(msg: string, type: 'success' | 'error'): void {
    this.message = msg;
    this.messageType = type;
  }
}
