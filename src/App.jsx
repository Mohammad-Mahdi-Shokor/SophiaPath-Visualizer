import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useMemo, useState } from 'react';
import LearningPathPage from './pages/LearningPathPage.jsx';

const buildTheme = (mode) => createTheme({
  palette: {
    mode,
    primary: {
      main: '#3D5CFF',
    },
    success: {
      main: '#3DDC97',
    },
    background: {
      default: mode === 'dark' ? '#111425' : '#F5F7FA',
      paper: mode === 'dark' ? '#191D33' : '#FCFDFF',
    },
  },
  typography: {
    fontFamily: '"Poppins", sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          fontWeight: 800,
          textTransform: 'none',
        },
      },
    },
  },
});

export default function App() {
  const [mode, setMode] = useState('light');
  const theme = useMemo(() => buildTheme(mode), [mode]);
  const toggleMode = () => setMode((value) => (value === 'light' ? 'dark' : 'light'));

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div data-theme={mode}>
        <LearningPathPage mode={mode} onToggleMode={toggleMode} />
      </div>
    </ThemeProvider>
  );
}
