"use client";

// From tungv/demo-gallery-app (src/utils/reducer-context.tsx).
import {
  type Dispatch,
  type PropsWithChildren,
  type Reducer,
  createContext,
  memo,
  useContext,
  useMemo,
  useReducer,
} from "react";

/**
 * One reducer behind two contexts, state and dispatch, so a component that only dispatches never
 * re-renders when the state changes. Props given to the provider are laid over `initialState` once,
 * when it mounts. `middleware` wraps dispatch, with a way to compute the state an action would produce.
 */
export function createReducerContext<Action, State>(
  reducer: Reducer<State, Action>,
  initialState: State,
  displayName = "ReducerContext",
) {
  const stateCtx = createContext<State>(initialState);
  const dispatchCtx = createContext<Dispatch<Action>>(() => {});

  function Provider({
    children,
    middleware,
    ...values
  }: PropsWithChildren<Partial<State>> & {
    middleware?: (
      dispatch: Dispatch<Action>,
      getNextState: (action: Action) => State,
    ) => Dispatch<Action>;
  }) {
    const [state, dispatch] = useReducer(reducer, initialState, (defaultState) => ({
      ...defaultState,
      ...values,
    }));

    const wrapped = useMemo(() => {
      return middleware ? middleware(dispatch, (action) => reducer(state, action)) : dispatch;
    }, [middleware, state, reducer]);

    return (
      <stateCtx.Provider value={state}>
        <dispatchCtx.Provider value={wrapped}>{children}</dispatchCtx.Provider>
      </stateCtx.Provider>
    );
  }

  function useDispatch() {
    return useContext(dispatchCtx);
  }

  function useStateContext() {
    return useContext(stateCtx);
  }

  Provider.displayName = displayName;

  return [memo(Provider), useStateContext, useDispatch] as const;
}
