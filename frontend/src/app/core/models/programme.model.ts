export interface CategoryAllocation {
  category: string;
  seats: number;
}

export interface SeatCapacity {
  total: number;
  categoryAllocations?: CategoryAllocation[];
}

export interface EligibilityCriteria {
  minClass12Percentage?: number;
  requiredClass12Subjects?: string[];
  acceptedAcademicStreams?: string[];
  acceptedEntranceExams?: string[];
  minEntranceScore?: string;
  remarks?: string;
  programmeSpecificCriteria?: string;
}

export interface ProgrammeSessionRef {
  _id: string;
  sessionName: string;
  sessionCode: string;
  isActive?: boolean;
  status?: string;
}

export interface Programme {
  _id: string;
  programmeName: string;
  programmeCode: string;
  degreeLevel: 'Undergraduate' | 'Postgraduate' | 'Diploma' | 'Doctoral';
  department: string;
  degree: string;
  description?: string;
  duration: number;
  durationUnit: string;
  academicSession?: ProgrammeSessionRef;
  offeredSessions?: ProgrammeSessionRef[];
  eligibility?: EligibilityCriteria;
  seatCapacity?: SeatCapacity;
  requiredDocuments?: string[];
  isApplicationOpen?: boolean;
  isActive?: boolean;
  displayOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}
