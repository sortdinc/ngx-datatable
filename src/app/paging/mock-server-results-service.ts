import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { PagedData } from './model/paged-data';
import { CorporateEmployee } from './model/corporate-employee';
import { Page } from './model/page';

import companyData from 'src/assets/data/company.json';

/**
 * A server used to mock a paged data result from a server
 */
@Injectable()
export class MockServerResultsService {
  /**
   * A method that mocks a paged server response
   * @param page The selected page
   * @returns An observable containing the employee data
   */
  public getResults(page: Page): Observable<PagedData<CorporateEmployee>> {
    return of(companyData)
      .pipe(map(d => this.getPagedData(page)))
      .pipe(delay(1000 * Math.random()));
  }

  /**
   * Package companyData into a PagedData object based on the selected Page
   * @param page The page data used to get the selected data from companyData
   * @returns An array of the selected data and page
   */
  private getPagedData(page: Page): PagedData<CorporateEmployee> {
    const pagedData = new PagedData<CorporateEmployee>();
    page.totalElements = companyData.length;
    page.totalPages = page.totalElements / page.size;
    const start = page.pageNumber * page.size;
    const end = Math.min(start + page.size, page.totalElements);
    for (let i = start; i < end; i++) {
      const jsonObj = companyData[i];
      const employee = new CorporateEmployee(jsonObj.name, jsonObj.gender, jsonObj.company, jsonObj.age);
      pagedData.data.push(employee);
    }
    pagedData.page = page;
    return pagedData;
  }
}
