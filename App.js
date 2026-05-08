import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import UploadPage from './pages/UploadPage';
import ProcessViewer from './pages/ProcessViewer';
import './App.css';

// Toast options moved outside component to prevent re-renders
const toastOptions = {
  style: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    color: '#18181b',
    fontFamily: 'Manrope, sans-serif',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
  }
};

function App() {
  const [datasetId, setDatasetId] = useState(null);
  const [resultId, setResultId] = useState(null);

  return (
    <div className="App min-h-screen bg-gradient-to-br from-zinc-50 via-white to-emerald-50">
      <style>{`
        .react-flow__attribution,
        a[href*="reactflow"],
        [class*="react-flow__panel"][class*="bottom"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          position: absolute !important;
          left: -9999px !important;
        }
      `}</style>
      <BrowserRouter>
        <Routes>
          <Route 
            path="/" 
            element={
              <UploadPage 
                onUploadSuccess={(id) => setDatasetId(id)} 
                onMiningSuccess={(id) => setResultId(id)}
              />
            } 
          />
          <Route 
            path="/process/:resultId" 
            element={<ProcessViewer />} 
          />
        </Routes>
      </BrowserRouter>
      <Toaster 
        position="top-right" 
        theme="light"
        toastOptions={toastOptions}
      />
    </div>
  );
}

export default App;