import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DocumentService } from './document.service';

describe('DocumentService', () => {
  let service: DocumentService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(DocumentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should send document metadata and the file as multipart form data', () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'marksheet.pdf', {
      type: 'application/pdf'
    });

    service.uploadDocument('application-1', 'Class 12 Marksheet', file).subscribe();

    const req = httpMock.expectOne('http://localhost:5000/api/documents/upload');
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);

    const body = req.request.body as FormData;
    expect(body.get('applicationId')).toBe('application-1');
    expect(body.get('documentType')).toBe('Class 12 Marksheet');
    expect((body.get('document') as File).name).toBe('marksheet.pdf');

    req.flush({
      success: true,
      message: 'Document uploaded.',
      data: { _id: 'doc-1' }
    });
  });

  it('should request documents by application and fetch document blobs', () => {
    service.getDocumentsByApplication('application-1').subscribe();
    const listReq = httpMock.expectOne(
      'http://localhost:5000/api/documents/application/application-1'
    );
    expect(listReq.request.method).toBe('GET');
    listReq.flush({ success: true, message: 'Documents retrieved.', data: [] });

    service.viewDocument('doc-1').subscribe();
    const viewReq = httpMock.expectOne('http://localhost:5000/api/documents/doc-1/view');
    expect(viewReq.request.responseType).toBe('blob');
    viewReq.flush(new Blob(['pdf']));

    service.downloadDocument('doc-1').subscribe();
    const downloadReq = httpMock.expectOne(
      'http://localhost:5000/api/documents/doc-1/download'
    );
    expect(downloadReq.request.responseType).toBe('blob');
    downloadReq.flush(new Blob(['pdf']));
  });
});
