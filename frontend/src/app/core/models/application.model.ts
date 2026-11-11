export interface PersonalInfo {
  fullName: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  email: string;
  phone: string;
  address: string;
  state: string;
  city: string;
  pincode: string;
}

export interface AcademicInfo {
  class10Board: string;
  class10Percentage: number;
  class12Board: string;
  class12Percentage: number;
  class12PassingYear: number;
  entranceExamName: string;
  entranceExamScore: string;
  entranceResultType?: string;
  entranceNumericScore?: number;
  academicStream?: string;
}

export interface AdmissionInfo {
  preferredDepartment?: string | null;
  admissionCategory: string;
}

export type ApplicationStatus = 'Submitted' | 'Under Review' | 'Selected' | 'Rejected';

export interface StatusHistoryEntry {
  _id?: string;
  application?: string;
  previousStatus: ApplicationStatus;
  newStatus: ApplicationStatus;
  changedBy?: {
    _id: string;
    fullName: string;
    role: 'applicant' | 'admin';
    email?: string;
  };
  remarks?: string;
  timestamp?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdmissionApplication {
  _id?: string;
  applicationId?: string;
  applicant?: any;
  academicSession: string;
  selectedProgramme?: any;
  personalInfo: PersonalInfo;
  academicInfo: AcademicInfo;
  admissionInfo: AdmissionInfo;
  status?: ApplicationStatus;
  documentVerificationStatus?: string;
  submittedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  documents?: any[];
  statusHistory?: StatusHistoryEntry[];
  allowedNextStatuses?: ApplicationStatus[];
}
