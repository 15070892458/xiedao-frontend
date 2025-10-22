"use client";

import {
  createContext,
  useReducer,
  Dispatch,
  useContext,
  useEffect,
  ReactNode,
} from "react";

interface UserContextInterface {
  user: string;
  isAuthenticated: boolean;
  loading: boolean;
}

interface UserAction {
  type: string;
  email?: string;
  payload?: any;
}

const initialUserState: UserContextInterface = {
  user: "",
  isAuthenticated: false,
  loading: true,
};

const UserContext = createContext<UserContextInterface | null>(null);
const UserDispatchContext = createContext<Dispatch<UserAction> | null>(null);

const userReducer = (state: UserContextInterface, action: UserAction) => {
  switch (action.type) {
    case "LOGIN":
      return {
        ...state,
        user: action.email || "",
        isAuthenticated: true,
        loading: false,
      };
    case "LOGOUT":
      return {
        ...state,
        user: "",
        isAuthenticated: false,
        loading: false,
      };
    case "SET_LOADING":
      return {
        ...state,
        loading: action.payload,
      };
    default:
      return state;
  }
};

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(userReducer, initialUserState);

  useEffect(() => {
    // ✅ Only run on client
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      dispatch({
        type: "LOGIN",
        email: JSON.parse(storedUser).user,
      });
    } else {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  useEffect(() => {
    // Keep localStorage in sync
    localStorage.setItem("user", JSON.stringify(state));
  }, [state]);

  return (
    <UserContext.Provider value={state}>
      <UserDispatchContext.Provider value={dispatch}>
        {children}
      </UserDispatchContext.Provider>
    </UserContext.Provider>
  );
};

export function useUser() {
  return useContext(UserContext);
}

export function useUserDispatch() {
  return useContext(UserDispatchContext);
}
