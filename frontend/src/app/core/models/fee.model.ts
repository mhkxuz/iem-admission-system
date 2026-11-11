export interface SemesterFee {
  semesterNumber: number;
  amount: number;
}

export interface AdditionalFee {
  feeName: string;
  amount: number;
  description?: string;
}

export interface FeeStructure {
  _id: string;
  programme: {
    _id: string;
    programmeName: string;
    programmeCode: string;
    department?: string;
    degree?: string;
    duration?: number;
    durationUnit?: string;
  };
  academicSession: {
    _id: string;
    sessionName: string;
    sessionCode: string;
    isActive?: boolean;
    status?: string;
  };
  applicationFee: number;
  admissionFee: number;
  semesterFees: SemesterFee[];
  additionalFees: AdditionalFee[];
  totalProgrammeFee: number;
  currency: string;
  paymentInstructions?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}
