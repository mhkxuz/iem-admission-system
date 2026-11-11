import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface FaqItem {
  question: string;
  answer: string;
  isOpen?: boolean;
}

interface FaqCategory {
  category: string;
  items: FaqItem[];
}

@Component({
  selector: 'app-faqs',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="faqs-page">
      <!-- Header -->
      <header class="page-header">
        <div class="container">
          <span class="badge-tag">Help &amp; Support</span>
          <h1 class="page-title">Frequently Asked Questions</h1>
          <p class="page-subtitle">
            Find answers to commonly asked questions regarding the IEM Online Admission Portal, documentation guidelines, and selection procedures.
          </p>
        </div>
      </header>

      <!-- Main Content -->
      <main class="container content-section">
        <div class="faq-categories">
          <section class="category-section" *ngFor="let cat of faqCategories">
            <h2 class="category-title">{{ cat.category }}</h2>

            <div class="accordion-list">
              <div
                class="accordion-item"
                *ngFor="let item of cat.items"
                [class.expanded]="item.isOpen"
              >
                <button
                  type="button"
                  class="accordion-trigger"
                  (click)="toggleItem(item)"
                  [attr.aria-expanded]="item.isOpen"
                >
                  <span class="q-text">{{ item.question }}</span>
                  <span class="toggle-icon">{{ item.isOpen ? '−' : '+' }}</span>
                </button>
                <div class="accordion-body" *ngIf="item.isOpen">
                  <p>{{ item.answer }}</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <!-- Contact Support Card -->
        <div class="support-card">
          <div class="support-info">
            <h3>Still Have Questions?</h3>
            <p>
              For queries not covered above, or if you need assistance with your online application form,
              please reach out to our Admissions Desk.
            </p>
            <div class="contact-details">
              <span>📍 IEM Salt Lake Campus, Sector V, Kolkata &bull; 700091</span>
              <span>📧 admissions&#64;iem.edu &bull; Helpdesk POC</span>
            </div>
          </div>
          <div class="support-actions">
            <a routerLink="/admission-process" class="btn btn-outline">Review Process</a>
            <a routerLink="/programmes" class="btn btn-gold">Explore Courses</a>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .faqs-page {
      background: #f4f7fa;
      min-height: calc(100vh - 120px);
      padding-bottom: 5rem;
    }
    .container {
      max-width: 960px;
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
    .category-section {
      margin-bottom: 2.5rem;
    }
    .category-title {
      font-size: 1.3rem;
      font-weight: 700;
      color: #0f2b48;
      margin-bottom: 1rem;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 0.5rem;
    }
    .accordion-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .accordion-item {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      overflow: hidden;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .accordion-item.expanded {
      border-color: #cbd5e1;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .accordion-trigger {
      width: 100%;
      background: transparent;
      border: none;
      padding: 1.15rem 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      text-align: left;
      cursor: pointer;
      font-size: 0.98rem;
      font-weight: 600;
      color: #0f2b48;
      transition: background 0.15s;
    }
    .accordion-trigger:hover {
      background: #f8fafc;
    }
    .toggle-icon {
      font-size: 1.25rem;
      font-weight: 700;
      color: #c98a2c;
      margin-left: 1rem;
      flex-shrink: 0;
    }
    .accordion-body {
      padding: 0 1.25rem 1.25rem;
      border-top: 1px solid #f1f5f9;
      font-size: 0.92rem;
      color: #475569;
      line-height: 1.6;
    }
    .accordion-body p {
      margin: 0.85rem 0 0;
    }
    .support-card {
      background: #0f2b48;
      color: #ffffff;
      border-radius: 8px;
      padding: 2.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 2rem;
      margin-top: 3.5rem;
    }
    .support-info h3 {
      font-size: 1.35rem;
      font-weight: 700;
      margin-bottom: 0.35rem;
    }
    .support-info p {
      color: #cbd5e1;
      font-size: 0.92rem;
      margin-bottom: 0.75rem;
      line-height: 1.5;
    }
    .contact-details {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.85rem;
      color: #f7d492;
      font-weight: 500;
    }
    .support-actions {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      flex-shrink: 0;
    }
    .btn {
      display: inline-block;
      padding: 0.65rem 1.4rem;
      border-radius: 5px;
      font-weight: 600;
      font-size: 0.9rem;
      text-decoration: none;
      text-align: center;
      cursor: pointer;
      white-space: nowrap;
    }
    .btn-gold {
      background: #c98a2c;
      color: #0f2b48;
      border: 1px solid #c98a2c;
    }
    .btn-gold:hover {
      background: #df9e38;
    }
    .btn-outline {
      background: transparent;
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.5);
    }
    .btn-outline:hover {
      background: rgba(255, 255, 255, 0.15);
    }
    @media (max-width: 768px) {
      .support-card {
        flex-direction: column;
        align-items: flex-start;
      }
      .support-actions {
        width: 100%;
      }
    }
  `]
})
export class FaqsComponent {
  faqCategories: FaqCategory[] = [
    {
      category: 'General Admissions & Eligibility',
      items: [
        {
          question: 'What are the general academic eligibility criteria for B.Tech programmes?',
          answer:
            'Candidates must have passed 10+2 (Higher Secondary) with Physics and Mathematics as compulsory subjects along with Chemistry, Biotechnology, or Computer Science. A minimum aggregate percentage (typically 60% or as specified per programme) and a valid entrance examination rank (WBJEE, JEE Main, or IEMJEE) are required.',
          isOpen: true
        },
        {
          question: 'Can candidates appearing for their Class 12 board examinations apply?',
          answer:
            'Yes, candidates appearing in the qualifying 10+2 examination may apply provisionally. Admission offers remain subject to producing certified passing marksheets satisfying the minimum aggregate criteria before physical document verification.',
          isOpen: false
        },
        {
          question: 'Are admission seats available under reserved or management categories?',
          answer:
            'Yes, seats are allocated across approved categories including General, OBC, SC, ST, EWS, and Management quota in compliance with university and governmental regulatory guidelines. Exact category seat capacities are published under individual programme specifications.',
          isOpen: false
        }
      ]
    },
    {
      category: 'Online Application & Submission',
      items: [
        {
          question: 'Can I submit multiple applications for different departments?',
          answer:
            'Each registered candidate may submit one active admission application per academic session. You can specify your primary preferred department and review other eligible courses during admissions counseling.',
          isOpen: false
        },
        {
          question: 'How do I know my application has been received successfully?',
          answer:
            'Upon submitting the application form, the system immediately generates a unique Application ID (e.g., IEM-2026-XXXXX) and assigns the initial status "Submitted". You can log into your candidate dashboard at any time to verify submission details.',
          isOpen: false
        },
        {
          question: 'Can I edit my application form after submitting?',
          answer:
            'For security and integrity reasons, submitted applications are locked for committee review. If an essential error occurred in your submitted data, contact the admissions helpdesk with your Application ID before document verification.',
          isOpen: false
        }
      ]
    },
    {
      category: 'Document Uploads & Technical Specifications',
      items: [
        {
          question: 'What file formats and sizes are supported for document uploads?',
          answer:
            'The portal accepts PDF documents and image files (PNG, JPEG, JPG). Each uploaded document must not exceed 5MB in size. Ensure scans are clear and all text, marks, and signatures are legible.',
          isOpen: false
        },
        {
          question: 'Which documents are mandatory to complete the application?',
          answer:
            'Mandatory documents include: (1) Class 10 Marksheet / Passing Certificate, (2) Class 12 Marksheet, and (3) Entrance Examination Scorecard or Rank Card. Additional documents such as Category Certificates should be attached where applicable.',
          isOpen: false
        }
      ]
    },
    {
      category: 'Application Status Tracking & Decision Outcomes',
      items: [
        {
          question: 'What are the different application statuses and what do they mean?',
          answer:
            '"Submitted" means your form and documents have been received. "Under Review" indicates that the admissions committee is evaluating your academic credentials. "Selected" confirms admission approval, while "Rejected" indicates eligibility or cutoff criteria were not met.',
          isOpen: false
        },
        {
          question: 'How long does the committee evaluation typically take?',
          answer:
            'Evaluation timelines depend on the volume of applications and entrance examination counseling rounds. Candidates are encouraged to check their dashboard regularly for status updates.',
          isOpen: false
        }
      ]
    }
  ];

  toggleItem(item: FaqItem): void {
    item.isOpen = !item.isOpen;
  }
}
