import { Component, OnInit, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private titleService = inject(Title);
  readonly title = 'IEM Admission Portal | Institute of Engineering & Management';

  ngOnInit(): void {
    this.titleService.setTitle('IEM Admission Portal | Institute of Engineering & Management');
  }
}
