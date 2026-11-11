import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MeritService } from './merit.service';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('MeritService Unit Tests', () => {
  let service: MeritService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), MeritService]
    });

    service = TestBed.inject(MeritService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should save merit scoring configuration', () => {
    const mockPayload = {
      programmeId: 'prog-1',
      academicSession: '2026-2027',
      class12Weightage: 60,
      entranceExamWeightage: 40
    };

    service.saveConfiguration(mockPayload as any).subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.data.class12Weightage).toBe(60);
    });

    const req = httpMock.expectOne('http://localhost:5000/api/merit/configuration');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(mockPayload);
    req.flush({ success: true, data: { ...mockPayload, version: 1 } });
  });

  it('should get configuration for programme and session', () => {
    service.getConfiguration('prog-1', '2026-2027').subscribe((res) => {
      expect(res.data.class12Weightage).toBe(60);
    });

    const req = httpMock.expectOne(
      'http://localhost:5000/api/merit/configuration?programmeId=prog-1&academicSession=2026-2027'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: { class12Weightage: 60, entranceExamWeightage: 40 } });
  });

  it('should generate draft merit list', () => {
    service.generateMeritList('prog-1', '2026-2027').subscribe((res) => {
      expect(res.data.status).toBe('Draft');
    });

    const req = httpMock.expectOne('http://localhost:5000/api/merit/generate');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ programmeId: 'prog-1', academicSession: '2026-2027' });
    req.flush({ success: true, data: { _id: 'list-1', status: 'Draft', entries: [] } });
  });

  it('should publish merit list', () => {
    service.publishMeritList('list-1').subscribe((res) => {
      expect(res.data.status).toBe('Published');
    });

    const req = httpMock.expectOne('http://localhost:5000/api/merit/lists/list-1/publish');
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, data: { _id: 'list-1', status: 'Published' } });
  });

  it('should generate and publish seat allocation', () => {
    service
      .generateSeatAllocation({ programmeId: 'prog-1', academicSession: '2026-2027' })
      .subscribe((res) => {
        expect(res.data.status).toBe('Draft');
      });

    const req1 = httpMock.expectOne('http://localhost:5000/api/merit/allocation/generate');
    expect(req1.request.method).toBe('POST');
    req1.flush({ success: true, data: { _id: 'alloc-1', status: 'Draft' } });

    service.publishSeatAllocation('alloc-1', 'Approved batch').subscribe((res) => {
      expect(res.data.status).toBe('Published');
    });

    const req2 = httpMock.expectOne('http://localhost:5000/api/merit/allocation/alloc-1/publish');
    expect(req2.request.method).toBe('POST');
    expect(req2.request.body).toEqual({ remarks: 'Approved batch' });
    req2.flush({ success: true, data: { _id: 'alloc-1', status: 'Published' } });
  });

  it('should retrieve applicant published result', () => {
    service.getMyResult().subscribe((res) => {
      expect(res.data.hasPublishedResult).toBe(true);
      expect(res.data.meritRank).toBe(1);
    });

    const req = httpMock.expectOne('http://localhost:5000/api/merit/my-result');
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: {
        hasPublishedResult: true,
        candidateName: 'Rohan Sharma',
        meritRank: 1,
        compositeScore: 94.2
      }
    });
  });
});
