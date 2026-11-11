import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MeritService } from '../../../core/services/merit.service';
import { AdminService } from '../../../core/services/admin.service';
import {
  MeritConfiguration,
  MeritList,
  MeritListEntry,
  SeatAllocation,
  AllocationItem
} from '../../../core/models/merit.model';
import { Programme } from '../../../core/models/programme.model';
import { AcademicSession } from '../../../core/models/session.model';

@Component({
  selector: 'app-admin-merit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="merit-management-root">
      <!-- Header Controls: Programme & Session Selectors -->
      <div class="merit-header-card">
        <div class="merit-header-title">
          <h3>Merit List Generation & Category-Wise Seat Allocation</h3>
          <p>Configure scoring weights, screen candidates, compute cutoffs, and allocate seats deterministically.</p>
        </div>

        <div class="selectors-row">
          <div class="selector-group">
            <label for="programmeSelect">Academic Programme:</label>
            <select
              id="programmeSelect"
              [(ngModel)]="selectedProgrammeId"
              (change)="onProgrammeOrSessionChange()"
              [disabled]="isLoading"
            >
              <option value="" disabled>-- Select Programme --</option>
              <option *ngFor="let prog of programmes" [value]="prog._id">
                {{ prog.programmeCode }} — {{ prog.programmeName }}
              </option>
            </select>
          </div>

          <div class="selector-group">
            <label for="sessionSelect">Academic Session:</label>
            <select
              id="sessionSelect"
              [(ngModel)]="selectedSessionName"
              (change)="onProgrammeOrSessionChange()"
              [disabled]="isLoading"
            >
              <option value="" disabled>-- Select Session --</option>
              <option *ngFor="let s of sessions" [value]="s.sessionName">
                {{ s.sessionName }} {{ s.status === 'Active' ? '(Active)' : '' }}
              </option>
            </select>
          </div>

          <button class="btn-refresh" (click)="onProgrammeOrSessionChange()" [disabled]="isLoading || !selectedProgrammeId">
            {{ isLoading ? 'Loading...' : 'Refresh' }}
          </button>
        </div>
      </div>

      <!-- Notification Alerts -->
      <div *ngIf="errorMessage" class="alert alert-error">
        <span>&#9888;</span> {{ errorMessage }}
      </div>
      <div *ngIf="successMessage" class="alert alert-success">
        <span>&#10003;</span> {{ successMessage }}
      </div>

      <!-- Sub Navigation Tabs -->
      <div class="sub-nav-tabs" *ngIf="selectedProgrammeId">
        <button
          type="button"
          class="sub-tab-btn"
          [class.active]="activeSubTab === 'config'"
          (click)="setSubTab('config')"
        >
          <span>&#9881;</span> Scoring Configuration
        </button>
        <button
          type="button"
          class="sub-tab-btn"
          [class.active]="activeSubTab === 'merit-list'"
          (click)="setSubTab('merit-list')"
        >
          <span>&#128220;</span> Merit List & Cutoffs
        </button>
        <button
          type="button"
          class="sub-tab-btn"
          [class.active]="activeSubTab === 'allocation'"
          (click)="setSubTab('allocation')"
        >
          <span>&#127891;</span> Seat Allocation & Publishing
        </button>
      </div>

      <!-- SUB-TAB 1: Scoring Configuration -->
      <div *ngIf="activeSubTab === 'config' && selectedProgrammeId" class="tab-card">
        <div class="section-title">
          <h4>Merit Scoring & Normalization Configuration</h4>
          <span class="version-badge" *ngIf="meritConfig.version">Version #{{ meritConfig.version }}</span>
        </div>

        <form (ngSubmit)="saveConfiguration()" class="config-form">
          <div class="form-grid">
            <div class="form-group">
              <label for="c12Weight">Class 12 Marks Weightage (%)</label>
              <input
                id="c12Weight"
                type="number"
                min="0"
                max="100"
                [(ngModel)]="meritConfig.class12Weightage"
                name="class12Weightage"
                required
              />
              <small>Default: 60%</small>
            </div>

            <div class="form-group">
              <label for="entranceWeight">Entrance Exam Score / Rank Weightage (%)</label>
              <input
                id="entranceWeight"
                type="number"
                min="0"
                max="100"
                [(ngModel)]="meritConfig.entranceExamWeightage"
                name="entranceExamWeightage"
                required
              />
              <small>Default: 40%</small>
            </div>

            <div class="form-group">
              <label>Total Weightage Check</label>
              <div
                class="weightage-indicator"
                [class.valid]="totalWeightage === 100"
                [class.invalid]="totalWeightage !== 100"
              >
                <strong>{{ totalWeightage }}%</strong>
                <span>{{ totalWeightage === 100 ? 'Valid (100%)' : 'Must equal 100%' }}</span>
              </div>
            </div>

            <div class="form-group">
              <label for="normMethod">Entrance Normalization Method</label>
              <select
                id="normMethod"
                [(ngModel)]="meritConfig.normalizationMethod"
                name="normalizationMethod"
              >
                <option value="Rank-Based">Rank-Based (Lower numeric rank = higher score)</option>
                <option value="Score-Based">Score-Based (Linear percentage of max marks)</option>
                <option value="Percentile">Percentile (Direct 0-100 scale)</option>
              </select>
            </div>

            <div class="form-group" *ngIf="meritConfig.normalizationMethod === 'Rank-Based'">
              <label for="maxRank">Assumed Maximum Entrance Rank</label>
              <input
                id="maxRank"
                type="number"
                min="1000"
                [(ngModel)]="meritConfig.maxEntranceRank"
                name="maxEntranceRank"
              />
              <small>Formula: (1 - (Rank - 1) / MaxRank) * 100</small>
            </div>

            <div class="form-group" *ngIf="meritConfig.normalizationMethod === 'Score-Based'">
              <label for="maxScore">Maximum Entrance Exam Score</label>
              <input
                id="maxScore"
                type="number"
                min="1"
                [(ngModel)]="meritConfig.maxEntranceScore"
                name="maxEntranceScore"
              />
            </div>

            <div class="form-group">
              <label for="unfilledRule">Unfilled Reserved Quota Handling</label>
              <select
                id="unfilledRule"
                [(ngModel)]="meritConfig.unfilledSeatRule"
                name="unfilledSeatRule"
              >
                <option value="Keep Vacant">Keep Vacant (Leave remaining quota seats unfilled)</option>
                <option value="Convert to General">Convert to General (Reallocate to next overall rank)</option>
              </select>
            </div>
          </div>

          <div class="form-actions">
            <button
              type="submit"
              class="btn-primary"
              [disabled]="isSavingConfig || totalWeightage !== 100"
            >
              {{ isSavingConfig ? 'Saving...' : 'Save Configuration' }}
            </button>
          </div>
        </form>
      </div>

      <!-- SUB-TAB 2: Merit List & Cutoffs -->
      <div *ngIf="activeSubTab === 'merit-list' && selectedProgrammeId" class="tab-card">
        <div class="action-bar">
          <div class="status-summary">
            <span class="status-label">Current Merit List Status:</span>
            <span
              class="badge"
              [ngClass]="currentMeritList?.status?.toLowerCase() || 'none'"
            >
              {{ currentMeritList ? currentMeritList.status : 'Not Generated' }}
            </span>
            <span class="meta-text" *ngIf="currentMeritList?.version">
              Version #{{ currentMeritList.version }}
              <span *ngIf="currentMeritList?.roundLabel"> — {{ currentMeritList.roundLabel }}</span>
            </span>
            <span class="meta-text" *ngIf="currentMeritList?.publishedAt">
              Published on {{ currentMeritList?.publishedAt | date: 'medium' }}
            </span>
          </div>

          <div class="action-buttons">
            <button
              type="button"
              class="btn-secondary"
              (click)="generateMeritList()"
              [disabled]="isGeneratingList"
            >
              {{ isGeneratingList ? 'Computing...' : 'Generate / Regenerate Draft' }}
            </button>

            <button
              type="button"
              class="btn-publish"
              (click)="publishMeritList()"
              [disabled]="!currentMeritList || currentMeritList.status === 'Published' || isPublishingList"
            >
              {{ isPublishingList ? 'Publishing...' : 'Publish Merit List' }}
            </button>
          </div>
        </div>

        <!-- Cutoffs KPI Strip -->
        <div class="kpi-grid" *ngIf="currentMeritList">
          <div class="kpi-card">
            <span class="kpi-value">{{ currentMeritList.cutoffs?.highestScore | number: '1.2-2' }}</span>
            <span class="kpi-label">Highest Composite Score</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-value">{{ currentMeritList.cutoffs?.lowestShortlistedScore | number: '1.2-2' }}</span>
            <span class="kpi-label">Lowest Shortlisted Cutoff</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-value highlight">{{ currentMeritList.cutoffs?.totalEligible || 0 }}</span>
            <span class="kpi-label">Eligible Candidates</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-value warning">{{ currentMeritList.cutoffs?.totalPendingDocs || 0 }}</span>
            <span class="kpi-label">Pending Verification</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-value danger">{{ currentMeritList.cutoffs?.totalIneligible || 0 }}</span>
            <span class="kpi-label">Ineligible Candidates</span>
          </div>
        </div>

        <!-- Category Cutoff Cards -->
        <div class="category-cutoffs-section" *ngIf="currentMeritList?.cutoffs?.categoryCutoffs?.length">
          <h5>Category-Wise Cutoff Breakdown</h5>
          <div class="cat-cutoffs-grid">
            <div class="cat-cutoff-pill" *ngFor="let cat of currentMeritList?.cutoffs?.categoryCutoffs">
              <span class="cat-name">{{ cat.category }}</span>
              <div class="cat-stat">
                <span>Cutoff: <strong>{{ cat.lowestScore | number: '1.2-2' }}</strong></span>
                <span>Max: <strong>{{ cat.highestScore | number: '1.2-2' }}</strong></span>
                <span>Eligible: <strong>{{ cat.eligibleApplicants }}</strong></span>
              </div>
            </div>
          </div>
        </div>

        <!-- Filter / Search Table -->
        <div class="table-container" *ngIf="currentMeritList?.entries?.length">
          <div class="table-filter-bar">
            <input
              type="text"
              placeholder="Search candidate name or application ID..."
              [(ngModel)]="meritSearchText"
            />
            <select [(ngModel)]="meritCategoryFilter">
              <option value="">All Categories</option>
              <option value="General">General</option>
              <option value="OBC">OBC</option>
              <option value="SC">SC</option>
              <option value="ST">ST</option>
              <option value="EWS">EWS</option>
            </select>
            <select [(ngModel)]="meritStatusFilter">
              <option value="">All Eligibility</option>
              <option value="Eligible">Eligible</option>
              <option value="Eligible (Pending Documents)">Eligible (Pending Docs)</option>
              <option value="Ineligible">Ineligible</option>
            </select>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th>Merit Rank</th>
                <th>Cat. Rank</th>
                <th>App ID</th>
                <th>Candidate Name</th>
                <th>Category</th>
                <th>12th %</th>
                <th>Entrance Score</th>
                <th>Composite</th>
                <th>Eligibility</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              <tr
                *ngFor="let entry of filteredMeritEntries"
                [class.ineligible-row]="entry.eligibilityStatus === 'Ineligible'"
              >
                <td>
                  <strong class="rank-badge" *ngIf="entry.meritRank > 0">#{{ entry.meritRank }}</strong>
                  <span *ngIf="entry.meritRank === 0" class="muted">—</span>
                </td>
                <td>
                  <span *ngIf="entry.categoryRank > 0">#{{ entry.categoryRank }}</span>
                  <span *ngIf="entry.categoryRank === 0" class="muted">—</span>
                </td>
                <td><strong>{{ entry.applicationId }}</strong></td>
                <td>{{ entry.candidateName }}</td>
                <td><span class="cat-tag">{{ entry.category }}</span></td>
                <td>{{ entry.class12Percentage }}%</td>
                <td>{{ entry.rawEntranceScore || '—' }}</td>
                <td><strong>{{ entry.compositeScore | number: '1.2-2' }}</strong></td>
                <td>
                  <span
                    class="eligibility-badge"
                    [ngClass]="getEligibilityClass(entry.eligibilityStatus)"
                  >
                    {{ entry.eligibilityStatus }}
                  </span>
                </td>
                <td class="remarks-cell">{{ entry.eligibilityRemarks || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div *ngIf="!currentMeritList && !isGeneratingList" class="empty-state">
          <p>No merit list has been generated yet for this programme and session.</p>
          <button class="btn-primary" (click)="generateMeritList()">Generate Draft Merit List</button>
        </div>
      </div>

      <!-- SUB-TAB 3: Seat Allocation & Publishing -->
      <div *ngIf="activeSubTab === 'allocation' && selectedProgrammeId" class="tab-card">
        <div class="action-bar">
          <div class="status-summary">
            <span class="status-label">Seat Allocation Status:</span>
            <span
              class="badge"
              [ngClass]="currentAllocation?.status?.toLowerCase() || 'none'"
            >
              {{ currentAllocation ? currentAllocation.status : 'Not Generated' }}
            </span>
            <span class="meta-text" *ngIf="currentAllocation?.publishedAt">
              Published on {{ currentAllocation?.publishedAt | date: 'medium' }}
            </span>
          </div>

          <div class="action-buttons">
            <button
              type="button"
              class="btn-secondary"
              (click)="generateSeatAllocation()"
              [disabled]="isAllocatingSeats || !currentMeritList"
            >
              {{ isAllocatingSeats ? 'Allocating...' : 'Generate Seat Allocation' }}
            </button>

            <button
              type="button"
              class="btn-approve"
              (click)="approveSeatAllocation()"
              [disabled]="!currentAllocation || currentAllocation.status !== 'Draft' || isApproving"
            >
              {{ isApproving ? 'Approving...' : 'Approve Allocation' }}
            </button>

            <button
              type="button"
              class="btn-publish"
              (click)="publishSeatAllocation()"
              [disabled]="!currentAllocation || currentAllocation.status !== 'Approved' || isPublishingAlloc"
            >
              {{ isPublishingAlloc ? 'Publishing...' : 'Publish to Applicants' }}
            </button>
          </div>
        </div>

        <!-- Quota Summary Strip -->
        <div class="allocation-summary-grid" *ngIf="currentAllocation">
          <div class="quota-kpi">
            <span class="quota-val">{{ currentAllocation.totalSeats }}</span>
            <span class="quota-lbl">Total Capacity</span>
          </div>
          <div class="quota-kpi">
            <span class="quota-val success">{{ currentAllocation.allocatedSeats }}</span>
            <span class="quota-lbl">Allocated Seats</span>
          </div>
          <div class="quota-kpi">
            <span class="quota-val muted">{{ currentAllocation.remainingSeats }}</span>
            <span class="quota-lbl">Remaining / Vacant</span>
          </div>
          <div class="quota-kpi">
            <span class="quota-val">{{ currentAllocation.unfilledSeatRule }}</span>
            <span class="quota-lbl">Unfilled Quota Rule</span>
          </div>
        </div>

        <!-- Category Quota Breakdown Cards -->
        <div class="category-breakdown-section" *ngIf="currentAllocation?.categorySummary?.length">
          <h5>Category Quota Distribution</h5>
          <div class="cat-summary-grid">
            <div class="cat-summary-card" *ngFor="let s of currentAllocation?.categorySummary">
              <div class="cat-card-header">
                <strong>{{ s.category }}</strong>
                <span>{{ s.allocatedSeats }} / {{ s.totalSeats }} Seats</span>
              </div>
              <div class="progress-track">
                <div
                  class="progress-fill"
                  [style.width.%]="s.totalSeats > 0 ? (s.allocatedSeats / s.totalSeats) * 100 : 0"
                ></div>
              </div>
              <small>{{ s.remainingSeats }} vacant</small>
            </div>
          </div>
        </div>

        <!-- Allocation Results Table -->
        <div class="table-container" *ngIf="currentAllocation?.allocations?.length">
          <h5>Candidate Seat Allocations</h5>
          <table class="data-table">
            <thead>
              <tr>
                <th>Seat #</th>
                <th>Candidate Name</th>
                <th>App ID</th>
                <th>Merit Rank</th>
                <th>Applied Category</th>
                <th>Allocated Category</th>
                <th>Score</th>
                <th>Status</th>
                <th>Allocation Reason</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let alloc of currentAllocation?.allocations">
                <td>
                  <strong *ngIf="alloc.seatNumber">#{{ alloc.seatNumber }}</strong>
                  <span *ngIf="!alloc.seatNumber" class="muted">—</span>
                </td>
                <td><strong>{{ alloc.candidateName }}</strong></td>
                <td>{{ alloc.applicationId }}</td>
                <td>#{{ alloc.meritRank }}</td>
                <td><span class="cat-tag">{{ alloc.appliedCategory }}</span></td>
                <td>
                  <strong *ngIf="alloc.allocatedCategory">{{ alloc.allocatedCategory }}</strong>
                  <span *ngIf="!alloc.allocatedCategory" class="muted">—</span>
                </td>
                <td>{{ alloc.compositeScore | number: '1.2-2' }}</td>
                <td>
                  <span
                    class="alloc-badge"
                    [ngClass]="alloc.allocationStatus.toLowerCase()"
                  >
                    {{ alloc.allocationStatus }}
                  </span>
                </td>
                <td class="remarks-cell">{{ alloc.allocationReason }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Audit Trail -->
        <div class="audit-history-section" *ngIf="currentAllocation?.history?.length">
          <h5>Allocation Audit Trail</h5>
          <div class="history-list">
            <div class="history-item" *ngFor="let h of currentAllocation?.history">
              <span class="history-badge" [ngClass]="h.action.toLowerCase()">{{ h.action }}</span>
              <span class="history-time">{{ h.timestamp | date: 'medium' }}</span>
              <span class="history-remarks" *ngIf="h.remarks">— "{{ h.remarks }}"</span>
            </div>
          </div>
        </div>

        <div *ngIf="!currentAllocation && !isAllocatingSeats" class="empty-state">
          <p>No seat allocation has been generated yet for this programme.</p>
          <button class="btn-primary" (click)="generateSeatAllocation()" [disabled]="!currentMeritList">
            Generate Seat Allocation
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .merit-management-root {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .merit-header-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.25rem 1.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    .merit-header-title h3 {
      margin: 0 0 0.35rem;
      color: #0f2b48;
      font-size: 1.25rem;
    }
    .merit-header-title p {
      margin: 0 0 1rem;
      color: #64748b;
      font-size: 0.9rem;
    }
    .selectors-row {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 1rem;
    }
    .selector-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      flex: 1;
      min-width: 240px;
    }
    .selector-group label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #334155;
    }
    .selector-group select {
      padding: 0.55rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 0.88rem;
      background: #f8fafc;
    }
    .btn-refresh {
      background: #0f2b48;
      color: #ffffff;
      border: none;
      padding: 0.55rem 1rem;
      border-radius: 4px;
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      height: 38px;
    }
    .sub-nav-tabs {
      display: flex;
      gap: 0.5rem;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 0.25rem;
    }
    .sub-tab-btn {
      background: none;
      border: none;
      padding: 0.65rem 1.1rem;
      font-size: 0.9rem;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      border-radius: 6px 6px 0 0;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.2s;
    }
    .sub-tab-btn.active {
      color: #0f2b48;
      background: #ffffff;
      border-bottom: 3px solid #0f2b48;
    }
    .tab-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    .section-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
      border-bottom: 1px solid #edf2f7;
      padding-bottom: 0.75rem;
    }
    .section-title h4 {
      margin: 0;
      color: #0f2b48;
      font-size: 1.1rem;
    }
    .version-badge {
      background: #f1f5f9;
      color: #475569;
      padding: 0.25rem 0.6rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .config-form .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.25rem;
    }
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
    .form-group input,
    .form-group select {
      padding: 0.55rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 0.88rem;
    }
    .form-group small {
      color: #64748b;
      font-size: 0.75rem;
    }
    .weightage-indicator {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.55rem 0.75rem;
      border-radius: 4px;
      font-size: 0.85rem;
    }
    .weightage-indicator.valid {
      background: #dcfce7;
      color: #166534;
      border: 1px solid #86efac;
    }
    .weightage-indicator.invalid {
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fca5a5;
    }
    .form-actions {
      margin-top: 1.5rem;
      display: flex;
      justify-content: flex-end;
    }
    .btn-primary {
      background: #0f2b48;
      color: #ffffff;
      border: none;
      padding: 0.6rem 1.25rem;
      border-radius: 4px;
      font-weight: 600;
      font-size: 0.88rem;
      cursor: pointer;
    }
    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .action-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #edf2f7;
    }
    .status-summary {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .status-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: #475569;
    }
    .action-buttons {
      display: flex;
      gap: 0.75rem;
    }
    .btn-secondary {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      padding: 0.55rem 1rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 600;
      color: #334155;
      cursor: pointer;
    }
    .btn-approve {
      background: #0284c7;
      color: #ffffff;
      border: none;
      padding: 0.55rem 1rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-publish {
      background: #16a34a;
      color: #ffffff;
      border: none;
      padding: 0.55rem 1rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-publish:disabled,
    .btn-approve:disabled,
    .btn-secondary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .badge {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.25rem 0.6rem;
      border-radius: 12px;
      text-transform: uppercase;
    }
    .badge.draft { background: #fef3c7; color: #92400e; }
    .badge.approved { background: #e0f2fe; color: #0369a1; }
    .badge.published { background: #dcfce7; color: #166534; }
    .badge.archived { background: #f1f5f9; color: #64748b; }
    .badge.none { background: #f1f5f9; color: #94a3b8; }
    .meta-text {
      font-size: 0.8rem;
      color: #64748b;
    }
    .kpi-grid,
    .allocation-summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .kpi-card,
    .quota-kpi {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 1rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .kpi-value,
    .quota-val {
      font-size: 1.5rem;
      font-weight: 700;
      color: #0f2b48;
    }
    .kpi-value.highlight,
    .quota-val.success { color: #16a34a; }
    .kpi-value.warning { color: #d97706; }
    .kpi-value.danger { color: #dc2626; }
    .kpi-label,
    .quota-lbl {
      font-size: 0.78rem;
      color: #64748b;
      font-weight: 600;
    }
    .category-cutoffs-section,
    .category-breakdown-section {
      margin-bottom: 1.5rem;
    }
    .category-cutoffs-section h5,
    .category-breakdown-section h5 {
      margin: 0 0 0.75rem;
      color: #0f2b48;
      font-size: 0.95rem;
    }
    .cat-cutoffs-grid,
    .cat-summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0.75rem;
    }
    .cat-cutoff-pill {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 0.75rem;
    }
    .cat-name {
      font-size: 0.85rem;
      font-weight: 700;
      color: #0f2b48;
      display: block;
      margin-bottom: 0.35rem;
    }
    .cat-stat {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      font-size: 0.78rem;
      color: #64748b;
    }
    .cat-summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 0.75rem;
    }
    .cat-card-header {
      display: flex;
      justify-content: space-between;
      font-size: 0.82rem;
      margin-bottom: 0.4rem;
    }
    .progress-track {
      background: #e2e8f0;
      border-radius: 4px;
      height: 6px;
      overflow: hidden;
      margin-bottom: 0.35rem;
    }
    .progress-fill {
      background: #0f2b48;
      height: 100%;
    }
    .table-container {
      overflow-x: auto;
      margin-top: 1rem;
    }
    .table-filter-bar {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }
    .table-filter-bar input {
      flex: 1;
      padding: 0.45rem 0.65rem;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 0.85rem;
    }
    .table-filter-bar select {
      padding: 0.45rem 0.65rem;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 0.85rem;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    .data-table th {
      background: #f8fafc;
      padding: 0.65rem 0.75rem;
      text-align: left;
      font-weight: 600;
      color: #475569;
      border-bottom: 1px solid #e2e8f0;
    }
    .data-table td {
      padding: 0.65rem 0.75rem;
      border-bottom: 1px solid #edf2f7;
      color: #1e293b;
    }
    .ineligible-row {
      background: #fff5f5;
      color: #991b1b;
    }
    .rank-badge {
      background: #0f2b48;
      color: #ffffff;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      font-size: 0.75rem;
    }
    .cat-tag {
      background: #f1f5f9;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .eligibility-badge {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 10px;
    }
    .eligibility-badge.eligible { background: #dcfce7; color: #166534; }
    .eligibility-badge.pending { background: #fef3c7; color: #92400e; }
    .eligibility-badge.ineligible { background: #fee2e2; color: #991b1b; }
    .alloc-badge {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 10px;
    }
    .alloc-badge.allocated { background: #dcfce7; color: #166534; }
    .alloc-badge.waitlisted { background: #fef3c7; color: #92400e; }
    .alloc-badge.ineligible { background: #fee2e2; color: #991b1b; }
    .remarks-cell {
      max-width: 200px;
      font-size: 0.75rem;
      color: #64748b;
    }
    .audit-history-section {
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid #edf2f7;
    }
    .history-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .history-item {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      font-size: 0.8rem;
    }
    .history-badge {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .history-badge.generated { background: #e0f2fe; color: #0369a1; }
    .history-badge.approved { background: #fef3c7; color: #92400e; }
    .history-badge.published { background: #dcfce7; color: #166534; }
    .history-time { color: #64748b; }
    .history-remarks { color: #334155; font-style: italic; }
    .empty-state {
      text-align: center;
      padding: 3rem 1.5rem;
      color: #64748b;
    }
    .alert {
      padding: 0.75rem 1rem;
      border-radius: 6px;
      font-size: 0.88rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .alert-error {
      background: #fef2f2;
      border: 1px solid #fca5a5;
      color: #991b1b;
    }
    .alert-success {
      background: #f0fdf4;
      border: 1px solid #86efac;
      color: #166534;
    }
    .muted { color: #94a3b8; }
  `]
})
export class AdminMeritComponent implements OnInit {
  private meritService = inject(MeritService);
  private adminService = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);

  public programmes: Programme[] = [];
  public sessions: AcademicSession[] = [];

  public selectedProgrammeId = '';
  public selectedSessionName = '';

  public activeSubTab: 'config' | 'merit-list' | 'allocation' = 'config';

  // Loading states
  public isLoading = false;
  public isSavingConfig = false;
  public isGeneratingList = false;
  public isPublishingList = false;
  public isAllocatingSeats = false;
  public isApproving = false;
  public isPublishingAlloc = false;

  // Feedback messages
  public errorMessage = '';
  public successMessage = '';

  // Configuration State
  public meritConfig: Partial<MeritConfiguration> = {
    class12Weightage: 60,
    entranceExamWeightage: 40,
    normalizationMethod: 'Rank-Based',
    maxEntranceRank: 50000,
    maxEntranceScore: 100,
    unfilledSeatRule: 'Keep Vacant'
  };

  // Merit List State
  public currentMeritList: MeritList | null = null;
  public meritSearchText = '';
  public meritCategoryFilter = '';
  public meritStatusFilter = '';

  // Allocation State
  public currentAllocation: SeatAllocation | null = null;

  ngOnInit(): void {
    this.loadProgrammesAndSessions();
  }

  get totalWeightage(): number {
    return (Number(this.meritConfig.class12Weightage) || 0) + (Number(this.meritConfig.entranceExamWeightage) || 0);
  }

  setSubTab(tab: 'config' | 'merit-list' | 'allocation'): void {
    this.activeSubTab = tab;
    this.clearAlerts();
    this.cdr.markForCheck();
  }

  loadProgrammesAndSessions(): void {
    this.isLoading = true;
    this.adminService.getProgrammes({ limit: 100 }).subscribe({
      next: (res: any) => {
        this.programmes = res.data?.programmes || res.data || [];
        if (this.programmes.length > 0 && !this.selectedProgrammeId) {
          this.selectedProgrammeId = this.programmes[0]._id;
        }

        this.adminService.getSessions().subscribe({
          next: (sessRes: any) => {
            this.sessions = sessRes.data || [];
            const active = this.sessions.find((s) => s.status === 'Active') || this.sessions[0];
            if (active && !this.selectedSessionName) {
              this.selectedSessionName = active.sessionName;
            }
            this.isLoading = false;
            if (this.selectedProgrammeId && this.selectedSessionName) {
              this.onProgrammeOrSessionChange();
            }
            this.cdr.markForCheck();
          },
          error: (err: any) => {
            this.isLoading = false;
            this.errorMessage = 'Failed to load admission sessions.';
            this.cdr.markForCheck();
          }
        });
      },
      error: (err: any) => {
        this.isLoading = false;
        this.errorMessage = 'Failed to load programmes.';
        this.cdr.markForCheck();
      }
    });
  }

  onProgrammeOrSessionChange(): void {
    if (!this.selectedProgrammeId || !this.selectedSessionName) return;

    this.clearAlerts();
    this.isLoading = true;

    // 1. Load Config
    this.meritService.getConfiguration(this.selectedProgrammeId, this.selectedSessionName).subscribe({
      next: (res) => {
        if (res.data) {
          this.meritConfig = res.data;
        }
        this.cdr.markForCheck();
      },
      error: () => {}
    });

    // 2. Load Merit Lists
    this.meritService.getMeritLists(this.selectedProgrammeId, this.selectedSessionName).subscribe({
      next: (res) => {
        const lists = res.data || [];
        // Prefer Draft (actionable) over Published for admin view
        this.currentMeritList = lists.find((l) => l.status === 'Draft') || lists.find((l) => l.status === 'Published') || lists[0] || null;
        this.cdr.markForCheck();
      },
      error: () => {}
    });

    // 3. Load Seat Allocations
    this.meritService.getSeatAllocations(this.selectedProgrammeId, this.selectedSessionName).subscribe({
      next: (res) => {
        const allocs = res.data || [];
        this.currentAllocation = allocs.find((a) => a.status === 'Published') || allocs[0] || null;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  saveConfiguration(): void {
    if (this.totalWeightage !== 100) {
      this.errorMessage = 'Weightages must sum to exactly 100%.';
      return;
    }

    this.isSavingConfig = true;
    this.clearAlerts();

    const payload = {
      ...this.meritConfig,
      programmeId: this.selectedProgrammeId,
      academicSession: this.selectedSessionName
    };

    this.meritService.saveConfiguration(payload as any).subscribe({
      next: (res) => {
        this.isSavingConfig = false;
        this.meritConfig = res.data;
        this.successMessage = `Configuration saved successfully (Version #${res.data.version}).`;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isSavingConfig = false;
        this.errorMessage = err.error?.message || 'Failed to save configuration.';
        this.cdr.markForCheck();
      }
    });
  }

  generateMeritList(): void {
    this.isGeneratingList = true;
    this.clearAlerts();

    this.meritService.generateMeritList(this.selectedProgrammeId, this.selectedSessionName).subscribe({
      next: (res) => {
        this.isGeneratingList = false;
        this.currentMeritList = res.data;
        this.successMessage = 'Draft merit list generated successfully.';
        this.activeSubTab = 'merit-list';
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isGeneratingList = false;
        this.errorMessage = err.error?.message || 'Failed to generate merit list.';
        this.cdr.markForCheck();
      }
    });
  }

  publishMeritList(): void {
    if (!this.currentMeritList?._id) return;

    if (!confirm('Are you sure you want to publish this merit list? Published scores and ranks will be visible to applicants.')) {
      return;
    }

    this.isPublishingList = true;
    this.clearAlerts();

    this.meritService.publishMeritList(this.currentMeritList._id).subscribe({
      next: (res) => {
        this.isPublishingList = false;
        this.currentMeritList = res.data;
        this.successMessage = 'Merit list has been published successfully!';
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isPublishingList = false;
        this.errorMessage = err.error?.message || 'Failed to publish merit list.';
        this.cdr.markForCheck();
      }
    });
  }

  generateSeatAllocation(): void {
    if (!this.currentMeritList) {
      this.errorMessage = 'Please generate and verify a merit list first.';
      return;
    }

    this.isAllocatingSeats = true;
    this.clearAlerts();

    this.meritService
      .generateSeatAllocation({
        programmeId: this.selectedProgrammeId,
        academicSession: this.selectedSessionName,
        meritListId: this.currentMeritList._id,
        unfilledSeatRule: this.meritConfig.unfilledSeatRule as any
      })
      .subscribe({
        next: (res) => {
          this.isAllocatingSeats = false;
          this.currentAllocation = res.data;
          this.successMessage = 'Draft seat allocation computed successfully.';
          this.activeSubTab = 'allocation';
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isAllocatingSeats = false;
          this.errorMessage = err.error?.message || 'Failed to generate seat allocation.';
          this.cdr.markForCheck();
        }
      });
  }

  approveSeatAllocation(): void {
    if (!this.currentAllocation?._id) return;

    const remarks = prompt('Enter approval remarks (optional):', 'Approved category quota allocation.');
    if (remarks === null) return;

    this.isApproving = true;
    this.clearAlerts();

    this.meritService.approveSeatAllocation(this.currentAllocation._id, remarks).subscribe({
      next: (res) => {
        this.isApproving = false;
        this.currentAllocation = res.data;
        this.successMessage = 'Seat allocation approved. Ready for public portal publishing.';
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isApproving = false;
        this.errorMessage = err.error?.message || 'Failed to approve seat allocation.';
        this.cdr.markForCheck();
      }
    });
  }

  publishSeatAllocation(): void {
    if (!this.currentAllocation?._id) return;

    if (!confirm('Are you sure you want to publish seat allocations? Allocated seats and reasons will be made visible on applicant dashboards.')) {
      return;
    }

    const remarks = prompt('Enter publishing remarks (optional):', 'Published round 1 seat allocations.');
    if (remarks === null) return;

    this.isPublishingAlloc = true;
    this.clearAlerts();

    this.meritService.publishSeatAllocation(this.currentAllocation._id, remarks).subscribe({
      next: (res) => {
        this.isPublishingAlloc = false;
        this.currentAllocation = res.data;
        this.successMessage = 'Seat allocation published successfully to applicant portal!';
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isPublishingAlloc = false;
        this.errorMessage = err.error?.message || 'Failed to publish seat allocation.';
        this.cdr.markForCheck();
      }
    });
  }

  get filteredMeritEntries(): MeritListEntry[] {
    if (!this.currentMeritList?.entries) return [];

    return this.currentMeritList.entries.filter((entry) => {
      const matchSearch =
        !this.meritSearchText ||
        entry.candidateName?.toLowerCase().includes(this.meritSearchText.toLowerCase()) ||
        entry.applicationId?.toLowerCase().includes(this.meritSearchText.toLowerCase());

      const matchCat = !this.meritCategoryFilter || entry.category === this.meritCategoryFilter;
      const matchStatus = !this.meritStatusFilter || entry.eligibilityStatus === this.meritStatusFilter;

      return matchSearch && matchCat && matchStatus;
    });
  }

  getEligibilityClass(status: string): string {
    switch (status) {
      case 'Eligible':
        return 'eligible';
      case 'Eligible (Pending Documents)':
        return 'pending';
      default:
        return 'ineligible';
    }
  }

  private clearAlerts(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }
}
