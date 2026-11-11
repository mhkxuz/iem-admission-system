import { Component, OnInit, inject, ChangeDetectorRef, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, AdminDashboardData, AcademicOverview } from '../../../core/services/admin.service';

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="overview-container">
      <div class="overview-header">
        <div>
          <h3>Institutional &amp; Academic Overview</h3>
          <p>Real-time database metrics for admission sessions, academic programmes, fee structures, and candidate submissions.</p>
        </div>
        <button type="button" class="btn-refresh" (click)="loadOverview()" [disabled]="isLoading">
          &#8635; Refresh Metrics
        </button>
      </div>

      <!-- Loading State -->
      <div *ngIf="isLoading" class="state-card loading">
        <div class="spinner"></div>
        <p>Loading academic overview metrics...</p>
      </div>

      <!-- Error State -->
      <div *ngIf="errorMessage && !isLoading" class="alert-box error">
        <span>{{ errorMessage }}</span>
        <button type="button" class="btn-retry" (click)="loadOverview()">Retry</button>
      </div>

      <!-- Overview Content -->
      <div *ngIf="!isLoading && !errorMessage" class="overview-content">
        <!-- Highlights Grid -->
        <div class="highlights-grid">
          <!-- Active Session Card -->
          <div class="highlight-card session-card">
            <div class="card-icon">&#128197;</div>
            <div class="card-body">
              <span class="card-label">Active Admission Session</span>
              <h4 class="card-value">{{ overview?.activeSession || 'No Active Session' }}</h4>
              <p class="card-sub" *ngIf="overview?.activeSessionDetails">
                Code: <strong>{{ overview?.activeSessionDetails?.sessionCode }}</strong> &bull;
                Status: <span class="badge active">{{ overview?.activeSessionDetails?.status }}</span>
              </p>
              <p class="card-sub text-muted" *ngIf="!overview?.activeSessionDetails">
                No session is currently accepting applications.
              </p>
              <button type="button" class="btn-card-action" (click)="navigateToTab.emit('sessions')">
                Manage Sessions &rarr;
              </button>
            </div>
          </div>

          <!-- Programmes Card -->
          <div class="highlight-card programme-card">
            <div class="card-icon">&#127891;</div>
            <div class="card-body">
              <span class="card-label">Academic Programmes</span>
              <h4 class="card-value">{{ overview?.totalProgrammes || 0 }} Total</h4>
              <p class="card-sub">
                <strong class="text-green">{{ overview?.activeProgrammes || 0 }} Active</strong> &bull;
                <span>{{ overview?.programmesAcceptingApplications || 0 }} Open for Applications</span>
              </p>
              <button type="button" class="btn-card-action" (click)="navigateToTab.emit('programmes')">
                Manage Programmes &rarr;
              </button>
            </div>
          </div>

          <!-- Fee Structures Card -->
          <div class="highlight-card fee-card">
            <div class="card-icon">&#128179;</div>
            <div class="card-body">
              <span class="card-label">Fee Schedules</span>
              <h4 class="card-value">{{ overview?.configuredFeeStructures || 0 }} Configured</h4>
              <p class="card-sub" [class.warning]="(overview?.programmesMissingFee || 0) > 0">
                <span *ngIf="(overview?.programmesMissingFee || 0) === 0" class="text-green">
                  All active programmes have configured fees
                </span>
                <span *ngIf="(overview?.programmesMissingFee || 0) > 0" class="text-amber">
                  &#9888; {{ overview?.programmesMissingFee }} active programme(s) missing fee configuration
                </span>
              </p>
              <button type="button" class="btn-card-action" (click)="navigateToTab.emit('fees')">
                Manage Fee Schedules &rarr;
              </button>
            </div>
          </div>

          <!-- Total Applications Card -->
          <div class="highlight-card app-card">
            <div class="card-icon">&#128196;</div>
            <div class="card-body">
              <span class="card-label">Candidate Applications</span>
              <h4 class="card-value">{{ dashboardData?.metrics?.totalApplications || 0 }} Submissions</h4>
              <p class="card-sub">
                <span>{{ dashboardData?.metrics?.submitted || 0 }} Submitted</span> &bull;
                <span>{{ dashboardData?.metrics?.underReview || 0 }} Under Review</span> &bull;
                <span class="text-green">{{ dashboardData?.metrics?.selected || 0 }} Selected</span>
              </p>
              <button type="button" class="btn-card-action" (click)="navigateToTab.emit('applications')">
                View Applications Directory &rarr;
              </button>
            </div>
          </div>
        </div>

        <!-- Academic Configuration Quick Reference Table -->
        <div class="summary-table-card">
          <h4>Configuration Health &amp; Readiness</h4>
          <table class="health-table">
            <thead>
              <tr>
                <th>Area</th>
                <th>Status</th>
                <th>Current State</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Admission Session</strong></td>
                <td>
                  <span class="status-pill" [class.success]="overview?.activeSession !== 'None'" [class.danger]="overview?.activeSession === 'None'">
                    {{ overview?.activeSession !== 'None' ? 'Operational' : 'Attention Required' }}
                  </span>
                </td>
                <td>
                  {{ overview?.activeSession !== 'None' ? 'Active session: ' + overview?.activeSession : 'No session is currently set to Active' }}
                </td>
                <td>
                  <button type="button" class="btn-link" (click)="navigateToTab.emit('sessions')">Configure Sessions</button>
                </td>
              </tr>
              <tr>
                <td><strong>Programme Catalogue</strong></td>
                <td>
                  <span class="status-pill" [class.success]="(overview?.activeProgrammes || 0) > 0" [class.danger]="(overview?.activeProgrammes || 0) === 0">
                    {{ (overview?.activeProgrammes || 0) > 0 ? 'Active' : 'Empty' }}
                  </span>
                </td>
                <td>
                  {{ overview?.activeProgrammes || 0 }} active programme(s) available for applicants
                </td>
                <td>
                  <button type="button" class="btn-link" (click)="navigateToTab.emit('programmes')">Configure Programmes</button>
                </td>
              </tr>
              <tr>
                <td><strong>Fee Schedules</strong></td>
                <td>
                  <span class="status-pill" [class.success]="(overview?.programmesMissingFee || 0) === 0" [class.warning]="(overview?.programmesMissingFee || 0) > 0">
                    {{ (overview?.programmesMissingFee || 0) === 0 ? 'Complete' : 'Pending Fees' }}
                  </span>
                </td>
                <td>
                  {{ overview?.configuredFeeStructures || 0 }} fee schedule(s) configured in database
                </td>
                <td>
                  <button type="button" class="btn-link" (click)="navigateToTab.emit('fees')">Configure Fees</button>
                </td>
              </tr>
              <tr>
                <td><strong>Application Submissions</strong></td>
                <td>
                  <span class="status-pill success">Live</span>
                </td>
                <td>
                  {{ dashboardData?.metrics?.totalApplications || 0 }} total candidate application(s) recorded
                </td>
                <td>
                  <button type="button" class="btn-link" (click)="navigateToTab.emit('applications')">Review Directory</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .overview-container {
      padding: 0.5rem 0 2rem;
    }
    .overview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      background: #ffffff;
      padding: 1.25rem 1.5rem;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .overview-header h3 {
      margin: 0 0 0.25rem;
      color: #0f2b48;
      font-size: 1.25rem;
    }
    .overview-header p {
      margin: 0;
      color: #64748b;
      font-size: 0.85rem;
    }
    .btn-refresh {
      background: #0f2b48;
      color: #ffffff;
      border: none;
      padding: 0.55rem 1.1rem;
      border-radius: 4px;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .btn-refresh:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .highlights-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.25rem;
      margin-bottom: 1.75rem;
    }
    .highlight-card {
      background: #ffffff;
      border-radius: 8px;
      padding: 1.35rem;
      border: 1px solid #e2e8f0;
      display: flex;
      gap: 1rem;
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .highlight-card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.06);
    }
    .card-icon {
      font-size: 2rem;
      color: #0f2b48;
      background: #f1f5f9;
      width: 50px;
      height: 50px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .card-body {
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .card-label {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 0.25rem;
    }
    .card-value {
      margin: 0 0 0.35rem;
      font-size: 1.35rem;
      color: #0f2b48;
    }
    .card-sub {
      margin: 0 0 0.85rem;
      font-size: 0.8rem;
      color: #475569;
    }
    .card-sub.warning {
      color: #b45309;
    }
    .text-green { color: #059669; font-weight: 600; }
    .text-amber { color: #d97706; font-weight: 600; }
    .text-muted { color: #94a3b8; }
    .badge.active {
      background: #dcfce7;
      color: #15803d;
      padding: 0.1rem 0.4rem;
      border-radius: 3px;
      font-size: 0.7rem;
      font-weight: 700;
    }
    .btn-card-action {
      align-self: flex-start;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      color: #0f2b48;
      padding: 0.35rem 0.75rem;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-card-action:hover {
      background: #e2e8f0;
    }
    .summary-table-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
    }
    .summary-table-card h4 {
      margin: 0 0 1rem;
      color: #0f2b48;
      font-size: 1.1rem;
    }
    .health-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    .health-table th, .health-table td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #edf2f7;
      text-align: left;
    }
    .health-table th {
      background: #f8fafc;
      color: #475569;
      font-weight: 700;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-pill {
      display: inline-block;
      padding: 0.2rem 0.55rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .status-pill.success {
      background: #dcfce7;
      color: #15803d;
    }
    .status-pill.warning {
      background: #fef3c7;
      color: #b45309;
    }
    .status-pill.danger {
      background: #fee2e2;
      color: #b91c1c;
    }
    .btn-link {
      background: none;
      border: none;
      color: #2b6cb0;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
      font-size: 0.85rem;
      text-decoration: underline;
    }
    .state-card {
      background: #ffffff;
      padding: 2.5rem;
      text-align: center;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .spinner {
      border: 3px solid rgba(15,43,72,0.1);
      border-top: 3px solid #0f2b48;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 0.75rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .alert-box.error {
      background: #fef2f2;
      border: 1px solid #f87171;
      color: #991b1b;
      padding: 1rem 1.25rem;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
  `]
})
export class AdminOverviewComponent implements OnInit {
  private adminService = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);

  @Output() navigateToTab = new EventEmitter<string>();

  public isLoading = false;
  public errorMessage = '';
  public dashboardData: AdminDashboardData | null = null;
  public overview: AcademicOverview | null = null;

  ngOnInit(): void {
    this.loadOverview();
  }

  loadOverview(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    this.adminService.getDashboard().subscribe({
      next: (res) => {
        this.isLoading = false;
        this.dashboardData = res.data;
        this.overview = res.data.academicOverview || null;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Failed to load institutional overview.';
        this.cdr.markForCheck();
      }
    });
  }
}
