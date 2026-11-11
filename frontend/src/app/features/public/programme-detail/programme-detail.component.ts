import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { PublicAdmissionService } from '../../../core/services/public-admission.service';
import { AuthService } from '../../../core/services/auth.service';
import { Programme } from '../../../core/models/programme.model';
import { FeeStructure } from '../../../core/models/fee.model';

@Component({
  selector: 'app-programme-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="detail-page">
      <!-- Breadcrumb Bar -->
      <nav class="breadcrumb-bar">
        <div class="container">
          <a routerLink="/" class="b-link">Home</a>
          <span class="sep">/</span>
          <a routerLink="/programmes" class="b-link">Programmes</a>
          <span class="sep">/</span>
          <span class="current" *ngIf="programme">{{ programme.programmeCode }}</span>
        </div>
      </nav>

      <!-- Loading State -->
      <div *ngIf="isLoading" class="container loading-container">
        <div class="spinner"></div>
        <p>Loading programme specifications from admission database...</p>
      </div>

      <!-- Error State -->
      <div *ngIf="errorMessage" class="container error-container">
        <span class="err-icon">⚠️</span>
        <h2>Programme Not Available</h2>
        <p>{{ errorMessage }}</p>
        <div class="err-actions">
          <a routerLink="/programmes" class="btn btn-primary">Return to Programme Catalogue</a>
        </div>
      </div>

      <!-- Main Content when Programme Loaded -->
      <div *ngIf="!isLoading && programme" class="container content-container">
        <!-- Programme Header Banner -->
        <header class="programme-banner">
          <div class="banner-main">
            <div class="banner-tags">
              <span class="badge-level">{{ programme.degreeLevel }}</span>
              <span class="badge-code">{{ programme.programmeCode }}</span>
              <span
                class="badge-status"
                [class.open]="programme.isApplicationOpen"
                [class.closed]="!programme.isApplicationOpen"
              >
                {{ programme.isApplicationOpen ? 'Applications Open' : 'Applications Closed' }}
              </span>
            </div>
            <h1 class="programme-title">{{ programme.programmeName }}</h1>
            <p class="programme-dept">Department: {{ programme.department }}</p>
          </div>

          <div class="banner-cta">
            <ng-container *ngIf="authService.currentUser$ | async as user; else guestApply">
              <a
                [routerLink]="user.role === 'admin' ? '/admin/dashboard' : '/applicant/apply'"
                class="btn btn-gold btn-lg"
              >
                {{ user.role === 'admin' ? 'Open Admin Dashboard' : 'Apply for this Programme' }}
              </a>
            </ng-container>
            <ng-template #guestApply>
              <a routerLink="/auth/register" class="btn btn-gold btn-lg">Apply for Admission</a>
            </ng-template>
          </div>
        </header>

        <!-- Specifications Grid -->
        <div class="specs-grid">
          <!-- Left Column: Details & Eligibility -->
          <div class="specs-main">
            <!-- Overview & Description -->
            <section class="card spec-card">
              <h2 class="card-title">Programme Overview</h2>
              <div class="quick-facts">
                <div class="fact-box">
                  <span class="fact-label">Degree Designation</span>
                  <span class="fact-value">{{ programme.degree }}</span>
                </div>
                <div class="fact-box">
                  <span class="fact-label">Standard Duration</span>
                  <span class="fact-value">{{ programme.duration }} {{ programme.durationUnit }}</span>
                </div>
                <div class="fact-box" *ngIf="programme.seatCapacity?.total">
                  <span class="fact-label">Approved Intake</span>
                  <span class="fact-value">{{ programme.seatCapacity?.total }} Seats</span>
                </div>
                <div class="fact-box" *ngIf="programme.academicSession?.sessionName">
                  <span class="fact-label">Offered In Session</span>
                  <span class="fact-value">{{ programme.academicSession?.sessionName }}</span>
                </div>
              </div>

              <div class="description-body" *ngIf="programme.description">
                <p>{{ programme.description }}</p>
              </div>
            </section>

            <!-- Eligibility Requirements -->
            <section class="card spec-card">
              <h2 class="card-title">Eligibility Criteria</h2>
              <div *ngIf="programme.eligibility; else noEligibility">
                <ul class="eligibility-list">
                  <li *ngIf="programme.eligibility.minClass12Percentage != null">
                    <strong>Minimum Class 12 / Higher Secondary Aggregate:</strong>
                    <span>{{ programme.eligibility.minClass12Percentage }}% or equivalent grade</span>
                  </li>
                  <li *ngIf="programme.eligibility.requiredClass12Subjects?.length">
                    <strong>Mandatory Class 12 Subjects:</strong>
                    <span>{{ programme.eligibility.requiredClass12Subjects?.join(', ') }}</span>
                  </li>
                  <li *ngIf="programme.eligibility.acceptedAcademicStreams?.length">
                    <strong>Accepted Academic Streams:</strong>
                    <span>{{ programme.eligibility.acceptedAcademicStreams?.join(', ') }}</span>
                  </li>
                  <li *ngIf="programme.eligibility.acceptedEntranceExams?.length">
                    <strong>Accepted Entrance Examinations:</strong>
                    <span>{{ programme.eligibility.acceptedEntranceExams?.join(', ') }}</span>
                  </li>
                  <li *ngIf="programme.eligibility.minEntranceScore">
                    <strong>Minimum Entrance Requirement / Rank Guidelines:</strong>
                    <span>{{ programme.eligibility.minEntranceScore }}</span>
                  </li>
                  <li *ngIf="programme.eligibility.programmeSpecificCriteria">
                    <strong>Special Departmental Criteria:</strong>
                    <span>{{ programme.eligibility.programmeSpecificCriteria }}</span>
                  </li>
                  <li *ngIf="programme.eligibility.remarks">
                    <strong>Admissions Committee Remarks:</strong>
                    <span>{{ programme.eligibility.remarks }}</span>
                  </li>
                </ul>
              </div>
              <ng-template #noEligibility>
                <p class="muted-text">
                  General IEM Kolkata admission norms apply. Detailed criteria will be verified during application review.
                </p>
              </ng-template>
            </section>

            <!-- Required Documents for Application -->
            <section class="card spec-card" *ngIf="programme.requiredDocuments?.length">
              <h2 class="card-title">Required Documents for Application</h2>
              <p class="muted-text">Prepare clear PDF or image scans (under 5MB each) before applying:</p>
              <ul class="doc-list">
                <li *ngFor="let doc of programme.requiredDocuments">
                  📄 {{ doc }}
                </li>
              </ul>
            </section>

            <!-- Seat Distribution Breakdown (where configured) -->
            <section
              class="card spec-card"
              *ngIf="programme.seatCapacity?.categoryAllocations?.length"
            >
              <h2 class="card-title">Approved Seat Distribution</h2>
              <div class="category-table-wrapper">
                <table class="category-table">
                  <thead>
                    <tr>
                      <th>Admission Category</th>
                      <th>Allocated Seats</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let cat of programme.seatCapacity?.categoryAllocations">
                      <td>{{ cat.category }}</td>
                      <td><strong>{{ cat.seats }}</strong></td>
                    </tr>
                    <tr class="total-row">
                      <td><strong>Total Seat Capacity</strong></td>
                      <td><strong>{{ programme.seatCapacity?.total }}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <!-- Right Column: Official Fee Structure -->
          <aside class="specs-side">
            <div class="card fee-card">
              <h2 class="card-title">Fee Structure</h2>

              <!-- Fee Loading -->
              <div *ngIf="isLoadingFee" class="fee-loading">
                <div class="spinner-small"></div>
                <span>Checking fee schedule...</span>
              </div>

              <!-- Fee Available -->
              <div *ngIf="!isLoadingFee && feeStructure" class="fee-content">
                <div class="fee-total-box">
                  <span class="total-label">Total Programme Fee</span>
                  <span class="total-amount">
                    {{ feeStructure.currency }} {{ feeStructure.totalProgrammeFee | number:'1.2-2' }}
                  </span>
                  <span class="session-tag" *ngIf="feeStructure.academicSession?.sessionName">
                    Session {{ feeStructure.academicSession?.sessionName }}
                  </span>
                </div>

                <div class="fee-breakdown">
                  <div class="fee-row" *ngIf="feeStructure.applicationFee != null">
                    <span>Application Fee:</span>
                    <strong>{{ feeStructure.currency }} {{ feeStructure.applicationFee | number }}</strong>
                  </div>
                  <div class="fee-row" *ngIf="feeStructure.admissionFee != null">
                    <span>Admission Fee (One-Time):</span>
                    <strong>{{ feeStructure.currency }} {{ feeStructure.admissionFee | number }}</strong>
                  </div>

                  <!-- Semester Fees Breakdown -->
                  <div class="sem-fee-section" *ngIf="feeStructure.semesterFees?.length">
                    <h4 class="sub-head">Semester Tuition Fees</h4>
                    <div class="fee-row sem-row" *ngFor="let sem of feeStructure.semesterFees">
                      <span>Semester {{ sem.semesterNumber }}:</span>
                      <span>{{ feeStructure.currency }} {{ sem.amount | number }}</span>
                    </div>
                  </div>

                  <!-- Additional Institutional Fees -->
                  <div class="add-fee-section" *ngIf="feeStructure.additionalFees?.length">
                    <h4 class="sub-head">Institutional &amp; Laboratory Charges</h4>
                    <div class="fee-row add-row" *ngFor="let add of feeStructure.additionalFees">
                      <span>
                        {{ add.feeName }}
                        <small *ngIf="add.description" class="fee-desc">({{ add.description }})</small>:
                      </span>
                      <span>{{ feeStructure.currency }} {{ add.amount | number }}</span>
                    </div>
                  </div>

                  <!-- Payment Instructions -->
                  <div class="payment-notes" *ngIf="feeStructure.paymentInstructions">
                    <h4 class="sub-head">Payment Guidelines</h4>
                    <p>{{ feeStructure.paymentInstructions }}</p>
                  </div>
                </div>
              </div>

              <!-- Fee Not Configured / Unavailable -->
              <div *ngIf="!isLoadingFee && !feeStructure" class="fee-unavailable">
                <div class="unavail-icon">ℹ️</div>
                <h3>Fee Schedule Notice</h3>
                <p>
                  Official fee breakdown for this academic session has not yet been published by the finance office.
                  Please consult the Admissions Office directly for the latest verified schedule.
                </p>
              </div>

              <div class="fee-action">
                <ng-container *ngIf="authService.currentUser$ | async as user; else guestBtn">
                  <a
                    [routerLink]="user.role === 'admin' ? '/admin/dashboard' : '/applicant/apply'"
                    class="btn btn-gold btn-block"
                  >
                    {{ user.role === 'admin' ? 'Admin Dashboard' : 'Proceed to Application' }}
                  </a>
                </ng-container>
                <ng-template #guestBtn>
                  <a routerLink="/auth/register" class="btn btn-gold btn-block">Apply for this Course</a>
                </ng-template>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .detail-page {
      background: #f4f7fa;
      min-height: calc(100vh - 120px);
      padding-bottom: 5rem;
    }
    .container {
      max-width: 1240px;
      margin: 0 auto;
      padding: 0 1.5rem;
    }
    .breadcrumb-bar {
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      padding: 0.85rem 0;
      font-size: 0.88rem;
    }
    .b-link {
      color: #1a426e;
      text-decoration: none;
      font-weight: 500;
    }
    .b-link:hover {
      text-decoration: underline;
    }
    .sep {
      margin: 0 0.5rem;
      color: #94a3b8;
    }
    .current {
      color: #64748b;
      font-weight: 600;
    }
    .loading-container, .error-container {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 4rem 2rem;
      margin-top: 2rem;
      text-align: center;
      color: #64748b;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #e2e8f0;
      border-top-color: #0f2b48;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 1.5rem;
    }
    .spinner-small {
      width: 20px;
      height: 20px;
      border: 2px solid #e2e8f0;
      border-top-color: #0f2b48;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .err-icon {
      font-size: 2.5rem;
      display: block;
      margin-bottom: 1rem;
    }
    .error-container h2 {
      font-size: 1.5rem;
      color: #0f2b48;
      margin-bottom: 0.5rem;
    }
    .error-container p {
      margin-bottom: 1.5rem;
    }
    .programme-banner {
      background: #0f2b48;
      color: #ffffff;
      border-radius: 10px;
      padding: 2.5rem;
      margin: 2rem 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 2rem;
    }
    .banner-tags {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      margin-bottom: 0.75rem;
      flex-wrap: wrap;
    }
    .badge-level {
      background: #e0f2fe;
      color: #0369a1;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .badge-code {
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
      font-size: 0.8rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
    }
    .badge-status {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .badge-status.open {
      background: #166534;
      color: #dcfce7;
    }
    .badge-status.closed {
      background: #991b1b;
      color: #fee2e2;
    }
    .programme-title {
      font-size: 2.1rem;
      font-weight: 800;
      line-height: 1.25;
      margin-bottom: 0.5rem;
    }
    .programme-dept {
      font-size: 1rem;
      color: #cbd5e1;
    }
    .btn {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      font-weight: 600;
      text-decoration: none;
      text-align: center;
      transition: all 0.2s;
      cursor: pointer;
    }
    .btn-gold {
      background: #c98a2c;
      color: #0f2b48;
      border: 1px solid #c98a2c;
    }
    .btn-gold:hover {
      background: #df9e38;
      color: #0b1f34;
    }
    .btn-primary {
      background: #0f2b48;
      color: #ffffff;
    }
    .btn-primary:hover {
      background: #1a426e;
    }
    .btn-lg {
      padding: 0.9rem 1.8rem;
      font-size: 1rem;
      white-space: nowrap;
    }
    .btn-block {
      display: block;
      width: 100%;
      box-sizing: border-box;
    }
    .specs-grid {
      display: grid;
      grid-template-columns: 1.4fr 0.8fr;
      gap: 2rem;
      align-items: start;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 2rem;
      margin-bottom: 1.5rem;
    }
    .card-title {
      font-size: 1.3rem;
      font-weight: 700;
      color: #0f2b48;
      margin-bottom: 1.25rem;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 0.75rem;
    }
    .quick-facts {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .fact-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
    }
    .fact-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 0.25rem;
    }
    .fact-value {
      font-size: 1.05rem;
      font-weight: 700;
      color: #0f2b48;
    }
    .description-body {
      font-size: 0.95rem;
      line-height: 1.6;
      color: #334155;
    }
    .eligibility-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .eligibility-list li {
      padding: 0.75rem 0;
      border-bottom: 1px solid #f1f5f9;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.92rem;
      color: #1e293b;
    }
    .eligibility-list li strong {
      color: #0f2b48;
    }
    .doc-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
    .doc-list li {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 0.65rem 1rem;
      border-radius: 4px;
      font-size: 0.88rem;
      color: #334155;
      font-weight: 500;
    }
    .category-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    .category-table th, .category-table td {
      padding: 0.75rem 1rem;
      border: 1px solid #e2e8f0;
      text-align: left;
    }
    .category-table th {
      background: #f8fafc;
      font-weight: 700;
      color: #0f2b48;
    }
    .total-row {
      background: #f1f5f9;
      font-weight: 700;
    }
    .fee-card {
      position: sticky;
      top: 90px;
    }
    .fee-loading {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1.5rem 0;
      color: #64748b;
      font-size: 0.9rem;
    }
    .fee-total-box {
      background: #f8fafc;
      border: 1.5px solid #c98a2c;
      border-radius: 6px;
      padding: 1.25rem;
      text-align: center;
      margin-bottom: 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .total-label {
      font-size: 0.78rem;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
    }
    .total-amount {
      font-size: 1.8rem;
      font-weight: 800;
      color: #0f2b48;
      margin: 0.25rem 0;
    }
    .session-tag {
      font-size: 0.75rem;
      color: #c98a2c;
      font-weight: 600;
    }
    .fee-breakdown {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      margin-bottom: 1.5rem;
    }
    .fee-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.88rem;
      padding: 0.4rem 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .sub-head {
      font-size: 0.85rem;
      font-weight: 700;
      color: #0f2b48;
      text-transform: uppercase;
      margin: 1rem 0 0.4rem;
    }
    .sem-row, .add-row {
      font-size: 0.82rem;
      color: #475569;
    }
    .fee-desc {
      color: #94a3b8;
    }
    .payment-notes {
      background: #fffbeb;
      border: 1px solid #fef3c7;
      padding: 0.75rem;
      border-radius: 4px;
      font-size: 0.82rem;
      color: #78350f;
      line-height: 1.4;
      margin-top: 1rem;
    }
    .fee-unavailable {
      text-align: center;
      padding: 1.5rem 0;
      color: #64748b;
    }
    .unavail-icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
    .fee-unavailable h3 {
      font-size: 1.05rem;
      color: #0f2b48;
      margin-bottom: 0.5rem;
    }
    .fee-unavailable p {
      font-size: 0.85rem;
      line-height: 1.5;
    }
    .fee-action {
      margin-top: 1.5rem;
    }
    .muted-text {
      color: #64748b;
      font-size: 0.9rem;
      line-height: 1.5;
    }
    @media (max-width: 900px) {
      .programme-banner {
        flex-direction: column;
        align-items: flex-start;
      }
      .specs-grid {
        grid-template-columns: 1fr;
      }
      .fee-card {
        position: static;
      }
      .quick-facts {
        grid-template-columns: 1fr;
      }
      .doc-list {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class ProgrammeDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private admissionService = inject(PublicAdmissionService);
  private cdr = inject(ChangeDetectorRef);
  public authService = inject(AuthService);

  programme: Programme | null = null;
  feeStructure: FeeStructure | null = null;

  isLoading = true;
  isLoadingFee = false;
  errorMessage = '';

  ngOnInit(): void {
    const idOrCode = this.route.snapshot.paramMap.get('id');
    if (!idOrCode) {
      this.isLoading = false;
      this.errorMessage = 'No programme identifier was specified in the route.';
      this.cdr.markForCheck();
      return;
    }

    this.loadProgramme(idOrCode);
  }

  loadProgramme(identifier: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    // Check if identifier is MongoDB ObjectId (24 hex characters) or a programme code (e.g. BTECH-CSE)
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);
    const fetch$ = isObjectId
      ? this.admissionService.getProgrammeById(identifier)
      : this.admissionService.getProgrammeByCode(identifier);

    fetch$.subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && res.data) {
          this.programme = res.data;
          this.loadProgrammeFee(this.programme._id);
        } else {
          this.errorMessage = 'Programme details could not be found.';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage =
          err.error?.message || 'Programme details are currently unavailable.';
        this.cdr.markForCheck();
      }
    });
  }

  loadProgrammeFee(programmeId: string): void {
    this.isLoadingFee = true;
    this.cdr.markForCheck();

    this.admissionService.getProgrammeFee(programmeId).subscribe({
      next: (res) => {
        this.isLoadingFee = false;
        if (res.success && res.data) {
          this.feeStructure = res.data;
        } else {
          this.feeStructure = null;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        // Distinguish missing fee from error: keeps feeStructure as null gracefully
        this.isLoadingFee = false;
        this.feeStructure = null;
        this.cdr.markForCheck();
      }
    });
  }
}
