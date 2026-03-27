import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Login from "./screens/Login";
import Register from "./screens/Register";
import Dashboard from "./screens/Dashboard";

const Stack = createNativeStackNavigator();

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = await AsyncStorage.getItem("token");
    setIsAuthenticated(!!token);
  };

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Login">
              {(props) => (
                <Login {...props} setIsAuthenticated={setIsAuthenticated} />
              )}
            </Stack.Screen>

            <Stack.Screen name="Register" component={Register} />
          </>
        ) : (
          <Stack.Screen name="Dashboard">
            {(props) => (
              <Dashboard {...props} setIsAuthenticated={setIsAuthenticated} />
            )}
          </Stack.Screen>
        )}

      </Stack.Navigator>
    </NavigationContainer>
  );
}