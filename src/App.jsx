import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import { CustomThemeProvider } from './context/ThemeContext';
import LearningPathPage from './pages/LearningPathPage';
import LearningContentPage from './pages/LearningContentPage';

function App() {
  return (
    <CustomThemeProvider>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={<LearningPathPage />} />
          <Route path="/course/:courseId/:sectionId" element={<LearningPathPage />} />
          <Route path="/learning/:courseId/:sectionId/:lessonId" element={<LearningContentPage />} />
          <Route path="*" element={<LearningPathPage />} />
        </Routes>
      </Router>
    </CustomThemeProvider>
  );
}

export default App;