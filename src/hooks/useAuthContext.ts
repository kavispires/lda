import { useContext } from "react";
import { AuthContext } from "services/AuthProvider";

export const useAuthContext = () => useContext(AuthContext);
