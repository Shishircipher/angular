/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {ComputedNode, createComputed, SIGNAL} from '@angular/core/primitives/signals';

import {RuntimeError, RuntimeErrorCode} from '../errors';
import {unwrapElementRef} from '../linker/element_ref';
import {QueryList} from '../linker/query_list';
import {EMPTY_ARRAY} from '../util/empty';

import {FLAGS, LView, LViewFlags, TVIEW} from './interfaces/view';
import {collectQueryResults, getTQuery, loadQueryInternal, materializeViewResults} from './query';
import {Signal} from './reactivity/api';
import {signal, WritableSignal} from './reactivity/signal';
import {getLView} from './state';

interface QuerySignalNode<T> extends ComputedNode<T|ReadonlyArray<T>> {
  _lView?: LView;
  _queryIndex?: number;
  _queryList?: QueryList<T>;
  _dirtyCounter: WritableSignal<number>;
}

/**
 * Query-as signal factory function in charge of creating a new computed signal capturing query
 * results. This centralized creation function is used by all types of queries (child / children,
 * required / optional).
 *
 * @param firstOnly indicates if all or only the first result should be returned
 * @param required indicates if at least one result is required
 * @returns a read-only signal with query results
 */
function createQuerySignalFn<V>(firstOnly: boolean, required: boolean) {
  let node: QuerySignalNode<V>;
  const signalFn = createComputed(() => {
    // A dedicated signal that increments its value every time a query changes its dirty status. By
    // using this signal we can implement a query as computed and avoid creation of a specialized
    // reactive node type. Please note that a query gets marked dirty under the following
    // circumstances:
    // - a view (where a query is active) finished its first creation pass;
    // - a new view is inserted / deleted and it impacts query results.
    node._dirtyCounter();

    const value = refreshSignalQuery<V>(node, firstOnly);

    if (required && value === undefined) {
      throw new RuntimeError(
          RuntimeErrorCode.REQUIRED_QUERY_NO_VALUE,
          ngDevMode && 'Child query result is required but no value is available.');
    }

    return value;
  });
  node = signalFn[SIGNAL] as QuerySignalNode<V>;
  node._dirtyCounter = signal(0);

  if (ngDevMode) {
    signalFn.toString = () => `[Query Signal]`;
  }

  return signalFn;
}

export function createSingleResultOptionalQuerySignalFn<ReadT>(): Signal<ReadT|undefined> {
  return createQuerySignalFn(/* firstOnly */ true, /* required */ false) as Signal<ReadT|undefined>;
}

export function createSingleResultRequiredQuerySignalFn<ReadT>(): Signal<ReadT> {
  return createQuerySignalFn(/* firstOnly */ true, /* required */ true) as Signal<ReadT>;
}

export function createMultiResultQuerySignalFn<ReadT>(): Signal<ReadonlyArray<ReadT>> {
  return createQuerySignalFn(/* firstOnly */ false, /* required */ false) as
      Signal<ReadonlyArray<ReadT>>;
}

export function bindQueryToSignal(target: Signal<unknown>, queryIndex: number): void {
  const node = target[SIGNAL] as QuerySignalNode<unknown>;
  node._lView = getLView();
  node._queryIndex = queryIndex;
  node._queryList = loadQueryInternal(node._lView, queryIndex);
  node._queryList.onDirty(() => node._dirtyCounter.update(v => v + 1));
}

function refreshSignalQuery<V>(node: QuerySignalNode<V>, firstOnly: boolean): V|ReadonlyArray<V> {
  const lView = node._lView;
  const queryIndex = node._queryIndex;

  // There are 2 conditions under which we want to return "empty" results instead of the ones
  // collected by a query:
  //
  // 1) a given query wasn't created yet (this is a period of time between the directive creation
  // and execution of the query creation function) - in this case a query doesn't exist yet and we
  // don't have any results to return.
  //
  // 2) we are in the process of constructing a view (the first
  // creation pass didn't finish) and a query might have partial results, but we don't want to
  // return those - instead we do delay results collection until all nodes had a chance of matching
  // and we can present consistent, "atomic" (on a view level) results.
  if (lView === undefined || queryIndex === undefined || (lView[FLAGS] & LViewFlags.CreationMode)) {
    return (firstOnly ? undefined : EMPTY_ARRAY) as V;
  }

  const queryList = loadQueryInternal<V>(lView, queryIndex);
  const tView = lView[TVIEW];
  const tQuery = getTQuery(tView, queryIndex);

  // TODO(refactor): add an utility method for the following logic
  const result = tQuery.crossesNgTemplate ?
      collectQueryResults<V>(tView, lView, queryIndex, []) :
      materializeViewResults<V>(tView, lView, tQuery, queryIndex);

  queryList.reset(result, unwrapElementRef);

  return firstOnly ? queryList.first : queryList.toArray();
}
