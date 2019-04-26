import { Injectable } from '@angular/core';
import { Actions } from '@ngrx/effects';
import { Action, Action as NgrxAction, createSelector } from '@ngrx/store';
import { Observable, of, Subject } from 'rxjs';
import { take } from 'rxjs/operators';
import { StoreService } from './store-service';
import { Dispatch, Observe, Select, STORE_SERVICE_ACTIONS, STORE_SERVICE_SELECTORS } from './store-service.annotations';

// Needed because we can't import from testing...
class MockStore {

    dispatchedActions: NgrxAction[] = [];

    constructor(
        private _state
    ) { }

    pipe(...operators) {
        return of(this._state).pipe(
            ...operators
        );
    }

    dispatch(action: NgrxAction) {
        this.dispatchedActions.push(action);
    }
}

const state = {
    property: 'someProperty'
};

const entityAddedActionType = 'entityAdded';
const entityRemovedActionType = 'entityRemoved';
const actionsSubject = new Subject<Action>();

const selectorFn = createSelector(
    (state: any, props: { propName: string }) => state[props.propName]
)

const actionType = 'someType';

class AddEntityAction implements NgrxAction {
    public type = actionType;
    constructor(
        public entity: any
    ) { }
}
@Injectable()
class MockService extends StoreService<any> {
    @Select(selectorFn)
    getStateProp: (props: {propName: string}) => Observable<string>;

    @Dispatch(AddEntityAction)
    addEntity: (entity: any) => void;

    @Observe([entityAddedActionType, new AddEntityAction({})])
    addedEntitie$: Observable<any>;

    @Observe([entityAddedActionType], action => action.content)
    addedEntitieWithCustomPayloadMapper$: Observable<any>;
}

describe('Ngrx Store Service Annotations', () => {
    let store: MockStore;
    let service: MockService;

    beforeEach(() => {
        store = new MockStore(state);
        service = new MockService(<any>store, new Actions(actionsSubject));
    });

    describe('Select', () => {

        it('calls select function on the store instance', () => {
            const storePipeSpy = spyOn(store, 'pipe').and.callThrough();

            service.getStateProp({ propName: 'property'})
                .subscribe(value => {
                    expect(storePipeSpy).toHaveBeenCalled();
                    expect(value).toBe('someProperty');
                });
        });

        it('can be spied upon', () => {
            const overwrittenValue = 'overwrittenProperty';
            const getStatePropSpy = spyOn(service, 'getStateProp').and.returnValue(of(overwrittenValue));

            service.getStateProp({propName: 'property'})
                .subscribe(value => {
                    expect(getStatePropSpy).toHaveBeenCalled();
                    expect(value).toBe(overwrittenValue);
                });
        });

        it('sets the selectors variable', () => {

            expect(service[STORE_SERVICE_SELECTORS]).toContain('getStateProp');
        });
    });

    describe('Dispatch', () => {


        it('calls dispatch function on the store instance', () => {
            const entity = { name: 'entity' };
            const storeDispatchSpy = spyOn(store, 'dispatch').and.callThrough();

            service.addEntity(entity);

            expect(storeDispatchSpy).toHaveBeenCalled();

            const dispatchedAction = <AddEntityAction>store.dispatchedActions[store.dispatchedActions.length - 1];

            expect(dispatchedAction.type).toBe(actionType);
            expect(dispatchedAction.entity).toBe(entity);
        });

        it('can be spied upon', () => {
            const entity = { name: 'entity' };
            const addEntitySpy = spyOn(service, 'addEntity');

            service.addEntity(entity);

            expect(addEntitySpy).toHaveBeenCalled();
        });

        it('sets the actions variable', () => {
            expect(service[STORE_SERVICE_ACTIONS]).toContain('addEntity');
        });
    });

    describe('Observe', () => {
        it('filters actions of type', () => {
            service.addedEntitie$
                .pipe(
                    take(1)
                )
                .subscribe(payload => {
                    expect(payload).toBe(expectedPayload);
                });
            const expectedPayload = { value: 'payload' };

            const action = {
                type: entityAddedActionType,
                payload: expectedPayload
            };

            actionsSubject.next(action);
        });
        it('filters observers with type property', () => {
            service.addedEntitie$
                .pipe(
                    take(1)
                )
                .subscribe(payload => {
                    expect(payload).toBe(expectedPayload);
                });
            const expectedPayload = { value: 'payload' };

            const action = {
                type: actionType,
                payload: expectedPayload
            };

            actionsSubject.next(action);
        });
        it('filters actions of type with custom payload mapper', () => {
            service.addedEntitieWithCustomPayloadMapper$
                .pipe(
                    take(1)
                )
                .subscribe(payload => {
                    expect(payload).toBe(expectedPayload);
                });
            const expectedPayload = { value: 'payload' };

            const action = {
                type: entityAddedActionType,
                content: expectedPayload
            };

            actionsSubject.next(action);
        });
        it('does not emit if type does not match', () => {
            service.addedEntitie$
                .pipe(
                    take(1)
                )
                .subscribe(payload => {
                    fail('Type should not emit');
                });

            const action = {
                type: 'wrong type',
                payload: null
            };
            actionsSubject.next(action);
        });

    });
});
