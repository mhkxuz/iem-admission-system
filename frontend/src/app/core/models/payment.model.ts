export interface FeeSnapshotItem {
  name: string;
  amount: number;
  isOptional?: boolean;
}

export interface FeeSnapshot {
  admissionFee?: number;
  totalProgrammeFee?: number;
  totalAmount?: number;
  currency?: string;
  description?: string;
  components?: FeeSnapshotItem[];
  snapshotDate?: string;
}

export interface PaymentAudit {
  action: string;
  performedBy?: any;
  timestamp: string;
  remarks?: string;
  details?: string;
  source?: string;
}

export interface Payment {
  _id: string;
  orderId: string;
  paymentId?: string;
  applicant: any;
  application: any;
  programme: any;
  academicSession: string;
  feeStructure?: any;
  amount: number;
  currency: string;
  status: 'Initiated' | 'Pending' | 'Successful' | 'Failed' | 'Cancelled';
  gateway?: string;
  method?: string;
  feeSnapshot?: FeeSnapshot;
  signature?: string;
  failureReason?: string;
  auditHistory: PaymentAudit[];
  createdAt: string;
  updatedAt: string;
}

export interface Enrolment {
  _id: string;
  enrolmentNumber: string;
  applicant: any;
  application: any;
  applicationId?: string;
  programme: any;
  academicSession: string;
  allocatedCategory: string;
  seatNumber?: number;
  payment: any;
  feeAmountPaid?: number;
  currency?: string;
  status?: 'Confirmed' | 'Cancelled';
  enrolmentStatus?: 'Confirmed' | 'Cancelled';
  confirmedAt: string;
  createdAt?: string;
}

export interface AdmissionEligibility {
  isEligible: boolean;
  rejectionReason?: string;
  reason?: string;
  alreadyEnrolled?: boolean;
  enrolment?: Enrolment;
  application?: any;
  programme?: any;
  allocation?: {
    allocatedCategory: string;
    seatNumber?: number;
    meritRank?: number;
  };
  seatAllocation?: {
    status: string;
    seatNumber?: number;
    allocatedCategory: string;
    allocationRound?: number;
  };
  feeStructure?: {
    _id?: string;
    admissionFee: number;
    totalProgrammeFee?: number;
    paymentInstructions?: string;
    currency: string;
    components?: FeeSnapshotItem[];
  };
}

export interface PaymentOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  keyId?: string;
  isSandbox?: boolean;
  candidateName?: string;
  candidateEmail?: string;
  candidatePhone?: string;
  programmeName?: string;
  programmeCode?: string;
  academicSession?: string;
  admissionFeeAmount?: number;
  allocatedCategory?: string;
}

export interface AdmissionReceipt {
  hasConfirmedAdmission: boolean;
  enrolmentNumber?: string;
  candidateName?: string;
  candidateEmail?: string;
  candidatePhone?: string;
  applicationId?: string;
  programme?: any;
  academicSession?: string;
  allocatedCategory?: string;
  seatNumber?: number;
  orderId?: string;
  paymentReference?: string;
  paymentMethod?: string;
  feeAmountPaid?: number;
  currency?: string;
  feeSnapshot?: FeeSnapshot;
  confirmedAt?: string;
  payment?: any;
  eligibility?: AdmissionEligibility;
}

export interface PaymentStatistics {
  totalEnrolled: number;
  totalEnrolments?: number;
  totalFeesCollected: number;
  totalFeeCollected?: number;
  totalPaymentsSuccessful: number;
  totalPaymentsPending: number;
  totalPaymentsFailed: number;
  byProgramme?: Array<{
    programmeId: string;
    programmeName?: string;
    programmeCode?: string;
    enrolledCount?: number;
    count?: number;
    feeCollected: number;
  }>;
  byCategory?: Array<{
    category: string;
    count: number;
  }>;
}
