import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PublicAdmissionService } from '../../../core/services/public-admission.service';

export interface AnnouncementItem {
  id?: string;
  title: string;
  publishDate: string;
  category: string;
  content: string;
  attachmentUrl?: string;
}

@Component({
  selector: 'app-announcements',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="announcements-page">
      <!-- Header -->
      <header class="page-header">
        <div class="container">
          <span class="badge-tag">Official Notices</span>
          <h1 class="page-title">Admission Announcements</h1>
          <p class="page-subtitle">
            Official circulars, counseling schedules, and critical admission notices released by the Institute of Engineering &amp; Management.
          </p>
        </div>
      </header>

      <!-- Main Content -->
      <main class="container content-section">
        <!-- Loading State -->
        <div *ngIf="isLoading" class="loading-state">
          <div class="spinner"></div>
          <p>Checking for recent notices...</p>
        </div>

        <!-- Announcements List (When announcements exist) -->
        <div *ngIf="!isLoading && announcements.length > 0" class="announcements-list">
          <article class="notice-card" *ngFor="let item of announcements">
            <div class="notice-meta">
              <span class="notice-category">{{ item.category }}</span>
              <span class="notice-date">{{ item.publishDate | date:'mediumDate' }}</span>
            </div>
            <h2 class="notice-title">{{ item.title }}</h2>
            <p class="notice-body">{{ item.content }}</p>
            <div class="notice-footer" *ngIf="item.attachmentUrl">
              <a [href]="item.attachmentUrl" target="_blank" rel="noopener noreferrer" class="btn-attach">
                📎 Download Official Notice (PDF)
              </a>
            </div>
          </article>
        </div>

        <!-- Empty State (When no announcements are posted) -->
        <div *ngIf="!isLoading && announcements.length === 0" class="empty-notice-state">
          <div class="empty-illustration">📢</div>
          <h2>No Official Notices at this Time</h2>
          <p>
            There are no active admission notices, cutoff circulars, or counseling alerts published right now.
            All official notifications regarding entrance examinations, document verification schedules,
            and merit list publications will be posted here as soon as they are announced by the IEM Admissions Office.
          </p>
          <div class="notice-guidance">
            <h4>General Admission Inquiries</h4>
            <p>
              Candidates seeking immediate information on ongoing applications may visit the
              <a routerLink="/programmes">Programmes Catalogue</a>, review the
              <a routerLink="/admission-process">Admission Process</a>, or contact the Admissions Helpdesk.
            </p>
          </div>
          <div class="empty-actions">
            <a routerLink="/programmes" class="btn btn-gold">Explore Programmes</a>
            <a routerLink="/faqs" class="btn btn-secondary">Read FAQs</a>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .announcements-page {
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
    .loading-state {
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
    .announcements-list {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .notice-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 2rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
    }
    .notice-meta {
      display: flex;
      gap: 1rem;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .notice-category {
      background: #e0f2fe;
      color: #0369a1;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .notice-date {
      font-size: 0.85rem;
      color: #64748b;
    }
    .notice-title {
      font-size: 1.3rem;
      font-weight: 700;
      color: #0f2b48;
      margin-bottom: 0.75rem;
    }
    .notice-body {
      font-size: 0.95rem;
      color: #334155;
      line-height: 1.6;
      margin-bottom: 1.25rem;
    }
    .btn-attach {
      display: inline-block;
      background: #f1f5f9;
      color: #0f2b48;
      border: 1px solid #cbd5e1;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
    }
    .btn-attach:hover {
      background: #e2e8f0;
    }
    .empty-notice-state {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 4rem 2.5rem;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
    }
    .empty-illustration {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    .empty-notice-state h2 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #0f2b48;
      margin-bottom: 0.75rem;
    }
    .empty-notice-state p {
      font-size: 0.95rem;
      color: #64748b;
      max-width: 600px;
      margin: 0 auto 1.75rem;
      line-height: 1.6;
    }
    .notice-guidance {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 1.25rem;
      max-width: 580px;
      margin: 0 auto 2rem;
      text-align: left;
    }
    .notice-guidance h4 {
      font-size: 0.95rem;
      font-weight: 700;
      color: #0f2b48;
      margin-bottom: 0.35rem;
    }
    .notice-guidance p {
      font-size: 0.88rem;
      color: #475569;
      margin: 0;
      line-height: 1.5;
    }
    .notice-guidance a {
      color: #1a426e;
      font-weight: 600;
      text-decoration: none;
    }
    .notice-guidance a:hover {
      text-decoration: underline;
    }
    .empty-actions {
      display: flex;
      justify-content: center;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .btn {
      display: inline-block;
      padding: 0.7rem 1.5rem;
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
  `]
})
export class AnnouncementsComponent implements OnInit {
  private admissionService = inject(PublicAdmissionService);

  announcements: AnnouncementItem[] = [];
  isLoading = true;

  ngOnInit(): void {
    this.admissionService.getAnnouncements().subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && Array.isArray(res.data)) {
          this.announcements = res.data;
        } else {
          this.announcements = [];
        }
      },
      error: () => {
        this.isLoading = false;
        this.announcements = [];
      }
    });
  }
}
