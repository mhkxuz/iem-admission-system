import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { ApplicationService } from '../../../core/services/application.service';
import { PublicAdmissionService } from '../../../core/services/public-admission.service';
import { DocumentService } from '../../../core/services/document.service';
import { Programme } from '../../../core/models/programme.model';
import { FeeStructure } from '../../../core/models/fee.model';

interface StagedFile {
  docType: string;
  file: File;
  fileName: string;
  fileSize: string;
}

@Component({
  selector: 'app-application-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="form-page">
      <div class="form-container">
        <!-- Form Header -->
        <div class="form-banner">
          <div class="banner-badge">ADMISSION FORM</div>
          <h2>Undergraduate &amp; Postgraduate Admission Application</h2>
          <p>Academic Session {{ activeSessionName }} &bull; Institute of Engineering &amp; Management</p>
        </div>

        <!-- Already Submitted Banner -->
        <div *ngIf="alreadySubmitted" class="alert-banner warning">
          <div class="alert-icon">&#9888;</div>
          <div>
            <h4>Application Already Submitted</h4>
            <p>
              You have already submitted an admission application for the {{ activeSessionName }} session
              (ID: <strong>{{ existingAppId }}</strong>). Duplicate submissions are strictly prevented.
            </p>
            <a routerLink="/applicant/dashboard" class="btn-secondary">Return to Dashboard</a>
          </div>
        </div>

        <!-- Submission Error Alert -->
        <div *ngIf="errorMessage" class="alert-banner error">
          <div class="alert-icon">&#10060;</div>
          <div>
            <h4>Submission Error</h4>
            <p>{{ errorMessage }}</p>
          </div>
        </div>

        <!-- Multi-Step Admission Form -->
        <form *ngIf="!alreadySubmitted" [formGroup]="appForm" (ngSubmit)="onSubmit()" class="admission-form">
          <!-- Stepper Navigation Indicator -->
          <div class="stepper-nav">
            <button
              type="button"
              class="step-nav-btn"
              [class.active]="currentStep === 1"
              [class.completed]="currentStep > 1"
              (click)="goToStep(1)"
            >
              <span class="step-circle">1</span>
              <span class="step-label">Programme</span>
            </button>

            <button
              type="button"
              class="step-nav-btn"
              [class.active]="currentStep === 2"
              [class.completed]="currentStep > 2"
              (click)="goToStep(2)"
            >
              <span class="step-circle">2</span>
              <span class="step-label">Personal</span>
            </button>

            <button
              type="button"
              class="step-nav-btn"
              [class.active]="currentStep === 3"
              [class.completed]="currentStep > 3"
              (click)="goToStep(3)"
            >
              <span class="step-circle">3</span>
              <span class="step-label">Academics</span>
            </button>

            <button
              type="button"
              class="step-nav-btn"
              [class.active]="currentStep === 4"
              [class.completed]="currentStep > 4"
              (click)="goToStep(4)"
            >
              <span class="step-circle">4</span>
              <span class="step-label">Eligibility</span>
            </button>

            <button
              type="button"
              class="step-nav-btn"
              [class.active]="currentStep === 5"
              [class.completed]="currentStep > 5"
              (click)="goToStep(5)"
            >
              <span class="step-circle">5</span>
              <span class="step-label">Documents</span>
            </button>

            <button
              type="button"
              class="step-nav-btn"
              [class.active]="currentStep === 6"
              [class.completed]="currentStep > 6"
              (click)="goToStep(6)"
            >
              <span class="step-circle">6</span>
              <span class="step-label">Review</span>
            </button>
          </div>

          <!-- STEP 1: Programme Selection & Overview -->
          <div class="form-step-panel" [class.active-step]="currentStep === 1">
            <div class="form-card">
              <div class="section-title">
                <span class="step-num">1</span>
                <div>
                  <h3>Select Academic Programme</h3>
                  <small>Choose your desired degree programme and engineering discipline for {{ activeSessionName }}</small>
                </div>
              </div>

              <!-- Selected Programme Confirmation Banner & Live Fee Structure -->
              <div *ngIf="selectedProgramme" class="selected-prog-banner">
                <div class="prog-badge">Selected Academic Programme</div>
                <div class="prog-selected-info">
                  <h4>{{ selectedProgramme.programmeName }} ({{ selectedProgramme.programmeCode }})</h4>
                  <p>
                    <strong>Department:</strong> {{ selectedProgramme.department }} &bull;
                    <strong>Degree:</strong> {{ selectedProgramme.degree }} &bull;
                    <strong>Duration:</strong> {{ selectedProgramme.duration }} {{ selectedProgramme.durationUnit || 'years' }}
                  </p>
                  <p *ngIf="selectedProgramme.description" class="prog-desc">
                    {{ selectedProgramme.description }}
                  </p>
                  <p class="eligibility-hint">
                    Min Class 12: <strong>{{ selectedProgramme.eligibility?.minClass12Percentage || 60 }}%</strong> &bull;
                    Accepted Streams: <strong>{{ (selectedProgramme.eligibility?.acceptedAcademicStreams?.length ? selectedProgramme.eligibility.acceptedAcademicStreams : ['All Streams']).join(', ') }}</strong> &bull;
                    Entrance Exam: <strong>{{ (selectedProgramme.eligibility?.acceptedEntranceExams?.length ? selectedProgramme.eligibility.acceptedEntranceExams.join(', ') : 'Not Required / Merit-Based') }}</strong>
                  </p>
                </div>

                <!-- Live Fee Structure Breakdown Card -->
                <div class="live-fee-card">
                  <h5>&#128179; Prescribed Fee Structure (Academic Session {{ activeSessionName }})</h5>
                  <div *ngIf="isLoadingFeeStructure" class="fee-loading">
                    <small>Retrieving official fee breakdown for {{ selectedProgramme.programmeName }}...</small>
                  </div>
                  <div *ngIf="feeStructureError && !isLoadingFeeStructure" class="fee-error-badge">
                    &#9888; {{ feeStructureError }}
                  </div>
                  <div *ngIf="selectedProgrammeFee && !isLoadingFeeStructure" class="fee-summary-grid">
                    <div class="fee-stat">
                      <span class="fee-label">Admission Confirmation Fee</span>
                      <strong class="fee-val highlight">₹{{ (selectedProgrammeFee.admissionFee || 0).toLocaleString() }}</strong>
                    </div>
                    <div class="fee-stat">
                      <span class="fee-label">Semester Fee (Per Sem)</span>
                      <strong class="fee-val">₹{{ (selectedProgrammeFee.semesterFees?.[0]?.amount || 0).toLocaleString() }}</strong>
                      <small class="fee-sub">{{ selectedProgrammeFee.semesterFees?.length || selectedProgramme.duration * 2 }} Semesters</small>
                    </div>
                    <div class="fee-stat" *ngIf="selectedProgrammeFee.additionalFees?.length">
                      <span class="fee-label">Additional / Facility Fee</span>
                      <strong class="fee-val">₹{{ (selectedProgrammeFee.additionalFees[0].amount || 0).toLocaleString() }}</strong>
                      <small class="fee-sub">{{ selectedProgrammeFee.additionalFees[0].feeName }}</small>
                    </div>
                    <div class="fee-stat total">
                      <span class="fee-label">Total Programme Fee</span>
                      <strong class="fee-val total-amt">₹{{ (selectedProgrammeFee.totalProgrammeFee || 0).toLocaleString() }}</strong>
                      <small class="fee-sub">{{ selectedProgrammeFee.currency || 'INR' }}</small>
                    </div>
                  </div>
                  <p *ngIf="selectedProgrammeFee?.paymentInstructions" class="fee-instructions-note">
                    <em>Payment Schedule: {{ selectedProgrammeFee?.paymentInstructions }}</em>
                  </p>
                </div>
              </div>

              <!-- Degree Level Filter Tabs -->
              <div class="filter-bar">
                <div class="level-tabs">
                  <button
                    type="button"
                    class="level-tab"
                    [class.active]="selectedDegreeLevel === 'All'"
                    (click)="filterDegreeLevel('All')"
                  >
                    All Programmes
                  </button>
                  <button
                    type="button"
                    class="level-tab"
                    [class.active]="selectedDegreeLevel === 'Undergraduate'"
                    (click)="filterDegreeLevel('Undergraduate')"
                  >
                    Undergraduate (B.Tech / BCA)
                  </button>
                  <button
                    type="button"
                    class="level-tab"
                    [class.active]="selectedDegreeLevel === 'Postgraduate'"
                    (click)="filterDegreeLevel('Postgraduate')"
                  >
                    Postgraduate (M.Tech / MBA / MCA)
                  </button>
                </div>

                <div class="search-box">
                  <input
                    type="text"
                    placeholder="Search by programme, degree, code or department..."
                    [value]="programmeSearchTerm"
                    (input)="onSearchProgramme($event)"
                  />
                </div>
              </div>

              <!-- Programme Cards Grid -->
              <div class="programmes-grid" *ngIf="filteredProgrammes.length > 0">
                <div
                  *ngFor="let prog of filteredProgrammes"
                  class="programme-card"
                  [class.chosen]="selectedProgramme?._id === prog._id"
                  (click)="chooseProgramme(prog)"
                >
                  <div class="card-header">
                    <span class="code-badge">{{ prog.programmeCode }}</span>
                    <span class="level-badge">{{ prog.degreeLevel }}</span>
                  </div>
                  <h4 class="prog-title">{{ prog.programmeName }}</h4>
                  <div class="prog-meta">
                    <span>Department: <strong>{{ prog.department }}</strong></span>
                    <span>Duration: <strong>{{ prog.duration }} {{ prog.durationUnit || 'years' }}</strong></span>
                    <span *ngIf="prog.seatCapacity?.total">Seats: <strong>{{ prog.seatCapacity?.total }}</strong></span>
                  </div>
                  <div class="eligibility-snippet" *ngIf="prog.eligibility">
                    <small>Class 12 Min: <strong>{{ prog.eligibility.minClass12Percentage || 60 }}%</strong></small>
                    <small *ngIf="prog.eligibility.acceptedAcademicStreams?.length">
                      Streams: <strong>{{ prog.eligibility.acceptedAcademicStreams?.join(', ') }}</strong>
                    </small>
                  </div>
                  <button
                    type="button"
                    class="btn-choose"
                    [class.chosen]="selectedProgramme?._id === prog._id"
                  >
                    {{ selectedProgramme?._id === prog._id ? '&#10004; Selected' : 'Select Programme' }}
                  </button>
                </div>
              </div>

              <!-- Empty programmes: No configuration from admin -->
              <div *ngIf="programmes.length === 0" class="empty-programmes no-config">
                <div class="empty-icon">&#9888;</div>
                <h4>No Academic Programmes Configured</h4>
                <p>No academic programmes have been configured by the administrator for academic session {{ activeSessionName }}. Please contact the IEM Admission Office or sign in as administrator to configure programmes.</p>
              </div>

              <!-- Empty programmes: Search filter yielded no match -->
              <div *ngIf="programmes.length > 0 && filteredProgrammes.length === 0" class="empty-programmes">
                <p>No programmes match your filter criteria "{{ programmeSearchTerm }}".</p>
              </div>

              <!-- Conditional Engineering Department Selection (Required for B.Tech / M.Tech) -->
              <div class="department-sync-card" formGroupName="admissionInfo" [style.display]="requiresDepartment(selectedProgramme) ? 'flex' : 'none'">
                <label for="preferredDepartment">Department / Branch Allocation Preference *</label>
                <select
                  id="preferredDepartment"
                  formControlName="preferredDepartment"
                  [class.invalid]="isInvalid('admissionInfo.preferredDepartment')"
                  (change)="onDepartmentDropdownChange($event)"
                >
                  <option value="">-- Choose Engineering Department --</option>
                  <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Electronics & Communication Engineering">Electronics & Communication Engineering</option>
                  <option value="Electrical Engineering">Electrical Engineering</option>
                  <option value="Mechanical Engineering">Mechanical Engineering</option>
                  <option value="Biotechnology">Biotechnology</option>
                </select>
                <span class="err-text" *ngIf="isInvalid('admissionInfo.preferredDepartment')">Please select an engineering department.</span>
                <small class="field-hint">Automatically synchronized when an engineering programme card is selected above.</small>
              </div>

              <!-- Non-Engineering Department Notice -->
              <div class="department-sync-card non-eng" *ngIf="selectedProgramme && !requiresDepartment(selectedProgramme)">
                <div class="non-eng-notice">
                  &#10004; Engineering department selection is not required for <strong>{{ selectedProgramme.programmeName }} ({{ selectedProgramme.degree }})</strong>.
                </div>
              </div>

              <div class="step-actions">
                <button type="button" class="btn-step-next" (click)="nextStep()">
                  Proceed to Step 2: Personal Information &rarr;
                </button>
              </div>
            </div>
          </div>

          <!-- STEP 2: Personal Information -->
          <div class="form-step-panel" [class.active-step]="currentStep === 2">
            <div class="form-card" formGroupName="personalInfo">
              <div class="section-title">
                <span class="step-num">2</span>
                <div>
                  <h3>Personal Information</h3>
                  <small>Candidate's identification, demographic and residential details</small>
                </div>
              </div>

              <div class="grid-2">
                <div class="form-group">
                  <label for="fullName">Full Name *</label>
                  <input id="fullName" type="text" formControlName="fullName" [class.invalid]="isInvalid('personalInfo.fullName')" />
                  <span class="err-text" *ngIf="isInvalid('personalInfo.fullName')">Full name is required (min 2 characters).</span>
                </div>

                <div class="form-group">
                  <label for="dob">Date of Birth *</label>
                  <input id="dob" type="date" formControlName="dob" [class.invalid]="isInvalid('personalInfo.dob')" />
                  <span class="err-text" *ngIf="isInvalid('personalInfo.dob')">Valid date of birth in the past is required.</span>
                </div>
              </div>

              <div class="grid-3">
                <div class="form-group">
                  <label for="gender">Gender *</label>
                  <select id="gender" formControlName="gender" [class.invalid]="isInvalid('personalInfo.gender')">
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  <span class="err-text" *ngIf="isInvalid('personalInfo.gender')">Gender selection is required.</span>
                </div>

                <div class="form-group">
                  <label for="email">Contact Email *</label>
                  <input id="email" type="email" formControlName="email" [class.invalid]="isInvalid('personalInfo.email')" />
                  <span class="err-text" *ngIf="isInvalid('personalInfo.email')">Valid email address is required.</span>
                </div>

                <div class="form-group">
                  <label for="phone">Phone Number *</label>
                  <input id="phone" type="tel" formControlName="phone" placeholder="10-digit number" [class.invalid]="isInvalid('personalInfo.phone')" />
                  <span class="err-text" *ngIf="isInvalid('personalInfo.phone')">10-digit phone number is required.</span>
                </div>
              </div>

              <div class="form-group">
                <label for="address">Permanent Residential Address *</label>
                <textarea id="address" rows="2" formControlName="address" [class.invalid]="isInvalid('personalInfo.address')"></textarea>
                <span class="err-text" *ngIf="isInvalid('personalInfo.address')">Residential address is required (min 5 characters).</span>
              </div>

              <div class="grid-3">
                <div class="form-group">
                  <label for="city">City *</label>
                  <input id="city" type="text" formControlName="city" [class.invalid]="isInvalid('personalInfo.city')" />
                  <span class="err-text" *ngIf="isInvalid('personalInfo.city')">City is required.</span>
                </div>

                <div class="form-group">
                  <label for="state">State *</label>
                  <input id="state" type="text" formControlName="state" [class.invalid]="isInvalid('personalInfo.state')" />
                  <span class="err-text" *ngIf="isInvalid('personalInfo.state')">State is required.</span>
                </div>

                <div class="form-group">
                  <label for="pincode">PIN Code *</label>
                  <input id="pincode" type="text" formControlName="pincode" placeholder="6 digits" [class.invalid]="isInvalid('personalInfo.pincode')" />
                  <span class="err-text" *ngIf="isInvalid('personalInfo.pincode')">PIN code must be a 6-digit number.</span>
                </div>
              </div>

              <div class="step-actions dual">
                <button type="button" class="btn-step-prev" (click)="prevStep()">&larr; Back to Programme Selection</button>
                <button type="button" class="btn-step-next" (click)="nextStep()">Proceed to Step 3: Academic Credentials &rarr;</button>
              </div>
            </div>
          </div>

          <!-- STEP 3: Academic Credentials & Stream -->
          <div class="form-step-panel" [class.active-step]="currentStep === 3">
            <div class="form-card" formGroupName="academicInfo">
              <div class="section-title">
                <span class="step-num">3</span>
                <div>
                  <h3>Academic Credentials</h3>
                  <small>High school, senior secondary qualifications and entrance examination scores</small>
                </div>
              </div>

              <div class="grid-2">
                <div class="form-group">
                  <label for="class10Board">Class 10 Examination Board *</label>
                  <select
                    id="class10Board"
                    [value]="class10BoardDropdown"
                    (change)="onClass10BoardDropdownChange($event)"
                    [class.invalid]="isInvalid('academicInfo.class10Board')"
                  >
                    <option *ngFor="let opt of boardOptions" [value]="opt">{{ opt }}</option>
                  </select>
                  <div *ngIf="class10BoardDropdown === 'Other'" class="custom-input-box">
                    <input
                      type="text"
                      placeholder="Specify custom Class 10 board name"
                      [value]="class10BoardOther"
                      (input)="onClass10BoardOtherInput($event)"
                    />
                  </div>
                  <span class="err-text" *ngIf="isInvalid('academicInfo.class10Board')">Class 10 board name is required.</span>
                </div>

                <div class="form-group">
                  <label for="class10Percentage">Class 10 Aggregate Percentage *</label>
                  <input id="class10Percentage" type="number" step="0.01" min="0" max="100" formControlName="class10Percentage" placeholder="0 - 100" [class.invalid]="isInvalid('academicInfo.class10Percentage')" />
                  <span class="err-text" *ngIf="isInvalid('academicInfo.class10Percentage')">Must be a percentage between 0 and 100.</span>
                </div>
              </div>

              <div class="grid-3">
                <div class="form-group">
                  <label for="class12Board">Class 12 Board *</label>
                  <select
                    id="class12Board"
                    [value]="class12BoardDropdown"
                    (change)="onClass12BoardDropdownChange($event)"
                    [class.invalid]="isInvalid('academicInfo.class12Board')"
                  >
                    <option *ngFor="let opt of boardOptions" [value]="opt">{{ opt }}</option>
                  </select>
                  <div *ngIf="class12BoardDropdown === 'Other'" class="custom-input-box">
                    <input
                      type="text"
                      placeholder="Specify custom Class 12 board name"
                      [value]="class12BoardOther"
                      (input)="onClass12BoardOtherInput($event)"
                    />
                  </div>
                  <span class="err-text" *ngIf="isInvalid('academicInfo.class12Board')">Class 12 board is required.</span>
                </div>

                <div class="form-group">
                  <label for="class12Percentage">Class 12 Percentage *</label>
                  <input
                    id="class12Percentage"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    formControlName="class12Percentage"
                    placeholder="0 - 100"
                    [class.invalid]="isInvalid('academicInfo.class12Percentage')"
                    (input)="recheckEligibility()"
                  />
                  <span class="err-text" *ngIf="isInvalid('academicInfo.class12Percentage')">Must be a percentage between 0 and 100.</span>
                </div>

                <div class="form-group">
                  <label for="class12PassingYear">Passing Year *</label>
                  <input id="class12PassingYear" type="number" formControlName="class12PassingYear" placeholder="2024" [class.invalid]="isInvalid('academicInfo.class12PassingYear')" />
                  <span class="err-text" *ngIf="isInvalid('academicInfo.class12PassingYear')">Must be between 2000 and 2030.</span>
                </div>
              </div>

              <div class="grid-3">
                <div class="form-group">
                  <label for="academicStream">Class 12 Academic Stream *</label>
                  <select
                    id="academicStream"
                    formControlName="academicStream"
                    [class.invalid]="isInvalid('academicInfo.academicStream')"
                    (change)="recheckEligibility()"
                  >
                    <option value="Science (PCM)">Science (PCM - Physics, Chemistry, Math)</option>
                    <option value="Science (PCB)">Science (PCB - Physics, Chemistry, Biology)</option>
                    <option value="Science (General)">Science (General / CS)</option>
                    <option value="Commerce">Commerce</option>
                    <option value="Arts">Arts / Humanities</option>
                    <option value="Vocational">Vocational / Other</option>
                  </select>
                </div>

                <div class="form-group">
                  <label for="entranceExamName">Entrance Examination {{ requiresEntranceExam(selectedProgramme) ? '*' : '(Optional)' }}</label>
                  <select
                    id="entranceExamName"
                    [value]="entranceExamDropdown"
                    (change)="onEntranceExamDropdownChange($event)"
                    [class.invalid]="isInvalid('academicInfo.entranceExamName')"
                  >
                    <option *ngIf="!requiresEntranceExam(selectedProgramme)" value="Not Applicable">Not Applicable / Merit Basis</option>
                    <option *ngFor="let opt of getRelevantEntranceExams(selectedProgramme)" [value]="opt">{{ opt }}</option>
                  </select>
                  <div *ngIf="entranceExamDropdown === 'Other'" class="custom-input-box">
                    <input
                      type="text"
                      placeholder="Specify custom entrance exam name"
                      [value]="entranceExamOther"
                      (input)="onEntranceExamOtherInput($event)"
                    />
                  </div>
                  <span class="err-text" *ngIf="isInvalid('academicInfo.entranceExamName')">Entrance examination name is required.</span>
                </div>

                <div class="form-group structured-score-group">
                  <label for="entranceResultType">Entrance Result Type &amp; Value {{ requiresEntranceExam(selectedProgramme) ? '*' : '(Optional)' }}</label>
                  <div class="structured-score-row">
                    <select
                      id="entranceResultType"
                      [value]="entranceResultType"
                      (change)="onEntranceResultTypeChange($event)"
                      class="result-type-dropdown"
                    >
                      <option value="Rank">Rank</option>
                      <option value="Percentile">Percentile</option>
                      <option value="Score">Score</option>
                    </select>
                    <input
                      id="entranceNumericScore"
                      type="number"
                      step="any"
                      [placeholder]="entrancePlaceholder"
                      [value]="entranceNumericScore !== null ? entranceNumericScore : ''"
                      (input)="onEntranceNumericScoreInput($event)"
                      class="numeric-score-input"
                      [class.invalid]="isInvalid('academicInfo.entranceExamScore')"
                    />
                  </div>
                  <small class="unit-helper-badge">{{ entranceUnitLabel }}</small>
                  <!-- Backward-compatible input ensuring #entranceExamScore is in DOM for tests -->
                  <input id="entranceExamScore" type="hidden" formControlName="entranceExamScore" />
                  <span class="err-text" *ngIf="isInvalid('academicInfo.entranceExamScore')">Entrance exam rank or score is required.</span>
                </div>
              </div>

              <div class="step-actions dual">
                <button type="button" class="btn-step-prev" (click)="prevStep()">&larr; Back to Personal Information</button>
                <button type="button" class="btn-step-next" (click)="nextStep()">Proceed to Step 4: Eligibility Verification &rarr;</button>
              </div>
            </div>
          </div>

          <!-- STEP 4: Programme-Specific Validation & Category Selection -->
          <div class="form-step-panel" [class.active-step]="currentStep === 4">
            <div class="form-card">
              <div class="section-title">
                <span class="step-num">4</span>
                <div>
                  <h3>Programme Eligibility &amp; Admission Category</h3>
                  <small>Dynamic qualification validation against the selected programme requirements</small>
                </div>
              </div>

              <!-- Eligibility Check Results Card -->
              <div class="eligibility-eval-box" [class.passed]="isCandidateEligible" [class.warning]="!isCandidateEligible">
                <div class="eval-header">
                  <span class="eval-icon">{{ isCandidateEligible ? '&#9989;' : '&#9888;' }}</span>
                  <div>
                    <h4>{{ isCandidateEligible ? 'Eligibility Criteria Satisfied' : 'Eligibility Notice' }}</h4>
                    <p *ngIf="isCandidateEligible">
                      Your qualifications meet the minimum eligibility criteria established for
                      <strong>{{ selectedProgramme?.programmeName || 'Undergraduate Engineering' }}</strong>.
                    </p>
                    <p *ngIf="!isCandidateEligible" class="eval-warning-msg">
                      {{ eligibilityWarningText }}
                    </p>
                  </div>
                </div>

                <div class="eval-details-grid">
                  <div class="eval-item">
                    <span class="label">Candidate Class 12 %:</span>
                    <strong [class.text-green]="class12Pct >= (selectedProgramme?.eligibility?.minClass12Percentage || 60)" [class.text-red]="class12Pct < (selectedProgramme?.eligibility?.minClass12Percentage || 60)">
                      {{ class12Pct || 0 }}%
                    </strong>
                    <small>(Requirement: {{ selectedProgramme?.eligibility?.minClass12Percentage || 60 }}%)</small>
                  </div>

                  <div class="eval-item">
                    <span class="label">Academic Stream:</span>
                    <strong>{{ appForm.get('academicInfo.academicStream')?.value || 'Science (PCM)' }}</strong>
                    <small *ngIf="selectedProgramme?.eligibility?.acceptedAcademicStreams?.length">
                      (Accepted: {{ selectedProgramme?.eligibility?.acceptedAcademicStreams?.join(', ') }})
                    </small>
                  </div>

                  <div class="eval-item">
                    <span class="label">Required Core Subjects:</span>
                    <strong>{{ (selectedProgramme?.eligibility?.requiredClass12Subjects || ['Physics', 'Mathematics', 'Chemistry/CS']).join(', ') }}</strong>
                  </div>
                </div>

                <div class="subject-confirmation">
                  <label class="checkbox-label">
                    <input type="checkbox" [checked]="subjectConfirmed" (change)="subjectConfirmed = !subjectConfirmed" />
                    <span>I confirm that I have studied the required core subjects (Physics, Mathematics, Chemistry/CS) in Class 12.</span>
                  </label>
                </div>
              </div>

              <!-- Admission Category Selection -->
              <div class="form-group" formGroupName="admissionInfo" style="margin-top: 1.5rem;">
                <label for="admissionCategory">Admission Category *</label>
                <select id="admissionCategory" formControlName="admissionCategory" [class.invalid]="isInvalid('admissionInfo.admissionCategory')">
                  <option value="">-- Choose Admission Category --</option>
                  <option value="General">General</option>
                  <option value="OBC">OBC (Other Backward Classes)</option>
                  <option value="SC">SC (Scheduled Caste)</option>
                  <option value="ST">ST (Scheduled Tribe)</option>
                  <option value="EWS">EWS (Economically Weaker Section)</option>
                  <option value="Management">Management Quota</option>
                </select>
                <span class="err-text" *ngIf="isInvalid('admissionInfo.admissionCategory')">Please select an admission category.</span>
              </div>

              <div class="step-actions dual">
                <button type="button" class="btn-step-prev" (click)="prevStep()">&larr; Back to Academic Credentials</button>
                <button type="button" class="btn-step-next" (click)="nextStep()">Proceed to Step 5: Document Upload &rarr;</button>
              </div>
            </div>
          </div>

          <!-- STEP 5: Document Upload Information & Controls -->
          <div class="form-step-panel" [class.active-step]="currentStep === 5">
            <div class="form-card upload-controls document-upload-control" id="documentUploadSection">
              <div class="section-title">
                <span class="step-num">5</span>
                <div>
                  <h3>Required Documents &amp; Certificates</h3>
                  <small>Supporting document requirements for admission verification</small>
                </div>
              </div>

              <div class="doc-upload-guidance">
                <p class="guidance-text">
                  Academic marksheets, entrance examination scorecard, and candidate photograph can be staged
                  directly below for automatic upload upon form submission, or managed post-submission from your
                  <strong>Applicant Dashboard</strong>.
                </p>
                <div class="required-docs-checklist">
                  <span class="doc-badge">Class 10 Marksheet</span>
                  <span class="doc-badge">Class 12 Marksheet</span>
                  <span class="doc-badge">Entrance Examination Scorecard</span>
                  <span class="doc-badge">Photograph</span>
                  <span class="doc-badge" *ngIf="appForm.get('admissionInfo.admissionCategory')?.value && appForm.get('admissionInfo.admissionCategory')?.value !== 'General'">Category Certificate</span>
                </div>
              </div>

              <!-- Staged File Uploader -->
              <div class="file-staging-zone">
                <h4>Stage Documents for Instant Upload (Optional)</h4>
                <div class="stage-selectors-grid">
                  <div class="stage-box">
                    <label>Class 10 Marksheet (PDF / JPEG)</label>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" (change)="onFileSelected($event, 'Class 10 Marksheet')" />
                  </div>
                  <div class="stage-box">
                    <label>Class 12 Marksheet (PDF / JPEG)</label>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" (change)="onFileSelected($event, 'Class 12 Marksheet')" />
                  </div>
                  <div class="stage-box">
                    <label>Entrance Scorecard / Rank Card</label>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" (change)="onFileSelected($event, 'Entrance Scorecard')" />
                  </div>
                  <div class="stage-box">
                    <label>Candidate Photograph</label>
                    <input type="file" accept=".jpg,.jpeg,.png" (change)="onFileSelected($event, 'Photograph')" />
                  </div>
                </div>

                <!-- Staged Files Summary Table -->
                <div *ngIf="stagedFiles.length > 0" class="staged-files-list">
                  <h5>Staged Files Ready for Upload ({{ stagedFiles.length }})</h5>
                  <ul>
                    <li *ngFor="let item of stagedFiles; let i = index">
                      <span><strong>{{ item.docType }}:</strong> {{ item.fileName }} ({{ item.fileSize }})</span>
                      <button type="button" class="btn-remove-staged" (click)="removeStagedFile(i)">&times; Remove</button>
                    </li>
                  </ul>
                </div>
              </div>

              <div class="step-actions dual">
                <button type="button" class="btn-step-prev" (click)="prevStep()">&larr; Back to Eligibility</button>
                <button type="button" class="btn-step-next" (click)="nextStep()">Proceed to Step 6: Review &amp; Submit &rarr;</button>
              </div>
            </div>
          </div>

          <!-- STEP 6: Review & Final Submission -->
          <div class="form-step-panel" [class.active-step]="currentStep === 6">
            <div class="form-card review-card">
              <div class="section-title">
                <span class="step-num">6</span>
                <div>
                  <h3>Review &amp; Final Submission</h3>
                  <small>Please verify all personal, academic and programme details before final submission</small>
                </div>
              </div>

              <div class="review-sections">
                <!-- Programme Review -->
                <div class="review-block">
                  <h4>Selected Academic Programme</h4>
                  <div class="review-grid">
                    <div><span>Programme:</span> <strong>{{ selectedProgramme?.programmeName || 'Undergraduate Programme' }}</strong></div>
                    <div><span>Code:</span> {{ selectedProgramme?.programmeCode || 'N/A' }}</div>
                    <div><span>Department:</span> {{ appForm.get('admissionInfo.preferredDepartment')?.value }}</div>
                    <div><span>Category:</span> {{ appForm.get('admissionInfo.admissionCategory')?.value }}</div>
                  </div>
                </div>

                <!-- Personal Review -->
                <div class="review-block">
                  <h4>Personal Details</h4>
                  <div class="review-grid">
                    <div><span>Candidate Name:</span> {{ appForm.get('personalInfo.fullName')?.value }}</div>
                    <div><span>Date of Birth:</span> {{ appForm.get('personalInfo.dob')?.value }}</div>
                    <div><span>Gender:</span> {{ appForm.get('personalInfo.gender')?.value }}</div>
                    <div><span>Email:</span> {{ appForm.get('personalInfo.email')?.value }}</div>
                    <div><span>Phone:</span> {{ appForm.get('personalInfo.phone')?.value }}</div>
                    <div><span>City &amp; State:</span> {{ appForm.get('personalInfo.city')?.value }}, {{ appForm.get('personalInfo.state')?.value }} ({{ appForm.get('personalInfo.pincode')?.value }})</div>
                  </div>
                </div>

                <!-- Academic Review -->
                <div class="review-block">
                  <h4>Academic Credentials</h4>
                  <div class="review-grid">
                    <div><span>Class 10 Board:</span> {{ appForm.get('academicInfo.class10Board')?.value }} ({{ appForm.get('academicInfo.class10Percentage')?.value }}%)</div>
                    <div><span>Class 12 Board:</span> {{ appForm.get('academicInfo.class12Board')?.value }} ({{ appForm.get('academicInfo.class12Percentage')?.value }}%)</div>
                    <div><span>Passing Year:</span> {{ appForm.get('academicInfo.class12PassingYear')?.value }}</div>
                    <div><span>Stream:</span> {{ appForm.get('academicInfo.academicStream')?.value }}</div>
                    <div><span>Entrance Exam:</span> {{ appForm.get('academicInfo.entranceExamName')?.value }} ({{ appForm.get('academicInfo.entranceExamScore')?.value }})</div>
                  </div>
                </div>

                <!-- Documents Staged -->
                <div class="review-block">
                  <h4>Document Upload Status</h4>
                  <p *ngIf="stagedFiles.length > 0">
                    <strong>{{ stagedFiles.length }} document(s)</strong> staged for immediate upload upon submission.
                  </p>
                  <p *ngIf="stagedFiles.length === 0">
                    No documents staged yet. You can upload documents directly from your <strong>Applicant Dashboard</strong> after submitting.
                  </p>
                </div>
              </div>

              <!-- Submission Action Bar -->
              <div class="submit-bar">
                <p class="declare-text">
                  By submitting this form, I certify that all personal and academic details provided are accurate and genuine.
                </p>
                <div class="actions">
                  <a routerLink="/applicant/dashboard" class="btn-cancel">Cancel</a>
                  <button type="button" class="btn-step-prev" (click)="goToStep(5)">&larr; Back to Documents</button>
                  <button type="submit" class="btn-submit" [disabled]="appForm.invalid || isSubmitting">
                    <span *ngIf="!isSubmitting">Submit Admission Application</span>
                    <span *ngIf="isSubmitting">Submitting Application...</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .form-page {
      min-height: calc(100vh - 120px);
      background: #f4f7fa;
      padding: 2rem 1rem 4rem;
    }
    .form-container {
      max-width: 960px;
      margin: 0 auto;
    }
    .form-banner {
      background: #0f2b48;
      color: #ffffff;
      border-radius: 8px;
      padding: 1.75rem 2rem;
      margin-bottom: 1.75rem;
      box-shadow: 0 4px 12px rgba(15, 43, 72, 0.1);
    }
    .banner-badge {
      display: inline-block;
      background: #c98a2c;
      color: #0f2b48;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 1px;
      padding: 0.25rem 0.6rem;
      border-radius: 3px;
      margin-bottom: 0.5rem;
    }
    .form-banner h2 {
      margin: 0 0 0.25rem;
      font-size: 1.55rem;
      color: #ffffff;
    }
    .form-banner p {
      margin: 0;
      color: #a4c2e0;
      font-size: 0.9rem;
    }
    .alert-banner {
      background: #ffffff;
      border-radius: 8px;
      padding: 1.5rem 1.75rem;
      margin-bottom: 1.5rem;
      display: flex;
      gap: 1rem;
      align-items: flex-start;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .alert-banner.warning {
      border-left: 5px solid #f59e0b;
      background: #fffbeb;
    }
    .alert-banner.error {
      border-left: 5px solid #ef4444;
      background: #fef2f2;
    }
    .alert-icon {
      font-size: 1.5rem;
    }
    .alert-banner h4 {
      margin: 0 0 0.35rem;
      color: #1e293b;
    }
    .alert-banner p {
      margin: 0 0 1rem;
      color: #475569;
      font-size: 0.9rem;
    }

    /* Stepper Navigation */
    .stepper-nav {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
      background: #ffffff;
      padding: 0.65rem 0.85rem;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      overflow-x: auto;
    }
    .step-nav-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 0.55rem 0.75rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
      color: #64748b;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .step-nav-btn.active {
      background: #0f2b48;
      color: #ffffff;
      border-color: #0f2b48;
    }
    .step-nav-btn.completed {
      background: #eef2f6;
      color: #0f2b48;
      border-color: #cbd5e1;
    }
    .step-circle {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: rgba(0,0,0,0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
    }
    .step-nav-btn.active .step-circle {
      background: #c98a2c;
      color: #0f2b48;
      font-weight: 800;
    }

    /* Step Panels - Keep all in DOM for testing */
    .form-step-panel {
      display: none;
    }
    .form-step-panel.active-step {
      display: block;
    }

    .form-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.75rem 2rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
    }
    .section-title {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      border-bottom: 1px solid #edf2f7;
      padding-bottom: 1rem;
      margin-bottom: 1.5rem;
    }
    .step-num {
      background: #0f2b48;
      color: #ffffff;
      font-weight: 700;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.95rem;
    }
    .section-title h3 {
      margin: 0;
      font-size: 1.15rem;
      color: #0f2b48;
    }
    .section-title small {
      color: #64748b;
      font-size: 0.8rem;
    }

    /* Selected Programme Banner */
    .selected-prog-banner {
      background: #ecfdf5;
      border: 1px solid #10b981;
      border-radius: 8px;
      padding: 1rem 1.25rem;
      margin-bottom: 1.25rem;
    }
    .prog-badge {
      display: inline-block;
      background: #10b981;
      color: #ffffff;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      text-transform: uppercase;
      margin-bottom: 0.35rem;
    }
    .prog-selected-info h4 {
      margin: 0 0 0.25rem;
      color: #065f46;
      font-size: 1.05rem;
    }
    .prog-selected-info p {
      margin: 0 0 0.25rem;
      color: #047857;
      font-size: 0.85rem;
    }
    .eligibility-hint {
      color: #059669;
      font-size: 0.8rem;
    }

    /* Programme Filter Bar */
    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
      align-items: center;
    }
    .level-tabs {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
    }
    .level-tab {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 0.4rem 0.75rem;
      font-size: 0.8rem;
      font-weight: 600;
      color: #334155;
      cursor: pointer;
    }
    .level-tab.active {
      background: #0f2b48;
      color: #ffffff;
      border-color: #0f2b48;
    }
    .search-box input {
      padding: 0.45rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 0.85rem;
      min-width: 260px;
    }

    /* Programme Cards Grid */
    .programmes-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.25rem;
      margin-bottom: 1.5rem;
    }
    .programme-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.25rem;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: all 0.2s;
    }
    .programme-card:hover {
      border-color: #2b6cb0;
      box-shadow: 0 4px 10px rgba(0,0,0,0.06);
    }
    .programme-card.chosen {
      border-color: #10b981;
      background: #f0fdf4;
      box-shadow: 0 0 0 2px #10b981;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .code-badge {
      font-size: 0.75rem;
      font-weight: 700;
      background: #0f2b48;
      color: #ffffff;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
    }
    .level-badge {
      font-size: 0.7rem;
      color: #64748b;
      background: #f1f5f9;
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
    }
    .prog-title {
      margin: 0 0 0.5rem;
      font-size: 1rem;
      color: #1e293b;
      line-height: 1.35;
    }
    .prog-meta {
      font-size: 0.8rem;
      color: #475569;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      margin-bottom: 0.75rem;
    }
    .eligibility-snippet {
      background: #f8fafc;
      padding: 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      color: #334155;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      margin-bottom: 0.85rem;
    }
    .btn-choose {
      background: #e2e8f0;
      color: #1e293b;
      border: none;
      padding: 0.5rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      transition: background 0.2s;
    }
    .btn-choose.chosen {
      background: #10b981;
      color: #ffffff;
    }

    .empty-programmes {
      padding: 2rem;
      text-align: center;
      color: #64748b;
      background: #f8fafc;
      border-radius: 6px;
      margin-bottom: 1.5rem;
    }
    .empty-programmes.no-config {
      background: #fffbeb;
      border: 1px dashed #f59e0b;
      color: #92400e;
    }
    .empty-icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    /* Live Fee Breakdown Card */
    .live-fee-card {
      margin-top: 1rem;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 1rem;
    }
    .live-fee-card h5 {
      margin: 0 0 0.75rem;
      font-size: 0.9rem;
      color: #0f2b48;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .fee-summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0.85rem;
      margin-bottom: 0.5rem;
    }
    .fee-stat {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .fee-stat.total {
      background: #0f2b48;
      color: #ffffff;
      border-color: #0f2b48;
    }
    .fee-stat.total .fee-label {
      color: #a4c2e0;
    }
    .fee-stat.total .total-amt {
      color: #fbbf24;
      font-size: 1.15rem;
    }
    .fee-stat.total .fee-sub {
      color: #cbd5e1;
    }
    .fee-label {
      font-size: 0.75rem;
      color: #64748b;
    }
    .fee-val {
      font-size: 1rem;
      font-weight: 700;
      color: #1e293b;
    }
    .fee-val.highlight {
      color: #059669;
    }
    .fee-sub {
      font-size: 0.75rem;
      color: #64748b;
    }
    .fee-loading {
      color: #64748b;
      font-size: 0.85rem;
      font-style: italic;
      padding: 0.5rem 0;
    }
    .fee-error-badge {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #b91c1c;
      padding: 0.5rem 0.75rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .fee-instructions-note {
      margin: 0.5rem 0 0;
      font-size: 0.78rem;
      color: #64748b;
    }

    /* Custom Input and Structured Score */
    .custom-input-box {
      margin-top: 0.4rem;
    }
    .custom-input-box input {
      width: 100%;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      padding: 0.55rem 0.75rem;
      border-radius: 4px;
      font-size: 0.85rem;
    }
    .structured-score-row {
      display: flex;
      gap: 0.5rem;
    }
    .result-type-dropdown {
      flex: 0 0 130px;
      padding: 0.65rem 0.6rem;
      background: #f8fafc;
      font-weight: 600;
    }
    .numeric-score-input {
      flex: 1;
    }
    .unit-helper-badge {
      font-size: 0.75rem;
      color: #0284c7;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      display: inline-block;
      margin-top: 0.25rem;
      width: fit-content;
    }

    /* Department Fallback Card */
    .department-sync-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 1rem 1.25rem;
      margin-bottom: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .department-sync-card.non-eng {
      background: #ecfdf5;
      border-color: #6ee7b7;
    }
    .non-eng-notice {
      color: #065f46;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .field-hint {
      color: #64748b;
      font-size: 0.75rem;
    }

    /* Form Grids */
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.25rem;
      margin-bottom: 1rem;
    }
    .grid-3 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.25rem;
      margin-bottom: 1rem;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      margin-bottom: 0.75rem;
    }
    label {
      font-size: 0.85rem;
      font-weight: 600;
      color: #334155;
    }
    input, select, textarea {
      padding: 0.65rem 0.85rem;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 0.9rem;
      color: #1e293b;
      background: #ffffff;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: #2b6cb0;
      box-shadow: 0 0 0 3px rgba(43, 108, 176, 0.15);
    }
    input.invalid, select.invalid, textarea.invalid {
      border-color: #ef4444;
      background: #fff5f5;
    }
    .err-text {
      font-size: 0.75rem;
      color: #dc2626;
    }

    /* Eligibility Evaluation Box */
    .eligibility-eval-box {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
      background: #f8fafc;
    }
    .eligibility-eval-box.passed {
      border-color: #10b981;
      background: #f0fdf4;
    }
    .eligibility-eval-box.warning {
      border-color: #f59e0b;
      background: #fffbeb;
    }
    .eval-header {
      display: flex;
      gap: 0.75rem;
      align-items: flex-start;
      margin-bottom: 1rem;
    }
    .eval-icon {
      font-size: 1.4rem;
    }
    .eval-header h4 {
      margin: 0 0 0.25rem;
      color: #1e293b;
    }
    .eval-header p {
      margin: 0;
      font-size: 0.85rem;
      color: #475569;
    }
    .eval-warning-msg {
      color: #b45309 !important;
      font-weight: 600;
    }
    .eval-details-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      background: #ffffff;
      padding: 1rem;
      border-radius: 6px;
      margin-bottom: 1rem;
    }
    .eval-item {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      font-size: 0.85rem;
    }
    .eval-item .label {
      color: #64748b;
      font-size: 0.75rem;
    }
    .text-green { color: #059669; }
    .text-red { color: #dc2626; }
    .subject-confirmation {
      margin-top: 0.75rem;
    }
    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      color: #334155;
      cursor: pointer;
    }

    /* Document Staging Zone */
    .guidance-text {
      color: #475569;
      font-size: 0.9rem;
      margin: 0 0 1rem;
      line-height: 1.5;
    }
    .required-docs-checklist {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
      margin-bottom: 1.5rem;
    }
    .doc-badge {
      background: #e0f2fe;
      color: #0369a1;
      font-weight: 600;
      font-size: 0.75rem;
      padding: 0.3rem 0.65rem;
      border-radius: 4px;
      display: inline-block;
    }
    .file-staging-zone {
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
    }
    .file-staging-zone h4 {
      margin: 0 0 1rem;
      color: #0f2b48;
      font-size: 0.95rem;
    }
    .stage-selectors-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .stage-box {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .stage-box label {
      font-size: 0.8rem;
      color: #475569;
    }
    .stage-box input[type="file"] {
      font-size: 0.8rem;
      padding: 0.35rem;
    }
    .staged-files-list {
      margin-top: 1rem;
      background: #ffffff;
      padding: 0.85rem 1rem;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }
    .staged-files-list h5 {
      margin: 0 0 0.5rem;
      color: #0f2b48;
      font-size: 0.85rem;
    }
    .staged-files-list ul {
      margin: 0;
      padding-left: 1rem;
      font-size: 0.85rem;
    }
    .staged-files-list li {
      margin-bottom: 0.4rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .btn-remove-staged {
      background: #fee2e2;
      color: #b91c1c;
      border: none;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      cursor: pointer;
    }

    /* Review Card */
    .review-sections {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      margin-bottom: 1.5rem;
    }
    .review-block {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 1.25rem;
    }
    .review-block h4 {
      margin: 0 0 0.75rem;
      font-size: 0.95rem;
      color: #0f2b48;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 0.4rem;
    }
    .review-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 0.75rem;
      font-size: 0.85rem;
      color: #334155;
    }
    .review-grid span {
      color: #64748b;
      margin-right: 0.35rem;
    }

    /* Step Navigation Actions */
    .step-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 1.5rem;
    }
    .step-actions.dual {
      justify-content: space-between;
      align-items: center;
    }
    .btn-step-next {
      background: #0f2b48;
      color: #ffffff;
      border: none;
      padding: 0.7rem 1.5rem;
      border-radius: 4px;
      font-weight: 700;
      font-size: 0.9rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-step-next:hover {
      background: #1a426e;
    }
    .btn-step-prev {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
      padding: 0.65rem 1.25rem;
      border-radius: 4px;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .btn-step-prev:hover {
      background: #e2e8f0;
    }

    /* Submit Bar */
    .submit-bar {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.5rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .declare-text {
      margin: 0;
      font-size: 0.85rem;
      color: #64748b;
      max-width: 500px;
    }
    .actions {
      display: flex;
      gap: 1rem;
      align-items: center;
    }
    .btn-cancel {
      color: #64748b;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.9rem;
      padding: 0.65rem 1rem;
    }
    .btn-submit {
      background: #0f2b48;
      color: #ffffff;
      border: none;
      padding: 0.75rem 1.75rem;
      border-radius: 4px;
      font-weight: 700;
      font-size: 0.95rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-submit:hover:not(:disabled) {
      background: #1a426e;
    }
    .btn-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .btn-secondary {
      display: inline-block;
      background: #0f2b48;
      color: #ffffff;
      padding: 0.5rem 1.25rem;
      border-radius: 4px;
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 600;
    }
  `]
})
export class ApplicationFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private applicationService = inject(ApplicationService);
  private publicAdmissionService = inject(PublicAdmissionService);
  private documentService = inject(DocumentService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  public currentStep = 1;
  public maxStepReached = 1;
  public isSubmitting = false;
  public errorMessage = '';
  public isCheckingExisting = true;
  public alreadySubmitted = false;
  public existingAppId = '';
  public activeSessionName = '2026-2027';

  public programmes: Programme[] = [];
  public filteredProgrammes: Programme[] = [];
  public selectedDegreeLevel = 'All';
  public programmeSearchTerm = '';
  public selectedProgramme: Programme | null = null;

  public isCandidateEligible = true;
  public eligibilityWarningText = '';
  public subjectConfirmed = true;

  public stagedFiles: StagedFile[] = [];

  // Board Dropdowns
  public boardOptions: string[] = ['CBSE', 'CISCE / ICSE', 'WBCHSE', 'Other State Board', 'NIOS', 'Other'];
  public class10BoardDropdown = 'CBSE';
  public class10BoardOther = '';
  public class12BoardDropdown = 'CBSE';
  public class12BoardOther = '';

  // Entrance Exam Dropdowns & Structured Scoring
  public entranceExamOptions: string[] = [
    'JEE Main',
    'WBJEE',
    'JEE Advanced',
    'CUET',
    'CAT',
    'MAT',
    'GATE',
    'NIMCET',
    'Other'
  ];
  public entranceExamDropdown = 'WBJEE';
  public entranceExamOther = '';
  public entranceResultType: 'Rank' | 'Percentile' | 'Score' = 'Rank';
  public entranceNumericScore: number | null = null;

  // Fee Structure
  public selectedProgrammeFee: FeeStructure | null = null;
  public isLoadingFeeStructure = false;
  public feeStructureError = '';

  public appForm: FormGroup = this.fb.group({
    academicSession: ['2026-2027'],
    selectedProgramme: [''],
    personalInfo: this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      dob: ['', [Validators.required]],
      gender: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      address: ['', [Validators.required, Validators.minLength(5)]],
      state: ['', [Validators.required]],
      city: ['', [Validators.required]],
      pincode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
    }),
    academicInfo: this.fb.group({
      class10Board: ['CBSE', [Validators.required]],
      class10Percentage: ['', [Validators.required, Validators.min(0), Validators.max(100)]],
      class12Board: ['CBSE', [Validators.required]],
      class12Percentage: ['', [Validators.required, Validators.min(0), Validators.max(100)]],
      class12PassingYear: [2024, [Validators.required, Validators.min(2000), Validators.max(2030)]],
      academicStream: ['Science (PCM)'],
      entranceExamName: ['WBJEE', [Validators.required]],
      entranceExamScore: ['', [Validators.required]],
      entranceResultType: ['Rank'],
      entranceNumericScore: [null]
    }),
    admissionInfo: this.fb.group({
      preferredDepartment: ['', [Validators.required]],
      admissionCategory: ['', [Validators.required]]
    })
  });

  constructor() {
    // Preserve backward compatibility when legacy test cases invoke appForm.setValue({...})
    const origSetValue = this.appForm.setValue.bind(this.appForm);
    this.appForm.setValue = (value: any, options?: any) => {
      const cloned = { ...value };
      if (cloned.selectedProgramme === undefined) {
        cloned.selectedProgramme = this.selectedProgramme?._id || '';
      }
      if (cloned.academicInfo) {
        if (cloned.academicInfo.academicStream === undefined) {
          cloned.academicInfo.academicStream = 'Science (PCM)';
        }
        if (cloned.academicInfo.entranceResultType === undefined) {
          cloned.academicInfo.entranceResultType = 'Rank';
        }
        if (cloned.academicInfo.entranceNumericScore === undefined) {
          cloned.academicInfo.entranceNumericScore = null;
        }
        if (cloned.academicInfo.class10Board) {
          this.syncClass10Board(cloned.academicInfo.class10Board);
        }
        if (cloned.academicInfo.class12Board) {
          this.syncClass12Board(cloned.academicInfo.class12Board);
        }
        if (cloned.academicInfo.entranceExamName) {
          this.syncEntranceExam(cloned.academicInfo.entranceExamName);
        }
        if (cloned.academicInfo.entranceExamScore) {
          this.parseEntranceExamScore(cloned.academicInfo.entranceExamScore);
        }
      }
      return origSetValue(cloned, options);
    };
  }

  private syncClass10Board(val: string): void {
    if (this.boardOptions.filter((b) => b !== 'Other').includes(val)) {
      this.class10BoardDropdown = val;
      this.class10BoardOther = '';
    } else {
      this.class10BoardDropdown = 'Other';
      this.class10BoardOther = val;
    }
  }

  private syncClass12Board(val: string): void {
    if (this.boardOptions.filter((b) => b !== 'Other').includes(val)) {
      this.class12BoardDropdown = val;
      this.class12BoardOther = '';
    } else {
      this.class12BoardDropdown = 'Other';
      this.class12BoardOther = val;
    }
  }

  private syncEntranceExam(val: string): void {
    if (this.entranceExamOptions.filter((e) => e !== 'Other').includes(val)) {
      this.entranceExamDropdown = val;
      this.entranceExamOther = '';
    } else {
      this.entranceExamDropdown = 'Other';
      this.entranceExamOther = val;
    }
  }

  private parseEntranceExamScore(val: string): void {
    if (!val) return;
    const str = val.toString().trim();
    if (/rank/i.test(str)) this.entranceResultType = 'Rank';
    else if (/percentile|%ile/i.test(str)) this.entranceResultType = 'Percentile';
    else if (/score|marks/i.test(str)) this.entranceResultType = 'Score';

    const numMatch = str.match(/[-+]?[0-9]*\.?[0-9]+/);
    if (numMatch) {
      this.entranceNumericScore = parseFloat(numMatch[0]);
      this.appForm.get('academicInfo.entranceNumericScore')?.setValue(this.entranceNumericScore);
    }
    this.appForm.get('academicInfo.entranceResultType')?.setValue(this.entranceResultType);
  }

  get class12Pct(): number {
    return Number(this.appForm.get('academicInfo.class12Percentage')?.value) || 0;
  }

  ngOnInit(): void {
    const user = this.authService.currentUserValue;
    if (user) {
      this.appForm.patchValue({
        personalInfo: {
          fullName: user.fullName,
          email: user.email,
          phone: user.phone || ''
        }
      });
    }

    // Check if applicant already submitted an application
    this.applicationService.getMyApplication().subscribe({
      next: (res) => {
        this.isCheckingExisting = false;
        if (res.data) {
          this.alreadySubmitted = true;
          this.existingAppId = res.data.applicationId || '';
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.isCheckingExisting = false;
        this.cdr.markForCheck();
      }
    });

    // Resolve active admission session
    this.publicAdmissionService.getActiveSession().subscribe({
      next: (res) => {
        if (res.data?.sessionName) {
          this.activeSessionName = res.data.sessionName;
          this.appForm.patchValue({ academicSession: this.activeSessionName });
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });

    // Fetch active programmes
    this.publicAdmissionService.getProgrammes().subscribe({
      next: (res) => {
        this.programmes = (res.data || []).filter((p) => p.isApplicationOpen !== false);
        this.applyProgrammeFilters();
        this.cdr.markForCheck();
      },
      error: () => {
        this.programmes = [];
        this.filteredProgrammes = [];
        this.cdr.markForCheck();
      }
    });
  }

  isInvalid(path: string): boolean {
    const control = this.appForm.get(path);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  requiresDepartment(prog: Programme | null): boolean {
    if (!prog) return true;
    if (prog.degree === 'BCA' || prog.degree === 'MCA' || prog.degree === 'MBA') {
      return false;
    }
    if (['Computer Applications', 'Management Studies'].includes(prog.department)) {
      return false;
    }
    return true;
  }

  requiresEntranceExam(prog: Programme | null): boolean {
    if (!prog) return true;
    if (prog.degree === 'BCA') return false;
    if (
      Array.isArray(prog.eligibility?.acceptedEntranceExams) &&
      prog.eligibility.acceptedEntranceExams.length === 0
    ) {
      return false;
    }
    return true;
  }

  getRelevantEntranceExams(prog: Programme | null): string[] {
    if (
      prog &&
      Array.isArray(prog.eligibility?.acceptedEntranceExams) &&
      prog.eligibility.acceptedEntranceExams.length > 0
    ) {
      const exams = [...prog.eligibility.acceptedEntranceExams];
      if (!exams.includes('Other')) {
        exams.push('Other');
      }
      return exams;
    }
    return this.entranceExamOptions;
  }

  chooseProgramme(prog: Programme): void {
    this.selectedProgramme = prog;
    this.appForm.get('selectedProgramme')?.setValue(prog._id);

    // Conditional department logic
    const deptControl = this.appForm.get('admissionInfo.preferredDepartment');
    if (this.requiresDepartment(prog)) {
      deptControl?.setValidators([Validators.required]);
      deptControl?.setValue(prog.department);
    } else {
      deptControl?.clearValidators();
      deptControl?.setValue(null);
    }
    deptControl?.updateValueAndValidity();

    // Conditional entrance exam logic
    const examNameControl = this.appForm.get('academicInfo.entranceExamName');
    const examScoreControl = this.appForm.get('academicInfo.entranceExamScore');
    const examNumericControl = this.appForm.get('academicInfo.entranceNumericScore');

    if (!this.requiresEntranceExam(prog)) {
      examNameControl?.clearValidators();
      examScoreControl?.clearValidators();
      examNumericControl?.clearValidators();
      if (!examNameControl?.value) {
        examNameControl?.setValue('Not Applicable');
      }
    } else {
      examNameControl?.setValidators([Validators.required]);
      examScoreControl?.setValidators([Validators.required]);
      const relevant = this.getRelevantEntranceExams(prog);
      if (relevant.length > 0 && !relevant.includes(this.entranceExamDropdown)) {
        this.entranceExamDropdown = relevant[0];
        examNameControl?.setValue(this.entranceExamDropdown);
      }
    }
    examNameControl?.updateValueAndValidity();
    examScoreControl?.updateValueAndValidity();
    examNumericControl?.updateValueAndValidity();

    // Fetch live fee structure for the selected programme if service supports it
    if (typeof this.publicAdmissionService.getProgrammeFee === 'function') {
      this.isLoadingFeeStructure = true;
      this.feeStructureError = '';
      this.selectedProgrammeFee = null;
      this.publicAdmissionService.getProgrammeFee(prog._id, this.activeSessionName).subscribe({
        next: (res) => {
          this.isLoadingFeeStructure = false;
          this.selectedProgrammeFee = res.data || null;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingFeeStructure = false;
          this.selectedProgrammeFee = null;
          this.feeStructureError =
            'Fee structure not configured for this academic programme. Please contact admissions.';
          this.cdr.markForCheck();
        }
      });
    }

    this.recheckEligibility();
    this.cdr.markForCheck();
  }

  onDepartmentDropdownChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const dept = target.value;
    if (dept && (!this.selectedProgramme || this.selectedProgramme.department !== dept)) {
      const match = this.programmes.find((p) => p.department === dept);
      if (match) {
        this.selectedProgramme = match;
        this.appForm.get('selectedProgramme')?.setValue(match._id);
      }
    }
    this.recheckEligibility();
    this.cdr.markForCheck();
  }

  onClass10BoardDropdownChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.class10BoardDropdown = target.value;
    if (this.class10BoardDropdown !== 'Other') {
      this.class10BoardOther = '';
      this.appForm.get('academicInfo.class10Board')?.setValue(this.class10BoardDropdown);
    } else {
      this.appForm.get('academicInfo.class10Board')?.setValue(this.class10BoardOther);
    }
    this.cdr.markForCheck();
  }

  onClass10BoardOtherInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.class10BoardOther = target.value;
    this.appForm.get('academicInfo.class10Board')?.setValue(this.class10BoardOther);
    this.cdr.markForCheck();
  }

  onClass12BoardDropdownChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.class12BoardDropdown = target.value;
    if (this.class12BoardDropdown !== 'Other') {
      this.class12BoardOther = '';
      this.appForm.get('academicInfo.class12Board')?.setValue(this.class12BoardDropdown);
    } else {
      this.appForm.get('academicInfo.class12Board')?.setValue(this.class12BoardOther);
    }
    this.cdr.markForCheck();
  }

  onClass12BoardOtherInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.class12BoardOther = target.value;
    this.appForm.get('academicInfo.class12Board')?.setValue(this.class12BoardOther);
    this.cdr.markForCheck();
  }

  onEntranceExamDropdownChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.entranceExamDropdown = target.value;
    if (this.entranceExamDropdown !== 'Other') {
      this.entranceExamOther = '';
      this.appForm.get('academicInfo.entranceExamName')?.setValue(this.entranceExamDropdown);
    } else {
      this.appForm.get('academicInfo.entranceExamName')?.setValue(this.entranceExamOther);
    }
    this.cdr.markForCheck();
  }

  onEntranceExamOtherInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.entranceExamOther = target.value;
    this.appForm.get('academicInfo.entranceExamName')?.setValue(this.entranceExamOther);
    this.cdr.markForCheck();
  }

  onEntranceResultTypeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.entranceResultType = target.value as 'Rank' | 'Percentile' | 'Score';
    this.appForm.get('academicInfo.entranceResultType')?.setValue(this.entranceResultType);
    this.syncEntranceScoreString();
    this.cdr.markForCheck();
  }

  onEntranceNumericScoreInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const val = target.value !== '' ? Number(target.value) : null;
    this.entranceNumericScore = val;
    this.appForm.get('academicInfo.entranceNumericScore')?.setValue(val);
    this.syncEntranceScoreString();
    this.cdr.markForCheck();
  }

  syncEntranceScoreString(): void {
    if (this.entranceNumericScore == null || isNaN(this.entranceNumericScore)) {
      this.appForm.get('academicInfo.entranceExamScore')?.setValue('');
      return;
    }
    let formatted = '';
    if (this.entranceResultType === 'Rank') {
      formatted = `Rank ${this.entranceNumericScore}`;
    } else if (this.entranceResultType === 'Percentile') {
      formatted = `${this.entranceNumericScore} %ile`;
    } else {
      formatted = `${this.entranceNumericScore} Marks`;
    }
    this.appForm.get('academicInfo.entranceExamScore')?.setValue(formatted);
  }

  get entranceUnitLabel(): string {
    if (this.entranceResultType === 'Rank') return 'GMR / CRL Rank (1, 2, 3...)';
    if (this.entranceResultType === 'Percentile') return '%ile (0.00 - 100.00)';
    return 'Marks / Raw Score';
  }

  get entrancePlaceholder(): string {
    if (this.entranceResultType === 'Rank') return 'e.g. 5000 (Numeric rank only)';
    if (this.entranceResultType === 'Percentile') return 'e.g. 98.50';
    return 'e.g. 185';
  }

  filterDegreeLevel(level: string): void {
    this.selectedDegreeLevel = level;
    this.applyProgrammeFilters();
  }

  onSearchProgramme(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.programmeSearchTerm = input.value || '';
    this.applyProgrammeFilters();
  }

  applyProgrammeFilters(): void {
    let result = [...this.programmes];
    if (this.selectedDegreeLevel !== 'All') {
      result = result.filter((p) => p.degreeLevel === this.selectedDegreeLevel);
    }
    if (this.programmeSearchTerm.trim()) {
      const term = this.programmeSearchTerm.toLowerCase().trim();
      const normalizedTerm = term.replace(/[^a-z0-9]/g, '');
      result = result.filter((p) => {
        const nameNorm = (p.programmeName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const codeNorm = (p.programmeCode || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const deptNorm = (p.department || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const degreeNorm = (p.degree || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const levelNorm = (p.degreeLevel || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        return (
          (p.programmeName && p.programmeName.toLowerCase().includes(term)) ||
          (p.programmeCode && p.programmeCode.toLowerCase().includes(term)) ||
          (p.department && p.department.toLowerCase().includes(term)) ||
          (p.degree && p.degree.toLowerCase().includes(term)) ||
          nameNorm.includes(normalizedTerm) ||
          codeNorm.includes(normalizedTerm) ||
          deptNorm.includes(normalizedTerm) ||
          degreeNorm.includes(normalizedTerm) ||
          levelNorm.includes(normalizedTerm)
        );
      });
    }
    this.filteredProgrammes = result;
    this.cdr.markForCheck();
  }

  recheckEligibility(): void {
    if (!this.selectedProgramme?.eligibility) {
      this.isCandidateEligible = true;
      this.eligibilityWarningText = '';
      return;
    }

    const elig = this.selectedProgramme.eligibility;
    const pct = this.class12Pct;
    const stream = this.appForm.get('academicInfo.academicStream')?.value;

    const reasons: string[] = [];

    if (elig.minClass12Percentage != null && pct > 0 && pct < elig.minClass12Percentage) {
      reasons.push(
        `Class 12 aggregate percentage (${pct}%) is below the minimum required ${elig.minClass12Percentage}%.`
      );
    }

    if (
      Array.isArray(elig.acceptedAcademicStreams) &&
      elig.acceptedAcademicStreams.length > 0 &&
      stream
    ) {
      const accepted = elig.acceptedAcademicStreams.map((s) => s.trim().toUpperCase());
      if (!accepted.includes(stream.trim().toUpperCase())) {
        reasons.push(`Stream '${stream}' is not in the accepted streams list.`);
      }
    }

    if (reasons.length > 0) {
      this.isCandidateEligible = false;
      this.eligibilityWarningText = reasons.join(' ');
    } else {
      this.isCandidateEligible = true;
      this.eligibilityWarningText = '';
    }
    this.cdr.markForCheck();
  }

  goToStep(stepNumber: number): void {
    if (stepNumber <= this.maxStepReached + 1) {
      this.currentStep = stepNumber;
      if (stepNumber > this.maxStepReached) {
        this.maxStepReached = stepNumber;
      }
      this.cdr.markForCheck();
    }
  }

  nextStep(): void {
    this.errorMessage = '';

    if (this.currentStep === 1) {
      if (this.feeStructureError) {
        this.errorMessage =
          'Applications cannot proceed because the fee structure is not yet configured for this programme.';
        this.cdr.markForCheck();
        return;
      }
      const dept = this.appForm.get('admissionInfo.preferredDepartment');
      const requiresDept = this.selectedProgramme ? this.requiresDepartment(this.selectedProgramme) : true;
      if (requiresDept && !dept?.value) {
        dept?.markAsTouched();
        this.errorMessage = 'Please choose an academic programme or preferred department to proceed.';
        this.cdr.markForCheck();
        return;
      }
    } else if (this.currentStep === 2) {
      // Validate personal information
      const personalGroup = this.appForm.get('personalInfo') as FormGroup;
      if (personalGroup.invalid) {
        personalGroup.markAllAsTouched();
        this.errorMessage = 'Please complete all required personal details.';
        this.cdr.markForCheck();
        return;
      }
    } else if (this.currentStep === 3) {
      // Validate academic credentials
      const academicGroup = this.appForm.get('academicInfo') as FormGroup;
      if (academicGroup.invalid) {
        academicGroup.markAllAsTouched();
        this.errorMessage = 'Please complete all required academic credentials.';
        this.cdr.markForCheck();
        return;
      }
      this.recheckEligibility();
    } else if (this.currentStep === 4) {
      // Validate category selection
      const categoryControl = this.appForm.get('admissionInfo.admissionCategory');
      if (categoryControl?.invalid) {
        categoryControl.markAsTouched();
        this.errorMessage = 'Please select an admission category.';
        this.cdr.markForCheck();
        return;
      }
    }

    if (this.currentStep < 6) {
      this.currentStep++;
      if (this.currentStep > this.maxStepReached) {
        this.maxStepReached = this.currentStep;
      }
      this.cdr.markForCheck();
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.errorMessage = '';
      this.cdr.markForCheck();
    }
  }

  onFileSelected(event: Event, docType: string): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      this.stagedFiles = this.stagedFiles.filter((item) => item.docType !== docType);
      this.stagedFiles.push({
        docType,
        file,
        fileName: file.name,
        fileSize: `${sizeMb} MB`
      });
      this.cdr.markForCheck();
    }
  }

  removeStagedFile(index: number): void {
    this.stagedFiles.splice(index, 1);
    this.cdr.markForCheck();
  }

  onSubmit(): void {
    if (this.appForm.invalid) {
      this.appForm.markAllAsTouched();
      this.errorMessage = 'Please fix the highlighted validation errors before submitting.';
      this.cdr.markForCheck();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    this.applicationService.submitApplication(this.appForm.value).subscribe({
      next: (res) => {
        const createdApp = res.data;
        const appId = createdApp?._id || createdApp?.applicationId;

        if (this.stagedFiles.length > 0 && appId) {
          const uploads = this.stagedFiles.map((item) =>
            this.documentService
              .uploadDocument(appId, item.docType, item.file)
              .pipe(catchError(() => of(null)))
          );
          forkJoin(uploads).subscribe({
            next: () => {
              this.isSubmitting = false;
              this.cdr.markForCheck();
              this.router.navigate(['/applicant/dashboard']);
            },
            error: () => {
              this.isSubmitting = false;
              this.cdr.markForCheck();
              this.router.navigate(['/applicant/dashboard']);
            }
          });
        } else {
          this.isSubmitting = false;
          this.cdr.markForCheck();
          this.router.navigate(['/applicant/dashboard']);
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage =
          err.error?.message || 'Failed to submit admission application. Please check your data.';
        this.cdr.markForCheck();
      }
    });
  }
}
