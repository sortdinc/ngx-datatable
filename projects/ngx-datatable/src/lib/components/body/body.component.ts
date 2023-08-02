import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostBinding,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import { ScrollerComponent } from './scroller.component';
import { SelectionType } from '../../types/selection.type';
import { columnGroupWidths, columnsByPin } from '../../utils/column';
import { RowHeightCache } from '../../utils/row-height-cache';
import { translateXY } from '../../utils/translate';
import { DragEventData } from '../../types/drag-events.type';

@Component({
  selector: 'datatable-body',
  template: `
    <ng-container *ngIf="loadingIndicator">
      <div class="custom-loading-indicator-wrapper">
        <div class="custom-loading-content" #customIndicator>
          <ng-content select="[loading-indicator]"></ng-content>
        </div>
      </div>
      <datatable-progress *ngIf="!customIndicator?.hasChildNodes()"></datatable-progress>
    </ng-container>
    <ghost-loader
      *ngIf="ghostLoadingIndicator && (!rowCount || !virtualization || !scrollbarV)"
      class="ghost-overlay"
      [columns]="columns"
      [pageSize]="pageSize"
      [rowHeight]="rowHeight"
      [ghostBodyHeight]="bodyHeight"
    >
    </ghost-loader>
    <datatable-selection
      #selector
      [selected]="selected"
      [rows]="rows"
      [selectCheck]="selectCheck"
      [disableCheck]="disableRowCheck"
      [selectEnabled]="selectEnabled"
      [selectionType]="selectionType"
      [rowIdentity]="rowIdentity"
      (select)="select.emit($event)"
      (activate)="activate.emit($event)"
    >
      <datatable-scroller
        *ngIf="rows?.length"
        [scrollbarV]="scrollbarV"
        [scrollbarH]="scrollbarH"
        [scrollHeight]="scrollHeight"
        [scrollWidth]="columnGroupWidths?.total"
        (scroll)="onBodyScroll($event)"
      >
        <datatable-summary-row
          *ngIf="summaryRow && summaryPosition === 'top'"
          [rowHeight]="summaryHeight"
          [offsetX]="offsetX"
          [innerWidth]="innerWidth"
          [rows]="rows"
          [columns]="columns"
        >
        </datatable-summary-row>
        <datatable-row-wrapper
          #rowWrapper
          [groupedRows]="groupedRows"
          *ngFor="let group of temp; let i = index; trackBy: rowTrackingFn"
          [innerWidth]="innerWidth"
          [ngStyle]="getRowsStyles(group, indexes.first + i )"
          [rowDetail]="rowDetail"
          [groupHeader]="groupHeader"
          [offsetX]="offsetX"
          [detailRowHeight]="getDetailRowHeight(group && group[i], i)"
          [row]="group"
          [disableCheck]="disableRowCheck"
          [expanded]="getRowExpanded(group)"
          [rowIndex]="getRowIndex(group && group[i])"
          (rowContextmenu)="rowContextmenu.emit($event)"
        >
          <datatable-body-row
            role="row"
            *ngIf="!groupedRows; else groupedRowsTemplate"
            tabindex="-1"
            #rowElement
            [disable$]="rowWrapper.disable$"
            [isSelected]="selector.getRowSelected(group)"
            [innerWidth]="innerWidth"
            [offsetX]="offsetX"
            [columns]="columns"
            [rowHeight]="getRowHeight(group)"
            [row]="group"
            [rowIndex]="getRowIndex(group)"
            [expanded]="getRowExpanded(group)"
            [rowClass]="rowClass"
            [displayCheck]="displayCheck"
            [treeStatus]="group && group.treeStatus"
            [ghostLoadingIndicator]="ghostLoadingIndicator"
            [draggable]="rowDraggable"
            (treeAction)="onTreeAction(group)"
            (activate)="selector.onActivate($event, indexes.first + i)"
            (drop)="drop($event, group, rowElement)"
            (dragover)="dragOver($event, group)"
            (dragenter)="dragEnter($event, group, rowElement)"
            (dragleave)="dragLeave($event, group, rowElement)"
            (dragstart)="drag($event, group, rowElement)"
            (dragend)="dragEnd($event, group)"
          >
          </datatable-body-row>
          <ng-template #groupedRowsTemplate>
            <datatable-body-row
              role="row"
              [disable$]="rowWrapper.disable$"
              *ngFor="let row of group.value; let i = index; trackBy: rowTrackingFn"
              tabindex="-1"
              #rowElement
              [isSelected]="selector.getRowSelected(row)"
              [innerWidth]="innerWidth"
              [offsetX]="offsetX"
              [columns]="columns"
              [rowHeight]="getRowHeight(row)"
              [row]="row"
              [group]="group.value"
              [rowIndex]="getRowIndex(row)"
              [expanded]="getRowExpanded(row)"
              [rowClass]="rowClass"
              [ghostLoadingIndicator]="ghostLoadingIndicator"
              [draggable]="rowDraggable"
              (activate)="selector.onActivate($event, i)"
              (drop)="drop($event, row, rowElement)"
              (dragover)="dragOver($event, row)"
              (dragenter)="dragEnter($event, row, rowElement)"
              (dragleave)="dragLeave($event, row, rowElement)"
              (dragstart)="drag($event, row, rowElement)"
              (dragend)="dragEnd($event, row)"
            >
            </datatable-body-row>
          </ng-template>
        </datatable-row-wrapper>
        <datatable-summary-row
          role="row"
          *ngIf="summaryRow && summaryPosition === 'bottom'"
          [ngStyle]="getBottomSummaryRowStyles()"
          [rowHeight]="summaryHeight"
          [offsetX]="offsetX"
          [innerWidth]="innerWidth"
          [rows]="rows"
          [columns]="columns"
        >
        </datatable-summary-row>
      </datatable-scroller>
      <ng-container *ngIf="!rows?.length && !loadingIndicator && !ghostLoadingIndicator">
      <div
        class="empty-row"
        *ngIf="!customEmptyContent?.children.length"
        [innerHTML]="emptyMessage"
      ></div>
      <div #customEmptyContent>
        <ng-content select="[empty-content]"></ng-content>
      </div>
      </ng-container>
    </datatable-selection>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'datatable-body'
  }
})
export class DataTableBodyComponent implements OnInit, OnDestroy {
  @Input() scrollbarV: boolean;
  @Input() scrollbarH: boolean;
  @Input() loadingIndicator: boolean;
  private _ghostLoadingIndicator: boolean;
  @Input() set ghostLoadingIndicator(val: boolean) {
    this._ghostLoadingIndicator = val;
    if (!val) {
      // remove placeholder rows once ghostloading is set to false
      this.temp = this.temp.filter(item => !!item);
    }
  };
  get ghostLoadingIndicator() {
    return this._ghostLoadingIndicator;
  }
  @Input() externalPaging: boolean;
  @Input() rowHeight: number | 'auto' | ((row?: any) => number);
  @Input() offsetX: number;
  @Input() emptyMessage: string;
  @Input() selectionType: SelectionType;
  @Input() selected: any[] = [];
  @Input() rowIdentity: any;
  @Input() rowDetail: any;
  @Input() groupHeader: any;
  @Input() selectCheck: any;
  @Input() displayCheck: any;
  @Input() trackByProp: string;
  @Input() rowClass: any;
  @Input() groupedRows: any;
  @Input() groupExpansionDefault: boolean;
  @Input() innerWidth: number;
  @Input() groupRowsBy: string;
  @Input() virtualization: boolean;
  @Input() summaryRow: boolean;
  @Input() summaryPosition: string;
  @Input() summaryHeight: number;
  @Input() rowDraggable: boolean;
  @Input() rowDragEvents: EventEmitter<DragEventData>;
  @Input() disableRowCheck: (row: any) => boolean;

  @Input() set pageSize(val: number) {
    if (val !== this._pageSize) {
      this._pageSize = val;
      this.recalcLayout();

      // Emits the page event if page size has been changed
      this._offsetEvent = -1;
      this.updatePage('up');
      this.updatePage('down');
    }
  }

  get pageSize(): number {
    return this._pageSize;
  }

  @Input() set rows(val: any[]) {
    if (val !== this._rows) {
      this._rows = val;
      this.recalcLayout();
    }
  }

  get rows(): any[] {
    return this._rows;
  }

  @Input() set columns(val: any[]) {
    if (val !== this._columns) {
      this._columns = val;
      const colsByPin = columnsByPin(val);
      this.columnGroupWidths = columnGroupWidths(colsByPin, val);
    }
  }

  get columns(): any[] {
    return this._columns;
  }

  @Input() set offset(val: number) {
    if (val !== this._offset) {
      this._offset = val;
      if (!this.scrollbarV || (this.scrollbarV && !this.virtualization)) {
        if (!isNaN(this._offset) && this.ghostLoadingIndicator) {
          this.rows = [];
        }
        this.recalcLayout();
      }
    }
  }

  get offset(): number {
    return this._offset;
  }

  @Input() set rowCount(val: number) {
    if (val !== this._rowCount) {
      this._rowCount = val;
      this.recalcLayout();
    }
  }

  get rowCount(): number {
    return this._rowCount;
  }

  @HostBinding('style.width')
  get bodyWidth(): string {
    if (this.scrollbarH) {
      return this.innerWidth + 'px';
    } else {
      return '100%';
    }
  }

  @Input()
  @HostBinding('style.height')
  set bodyHeight(val) {
    if (this.scrollbarV) {
      this._bodyHeight = val + 'px';
    } else {
      this._bodyHeight = 'auto';
    }

    this.recalcLayout();
  }

  get bodyHeight() {
    return this._bodyHeight;
  }

  @Output() scroll: EventEmitter<any> = new EventEmitter();
  @Output() page: EventEmitter<any> = new EventEmitter();
  @Output() activate: EventEmitter<any> = new EventEmitter();
  @Output() select: EventEmitter<any> = new EventEmitter();
  @Output() detailToggle: EventEmitter<any> = new EventEmitter();
  @Output() rowContextmenu = new EventEmitter<{ event: MouseEvent; row: any }>(false);
  @Output() treeAction: EventEmitter<any> = new EventEmitter();

  @ViewChild(ScrollerComponent) scroller: ScrollerComponent;

  /**
   * Returns if selection is enabled.
   */
  get selectEnabled(): boolean {
    return !!this.selectionType;
  }

  /**
   * Property that would calculate the height of scroll bar
   * based on the row heights cache for virtual scroll and virtualization. Other scenarios
   * calculate scroll height automatically (as height will be undefined).
   */
  get scrollHeight(): number | undefined {
    if (this.scrollbarV && this.virtualization && this.rowCount) {
      return this.rowHeightsCache.query(this.rowCount - 1);
    }
    // avoid TS7030: Not all code paths return a value.
    return undefined;
  }

  rowHeightsCache: RowHeightCache = new RowHeightCache();
  temp: any[] = [];
  offsetY = 0;
  indexes: any = {};
  columnGroupWidths: any;
  columnGroupWidthsWithoutGroup: any;
  rowTrackingFn: any;
  listener: any;
  rowIndexes: any = new WeakMap<any, string>();
  rowExpansions: any[] = [];

  _rows: any[];
  _bodyHeight: any;
  _columns: any[];
  _rowCount: number;
  _offset: number;
  _pageSize: number;
  _offsetEvent = -1;

  private _draggedRow: any;
  private _draggedRowElement: HTMLElement;

  /**
   * Creates an instance of DataTableBodyComponent.
   */
  constructor(public cd: ChangeDetectorRef) {
    // declare fn here so we can get access to the `this` property
    this.rowTrackingFn = (index: number, row: any): any => {
      const idx = this.getRowIndex(row);
      if (this.trackByProp) {
        return row[this.trackByProp];
      } else {
        return idx;
      }
    };
  }

  /**
   * Called after the constructor, initializing input properties
   */
  ngOnInit(): void {
    if (this.rowDetail) {
      this.listener = this.rowDetail.toggle.subscribe(({ type, value }: { type: string; value: any }) => {
        if (type === 'row') {
          this.toggleRowExpansion(value);
        }
        if (type === 'all') {
          this.toggleAllRows(value);
        }

        // Refresh rows after toggle
        // Fixes #883
        this.updateIndexes();
        this.updateRows();
        this.cd.markForCheck();
      });
    }

    if (this.groupHeader) {
      this.listener = this.groupHeader.toggle.subscribe(({ type, value }: { type: string; value: any }) => {
        if (type === 'group') {
          this.toggleRowExpansion(value);
        }
        if (type === 'all') {
          this.toggleAllRows(value);
        }

        // Refresh rows after toggle
        // Fixes #883
        this.updateIndexes();
        this.updateRows();
        this.cd.markForCheck();
      });
    }
  }

  /**
   * Called once, before the instance is destroyed.
   */
  ngOnDestroy(): void {
    if (this.rowDetail || this.groupHeader) {
      this.listener.unsubscribe();
    }
  }

  /**
   * Updates the Y offset given a new offset.
   */
  updateOffsetY(offset?: number): void {
    // scroller is missing on empty table
    if (!this.scroller) {
      return;
    }

    if (this.scrollbarV && this.virtualization && offset) {
      // First get the row Index that we need to move to.
      const rowIndex = this.pageSize * offset;
      offset = this.rowHeightsCache.query(rowIndex - 1);
    } else if (this.scrollbarV && !this.virtualization) {
      offset = 0;
    }

    this.scroller.setOffset(offset || 0);
  }

  /**
   * Body was scrolled, this is mainly useful for
   * when a user is server-side pagination via virtual scroll.
   */
  onBodyScroll(event: any): void {
    const scrollYPos: number = event.scrollYPos;
    const scrollXPos: number = event.scrollXPos;

    // if scroll change, trigger update
    // this is mainly used for header cell positions
    if (this.offsetY !== scrollYPos || this.offsetX !== scrollXPos) {
      this.scroll.emit({
        offsetY: scrollYPos,
        offsetX: scrollXPos
      });
    }

    this.offsetY = scrollYPos;
    this.offsetX = scrollXPos;

    this.updateIndexes();
    this.updatePage(event.direction);
    this.updateRows();
    this.cd.detectChanges();
  }

  /**
   * Updates the page given a direction.
   */
  updatePage(direction: string): void {
    let offset = this.indexes.first / this.pageSize;
    const scrollInBetween = !Number.isInteger(offset);
    if (direction === 'up') {
      offset = Math.ceil(offset);
    } else if (direction === 'down') {
      offset = Math.floor(offset);
    }

    if (direction !== undefined && !isNaN(offset) && offset !== this._offsetEvent) {
      this._offsetEvent = offset;
      // if scroll was done by mouse drag make sure previous row and next row data is also fetched if its not fetched
      if (scrollInBetween && this.scrollbarV && this.virtualization && this.externalPaging) {
        const upRow = this.rows[this.indexes.first - 1];
        if (!upRow && direction === 'up') {
          this.page.emit({ offset: offset - 1 });
        }

        const downRow = this.rows[this.indexes.first + this.pageSize];
        if (!downRow && direction === 'down') {
          this.page.emit({ offset: offset + 1 });
        }
      }
      this.page.emit({ offset });
    }
  }

  /**
   * Updates the rows in the view port
   */
  updateRows(): void {
    const { first, last } = this.indexes;
    let rowIndex = first;
    let idx = 0;
    const temp: any[] = [];

    // if grouprowsby has been specified treat row paging
    // parameters as group paging parameters ie if limit 10 has been
    // specified treat it as 10 groups rather than 10 rows
    if (this.groupedRows) {
      let maxRowsPerGroup = 3;
      // if there is only one group set the maximum number of
      // rows per group the same as the total number of rows
      if (this.groupedRows.length === 1) {
        maxRowsPerGroup = this.groupedRows[0].value.length;
      }

      while (rowIndex < last && rowIndex < this.groupedRows.length) {
        // Add the groups into this page
        const group = this.groupedRows[rowIndex];
        this.rowIndexes.set(group, rowIndex);

        if (group.value) {
          // add indexes for each group item
          group.value.forEach((g: any, i: number) => {
            const _idx = `${rowIndex}-${i}`;
            this.rowIndexes.set(g, _idx);
          });
        }
        temp[idx] = group;
        idx++;

        // Group index in this context
        rowIndex++;
      }
    } else {
      while (rowIndex < last && rowIndex < this.rowCount) {
        const row = this.rows[rowIndex];

        if (row) {
          // add indexes for each row
          this.rowIndexes.set(row, rowIndex);
          temp[idx] = row;
        } else if (this.ghostLoadingIndicator && this.virtualization) {
          temp[idx] = undefined;
        }

        idx++;
        rowIndex++;
      }
    }

    this.temp = temp;
  }

  /**
   * Get the row height
   */
  getRowHeight(row: any): number {
    // if its a function return it
    if (typeof this.rowHeight === 'function') {
      return this.rowHeight(row);
    }

    return this.rowHeight as number;
  }

  /**
   * @param group the group with all rows
   */
  getGroupHeight(group: any): number {
    let rowHeight = 0;

    if (group.value) {
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let index = 0; index < group.value.length; index++) {
        rowHeight += this.getRowAndDetailHeight(group.value[index]);
      }
    }

    return rowHeight;
  }

  /**
   * Calculate row height based on the expanded state of the row.
   */
  getRowAndDetailHeight(row: any): number {
    let rowHeight = this.getRowHeight(row);
    const expanded = this.getRowExpanded(row);

    // Adding detail row height if its expanded.
    if (expanded) {
      rowHeight += this.getDetailRowHeight(row);
    }

    return rowHeight;
  }

  /**
   * Get the height of the detail row.
   */
  getDetailRowHeight = (row?: any, index?: any): number => {
    if (!this.rowDetail) {
      return 0;
    }
    const rowHeight = this.rowDetail.rowHeight;
    return typeof rowHeight === 'function' ? rowHeight(row, index) : (rowHeight as number);
  };

  /**
   * Calculates the styles for the row so that the rows can be moved in 2D space
   * during virtual scroll inside the DOM.   In the below case the Y position is
   * manipulated.   As an example, if the height of row 0 is 30 px and row 1 is
   * 100 px then following styles are generated:
   *
   * transform: translate3d(0px, 0px, 0px);    ->  row0
   * transform: translate3d(0px, 30px, 0px);   ->  row1
   * transform: translate3d(0px, 130px, 0px);  ->  row2
   *
   * Row heights have to be calculated based on the row heights cache as we wont
   * be able to determine which row is of what height before hand.  In the above
   * case the positionY of the translate3d for row2 would be the sum of all the
   * heights of the rows before it (i.e. row0 and row1).
   *
   * @param rows the row that needs to be placed in the 2D space.
   * @param index for ghost cells in order to get correct position of ghost row
   * @returns the CSS3 style to be applied
   *
   * @memberOf DataTableBodyComponent
   */
  getRowsStyles(rows: any, index = 0): any {
    const styles: any = {};

    // only add styles for the group if there is a group
    if (this.groupedRows) {
      styles.width = this.columnGroupWidths.total;
    }

    if (this.scrollbarV && this.virtualization) {
      let idx = 0;

      if (this.groupedRows) {
        // Get the latest row rowindex in a group
        const row = rows[rows.length - 1];
        idx = row ? this.getRowIndex(row) : 0;
      } else {
        if (rows) {
          idx = this.getRowIndex(rows);
        } else {
          // When ghost cells are enabled use index to get the position of them
          idx = index;
        }
      }

      // const pos = idx * rowHeight;
      // The position of this row would be the sum of all row heights
      // until the previous row position.
      const pos = this.rowHeightsCache.query(idx - 1);

      styles.zIndex = this.rowCount - idx;

      translateXY(styles, 0, pos);
    }

    return styles;
  }

  /**
   * Calculate bottom summary row offset for scrollbar mode.
   * For more information about cache and offset calculation
   * see description for `getRowsStyles` method
   *
   * @returns the CSS3 style to be applied
   *
   * @memberOf DataTableBodyComponent
   */
  getBottomSummaryRowStyles(): any {
    if (!this.scrollbarV || !this.rows || !this.rows.length) {
      return null;
    }

    const styles = { position: 'absolute' };
    const pos = this.rowHeightsCache.query(this.rows.length - 1);

    translateXY(styles, 0, pos);

    return styles;
  }

  /**
   * Hides the loading indicator
   */
  hideIndicator(): void {
    setTimeout(() => (this.loadingIndicator = false), 500);
  }

  /**
   * Updates the index of the rows in the viewport
   */
  updateIndexes(): void {
    let first = 0;
    let last = 0;

    if (this.scrollbarV) {
      if (this.virtualization) {
        // Calculation of the first and last indexes will be based on where the
        // scrollY position would be at.  The last index would be the one
        // that shows up inside the view port the last.
        const height = parseInt(this.bodyHeight, 10);
        first = this.rowHeightsCache.getRowIndex(this.offsetY);
        last = this.rowHeightsCache.getRowIndex(height + this.offsetY) + 1;
      } else {
        // If virtual rows are not needed
        // We render all in one go
        first = 0;
        last = this.rowCount;
      }
    } else {
      // The server is handling paging and will pass an array that begins with the
      // element at a specified offset.  first should always be 0 with external paging.
      if (!this.externalPaging) {
        first = Math.max(this.offset * this.pageSize, 0);
      }
      last = Math.min(first + this.pageSize, this.rowCount);
    }

    this.indexes = { first, last };
  }

  /**
   * Refreshes the full Row Height cache.  Should be used
   * when the entire row array state has changed.
   */
  refreshRowHeightCache(): void {
    if (!this.scrollbarV || (this.scrollbarV && !this.virtualization)) {
      return;
    }

    // clear the previous row height cache if already present.
    // this is useful during sorts, filters where the state of the
    // rows array is changed.
    this.rowHeightsCache.clearCache();

    // Initialize the tree only if there are rows inside the tree.
    if (this.rows && this.rows.length) {
      const rowExpansions = new Set();
      for (const row of this.rows) {
        if (this.getRowExpanded(row)) {
          rowExpansions.add(row);
        }
      }

      this.rowHeightsCache.initCache({
        rows: this.rows,
        rowHeight: this.rowHeight,
        detailRowHeight: this.getDetailRowHeight,
        externalVirtual: this.scrollbarV && this.externalPaging,
        rowCount: this.rowCount,
        rowIndexes: this.rowIndexes,
        rowExpansions
      });
    }
  }

  /**
   * Gets the index for the view port
   */
  getAdjustedViewPortIndex(): number {
    // Capture the row index of the first row that is visible on the viewport.
    // If the scroll bar is just below the row which is highlighted then make that as the
    // first index.
    const viewPortFirstRowIndex = this.indexes.first;

    if (this.scrollbarV && this.virtualization) {
      const offsetScroll = this.rowHeightsCache.query(viewPortFirstRowIndex - 1);
      return offsetScroll <= this.offsetY ? viewPortFirstRowIndex - 1 : viewPortFirstRowIndex;
    }

    return viewPortFirstRowIndex;
  }

  /**
   * Toggle the Expansion of the row i.e. if the row is expanded then it will
   * collapse and vice versa.   Note that the expanded status is stored as
   * a part of the row object itself as we have to preserve the expanded row
   * status in case of sorting and filtering of the row set.
   */
  toggleRowExpansion(row: any): void {
    // Capture the row index of the first row that is visible on the viewport.
    const viewPortFirstRowIndex = this.getAdjustedViewPortIndex();
    const rowExpandedIdx = this.getRowExpandedIdx(row, this.rowExpansions);
    const expanded = rowExpandedIdx > -1;

    // If the detailRowHeight is auto --> only in case of non-virtualized scroll
    if (this.scrollbarV && this.virtualization) {
      const detailRowHeight = this.getDetailRowHeight(row) * (expanded ? -1 : 1);
      // const idx = this.rowIndexes.get(row) || 0;
      const idx = this.getRowIndex(row);
      this.rowHeightsCache.update(idx, detailRowHeight);
    }

    // Update the toggled row and update thive nevere heights in the cache.
    if (expanded) {
      this.rowExpansions.splice(rowExpandedIdx, 1);
    } else {
      this.rowExpansions.push(row);
    }

    this.detailToggle.emit({
      rows: [row],
      currentIndex: viewPortFirstRowIndex
    });
  }

  /**
   * Expand/Collapse all the rows no matter what their state is.
   */
  toggleAllRows(expanded: boolean): void {
    // clear prev expansions
    this.rowExpansions = [];

    // Capture the row index of the first row that is visible on the viewport.
    const viewPortFirstRowIndex = this.getAdjustedViewPortIndex();

    if (expanded) {
      for (const row of this.rows) {
        this.rowExpansions.push(row);
      }
    }

    if (this.scrollbarV) {
      // Refresh the full row heights cache since every row was affected.
      this.recalcLayout();
    }

    // Emit all rows that have been expanded.
    this.detailToggle.emit({
      rows: this.rows,
      currentIndex: viewPortFirstRowIndex
    });
  }

  /**
   * Recalculates the table
   */
  recalcLayout(): void {
    this.refreshRowHeightCache();
    this.updateIndexes();
    this.updateRows();
  }

  /**
   * Tracks the column
   */
  columnTrackingFn(index: number, column: any): any {
    return column.$$id;
  }

  /**
   * Gets the row pinning group styles
   */
  stylesByGroup(group: string) {
    const widths = this.columnGroupWidths;
    const offsetX = this.offsetX;

    const styles = {
      width: `${widths[group]}px`
    };

    if (group === 'left') {
      translateXY(styles, offsetX, 0);
    } else if (group === 'right') {
      const bodyWidth = this.innerWidth;
      const totalDiff = widths.total - bodyWidth;
      const offsetDiff = totalDiff - offsetX;
      const offset = offsetDiff * -1;
      translateXY(styles, offset, 0);
    }

    return styles;
  }

  /**
   * Returns if the row was expanded and set default row expansion when row expansion is empty
   */
  getRowExpanded(row: any): boolean {
    if (this.rowExpansions.length === 0 && this.groupExpansionDefault) {
      for (const group of this.groupedRows) {
        this.rowExpansions.push(group);
      }
    }

    return this.getRowExpandedIdx(row, this.rowExpansions) > -1;
  }

  getRowExpandedIdx(row: any, expanded: any[]): number {
    if (!expanded || !expanded.length) {return -1;}

    const rowId = this.rowIdentity(row);
    return expanded.findIndex(r => {
      const id = this.rowIdentity(r);
      return id === rowId;
    });
  }

  /**
   * Gets the row index given a row
   */
  getRowIndex(row: any): number {
    return this.rowIndexes.get(row) || 0;
  }

  onTreeAction(row: any) {
    this.treeAction.emit({ row });
  }

  dragOver(event: DragEvent, dropRow) {
    event.preventDefault();
    this.rowDragEvents.emit({
      event,
      srcElement: this._draggedRowElement,
      eventType: 'dragover',
      dragRow: this._draggedRow,
      dropRow
    });
  }

  drag(event: DragEvent, dragRow, rowComponent) {
    this._draggedRow = dragRow;
    this._draggedRowElement = rowComponent._element;
    this.rowDragEvents.emit({
      event,
      srcElement: this._draggedRowElement,
      eventType: 'dragstart',
      dragRow
    });
  }

  drop(event: DragEvent, dropRow, rowComponent) {
    event.preventDefault();
    this.rowDragEvents.emit({
      event,
      srcElement: this._draggedRowElement,
      targetElement: rowComponent._element,
      eventType: 'drop',
      dragRow: this._draggedRow,
      dropRow
    });
  }

  dragEnter(event: DragEvent, dropRow, rowComponent) {
    event.preventDefault();
    this.rowDragEvents.emit({
      event,
      srcElement: this._draggedRowElement,
      targetElement: rowComponent._element,
      eventType: 'dragenter',
      dragRow: this._draggedRow,
      dropRow
    });
  }

  dragLeave(event: DragEvent, dropRow, rowComponent) {
    event.preventDefault();
    this.rowDragEvents.emit({
      event,
      srcElement: this._draggedRowElement,
      targetElement: rowComponent._element,
      eventType: 'dragleave',
      dragRow: this._draggedRow,
      dropRow
    });
  }

  dragEnd(event: DragEvent, dragRow) {
    event.preventDefault();
    this.rowDragEvents.emit({
      event,
      srcElement: this._draggedRowElement,
      eventType: 'dragend',
      dragRow
    });
    this._draggedRow = undefined;
    this._draggedRowElement = undefined;
  }
}
