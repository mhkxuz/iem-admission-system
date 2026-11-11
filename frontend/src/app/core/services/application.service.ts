import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/user.model';
import { AdmissionApplication } from '../models/application.model';

@Injectable({
  providedIn: 'root'
})
export class ApplicationService {
  private http = inject(HttpClient);
  private readonly API_URL = 'https://iem-admission-system-y2pf.onrender.com/api/applications';

  public submitApplication(applicationData: AdmissionApplication): Observable<ApiResponse<AdmissionApplication>> {
    return this.http.post<ApiResponse<AdmissionApplication>>(this.API_URL, applicationData);
  }

  public getMyApplication(): Observable<ApiResponse<AdmissionApplication | null>> {
    return this.http.get<ApiResponse<AdmissionApplication | null>>(`${this.API_URL}/my-application`);
  }

  public getApplicationById(id: string): Observable<ApiResponse<AdmissionApplication>> {
    return this.http.get<ApiResponse<AdmissionApplication>>(`${this.API_URL}/${id}`);
  }
}
