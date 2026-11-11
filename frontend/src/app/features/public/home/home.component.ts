import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PublicAdmissionService } from '../../../core/services/public-admission.service';
import { AuthService } from '../../../core/services/auth.service';
import { ActiveSession } from '../../../core/models/session.model';
import { Programme } from '../../../core/models/programme.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="home-page">
      <!-- Hero Section -->
      <section class="hero-section">
        <div class="container hero-container">
          <div class="hero-content">
            <span class="badge-tag">Admissions 2026&ndash;2027</span>
            <h1 class="hero-title">Shape Your Future at Institute of Engineering &amp; Management</h1>
            <p class="hero-subtitle">
              Pioneering technical and management education in Kolkata since 1989.
              Apply online for cutting-edge engineering, computing, and professional degree programmes.
            </p>
            <div class="hero-actions">
              <a routerLink="/programmes" class="btn btn-gold">Explore Programmes</a>
              <ng-container *ngIf="authService.currentUser$ | async as user; else guestApply">
                <a
                  [routerLink]="user.role === 'admin' ? '/admin/dashboard' : '/applicant/apply'"
                  class="btn btn-outline"
                >
                  {{ user.role === 'admin' ? 'Admin Dashboard' : 'Continue Application' }}
                </a>
              </ng-container>
              <ng-template #guestApply>
                <a routerLink="/auth/register" class="btn btn-outline">Apply Now</a>
              </ng-template>
            </div>
          </div>
          <div class="hero-card-side">
            <div class="session-card" *ngIf="activeSession; else sessionLoading">
              <div class="session-header">
                <span class="status-indicator" [class.open]="activeSession.isApplicationOpen"></span>
                <span class="status-label">
                  {{ activeSession.isApplicationOpen ? 'Admissions Open' : 'Session Announced' }}
                </span>
              </div>
              <h3>Academic Session {{ activeSession.sessionName }}</h3>
              <p class="session-code">Session Code: {{ activeSession.sessionCode }}</p>
              <div class="session-dates" *ngIf="activeSession.applicationStartDate || activeSession.applicationEndDate">
                <div class="date-item" *ngIf="activeSession.applicationStartDate">
                  <span class="d-label">Applications Open</span>
                  <span class="d-val">{{ activeSession.applicationStartDate | date:'mediumDate' }}</span>
                </div>
                <div class="date-item" *ngIf="activeSession.applicationEndDate">
                  <span class="d-label">Closing Date</span>
                  <span class="d-val">{{ activeSession.applicationEndDate | date:'mediumDate' }}</span>
                </div>
              </div>
              <div class="session-footer">
                <a routerLink="/programmes" class="session-link">View Eligible Programmes &rarr;</a>
              </div>
            </div>
            <ng-template #sessionLoading>
              <div class="session-card loading-card">
                <p>Loading current admission session details...</p>
              </div>
            </ng-template>
          </div>
        </div>
      </section>

      <!-- Key Portal Highlights -->
      <section class="highlights-section">
        <div class="container">
          <div class="highlights-grid">
            <div class="highlight-item">
              <div class="icon-box">🎓</div>
              <h3>Accredited Excellence</h3>
              <p>Top-ranked engineering &amp; management institute with NBA &amp; NAAC accreditations.</p>
            </div>
            <div class="highlight-item">
              <div class="icon-box">💻</div>
              <h3>100% Online Process</h3>
              <p>Transparent application submission, document uploads, and real-time status tracking.</p>
            </div>
            <div class="highlight-item">
              <div class="icon-box">🏛️</div>
              <h3>Salt Lake Campus</h3>
              <p>Located in Kolkata's prime IT hub with state-of-the-art laboratories and research facilities.</p>
            </div>
            <div class="highlight-item">
              <div class="icon-box">🚀</div>
              <h3>Proven Career Placement</h3>
              <p>Consistent track record of multi-offer placements with tier-1 global recruiters.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Featured Programmes Section -->
      <section class="section programmes-preview">
        <div class="container">
          <div class="section-header">
            <div>
              <span class="section-tag">Academic Catalogue</span>
              <h2 class="section-title">Featured Academic Programmes</h2>
              <p class="section-subtitle">Choose from verified undergraduate and postgraduate degree programmes.</p>
            </div>
            <a routerLink="/programmes" class="btn btn-secondary">View All Programmes &rarr;</a>
          </div>

          <div *ngIf="isLoadingProgrammes" class="loading-state">
            <div class="spinner"></div>
            <p>Loading programmes from catalogue...</p>
          </div>

          <div *ngIf="!isLoadingProgrammes && featuredProgrammes.length > 0" class="programmes-grid">
            <div class="programme-card" *ngFor="let prog of featuredProgrammes">
              <div class="card-badge">{{ prog.degreeLevel }} &bull; {{ prog.degree }}</div>
              <h3 class="card-title">{{ prog.programmeName }}</h3>
              <p class="card-dept">{{ prog.department }}</p>
              <div class="card-meta">
                <span>⏱️ {{ prog.duration }} {{ prog.durationUnit }}</span>
                <span *ngIf="prog.seatCapacity">👥 {{ prog.seatCapacity.total }} Seats</span>
              </div>
              <p class="card-desc" *ngIf="prog.description">
                {{ prog.description | slice:0:120 }}...
              </p>
              <div class="card-actions">
                <a [routerLink]="['/programmes', prog._id]" class="btn-card">Programme Details</a>
                <a [routerLink]="['/fees']" [queryParams]="{ programme: prog._id }" class="btn-card-fee">Fee Structure</a>
              </div>
            </div>
          </div>

          <div *ngIf="!isLoadingProgrammes && featuredProgrammes.length === 0" class="empty-state-box">
            <p>Academic programmes are being updated for the active session. Check back shortly.</p>
            <a routerLink="/programmes" class="btn btn-gold">Explore Programme Catalogue</a>
          </div>
        </div>
      </section>

      <!-- 8-Step Admission Journey -->
      <section class="section journey-section">
        <div class="container">
          <div class="section-header text-center">
            <span class="section-tag">Application Guide</span>
            <h2 class="section-title">Online Admission Journey</h2>
            <p class="section-subtitle">Complete your admission in 8 straightforward digital steps.</p>
          </div>

          <div class="journey-grid">
            <div class="journey-step" *ngFor="let step of steps">
              <div class="step-num">{{ step.number }}</div>
              <h4>{{ step.title }}</h4>
              <p>{{ step.description }}</p>
            </div>
          </div>

          <div class="journey-cta">
            <a routerLink="/admission-process" class="btn btn-gold">Read Complete Admission Guidelines</a>
          </div>
        </div>
      </section>

      <!-- Announcements & Important Notices -->
      <section class="section notices-section">
        <div class="container">
          <div class="section-header">
            <div>
              <span class="section-tag">Notice Board</span>
              <h2 class="section-title">Admission Announcements</h2>
              <p class="section-subtitle">Important dates, notifications, and portal updates.</p>
            </div>
            <a routerLink="/announcements" class="btn btn-secondary">All Announcements</a>
          </div>

          <div class="notice-container">
            <div class="empty-notice-card">
              <span class="notice-icon">📢</span>
              <div class="notice-text">
                <h4>No active public notices currently posted</h4>
                <p>
                  Official counseling schedules, cutoff lists, and merit announcements will appear here
                  as released by the IEM Admissions Office.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .home-page {
      background: #f4f7fa;
      color: #1e293b;
    }
    .container {
      max-width: 1240px;
      margin: 0 auto;
      padding: 0 1.5rem;
    }
    .hero-section {
      background: linear-gradient(135deg, #0f2b48 0%, #1a426e 100%);
      color: #ffffff;
      padding: 4.5rem 0 5rem;
    }
    .hero-container {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 3rem;
      align-items: center;
    }
    .badge-tag {
      display: inline-block;
      background: rgba(201, 138, 44, 0.2);
      border: 1px solid #c98a2c;
      color: #f7d492;
      padding: 0.3rem 0.85rem;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 600;
      letter-spacing: 0.5px;
      margin-bottom: 1rem;
    }
    .hero-title {
      font-size: 2.6rem;
      font-weight: 800;
      line-height: 1.2;
      margin-bottom: 1.25rem;
      letter-spacing: -0.5px;
    }
    .hero-subtitle {
      font-size: 1.1rem;
      line-height: 1.6;
      color: #d1e2f2;
      margin-bottom: 2rem;
      max-width: 580px;
    }
    .hero-actions {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .btn {
      display: inline-block;
      padding: 0.75rem 1.6rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.95rem;
      text-decoration: none;
      transition: all 0.2s ease-in-out;
      cursor: pointer;
      text-align: center;
    }
    .btn-gold {
      background: #c98a2c;
      color: #0f2b48;
      border: 1px solid #c98a2c;
    }
    .btn-gold:hover {
      background: #df9e38;
      color: #0b1f34;
      transform: translateY(-1px);
    }
    .btn-outline {
      background: transparent;
      color: #ffffff;
      border: 1.5px solid rgba(255, 255, 255, 0.6);
    }
    .btn-outline:hover {
      background: rgba(255, 255, 255, 0.15);
      border-color: #ffffff;
    }
    .btn-secondary {
      background: #e2e8f0;
      color: #0f2b48;
      border: 1px solid #cbd5e1;
      padding: 0.55rem 1.2rem;
      font-size: 0.88rem;
    }
    .btn-secondary:hover {
      background: #cbd5e1;
    }
    .session-card {
      background: #ffffff;
      color: #0f2b48;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
    }
    .session-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }
    .status-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #94a3b8;
    }
    .status-indicator.open {
      background: #16a34a;
      box-shadow: 0 0 8px rgba(22, 163, 74, 0.6);
    }
    .status-label {
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f2b48;
    }
    .session-card h3 {
      font-size: 1.45rem;
      margin-bottom: 0.25rem;
      color: #0f2b48;
      font-weight: 700;
    }
    .session-code {
      font-size: 0.85rem;
      color: #64748b;
      margin-bottom: 1.5rem;
      font-weight: 500;
    }
    .session-dates {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      padding: 1rem 0;
      border-top: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
      margin-bottom: 1.25rem;
    }
    .date-item {
      display: flex;
      flex-direction: column;
    }
    .d-label {
      font-size: 0.75rem;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
    }
    .d-val {
      font-size: 0.95rem;
      font-weight: 700;
      color: #0f2b48;
      margin-top: 0.25rem;
    }
    .session-footer {
      text-align: right;
    }
    .session-link {
      color: #1a426e;
      font-weight: 600;
      font-size: 0.9rem;
      text-decoration: none;
    }
    .session-link:hover {
      text-decoration: underline;
    }
    .loading-card {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.1);
      border: 1px dashed rgba(255, 255, 255, 0.3);
      padding: 2.5rem;
      text-align: center;
    }
    .highlights-section {
      background: #ffffff;
      padding: 3rem 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .highlights-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.5rem;
    }
    .highlight-item {
      padding: 1rem;
    }
    .icon-box {
      font-size: 2rem;
      margin-bottom: 0.75rem;
    }
    .highlight-item h3 {
      font-size: 1.05rem;
      font-weight: 700;
      margin-bottom: 0.4rem;
      color: #0f2b48;
    }
    .highlight-item p {
      font-size: 0.88rem;
      color: #64748b;
      line-height: 1.5;
    }
    .section {
      padding: 4.5rem 0;
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 2.5rem;
    }
    .section-header.text-center {
      text-align: center;
      display: block;
    }
    .section-tag {
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #c98a2c;
      display: block;
      margin-bottom: 0.35rem;
    }
    .section-title {
      font-size: 1.9rem;
      font-weight: 800;
      color: #0f2b48;
      letter-spacing: -0.3px;
    }
    .section-subtitle {
      font-size: 0.95rem;
      color: #64748b;
      margin-top: 0.35rem;
    }
    .programmes-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
    }
    .programme-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .programme-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
      border-color: #cbd5e1;
    }
    .card-badge {
      font-size: 0.75rem;
      font-weight: 700;
      color: #1a426e;
      text-transform: uppercase;
      margin-bottom: 0.5rem;
    }
    .card-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: #0f2b48;
      margin-bottom: 0.35rem;
      line-height: 1.35;
    }
    .card-dept {
      font-size: 0.85rem;
      color: #64748b;
      margin-bottom: 1rem;
    }
    .card-meta {
      display: flex;
      gap: 1rem;
      font-size: 0.8rem;
      font-weight: 600;
      color: #0f2b48;
      background: #f8fafc;
      padding: 0.5rem 0.75rem;
      border-radius: 4px;
      margin-bottom: 1rem;
    }
    .card-desc {
      font-size: 0.85rem;
      color: #475569;
      line-height: 1.5;
      margin-bottom: 1.5rem;
      flex-grow: 1;
    }
    .card-actions {
      display: flex;
      gap: 0.75rem;
    }
    .btn-card {
      flex: 1;
      text-align: center;
      background: #0f2b48;
      color: #ffffff;
      padding: 0.5rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.2s;
    }
    .btn-card:hover {
      background: #1a426e;
    }
    .btn-card-fee {
      background: #f1f5f9;
      color: #0f2b48;
      padding: 0.5rem 0.85rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
      border: 1px solid #cbd5e1;
    }
    .btn-card-fee:hover {
      background: #e2e8f0;
    }
    .empty-state-box {
      background: #ffffff;
      border: 1px dashed #cbd5e1;
      padding: 3rem 2rem;
      text-align: center;
      border-radius: 8px;
    }
    .empty-state-box p {
      color: #64748b;
      margin-bottom: 1.25rem;
    }
    .journey-section {
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
    }
    .journey-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.5rem;
      margin-bottom: 3rem;
    }
    .journey-step {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.5rem;
      position: relative;
    }
    .step-num {
      width: 32px;
      height: 32px;
      background: #c98a2c;
      color: #0f2b48;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 0.9rem;
      margin-bottom: 1rem;
    }
    .journey-step h4 {
      font-size: 1rem;
      font-weight: 700;
      color: #0f2b48;
      margin-bottom: 0.5rem;
    }
    .journey-step p {
      font-size: 0.85rem;
      color: #64748b;
      line-height: 1.5;
    }
    .journey-cta {
      text-align: center;
    }
    .notice-container {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.5rem;
    }
    .empty-notice-card {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      padding: 1rem;
    }
    .notice-icon {
      font-size: 2.2rem;
      flex-shrink: 0;
    }
    .notice-text h4 {
      font-size: 1rem;
      font-weight: 700;
      color: #0f2b48;
      margin-bottom: 0.25rem;
    }
    .notice-text p {
      font-size: 0.88rem;
      color: #64748b;
      line-height: 1.5;
      margin: 0;
    }
    .loading-state {
      text-align: center;
      padding: 3rem;
      color: #64748b;
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
    @media (max-width: 992px) {
      .hero-container {
        grid-template-columns: 1fr;
      }
      .highlights-grid {
        grid-template-columns: 1fr 1fr;
      }
      .journey-grid {
        grid-template-columns: 1fr 1fr;
      }
    }
    @media (max-width: 600px) {
      .hero-title {
        font-size: 2rem;
      }
      .highlights-grid {
        grid-template-columns: 1fr;
      }
      .journey-grid {
        grid-template-columns: 1fr;
      }
      .section-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
      }
    }
  `]
})
export class HomeComponent implements OnInit {
  public admissionService = inject(PublicAdmissionService);
  public authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  activeSession: ActiveSession | null = null;
  featuredProgrammes: Programme[] = [];
  isLoadingProgrammes = true;

  readonly steps = [
    { number: '1', title: 'Account Registration', description: 'Create an applicant account with email and contact credentials.' },
    { number: '2', title: 'Explore Programmes', description: 'Review eligible engineering, technology and computing courses.' },
    { number: '3', title: 'Check Eligibility & Fees', description: 'Confirm Class 12 percentages, subject requirements and semester fees.' },
    { number: '4', title: 'Fill Application Form', description: 'Provide personal, contact, Class 10/12, and entrance rank details.' },
    { number: '5', title: 'Upload Marksheets', description: 'Attach clear PDFs or images of Class 10/12 marksheets and rank cards.' },
    { number: '6', title: 'Review & Submit', description: 'Review all filled sections and formally submit your admission request.' },
    { number: '7', title: 'Real-Time Tracking', description: 'Track status updates: Submitted, Under Review, or Decision.' },
    { number: '8', title: 'Admission Finalization', description: 'Follow document verification and enrollment counseling schedules.' }
  ];

  ngOnInit(): void {
    this.admissionService.getActiveSession().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.activeSession = res.data;
          this.cdr.markForCheck();
        }
      },
      error: () => {
        // Keep activeSession null gracefully
      }
    });

    this.admissionService.getProgrammes().subscribe({
      next: (res) => {
        this.isLoadingProgrammes = false;
        if (res.success && Array.isArray(res.data)) {
          this.featuredProgrammes = res.data.slice(0, 6);
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoadingProgrammes = false;
        this.featuredProgrammes = [];
        this.cdr.markForCheck();
      }
    });
  }
}
