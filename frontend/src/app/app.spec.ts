import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient()]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the institution branding', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.inst-name')?.textContent).toContain(
      'Institute of Engineering & Management'
    );
  });

  it('should set the official browser tab title', () => {
    const titleService = TestBed.inject(Title);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(titleService.getTitle()).toBe(
      'IEM Admission Portal | Institute of Engineering & Management'
    );
  });
});
