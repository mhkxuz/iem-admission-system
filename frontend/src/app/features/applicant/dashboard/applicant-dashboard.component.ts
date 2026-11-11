import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ApplicationService } from '../../../core/services/application.service';
import { DocumentService } from '../../../core/services/document.service';
import { MeritService } from '../../../core/services/merit.service';
import { PaymentService } from '../../../core/services/payment.service';
import { AdmissionApplication } from '../../../core/models/application.model';
import { UploadedDocument } from '../../../core/models/document.model';
import { ApplicantMeritResult } from '../../../core/models/merit.model';
import { User } from '../../../core/models/user.model';

@Component({
  selector: 'app-applicant-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="dashboard-container">
      <!-- Welcome Banner -->
      <div class="welcome-card">
        <div class="welcome-info">
          <h2>Welcome, {{ currentUser?.fullName }}</h2>
          <p class="applicant-meta">
            <span>Email: <strong>{{ currentUser?.email }}</strong></span>
            <span *ngIf="currentUser?.phone">Phone: <strong>{{ currentUser?.phone }}</strong></span>
            <span>Role: <strong class="badge-applicant">Applicant</strong></span>
          </p>
        </div>
        <div class="quick-status" *ngIf="application">
          <span class="status-label">Current Status:</span>
          <span class="status-badge" [ngClass]="application.status?.toLowerCase()?.replace(' ', '-')">
            {{ application.status }}
          </span>
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="isLoading" class="state-card loading">
        <div class="spinner"></div>
        <p>Loading application data...</p>
      </div>

      <!-- Error State -->
      <div *ngIf="errorMessage && !isLoading" class="alert-box error">
        <span>{{ errorMessage }}</span>
        <button type="button" class="btn-retry-inline" (click)="fetchApplication()">
          Retry
        </button>
      </div>

      <!-- Content State -->
      <div *ngIf="!isLoading">
        <!-- Application Found -->
        <div *ngIf="application; else emptyState">
          <!-- Published Merit & Seat Allocation Result Card -->
          <div class="merit-result-card" *ngIf="meritResult?.hasPublishedResult">
            <div class="merit-result-header">
              <div class="header-main">
                <span class="merit-tag">&#127891; Official Admission Merit & Allocation Outcome</span>
                <h3>{{ meritResult?.programme?.programmeName }} ({{ meritResult?.academicSession }})</h3>
              </div>
              <div class="status-wrap">
                <a routerLink="/applicant/merit-list" class="btn-view-merit-list-link">
                  &#128220; View Full Merit List
                </a>
                <span
                  class="alloc-status-pill"
                  [ngClass]="meritResult?.allocationStatus?.toLowerCase()?.replace(' ', '-')"
                >
                  {{ meritResult?.allocationStatus }}
                </span>
              </div>
            </div>

            <div class="merit-result-grid">
              <div class="merit-kpi">
                <span class="kpi-title">Overall Merit Rank</span>
                <span class="kpi-num" *ngIf="meritResult?.meritRank && meritResult!.meritRank! > 0">
                  #{{ meritResult?.meritRank }}
                </span>
                <span class="kpi-num muted" *ngIf="!meritResult?.meritRank || meritResult?.meritRank === 0">—</span>
              </div>

              <div class="merit-kpi">
                <span class="kpi-title">Category Rank ({{ meritResult?.category }})</span>
                <span class="kpi-num" *ngIf="meritResult?.categoryRank && meritResult!.categoryRank! > 0">
                  #{{ meritResult?.categoryRank }}
                </span>
                <span class="kpi-num muted" *ngIf="!meritResult?.categoryRank || meritResult?.categoryRank === 0">—</span>
              </div>

              <div class="merit-kpi">
                <span class="kpi-title">Composite Merit Score</span>
                <span class="kpi-num highlight">{{ meritResult?.compositeScore | number: '1.2-2' }}</span>
              </div>

              <div class="merit-kpi" *ngIf="meritResult?.allocatedCategory">
                <span class="kpi-title">Allocated Category</span>
                <span class="kpi-num">{{ meritResult?.allocatedCategory }}</span>
              </div>

              <div class="merit-kpi" *ngIf="meritResult?.seatNumber">
                <span class="kpi-title">Allocated Seat Number</span>
                <span class="kpi-num">Seat #{{ meritResult?.seatNumber }}</span>
              </div>
            </div>

            <!-- Allocation Notice -->
            <div class="allocation-reason-box" *ngIf="meritResult?.allocationReason">
              <strong>Allocation Notice:</strong> {{ meritResult?.allocationReason }}
            </div>

            <!-- Cutoff Reference Summary -->
            <div class="cutoffs-summary-box" *ngIf="meritResult?.cutoffs">
              <h5>Programme Cutoff Reference</h5>
              <div class="cutoffs-subgrid">
                <div>
                  <span>Programme Highest:</span>
                  <strong>{{ meritResult?.cutoffs?.highestScore | number: '1.2-2' }}</strong>
                </div>
                <div>
                  <span>Lowest Shortlisted Score:</span>
                  <strong>{{ meritResult?.cutoffs?.lowestShortlistedScore | number: '1.2-2' }}</strong>
                </div>
                <div *ngIf="meritResult?.cutoffs?.categoryLowest">
                  <span>{{ meritResult?.category }} Category Cutoff:</span>
                  <strong>{{ meritResult?.cutoffs?.categoryLowest | number: '1.2-2' }}</strong>
                </div>
              </div>
            </div>
          </div>

          <!-- Flash Messages for Payment / Confirmation -->
          <div *ngIf="paymentSuccessMessage" class="alert-box success">
            <span>{{ paymentSuccessMessage }}</span>
            <button type="button" class="btn-retry-inline" (click)="paymentSuccessMessage = ''">&times;</button>
          </div>

          <div *ngIf="paymentErrorMessage" class="alert-box error">
            <span>{{ paymentErrorMessage }}</span>
            <button type="button" class="btn-retry-inline" (click)="paymentErrorMessage = ''">&times;</button>
          </div>

          <!-- CONFIRMED ADMISSION & PERMANENT ENROLMENT CARD -->
          <div class="confirmed-enrolment-card" *ngIf="admissionReceipt?.hasConfirmedAdmission">
            <div class="enrolment-banner">
              <div class="banner-badge">&#127891; Official Admission Confirmed</div>
              <h2 class="congrats-text">Congratulations, {{ currentUser?.fullName }}!</h2>
              <p class="congrats-sub">Your admission to Institute of Engineering & Management (IEM) has been officially confirmed and your permanent student enrolment has been issued.</p>
            </div>

            <div class="enrolment-details-grid">
              <div class="enrol-stat-card primary">
                <span class="stat-label">Permanent Enrolment Number</span>
                <span class="stat-number highlight">{{ admissionReceipt.enrolmentNumber }}</span>
                <span class="stat-sub">Official IEM Student Enrolment Identifier</span>
              </div>

              <div class="enrol-stat-card">
                <span class="stat-label">Allocated Programme</span>
                <span class="stat-title">{{ admissionReceipt.programme?.programmeName }}</span>
                <span class="stat-sub">{{ admissionReceipt.programme?.degree }} &bull; {{ admissionReceipt.programme?.department }}</span>
              </div>

              <div class="enrol-stat-card">
                <span class="stat-label">Academic Session & Seat</span>
                <span class="stat-title">Session: {{ admissionReceipt.academicSession }}</span>
                <span class="stat-sub">Category: <strong>{{ admissionReceipt.allocatedCategory }}</strong> &bull; Seat: <strong>#{{ admissionReceipt.seatNumber || 'N/A' }}</strong></span>
              </div>

              <div class="enrol-stat-card">
                <span class="stat-label">Fee Transaction</span>
                <span class="stat-title">₹{{ (admissionReceipt.feeAmountPaid || 0).toLocaleString() }} Paid</span>
                <span class="stat-sub">Ref: <code>{{ admissionReceipt.paymentReference || admissionReceipt.payment?.orderId }}</code></span>
              </div>
            </div>

            <div class="enrolment-actions">
              <button type="button" class="btn-print-receipt" (click)="printAdmissionReceipt()">
                &#128438; Print Admission Confirmation Receipt
              </button>
            </div>
          </div>

          <!-- ADMISSION CONFIRMATION & FEE PAYMENT OFFER CARD -->
          <div
            class="admission-offer-card"
            *ngIf="!admissionReceipt?.hasConfirmedAdmission && admissionEligibility?.isEligible"
          >
            <div class="offer-header">
              <div class="offer-title-wrap">
                <span class="offer-badge">&#9989; Provisional Seat Allocated</span>
                <h3>Confirm Your Admission to {{ admissionEligibility.programme?.programmeName }}</h3>
                <p>A seat has been allocated to you in the official merit round. Complete your admission confirmation by paying the admission fee before the deadline.</p>
              </div>
              <div class="offer-seat-tag">
                <span class="seat-label">Allocated Seat</span>
                <span class="seat-val">#{{ admissionEligibility.allocation?.seatNumber }} ({{ admissionEligibility.allocation?.allocatedCategory }})</span>
              </div>
            </div>

            <div class="offer-fee-summary">
              <div class="fee-row">
                <span>Admission Confirmation Fee:</span>
                <strong class="fee-amt">₹{{ (admissionEligibility.feeStructure?.admissionFee || 0).toLocaleString() }}</strong>
              </div>
              <div class="fee-row" *ngIf="admissionEligibility.feeStructure?.totalProgrammeFee">
                <span>Total Programme Course Fee:</span>
                <span>₹{{ admissionEligibility.feeStructure.totalProgrammeFee.toLocaleString() }}</span>
              </div>
              <p class="fee-instructions" *ngIf="admissionEligibility.feeStructure?.paymentInstructions">
                {{ admissionEligibility.feeStructure.paymentInstructions }}
              </p>
            </div>

            <div class="offer-actions">
              <button
                type="button"
                class="btn-confirm-admission"
                [disabled]="isInitiatingPayment"
                (click)="initiateAdmissionPayment()"
              >
                {{ isInitiatingPayment ? 'Initiating Gateway...' : '💳 Confirm Admission & Pay Fee' }}
              </button>
            </div>
          </div>

          <!-- DOCUMENT VERIFICATION / INELIGIBILITY NOTICE -->
          <div
            class="verification-pending-card"
            *ngIf="!admissionReceipt?.hasConfirmedAdmission && !admissionEligibility?.isEligible && admissionEligibility?.reason"
          >
            <div class="notice-icon">&#8505;</div>
            <div class="notice-content">
              <h4>Admission Confirmation Notice</h4>
              <p>{{ admissionEligibility.reason }}</p>
            </div>
          </div>

          <!-- PENDING SEAT ALLOCATION NOTICE (Selected without published seat) -->
          <div
            class="admission-pending-allocation-card"
            *ngIf="application.status === 'Selected' && !admissionReceipt?.hasConfirmedAdmission && !admissionEligibility?.isEligible && !admissionEligibility?.reason"
          >
            <div class="pending-icon">&#9203;</div>
            <div class="pending-body">
              <h4>Seat Allocation in Progress</h4>
              <p>
                Congratulations! Your application has been selected for admission consideration for
                <strong>{{ application.selectedProgramme?.programmeName || 'your selected programme' }}</strong>.
                The admission committee is currently finalizing category-wise merit allocations. Your provisional seat allocation and fee payment offer will appear here as soon as allocations are published.
              </p>
            </div>
          </div>

          <!-- PAYMENT GATEWAY CHECKOUT MODAL -->
          <div *ngIf="showCheckoutModal" class="modal-backdrop" (click)="closeCheckoutModal()">
            <div class="modal-box checkout-modal" (click)="$event.stopPropagation()">
              <div class="modal-header">
                <div class="modal-logo-title">
                  <span class="iem-seal">&#127891;</span>
                  <div>
                    <h4>IEM Admission Fee Gateway</h4>
                    <small>Secure Payment Checkout</small>
                  </div>
                </div>
                <button type="button" class="btn-close-modal" (click)="closeCheckoutModal()">&times;</button>
              </div>

              <div class="modal-body">
                <div class="checkout-summary-card">
                  <div class="summary-line">
                    <span class="label">Candidate:</span>
                    <span class="val"><strong>{{ currentUser?.fullName }}</strong></span>
                  </div>
                  <div class="summary-line">
                    <span class="label">Application ID:</span>
                    <span class="val"><code>{{ application.applicationId }}</code></span>
                  </div>
                  <div class="summary-line">
                    <span class="label">Programme:</span>
                    <span class="val">{{ activePaymentOrder?.programmeName || admissionEligibility?.programme?.programmeName }}</span>
                  </div>
                  <div class="summary-line">
                    <span class="label">Order Reference:</span>
                    <span class="val"><code>{{ activePaymentOrder?.orderId }}</code></span>
                  </div>
                  <div class="summary-divider"></div>
                  <div class="summary-line total-line">
                    <span class="label">Amount Payable:</span>
                    <span class="val total-amt">₹{{ (activePaymentOrder?.amount || admissionEligibility?.feeStructure?.admissionFee || 0).toLocaleString() }}</span>
                  </div>
                </div>

                <!-- Sandbox Mode Notice & Testing Triggers -->
                <div class="sandbox-box" *ngIf="activePaymentOrder?.isSandbox !== false">
                  <div class="sandbox-badge">&#128736; Gateway Test / Sandbox Environment Active</div>
                  <p class="sandbox-desc">
                    In development/sandbox mode, transactions use cryptographic digital signature verification without requiring live bank deductions.
                  </p>

                  <div class="simulation-actions">
                    <button
                      type="button"
                      class="btn-sim-success"
                      [disabled]="isCompletingPayment"
                      (click)="simulateSuccessfulPayment()"
                    >
                      {{ isCompletingPayment ? 'Verifying Transaction...' : '&#10004; Simulate Successful Payment' }}
                    </button>
                    <button
                      type="button"
                      class="btn-sim-fail"
                      [disabled]="isCompletingPayment"
                      (click)="simulateFailedPayment()"
                    >
                      &#10008; Simulate Failed Payment
                    </button>
                    <button
                      type="button"
                      class="btn-sim-cancel"
                      [disabled]="isCompletingPayment"
                      (click)="simulateCancelledPayment()"
                    >
                      &#9940; Simulate Cancelled Payment
                    </button>
                  </div>
                </div>
              </div>

              <div class="modal-footer">
                <button type="button" class="btn-cancel" (click)="closeCheckoutModal()" [disabled]="isCompletingPayment">
                  Cancel Checkout
                </button>
              </div>
            </div>
          </div>

          <!-- Summary Card -->
          <div class="app-card">
            <div class="app-card-header">
              <div>
                <span class="app-id-label">Application ID</span>
                <h3 class="app-id">{{ application.applicationId }}</h3>
              </div>
              <div class="header-actions">
                <span class="session-pill">Session: {{ application.academicSession }}</span>
              </div>
            </div>

            <div class="app-summary-grid">
              <div class="summary-item" *ngIf="application.selectedProgramme">
                <span class="item-label">Selected Programme</span>
                <span class="item-value highlight">
                  {{ application.selectedProgramme.programmeName || application.selectedProgramme }}
                  <small *ngIf="application.selectedProgramme.programmeCode">({{ application.selectedProgramme.programmeCode }})</small>
                </span>
              </div>

              <div class="summary-item">
                <span class="item-label">Preferred Department</span>
                <span class="item-value highlight">{{ application.admissionInfo?.preferredDepartment }}</span>
              </div>

              <div class="summary-item">
                <span class="item-label">Admission Category</span>
                <span class="item-value">{{ application.admissionInfo?.admissionCategory }}</span>
              </div>

              <div class="summary-item">
                <span class="item-label">Submission Date</span>
                <span class="item-value">{{ application.submittedAt | date:'mediumDate' }}</span>
              </div>

              <div class="summary-item">
                <span class="item-label">Entrance Exam</span>
                <span class="item-value">{{ application.academicInfo?.entranceExamName }} ({{ application.academicInfo?.entranceExamScore }})</span>
              </div>
            </div>

            <!-- 9-Step Admission Progress Tracker -->
            <div class="admission-journey-tracker">
              <div class="tracker-header">
                <h4>Admission Journey &amp; Lifecycle Progress</h4>
                <span class="tracker-session">Session: {{ application.academicSession }}</span>
              </div>

              <div class="journey-steps-grid">
                <!-- Step 1: Application Submitted -->
                <div class="journey-step" [ngClass]="getStepClass(1)">
                  <div class="step-icon-wrap">
                    <span *ngIf="getStepClass(1) === 'completed'">&#10004;</span>
                    <span *ngIf="getStepClass(1) !== 'completed'">1</span>
                  </div>
                  <div class="step-text">
                    <span class="step-title">1. Submitted</span>
                    <small class="step-date">{{ application.submittedAt | date:'shortDate' }}</small>
                  </div>
                </div>

                <!-- Step 2: Under Review -->
                <div class="journey-step" [ngClass]="getStepClass(2)">
                  <div class="step-icon-wrap">
                    <span *ngIf="getStepClass(2) === 'completed'">&#10004;</span>
                    <span *ngIf="getStepClass(2) === 'current'">&#8987;</span>
                    <span *ngIf="getStepClass(2) === 'rejected'">&#10008;</span>
                    <span *ngIf="getStepClass(2) === 'pending'">2</span>
                  </div>
                  <div class="step-text">
                    <span class="step-title">2. Under Review</span>
                    <small class="step-state">{{ getStepStateLabel(2) }}</small>
                  </div>
                </div>

                <!-- Step 3: Documents Verified -->
                <div class="journey-step" [ngClass]="getStepClass(3)">
                  <div class="step-icon-wrap">
                    <span *ngIf="getStepClass(3) === 'completed'">&#10004;</span>
                    <span *ngIf="getStepClass(3) === 'current'">&#8987;</span>
                    <span *ngIf="getStepClass(3) === 'rejected'">&#10008;</span>
                    <span *ngIf="getStepClass(3) === 'pending'">3</span>
                  </div>
                  <div class="step-text">
                    <span class="step-title">3. Documents</span>
                    <small class="step-state">{{ getStepStateLabel(3) }}</small>
                  </div>
                </div>

                <!-- Step 4: Merit & Seat Allocation Published -->
                <div class="journey-step" [ngClass]="getStepClass(4)">
                  <div class="step-icon-wrap">
                    <span *ngIf="getStepClass(4) === 'completed'">&#10004;</span>
                    <span *ngIf="getStepClass(4) === 'current'">&#8987;</span>
                    <span *ngIf="getStepClass(4) === 'rejected'">&#10008;</span>
                    <span *ngIf="getStepClass(4) === 'pending'">4</span>
                  </div>
                  <div class="step-text">
                    <span class="step-title">4. Merit List</span>
                    <small class="step-state">{{ getStepStateLabel(4) }}</small>
                  </div>
                </div>

                <!-- Step 5: Admission Offer Received -->
                <div class="journey-step" [ngClass]="getStepClass(5)">
                  <div class="step-icon-wrap">
                    <span *ngIf="getStepClass(5) === 'completed'">&#10004;</span>
                    <span *ngIf="getStepClass(5) === 'current'">&#8987;</span>
                    <span *ngIf="getStepClass(5) === 'rejected'">&#10008;</span>
                    <span *ngIf="getStepClass(5) === 'pending'">5</span>
                  </div>
                  <div class="step-text">
                    <span class="step-title">5. Offer Received</span>
                    <small class="step-state">{{ getStepStateLabel(5) }}</small>
                  </div>
                </div>

                <!-- Step 6: Confirmation Fee Payment -->
                <div class="journey-step" [ngClass]="getStepClass(6)">
                  <div class="step-icon-wrap">
                    <span *ngIf="getStepClass(6) === 'completed'">&#10004;</span>
                    <span *ngIf="getStepClass(6) === 'current'">&#8987;</span>
                    <span *ngIf="getStepClass(6) === 'rejected'">&#10008;</span>
                    <span *ngIf="getStepClass(6) === 'pending'">6</span>
                  </div>
                  <div class="step-text">
                    <span class="step-title">6. Fee Payment</span>
                    <small class="step-state">{{ getStepStateLabel(6) }}</small>
                  </div>
                </div>

                <!-- Step 7: Payment Verified -->
                <div class="journey-step" [ngClass]="getStepClass(7)">
                  <div class="step-icon-wrap">
                    <span *ngIf="getStepClass(7) === 'completed'">&#10004;</span>
                    <span *ngIf="getStepClass(7) === 'current'">&#8987;</span>
                    <span *ngIf="getStepClass(7) === 'pending'">7</span>
                  </div>
                  <div class="step-text">
                    <span class="step-title">7. Verified</span>
                    <small class="step-state">{{ getStepStateLabel(7) }}</small>
                  </div>
                </div>

                <!-- Step 8: Final Admission Confirmed -->
                <div class="journey-step" [ngClass]="getStepClass(8)">
                  <div class="step-icon-wrap">
                    <span *ngIf="getStepClass(8) === 'completed'">&#10004;</span>
                    <span *ngIf="getStepClass(8) === 'current'">&#8987;</span>
                    <span *ngIf="getStepClass(8) === 'pending'">8</span>
                  </div>
                  <div class="step-text">
                    <span class="step-title">8. Confirmed</span>
                    <small class="step-state">{{ getStepStateLabel(8) }}</small>
                  </div>
                </div>

                <!-- Step 9: Permanent Enrolment Number -->
                <div class="journey-step" [ngClass]="getStepClass(9)">
                  <div class="step-icon-wrap">
                    <span *ngIf="getStepClass(9) === 'completed'">&#10004;</span>
                    <span *ngIf="getStepClass(9) !== 'completed'">9</span>
                  </div>
                  <div class="step-text">
                    <span class="step-title">9. Enrolment</span>
                    <small class="step-state">{{ getStepStateLabel(9) }}</small>
                  </div>
                </div>
              </div>

              <!-- Contextual Explanatory Note -->
              <div class="tracker-context-card" [ngClass]="trackerContextSeverity">
                <span class="context-icon">{{ trackerContextIcon }}</span>
                <div class="context-body">
                  <strong>{{ trackerContextTitle }}:</strong>
                  <span>{{ trackerContextMessage }}</span>
                  <div class="tracker-action-hint" *ngIf="trackerActionHint">
                    <span class="action-arrow">&#8594;</span> {{ trackerActionHint }}
                  </div>
                </div>
              </div>

              <!-- Preserved timeline box for legacy tests -->
              <div class="timeline-box" style="display: none;">
                <div class="timeline-steps">
                  <div class="step completed"></div>
                  <div class="step" [class.completed]="application.status === 'Under Review' || application.status === 'Selected' || application.status === 'Rejected'"></div>
                  <div class="step" [class.completed]="application.status === 'Selected' || application.status === 'Rejected'">
                    <div [class.rejected]="application.status === 'Rejected'"></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="app-details-toggle">
              <button class="btn-toggle" (click)="toggleDetails()">
                {{ showDetails ? 'Hide Application Details' : 'View Full Application Details' }}
              </button>
            </div>

            <!-- Collapsible Full Details -->
            <div *ngIf="showDetails" class="full-details-panel">
              <div class="details-section">
                <h4>1. Personal Information</h4>
                <div class="details-grid">
                  <div><span>Full Name:</span> {{ application.personalInfo?.fullName }}</div>
                  <div><span>Date of Birth:</span> {{ application.personalInfo?.dob | date:'mediumDate' }}</div>
                  <div><span>Gender:</span> {{ application.personalInfo?.gender }}</div>
                  <div><span>Email:</span> {{ application.personalInfo?.email }}</div>
                  <div><span>Phone:</span> {{ application.personalInfo?.phone }}</div>
                  <div><span>Address:</span> {{ application.personalInfo?.address }}, {{ application.personalInfo?.city }}, {{ application.personalInfo?.state }} - {{ application.personalInfo?.pincode }}</div>
                </div>
              </div>

              <div class="details-section">
                <h4>2. Academic Credentials</h4>
                <div class="details-grid">
                  <div><span>Class 10 Board:</span> {{ application.academicInfo?.class10Board }}</div>
                  <div><span>Class 10 %:</span> {{ application.academicInfo?.class10Percentage }}%</div>
                  <div><span>Class 12 Board:</span> {{ application.academicInfo?.class12Board }}</div>
                  <div><span>Class 12 %:</span> {{ application.academicInfo?.class12Percentage }}%</div>
                  <div *ngIf="application.academicInfo?.academicStream"><span>Academic Stream:</span> {{ application.academicInfo?.academicStream }}</div>
                  <div><span>Class 12 Passing Year:</span> {{ application.academicInfo?.class12PassingYear }}</div>
                  <div><span>Entrance Exam:</span> {{ application.academicInfo?.entranceExamName }}</div>
                  <div><span>Entrance Score/Rank:</span> {{ application.academicInfo?.entranceExamScore }}</div>
                </div>
              </div>

              <div class="details-section" *ngIf="application.selectedProgramme">
                <h4>3. Academic Programme Information</h4>
                <div class="details-grid">
                  <div><span>Programme Name:</span> {{ application.selectedProgramme.programmeName || application.selectedProgramme }}</div>
                  <div *ngIf="application.selectedProgramme.programmeCode"><span>Programme Code:</span> {{ application.selectedProgramme.programmeCode }}</div>
                  <div *ngIf="application.selectedProgramme.degree"><span>Degree:</span> {{ application.selectedProgramme.degree }}</div>
                  <div *ngIf="application.selectedProgramme.department"><span>Department:</span> {{ application.selectedProgramme.department }}</div>
                  <div *ngIf="application.selectedProgramme.duration"><span>Duration:</span> {{ application.selectedProgramme.duration }} {{ application.selectedProgramme.durationUnit || 'Years' }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Document Upload & Management Section -->
          <div class="doc-management-section">
            <div class="section-header">
              <h3>Required Documents &amp; Certificates</h3>
              <p>Upload your academic marksheets, entrance examination scorecard, and photograph (PDF, JPEG, or PNG up to 5MB).</p>
            </div>

            <!-- Upload Feedback Messages -->
            <div *ngIf="uploadSuccessMessage" class="alert-box success">
              {{ uploadSuccessMessage }}
            </div>
            <div *ngIf="uploadErrorMessage" class="alert-box error">
              {{ uploadErrorMessage }}
            </div>

            <!-- Upload Form Card -->
            <div class="upload-card">
              <h4>Upload New Document</h4>
              <div class="upload-controls">
                <div class="control-group">
                  <label for="docType">Document Type *</label>
                  <select id="docType" [(ngModel)]="selectedDocType">
                    <option value="">-- Select Document Category --</option>
                    <option value="Class 10 Marksheet">Class 10 Marksheet</option>
                    <option value="Class 12 Marksheet">Class 12 Marksheet</option>
                    <option value="Entrance Examination Scorecard">Entrance Examination Scorecard</option>
                    <option value="Photograph">Photograph</option>
                    <option value="Other Supporting Documents">Other Supporting Documents</option>
                  </select>
                </div>

                <div class="control-group">
                  <label for="filePicker">Select File (PDF, JPEG, PNG, max 5MB) *</label>
                  <input
                    id="filePicker"
                    #fileInput
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    (change)="onFileSelected($event)"
                  />
                  <small *ngIf="selectedFile" class="file-info-text">
                    Selected: <strong>{{ selectedFile.name }}</strong> ({{ formatBytes(selectedFile.size) }})
                  </small>
                </div>

                <div class="control-action">
                  <button
                    class="btn-upload"
                    [disabled]="!selectedDocType || !selectedFile || isUploading"
                    (click)="uploadDocument(fileInput)"
                  >
                    <span *ngIf="!isUploading">Upload Document</span>
                    <span *ngIf="isUploading">Uploading...</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Uploaded Documents Table -->
            <div class="uploaded-list-card">
              <h4>Uploaded Documents ({{ documents.length }})</h4>

              <div *ngIf="isLoadingDocs" class="loading-mini">
                <div class="spinner"></div>
                <p>Loading documents...</p>
              </div>

              <div *ngIf="!isLoadingDocs && documentsError" class="alert-box error">
                {{ documentsError }}
                <button type="button" class="btn-retry-inline" (click)="fetchDocuments(application._id)">
                  Retry
                </button>
              </div>

              <div *ngIf="!isLoadingDocs && !documentsError && documents.length === 0" class="empty-docs">
                <p>No documents uploaded yet. Please use the form above to attach required marksheets and identity proofs.</p>
              </div>

              <table *ngIf="!isLoadingDocs && !documentsError && documents.length > 0" class="docs-table">
                <thead>
                  <tr>
                    <th>Document Type</th>
                    <th>Filename</th>
                    <th>Size</th>
                    <th>Upload Date</th>
                    <th>Verification Status</th>
                    <th class="actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <ng-container *ngFor="let doc of documents">
                    <tr [class.row-rejected]="doc.verificationStatus === 'Rejected'">
                      <td>
                        <span class="doc-badge">{{ doc.documentType }}</span>
                      </td>
                      <td class="filename-cell">
                        <strong>{{ doc.originalFileName }}</strong>
                      </td>
                      <td>{{ formatBytes(doc.fileSize) }}</td>
                      <td>{{ doc.uploadedAt | date:'mediumDate' }}</td>
                      <td>
                        <span
                          class="status-badge-doc"
                          [ngClass]="(doc.verificationStatus || 'Pending').toLowerCase()"
                        >
                          {{ doc.verificationStatus || 'Pending' }}
                        </span>
                        <div *ngIf="doc.verifiedAt" class="doc-verify-date">
                          {{ doc.verifiedAt | date:'shortDate' }}
                        </div>
                      </td>
                      <td class="actions-col">
                        <button class="btn-action view" (click)="viewDoc(doc)" title="View in new tab">
                          View
                        </button>
                        <button class="btn-action download" (click)="downloadDoc(doc)" title="Download file">
                          Download
                        </button>
                        <button
                          *ngIf="doc.verificationStatus === 'Rejected'"
                          class="btn-action btn-replace-doc"
                          (click)="replaceDocument(doc)"
                          title="Upload replacement document"
                        >
                          Replace
                        </button>
                      </td>
                    </tr>
                    <tr *ngIf="doc.verificationStatus === 'Rejected'" class="rejection-reason-row">
                      <td colspan="6">
                        <div class="rejection-alert">
                          <span class="rejection-icon">&#9888;</span>
                          <div class="rejection-content">
                            <strong>Document Rejected by Reviewer:</strong>
                            <p class="rejection-remarks">"{{ doc.verificationRemarks }}"</p>
                            <small class="rejection-hint">
                              Please upload a clear, compliant replacement for <em>{{ doc.documentType }}</em>.
                              Click <strong>Replace</strong> above or select this document category in the form above.
                            </small>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </ng-container>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <ng-template #emptyState>
          <div class="state-card empty">
            <div class="empty-icon">&#128221;</div>
            <h3>No Admission Application Submitted Yet</h3>
            <p>
              You haven't submitted an admission application for the <strong>2026&ndash;2027</strong> academic session.
              Click the button below to fill out your academic and personal information.
            </p>
            <a routerLink="/applicant/apply" class="btn-primary-action">
              Start Admission Application &rarr;
            </a>
          </div>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      max-width: 1040px;
      margin: 2rem auto;
      padding: 0 1.5rem;
    }
    .welcome-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.5rem 2rem;
      margin-bottom: 1.75rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .welcome-info h2 {
      margin: 0;
      font-size: 1.45rem;
      color: #0f2b48;
    }
    .applicant-meta {
      margin: 0.5rem 0 0;
      font-size: 0.85rem;
      color: #64748b;
      display: flex;
      gap: 1.5rem;
      flex-wrap: wrap;
    }
    .applicant-meta strong {
      color: #1e293b;
    }
    .badge-applicant {
      background: #e0f2fe;
      color: #0369a1;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      font-weight: 600;
    }
    .quick-status {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.25rem;
    }
    .status-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      font-weight: 600;
    }
    .status-badge {
      font-size: 0.9rem;
      font-weight: 700;
      padding: 0.35rem 0.85rem;
      border-radius: 20px;
      letter-spacing: 0.3px;
    }
    .status-badge.submitted {
      background: #dbeafe;
      color: #1e40af;
    }
    .status-badge.under-review {
      background: #fef3c7;
      color: #92400e;
    }
    .status-badge.selected {
      background: #dcfce7;
      color: #166534;
    }
    .status-badge.rejected {
      background: #fee2e2;
      color: #991b1b;
    }
    .merit-result-card {
      background: #ffffff;
      border: 2px solid #0f2b48;
      border-radius: 8px;
      padding: 1.75rem 2rem;
      box-shadow: 0 4px 14px rgba(15, 43, 72, 0.08);
      margin-bottom: 2rem;
    }
    .merit-result-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.25rem;
      border-bottom: 1px solid #edf2f7;
      padding-bottom: 1rem;
    }
    .merit-tag {
      font-size: 0.8rem;
      font-weight: 700;
      color: #0f2b48;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.25rem;
      display: block;
    }
    .merit-result-header h3 {
      margin: 0;
      color: #0f2b48;
      font-size: 1.35rem;
    }
    .alloc-status-pill {
      font-size: 0.82rem;
      font-weight: 700;
      padding: 0.35rem 0.85rem;
      border-radius: 20px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .btn-view-merit-list-link {
      display: inline-block;
      margin-right: 0.75rem;
      background: #0f2b48;
      color: #ffffff;
      padding: 0.35rem 0.85rem;
      border-radius: 6px;
      font-size: 0.82rem;
      font-weight: 700;
      text-decoration: none;
      transition: background 0.2s;
    }
    .btn-view-merit-list-link:hover {
      background: #1a426e;
    }
    .alloc-status-pill.allocated {
      background: #dcfce7;
      color: #166534;
      border: 1px solid #86efac;
    }
    .alloc-status-pill.waitlisted {
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fcd34d;
    }
    .alloc-status-pill.ineligible {
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fca5a5;
    }
    .merit-result-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .merit-kpi {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 0.85rem 1rem;
    }
    .kpi-title {
      display: block;
      font-size: 0.72rem;
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 0.3rem;
    }
    .kpi-num {
      font-size: 1.3rem;
      font-weight: 800;
      color: #0f2b48;
    }
    .kpi-num.highlight {
      color: #0f2b48;
    }
    .allocation-reason-box {
      background: #f0fdf4;
      border-left: 4px solid #16a34a;
      padding: 0.85rem 1rem;
      border-radius: 4px;
      font-size: 0.88rem;
      color: #166534;
      margin-bottom: 1.25rem;
    }
    .cutoffs-summary-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 1rem 1.25rem;
    }
    .cutoffs-summary-box h5 {
      margin: 0 0 0.65rem;
      font-size: 0.85rem;
      color: #0f2b48;
      text-transform: uppercase;
    }
    .cutoffs-subgrid {
      display: flex;
      flex-wrap: wrap;
      gap: 1.5rem;
      font-size: 0.85rem;
      color: #475569;
    }
    .cutoffs-subgrid div {
      display: flex;
      gap: 0.35rem;
    }
    .cutoffs-subgrid strong {
      color: #0f2b48;
    }
    .app-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 2rem;
      box-shadow: 0 4px 12px rgba(15, 43, 72, 0.05);
      margin-bottom: 2rem;
    }
    .app-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid #edf2f7;
      padding-bottom: 1.25rem;
      margin-bottom: 1.5rem;
    }
    .app-id-label {
      font-size: 0.8rem;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }
    .app-id {
      margin: 0.25rem 0 0;
      font-size: 1.6rem;
      color: #0f2b48;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .session-pill {
      background: #f1f5f9;
      color: #475569;
      font-size: 0.85rem;
      font-weight: 600;
      padding: 0.35rem 0.75rem;
      border-radius: 4px;
    }
    .app-summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2rem;
    }
    .summary-item {
      background: #f8fafc;
      padding: 1rem;
      border-radius: 6px;
      border: 1px solid #f1f5f9;
    }
    .item-label {
      display: block;
      font-size: 0.75rem;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 600;
      margin-bottom: 0.35rem;
    }
    .item-value {
      font-size: 1rem;
      font-weight: 600;
      color: #1e293b;
    }
    .item-value.highlight {
      color: #0f2b48;
    }
    .timeline-box {
      background: #f8fafc;
      border-radius: 6px;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
    }
    .timeline-box h4 {
      margin: 0 0 1rem;
      font-size: 0.9rem;
      color: #334155;
    }
    .timeline-steps {
      display: flex;
      justify-content: space-between;
      position: relative;
      margin: 1rem 0 0.5rem;
    }
    .timeline-steps::before {
      content: '';
      position: absolute;
      top: 9px;
      left: 10%;
      right: 10%;
      height: 2px;
      background: #cbd5e1;
      z-index: 1;
    }
    .step {
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      z-index: 2;
      flex: 1;
    }
    .step-dot {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #ffffff;
      border: 3px solid #94a3b8;
    }
    .step.completed .step-dot {
      background: #2b6cb0;
      border-color: #2b6cb0;
    }
    .step-dot.rejected {
      background: #dc2626 !important;
      border-color: #dc2626 !important;
    }
    .step-name {
      margin-top: 0.5rem;
      font-size: 0.8rem;
      font-weight: 600;
      color: #64748b;
      text-align: center;
    }
    .step.completed .step-name {
      color: #0f2b48;
    }
    .app-details-toggle {
      text-align: center;
      margin-top: 1rem;
    }
    .btn-toggle {
      background: transparent;
      border: 1px solid #cbd5e1;
      color: #0f2b48;
      padding: 0.6rem 1.25rem;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-toggle:hover {
      background: #f1f5f9;
    }
    .full-details-panel {
      margin-top: 1.5rem;
      border-top: 1px solid #e2e8f0;
      padding-top: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .details-section h4 {
      margin: 0 0 0.75rem;
      font-size: 0.95rem;
      color: #0f2b48;
    }
    .details-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 0.75rem;
      font-size: 0.85rem;
      color: #334155;
    }
    .details-grid span {
      font-weight: 600;
      color: #64748b;
      display: inline-block;
      min-width: 110px;
    }
    .doc-management-section {
      margin-top: 2rem;
    }
    .section-header h3 {
      margin: 0 0 0.25rem;
      color: #0f2b48;
      font-size: 1.3rem;
    }
    .section-header p {
      margin: 0 0 1.25rem;
      color: #64748b;
      font-size: 0.9rem;
    }
    .upload-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.5rem 1.75rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
    }
    .upload-card h4 {
      margin: 0 0 1rem;
      font-size: 1.05rem;
      color: #0f2b48;
    }
    .upload-controls {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)) auto;
      gap: 1.25rem;
      align-items: flex-end;
    }
    .control-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .control-group label {
      font-size: 0.85rem;
      font-weight: 600;
      color: #334155;
    }
    .control-group select, .control-group input[type="file"] {
      padding: 0.55rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 0.85rem;
      background: #ffffff;
    }
    .file-info-text {
      color: #0369a1;
      font-size: 0.75rem;
    }
    .btn-upload {
      background: #0f2b48;
      color: #ffffff;
      border: none;
      padding: 0.65rem 1.4rem;
      border-radius: 4px;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.2s;
    }
    .btn-upload:hover:not(:disabled) {
      background: #1a426e;
    }
    .btn-upload:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .uploaded-list-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.5rem 1.75rem;
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
    }
    .uploaded-list-card h4 {
      margin: 0 0 1rem;
      font-size: 1.05rem;
      color: #0f2b48;
    }
    .empty-docs {
      padding: 1.5rem;
      text-align: center;
      color: #64748b;
      font-size: 0.9rem;
      background: #f8fafc;
      border-radius: 6px;
    }
    .btn-retry-inline {
      margin-left: 0.75rem;
      background: #0f2b48;
      color: #ffffff;
      border: none;
      padding: 0.3rem 0.75rem;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
    }
    .docs-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    .docs-table th {
      text-align: left;
      padding: 0.65rem 0.75rem;
      background: #f8fafc;
      border-bottom: 2px solid #e2e8f0;
      color: #475569;
      font-weight: 600;
    }
    .docs-table td {
      padding: 0.75rem;
      border-bottom: 1px solid #edf2f7;
      color: #334155;
    }
    .doc-badge {
      background: #e0f2fe;
      color: #0369a1;
      font-weight: 600;
      font-size: 0.75rem;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      display: inline-block;
    }
    .filename-cell {
      word-break: break-all;
    }
    .actions-col {
      text-align: right;
    }
    .btn-action {
      background: transparent;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 0.35rem 0.65rem;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      margin-left: 0.5rem;
      transition: all 0.2s;
    }
    .btn-action.view {
      color: #0369a1;
      border-color: #bae6fd;
      background: #f0f9ff;
    }
    .btn-action.view:hover {
      background: #e0f2fe;
    }
    .btn-action.download {
      color: #0f2b48;
      border-color: #cbd5e1;
      background: #f8fafc;
    }
    .btn-action.download:hover {
      background: #edf2f7;
    }
    .status-badge-doc {
      display: inline-block;
      padding: 0.2rem 0.55rem;
      border-radius: 10px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
    }
    .status-badge-doc.pending {
      background: #fef3c7;
      color: #92400e;
    }
    .status-badge-doc.verified {
      background: #d1fae5;
      color: #065f46;
    }
    .status-badge-doc.rejected {
      background: #fee2e2;
      color: #991b1b;
    }
    .doc-verify-date {
      font-size: 0.7rem;
      color: #64748b;
      margin-top: 0.2rem;
    }
    .btn-replace-doc {
      background: #fee2e2 !important;
      color: #b91c1c !important;
      border-color: #fca5a5 !important;
    }
    .btn-replace-doc:hover {
      background: #fecaca !important;
    }
    .row-rejected {
      background: #fff8f8;
    }
    .rejection-reason-row {
      background: #fff1f2;
    }
    .rejection-alert {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.65rem 0.85rem;
      border-left: 4px solid #ef4444;
      border-radius: 4px;
      background: #ffffff;
      margin: 0.25rem 0;
    }
    .rejection-icon {
      font-size: 1.25rem;
      color: #ef4444;
      line-height: 1;
    }
    .rejection-content strong {
      display: block;
      color: #991b1b;
      font-size: 0.85rem;
    }
    .rejection-remarks {
      margin: 0.25rem 0;
      color: #7f1d1d;
      font-weight: 600;
      font-size: 0.85rem;
    }
    .rejection-hint {
      display: block;
      color: #64748b;
      font-size: 0.75rem;
    }
    .state-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 3rem 2rem;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .empty-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    .state-card.empty h3 {
      margin: 0 0 0.5rem;
      color: #0f2b48;
      font-size: 1.35rem;
    }
    .state-card.empty p {
      max-width: 500px;
      margin: 0 auto 1.75rem;
      color: #64748b;
      font-size: 0.95rem;
      line-height: 1.5;
    }
    .btn-primary-action {
      display: inline-block;
      background: #0f2b48;
      color: #ffffff;
      font-weight: 600;
      padding: 0.75rem 1.75rem;
      border-radius: 4px;
      text-decoration: none;
    }
    .btn-primary-action:hover {
      background: #1a426e;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #e2e8f0;
      border-top-color: #0f2b48;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .alert-box {
      padding: 0.75rem 1rem;
      border-radius: 4px;
      font-size: 0.85rem;
      margin-bottom: 1rem;
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
    .loading-mini {
      text-align: center;
      padding: 1.5rem;
      color: #64748b;
    }

    /* Confirmed Permanent Enrolment Card */
    .confirmed-enrolment-card {
      background: #ffffff;
      border: 2px solid #10b981;
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.12);
    }
    .enrolment-banner {
      text-align: center;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .banner-badge {
      display: inline-block;
      background: #ecfdf5;
      color: #047857;
      font-size: 0.85rem;
      font-weight: 700;
      padding: 0.35rem 0.85rem;
      border-radius: 20px;
      margin-bottom: 0.5rem;
    }
    .congrats-text {
      color: #064e3b;
      margin: 0.25rem 0;
      font-size: 1.6rem;
      font-weight: 800;
    }
    .congrats-sub {
      color: #475569;
      margin: 0;
      font-size: 0.95rem;
      max-width: 700px;
      margin: 0 auto;
    }
    .enrolment-details-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .enrol-stat-card {
      background: #f8fafc;
      padding: 1rem 1.25rem;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .enrol-stat-card.primary {
      background: #ecfdf5;
      border-color: #a7f3d0;
    }
    .enrol-stat-card .stat-label {
      font-size: 0.75rem;
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
    }
    .enrol-stat-card .stat-number {
      font-size: 1.35rem;
      font-weight: 800;
      font-family: monospace;
      color: #047857;
    }
    .enrol-stat-card .stat-title {
      font-size: 1rem;
      font-weight: 700;
      color: #0f172a;
    }
    .enrol-stat-card .stat-sub {
      font-size: 0.8rem;
      color: #64748b;
    }
    .enrolment-actions {
      display: flex;
      justify-content: center;
    }
    .btn-print-receipt {
      background: #002b49;
      color: #ffffff;
      padding: 0.75rem 1.75rem;
      border: none;
      border-radius: 6px;
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: background 0.2s;
    }
    .btn-print-receipt:hover {
      background: #004270;
    }

    /* Admission Confirmation Offer Card */
    .admission-offer-card {
      background: #ffffff;
      border: 2px solid #0284c7;
      border-radius: 12px;
      padding: 1.75rem 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 4px 14px rgba(2, 132, 199, 0.12);
    }
    .offer-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 1.25rem;
      margin-bottom: 1.25rem;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .offer-title-wrap h3 {
      margin: 0.35rem 0;
      color: #002b49;
      font-size: 1.35rem;
    }
    .offer-title-wrap p {
      margin: 0;
      color: #64748b;
      font-size: 0.9rem;
    }
    .offer-badge {
      display: inline-block;
      background: #e0f2fe;
      color: #0369a1;
      font-size: 0.8rem;
      font-weight: 700;
      padding: 0.2rem 0.65rem;
      border-radius: 12px;
    }
    .offer-seat-tag {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      padding: 0.6rem 1rem;
      border-radius: 8px;
      text-align: right;
    }
    .offer-seat-tag .seat-label {
      display: block;
      font-size: 0.75rem;
      color: #166534;
      font-weight: 600;
    }
    .offer-seat-tag .seat-val {
      font-size: 1.1rem;
      font-weight: 800;
      color: #15803d;
    }
    .offer-fee-summary {
      background: #f8fafc;
      padding: 1.25rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
    }
    .offer-fee-summary .fee-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.35rem 0;
      font-size: 0.95rem;
    }
    .fee-amt {
      color: #0f172a;
      font-size: 1.25rem;
      font-weight: 800;
    }
    .fee-instructions {
      margin: 0.75rem 0 0;
      font-size: 0.82rem;
      color: #64748b;
      border-top: 1px dashed #cbd5e1;
      padding-top: 0.5rem;
    }
    .offer-actions {
      display: flex;
      justify-content: flex-end;
    }
    .btn-confirm-admission {
      background: #0284c7;
      color: #ffffff;
      padding: 0.8rem 2rem;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-confirm-admission:hover:not(:disabled) {
      background: #0369a1;
    }
    .btn-confirm-admission:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Verification Pending Card */
    .verification-pending-card {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 1.25rem 1.5rem;
      display: flex;
      gap: 1rem;
      align-items: center;
      margin-bottom: 2rem;
    }
    .notice-icon {
      font-size: 1.75rem;
      color: #d97706;
    }
    .notice-content h4 {
      margin: 0 0 0.25rem;
      color: #92400e;
      font-size: 1rem;
    }
    .notice-content p {
      margin: 0;
      color: #b45309;
      font-size: 0.88rem;
    }

    /* Checkout Modal */
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.65);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 1rem;
    }
    .checkout-modal {
      background: #ffffff;
      width: 100%;
      max-width: 520px;
      border-radius: 10px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      overflow: hidden;
    }
    .modal-header {
      padding: 1.25rem 1.5rem;
      background: #002b49;
      color: #ffffff;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .modal-logo-title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .iem-seal { font-size: 1.8rem; }
    .modal-logo-title h4 { margin: 0; font-size: 1.15rem; font-weight: 700; }
    .modal-logo-title small { opacity: 0.8; font-size: 0.75rem; }
    .btn-close-modal {
      background: transparent;
      border: none;
      color: #ffffff;
      font-size: 1.6rem;
      line-height: 1;
      cursor: pointer;
    }
    .modal-body {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .checkout-summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .summary-line {
      display: flex;
      justify-content: space-between;
      font-size: 0.88rem;
    }
    .summary-line .label { color: #64748b; }
    .summary-line .val { color: #0f172a; }
    .summary-divider {
      height: 1px;
      background: #e2e8f0;
      margin: 0.25rem 0;
    }
    .total-line .label { font-weight: 700; color: #002b49; font-size: 0.95rem; }
    .total-amt { font-size: 1.35rem; font-weight: 800; color: #002b49; }
    .sandbox-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 1.25rem;
    }
    .sandbox-badge {
      font-size: 0.8rem;
      font-weight: 700;
      color: #1e40af;
      margin-bottom: 0.35rem;
    }
    .sandbox-desc {
      font-size: 0.8rem;
      color: #3b82f6;
      margin: 0 0 1rem;
    }
    .simulation-actions {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }
    .btn-sim-success {
      background: #16a34a;
      color: #ffffff;
      padding: 0.75rem;
      border: none;
      border-radius: 6px;
      font-weight: 700;
      font-size: 0.92rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-sim-success:hover:not(:disabled) { background: #15803d; }
    .btn-sim-fail {
      background: #f1f5f9;
      color: #dc2626;
      border: 1px solid #fecaca;
      padding: 0.6rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .btn-sim-fail:hover:not(:disabled) { background: #fee2e2; }
    .btn-sim-cancel {
      background: #f8fafc;
      color: #64748b;
      border: 1px solid #cbd5e1;
      padding: 0.6rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .btn-sim-cancel:hover:not(:disabled) { background: #f1f5f9; color: #334155; }
    .modal-footer {
      padding: 1rem 1.5rem;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: flex-end;
      background: #f8fafc;
    }
    .btn-cancel {
      background: transparent;
      border: 1px solid #cbd5e1;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.85rem;
      cursor: pointer;
    }

    /* 9-Step Admission Journey Tracker */
    .admission-journey-tracker {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 1.5rem 1.75rem;
      margin-bottom: 2rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .tracker-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 0.75rem;
    }
    .tracker-header h4 {
      margin: 0;
      color: #002b49;
      font-size: 1.1rem;
    }
    .tracker-session {
      font-size: 0.8rem;
      color: #64748b;
      font-weight: 600;
      background: #f1f5f9;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
    }
    .journey-steps-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }
    .journey-step {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 0.75rem 0.5rem;
      border-radius: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      position: relative;
      transition: all 0.2s;
    }
    .journey-step.completed {
      background: #f0fdf4;
      border-color: #86efac;
    }
    .journey-step.current {
      background: #eff6ff;
      border-color: #93c5fd;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    }
    .journey-step.rejected {
      background: #fef2f2;
      border-color: #fca5a5;
    }
    .journey-step.pending {
      opacity: 0.75;
    }
    .step-icon-wrap {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #cbd5e1;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }
    .journey-step.completed .step-icon-wrap {
      background: #16a34a;
    }
    .journey-step.current .step-icon-wrap {
      background: #2563eb;
    }
    .journey-step.rejected .step-icon-wrap {
      background: #dc2626;
    }
    .step-title {
      font-size: 0.78rem;
      font-weight: 700;
      color: #1e293b;
      line-height: 1.2;
      margin-bottom: 0.25rem;
    }
    .step-state, .step-date {
      font-size: 0.7rem;
      color: #64748b;
    }
    .journey-step.completed .step-state {
      color: #15803d;
      font-weight: 600;
    }
    .journey-step.current .step-state {
      color: #1d4ed8;
      font-weight: 700;
    }
    .journey-step.rejected .step-state {
      color: #b91c1c;
      font-weight: 700;
    }
    .tracker-context-card {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.85rem 1.15rem;
      border-radius: 8px;
      font-size: 0.88rem;
      line-height: 1.4;
    }
    .tracker-context-card.success {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
    }
    .tracker-context-card.info {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
    }
    .tracker-context-card.warning {
      background: #fffbeb;
      border: 1px solid #fde68a;
      color: #92400e;
    }
    .tracker-context-card.error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
    }
    .context-icon {
      font-size: 1.2rem;
    }
    .tracker-action-hint {
      margin-top: 0.4rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: inherit;
      opacity: 0.9;
    }
    .action-arrow {
      font-weight: 700;
    }

    /* Pending Allocation Card */
    .admission-pending-allocation-card {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      background: #fffbeb;
      border: 1px solid #fcd34d;
      border-radius: 10px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 2rem;
    }
    .pending-icon {
      font-size: 1.6rem;
    }
    .pending-body h4 {
      margin: 0 0 0.35rem;
      color: #92400e;
      font-size: 1.05rem;
    }
    .pending-body p {
      margin: 0;
      color: #78350f;
      font-size: 0.88rem;
      line-height: 1.45;
    }

    /* Print Styles */
    @media print {
      body * {
        visibility: hidden;
      }
      .confirmed-enrolment-card,
      .confirmed-enrolment-card * {
        visibility: visible;
      }
      .confirmed-enrolment-card {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        border: 2px solid #000000;
        box-shadow: none;
      }
      .btn-print-receipt {
        display: none !important;
      }
    }
  `]
})
export class ApplicantDashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private applicationService = inject(ApplicationService);
  private documentService = inject(DocumentService);
  private meritService = inject(MeritService);
  private paymentService = inject(PaymentService);
  private cdr = inject(ChangeDetectorRef);

  public currentUser: User | null = null;
  public application: AdmissionApplication | null = null;
  public documents: UploadedDocument[] = [];
  public meritResult: ApplicantMeritResult | null = null;
  public isLoading = true;
  public isLoadingDocs = false;
  public documentsError = '';
  public errorMessage = '';
  public showDetails = false;

  // Admission & Payment State
  public admissionEligibility: any = null;
  public admissionReceipt: any = null;
  public activePaymentOrder: any = null;
  public isInitiatingPayment = false;
  public isCompletingPayment = false;
  public showCheckoutModal = false;
  public paymentErrorMessage = '';
  public paymentSuccessMessage = '';

  // Upload state
  public selectedDocType = '';
  public selectedFile: File | null = null;
  public isUploading = false;
  public uploadSuccessMessage = '';
  public uploadErrorMessage = '';

  ngOnInit(): void {
    this.currentUser = this.authService.currentUserValue;
    this.fetchApplication();
    this.fetchMeritResult();
    this.fetchAdmissionStatus();
  }

  fetchMeritResult(): void {
    this.meritService.getMyResult().subscribe({
      next: (res) => {
        if (res.data && res.data.hasPublishedResult) {
          this.meritResult = res.data;
        } else {
          this.meritResult = null;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.meritResult = null;
        this.cdr.markForCheck();
      }
    });
  }

  fetchApplication(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    this.applicationService.getMyApplication().subscribe({
      next: (res) => {
        this.isLoading = false;
        this.application = res.data;
        if (this.application && this.application._id) {
          this.fetchDocuments(this.application._id);
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Failed to load admission application status.';
        this.cdr.markForCheck();
      }
    });
  }

  fetchDocuments(applicationId: string | undefined): void {
    if (!applicationId) {
      this.isLoadingDocs = false;
      this.documentsError = 'Unable to load documents for this application.';
      this.cdr.markForCheck();
      return;
    }

    this.isLoadingDocs = true;
    this.documentsError = '';
    this.cdr.markForCheck();
    this.documentService.getDocumentsByApplication(applicationId).subscribe({
      next: (res) => {
        this.isLoadingDocs = false;
        this.documents = res.data || [];
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoadingDocs = false;
        this.documents = [];
        this.documentsError =
          err?.error?.message ||
          'Failed to load uploaded documents. Please try again.';
        this.cdr.markForCheck();
      }
    });
  }

  onFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        this.uploadErrorMessage = 'File size exceeds maximum permitted limit of 5MB.';
        this.selectedFile = null;
        event.target.value = '';
        this.cdr.markForCheck();
        return;
      }
      this.uploadErrorMessage = '';
      this.selectedFile = file;
      this.cdr.markForCheck();
    }
  }

  uploadDocument(fileInputRef: HTMLInputElement): void {
    if (!this.application?._id || !this.selectedDocType || !this.selectedFile) {
      this.uploadErrorMessage = 'Please choose a document category and valid file.';
      this.cdr.markForCheck();
      return;
    }

    this.isUploading = true;
    this.uploadSuccessMessage = '';
    this.uploadErrorMessage = '';
    this.cdr.markForCheck();

    this.documentService
      .uploadDocument(this.application._id, this.selectedDocType, this.selectedFile)
      .subscribe({
        next: (res) => {
          this.isUploading = false;
          this.uploadSuccessMessage = `Document '${this.selectedDocType}' uploaded successfully.`;
          this.selectedFile = null;
          this.selectedDocType = '';
          fileInputRef.value = '';
          if (this.application?._id) {
            this.fetchDocuments(this.application._id);
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isUploading = false;
          this.uploadErrorMessage = err.error?.message || 'Failed to upload document. Please verify format.';
          this.cdr.markForCheck();
        }
      });
  }

  viewDoc(doc: UploadedDocument): void {
    this.documentService.viewDocument(doc._id).subscribe({
      next: (blob) => {
        this.documentService.openBlobInNewTab(blob);
      },
      error: () => {
        alert('Could not view document. Please try again.');
      }
    });
  }

  downloadDoc(doc: UploadedDocument): void {
    this.documentService.downloadDocument(doc._id).subscribe({
      next: (blob) => {
        this.documentService.triggerBlobDownload(blob, doc.originalFileName);
      },
      error: () => {
        alert('Could not download document. Please try again.');
      }
    });
  }

  replaceDocument(doc: UploadedDocument): void {
    this.selectedDocType = doc.documentType;
    this.uploadErrorMessage = '';
    this.uploadSuccessMessage = `Replacing rejected ${doc.documentType}. Please select a replacement file above and click Upload.`;
    const el = document.getElementById('filePicker');
    if (el) {
      if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      el.focus();
    }
    this.cdr.markForCheck();
  }

  toggleDetails(): void {
    this.showDetails = !this.showDetails;
    this.cdr.markForCheck();
  }

  formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  fetchAdmissionStatus(): void {
    this.paymentService.getAdmissionReceipt().subscribe({
      next: (res) => {
        if (res.data?.hasConfirmedAdmission) {
          this.admissionReceipt = res.data;
          this.admissionEligibility = null;
        } else {
          this.admissionReceipt = null;
          this.admissionEligibility = res.data?.eligibility || null;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.admissionReceipt = null;
        this.admissionEligibility = null;
        this.cdr.markForCheck();
      }
    });
  }

  initiateAdmissionPayment(): void {
    this.isInitiatingPayment = true;
    this.paymentErrorMessage = '';
    this.paymentService.createOrder().subscribe({
      next: (res) => {
        this.isInitiatingPayment = false;
        if (res.success && res.data) {
          this.activePaymentOrder = res.data;
          this.showCheckoutModal = true;
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isInitiatingPayment = false;
        this.paymentErrorMessage = err.error?.message || 'Failed to initiate payment gateway order.';
        this.cdr.markForCheck();
      }
    });
  }

  closeCheckoutModal(): void {
    this.showCheckoutModal = false;
  }

  simulateSuccessfulPayment(): void {
    if (!this.activePaymentOrder) return;
    this.isCompletingPayment = true;
    this.paymentErrorMessage = '';

    const orderId = this.activePaymentOrder.orderId;
    const paymentId = 'pay_sandbox_' + Date.now();
    const signature = 'sandbox_valid_sig';

    this.paymentService.verifyPayment(orderId, paymentId, signature).subscribe({
      next: (res) => {
        this.isCompletingPayment = false;
        this.showCheckoutModal = false;
        this.paymentSuccessMessage =
          'Payment successful! Permanent Enrolment ' +
          (res.data?.enrolment?.enrolmentNumber || '') +
          ' has been officially issued.';
        this.fetchAdmissionStatus();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isCompletingPayment = false;
        this.paymentErrorMessage = err.error?.message || 'Payment verification failed.';
        this.cdr.markForCheck();
      }
    });
  }

  simulateFailedPayment(): void {
    if (!this.activePaymentOrder) return;
    this.isCompletingPayment = true;
    this.paymentErrorMessage = '';

    const orderId = this.activePaymentOrder.orderId;
    const paymentId = 'pay_fail_' + Date.now();
    const signature = 'invalid_signature_test';

    this.paymentService.verifyPayment(orderId, paymentId, signature).subscribe({
      next: () => {
        this.isCompletingPayment = false;
        this.showCheckoutModal = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isCompletingPayment = false;
        this.paymentErrorMessage = err.error?.message || 'Simulated gateway payment failed.';
        this.cdr.markForCheck();
      }
    });
  }

  simulateCancelledPayment(): void {
    this.closeCheckoutModal();
    this.paymentErrorMessage =
      'Payment transaction was cancelled by the applicant. You may re-initiate payment before the admission deadline.';
    this.cdr.markForCheck();
  }

  getStepClass(step: number): 'completed' | 'current' | 'pending' | 'rejected' {
    if (!this.application) return 'pending';

    switch (step) {
      case 1:
        // Application Submitted
        return 'completed';

      case 2:
        // Application Under Review: Completed when application has passed review (status Under Review or Selected)
        if (this.application.status === 'Rejected') return 'rejected';
        if (this.application.status === 'Under Review' || this.application.status === 'Selected') return 'completed';
        return 'current';

      case 3:
        // Documents Verified: Completed only when all documents are verified or documentVerificationStatus is Verified
        if (this.documents.some((d) => d.verificationStatus === 'Rejected')) return 'rejected';
        if (
          this.application.documentVerificationStatus === 'Verified' ||
          (this.documents.length > 0 && this.documents.every((d) => d.verificationStatus === 'Verified'))
        ) {
          return 'completed';
        }
        if (
          this.documents.length > 0 &&
          this.documents.some((d) => !d.verificationStatus || d.verificationStatus === 'Pending')
        ) {
          return 'current';
        }
        return 'pending';

      case 4:
        // Merit List: Completed ONLY when a valid published merit result exists for the applicant
        if (this.application.status === 'Rejected') return 'rejected';
        if (this.meritResult?.hasPublishedResult) return 'completed';
        // Actionable if documents verified and waiting for merit publication
        if (
          (this.application.documentVerificationStatus === 'Verified' ||
           (this.documents.length > 0 && this.documents.every((d) => d.verificationStatus === 'Verified'))) &&
          !this.meritResult?.hasPublishedResult
        ) {
          return 'current';
        }
        return 'pending';

      case 5:
        // Seat Allocation / Admission Offer: Completed only when a valid published allocation exists
        if (this.meritResult?.allocationStatus === 'Not Shortlisted') return 'rejected';
        if (
          this.meritResult?.allocationStatus === 'Allocated' ||
          this.admissionEligibility?.isEligible
        ) {
          return 'completed';
        }
        if (this.meritResult?.hasPublishedResult && !this.meritResult?.allocationStatus) {
          return 'current';
        }
        return 'pending';

      case 6:
        // Fee Payment: Completed only after verified successful payment
        if (this.admissionReceipt?.hasConfirmedAdmission || this.activePaymentOrder?.status === 'Success') {
          return 'completed';
        }
        if (this.admissionEligibility?.isEligible && !this.admissionReceipt?.hasConfirmedAdmission) {
          return 'current';
        }
        return 'pending';

      case 7:
        // Payment Verification: Completed after successful verification
        if (this.admissionReceipt?.hasConfirmedAdmission) {
          return 'completed';
        }
        if (this.isCompletingPayment) {
          return 'current';
        }
        return 'pending';

      case 8:
        // Admission Confirmation: Completed only when confirmed admission record exists
        if (this.admissionReceipt?.hasConfirmedAdmission) {
          return 'completed';
        }
        return 'pending';

      case 9:
        // Permanent Enrolment: Completed only when permanent enrolment record exists
        if (this.admissionReceipt?.enrolmentNumber) {
          return 'completed';
        }
        return 'pending';

      default:
        return 'pending';
    }
  }

  getStepStateLabel(step: number): string {
    const s = this.getStepClass(step);
    if (s === 'completed') return 'Completed';
    if (s === 'current') return 'In Progress';
    if (s === 'rejected') return 'Declined';
    return 'Pending';
  }

  get trackerContextSeverity(): 'success' | 'info' | 'warning' | 'error' {
    if (this.admissionReceipt?.hasConfirmedAdmission) return 'success';
    if (this.application?.status === 'Rejected') return 'error';
    if (this.admissionEligibility?.isEligible) return 'info';
    if (this.application?.status === 'Selected') return 'warning';
    return 'info';
  }

  get trackerContextIcon(): string {
    if (this.admissionReceipt?.hasConfirmedAdmission) return '🎓';
    if (this.application?.status === 'Rejected') return '❌';
    if (this.admissionEligibility?.isEligible) return '💳';
    if (this.application?.status === 'Selected') return '⏳';
    return 'ℹ️';
  }

  get trackerContextTitle(): string {
    if (this.admissionReceipt?.hasConfirmedAdmission) return 'Admission Confirmed';
    if (this.application?.status === 'Rejected') return 'Application Closed';
    if (this.admissionEligibility?.isEligible) return 'Action Required: Admission Fee Payment';
    if (this.application?.status === 'Selected') return 'Application Selected';
    if (this.application?.status === 'Under Review') return 'Review in Progress';
    return 'Application Submitted';
  }

  get trackerContextMessage(): string {
    if (this.admissionReceipt?.hasConfirmedAdmission) {
      return `Congratulations! Your admission is officially confirmed with Permanent Enrolment Number ${this.admissionReceipt.enrolmentNumber}. You can download or print your admission receipt below.`;
    }
    if (this.application?.status === 'Rejected') {
      return 'Your admission application was not accepted for the current session. Please contact the admission cell for further guidance.';
    }
    if (this.admissionEligibility?.isEligible) {
      return `A seat (Seat #${this.admissionEligibility.allocation?.seatNumber}) has been provisionally allocated to you. Please confirm your admission by completing the fee payment.`;
    }
    if (this.application?.status === 'Selected') {
      return 'Your application has been selected for admission consideration. Formal category-wise seat allocation is being finalized.';
    }
    if (this.application?.status === 'Under Review') {
      return 'Your application credentials and uploaded academic certificates are currently being reviewed by IEM admission reviewers.';
    }
    return 'Your application has been received successfully. It will be assigned to a reviewer for academic evaluation shortly.';
  }

  get trackerActionHint(): string {
    if (this.admissionReceipt?.hasConfirmedAdmission) {
      return 'Scroll down to view and print your Admission Receipt with Permanent Enrolment Number.';
    }
    if (this.application?.status === 'Rejected') {
      return '';
    }
    if (this.paymentErrorMessage) {
      return 'Your previous payment attempt was unsuccessful. You may retry the payment below.';
    }
    if (this.admissionEligibility?.isEligible && !this.admissionReceipt?.hasConfirmedAdmission) {
      return 'Click "Confirm Admission & Pay Fee" below to complete your admission.';
    }
    if (this.application?.status === 'Selected' && !this.admissionEligibility?.isEligible) {
      return 'Seat allocation is being finalized by the Admission Administration. No action is required from you at this time.';
    }
    if (this.application?.status === 'Under Review' && this.documents.length === 0) {
      return 'Upload your required academic documents (Class 10/12 marksheets, entrance exam scorecard) using the Document Upload section below.';
    }
    if (this.application?.status === 'Under Review' && this.documents.some(d => !d.verificationStatus || d.verificationStatus === 'Pending')) {
      return 'Your uploaded documents are awaiting verification by an IEM Reviewer. No action is required from you at this time.';
    }
    if (this.application?.status === 'Under Review') {
      return 'Your application is being evaluated. Await reviewer feedback — you will be notified when the review is complete.';
    }
    if (this.application?.status === 'Submitted') {
      return 'Upload your required documents (marksheets, ID proof, entrance scorecard) below while your application enters the review queue.';
    }
    return '';
  }

  printAdmissionReceipt(): void {
    window.print();
  }
}
