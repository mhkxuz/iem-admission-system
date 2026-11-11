export interface ActiveSession {
  sessionName: string;
  sessionCode: string;
  applicationStartDate?: string;
  applicationEndDate?: string;
  isApplicationOpen: boolean;
}

export interface AcademicSession {
  _id?: string;
  sessionName: string;
  sessionCode: string;
  startDate?: string;
  endDate?: string;
  applicationStartDate?: string;
  applicationEndDate?: string;
  isActive?: boolean;
  status: 'Draft' | 'Active' | 'Closed';
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}
