import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admission-process',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="process-page">
      <!-- Header -->
      <header class="page-header">
        <div class="container">
          <span class="badge-tag">Guidelines</span>
          <h1 class="page-title">Admission Procedure &amp; Journey</h1>
          <p class="page-subtitle">
            A step-by-step guide to applying for undergraduate and postgraduate admissions at the Institute of Engineering &amp; Management.
          </p>
        </div>
      </header>

      <!-- Steps Content -->
      <main class="container content-section">
        <div class="intro-card">
          <h2>Application Workflow Overview</h2>
          <p>
            The IEM Kolkata admission portal enables prospective candidates to submit their application,
            upload certified academic transcripts, and track review status completely online. Please review
            the 8 sequential stages below before starting your application.
          </p>
        </div>

        <div class="steps-timeline">
          <div class="timeline-step" *ngFor="let s of processSteps">
            <div class="step-badge">
              <span class="step-index">{{ s.step }}</span>
            </div>
            <div class="step-card">
              <div class="step-header">
                <h3>{{ s.title }}</h3>
                <span class="step-tag">{{ s.tag }}</span>
              </div>
              <p class="step-description">{{ s.description }}</p>
              <div class="step-checklist" *ngIf="s.checklist?.length">
                <strong>Key Actions:</strong>
                <ul>
                  <li *ngFor="let item of s.checklist">{{ item }}</li>
                </ul>
              </div>
              <div class="step-note" *ngIf="s.note">
                💡 <strong>Important:</strong> {{ s.note }}
              </div>
            </div>
          </div>
        </div>

        <!-- Document Requirements Summary -->
        <section class="doc-guidelines-card">
          <h2>Standard Documentation Requirements</h2>
          <p class="doc-intro">
            Ensure you have legible, authentic digital copies ready for upload in PDF, PNG, or JPEG format (maximum 5MB per document).
          </p>

          <div class="doc-grid">
            <div class="doc-box">
              <h4>Class 10 Certificate &amp; Marksheet</h4>
              <p>Proof of date of birth and secondary academic foundation (CBSE, ICSE, WBCHSE or recognized state board).</p>
            </div>
            <div class="doc-box">
              <h4>Class 12 / Higher Secondary Marksheet</h4>
              <p>Senior secondary marks statement with verified subject-wise scores in mandatory subjects (Physics, Math, Chemistry/Biology).</p>
            </div>
            <div class="doc-box">
              <h4>Entrance Examination Scorecard / Rank Card</h4>
              <p>Official rank card for WBJEE, JEE Main, IEMJEE, GATE or applicable state/national entrance exam.</p>
            </div>
            <div class="doc-box">
              <h4>Category Certificate (If Applicable)</h4>
              <p>Valid caste/category certificate for SC, ST, OBC, or EWS candidates issued by competent government authority.</p>
            </div>
          </div>
        </section>

        <!-- Call to Action Banner -->
        <div class="cta-banner">
          <div>
            <h3>Ready to Begin Your Application?</h3>
            <p>Ensure your academic credentials and digital documents are accessible before proceeding.</p>
          </div>
          <div class="cta-btns">
            <ng-container *ngIf="authService.currentUser$ | async as user; else guestBtn">
              <a
                [routerLink]="user.role === 'admin' ? '/admin/dashboard' : '/applicant/apply'"
                class="btn btn-gold"
              >
                {{ user.role === 'admin' ? 'Admin Dashboard' : 'Open Application Form' }}
              </a>
            </ng-container>
            <ng-template #guestBtn>
              <a routerLink="/auth/register" class="btn btn-gold">Create Applicant Account</a>
              <a routerLink="/auth/login" class="btn btn-outline">Existing User Sign In</a>
            </ng-template>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .process-page {
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
    .intro-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 2rem;
      margin-bottom: 2.5rem;
    }
    .intro-card h2 {
      font-size: 1.4rem;
      font-weight: 700;
      color: #0f2b48;
      margin-bottom: 0.5rem;
    }
    .intro-card p {
      color: #475569;
      line-height: 1.6;
      margin: 0;
    }
    .steps-timeline {
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
      margin-bottom: 3.5rem;
    }
    .timeline-step {
      display: flex;
      gap: 1.5rem;
      align-items: flex-start;
    }
    .step-badge {
      flex-shrink: 0;
      width: 48px;
      height: 48px;
      background: #0f2b48;
      border: 2px solid #c98a2c;
      color: #ffffff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.15rem;
      font-weight: 800;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
    }
    .step-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.75rem;
      flex-grow: 1;
      box-shadow: 0 2px 8px rgba(0,0,0,0.03);
    }
    .step-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .step-header h3 {
      font-size: 1.25rem;
      font-weight: 700;
      color: #0f2b48;
      margin: 0;
    }
    .step-tag {
      font-size: 0.72rem;
      font-weight: 700;
      background: #f1f5f9;
      color: #1a426e;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .step-description {
      font-size: 0.92rem;
      color: #475569;
      line-height: 1.6;
      margin-bottom: 1rem;
    }
    .step-checklist {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 0.85rem 1.25rem;
      font-size: 0.88rem;
      margin-bottom: 0.75rem;
    }
    .step-checklist strong {
      color: #0f2b48;
      display: block;
      margin-bottom: 0.4rem;
    }
    .step-checklist ul {
      margin: 0;
      padding-left: 1.25rem;
      color: #334155;
    }
    .step-checklist li {
      margin-bottom: 0.25rem;
    }
    .step-note {
      font-size: 0.82rem;
      color: #78350f;
      background: #fffbeb;
      border: 1px solid #fef3c7;
      padding: 0.5rem 0.85rem;
      border-radius: 4px;
    }
    .doc-guidelines-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 2.25rem;
      margin-bottom: 3rem;
    }
    .doc-guidelines-card h2 {
      font-size: 1.35rem;
      font-weight: 700;
      color: #0f2b48;
      margin-bottom: 0.5rem;
    }
    .doc-intro {
      color: #64748b;
      font-size: 0.92rem;
      margin-bottom: 1.75rem;
    }
    .doc-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.25rem;
    }
    .doc-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 1.25rem;
    }
    .doc-box h4 {
      font-size: 0.95rem;
      font-weight: 700;
      color: #0f2b48;
      margin-bottom: 0.35rem;
    }
    .doc-box p {
      font-size: 0.85rem;
      color: #64748b;
      margin: 0;
      line-height: 1.5;
    }
    .cta-banner {
      background: #0f2b48;
      color: #ffffff;
      border-radius: 8px;
      padding: 2.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 2rem;
    }
    .cta-banner h3 {
      font-size: 1.45rem;
      font-weight: 700;
      margin-bottom: 0.35rem;
    }
    .cta-banner p {
      color: #cbd5e1;
      font-size: 0.92rem;
      margin: 0;
    }
    .cta-btns {
      display: flex;
      gap: 1rem;
      flex-shrink: 0;
    }
    .btn {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.92rem;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s;
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
    .btn-outline {
      background: transparent;
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.5);
    }
    .btn-outline:hover {
      background: rgba(255, 255, 255, 0.15);
      border-color: #ffffff;
    }
    @media (max-width: 768px) {
      .doc-grid {
        grid-template-columns: 1fr;
      }
      .cta-banner {
        flex-direction: column;
        align-items: flex-start;
      }
      .timeline-step {
        flex-direction: column;
      }
    }
  `]
})
export class AdmissionProcessComponent {
  public authService = inject(AuthService);

  readonly processSteps = [
    {
      step: '1',
      title: 'Portal Account Registration',
      tag: 'Step 1 &bull; Identity Creation',
      description: 'Create your unique candidate account with your primary email address and secure password.',
      checklist: [
        'Provide your verified email address and active mobile phone number.',
        'Choose a secure password containing uppercase, numbers, and symbols.',
        'Sign in to access your personal candidate dashboard.'
      ],
      note: 'One candidate registration is permitted per email address.'
    },
    {
      step: '2',
      title: 'Explore Programmes & Eligibility',
      tag: 'Step 2 &bull; Course Exploration',
      description: 'Browse the dynamic programme catalogue to identify the degree level, department, and course matching your aspirations.',
      checklist: [
        'Inspect programme duration, curriculum focus, and department.',
        'Check specific 10+2 aggregate percentage benchmarks.',
        'Verify required secondary subjects and approved entrance exams.'
      ],
      note: 'Eligibility criteria are verified against uploaded marksheets during committee review.'
    },
    {
      step: '3',
      title: 'Review Fee Structure & Payment Policies',
      tag: 'Step 3 &bull; Fee Breakdown',
      description: 'Review the session-specific tuition, admission, and semester fee breakdown published by the finance office.',
      checklist: [
        'Review semester-wise tuition breakdown and one-time admission charge.',
        'Note refundable laboratory deposits and extracurricular activity charges.',
        'Familiarize yourself with official fee payment guidelines.'
      ],
      note: 'Fee payments are processed through verified official bank channels.'
    },
    {
      step: '4',
      title: 'Complete Application Form',
      tag: 'Step 4 &bull; Candidate Details',
      description: 'Fill out your comprehensive online application form spanning personal information, academic history, and preferred department.',
      checklist: [
        'Enter full legal name, date of birth, gender, and contact address with PIN code.',
        'Enter Class 10 & 12 board names, passing years, and aggregate percentages.',
        'Select your preferred engineering department and admission category (General, OBC, SC, ST, etc.).'
      ],
      note: 'Ensure your spelling matches your official secondary admit card or certificate.'
    },
    {
      step: '5',
      title: 'Upload Mandatory Document Scans',
      tag: 'Step 5 &bull; Document Verification',
      description: 'Upload certified digital scans of required academic records through the document upload panel.',
      checklist: [
        'Upload Class 10 Marksheet or Pass Certificate.',
        'Upload Class 12 Marksheet with subject-wise scores.',
        'Upload Entrance Exam Rank Card (WBJEE / JEE Main / IEMJEE).'
      ],
      note: 'Uploaded files must be under 5MB in PDF, PNG, or JPEG format.'
    },
    {
      step: '6',
      title: 'Formal Application Submission',
      tag: 'Step 6 &bull; Final Submission',
      description: 'Review the consolidated application preview and submit the application for official evaluation.',
      checklist: [
        'Check all filled fields for accuracy before confirmation.',
        'Submit the application to receive your unique Application ID (e.g. IEM-2026-XXXXX).',
        'Download or print the submission receipt for future reference.'
      ],
      note: 'After submission, form details cannot be edited without admissions office authorization.'
    },
    {
      step: '7',
      title: 'Real-Time Status Tracking',
      tag: 'Step 7 &bull; Committee Evaluation',
      description: 'Log into your applicant dashboard at any time to monitor the review progress in real time.',
      checklist: [
        'Track transition from "Submitted" to "Under Review".',
        'Check committee evaluation remarks and verification notes.',
        'Receive selection/decision outcome updates directly on your dashboard.'
      ],
      note: 'Automated status audit histories preserve the timestamp and committee notes.'
    },
    {
      step: '8',
      title: 'Enrollment & Admission Finalization',
      tag: 'Step 8 &bull; Onboarding',
      description: 'Upon selection, follow institutional counseling and document physical verification instructions.',
      checklist: [
        'Receive official offer communication and counseling dates.',
        'Complete original document physical verification at the Salt Lake campus.',
        'Finalize admission fee remittance and receive student enrollment credentials.'
      ],
      note: 'All final admissions are subject to MAKAUT / AICTE university norms.'
    }
  ];
}
