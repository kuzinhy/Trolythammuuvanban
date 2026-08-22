/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { useEffect } from "react";
import { useAuthStore } from "./store/authStore";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./lib/firebase";

import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import DocumentList from "./pages/DocumentList";
import DocumentDetail from "./pages/DocumentDetail";
import Tasks from "./pages/Tasks";
import Login from "./pages/Login";
import Search from "./pages/Search";
import Admin from "./pages/Admin";
import DirectiveDrafting from "./pages/DirectiveDrafting";
import DigitalMap from "./pages/DigitalMap";
import DocumentAudit from "./pages/DocumentAudit";
import Reports from "./pages/Reports";

export default function App() {
  const { setUser, setInitialized, isInitialized, user } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email || "",
          displayName: firebaseUser.displayName,
          role: "OFFICE"
        });
      }
      setInitialized(true);
    });

    // Fallback timer for environments where Firebase Auth check takes time
    const timer = setTimeout(() => {
      setInitialized(true);
    }, 800);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [setUser, setInitialized]);

  if (!isInitialized) {
    return <div className="flex h-screen items-center justify-center">Đang tải...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        
        {/* Protected Routes */}
        <Route path="/" element={user ? <Layout /> : <Navigate to="/login" />}>
          <Route index element={<Dashboard />} />
          <Route path="documents" element={<DocumentList />} />
          <Route path="documents/:id" element={<DocumentDetail />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="search" element={<Search />} />
          <Route path="map" element={<DigitalMap />} />
          <Route path="directive" element={<DirectiveDrafting />} />
          <Route path="audit" element={<DocumentAudit />} />
          <Route path="reports" element={<Reports />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
