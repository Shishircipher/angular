/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */


import {Component, computed, ContentChild, ContentChildren, Directive, ElementRef, ViewChild, ViewChildren} from '@angular/core';
// TODO: update imports to the exported authoring functions when those are public
import {contentChild, contentChildren, viewChild, viewChildren} from '@angular/core/src/authoring/queries';
import {TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';

describe('queries as signals', () => {
  describe('view', () => {
    it('should query for an optional element in a template', () => {
      @Component({
        standalone: true,
        template: `<div #el></div>`,
      })
      class AppComponent {
        // TODO: remove decorator when we've got a transform in place
        @ViewChild('el', {isSignal: true} as any)
        divEl = viewChild<ElementRef<HTMLDivElement>>('el');
        foundEl = computed(() => this.divEl() != null);
      }

      const fixture = TestBed.createComponent(AppComponent);
      // with signal based queries we _do_ have query results after the creation mode execution
      // (before the change detection runs) so we can return those early on! In this sense all
      // queries behave as "static" (?)
      expect(fixture.componentInstance.foundEl()).toBeTrue();

      fixture.detectChanges();
      expect(fixture.componentInstance.foundEl()).toBeTrue();

      // non-required query results are undefined before we run creation mode on the view queries
      const appCmpt = new AppComponent();
      expect(appCmpt.divEl()).toBeUndefined();
    });

    it('should query for a required element in a template', () => {
      @Component({
        standalone: true,
        template: `<div #el></div>`,
      })
      class AppComponent {
        // TODO: remove decorator when we've got a transform in place
        @ViewChild('el', {isSignal: true} as any)
        divEl = viewChild.required<ElementRef<HTMLDivElement>>('el');
        foundEl = computed(() => this.divEl() != null);
      }

      const fixture = TestBed.createComponent(AppComponent);
      // with signal based queries we _do_ have query results after the creation mode execution
      // (before the change detection runs) so we can return those early on! In this sense all
      // queries behave as "static" (?)
      expect(fixture.componentInstance.foundEl()).toBeTrue();

      fixture.detectChanges();
      expect(fixture.componentInstance.foundEl()).toBeTrue();

      // non-required query results are undefined before we run creation mode on the view queries
      const appCmpt = new AppComponent();
      expect(() => {
        appCmpt.divEl();
      }).toThrowError(/NG0951: Child query result is required but no value is available/);
    });

    it('should query for multiple elements in a template', () => {
      @Component({
        standalone: true,
        template: `
          <div #el></div>
          @if (show) {
            <div #el></div>
          }
        `,
      })
      class AppComponent {
        show = false;

        // TODO: remove decorator when we've got a transform in place
        @ViewChildren('el', {isSignal: true} as any)
        divEls = viewChildren<ElementRef<HTMLDivElement>>('el');
        foundEl = computed(() => this.divEls().length);
      }

      const fixture = TestBed.createComponent(AppComponent);
      // with signal based queries we _do_ have query results after the creation mode execution
      // (before the change detection runs) so we can return those early on! In this sense all
      // queries behave as "static" (?)
      expect(fixture.componentInstance.foundEl()).toBe(1);

      fixture.detectChanges();
      expect(fixture.componentInstance.foundEl()).toBe(1);

      fixture.componentInstance.show = true;
      fixture.detectChanges();
      expect(fixture.componentInstance.foundEl()).toBe(2);

      fixture.componentInstance.show = false;
      fixture.detectChanges();
      expect(fixture.componentInstance.foundEl()).toBe(1);

      // non-required query results are undefined before we run creation mode on the view queries
      const appCmpt = new AppComponent();
      expect(appCmpt.divEls().length).toBe(0);
    });

    it('should return the same array instance when there were no changes in results', () => {
      @Component({
        standalone: true,
        template: `
            <div #el></div>
          `,
      })
      class AppComponent {
        // TODO: remove decorator when we've got a transform in place
        @ViewChildren('el', {isSignal: true} as any)
        divEls = viewChildren<ElementRef<HTMLDivElement>>('el');
      }

      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();
      const result1 = fixture.componentInstance.divEls();
      expect(result1.length).toBe(1);

      // subsequent reads should return the same result instance
      const result2 = fixture.componentInstance.divEls();
      expect(result2.length).toBe(1);
      expect(result2).toBe(result1);
    });

    it('should not mark signal as dirty when a child query result does not change', () => {
      let computeCount = 0;

      @Component({
        standalone: true,
        template: `
            <div #el></div>
            @if (show) {
              <div #el></div>
            }
          `,
      })
      class AppComponent {
        // TODO: remove decorator when we've got a transform in place
        @ViewChildren('el', {isSignal: true} as any)
        divEl = viewChild.required<ElementRef<HTMLDivElement>>('el');
        isThere = computed(() => ++computeCount);
        show = false;
      }

      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();
      expect(fixture.componentInstance.isThere()).toBe(1);
      const divEl = fixture.componentInstance.divEl();

      // subsequent reads should return the same result instance and _not_ trigger downstream
      // computed re-evaluation
      fixture.componentInstance.show = true;
      fixture.detectChanges();
      expect(fixture.componentInstance.divEl()).toBe(divEl);
      expect(fixture.componentInstance.isThere()).toBe(1);
    });

    it('should return the same array instance when there were no changes in results after view manipulation',
       () => {
         @Component({
           standalone: true,
           template: `
            <div #el></div>
            @if (show) {
              <div></div>
            }
          `,
         })
         class AppComponent {
           // TODO: remove decorator when we've got a transform in place
           @ViewChildren('el', {isSignal: true} as any)
           divEls = viewChildren<ElementRef<HTMLDivElement>>('el');

           show = false;
         }

         const fixture = TestBed.createComponent(AppComponent);
         fixture.detectChanges();
         const result1 = fixture.componentInstance.divEls();
         expect(result1.length).toBe(1);

         fixture.componentInstance.show = true;
         fixture.detectChanges();
         // subsequent reads should return the same result instance since the query results didn't
         // change
         const result2 = fixture.componentInstance.divEls();
         expect(result2.length).toBe(1);
         expect(result2).toBe(result1);
       });
  });

  describe('content queries', () => {
    it('should run content queries defined on components', () => {
      @Component({
        selector: 'query-cmp',
        standalone: true,
        template: `{{noOfEls()}}`,
      })
      class QueryComponent {
        @ContentChildren('el', {isSignal: true} as any) elements = contentChildren('el');
        @ContentChild('el', {isSignal: true} as any) element = contentChild('el');
        @ContentChild('el', {isSignal: true} as any) elementReq = contentChild.required('el');

        noOfEls = computed(
            () => this.elements().length + (this.element() !== undefined ? 1 : 0) +
                (this.elementReq() !== undefined ? 1 : 0));
      }

      @Component({
        standalone: true,
        imports: [QueryComponent],
        template: `
          <query-cmp>
            <div #el></div>
            @if (show) {
              <div #el></div>
            }
          </query-cmp>
       `,
      })
      class AppComponent {
        show = false;
      }

      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toBe('3');

      fixture.componentInstance.show = true;
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toBe('4');

      fixture.componentInstance.show = false;
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toBe('3');
    });

    it('should run content queries defined on directives', () => {
      @Directive({
        selector: '[query]',
        standalone: true,
        host: {'[textContent]': `noOfEls()`},
      })
      class QueryDir {
        @ContentChildren('el', {isSignal: true} as any) elements = contentChildren('el');
        @ContentChild('el', {isSignal: true} as any) element = contentChild('el');
        @ContentChild('el', {isSignal: true} as any) elementReq = contentChild.required('el');

        noOfEls = computed(
            () => this.elements().length + (this.element() !== undefined ? 1 : 0) +
                (this.elementReq() !== undefined ? 1 : 0));
      }

      @Component({
        standalone: true,
        imports: [QueryDir],
        template: `
          <div query>
            <div #el></div>
            @if (show) {
              <div #el></div>
            }
          </div>
       `,
      })
      class AppComponent {
        show = false;
      }

      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toBe('3');

      fixture.componentInstance.show = true;
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toBe('4');

      fixture.componentInstance.show = false;
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toBe('3');
    });

    it('should not return partial results during the first-time view rendering', () => {
      @Directive({selector: '[marker]', standalone: true})
      class MarkerForResults {
      }

      @Directive({
        selector: '[declare]',
        standalone: true,
      })
      class DeclareQuery {
        // TODO: remove decorator when we've got a transform in place
        @ContentChildren(MarkerForResults, {isSignal: true} as any)
        results = contentChildren(MarkerForResults);
      }


      @Directive({selector: '[inspect]', standalone: true})
      class InspectsQueryResults {
        constructor(declaration: DeclareQuery) {
          // we should _not_ get partial query results while the view is still creating
          expect(declaration.results().length).toBe(0);
        }
      }

      @Component({
        standalone: true,
        imports: [MarkerForResults, InspectsQueryResults, DeclareQuery],
        template: `
          <div declare>
            <div marker></div>
            <div inspect></div>
            <div marker></div>
          </div>
       `,
      })
      class AppComponent {
      }

      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();
      const queryDir =
          fixture.debugElement.query(By.directive(DeclareQuery)).injector.get(DeclareQuery);

      expect(queryDir.results().length).toBe(2);
    });
  });
});
