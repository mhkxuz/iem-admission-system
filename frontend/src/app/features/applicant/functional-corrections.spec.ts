import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApplicationFormComponent } from './application-form/application-form.component';
import { ApplicantDashboardComponent } from './dashboard/applicant-dashboard.component';
import { LoginComponent } from '../auth/login/login.component';
import { RegisterComponent } from '../auth/register/register.component';
import { AdminReviewersComponent } from '../admin/reviewers/admin-reviewers.component';
import { AuthService } from '../../core/services/auth.service';
import { ApplicationService } from '../../core/services/application.service';
import { PublicAdmissionService } from '../../core/services/public-admission.service';
import { DocumentService } from '../../core/services/document.service';
import { MeritService } from '../../core/services/merit.service';
import { PaymentService } from '../../core/services/payment.service';
import { AdminService } from '../../core/services/admin.service';

const mockProgrammes = [
  {
    _id: 'prog-btech-cse',
    programmeName: 'B.Tech in Computer Science & Engineering',
    programmeCode: 'BTECH-CSE',
    degreeLevel: 'Undergraduate',
    degree: 'B.Tech',
    department: 'Computer Science & Engineering',
    duration: 4,
    durationUnit: 'years',
    isApplicationOpen: true,
    eligibility: {
      minClass12Percentage: 60,
      acceptedAcademicStreams: ['Science (PCM)'],
      acceptedEntranceExams: ['WBJEE', 'JEE Main']
    }
  },
  {
    _id: 'prog-bca',
    programmeName: 'Bachelor of Computer Applications',
    programmeCode: 'BCA',
    degreeLevel: 'Undergraduate',
    degree: 'BCA',
    department: 'Computer Applications',
    duration: 3,
    durationUnit: 'years',
    isApplicationOpen: true,
    eligibility: {
      minClass12Percentage: 50,
      acceptedAcademicStreams: ['Science (PCM)', 'Commerce'],
      acceptedEntranceExams: []
    }
  }
];

const mockFee = {
  _id: 'fee-1',
  programme: { _id: 'prog-btech-cse', programmeName: 'B.Tech in CSE', programmeCode: 'BTECH-CSE' },
  academicSession: { _id: 'sess-1', sessionName: '2026-2027', sessionCode: '2026-2027' },
  admissionFee: 50000,
  applicationFee: 1000,
  semesterFees: [{ semesterNumber: 1, amount: 45000 }],
  additionalFees: [{ feeName: 'Lab Deposit', amount: 10000 }],
  totalProgrammeFee: 420000,
  currency: 'INR',
  paymentInstructions: 'Pay online via IEM portal.'
};

describe('Final Functional Corrections — Comprehensive Frontend Verification', () => {
  let authServiceSpy: any;
  let applicationServiceSpy: any;
  let publicAdmissionServiceSpy: any;
  let documentServiceSpy: any;
  let meritServiceSpy: any;
  let paymentServiceSpy: any;
  let adminServiceSpy: any;

  beforeEach(async () => {
    authServiceSpy = {
      currentUserValue: { _id: 'user-1', fullName: 'Subhajit Paul', email: 'subhajit@example.com', role: 'applicant' },
      currentUser$: of({ _id: 'user-1', fullName: 'Subhajit Paul', email: 'subhajit@example.com', role: 'applicant' })
    };

    applicationServiceSpy = {
      getMyApplication: () => of({ success: true, data: null }),
      submitApplication: (data: any) => of({ success: true, data: { ...data, _id: 'app-1', applicationId: 'IEM-2026-00001' } })
    };

    publicAdmissionServiceSpy = {
      getActiveSession: () => of({ success: true, data: { sessionName: '2026-2027', sessionCode: '2026-2027' } }),
      getProgrammes: () => of({ success: true, data: mockProgrammes }),
      getProgrammeFee: () => of({ success: true, data: mockFee })
    };

    documentServiceSpy = {
      getDocuments: () => of({ success: true, data: [] }),
      getDocumentsByApplication: () => of({ success: true, data: [] }),
      uploadDocument: () => of({ success: true })
    };

    meritServiceSpy = {
      getMyResult: () => of({ success: true, data: { hasPublishedResult: false } })
    };

    paymentServiceSpy = {
      getAdmissionReceipt: () => of({ success: true, data: { hasConfirmedAdmission: false, eligibility: null } }),
      getAdmissionStatus: () => of({ success: true, data: { isConfirmed: false, eligibility: { isEligible: true, allocation: { seatNumber: 12 } } } }),
      createOrder: () => of({ success: true, data: { orderId: 'ord_123', amount: 50000, isSandbox: true } }),
      verifyPayment: () => of({ success: true, data: { enrolment: { enrolmentNumber: 'ENR-2026-00101' } } })
    };

    adminServiceSpy = {
      getUsers: () => of({ success: true, data: [] }),
      createReviewer: () => of({ success: true }),
      updateUserRole: () => of({ success: true })
    };

    await TestBed.configureTestingModule({
      imports: [
        ApplicationFormComponent,
        ApplicantDashboardComponent,
        LoginComponent,
        RegisterComponent,
        AdminReviewersComponent
      ],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: ApplicationService, useValue: applicationServiceSpy },
        { provide: PublicAdmissionService, useValue: publicAdmissionServiceSpy },
        { provide: DocumentService, useValue: documentServiceSpy },
        { provide: MeritService, useValue: meritServiceSpy },
        { provide: PaymentService, useValue: paymentServiceSpy },
        { provide: AdminService, useValue: adminServiceSpy }
      ]
    }).compileComponents();
  });

  describe('1. Academic Credentials (Board & Entrance Exam Dropdowns & Structured Score)', () => {
    it('should provide board dropdown options and reveal custom input for Other', () => {
      const fixture = TestBed.createComponent(ApplicationFormComponent);
      const comp = fixture.componentInstance;
      fixture.detectChanges();

      expect(comp.boardOptions).toContain('CBSE');
      expect(comp.boardOptions).toContain('CISCE / ICSE');
      expect(comp.boardOptions).toContain('WBCHSE');
      expect(comp.boardOptions).toContain('Other');

      // Select 'Other'
      comp.onClass10BoardDropdownChange({ target: { value: 'Other' } } as any);
      expect(comp.class10BoardDropdown).toBe('Other');

      // Enter custom board
      comp.onClass10BoardOtherInput({ target: { value: 'Karnataka State Board' } } as any);
      expect(comp.appForm.get('academicInfo.class10Board')?.value).toBe('Karnataka State Board');
    });

    it('should support structured entrance result types (Rank, Percentile, Score) and numeric validation', () => {
      const fixture = TestBed.createComponent(ApplicationFormComponent);
      const comp = fixture.componentInstance;
      fixture.detectChanges();

      // Test Rank
      comp.onEntranceResultTypeChange({ target: { value: 'Rank' } } as any);
      expect(comp.entranceResultType).toBe('Rank');
      expect(comp.entranceUnitLabel).toContain('Rank');

      comp.onEntranceNumericScoreInput({ target: { value: '1450' } } as any);
      expect(comp.entranceNumericScore).toBe(1450);
      expect(comp.appForm.get('academicInfo.entranceExamScore')?.value).toBe('Rank 1450');

      // Test Percentile
      comp.onEntranceResultTypeChange({ target: { value: 'Percentile' } } as any);
      expect(comp.entranceResultType).toBe('Percentile');
      expect(comp.entranceUnitLabel).toContain('%ile');

      comp.onEntranceNumericScoreInput({ target: { value: '98.5' } } as any);
      expect(comp.appForm.get('academicInfo.entranceExamScore')?.value).toBe('98.5 %ile');

      // Test Score
      comp.onEntranceResultTypeChange({ target: { value: 'Score' } } as any);
      expect(comp.entranceResultType).toBe('Score');
      expect(comp.entranceUnitLabel).toContain('Marks');

      comp.onEntranceNumericScoreInput({ target: { value: '180' } } as any);
      expect(comp.appForm.get('academicInfo.entranceExamScore')?.value).toBe('180 Marks');
    });
  });

  describe('2. Programme Catalogue, Normalization & Conditional Department Logic', () => {
    it('should normalize search queries and match B.Tech against BTECH-CSE', () => {
      const fixture = TestBed.createComponent(ApplicationFormComponent);
      const comp = fixture.componentInstance;
      fixture.detectChanges();

      comp.programmeSearchTerm = 'B.Tech';
      comp.applyProgrammeFilters();
      expect(comp.filteredProgrammes.some((p) => p.programmeCode === 'BTECH-CSE')).toBe(true);

      comp.programmeSearchTerm = 'btech';
      comp.applyProgrammeFilters();
      expect(comp.filteredProgrammes.some((p) => p.programmeCode === 'BTECH-CSE')).toBe(true);

      comp.programmeSearchTerm = 'computer applications';
      comp.applyProgrammeFilters();
      expect(comp.filteredProgrammes.some((p) => p.programmeCode === 'BCA')).toBe(true);
    });

    it('should require department for B.Tech but NOT for BCA', () => {
      const fixture = TestBed.createComponent(ApplicationFormComponent);
      const comp = fixture.componentInstance;
      fixture.detectChanges();

      // B.Tech CSE -> requires department
      comp.chooseProgramme(mockProgrammes[0] as any);
      expect(comp.requiresDepartment(comp.selectedProgramme)).toBe(true);
      expect(comp.appForm.get('admissionInfo.preferredDepartment')?.value).toBe('Computer Science & Engineering');

      // Switch to BCA -> does NOT require department
      comp.chooseProgramme(mockProgrammes[1] as any);
      expect(comp.requiresDepartment(comp.selectedProgramme)).toBe(false);
      expect(comp.appForm.get('admissionInfo.preferredDepartment')?.value).toBeNull();
      expect(comp.requiresEntranceExam(comp.selectedProgramme)).toBe(false);
    });

    it('should display live fee structure when a programme is selected', () => {
      const fixture = TestBed.createComponent(ApplicationFormComponent);
      const comp = fixture.componentInstance;
      fixture.detectChanges();

      comp.chooseProgramme(mockProgrammes[0] as any);
      expect(comp.selectedProgrammeFee).toBeTruthy();
      expect(comp.selectedProgrammeFee?.admissionFee).toBe(50000);
      expect(comp.selectedProgrammeFee?.totalProgrammeFee).toBe(420000);
    });
  });

  describe('3. 9-Step Admission Progress Tracker & Sandbox Simulation', () => {
    it('should compute appropriate step classes across the admission lifecycle', () => {
      const mockApp = {
        _id: 'app-1',
        applicationId: 'IEM-2026-00001',
        academicSession: '2026-2027',
        status: 'Under Review',
        personalInfo: {} as any,
        academicInfo: {} as any,
        admissionInfo: {} as any
      };
      applicationServiceSpy.getMyApplication = () => of({ success: true, data: mockApp });
      const fixture = TestBed.createComponent(ApplicantDashboardComponent);
      const comp = fixture.componentInstance;
      fixture.detectChanges();

      expect(comp.getStepClass(1)).toBe('completed'); // Submitted
      expect(comp.getStepClass(2)).toBe('completed'); // Under Review
      expect(comp.getStepStateLabel(1)).toBe('Completed');
    });

    it('should simulate cancelled payment gracefully in sandbox mode', () => {
      const fixture = TestBed.createComponent(ApplicantDashboardComponent);
      const comp = fixture.componentInstance;
      comp.activePaymentOrder = { orderId: 'ord_123', amount: 50000, isSandbox: true } as any;
      comp.showCheckoutModal = true;
      fixture.detectChanges();

      comp.simulateCancelledPayment();

      expect(comp.showCheckoutModal).toBe(false);
      expect(comp.paymentErrorMessage).toContain('cancelled by the applicant');
    });
  });

  describe('4. Password Visibility Toggle', () => {
    it('should toggle password visibility on login page', () => {
      const fixture = TestBed.createComponent(LoginComponent);
      const comp = fixture.componentInstance;
      fixture.detectChanges();

      expect(comp.showPassword).toBe(false);
      comp.togglePasswordVisibility();
      expect(comp.showPassword).toBe(true);
      comp.togglePasswordVisibility();
      expect(comp.showPassword).toBe(false);
    });

    it('should toggle password and confirm password on register page', () => {
      const fixture = TestBed.createComponent(RegisterComponent);
      const comp = fixture.componentInstance;
      fixture.detectChanges();

      expect(comp.showPassword).toBe(false);
      expect(comp.showConfirmPassword).toBe(false);

      comp.togglePasswordVisibility();
      comp.toggleConfirmPasswordVisibility();

      expect(comp.showPassword).toBe(true);
      expect(comp.showConfirmPassword).toBe(true);
    });

    it('should toggle password visibility in admin reviewer modal', () => {
      const fixture = TestBed.createComponent(AdminReviewersComponent);
      const comp = fixture.componentInstance;
      fixture.detectChanges();

      expect(comp.showReviewerPassword).toBe(false);
      comp.showReviewerPassword = true;
      expect(comp.showReviewerPassword).toBe(true);
    });
  });
});
