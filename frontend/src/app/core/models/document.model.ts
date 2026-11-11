export interface UploadedDocument {
  _id: string;
  application: any;
  applicant: any;
  documentType:
    | 'Class 10 Marksheet'
    | 'Class 12 Marksheet'
    | 'Entrance Examination Scorecard'
    | 'Photograph'
    | 'Other Supporting Documents'
    | 'Other';
  originalFileName: string;
  storedFileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  verificationStatus?: 'Pending' | 'Verified' | 'Rejected';
  verifiedBy?: {
    _id: string;
    fullName: string;
    email: string;
    role?: string;
  } | string;
  verificationRemarks?: string;
  verifiedAt?: string;
  replacedBy?: string;
}

export interface DocumentVerificationHistory {
  _id: string;
  document: string;
  application?: string;
  previousStatus: 'Pending' | 'Verified' | 'Rejected';
  newStatus: 'Pending' | 'Verified' | 'Rejected';
  verifiedBy: {
    _id: string;
    fullName: string;
    email: string;
    role?: string;
  };
  remarks?: string;
  timestamp: string;
}
