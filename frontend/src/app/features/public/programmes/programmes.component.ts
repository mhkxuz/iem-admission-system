import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PublicAdmissionService } from '../../../core/services/public-admission.service';
import { Programme } from '../../../core/models/programme.model';

@Component({
  selector: 'app-programmes',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="programmes-page">
      <!-- Page Header -->
      <header class="page-header">
        <div class="container">
          <span class="badge-tag">Academic Catalogue</span>
          <h1 class="page-title">Programmes Offered</h1>
          <p class="page-subtitle">
            Explore academic degree programmes offered by the Institute of Engineering &amp; Management.
            Filter by degree level or department to find your course of study.
          </p>
        </div>
      </header>

      <!-- Main Content -->
      <section class="catalogue-section">
        <div class="container">
          <!-- Filters & Search Toolbar -->
          <div class="filter-toolbar">
            <div class="search-box">
              <input
                type="text"
                [(ngModel)]="searchQuery"
                (ngModelChange)="applyFilters()"
                placeholder="Search by programme name or code (e.g. CSE, IT, MCA)..."
                class="search-input"
              />
              <span class="search-icon">🔍</span>
            </div>

            <div class="filter-controls">
              <div class="control-group">
                <label for="degreeFilter">Degree Level:</label>
                <select
                  id="degreeFilter"
                  [(ngModel)]="selectedDegreeLevel"
                  (ngModelChange)="applyFilters()"
                  class="select-input"
                >
                  <option value="">All Degree Levels</option>
                  <option value="Undergraduate">Undergraduate</option>
                  <option value="Postgraduate">Postgraduate</option>
                  <option value="Diploma">Diploma</option>
                  <option value="Doctoral">Doctoral</option>
                </select>
              </div>

              <div class="control-group">
                <label for="deptFilter">Department:</label>
                <select
                  id="deptFilter"
                  [(ngModel)]="selectedDepartment"
                  (ngModelChange)="applyFilters()"
                  class="select-input"
                >
                  <option value="">All Departments</option>
                  <option *ngFor="let dept of availableDepartments" [value]="dept">
                    {{ dept }}
                  </option>
                </select>
              </div>

              <button
                *ngIf="searchQuery || selectedDegreeLevel || selectedDepartment"
                (click)="resetFilters()"
                class="btn-reset"
              >
                Reset Filters
              </button>
            </div>
          </div>

          <!-- Active Filter Counter -->
          <div class="results-meta" *ngIf="!isLoading && !errorMessage">
            <span>Showing {{ filteredProgrammes.length }} of {{ allProgrammes.length }} programmes</span>
          </div>

          <!-- Loading State -->
          <div *ngIf="isLoading" class="loading-state">
            <div class="spinner"></div>
            <p>Loading programmes catalogue from admission database...</p>
          </div>

          <!-- Error State -->
          <div *ngIf="errorMessage" class="error-state">
            <span class="err-icon">⚠️</span>
            <h3>Unable to Load Programmes</h3>
            <p>{{ errorMessage }}</p>
            <button (click)="loadProgrammes()" class="btn-retry">Retry Connection</button>
          </div>

          <!-- Empty State (No matching filters or no programmes) -->
          <div
            *ngIf="!isLoading && !errorMessage && filteredProgrammes.length === 0"
            class="empty-state"
          >
            <span class="empty-icon">📂</span>
            <h3>No Programmes Found</h3>
            <p *ngIf="searchQuery || selectedDegreeLevel || selectedDepartment">
              No academic programmes match your current filter criteria. Try adjusting your search keywords or resetting filters.
            </p>
            <p *ngIf="!searchQuery && !selectedDegreeLevel && !selectedDepartment">
              No academic programmes are currently published for the active session. Please check back later.
            </p>
            <button
              *ngIf="searchQuery || selectedDegreeLevel || selectedDepartment"
              (click)="resetFilters()"
              class="btn-retry"
            >
              Clear All Filters
            </button>
          </div>

          <!-- Programmes Grid -->
          <div *ngIf="!isLoading && !errorMessage && filteredProgrammes.length > 0" class="cards-grid">
            <article class="programme-card" *ngFor="let prog of filteredProgrammes">
              <div class="card-top">
                <span class="badge-level">{{ prog.degreeLevel }}</span>
                <span class="badge-code">{{ prog.programmeCode }}</span>
              </div>

              <h2 class="card-title">
                <a [routerLink]="['/programmes', prog._id]">{{ prog.programmeName }}</a>
              </h2>
              <p class="card-dept">🏛️ {{ prog.department }}</p>

              <div class="card-highlights">
                <div class="highlight-pill">
                  <span class="hl-label">Degree</span>
                  <span class="hl-val">{{ prog.degree }}</span>
                </div>
                <div class="highlight-pill">
                  <span class="hl-label">Duration</span>
                  <span class="hl-val">{{ prog.duration }} {{ prog.durationUnit }}</span>
                </div>
                <div class="highlight-pill" *ngIf="prog.seatCapacity?.total">
                  <span class="hl-label">Seat Capacity</span>
                  <span class="hl-val">{{ prog.seatCapacity?.total }} Seats</span>
                </div>
              </div>

              <div class="eligibility-snippet" *ngIf="prog.eligibility">
                <strong>Eligibility:</strong>
                <span *ngIf="prog.eligibility.minClass12Percentage">
                  Min {{ prog.eligibility.minClass12Percentage }}% in 10+2
                </span>
                <span *ngIf="prog.eligibility.acceptedEntranceExams?.length">
                  &bull; Exams: {{ prog.eligibility.acceptedEntranceExams?.join(', ') }}
                </span>
              </div>

              <p class="card-desc" *ngIf="prog.description">
                {{ prog.description | slice:0:140 }}{{ prog.description.length > 140 ? '...' : '' }}
              </p>

              <div class="card-footer">
                <a [routerLink]="['/programmes', prog._id]" class="btn-primary">
                  View Programme Details
                </a>
                <a [routerLink]="['/fees']" [queryParams]="{ programme: prog._id }" class="btn-outline-small">
                  Fee Breakdown
                </a>
              </div>
            </article>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .programmes-page {
      background: #f4f7fa;
      min-height: calc(100vh - 120px);
      padding-bottom: 5rem;
    }
    .container {
      max-width: 1240px;
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
    .catalogue-section {
      padding: 2.5rem 0;
    }
    .filter-toolbar {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
    }
    .search-box {
      position: relative;
      width: 100%;
    }
    .search-input {
      width: 100%;
      padding: 0.75rem 2.5rem 0.75rem 1rem;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 0.95rem;
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.2s;
    }
    .search-input:focus {
      border-color: #0f2b48;
      box-shadow: 0 0 0 3px rgba(15, 43, 72, 0.1);
    }
    .search-icon {
      position: absolute;
      right: 0.9rem;
      top: 50%;
      transform: translateY(-50%);
      color: #94a3b8;
    }
    .filter-controls {
      display: flex;
      gap: 1.5rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .control-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .control-group label {
      font-size: 0.88rem;
      font-weight: 600;
      color: #475569;
    }
    .select-input {
      padding: 0.55rem 1rem;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 0.88rem;
      background: #ffffff;
      color: #1e293b;
      outline: none;
    }
    .btn-reset {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      color: #475569;
      padding: 0.5rem 0.85rem;
      border-radius: 4px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-reset:hover {
      background: #e2e8f0;
    }
    .results-meta {
      font-size: 0.88rem;
      color: #64748b;
      font-weight: 500;
      margin-bottom: 1.25rem;
    }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 1.5rem;
    }
    .programme-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.75rem;
      display: flex;
      flex-direction: column;
      transition: box-shadow 0.2s, transform 0.2s;
    }
    .programme-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
      border-color: #cbd5e1;
    }
    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .badge-level {
      font-size: 0.75rem;
      font-weight: 700;
      background: #e0f2fe;
      color: #0369a1;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .badge-code {
      font-size: 0.8rem;
      font-weight: 700;
      background: #f1f5f9;
      color: #475569;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
    }
    .card-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: #0f2b48;
      margin-bottom: 0.35rem;
      line-height: 1.3;
    }
    .card-title a {
      color: inherit;
      text-decoration: none;
    }
    .card-title a:hover {
      color: #1a426e;
      text-decoration: underline;
    }
    .card-dept {
      font-size: 0.85rem;
      color: #64748b;
      margin-bottom: 1rem;
    }
    .card-highlights {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }
    .highlight-pill {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 0.35rem 0.65rem;
      border-radius: 4px;
      display: flex;
      flex-direction: column;
    }
    .hl-label {
      font-size: 0.68rem;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 600;
    }
    .hl-val {
      font-size: 0.82rem;
      font-weight: 700;
      color: #0f2b48;
    }
    .eligibility-snippet {
      font-size: 0.82rem;
      color: #334155;
      background: #fffbeb;
      border: 1px solid #fef3c7;
      padding: 0.5rem 0.75rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      line-height: 1.4;
    }
    .card-desc {
      font-size: 0.85rem;
      color: #475569;
      line-height: 1.5;
      margin-bottom: 1.5rem;
      flex-grow: 1;
    }
    .card-footer {
      display: flex;
      gap: 0.75rem;
    }
    .btn-primary {
      flex: 1;
      text-align: center;
      background: #0f2b48;
      color: #ffffff;
      padding: 0.65rem;
      border-radius: 4px;
      font-size: 0.88rem;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.2s;
    }
    .btn-primary:hover {
      background: #1a426e;
    }
    .btn-outline-small {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      color: #0f2b48;
      padding: 0.65rem 0.85rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s;
    }
    .btn-outline-small:hover {
      background: #f8fafc;
      border-color: #94a3b8;
    }
    .loading-state, .error-state, .empty-state {
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
    .err-icon, .empty-icon {
      font-size: 2.5rem;
      display: block;
      margin-bottom: 1rem;
    }
    .error-state h3, .empty-state h3 {
      font-size: 1.3rem;
      color: #0f2b48;
      margin-bottom: 0.5rem;
      font-weight: 700;
    }
    .error-state p, .empty-state p {
      max-width: 480px;
      margin: 0 auto 1.5rem;
      font-size: 0.95rem;
      line-height: 1.5;
    }
    .btn-retry {
      background: #0f2b48;
      color: #ffffff;
      border: none;
      padding: 0.65rem 1.5rem;
      border-radius: 4px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-retry:hover {
      background: #1a426e;
    }
    @media (max-width: 768px) {
      .cards-grid {
        grid-template-columns: 1fr;
      }
      .filter-controls {
        flex-direction: column;
        align-items: stretch;
      }
      .control-group {
        flex-direction: column;
        align-items: flex-start;
      }
      .select-input {
        width: 100%;
      }
    }
  `]
})
export class ProgrammesComponent implements OnInit {
  private admissionService = inject(PublicAdmissionService);
  private cdr = inject(ChangeDetectorRef);

  allProgrammes: Programme[] = [];
  filteredProgrammes: Programme[] = [];
  availableDepartments: string[] = [];

  searchQuery = '';
  selectedDegreeLevel = '';
  selectedDepartment = '';

  isLoading = true;
  errorMessage = '';

  ngOnInit(): void {
    this.loadProgrammes();
  }

  loadProgrammes(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    this.admissionService.getProgrammes().subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && Array.isArray(res.data)) {
          this.allProgrammes = res.data;
          this.extractDepartments();
          this.applyFilters();
        } else {
          this.allProgrammes = [];
          this.filteredProgrammes = [];
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage =
          err.error?.message || 'Could not connect to the admissions programme catalogue.';
        this.cdr.markForCheck();
      }
    });
  }

  extractDepartments(): void {
    const depts = new Set<string>();
    for (const prog of this.allProgrammes) {
      if (prog.department) {
        depts.add(prog.department);
      }
    }
    this.availableDepartments = Array.from(depts).sort();
    this.cdr.markForCheck();
  }

  applyFilters(): void {
    const query = this.searchQuery.trim().toLowerCase();
    this.filteredProgrammes = this.allProgrammes.filter((prog) => {
      // Search matching
      const matchesSearch =
        !query ||
        prog.programmeName.toLowerCase().includes(query) ||
        prog.programmeCode.toLowerCase().includes(query) ||
        prog.department.toLowerCase().includes(query);

      // Degree level matching
      const matchesDegree =
        !this.selectedDegreeLevel || prog.degreeLevel === this.selectedDegreeLevel;

      // Department matching
      const matchesDept =
        !this.selectedDepartment || prog.department === this.selectedDepartment;

      return matchesSearch && matchesDegree && matchesDept;
    });
    this.cdr.markForCheck();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.selectedDegreeLevel = '';
    this.selectedDepartment = '';
    this.applyFilters();
  }
}
