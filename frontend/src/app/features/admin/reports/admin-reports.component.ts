import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../../core/services/report.service';
import { AdminService } from '../../../core/services/admin.service';
import {
  OverviewAnalytics,
  ApplicationAnalytics,
  DocumentAnalytics,
  MeritAnalytics,
  PaymentAnalytics,
  ReportFilterParams,
  ExportReportType,
  ExportFormat
} from '../../../core/models/report.model';
import { Programme } from '../../../core/models/programme.model';
import { AcademicSession } from '../../../core/models/session.model';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-reports-container">
      <!-- Section Header -->
      <div class="reports-header">
        <div class="header-info">
          <h2>Institutional Reporting, Analytics & Data Export</h2>
          <p>Multi-dimensional operational analytics, verified revenue metrics, merit seat utilization, and secure CSV/PDF report generation</p>
        </div>
        <div class="header-actions">
          <button class="btn-refresh" (click)="refreshCurrentTab()" [disabled]="isLoading">
            <span *ngIf="isLoading" class="spinner"></span>
            <span>Refresh Analytics</span>
          </button>
        </div>
      </div>

      <!-- Unified Multi-Dimensional Filter Bar -->
      <div class="filter-panel">
        <div class="filter-panel-title">
          <span class="filter-icon">&#128269;</span>
          <strong>Unified Report Filters</strong>
          <span class="filter-hint">(Filters apply to all metrics, charts, and data exports)</span>
        </div>

        <div class="filter-grid">
          <div class="filter-field">
            <label for="filterSession">Academic Session</label>
            <select id="filterSession" [(ngModel)]="filters.academicSession">
              <option value="">All Academic Sessions</option>
              <option *ngFor="let s of availableSessions" [value]="s.sessionName">
                {{ s.sessionName }} {{ s.status === 'Active' ? '(Active)' : '' }}
              </option>
            </select>
          </div>

          <div class="filter-field">
            <label for="filterProg">Programme</label>
            <select id="filterProg" [(ngModel)]="filters.programmeId">
              <option value="">All Academic Programmes</option>
              <option *ngFor="let p of availableProgrammes" [value]="p._id">
                {{ p.programmeCode }} - {{ p.programmeName }}
              </option>
            </select>
          </div>

          <div class="filter-field">
            <label for="filterStatus">Application Status</label>
            <select id="filterStatus" [(ngModel)]="filters.status">
              <option value="">All Application Statuses</option>
              <option value="Submitted">Submitted</option>
              <option value="Under Review">Under Review</option>
              <option value="Selected">Selected</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div class="filter-field">
            <label for="filterCategory">Category</label>
            <select id="filterCategory" [(ngModel)]="filters.category">
              <option value="">All Categories</option>
              <option value="General">General</option>
              <option value="SC">SC</option>
              <option value="ST">ST</option>
              <option value="OBC">OBC</option>
            </select>
          </div>

          <div class="filter-field">
            <label for="filterDocStatus">Document Status</label>
            <select id="filterDocStatus" [(ngModel)]="filters.documentStatus">
              <option value="">All Document Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Verified">Verified</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div class="filter-field">
            <label for="filterPaymentStatus">Payment Status</label>
            <select id="filterPaymentStatus" [(ngModel)]="filters.paymentStatus">
              <option value="">All Payment Statuses</option>
              <option value="Successful">Successful</option>
              <option value="Pending">Pending</option>
              <option value="Failed">Failed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div class="filter-field">
            <label for="filterStart">Start Date</label>
            <input id="filterStart" type="date" [(ngModel)]="filters.startDate" />
          </div>

          <div class="filter-field">
            <label for="filterEnd">End Date</label>
            <input id="filterEnd" type="date" [(ngModel)]="filters.endDate" />
          </div>
        </div>

        <div class="filter-actions-row">
          <button class="btn-filter-apply" (click)="applyFilters()" [disabled]="isLoading">
            Apply Filters
          </button>
          <button class="btn-filter-reset" (click)="resetFilters()" [disabled]="isLoading">
            Reset Filters
          </button>
        </div>
      </div>

      <!-- Top KPI Summary Ribbon -->
      <div class="kpi-ribbon" *ngIf="overviewData">
        <div class="kpi-ribbon-card kpi-apps">
          <div class="kpi-card-header">
            <span class="kpi-badge-icon">&#128196;</span>
            <span class="kpi-title">Total Applications</span>
          </div>
          <div class="kpi-number">{{ overviewData.kpis.totalApplications }}</div>
          <div class="kpi-sub">
            <span class="badge-sel">{{ overviewData.kpis.selectedApplications }} Selected</span>
            <span class="badge-sub">{{ overviewData.kpis.submittedApplications }} Pending</span>
          </div>
        </div>

        <div class="kpi-ribbon-card kpi-docs">
          <div class="kpi-card-header">
            <span class="kpi-badge-icon">&#128193;</span>
            <span class="kpi-title">Verified Documents</span>
          </div>
          <div class="kpi-number">{{ overviewData.kpis.verifiedDocuments }} <small>/ {{ overviewData.kpis.totalDocuments }}</small></div>
          <div class="kpi-sub">
            <div class="kpi-meter-container">
              <div class="kpi-meter-fill" [style.width.%]="docVerificationRate"></div>
            </div>
            <span class="kpi-meter-text">{{ docVerificationRate }}% verified</span>
          </div>
        </div>

        <div class="kpi-ribbon-card kpi-enrol">
          <div class="kpi-card-header">
            <span class="kpi-badge-icon">&#127891;</span>
            <span class="kpi-title">Confirmed Enrolments</span>
          </div>
          <div class="kpi-number">{{ overviewData.kpis.confirmedEnrolments }}</div>
          <div class="kpi-sub">Final institutional enrolments</div>
        </div>

        <div class="kpi-ribbon-card kpi-rev">
          <div class="kpi-card-header">
            <span class="kpi-badge-icon">&#8377;</span>
            <span class="kpi-title">Verified Collected Revenue</span>
          </div>
          <div class="kpi-number">&#8377;{{ overviewData.kpis.verifiedCollectedRevenue | number:'1.0-0' }}</div>
          <div class="kpi-sub">Strictly successful fee transactions</div>
        </div>

        <div class="kpi-ribbon-card kpi-rate">
          <div class="kpi-card-header">
            <span class="kpi-badge-icon">&#128200;</span>
            <span class="kpi-title">Processing Completion</span>
          </div>
          <div class="kpi-number">{{ overviewData.kpis.completionRate }}%</div>
          <div class="kpi-sub">Applications finalized (Selected/Rejected)</div>
        </div>
      </div>

      <!-- Navigation Sub-Tabs -->
      <div class="sub-nav-tabs">
        <button
          type="button"
          class="sub-tab-btn"
          [class.active]="activeSubTab === 'overview'"
          (click)="setSubTab('overview')"
        >
          <span>&#128202;</span> Executive Overview
        </button>
        <button
          type="button"
          class="sub-tab-btn"
          [class.active]="activeSubTab === 'applications'"
          (click)="setSubTab('applications')"
        >
          <span>&#128196;</span> Application Analytics
        </button>
        <button
          type="button"
          class="sub-tab-btn"
          [class.active]="activeSubTab === 'documents'"
          (click)="setSubTab('documents')"
        >
          <span>&#128193;</span> Verification Analytics
        </button>
        <button
          type="button"
          class="sub-tab-btn"
          [class.active]="activeSubTab === 'merit'"
          (click)="setSubTab('merit')"
        >
          <span>&#128220;</span> Merit & Seat Allocations
        </button>
        <button
          type="button"
          class="sub-tab-btn"
          [class.active]="activeSubTab === 'financials'"
          (click)="setSubTab('financials')"
        >
          <span>&#128179;</span> Financials & Enrolment
        </button>
        <button
          type="button"
          class="sub-tab-btn"
          [class.active]="activeSubTab === 'export'"
          (click)="setSubTab('export')"
        >
          <span>&#128190;</span> Export Data (CSV / PDF)
        </button>
      </div>

      <!-- Feedback / Alert Messages -->
      <div *ngIf="errorMessage" class="alert-box alert-error">
        <span>&#9888;</span> {{ errorMessage }}
      </div>
      <div *ngIf="successMessage" class="alert-box alert-success">
        <span>&#10003;</span> {{ successMessage }}
      </div>

      <!-- SUB-TAB 1: EXECUTIVE OVERVIEW -->
      <div *ngIf="activeSubTab === 'overview'" class="tab-content">
        <div class="section-card" *ngIf="overviewData">
          <div class="card-header">
            <h3>Monthly Submission & Revenue Trends</h3>
            <span class="card-hint">Aggregated admissions timeline across recent months</span>
          </div>

          <div class="chart-empty" *ngIf="overviewData.monthlyTrends.length === 0">
            <p>No monthly activity recorded for the selected filter range.</p>
          </div>

          <div class="trend-table-container" *ngIf="overviewData.monthlyTrends.length > 0">
            <table class="report-table">
              <thead>
                <tr>
                  <th>Billing Month</th>
                  <th>Applications Received</th>
                  <th>Verified Fees Collected</th>
                  <th>Visual Activity Proportion</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let trend of overviewData.monthlyTrends">
                  <td><strong>{{ trend.month }}</strong></td>
                  <td>{{ trend.applications }}</td>
                  <td>&#8377;{{ trend.revenue | number:'1.0-0' }}</td>
                  <td>
                    <div class="bar-progress-track">
                      <div
                        class="bar-progress-fill"
                        [style.width.%]="calcTrendWidth(trend.applications)"
                      ></div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- SUB-TAB 2: APPLICATION ANALYTICS -->
      <div *ngIf="activeSubTab === 'applications'" class="tab-content">
        <div *ngIf="isLoading" class="loading-state">
          <span class="spinner"></span> Loading application analytics...
        </div>

        <div *ngIf="!isLoading && applicationData" class="analytics-grid">
          <!-- Status Distribution -->
          <div class="section-card">
            <div class="card-header">
              <h3>Status Distribution Breakdown</h3>
              <span class="badge-total">{{ applicationData.total }} Total</span>
            </div>
            <div class="chart-list">
              <div class="chart-row" *ngFor="let s of applicationData.statusBreakdown">
                <span class="row-label">{{ s._id }}</span>
                <div class="row-bar-track">
                  <div
                    class="row-bar-fill"
                    [ngClass]="'status-' + s._id.toLowerCase().replace(' ', '-')"
                    [style.width.%]="calcPercentage(s.count, applicationData.total)"
                  ></div>
                </div>
                <span class="row-val">{{ s.count }} ({{ calcPercentage(s.count, applicationData.total) }}%)</span>
              </div>
            </div>
          </div>

          <!-- Category Breakdown -->
          <div class="section-card">
            <div class="card-header">
              <h3>Category-Wise Distribution</h3>
              <span class="badge-total">{{ applicationData.total }} Total</span>
            </div>
            <div class="chart-list">
              <div class="chart-row" *ngFor="let c of applicationData.categoryBreakdown">
                <span class="row-label">{{ c._id || 'Unspecified' }}</span>
                <div class="row-bar-track">
                  <div
                    class="row-bar-fill cat-fill"
                    [style.width.%]="calcPercentage(c.count, applicationData.total)"
                  ></div>
                </div>
                <span class="row-val">{{ c.count }} ({{ calcPercentage(c.count, applicationData.total) }}%)</span>
              </div>
            </div>
          </div>

          <!-- Programme Breakdown -->
          <div class="section-card full-width">
            <div class="card-header">
              <h3>Programme Distribution & Popularity</h3>
            </div>
            <table class="report-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Programme Name</th>
                  <th>Applications</th>
                  <th>Share of Total</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let p of applicationData.programmeBreakdown">
                  <td><span class="code-pill">{{ p.programmeCode }}</span></td>
                  <td>{{ p.programmeName }}</td>
                  <td><strong>{{ p.count }}</strong></td>
                  <td>
                    <div class="bar-progress-track">
                      <div
                        class="bar-progress-fill"
                        [style.width.%]="calcPercentage(p.count, applicationData.total)"
                      ></div>
                    </div>
                    <small>{{ calcPercentage(p.count, applicationData.total) }}%</small>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- SUB-TAB 3: DOCUMENT VERIFICATION ANALYTICS -->
      <div *ngIf="activeSubTab === 'documents'" class="tab-content">
        <div *ngIf="isLoading" class="loading-state">
          <span class="spinner"></span> Loading document verification analytics...
        </div>

        <div *ngIf="!isLoading && documentData" class="analytics-grid">
          <!-- Document Status Summary -->
          <div class="section-card">
            <div class="card-header">
              <h3>Document Verification Overview</h3>
              <span class="badge-total">{{ documentData.totalDocuments }} Total</span>
            </div>
            <div class="doc-kpi-row">
              <div class="doc-kpi-item doc-verified">
                <span class="count">{{ documentData.verifiedCount }}</span>
                <span class="label">Verified</span>
              </div>
              <div class="doc-kpi-item doc-pending">
                <span class="count">{{ documentData.pendingCount }}</span>
                <span class="label">Pending</span>
              </div>
              <div class="doc-kpi-item doc-rejected">
                <span class="count">{{ documentData.rejectedCount }}</span>
                <span class="label">Rejected</span>
              </div>
            </div>
            <div class="outstanding-banner" *ngIf="documentData.outstandingRequirements">
              <span class="banner-icon">&#9888;</span>
              <div>
                <strong>{{ documentData.outstandingRequirements.unverifiedDocumentsCount }} Documents Outstanding</strong>
                <p>Across {{ documentData.outstandingRequirements.pendingApplicationsCount }} candidate applications awaiting reviewer assessment.</p>
              </div>
            </div>
          </div>

          <!-- Document Types Distribution -->
          <div class="section-card">
            <div class="card-header">
              <h3>Distribution by Document Type</h3>
            </div>
            <div class="chart-list">
              <div class="chart-row" *ngFor="let d of documentData.documentTypeDistribution">
                <span class="row-label">{{ d._id }}</span>
                <div class="row-bar-track">
                  <div
                    class="row-bar-fill doc-fill"
                    [style.width.%]="calcPercentage(d.total, documentData.totalDocuments)"
                  ></div>
                </div>
                <span class="row-val">{{ d.total }} ({{ d.verified }} V / {{ d.pending }} P / {{ d.rejected }} R)</span>
              </div>
            </div>
          </div>

          <!-- Reviewer Workloads -->
          <div class="section-card full-width">
            <div class="card-header">
              <h3>Reviewer Performance & Workload Distribution</h3>
              <span class="card-hint">Assessments performed by authorized Reviewer & Admin staff</span>
            </div>
            <p *ngIf="documentData.reviewerWorkloads.length === 0" class="chart-empty">
              No reviewer activity recorded yet.
            </p>
            <table *ngIf="documentData.reviewerWorkloads.length > 0" class="report-table">
              <thead>
                <tr>
                  <th>Reviewer Name</th>
                  <th>Email</th>
                  <th>Documents Verified</th>
                  <th>Share of Verifications</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let rw of documentData.reviewerWorkloads">
                  <td><strong>{{ rw.name }}</strong></td>
                  <td>{{ rw.email }}</td>
                  <td><strong>{{ rw.totalVerified }}</strong></td>
                  <td>
                    <div class="bar-progress-track">
                      <div
                        class="bar-progress-fill"
                        [style.width.%]="calcPercentage(rw.totalVerified, documentData.verifiedCount)"
                      ></div>
                    </div>
                    <small>{{ calcPercentage(rw.totalVerified, documentData.verifiedCount) }}%</small>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- SUB-TAB 4: MERIT & SEAT ALLOCATION ANALYTICS -->
      <div *ngIf="activeSubTab === 'merit'" class="tab-content">
        <div *ngIf="isLoading" class="loading-state">
          <span class="spinner"></span> Loading merit & allocation analytics...
        </div>

        <div *ngIf="!isLoading && meritData" class="analytics-grid">
          <!-- Merit Screening KPIs -->
          <div class="section-card full-width">
            <div class="card-header">
              <h3>Merit Engine Screening & Allocation Metrics</h3>
            </div>
            <div class="doc-kpi-row">
              <div class="doc-kpi-item doc-verified">
                <span class="count">{{ meritData.totalMeritLists }}</span>
                <span class="label">Merit Lists</span>
              </div>
              <div class="doc-kpi-item doc-pending">
                <span class="count">{{ meritData.totalCandidatesScreened }}</span>
                <span class="label">Candidates Screened</span>
              </div>
              <div class="doc-kpi-item doc-verified">
                <span class="count">{{ meritData.totalAllocations }}</span>
                <span class="label">Total Allocations</span>
              </div>
              <div class="doc-kpi-item doc-pending">
                <span class="count">{{ meritData.totalWaitlistedAllocations }}</span>
                <span class="label">Waitlisted</span>
              </div>
            </div>
          </div>

          <!-- Cutoff Summaries Table -->
          <div class="section-card full-width" *ngIf="meritData.cutoffSummaries.length > 0">
            <div class="card-header">
              <h3>Published Cutoff Scores by Programme & Round</h3>
            </div>
            <table class="report-table">
              <thead>
                <tr>
                  <th>Programme</th>
                  <th>Session</th>
                  <th>Round</th>
                  <th>Status</th>
                  <th>Category Cutoffs</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let cut of meritData.cutoffSummaries">
                  <td><strong>{{ cut.programmeCode }}</strong> - {{ cut.programmeName }}</td>
                  <td>{{ cut.academicSession }}</td>
                  <td><span class="round-badge">Round {{ cut.roundNumber }}</span></td>
                  <td><span class="status-pill status-selected">{{ cut.status }}</span></td>
                  <td>
                    <span *ngFor="let c of cut.cutoffs" class="cutoff-pill">
                      {{ c.category }}: <strong>{{ c.minimumScore }}</strong>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Programme Seat Utilization -->
          <div class="section-card full-width">
            <div class="card-header">
              <h3>Programme Seat Capacity vs Allocation & Vacancies</h3>
            </div>
            <p *ngIf="meritData.programmeSeatUtilization.length === 0" class="chart-empty">
              No seat allocation records found.
            </p>
            <table *ngIf="meritData.programmeSeatUtilization.length > 0" class="report-table">
              <thead>
                <tr>
                  <th>Programme</th>
                  <th>Capacity</th>
                  <th>Allocated</th>
                  <th>Confirmed</th>
                  <th>Waitlisted</th>
                  <th>Vacant</th>
                  <th>Utilization Rate</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let su of meritData.programmeSeatUtilization">
                  <td><strong>{{ su.programmeCode }}</strong> - {{ su.programmeName }}</td>
                  <td>{{ su.totalCapacity }}</td>
                  <td>{{ su.allocatedSeats }}</td>
                  <td><span class="badge-sel">{{ su.confirmedSeats }}</span></td>
                  <td>{{ su.waitlistedSeats }}</td>
                  <td><span class="badge-vacant">{{ su.vacantSeats }}</span></td>
                  <td>
                    <div class="bar-progress-track">
                      <div
                        class="bar-progress-fill"
                        [style.width.%]="su.utilizationPercentage"
                      ></div>
                    </div>
                    <strong>{{ su.utilizationPercentage }}%</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- SUB-TAB 5: FINANCIALS & ENROLMENT ANALYTICS -->
      <div *ngIf="activeSubTab === 'financials'" class="tab-content">
        <div *ngIf="isLoading" class="loading-state">
          <span class="spinner"></span> Loading financial & enrolment analytics...
        </div>

        <div *ngIf="!isLoading && paymentData" class="analytics-grid">
          <!-- Financial Reconciliation Summary -->
          <div class="section-card">
            <div class="card-header">
              <h3>Financial Health & Reconciliation</h3>
            </div>
            <div class="reconcile-card">
              <div class="reconcile-score">
                <span class="score-val">{{ paymentData.reconciliationSummary.reconciliationMatchRate }}%</span>
                <span class="score-lbl">Reconciliation Match Rate</span>
              </div>
              <div class="reconcile-details">
                <div class="reconcile-row">
                  <span>Total Transactions:</span>
                  <strong>{{ paymentData.reconciliationSummary.totalTransactions }}</strong>
                </div>
                <div class="reconcile-row text-success">
                  <span>Successful Transactions:</span>
                  <strong>{{ paymentData.reconciliationSummary.successfulTransactions }}</strong>
                </div>
                <div class="reconcile-row text-warning">
                  <span>Pending Transactions:</span>
                  <strong>{{ paymentData.reconciliationSummary.pendingTransactions }}</strong>
                </div>
                <div class="reconcile-row text-danger">
                  <span>Failed / Cancelled:</span>
                  <strong>{{ paymentData.reconciliationSummary.failedTransactions }}</strong>
                </div>
              </div>
            </div>
          </div>

          <!-- Category Enrolments -->
          <div class="section-card">
            <div class="card-header">
              <h3>Category-Wise Confirmed Enrolments</h3>
            </div>
            <table class="report-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Enrolled</th>
                  <th>Fees Collected</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let cat of paymentData.categoryEnrolments">
                  <td><span class="cat-badge">{{ cat.category }}</span></td>
                  <td><strong>{{ cat.count }}</strong></td>
                  <td>&#8377;{{ cat.feeCollected | number:'1.0-0' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Programme Revenue Collections -->
          <div class="section-card full-width">
            <div class="card-header">
              <h3>Programme-Wise Revenue Collections & Enrolments</h3>
            </div>
            <p *ngIf="paymentData.programmeCollections.length === 0" class="chart-empty">
              No programme revenue records available.
            </p>
            <table *ngIf="paymentData.programmeCollections.length > 0" class="report-table">
              <thead>
                <tr>
                  <th>Programme Code</th>
                  <th>Programme Name</th>
                  <th>Confirmed Students</th>
                  <th>Verified Collected Revenue</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let col of paymentData.programmeCollections">
                  <td><span class="code-pill">{{ col.programmeCode }}</span></td>
                  <td>{{ col.programmeName }}</td>
                  <td><strong>{{ col.enrolledCount }}</strong></td>
                  <td><strong>&#8377;{{ col.feeCollected | number:'1.0-0' }}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- SUB-TAB 6: DATA EXPORT & REPORTS CENTER -->
      <div *ngIf="activeSubTab === 'export'" class="tab-content">
        <div class="export-intro-card">
          <div class="intro-icon">&#128190;</div>
          <div class="intro-text">
            <h3>Institutional Data Export Center</h3>
            <p>
              Download operational datasets in sanitized CSV (with formula injection escaping for Excel/Sheets)
              or official IEM multi-page PDF documents formatted for executive reporting. Current filter settings will be applied.
            </p>
          </div>
        </div>

        <div class="export-grid">
          <!-- Card 1: Applications Report -->
          <div class="export-card">
            <div class="export-card-icon">&#128196;</div>
            <div class="export-card-content">
              <h4>Applications Report</h4>
              <p>Candidate profiles, academic percentages, entrance scores, submission dates, and evaluation statuses.</p>
            </div>
            <div class="export-card-actions">
              <button
                class="btn-export-csv"
                (click)="exportData('applications', 'csv')"
                [disabled]="isExporting"
              >
                <span>&#128196;</span> Download CSV
              </button>
              <button
                class="btn-export-pdf"
                (click)="exportData('applications', 'pdf')"
                [disabled]="isExporting"
              >
                <span>&#128221;</span> Download PDF
              </button>
            </div>
          </div>

          <!-- Card 2: Applicants Directory -->
          <div class="export-card">
            <div class="export-card-icon">&#128100;</div>
            <div class="export-card-content">
              <h4>Registered Applicants Directory</h4>
              <p>Applicant registry with full contact details, registration timestamps, and application counts.</p>
            </div>
            <div class="export-card-actions">
              <button
                class="btn-export-csv"
                (click)="exportData('applicants', 'csv')"
                [disabled]="isExporting"
              >
                <span>&#128196;</span> Download CSV
              </button>
              <button
                class="btn-export-pdf"
                (click)="exportData('applicants', 'pdf')"
                [disabled]="isExporting"
              >
                <span>&#128221;</span> Download PDF
              </button>
            </div>
          </div>

          <!-- Card 3: Document Verification Report -->
          <div class="export-card">
            <div class="export-card-icon">&#128193;</div>
            <div class="export-card-content">
              <h4>Document Verification Report</h4>
              <p>Comprehensive file inventory, document types, verification statuses, reviewer audits, and remarks.</p>
            </div>
            <div class="export-card-actions">
              <button
                class="btn-export-csv"
                (click)="exportData('documents', 'csv')"
                [disabled]="isExporting"
              >
                <span>&#128196;</span> Download CSV
              </button>
              <button
                class="btn-export-pdf"
                (click)="exportData('documents', 'pdf')"
                [disabled]="isExporting"
              >
                <span>&#128221;</span> Download PDF
              </button>
            </div>
          </div>

          <!-- Card 4: Merit Lists & Cutoffs -->
          <div class="export-card">
            <div class="export-card-icon">&#128220;</div>
            <div class="export-card-content">
              <h4>Merit Lists & Computed Cutoffs</h4>
              <p>Candidate merit ranks, combined percentage calculations, and category-wise minimum cutoff scores.</p>
            </div>
            <div class="export-card-actions">
              <button
                class="btn-export-csv"
                (click)="exportData('merit', 'csv')"
                [disabled]="isExporting"
              >
                <span>&#128196;</span> Download CSV
              </button>
              <button
                class="btn-export-pdf"
                (click)="exportData('merit', 'pdf')"
                [disabled]="isExporting"
              >
                <span>&#128221;</span> Download PDF
              </button>
            </div>
          </div>

          <!-- Card 5: Seat Allocations -->
          <div class="export-card">
            <div class="export-card-icon">&#127979;</div>
            <div class="export-card-content">
              <h4>Category Seat Allocations</h4>
              <p>Seat allocation rounds, assigned programmes, categories, seat numbers, and acceptance deadlines.</p>
            </div>
            <div class="export-card-actions">
              <button
                class="btn-export-csv"
                (click)="exportData('allocations', 'csv')"
                [disabled]="isExporting"
              >
                <span>&#128196;</span> Download CSV
              </button>
              <button
                class="btn-export-pdf"
                (click)="exportData('allocations', 'pdf')"
                [disabled]="isExporting"
              >
                <span>&#128221;</span> Download PDF
              </button>
            </div>
          </div>

          <!-- Card 6: Payment Transactions -->
          <div class="export-card">
            <div class="export-card-icon">&#128179;</div>
            <div class="export-card-content">
              <h4>Payment Transactions Audit</h4>
              <p>Order IDs, transaction references, payment methods, gateway statuses, and reconciled timestamps.</p>
            </div>
            <div class="export-card-actions">
              <button
                class="btn-export-csv"
                (click)="exportData('payments', 'csv')"
                [disabled]="isExporting"
              >
                <span>&#128196;</span> Download CSV
              </button>
              <button
                class="btn-export-pdf"
                (click)="exportData('payments', 'pdf')"
                [disabled]="isExporting"
              >
                <span>&#128221;</span> Download PDF
              </button>
            </div>
          </div>

          <!-- Card 7: Confirmed Enrolments -->
          <div class="export-card">
            <div class="export-card-icon">&#127891;</div>
            <div class="export-card-content">
              <h4>Confirmed Enrolment Registry</h4>
              <p>Official student enrolments, permanent enrolment IDs, seat assignments, and admission dates.</p>
            </div>
            <div class="export-card-actions">
              <button
                class="btn-export-csv"
                (click)="exportData('enrolments', 'csv')"
                [disabled]="isExporting"
              >
                <span>&#128196;</span> Download CSV
              </button>
              <button
                class="btn-export-pdf"
                (click)="exportData('enrolments', 'pdf')"
                [disabled]="isExporting"
              >
                <span>&#128221;</span> Download PDF
              </button>
            </div>
          </div>

          <!-- Card 8: Fee Collection Summary -->
          <div class="export-card">
            <div class="export-card-icon">&#8377;</div>
            <div class="export-card-content">
              <h4>Fee Collection Financial Summary</h4>
              <p>Consolidated revenue audit by academic programme, enrolled candidate counts, and verified collections.</p>
            </div>
            <div class="export-card-actions">
              <button
                class="btn-export-csv"
                (click)="exportData('fee-summary', 'csv')"
                [disabled]="isExporting"
              >
                <span>&#128196;</span> Download CSV
              </button>
              <button
                class="btn-export-pdf"
                (click)="exportData('fee-summary', 'pdf')"
                [disabled]="isExporting"
              >
                <span>&#128221;</span> Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-reports-container {
      padding: 1.5rem;
      background: #f8fafc;
      min-height: 100vh;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    /* Header */
    .reports-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 1rem;
    }

    .reports-header h2 {
      margin: 0 0 0.25rem 0;
      color: #002b49;
      font-size: 1.75rem;
      font-weight: 700;
    }

    .reports-header p {
      margin: 0;
      color: #64748b;
      font-size: 0.95rem;
    }

    .btn-refresh {
      background: #002b49;
      color: #ffffff;
      padding: 0.6rem 1.25rem;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: background 0.2s;
    }

    .btn-refresh:hover:not(:disabled) {
      background: #00406c;
    }

    .btn-refresh:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Filter Panel */
    .filter-panel {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .filter-panel-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
      color: #002b49;
    }

    .filter-hint {
      font-size: 0.85rem;
      color: #64748b;
      font-weight: normal;
    }

    .filter-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .filter-field {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .filter-field label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #475569;
    }

    .filter-field select,
    .filter-field input {
      padding: 0.5rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 0.875rem;
      color: #1e293b;
      background: #ffffff;
      outline: none;
    }

    .filter-field select:focus,
    .filter-field input:focus {
      border-color: #002b49;
      box-shadow: 0 0 0 2px rgba(0, 43, 73, 0.1);
    }

    .filter-actions-row {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
    }

    .btn-filter-apply {
      background: #002b49;
      color: #ffffff;
      padding: 0.5rem 1.25rem;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
    }

    .btn-filter-reset {
      background: #f1f5f9;
      color: #475569;
      padding: 0.5rem 1.25rem;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
    }

    /* KPI Ribbon */
    .kpi-ribbon {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .kpi-ribbon-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.25rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      border-top: 4px solid #002b49;
    }

    .kpi-ribbon-card.kpi-docs { border-top-color: #0284c7; }
    .kpi-ribbon-card.kpi-enrol { border-top-color: #059669; }
    .kpi-ribbon-card.kpi-rev { border-top-color: #d97706; }
    .kpi-ribbon-card.kpi-rate { border-top-color: #7c3aed; }

    .kpi-card-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .kpi-badge-icon {
      font-size: 1.25rem;
    }

    .kpi-title {
      font-size: 0.85rem;
      font-weight: 600;
      color: #64748b;
    }

    .kpi-number {
      font-size: 1.75rem;
      font-weight: 700;
      color: #002b49;
      margin-bottom: 0.5rem;
    }

    .kpi-number small {
      font-size: 1rem;
      font-weight: 400;
      color: #94a3b8;
    }

    .kpi-sub {
      font-size: 0.8rem;
      color: #64748b;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .kpi-meter-container {
      background: #e2e8f0;
      height: 6px;
      border-radius: 3px;
      overflow: hidden;
      margin-top: 0.25rem;
    }

    .kpi-meter-fill {
      background: #0284c7;
      height: 100%;
    }

    .kpi-meter-text {
      font-size: 0.75rem;
      font-weight: 600;
      color: #0284c7;
    }

    /* Sub Tabs */
    .sub-nav-tabs {
      display: flex;
      gap: 0.5rem;
      border-bottom: 2px solid #cbd5e1;
      margin-bottom: 1.5rem;
      overflow-x: auto;
    }

    .sub-tab-btn {
      padding: 0.75rem 1.25rem;
      background: transparent;
      border: none;
      border-bottom: 3px solid transparent;
      font-size: 0.95rem;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      white-space: nowrap;
      transition: all 0.2s;
    }

    .sub-tab-btn:hover {
      color: #002b49;
    }

    .sub-tab-btn.active {
      color: #002b49;
      border-bottom-color: #002b49;
      background: rgba(0, 43, 73, 0.04);
      border-radius: 6px 6px 0 0;
    }

    /* Section Cards & Tables */
    .analytics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.5rem;
    }

    .section-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.25rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .section-card.full-width {
      grid-column: span 2;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 0.5rem;
    }

    .card-header h3 {
      margin: 0;
      font-size: 1.1rem;
      color: #002b49;
    }

    .card-hint {
      font-size: 0.8rem;
      color: #94a3b8;
    }

    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    .report-table th {
      background: #f8fafc;
      padding: 0.75rem 1rem;
      text-align: left;
      font-weight: 600;
      color: #475569;
      border-bottom: 1px solid #e2e8f0;
    }

    .report-table td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
    }

    /* Chart row styling */
    .chart-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .chart-row {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .row-label {
      width: 120px;
      font-size: 0.85rem;
      font-weight: 600;
      color: #334155;
    }

    .row-bar-track {
      flex: 1;
      height: 16px;
      background: #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }

    .row-bar-fill {
      height: 100%;
      border-radius: 8px;
      transition: width 0.3s;
    }

    .row-val {
      width: 90px;
      font-size: 0.8rem;
      color: #64748b;
      text-align: right;
    }

    .status-submitted { background: #3b82f6; }
    .status-under-review { background: #f59e0b; }
    .status-selected { background: #10b981; }
    .status-rejected { background: #ef4444; }
    .cat-fill { background: #6366f1; }
    .doc-fill { background: #0284c7; }

    .bar-progress-track {
      background: #e2e8f0;
      height: 8px;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 0.25rem;
    }

    .bar-progress-fill {
      background: #002b49;
      height: 100%;
    }

    /* Document KPIs */
    .doc-kpi-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .doc-kpi-item {
      padding: 1rem;
      border-radius: 8px;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .doc-verified { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
    .doc-pending { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
    .doc-rejected { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }

    .doc-kpi-item .count { font-size: 1.5rem; font-weight: 700; }
    .doc-kpi-item .label { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; }

    .outstanding-banner {
      display: flex;
      gap: 0.75rem;
      padding: 0.85rem;
      background: #fff7ed;
      border: 1px solid #fed7aa;
      border-radius: 6px;
      color: #9a3412;
      font-size: 0.85rem;
    }

    .outstanding-banner p { margin: 0.25rem 0 0 0; color: #7c2d12; }

    /* Reconciliation Card */
    .reconcile-card {
      display: flex;
      gap: 1.5rem;
      align-items: center;
    }

    .reconcile-score {
      padding: 1.25rem;
      background: #ecfdf5;
      border: 2px solid #10b981;
      border-radius: 8px;
      text-align: center;
      min-width: 130px;
    }

    .score-val { font-size: 1.8rem; font-weight: 700; color: #047857; display: block; }
    .score-lbl { font-size: 0.75rem; color: #065f46; font-weight: 600; }

    .reconcile-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      font-size: 0.875rem;
    }

    .reconcile-row {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 0.25rem;
    }

    .text-success { color: #059669; }
    .text-warning { color: #d97706; }
    .text-danger { color: #dc2626; }

    /* Badges & Pills */
    .code-pill {
      background: #e0f2fe;
      color: #0369a1;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.8rem;
    }

    .badge-total {
      background: #f1f5f9;
      color: #475569;
      font-size: 0.8rem;
      padding: 0.25rem 0.6rem;
      border-radius: 9999px;
      font-weight: 600;
    }

    .badge-sel { color: #059669; font-weight: 600; }
    .badge-sub { color: #2563eb; font-weight: 600; }
    .badge-vacant { color: #7c3aed; font-weight: 600; }

    .round-badge {
      background: #e2e8f0;
      color: #334155;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.8rem;
    }

    .cutoff-pill {
      display: inline-block;
      margin-right: 0.5rem;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-size: 0.75rem;
    }

    /* Export Center */
    .export-intro-card {
      display: flex;
      gap: 1rem;
      background: #ffffff;
      border-left: 4px solid #002b49;
      border-radius: 8px;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .intro-icon { font-size: 2rem; }
    .intro-text h3 { margin: 0 0 0.25rem 0; color: #002b49; font-size: 1.2rem; }
    .intro-text p { margin: 0; color: #64748b; font-size: 0.9rem; }

    .export-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
    }

    .export-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.25rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 1rem;
    }

    .export-card-icon { font-size: 1.75rem; }
    .export-card-content h4 { margin: 0 0 0.35rem 0; color: #002b49; font-size: 1.05rem; }
    .export-card-content p { margin: 0; color: #64748b; font-size: 0.85rem; line-height: 1.4; }

    .export-card-actions {
      display: flex;
      gap: 0.5rem;
    }

    .btn-export-csv {
      flex: 1;
      background: #065f46;
      color: #ffffff;
      border: none;
      padding: 0.5rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      transition: background 0.2s;
    }

    .btn-export-csv:hover:not(:disabled) { background: #047857; }

    .btn-export-pdf {
      flex: 1;
      background: #991b1b;
      color: #ffffff;
      border: none;
      padding: 0.5rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      transition: background 0.2s;
    }

    .btn-export-pdf:hover:not(:disabled) { background: #b91c1c; }

    .btn-export-csv:disabled, .btn-export-pdf:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Alerts */
    .alert-box {
      padding: 0.75rem 1rem;
      border-radius: 6px;
      font-size: 0.9rem;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .alert-error { background: #fee2e2; color: #991b1b; border: 1px solid #f87171; }
    .alert-success { background: #ecfdf5; color: #065f46; border: 1px solid #6ee7b7; }

    .spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: #ffffff;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 900px) {
      .analytics-grid { grid-template-columns: 1fr; }
      .section-card.full-width { grid-column: span 1; }
    }
  `]
})
export class AdminReportsComponent implements OnInit {
  private reportService = inject(ReportService);
  private adminService = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);

  public activeSubTab: 'overview' | 'applications' | 'documents' | 'merit' | 'financials' | 'export' = 'overview';
  public isLoading: boolean = false;
  public isExporting: boolean = false;
  public errorMessage: string = '';
  public successMessage: string = '';

  // Dropdown options
  public availableSessions: AcademicSession[] = [];
  public availableProgrammes: Programme[] = [];

  // Active filters
  public filters: ReportFilterParams = {
    academicSession: '',
    programmeId: '',
    status: '',
    category: '',
    documentStatus: '',
    paymentStatus: '',
    startDate: '',
    endDate: ''
  };

  // Datasets
  public overviewData: OverviewAnalytics | null = null;
  public applicationData: ApplicationAnalytics | null = null;
  public documentData: DocumentAnalytics | null = null;
  public meritData: MeritAnalytics | null = null;
  public paymentData: PaymentAnalytics | null = null;

  ngOnInit(): void {
    this.loadFilterOptions();
    this.loadOverview();
  }

  public setSubTab(subTab: 'overview' | 'applications' | 'documents' | 'merit' | 'financials' | 'export'): void {
    this.activeSubTab = subTab;
    this.refreshCurrentTab();
  }

  public loadFilterOptions(): void {
    this.adminService.getSessions().subscribe({
      next: (res) => {
        if (res && res.data) {
          this.availableSessions = res.data;
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });

    this.adminService.getProgrammes().subscribe({
      next: (res) => {
        if (res && res.data) {
          this.availableProgrammes = (res.data as any).programmes || (res.data as any) || [];
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });
  }

  public applyFilters(): void {
    this.refreshCurrentTab();
  }

  public resetFilters(): void {
    this.filters = {
      academicSession: '',
      programmeId: '',
      status: '',
      category: '',
      documentStatus: '',
      paymentStatus: '',
      startDate: '',
      endDate: ''
    };
    this.refreshCurrentTab();
  }

  public refreshCurrentTab(): void {
    this.errorMessage = '';
    // Always refresh overview for top ribbon
    this.loadOverview();

    switch (this.activeSubTab) {
      case 'applications':
        this.loadApplications();
        break;
      case 'documents':
        this.loadDocuments();
        break;
      case 'merit':
        this.loadMerit();
        break;
      case 'financials':
        this.loadPayments();
        break;
      default:
        break;
    }
  }

  public loadOverview(): void {
    this.isLoading = true;
    this.reportService.getOverview(this.filters).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res && res.data) {
          this.overviewData = res.data;
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Failed to load overview analytics';
        this.cdr.markForCheck();
      }
    });
  }

  public loadApplications(): void {
    this.isLoading = true;
    this.reportService.getApplicationAnalytics(this.filters).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res && res.data) {
          this.applicationData = res.data;
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Failed to load application analytics';
        this.cdr.markForCheck();
      }
    });
  }

  public loadDocuments(): void {
    this.isLoading = true;
    this.reportService.getDocumentAnalytics(this.filters).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res && res.data) {
          this.documentData = res.data;
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Failed to load document verification analytics';
        this.cdr.markForCheck();
      }
    });
  }

  public loadMerit(): void {
    this.isLoading = true;
    this.reportService.getMeritAnalytics(this.filters).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res && res.data) {
          this.meritData = res.data;
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Failed to load merit and allocation analytics';
        this.cdr.markForCheck();
      }
    });
  }

  public loadPayments(): void {
    this.isLoading = true;
    this.reportService.getPaymentAnalytics(this.filters).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res && res.data) {
          this.paymentData = res.data;
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Failed to load financial analytics';
        this.cdr.markForCheck();
      }
    });
  }

  public exportData(type: ExportReportType, format: ExportFormat): void {
    this.isExporting = true;
    this.errorMessage = '';
    this.successMessage = `Generating ${type} report as ${format.toUpperCase()}...`;

    this.reportService.exportReport(type, format, this.filters).subscribe({
      next: (blob) => {
        this.isExporting = false;
        const filename = `iem-${type}-report-${Date.now()}.${format}`;
        this.reportService.triggerDownload(blob, filename);
        this.successMessage = `Successfully downloaded ${filename}`;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isExporting = false;
        this.errorMessage = 'Failed to generate report export';
        this.cdr.markForCheck();
      }
    });
  }

  // Helpers
  public get docVerificationRate(): number {
    if (!this.overviewData || !this.overviewData.kpis.totalDocuments) return 0;
    const { totalDocuments, verifiedDocuments } = this.overviewData.kpis;
    return Math.round((verifiedDocuments / totalDocuments) * 100);
  }

  public calcPercentage(val: number, total: number): number {
    if (!total || total === 0) return 0;
    return Math.round((val / total) * 100);
  }

  public calcTrendWidth(apps: number): number {
    if (!this.overviewData || !this.overviewData.monthlyTrends.length) return 0;
    const max = Math.max(...this.overviewData.monthlyTrends.map((t) => t.applications), 1);
    return Math.round((apps / max) * 100);
  }
}
