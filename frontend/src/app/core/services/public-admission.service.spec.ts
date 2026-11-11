import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PublicAdmissionService } from './public-admission.service';

describe('PublicAdmissionService', () => {
  let service: PublicAdmissionService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        PublicAdmissionService
      ]
    });

    service = TestBed.inject(PublicAdmissionService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should fetch the active admission session', () => {
    const mockSession = {
      sessionName: '2026-2027',
      sessionCode: 'AY2026-27',
      isApplicationOpen: true
    };

    service.getActiveSession().subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.data?.sessionName).toBe('2026-2027');
    });

    const req = httpTesting.expectOne('http://localhost:5000/api/sessions/active');
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: mockSession });
  });

  it('should fetch academic programmes with query filters', () => {
    const mockProgrammes = [
      { _id: 'p1', programmeName: 'B.Tech CSE', programmeCode: 'BTECH-CSE' }
    ];

    service
      .getProgrammes({ department: 'Computer Science & Engineering', degreeLevel: 'Undergraduate' })
      .subscribe((res) => {
        expect(res.data).toHaveLength(1);
        expect(res.data[0].programmeCode).toBe('BTECH-CSE');
      });

    const req = httpTesting.expectOne((r) =>
      r.url === 'http://localhost:5000/api/programmes' &&
      r.params.get('department') === 'Computer Science & Engineering' &&
      r.params.get('degreeLevel') === 'Undergraduate'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: mockProgrammes });
  });

  it('should fetch programme by ID and by code', () => {
    service.getProgrammeById('673000111222333444555666').subscribe((res) => {
      expect(res.data.programmeName).toBe('B.Tech IT');
    });

    const reqId = httpTesting.expectOne('http://localhost:5000/api/programmes/673000111222333444555666');
    expect(reqId.request.method).toBe('GET');
    reqId.flush({ success: true, data: { programmeName: 'B.Tech IT' } });

    service.getProgrammeByCode('BTECH-ECE').subscribe((res) => {
      expect(res.data.programmeName).toBe('B.Tech ECE');
    });

    const reqCode = httpTesting.expectOne('http://localhost:5000/api/programmes/code/BTECH-ECE');
    expect(reqCode.request.method).toBe('GET');
    reqCode.flush({ success: true, data: { programmeName: 'B.Tech ECE' } });
  });

  it('should fetch programme fee structure', () => {
    service.getProgrammeFee('p1', 'session-1').subscribe((res) => {
      expect(res.data.totalProgrammeFee).toBe(300000);
    });

    const req = httpTesting.expectOne(
      (r) => r.url === 'http://localhost:5000/api/fees/programme/p1' && r.params.get('session') === 'session-1'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: { totalProgrammeFee: 300000 } });
  });

  it('should return empty announcements list gracefully', () => {
    service.getAnnouncements().subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.data).toEqual([]);
    });
  });
});
