import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PublicAdmissionService } from '../../../core/services/public-admission.service';
import { Programme } from '../../../core/models/programme.model';
import { FeeStructure } from '../../../core/models/fee.model';

@Component({
  selector: 'app-fees',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="fees-page">
      <!-- Header -->
      <header class="page-header">
        <div class="container">
          <span class="badge-tag">Finance &amp; Tuition</span>
          <h1 class="page-title">Fee Structures &amp; Schedules</h1>
          <p class="page-subtitle">
            Transparent breakdown of tuition, admission, laboratory, and semester fees for academic programmes offered at IEM.
          </p>
        </div>
      </header>

      <!-- Main Content -->
      <main class="container content-section">
        <!-- Programme Selector -->
        <div class="selector-card">
          <div class="selector-row">
            <label for="progSelect">Select Academic Programme:</label>
            <select
              id="progSelect"
              [(ngModel)]="selectedProgrammeId"
              (ngModelChange)="onProgrammeSelect()"
              class="programme-select"
            >
              <option value="" disabled>-- Choose a Programme --</option>
              <option *ngFor="let prog of programmes" [value]="prog._id">
                {{ prog.programmeName }} ({{ prog.programmeCode }}) &bull; {{ prog.degree }}
              </option>
            </select>
          </div>
          <p class="selector-hint">
            Official fee schedules are configured individually per programme and admission session by the finance division.
          </p>
        </div>

        <!-- Loading State -->
        <div *ngIf="isLoading" class="loading-state">
          <div class="spinner"></div>
          <p>Loading fee structure from database...</p>
        </div>

        <!-- Selected Fee Display -->
        <div *ngIf="!isLoading && selectedFee" class="fee-display-card">
          <div class="display-header">
            <div>
              <span class="dept-badge">{{ selectedFee.programme.department || 'Institute Programme' }}</span>
              <h2>{{ selectedFee.programme.programmeName }} ({{ selectedFee.programme.programmeCode }})</h2>
              <p class="degree-meta">
                Degree: {{ selectedFee.programme.degree }} &bull; Duration: {{ selectedFee.programme.duration }} {{ selectedFee.programme.durationUnit }} &bull;
                Academic Session: {{ selectedFee.academicSession.sessionName }} ({{ selectedFee.academicSession.sessionCode }})
              </p>
            </div>
            <div class="total-badge">
              <span class="lbl">Total Programme Fee</span>
              <span class="amt">{{ selectedFee.currency }} {{ selectedFee.totalProgrammeFee | number:'1.2-2' }}</span>
            </div>
          </div>

          <!-- Fee Components Table -->
          <div class="components-section">
            <h3>Fee Component Itemization</h3>
            <table class="fee-table">
              <thead>
                <tr>
                  <th>Component Name</th>
                  <th>Type / Frequency</th>
                  <th class="amt-col">Amount ({{ selectedFee.currency }})</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngIf="selectedFee.applicationFee != null">
                  <td>Application Evaluation Fee</td>
                  <td>One-time upfront processing</td>
                  <td class="amt-col">{{ selectedFee.applicationFee | number }}</td>
                </tr>
                <tr *ngIf="selectedFee.admissionFee != null">
                  <td>Admission Acceptance Fee</td>
                  <td>One-time upon enrollment confirmation</td>
                  <td class="amt-col">{{ selectedFee.admissionFee | number }}</td>
                </tr>
                <!-- Semester Fees -->
                <tr *ngFor="let sem of selectedFee.semesterFees">
                  <td>Semester {{ sem.semesterNumber }} Tuition &amp; Academic Charges</td>
                  <td>Per Semester</td>
                  <td class="amt-col">{{ sem.amount | number }}</td>
                </tr>
                <!-- Additional Fees -->
                <tr *ngFor="let add of selectedFee.additionalFees">
                  <td>
                    {{ add.feeName }}
                    <span *ngIf="add.description" class="sub-desc">({{ add.description }})</span>
                  </td>
                  <td>Institutional / Laboratory</td>
                  <td class="amt-col">{{ add.amount | number }}</td>
                </tr>
                <!-- Total Row -->
                <tr class="grand-total-row">
                  <td colspan="2">
                    <strong>Total Programme Fee (Sum of Admission, Semester &amp; Institutional Fees)</strong>
                  </td>
                  <td class="amt-col">
                    <strong>{{ selectedFee.currency }} {{ selectedFee.totalProgrammeFee | number:'1.2-2' }}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Payment Instructions -->
          <div class="instructions-box" *ngIf="selectedFee.paymentInstructions">
            <h4>Payment Methods &amp; Instructions</h4>
            <p>{{ selectedFee.paymentInstructions }}</p>
          </div>

          <!-- Action buttons -->
          <div class="action-footer">
            <a [routerLink]="['/programmes', selectedFee.programme._id]" class="btn btn-secondary">
              View Programme Eligibility
            </a>
            <a routerLink="/auth/register" class="btn btn-gold">
              Apply for this Programme
            </a>
          </div>
        </div>

        <!-- Empty / No Fee Configured State for Selected Programme -->
        <div *ngIf="!isLoading && selectedProgrammeId && !selectedFee" class="empty-state">
          <span class="empty-icon">📋</span>
          <h3>Fee Information Pending Publication</h3>
          <p>
            The formal fee schedule for this academic programme has not yet been finalized in the system
            for the current admission session.
          </p>
          <p class="sub-note">
            Please contact the Admissions &amp; Accounts Office for verified fee guidelines and installment policies.
          </p>
          <a [routerLink]="['/programmes', selectedProgrammeId]" class="btn btn-secondary">
            View Academic Requirements Instead
          </a>
        </div>

        <!-- Initial Prompt State (No Programme Selected) -->
        <div *ngIf="!isLoading && !selectedProgrammeId && programmes.length > 0" class="prompt-state">
          <span class="prompt-icon">💡</span>
          <h3>Select a Programme to View Its Specific Fee Structure</h3>
          <p>Choose an academic course from the dropdown above to inspect detailed tuition and semester breakdowns.</p>
        </div>

        <!-- No Programmes in Catalogue at all -->
        <div *ngIf="!isLoading && programmes.length === 0" class="empty-state">
          <span class="empty-icon">📂</span>
          <h3>No Programme Catalogues Available</h3>
          <p>Academic courses and fee structures are currently being updated for the active session.</p>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .fees-page {
      background: #f4f7fa;
      min-height: calc(100vh - 120px);
      padding-bottom: 5rem;
    }
    .container {
      max-width: 1040px;
      margin: 0 auto;
      padding: 0 1.5rem;
    }
    .page-header {
      background: #0f2b48;
      color: #ffffff;
      padding: 3.5rem 0 3rem;
    }
    .badge-tag {
      display: inline-block;
      background: rgba(201, 138, 44, 0.2);
      border: 1px solid #c98a2c;
      color: #f7d492;
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
    }
    .page-title {
      font-size: 2.3rem;
      font-weight: 800;
      margin-bottom: 0.5rem;
    }
    .page-subtitle {
      font-size: 1rem;
      color: #cbd5e1;
      max-width: 650px;
      line-height: 1.5;
    }
    .content-section {
      padding: 2.5rem 0;
    }
    .selector-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.75rem;
      margin-bottom: 2rem;
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
    }
    .selector-row {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      flex-wrap: wrap;
    }
    .selector-row label {
      font-size: 0.95rem;
      font-weight: 700;
      color: #0f2b48;
    }
    .programme-select {
      flex: 1;
      min-width: 280px;
      padding: 0.75rem 1rem;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 0.92rem;
      background: #ffffff;
      color: #1e293b;
      outline: none;
    }
    .programme-select:focus {
      border-color: #0f2b48;
      box-shadow: 0 0 0 3px rgba(15, 43, 72, 0.1);
    }
    .selector-hint {
      font-size: 0.82rem;
      color: #64748b;
      margin-top: 0.75rem;
      margin-bottom: 0;
    }
    .fee-display-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 2.25rem;
      box-shadow: 0 4px 12px rgba(0,0,0,0.04);
    }
    .display-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 1.5rem;
      margin-bottom: 1.75rem;
      gap: 1.5rem;
      flex-wrap: wrap;
    }
    .dept-badge {
      font-size: 0.75rem;
      font-weight: 700;
      background: #e0f2fe;
      color: #0369a1;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      text-transform: uppercase;
      display: inline-block;
      margin-bottom: 0.4rem;
    }
    .display-header h2 {
      font-size: 1.5rem;
      font-weight: 800;
      color: #0f2b48;
      margin-bottom: 0.25rem;
    }
    .degree-meta {
      font-size: 0.88rem;
      color: #64748b;
      margin: 0;
    }
    .total-badge {
      background: #f8fafc;
      border: 1.5px solid #c98a2c;
      border-radius: 8px;
      padding: 0.85rem 1.5rem;
      text-align: right;
    }
    .total-badge .lbl {
      font-size: 0.75rem;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
      display: block;
    }
    .total-badge .amt {
      font-size: 1.6rem;
      font-weight: 800;
      color: #0f2b48;
    }
    .components-section h3 {
      font-size: 1.15rem;
      font-weight: 700;
      color: #0f2b48;
      margin-bottom: 1rem;
    }
    .fee-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.92rem;
      margin-bottom: 1.75rem;
    }
    .fee-table th, .fee-table td {
      padding: 0.85rem 1rem;
      border: 1px solid #e2e8f0;
      text-align: left;
    }
    .fee-table th {
      background: #f8fafc;
      font-weight: 700;
      color: #0f2b48;
    }
    .amt-col {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .grand-total-row {
      background: #f1f5f9;
      font-size: 1rem;
    }
    .sub-desc {
      font-size: 0.8rem;
      color: #64748b;
      margin-left: 0.35rem;
    }
    .instructions-box {
      background: #fffbeb;
      border: 1px solid #fef3c7;
      border-radius: 6px;
      padding: 1.25rem;
      margin-bottom: 1.75rem;
    }
    .instructions-box h4 {
      font-size: 0.95rem;
      font-weight: 700;
      color: #78350f;
      margin-bottom: 0.4rem;
    }
    .instructions-box p {
      font-size: 0.88rem;
      color: #92400e;
      margin: 0;
      line-height: 1.5;
    }
    .action-footer {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      border-top: 1px solid #e2e8f0;
      padding-top: 1.25rem;
    }
    .btn {
      display: inline-block;
      padding: 0.65rem 1.4rem;
      border-radius: 5px;
      font-weight: 600;
      font-size: 0.9rem;
      text-decoration: none;
      cursor: pointer;
    }
    .btn-gold {
      background: #c98a2c;
      color: #0f2b48;
      border: 1px solid #c98a2c;
    }
    .btn-gold:hover {
      background: #df9e38;
    }
    .btn-secondary {
      background: #f1f5f9;
      color: #0f2b48;
      border: 1px solid #cbd5e1;
    }
    .btn-secondary:hover {
      background: #e2e8f0;
    }
    .loading-state, .empty-state, .prompt-state {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 4rem 2rem;
      text-align: center;
      color: #64748b;
    }
    .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid #e2e8f0;
      border-top-color: #0f2b48;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 1.25rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .empty-icon, .prompt-icon {
      font-size: 2.5rem;
      display: block;
      margin-bottom: 1rem;
    }
    .empty-state h3, .prompt-state h3 {
      font-size: 1.25rem;
      color: #0f2b48;
      margin-bottom: 0.5rem;
      font-weight: 700;
    }
    .sub-note {
      font-size: 0.85rem;
      color: #94a3b8;
      margin-bottom: 1.5rem;
    }
    @media (max-width: 768px) {
      .display-header {
        flex-direction: column;
      }
      .total-badge {
        text-align: left;
        width: 100%;
        box-sizing: border-box;
      }
      .action-footer {
        flex-direction: column;
      }
    }
  `]
})
export class FeesComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private admissionService = inject(PublicAdmissionService);
  private cdr = inject(ChangeDetectorRef);

  programmes: Programme[] = [];
  selectedProgrammeId = '';
  selectedFee: FeeStructure | null = null;

  isLoading = true;

  ngOnInit(): void {
    const queryProg = this.route.snapshot.queryParams['programme'];

    this.admissionService.getProgrammes().subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && Array.isArray(res.data)) {
          this.programmes = res.data;
          if (queryProg) {
            this.selectedProgrammeId = queryProg;
            this.onProgrammeSelect();
          } else if (this.programmes.length > 0) {
            this.selectedProgrammeId = this.programmes[0]._id;
            this.onProgrammeSelect();
          }
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.programmes = [];
        this.cdr.markForCheck();
      }
    });
  }

  onProgrammeSelect(): void {
    if (!this.selectedProgrammeId) return;

    this.isLoading = true;
    this.selectedFee = null;
    this.cdr.markForCheck();

    this.admissionService.getProgrammeFee(this.selectedProgrammeId).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && res.data) {
          this.selectedFee = res.data;
        } else {
          this.selectedFee = null;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.selectedFee = null;
        this.cdr.markForCheck();
      }
    });
  }
}
