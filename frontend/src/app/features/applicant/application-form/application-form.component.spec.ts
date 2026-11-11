import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ApplicationFormComponent } from './application-form.component';
import { AuthService } from '../../../core/services/auth.service';
import { ApplicationService } from '../../../core/services/application.service';
import { PublicAdmissionService } from '../../../core/services/public-admission.service';
import { DocumentService } from '../../../core/services/document.service';

const applicantUser = {
  _id: 'applicant-1',
  fullName: 'Stage Eight Applicant',
  email: 'stage8@example.com',
  phone: '9830000001',
  role: 'applicant' as const
};

const sampleProgrammes = [
  {
    _id: 'prog-1',
    programmeName: 'B.Tech in Computer Science & Engineering',
    programmeCode: 'BTECH-CSE',
    degreeLevel: 'Undergraduate' as const,
    department: 'Computer Science & Engineering',
    degree: 'B.Tech',
    duration: 4,
    durationUnit: 'Years',
    isApplicationOpen: true,
    eligibility: {
      minClass12Percentage: 60,
      acceptedAcademicStreams: ['Science (PCM)'],
      requiredClass12Subjects: ['Physics', 'Mathematics', 'Chemistry']
    },
    seatCapacity: { total: 120 }
  },
  {
    _id: 'prog-2',
    programmeName: 'B.Tech in Information Technology',
    programmeCode: 'BTECH-IT',
    degreeLevel: 'Undergraduate' as const,
    department: 'Information Technology',
    degree: 'B.Tech',
    duration: 4,
    durationUnit: 'Years',
    isApplicationOpen: true,
    eligibility: {
      minClass12Percentage: 60,
      acceptedAcademicStreams: ['Science (PCM)'],
      requiredClass12Subjects: ['Physics', 'Mathematics', 'Chemistry']
    },
    seatCapacity: { total: 60 }
  }
];

const existingApplication = {
  _id: 'application-1',
  applicationId: 'IEM-2026-ABCDE',
  academicSession: '2026-2027',
  personalInfo: {
    fullName: 'Stage Eight Applicant',
    dob: '2005-04-12',
    gender: 'Male' as const,
    email: 'stage8@example.com',
    phone: '9830000001',
    address: 'Salt Lake Sector V',
    state: 'West Bengal',
    city: 'Kolkata',
    pincode: '700091'
  },
  academicInfo: {
    class10Board: 'ICSE',
    class10Percentage: 91.5,
    class12Board: 'ISC',
    class12Percentage: 93.2,
    class12PassingYear: 2024,
    entranceExamName: 'WBJEE',
    entranceExamScore: 'Rank 1520',
    academicStream: 'Science (PCM)'
  },
  admissionInfo: {
    preferredDepartment: 'Information Technology',
    admissionCategory: 'General'
  }
};

describe('ApplicationFormComponent', () => {
  let fixture: ComponentFixture<ApplicationFormComponent>;
  let component: ApplicationFormComponent;
  let applicationServiceMock: {
    getMyApplication: ReturnType<typeof vi.fn>;
    submitApplication: ReturnType<typeof vi.fn>;
  };
  let publicAdmissionServiceMock: {
    getActiveSession: ReturnType<typeof vi.fn>;
    getProgrammes: ReturnType<typeof vi.fn>;
  };
  let documentServiceMock: {
    uploadDocument: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    applicationServiceMock = {
      getMyApplication: vi.fn(() =>
        of({ success: true, message: 'No application.', data: null })
      ),
      submitApplication: vi.fn(() =>
        of({ success: true, message: 'Application submitted.', data: existingApplication })
      )
    };

    publicAdmissionServiceMock = {
      getActiveSession: vi.fn(() =>
        of({ success: true, message: 'Session', data: { sessionName: '2026-2027' } as any })
      ),
      getProgrammes: vi.fn(() =>
        of({ success: true, message: 'Programmes', data: sampleProgrammes as any })
      )
    };

    documentServiceMock = {
      uploadDocument: vi.fn(() =>
        of({ success: true, message: 'Uploaded', data: {} as any })
      )
    };

    await TestBed.configureTestingModule({
      imports: [ApplicationFormComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUserValue: applicantUser } },
        { provide: ApplicationService, useValue: applicationServiceMock },
        { provide: PublicAdmissionService, useValue: publicAdmissionServiceMock },
        { provide: DocumentService, useValue: documentServiceMock }
      ]
    }).compileComponents();
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(ApplicationFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function fillValidForm(): void {
    component.appForm.setValue({
      academicSession: '2026-2027',
      personalInfo: {
        fullName: 'Stage Eight Applicant',
        dob: '2005-04-12',
        gender: 'Male',
        email: 'stage8@example.com',
        phone: '9830000001',
        address: 'Salt Lake Sector V',
        state: 'West Bengal',
        city: 'Kolkata',
        pincode: '700091'
      },
      academicInfo: {
        class10Board: 'ICSE',
        class10Percentage: 91.5,
        class12Board: 'ISC',
        class12Percentage: 93.2,
        class12PassingYear: 2024,
        entranceExamName: 'WBJEE',
        entranceExamScore: 'Rank 1520'
      },
      admissionInfo: {
        preferredDepartment: 'Information Technology',
        admissionCategory: 'General'
      }
    });
  }

  it('should initialize component successfully', () => {
    createComponent();
    expect(component).toBeTruthy();
    expect(component.appForm).toBeTruthy();
    expect(component.appForm.get('academicSession')?.value).toBe('2026-2027');
  });

  it('should render expected personal information fields', () => {
    createComponent();
    const el = fixture.nativeElement;
    expect(el.querySelector('#fullName')).toBeTruthy();
    expect(el.querySelector('#dob')).toBeTruthy();
    expect(el.querySelector('#gender')).toBeTruthy();
    expect(el.querySelector('#email')).toBeTruthy();
    expect(el.querySelector('#phone')).toBeTruthy();
    expect(el.querySelector('#address')).toBeTruthy();
    expect(el.querySelector('#city')).toBeTruthy();
    expect(el.querySelector('#state')).toBeTruthy();
    expect(el.querySelector('#pincode')).toBeTruthy();
  });

  it('should render academic information fields', () => {
    createComponent();
    const el = fixture.nativeElement;
    expect(el.querySelector('#class10Board')).toBeTruthy();
    expect(el.querySelector('#class10Percentage')).toBeTruthy();
    expect(el.querySelector('#class12Board')).toBeTruthy();
    expect(el.querySelector('#class12Percentage')).toBeTruthy();
    expect(el.querySelector('#class12PassingYear')).toBeTruthy();
    expect(el.querySelector('#entranceExamName')).toBeTruthy();
    expect(el.querySelector('#entranceExamScore')).toBeTruthy();
  });

  it('should render admission preference fields', () => {
    createComponent();
    const el = fixture.nativeElement;
    expect(el.querySelector('#preferredDepartment')).toBeTruthy();
    expect(el.querySelector('#admissionCategory')).toBeTruthy();
  });

  it('should render document upload control', () => {
    createComponent();
    const el = fixture.nativeElement;
    const docControl = el.querySelector(
      '.document-upload-control, .upload-controls, #documentUploadSection'
    );
    expect(docControl).toBeTruthy();
    expect(docControl?.textContent).toContain('Required Documents');
  });

  it('should render submit button', () => {
    createComponent();
    const submitBtn = fixture.nativeElement.querySelector('button[type="submit"].btn-submit');
    expect(submitBtn).toBeTruthy();
    expect(submitBtn?.textContent).toContain('Submit Admission Application');
  });

  it('should prefill applicant identity details and render the form', () => {
    createComponent();

    expect(component.appForm.get('personalInfo.fullName')?.value).toBe(
      'Stage Eight Applicant'
    );
    expect(component.appForm.get('personalInfo.email')?.value).toBe('stage8@example.com');
    expect(component.appForm.get('personalInfo.phone')?.value).toBe('9830000001');
    expect(component.isCheckingExisting).toBe(false);
    expect(fixture.nativeElement.querySelector('form.admission-form')).toBeTruthy();
  });

  it('should warn and hide the form when an application already exists', () => {
    applicationServiceMock.getMyApplication.mockReturnValue(
      of({ success: true, message: 'Application found.', data: existingApplication })
    );

    createComponent();

    expect(component.alreadySubmitted).toBe(true);
    expect(component.existingAppId).toBe('IEM-2026-ABCDE');
    expect(fixture.nativeElement.querySelector('.alert-banner.warning')?.textContent).toContain(
      'IEM-2026-ABCDE'
    );
    expect(fixture.nativeElement.querySelector('form.admission-form')).toBeNull();
  });

  it('should block submission and highlight errors when the form is invalid', () => {
    createComponent();

    component.onSubmit();
    fixture.detectChanges();

    expect(applicationServiceMock.submitApplication).not.toHaveBeenCalled();
    expect(component.errorMessage).toBe(
      'Please fix the highlighted validation errors before submitting.'
    );
    expect(component.appForm.get('personalInfo.fullName')?.touched).toBe(true);
    expect(fixture.nativeElement.querySelector('.alert-banner.error')?.textContent).toContain(
      'Please fix the highlighted validation errors'
    );
  });

  it('should reject malformed phone, pincode and percentage values', () => {
    createComponent();
    fillValidForm();

    component.appForm.get('personalInfo.phone')?.setValue('12345');
    component.appForm.get('personalInfo.pincode')?.setValue('12');
    component.appForm.get('academicInfo.class12Percentage')?.setValue(130);

    expect(component.appForm.get('personalInfo.phone')?.valid).toBe(false);
    expect(component.appForm.get('personalInfo.pincode')?.valid).toBe(false);
    expect(component.appForm.get('academicInfo.class12Percentage')?.valid).toBe(false);
    expect(component.appForm.valid).toBe(false);
  });

  it('should submit a valid application and navigate to the applicant dashboard', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    createComponent();
    fillValidForm();
    expect(component.appForm.valid).toBe(true);

    component.onSubmit();

    expect(applicationServiceMock.submitApplication).toHaveBeenCalledWith(
      component.appForm.value
    );
    expect(navigateSpy).toHaveBeenCalledWith(['/applicant/dashboard']);
    expect(component.isSubmitting).toBe(false);
  });

  it('should display a backend submission error and stop the submitting state', () => {
    applicationServiceMock.submitApplication.mockReturnValue(
      throwError(() => ({
        error: {
          message:
            'You have already submitted an admission application for academic session 2026-2027.'
        }
      }))
    );

    createComponent();
    fillValidForm();
    component.onSubmit();
    fixture.detectChanges();

    expect(component.isSubmitting).toBe(false);
    expect(component.errorMessage).toContain('already submitted');
    expect(fixture.nativeElement.querySelector('.alert-banner.error')?.textContent).toContain(
      'already submitted'
    );
  });

  // --- Stage 1.4 Dynamic Features Tests ---

  it('should load and render academic programmes in Step 1', () => {
    createComponent();

    expect(component.programmes.length).toBe(2);
    expect(component.filteredProgrammes.length).toBe(2);
    const el = fixture.nativeElement;
    const progCards = el.querySelectorAll('.programme-card');
    expect(progCards.length).toBe(2);
    expect(el.textContent).toContain('BTECH-CSE');
  });

  it('should choose a programme and sync preferredDepartment', () => {
    createComponent();

    component.chooseProgramme(sampleProgrammes[0] as any);
    fixture.detectChanges();

    expect(component.selectedProgramme?._id).toBe('prog-1');
    expect(component.appForm.get('selectedProgramme')?.value).toBe('prog-1');
    expect(component.appForm.get('admissionInfo.preferredDepartment')?.value).toBe(
      'Computer Science & Engineering'
    );
  });

  it('should navigate through steps sequentially when steps are valid', () => {
    createComponent();
    fillValidForm();

    expect(component.currentStep).toBe(1);

    component.nextStep(); // Step 1 -> 2
    expect(component.currentStep).toBe(2);

    component.nextStep(); // Step 2 -> 3
    expect(component.currentStep).toBe(3);

    component.nextStep(); // Step 3 -> 4
    expect(component.currentStep).toBe(4);

    component.nextStep(); // Step 4 -> 5
    expect(component.currentStep).toBe(5);

    component.nextStep(); // Step 5 -> 6
    expect(component.currentStep).toBe(6);

    component.prevStep(); // Step 6 -> 5
    expect(component.currentStep).toBe(5);
  });

  it('should warn when candidate percentage is below minimum requirement', () => {
    createComponent();
    component.chooseProgramme(sampleProgrammes[0] as any); // Min 60%

    component.appForm.get('academicInfo.class12Percentage')?.setValue(52);
    component.recheckEligibility();
    fixture.detectChanges();

    expect(component.isCandidateEligible).toBe(false);
    expect(component.eligibilityWarningText).toContain('below the minimum required 60%');
  });

  it('should stage a document file in Step 5', () => {
    createComponent();
    const fakeFile = new File(['dummy content'], 'class10.pdf', { type: 'application/pdf' });
    const event = {
      target: {
        files: [fakeFile]
      }
    } as unknown as Event;

    component.onFileSelected(event, 'Class 10 Marksheet');
    expect(component.stagedFiles.length).toBe(1);
    expect(component.stagedFiles[0].fileName).toBe('class10.pdf');
    expect(component.stagedFiles[0].docType).toBe('Class 10 Marksheet');

    component.removeStagedFile(0);
    expect(component.stagedFiles.length).toBe(0);
  });
});
