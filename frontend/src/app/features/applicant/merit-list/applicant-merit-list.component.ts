import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MeritService } from '../../../core/services/merit.service';
import {
  ApplicantPublishedMeritListResponse,
  PublishedMeritListCandidate
} from '../../../core/models/merit.model';

@Component({
  selector: 'app-applicant-merit-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="merit-page-container">
      <!-- Breadcrumb Navigation -->
      <nav class="breadcrumb-nav">
        <a routerLink="/applicant/dashboard">&larr; Back to Dashboard</a>
        <span class="sep">/</span>
        <span class="current">Published Merit List</span>
      </nav>

      <!-- Loading State -->
      <div *ngIf="isLoading" class="state-card loading">
        <div class="spinner"></div>
        <p>Loading official published merit list...</p>
      </div>

      <!-- Error State -->
      <div *ngIf="errorMessage && !isLoading" class="alert-box error">
        <span>&#9888; {{ errorMessage }}</span>
        <button type="button" class="btn-retry-inline" (click)="fetchPublishedList()">
          Retry
        </button>
      </div>

      <!-- Content -->
      <div *ngIf="!isLoading && !errorMessage">
        <!-- Unpublished / Empty State -->
        <div *ngIf="!publishedData?.hasPublishedList" class="state-card empty">
          <div class="empty-icon">&#128220;</div>
          <h3>Merit List Not Published Yet</h3>
          <p>
            {{ publishedData?.message || 'No merit list has been published for your programme and academic session yet.' }}
          </p>
          <div class="empty-hint">
            The Institute of Engineering & Management admission committee publishes merit rankings after completing Class 12 and entrance examination score normalizations. Please check back later.
          </div>
          <a routerLink="/applicant/dashboard" class="btn-primary-action">
            Return to Admission Dashboard
          </a>
        </div>

        <!-- Official Published Merit List -->
        <div *ngIf="publishedData?.hasPublishedList">
          <!-- Official Banner Header -->
          <div class="merit-header-card">
            <div class="header-main">
              <span class="seal-badge">&#127891; Official Merit Publication</span>
              <h2>{{ publishedData?.programme?.programmeName }}</h2>
              <p class="programme-meta">
                <span>{{ publishedData?.programme?.degree }}</span> &bull;
                <span>{{ publishedData?.programme?.department }}</span> &bull;
                <span>Session: <strong>{{ publishedData?.academicSession }}</strong></span> &bull;
                <span class="round-badge">{{ publishedData?.roundLabel || 'Round 1' }} (Version #{{ publishedData?.version }})</span>
              </p>
            </div>
            <div class="published-date-box" *ngIf="publishedData?.publishedAt">
              <span class="date-lbl">Official Publication Date</span>
              <span class="date-val">{{ publishedData?.publishedAt | date: 'medium' }}</span>
              <span class="verified-tag">&#10003; Committee Verified</span>
            </div>
          </div>

          <!-- Logged-in Applicant Highlight Card -->
          <div class="my-result-card" *ngIf="publishedData?.myEntry as me">
            <div class="my-result-header">
              <div class="my-title">
                <span class="star-icon">&#11088;</span>
                <div>
                  <h4>Your Official Merit Standing</h4>
                  <small>{{ me.candidateName }} &bull; Application ID: <strong>{{ me.applicationId }}</strong></small>
                </div>
              </div>
              <div class="my-status">
                <span class="status-pill" [ngClass]="me.allocationStatus.toLowerCase()">
                  {{ me.allocationStatus }}
                </span>
              </div>
            </div>

            <div class="my-kpi-grid">
              <div class="my-kpi-box primary">
                <span class="kpi-lbl">Overall Merit Rank</span>
                <span class="kpi-val" *ngIf="me.meritRank > 0">#{{ me.meritRank }}</span>
                <span class="kpi-val muted" *ngIf="me.meritRank === 0">—</span>
              </div>
              <div class="my-kpi-box">
                <span class="kpi-lbl">Category Rank ({{ me.category }})</span>
                <span class="kpi-val" *ngIf="me.categoryRank > 0">#{{ me.categoryRank }}</span>
                <span class="kpi-val muted" *ngIf="me.categoryRank === 0">—</span>
              </div>
              <div class="my-kpi-box">
                <span class="kpi-lbl">Composite Score</span>
                <span class="kpi-val highlight">{{ me.compositeScore | number: '1.2-2' }}</span>
              </div>
              <div class="my-kpi-box" *ngIf="me.allocatedCategory">
                <span class="kpi-lbl">Allocated Quota</span>
                <span class="kpi-val">{{ me.allocatedCategory }}</span>
              </div>
              <div class="my-kpi-box" *ngIf="me.seatNumber">
                <span class="kpi-lbl">Allocated Seat</span>
                <span class="kpi-val">Seat #{{ me.seatNumber }}</span>
              </div>
            </div>
          </div>

          <!-- Programme Cutoffs Overview -->
          <div class="cutoffs-overview-card" *ngIf="publishedData?.cutoffs">
            <div class="cutoffs-title">
              <h5>Published Programme Cutoff Statistics</h5>
            </div>
            <div class="cutoffs-grid">
              <div class="cutoff-stat">
                <span class="stat-num">{{ publishedData?.cutoffs?.highestScore | number: '1.2-2' }}</span>
                <span class="stat-lbl">Highest Composite Score</span>
              </div>
              <div class="cutoff-stat">
                <span class="stat-num">{{ publishedData?.cutoffs?.lowestShortlistedScore | number: '1.2-2' }}</span>
                <span class="stat-lbl">Lowest Shortlisted Score</span>
              </div>
              <div class="cutoff-stat">
                <span class="stat-num success">{{ publishedData?.cutoffs?.totalEligible || 0 }}</span>
                <span class="stat-lbl">Eligible Candidates</span>
              </div>
            </div>

            <!-- Category Cutoff Badges -->
            <div class="cat-cutoffs-row" *ngIf="publishedData?.cutoffs?.categoryCutoffs?.length">
              <div class="cat-pill" *ngFor="let cat of publishedData?.cutoffs?.categoryCutoffs">
                <strong>{{ cat.category }}:</strong>
                <span>Cutoff: {{ cat.lowestScore | number: '1.2-2' }}</span>
                <small>({{ cat.eligibleApplicants }} eligible)</small>
              </div>
            </div>
          </div>

          <!-- Candidate Rankings Table Card -->
          <div class="candidates-card">
            <div class="card-header-bar">
              <div class="card-title">
                <h4>Official Candidate Rankings ({{ filteredEntries.length }} candidates)</h4>
                <p>Public merit rankings. Candidate application identifiers are masked for privacy.</p>
              </div>

              <!-- Search and Filter Controls -->
              <div class="filter-controls">
                <input
                  type="text"
                  placeholder="Search by candidate name or App ID..."
                  [(ngModel)]="searchText"
                  class="search-input"
                />
                <select [(ngModel)]="selectedCategory" class="filter-select">
                  <option value="">All Categories</option>
                  <option value="General">General</option>
                  <option value="OBC">OBC</option>
                  <option value="SC">SC</option>
                  <option value="ST">ST</option>
                  <option value="EWS">EWS</option>
                  <option value="Management">Management</option>
                </select>
              </div>
            </div>

            <div class="table-container">
              <table class="merit-table">
                <thead>
                  <tr>
                    <th>Merit Rank</th>
                    <th>Cat. Rank</th>
                    <th>Application ID</th>
                    <th>Candidate Name</th>
                    <th>Category</th>
                    <th>Composite Score</th>
                    <th>Eligibility</th>
                    <th>Allocation Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    *ngFor="let candidate of filteredEntries"
                    [class.self-row]="candidate.isSelf"
                    [class.ineligible-row]="candidate.eligibilityStatus === 'Ineligible'"
                  >
                    <td>
                      <strong class="rank-badge" *ngIf="candidate.meritRank > 0">
                        #{{ candidate.meritRank }}
                      </strong>
                      <span *ngIf="candidate.meritRank === 0" class="muted">—</span>
                    </td>
                    <td>
                      <span *ngIf="candidate.categoryRank > 0">#{{ candidate.categoryRank }}</span>
                      <span *ngIf="candidate.categoryRank === 0" class="muted">—</span>
                    </td>
                    <td>
                      <code class="app-id-code">{{ candidate.applicationId }}</code>
                      <span *ngIf="candidate.isSelf" class="you-badge">YOU</span>
                    </td>
                    <td>
                      <strong>{{ candidate.candidateName }}</strong>
                    </td>
                    <td>
                      <span class="cat-tag">{{ candidate.category }}</span>
                    </td>
                    <td>
                      <strong>{{ candidate.compositeScore | number: '1.2-2' }}</strong>
                    </td>
                    <td>
                      <span
                        class="eligibility-pill"
                        [ngClass]="candidate.eligibilityStatus === 'Eligible' ? 'eligible' : 'other'"
                      >
                        {{ candidate.eligibilityStatus }}
                      </span>
                    </td>
                    <td>
                      <span
                        class="alloc-pill"
                        [ngClass]="candidate.allocationStatus.toLowerCase()"
                      >
                        {{ candidate.allocationStatus }}
                      </span>
                    </td>
                  </tr>
                  <tr *ngIf="filteredEntries.length === 0">
                    <td colspan="8" class="no-matches">
                      No candidate matches the search or filter criteria.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="table-footer-note">
              <small>
                &bull; Candidate application IDs are masked for privacy compliance. Personal contact details, marksheet uploads, and private verification remarks are protected.
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .merit-page-container {
      max-width: 1120px;
      margin: 1.5rem auto 3rem;
      padding: 0 1.5rem;
    }
    .breadcrumb-nav {
      margin-bottom: 1.5rem;
      font-size: 0.88rem;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .breadcrumb-nav a {
      color: #002b49;
      font-weight: 600;
      text-decoration: none;
    }
    .breadcrumb-nav a:hover {
      text-decoration: underline;
    }
    .breadcrumb-nav .sep {
      color: #cbd5e1;
    }
    .breadcrumb-nav .current {
      color: #475569;
      font-weight: 600;
    }
    .merit-header-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 1.75rem 2rem;
      margin-bottom: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      flex-wrap: wrap;
    }
    .seal-badge {
      display: inline-block;
      background: #eff6ff;
      color: #1e40af;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.25rem 0.65rem;
      border-radius: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.4rem;
    }
    .header-main h2 {
      margin: 0 0 0.4rem;
      color: #002b49;
      font-size: 1.55rem;
    }
    .programme-meta {
      margin: 0;
      color: #64748b;
      font-size: 0.88rem;
    }
    .round-badge {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
    }
    .published-date-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 0.85rem 1.25rem;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.25rem;
    }
    .date-lbl {
      font-size: 0.72rem;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
    }
    .date-val {
      font-size: 0.95rem;
      font-weight: 700;
      color: #0f172a;
    }
    .verified-tag {
      font-size: 0.75rem;
      color: #16a34a;
      font-weight: 700;
    }
    .my-result-card {
      background: #f0fdf4;
      border: 2px solid #86efac;
      border-radius: 10px;
      padding: 1.5rem 1.75rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 2px 10px rgba(22, 163, 74, 0.08);
    }
    .my-result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
      border-bottom: 1px solid #bbf7d0;
      padding-bottom: 0.75rem;
    }
    .my-title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .star-icon {
      font-size: 1.5rem;
    }
    .my-title h4 {
      margin: 0;
      color: #166534;
      font-size: 1.15rem;
      font-weight: 800;
    }
    .my-title small {
      color: #15803d;
      font-size: 0.85rem;
    }
    .status-pill {
      font-size: 0.78rem;
      font-weight: 700;
      padding: 0.3rem 0.75rem;
      border-radius: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-pill.allocated {
      background: #16a34a;
      color: #ffffff;
    }
    .status-pill.waitlisted {
      background: #fef3c7;
      color: #92400e;
    }
    .status-pill.pending {
      background: #e2e8f0;
      color: #475569;
    }
    .my-kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 1rem;
    }
    .my-kpi-box {
      background: #ffffff;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 0.85rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .my-kpi-box.primary {
      background: #dcfce7;
      border-color: #86efac;
    }
    .kpi-lbl {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      color: #166534;
    }
    .kpi-val {
      font-size: 1.35rem;
      font-weight: 800;
      color: #0f172a;
    }
    .kpi-val.highlight {
      color: #166534;
    }
    .cutoffs-overview-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 1.25rem 1.75rem;
      margin-bottom: 1.5rem;
    }
    .cutoffs-title h5 {
      margin: 0 0 1rem;
      color: #002b49;
      font-size: 0.95rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .cutoffs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .cutoff-stat {
      background: #f8fafc;
      border: 1px solid #edf2f7;
      border-radius: 6px;
      padding: 0.75rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .stat-num {
      font-size: 1.35rem;
      font-weight: 800;
      color: #002b49;
    }
    .stat-num.success {
      color: #16a34a;
    }
    .stat-lbl {
      font-size: 0.75rem;
      color: #64748b;
      font-weight: 600;
    }
    .cat-cutoffs-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
      padding-top: 0.75rem;
      border-top: 1px solid #f1f5f9;
    }
    .cat-pill {
      background: #f1f5f9;
      padding: 0.35rem 0.65rem;
      border-radius: 6px;
      font-size: 0.8rem;
      color: #334155;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .cat-pill strong {
      color: #002b49;
    }
    .cat-pill small {
      color: #64748b;
    }
    .candidates-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 1.75rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .card-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.25rem;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .card-title h4 {
      margin: 0 0 0.25rem;
      color: #002b49;
      font-size: 1.15rem;
    }
    .card-title p {
      margin: 0;
      font-size: 0.82rem;
      color: #64748b;
    }
    .filter-controls {
      display: flex;
      gap: 0.75rem;
    }
    .search-input {
      padding: 0.5rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 0.85rem;
      min-width: 260px;
    }
    .filter-select {
      padding: 0.5rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 0.85rem;
      background: #ffffff;
    }
    .table-container {
      overflow-x: auto;
    }
    .merit-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    .merit-table th {
      background: #f8fafc;
      padding: 0.75rem 0.85rem;
      text-align: left;
      font-weight: 600;
      color: #475569;
      border-bottom: 2px solid #e2e8f0;
      white-space: nowrap;
    }
    .merit-table td {
      padding: 0.75rem 0.85rem;
      border-bottom: 1px solid #edf2f7;
      color: #1e293b;
      vertical-align: middle;
    }
    .self-row {
      background: #ecfdf5 !important;
      border-left: 4px solid #16a34a;
    }
    .ineligible-row {
      background: #fff5f5;
      color: #991b1b;
    }
    .rank-badge {
      background: #002b49;
      color: #ffffff;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      font-size: 0.78rem;
    }
    .app-id-code {
      font-family: monospace;
      font-weight: 700;
      color: #334155;
    }
    .you-badge {
      margin-left: 0.4rem;
      background: #16a34a;
      color: #ffffff;
      font-size: 0.68rem;
      font-weight: 800;
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
      letter-spacing: 0.5px;
    }
    .cat-tag {
      background: #f1f5f9;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .eligibility-pill {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 10px;
    }
    .eligibility-pill.eligible {
      background: #dcfce7;
      color: #166534;
    }
    .eligibility-pill.other {
      background: #fef3c7;
      color: #92400e;
    }
    .alloc-pill {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 10px;
      text-transform: capitalize;
    }
    .alloc-pill.allocated {
      background: #dcfce7;
      color: #166534;
    }
    .alloc-pill.waitlisted {
      background: #fef3c7;
      color: #92400e;
    }
    .alloc-pill.pending {
      background: #f1f5f9;
      color: #64748b;
    }
    .no-matches {
      text-align: center;
      padding: 2rem;
      color: #64748b;
    }
    .table-footer-note {
      margin-top: 1rem;
      color: #64748b;
      font-size: 0.78rem;
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
      color: #002b49;
      font-size: 1.35rem;
    }
    .state-card.empty p {
      max-width: 500px;
      margin: 0 auto 0.75rem;
      color: #64748b;
      font-size: 0.95rem;
      line-height: 1.5;
    }
    .empty-hint {
      max-width: 600px;
      margin: 0 auto 1.75rem;
      font-size: 0.85rem;
      color: #94a3b8;
    }
    .btn-primary-action {
      display: inline-block;
      background: #002b49;
      color: #ffffff;
      font-weight: 600;
      padding: 0.75rem 1.75rem;
      border-radius: 4px;
      text-decoration: none;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #e2e8f0;
      border-top-color: #002b49;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .alert-box.error {
      background: #fee2e2;
      border: 1px solid #fca5a5;
      color: #991b1b;
      padding: 0.85rem 1.25rem;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    .btn-retry-inline {
      background: #991b1b;
      color: #ffffff;
      border: none;
      padding: 0.35rem 0.75rem;
      border-radius: 4px;
      font-size: 0.8rem;
      cursor: pointer;
    }
    .muted {
      color: #94a3b8;
    }
  `]
})
export class ApplicantMeritListComponent implements OnInit {
  private meritService = inject(MeritService);
  private cdr = inject(ChangeDetectorRef);

  public isLoading = true;
  public errorMessage = '';
  public publishedData: ApplicantPublishedMeritListResponse | null = null;
  public searchText = '';
  public selectedCategory = '';

  ngOnInit(): void {
    this.fetchPublishedList();
  }

  fetchPublishedList(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    this.meritService.getPublishedMeritList().subscribe({
      next: (res) => {
        this.isLoading = false;
        this.publishedData = res.data || null;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage =
          err.error?.message || 'Failed to load official published merit list.';
        this.cdr.markForCheck();
      }
    });
  }

  get filteredEntries(): PublishedMeritListCandidate[] {
    if (!this.publishedData?.entries) return [];

    return this.publishedData.entries.filter((candidate) => {
      const matchSearch =
        !this.searchText ||
        candidate.candidateName?.toLowerCase().includes(this.searchText.toLowerCase()) ||
        candidate.applicationId?.toLowerCase().includes(this.searchText.toLowerCase());

      const matchCat =
        !this.selectedCategory || candidate.category === this.selectedCategory;

      return matchSearch && matchCat;
    });
  }
}
