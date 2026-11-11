export interface MeritConfiguration {
  _id?: string;
  programme: string | { _id: string; programmeName: string; programmeCode: string };
  academicSession: string;
  class12Weightage: number;
  entranceExamWeightage: number;
  normalizationMethod: 'Score-Based' | 'Rank-Based' | 'Percentile';
  maxEntranceRank: number;
  maxEntranceScore: number;
  tieBreakingPriority: string[];
  unfilledSeatRule: 'Keep Vacant' | 'Convert to General';
  version?: number;
  isDefault?: boolean;
}

export interface MeritListEntry {
  _id?: string;
  application: string;
  applicant: string;
  applicationId: string;
  candidateName: string;
  category: 'General' | 'OBC' | 'SC' | 'ST' | 'EWS' | 'Management';
  class12Percentage: number;
  rawEntranceScore: string;
  normalizedEntranceScore: number;
  compositeScore: number;
  meritRank: number;
  categoryRank: number;
  eligibilityStatus: 'Eligible' | 'Eligible (Pending Documents)' | 'Ineligible';
  eligibilityRemarks: string;
  documentStatus: string;
}

export interface CategoryCutoff {
  category: string;
  highestScore: number;
  lowestScore: number;
  totalApplicants: number;
  eligibleApplicants: number;
}

export interface MeritList {
  _id: string;
  programme: { _id: string; programmeName: string; programmeCode: string; department?: string; degree?: string };
  academicSession: string;
  version: number;
  round: number;
  roundLabel: string;
  status: 'Draft' | 'Published' | 'Archived';
  publishedAt?: string;
  publishedBy?: { firstName?: string; lastName?: string; email?: string };
  entries: MeritListEntry[];
  cutoffs: {
    highestScore: number;
    lowestShortlistedScore: number;
    categoryCutoffs: CategoryCutoff[];
    totalEligible: number;
    totalIneligible: number;
    totalPendingDocs: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AllocationItem {
  _id?: string;
  application: string;
  applicant: string;
  applicationId: string;
  candidateName: string;
  meritRank: number;
  categoryRank: number;
  appliedCategory: string;
  allocatedCategory: string;
  compositeScore: number;
  allocationStatus: 'Allocated' | 'Waitlisted' | 'Ineligible';
  allocationReason: string;
  seatNumber?: number;
}

export interface CategorySummary {
  category: string;
  totalSeats: number;
  allocatedSeats: number;
  remainingSeats: number;
}

export interface AllocationAuditEntry {
  action: 'Generated' | 'Approved' | 'Published';
  performedBy: { firstName?: string; lastName?: string; email?: string } | string;
  timestamp: string;
  remarks: string;
}

export interface SeatAllocation {
  _id: string;
  programme: { _id: string; programmeName: string; programmeCode: string; department?: string; degree?: string };
  academicSession: string;
  meritList: string | MeritList;
  version: number;
  status: 'Draft' | 'Approved' | 'Published' | 'Archived';
  totalSeats: number;
  allocatedSeats: number;
  remainingSeats: number;
  unfilledSeatRule: 'Keep Vacant' | 'Convert to General';
  categorySummary: CategorySummary[];
  allocations: AllocationItem[];
  approvedBy?: { firstName?: string; lastName?: string; email?: string };
  approvedAt?: string;
  publishedBy?: { firstName?: string; lastName?: string; email?: string };
  publishedAt?: string;
  history: AllocationAuditEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ApplicantMeritResult {
  hasPublishedResult: boolean;
  programme?: {
    _id: string;
    programmeName: string;
    programmeCode: string;
    degree: string;
    department: string;
  };
  academicSession?: string;
  candidateName?: string;
  applicationId?: string;
  category?: string;
  class12Percentage?: number;
  rawEntranceScore?: string;
  compositeScore?: number;
  meritRank?: number;
  categoryRank?: number;
  eligibilityStatus?: string;
  eligibilityRemarks?: string;
  allocationStatus?: string;
  allocatedCategory?: string | null;
  allocationReason?: string;
  seatNumber?: number | null;
  cutoffs?: {
    highestScore: number;
    lowestShortlistedScore: number;
    categoryHighest: number;
    categoryLowest: number;
  };
}

export interface PublishedMeritListCandidate {
  _id?: string;
  meritRank: number;
  categoryRank: number;
  candidateName: string;
  applicationId: string;
  category: string;
  class12Percentage?: number;
  rawEntranceScore?: string;
  compositeScore: number;
  eligibilityStatus: string;
  allocationStatus: string;
  allocatedCategory?: string | null;
  seatNumber?: number | null;
  isSelf?: boolean;
}

export interface ApplicantPublishedMeritListResponse {
  hasPublishedList: boolean;
  message?: string;
  programme?: {
    _id: string;
    programmeName: string;
    programmeCode: string;
    degree: string;
    department: string;
  };
  academicSession?: string;
  version?: number;
  round?: number;
  roundLabel?: string;
  status?: string;
  publishedAt?: string;
  cutoffs?: {
    highestScore: number;
    lowestShortlistedScore: number;
    categoryCutoffs: CategoryCutoff[];
    totalEligible: number;
    totalIneligible: number;
    totalPendingDocs: number;
  };
  myEntry?: PublishedMeritListCandidate | null;
  entries?: PublishedMeritListCandidate[];
}
