export interface OverviewKpis {
  totalApplications: number;
  selectedApplications: number;
  rejectedApplications: number;
  submittedApplications: number;
  underReviewApplications: number;
  totalDocuments: number;
  verifiedDocuments: number;
  pendingDocuments: number;
  rejectedDocuments: number;
  confirmedEnrolments: number;
  verifiedCollectedRevenue: number;
  completionRate: number;
}

export interface OverviewMonthlyTrend {
  month: string;
  applications: number;
  revenue: number;
}

export interface OverviewAnalytics {
  kpis: OverviewKpis;
  monthlyTrends: OverviewMonthlyTrend[];
}

export interface ApplicationAnalytics {
  total: number;
  statusBreakdown: { _id: string; count: number }[];
  programmeBreakdown: { _id: string; programmeCode: string; programmeName: string; count: number }[];
  sessionBreakdown: { _id: string; count: number }[];
  categoryBreakdown: { _id: string; count: number }[];
  completionMetrics: {
    total: number;
    completed: number;
    pending: number;
    completionRate: number;
  };
  timelineTrends: { date: string; count: number }[];
}

export interface DocumentTypeStat {
  _id: string;
  total: number;
  verified: number;
  pending: number;
  rejected: number;
}

export interface ReviewerWorkload {
  reviewerId: string;
  name: string;
  email: string;
  totalVerified: number;
}

export interface DocumentAnalytics {
  totalDocuments: number;
  verifiedCount: number;
  pendingCount: number;
  rejectedCount: number;
  verificationRate: number;
  documentTypeDistribution: DocumentTypeStat[];
  reviewerWorkloads: ReviewerWorkload[];
  outstandingRequirements: {
    pendingApplicationsCount: number;
    unverifiedDocumentsCount: number;
  };
}

export interface MeritCutoffSummary {
  programmeCode: string;
  programmeName: string;
  academicSession: string;
  roundNumber: number;
  status: string;
  cutoffs: { category: string; minimumScore: number }[];
}

export interface ProgrammeSeatUtilization {
  programmeId: string;
  programmeCode: string;
  programmeName: string;
  totalCapacity: number;
  allocatedSeats: number;
  confirmedSeats: number;
  waitlistedSeats: number;
  vacantSeats: number;
  utilizationPercentage: number;
  categoryBreakdown: {
    category: string;
    capacity: number;
    allocated: number;
  }[];
}

export interface MeritAnalytics {
  totalMeritLists: number;
  totalCandidatesScreened: number;
  totalAllocations: number;
  totalConfirmedAllocations: number;
  totalWaitlistedAllocations: number;
  totalCancelledAllocations: number;
  cutoffSummaries: MeritCutoffSummary[];
  programmeSeatUtilization: ProgrammeSeatUtilization[];
}

export interface ProgrammeFeeCollection {
  programmeCode: string;
  programmeName: string;
  feeCollected: number;
  enrolledCount: number;
}

export interface CategoryEnrolment {
  category: string;
  count: number;
  feeCollected: number;
}

export interface DailyRevenueTrend {
  date: string;
  revenue: number;
  transactions: number;
}

export interface PaymentAnalytics {
  confirmedEnrolments: number;
  verifiedCollectedRevenue: number;
  paymentStatusBreakdown: { _id: string; count: number; totalAmount: number }[];
  programmeCollections: ProgrammeFeeCollection[];
  categoryEnrolments: CategoryEnrolment[];
  dailyRevenueTrends: DailyRevenueTrend[];
  reconciliationSummary: {
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    pendingTransactions: number;
    reconciliationMatchRate: number;
  };
}

export interface ReportFilterParams {
  academicSession?: string;
  programmeId?: string;
  status?: string;
  category?: string;
  documentStatus?: string;
  paymentStatus?: string;
  startDate?: string;
  endDate?: string;
}

export type ExportReportType =
  | 'applications'
  | 'applicants'
  | 'documents'
  | 'merit'
  | 'allocations'
  | 'payments'
  | 'enrolments'
  | 'fee-summary';

export type ExportFormat = 'csv' | 'pdf';
