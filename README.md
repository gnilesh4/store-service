# @ngxp/store-service

Adds an abstraction layer between Angular components and the [@ngrx](https://github.com/ngrx/platform) store and effects. This decouples the components from the store, selectors, actions and effects and makes it easier to test components.

# Table of contents

* [Installation](#installation)
* [Comparison](#comparison)
    * [Before](#before)
    * [After](#after)
* [Documentation](#documentation)
    * [StoreService](#storeservice)
    * [Selectors](#selectors)
    * [Actions](#actions)
    * [Observers](#observers)
        * [Observe multiple types](#multiple-types)
        * [Use objects with type property](#objects-with-type-property)
        * [String action types](#string-action-types)
        * [Custom mapper](#custom-mapper)
* [Testing](#testing)
    * [Testing Components](#testing-components)
        * [Testing Selectors](#testing-selectors)
        * [Testing Actions](#testing-actions)
        * [Testing Observers](#testing-observers)
    * [Testing StoreService](#testing-storeservice)
        * [Testing StoreService Selectors](#testing-storeservice-selectors)
        * [Testing StoreService Actions](#testing-storeservice-actions)
        * [Testing StoreService Observers](#testing-storeservice-observers)
* [Examples](#examples)
    * [Example Store Service](#example-store-service)
    * [Example Tests](#example-tests)

# Installation

Get the latest version from NPM 
> The current version requires Angular 8 & Ngrx 8

```sh
npm install @ngxp/store-service
```

# Comparison
![Dependency diagram comparison](docs/diagram.png)

## Before

> Component

```ts
import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { Book } from 'src/app/shared/books/book.model';
// Tight coupling to ngrx, state model, selectors and actions
import { Store } from '@ngrx/store'; 
import { Actions, ofType } from '@ngrx/effects'; 
import { AppState } from 'src/app/store/appstate.model';
import { getAllBooks, getBook } from 'src/app/store/books/books.selectors'; 
import { addBookAction, booksLoadedAction } from 'src/app/store/books/books.actions'; 
 
@Component({
    selector: 'nss-book-list',
    templateUrl: './book-list.component.html',
    styleUrls: ['./book-list.component.scss']
})
export class BookListComponent {

    books$: Observable<Book[]>;
    book$: Observable<Book>;
    booksLoaded: boolean = false;

    constructor(
        private store: Store<AppState>
        private actions: Actions
    ) {
        this.books$ = this.store.select(getAllBooks);
        this.book$ = this.store.select(getBook, { id: 0 });
        this.actions
            .pipe(
                ofType(booksLoadedAction),
                map(() => this.loaded = true)
            )
            .suscribe();
    }

    addBook(book: Book) {
        this.store.dispatch(addBookAction({ book }));
    }
}
```

## After

> Component

```ts
import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { Book } from 'src/app/shared/books/book.model';
import { BookStoreService } from 'src/app/shared/books/book-store.service'; 
// Reduced to just one dependency. Loose coupling

@Component({
    selector: 'nss-book-list',
    templateUrl: './book-list.component.html',
    styleUrls: ['./book-list.component.scss']
})
export class BookListComponent {

    books$: Observable<Book[]>;
    book$: Observable<Book>;
    booksLoaded: boolean = false;

    constructor(
        private bookStore: BookStoreService // <- StoreService
    ) {
        this.books$ = this.bookStore.getAllBooks(); // <- Selector
        this.book$ = this.bookStore.getBook({ id: 0 }); // <- Selector
        this.bookStore.booksLoaded$ // <-- Observer / Action stream of type
            .pipe(
                map(() => this.loaded = true)
            )
            .subscribe();
    }

    addBook(book: Book) {
        this.bookStore.addBook({ book }); // <- Action
    }
}
```

> BookStoreService

```ts
import { Injectable } from '@angular/core';
import { Select, StoreService, Dispatch, Selector, Dispatcher } from '@ngxp/store-service';
import { Observable } from 'rxjs';
import { Book } from 'src/app/shared/books/book.model';
import { getBooks } from 'src/app/store/books/books.selectors';
import { State } from 'src/app/store/store.model';
import { addBookAction, booksLoadedAction } from 'src/app/store/books/books.actions';

@Injectable()
export class BookStoreService extends StoreService<State> {

    @Select(getBooks) // <- Selector
    getAllBooks: Selector<typeof getBook>;

    @Select(getBook) // <- Selector
    getBook: Selector<typeof getBook>;

    @Dispatch(addBookAction) // <- Action
    addBook: Dispatcher<typeof addBookAction>;

    @Observe([booksLoadedAction])
    booksLoaded$: Observable<Book[]>; // <- Observer / Action stream
}
```


# Documentation

## StoreService

The `BookStoreService` Injectable class has to extend the `StoreService<State>` class where `State` is your ngrx state model.

```ts
import { StoreService } from '@ngxp/store-service';
import { AppState } from 'app/store/state.model';

@Injectable()
export class BookStoreService extends StoreService<AppState> {
    ...
}
```

## Selectors

To use selectors you add the `@Select(...)` decorator inside the `StoreService`. Provide the selector function inside the `@Select(...)` annotation:

```ts
// Define the selector function
export const selectAllBooks = createSelector(
    (state: State) => state.books;
};

//Or with props
export const selectBook = createSelector(
    (state: State, props: { id: number }) => state.books[id];
};
...

// Use the selector function inside the @Select(...) annotation
@Select(selectAllBooks)
allBooks: Selector<typeof selectAllBooks>; // () => Observable<Book[]>

@Select(selectBook)
book: Selector<typeof selectBook>; // (props: { id: number }) => Observable<Book>
```
The `Selector<...>` type automatically infers the correct typing according to the props and return type of the selector.




## Actions

To dispatch actions add a property with the `@Dispatch(...)` annotation.

```ts
// Defined the Action as a class
export const loadBooksAction = createAction('[Books] Load books');

export const addBookAction = createAction('[Books] Add book' props<{ book: Book}>())

export class OldAddBookAction implements Action {
    type = '[Books] Add book';
    constructor(
        public book: Book
    ) { }
}
...
// Use the Action class inside the @Dispatch(...) annotation
@Dispatch(loadBooksAction)
loadBooks: Dispatcher<typeof loadBooksAction>; // () => void

@Dispatch(addBookAction)
addBook: Dispatcher<typeof addBookAction>; // (props: { book: Book }) => void

@Dispatch(OldAddBookAction)
addOldBook: (book: Book) => void; // Manual typing for old action classes
```

The `Dispatcher<...>` type automatically infers the parameters according to the props of the action. But this only works with the new ActionCreators (`createAction(...)`) and not the old `Action` classes.


## Observers

Observers are a way to listen for specific action types on the `Actions` stream from [@ngrx/effects](https://github.com/ngrx/platform/blob/master/docs/effects/README.md).

```ts
@Observe([booksLoadedAction])
booksLoaded$: Observable<Book[]>;
```

### Multiple types
You can provide multiple types, just like in the `ofType(...)` pipe.

```ts
@Observe([booksLoadedAction, booksLoadFailedAction])
booksLoaded$: Observable<Book[] | string>;
```

### Objects with type property
Objects with a `type` property are also valid.

```ts
const action = { type: 'booksLoaded' };
...
@Observe([action])
booksLoaded$: Observable<Book[]>;
```

### String action types
Plain type strings are also valid.

```ts
export enum ActionType {
    BooksLoaded = 'booksLoaded'
}
...
@Observe([ActionType.BooksLoaded])
booksLoaded$: Observable<Book[]>;
```

### Custom mapper
The `@Observe(...)` decorator has an additional parameter to provide a custom `customMapper` mapping function.
Initially this will be:
```ts
action => action
```

To use a custom mapper, provide it as second argument in the `@Observe(...)` annotation.

```ts
export const toData = action => action.data;

...
@Observe([dataLoadedAction], toData)
dataLoaded$: Observable<Data>;
```

# Testing
Testing your components and the StoreService is easy. The `@ngxp/store-service/testing` package provides useful test-helpers to reduce testing friction.

## Testing Components

### Testing Selectors

To test selectors you provide the `StoreService` using the `provideStoreServiceMock` method in the testing module of your component. Then cast the store service instance using the `StoreServiceMock<T>` class to get the correct typings.


```ts
import { provideStoreServiceMock, StoreServiceMock } from '@ngxp/store-service/testing';
...
let bookStoreService: StoreServiceMock<BookStoreService>;
...
TestBed.configureTestingModule({
    declarations: [
        BookListComponent
    ],
    providers: [
        provideStoreServiceMock(BookStoreService)
    ]
})
...
bookStoreService = TestBed.get(BookStoreService);
```

The `StoreServiceMock` class replaces all selector functions on the store service class with a `BehaviorSubject`. So now you can do the following to emit new values to the observables:

```ts
bookStoreService.getAllBooks().next(newBooks);
```

The `BehaviorSubject` is initialized with the value being `undefined`. If you want a custom initial value, the `provideStoreServiceMock` method offers an optional parameter. This is an object of key value pairs where the key is the name of the selector function, e.g. `getAllBooks`.

```ts
import { provideStoreServiceMock, StoreServiceMock } from '@ngxp/store-service/testing';
...
let bookStoreService: StoreServiceMock<BookStoreService>;
...
TestBed.configureTestingModule({
    declarations: [
        BookListComponent
    ],
    providers: [
        provideStoreServiceMock(BookStoreService, {
            getAllBooks: []
        })
    ]
})
...
bookStoreService = TestBed.get(BookStoreService);
```

The `BehaviorSubject` for `getAllBooks` is now initialized with an empty array instead of `undefined`.

### Testing Actions

To test if a component calls the dispatch methods you provide the `StoreService` using the `provideStoreServiceMock` method in the testing module of your component. Then cast the store service instance using the `StoreServiceMock<T>` class to get the correct typings.

You can then spy on the method as usual.

```ts
import { provideStoreServiceMock, StoreServiceMock } from '@ngxp/store-service/testing';
...
let bookStoreService: StoreServiceMock<BookStoreService>;
...
TestBed.configureTestingModule({
    declarations: [
        NewBookComponent
    ]
    imports: [
        provideStoreServiceMock(BookStoreService)
    ]
})
...
it('adds a new book', () => {
    const book: Book = getBook();
    const addBookSpy = spyOn(bookStoreService, 'addBook');

    component.book = book;
    component.addBook();

    expect(addBookSpy).toHaveBeenCalledWith({ book });
});
```

### Testing Observers

To test observers inside components you provide the `StoreService` using the `provideStoreServiceMock` method in the testing module of your component. Then cast the store service instance using the `StoreServiceMock<T>` class to get the correct typings.


```ts
import { provideStoreServiceMock, StoreServiceMock } from '@ngxp/store-service/testing';
...
let bookStoreService: StoreServiceMock<BookStoreService>;
...
TestBed.configureTestingModule({
    declarations: [
        BookListComponent
    ],
    providers: [
        provideStoreServiceMock(BookStoreService)
    ]
})
...
bookStoreService = TestBed.get(BookStoreService);
```

The `StoreServiceMock` class replaces all observer properties on the store service class with a `BehaviorSubject`. So now you can do the following to emit new values to the subscribers:

```ts
bookStoreService.booksLoaded$.next(true);
```

The `BehaviorSubject` is initialized with the value being `undefined`. If you want a custom initial value, the `provideStoreServiceMock` method offers an optional parameter. This is an object of key value pairs where the key is the name of the observer property, e.g. `booksLoaded$`.

```ts
import { provideStoreServiceMock, StoreServiceMock } from '@ngxp/store-service/testing';
...
let bookStoreService: StoreServiceMock<BookStoreService>;
...
TestBed.configureTestingModule({
    declarations: [
        BookListComponent
    ],
    providers: [
        provideStoreServiceMock(BookStoreService, {
            booksLoaded$: false
        })
    ]
})
...
bookStoreService = TestBed.get(BookStoreService);
```

The `BehaviorSubject` for `booksLoaded$` is now initialized with `false` instead of `undefined`.


## Testing StoreService

To test the `StoreService` itself you use the provided test helpers from `@ngrx/store/testing` and `@ngrx/effects/testing`.

### Testing StoreService Selectors

You can provide mocks for selectors with the `provideMockStore` from `@ngrx/store/testing` a. See (@ngrx/store Testing)[https://ngrx.io/guide/store/testing] for their documentation.

Mock the selectors using the `provideMockStore` function and check if the `StoreService` returns an Observable with the mocked value.

```ts
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { BookStoreService } from 'src/app/shared/books/book-store.service';
import { selectBook, selectBooks } from '../../store/books/books.selectors';

describe('BookStoreService', () => {
    let bookStoreService: BookStoreService;
    let mockStore: MockStore<{ books: BookState }>;

    const books: Book[] = [
        {
            author: 'Joost',
            title: 'Testing the StoreService',
            year: 2019
        }
    ];

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            providers: [
                BookStoreService,
                provideMockStore({
                    selectors: [
                        {
                            selector: selectBooks,
                            value: books
                        },
                        {
                            selector: selectBook,
                            value: books[0]
                        }
                    ]
                })
            ]
        });
    }));

    beforeEach(() => {
        bookStoreService = TestBed.get(BookStoreService);
        mockStore = TestBed.get(Store);
    });

    it('executes the getBooks Selector', () => {
        const expected = cold('a', { a: books });

        expect(bookStoreService.getAllBooks()).toBeObservable(expected);
    });
    it('executes the getBook Selector', () => {
        const expected = cold('a', { a: books[0] });

        expect(bookStoreService.getBook({ id: 0 })).toBeObservable(expected);
    });
});
```

### Testing StoreService Actions

You can provide mocks for selectors with the `provideMockStore` from `@ngrx/store/testing` a. See (@ngrx/store Testing)[https://ngrx.io/guide/store/testing] for their documentation.

Mock the selectors using the `provideMockStore` function and check if the `StoreService` returns an Observable with the mocked value.

To test if the `StoreService` dispatches the correct actions the `MockStore` from @ngrx has a property called `scannedActions$`. This is an Observable of all dispatched actions to check if an action was dispatched correctly.

```ts
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { cold } from 'jasmine-marbles';
import { BookStoreService } from 'src/app/shared/books/book-store.service';
import { addBookAction, loadBooksAction } from '../../store/books/books.actions';

describe('BookStoreService', () => {
    let bookStoreService: BookStoreService;
    let mockStore: MockStore<{ books: BookState }>;

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            providers: [
                BookStoreService,
                provideMockStore()
            ]
        });
    }));

    beforeEach(() => {
        bookStoreService = TestBed.get(BookStoreService);
        mockStore = TestBed.get(Store);
    });

    it('dispatches a new addBookAction', () => {
        const book: Book = getBook();
        bookStoreService.addBook({ book });

        const expected = cold('a', { a: addBookAction({ book }) });
        expect(mockStore.scannedActions$).toBeObservable(expected);
    });
    it('dispatches a new loadBooksAction', () => {
        bookStoreService.loadBooks();

        const expected = cold('a', { a: loadBooksAction() });
        expect(mockStore.scannedActions$).toBeObservable(expected);
    });
});
```

### Testing StoreService Observers

To test the observers / actions stream, you import the `provideMockActions` from `@ngrx/effects/testing` inside the testing module.
Then check if the Observer filters the correct actions.

```ts
import { provideMockActions } from '@ngrx/effects/testing';
import { BehaviorSubject } from 'rxjs';
import { BookStoreService } from 'src/app/shared/books/book-store.service';
import { booksLoadedAction } from '../../store/books/books.actions';

describe('BookStoreService', () => {
    let bookStoreService: BookStoreService;
    const mockActions = new BehaviorSubject(undefined);

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            providers: [
                BookStoreService,
                provideMockActions(mockActions)
            ]
        });
    }));

    beforeEach(() => {
        bookStoreService = TestBed.get(BookStoreService);
    });

    it('filters the BooksLoadedActions in booksLoaded$', () => {
        const expectedValue: Book[] = [{
            author: 'Author',
            title: 'Title',
            year: 2018
        }];

        const action = booksLoadedAction({ books: expectedValue });
        mockActions.next(action);

        const expected = cold('a', { a: action });
        
        expect(bookStoreService.booksLoaded$).toBeObservable(expected);
    });
});

```

# Examples

For detailed examples of all this have a look at the Angular Project in [the src/app folder](src/app).

## Example Store Service

Have a look at the [BookStoreService](src/app/shared/books/book-store.service.ts)

## Example Tests

For examples on Component Tests please have look at the test for the [BookListComponent](src/app/components/book-list/book-list.component.spec.ts) and the [NewBookComponent](src/app/components/new-book/new-book.component.spec.ts)

Testing the `StoreService` is also very easy. For an example have a look at the [BookStoreService](src/app/shared/books/book-store.service.spec.ts)
