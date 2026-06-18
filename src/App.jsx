import CssBaseline from '@mui/material/CssBaseline';
import IconButton from '@mui/material/IconButton';
import { alpha, createTheme, ThemeProvider } from '@mui/material/styles';
import { DarkMode as DarkModeIcon, LightMode as LightModeIcon } from '@mui/icons-material';
import { useMemo, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LearningPathPage from './pages/LearningPathPage.jsx';
import LearningContentPage from './pages/LearningContentPage.jsx';

const baseColors = {
  primary: '#3D5CFF',
  primaryDark: '#2E49D1',
  primaryGlow: '#7C8DFF',
  darkBg: '#1F1F39',
  darkSurface: '#161632',
  darkSurfaceAlt: '#18193C',
  lightBg: '#F5F7FA',
  lightSurface: '#FCFDFF',
  lightSurfaceAlt: '#F0F4F8',
  white: '#FFFFFF',
  darkText: '#2D2D4D',
};

const buildTheme = (mode) => {
  const isDark = mode === 'dark';
  const palette = {
    mode,
    primary: {
      main: baseColors.primary,
      dark: baseColors.primaryDark,
      light: baseColors.primaryGlow,
      contrastText: baseColors.white,
    },
    secondary: {
      main: isDark ? baseColors.darkSurfaceAlt : baseColors.lightSurfaceAlt,
    },
    success: {
      main: '#3DDC97',
    },
    warning: {
      main: '#FFB547',
    },
    error: {
      main: '#FF647C',
    },
    background: {
      default: isDark ? baseColors.darkBg : baseColors.lightBg,
      paper: isDark ? baseColors.darkSurface : baseColors.lightSurface,
    },
    text: {
      primary: isDark ? baseColors.white : baseColors.darkText,
      secondary: isDark ? 'rgba(255, 255, 255, 0.72)' : 'rgba(45, 45, 77, 0.7)',
      disabled: isDark ? 'rgba(255, 255, 255, 0.42)' : 'rgba(45, 45, 77, 0.4)',
    },
    divider: isDark ? 'rgba(159, 174, 255, 0.18)' : 'rgba(61, 92, 255, 0.14)',
  };

  return createTheme({
    palette,
    shape: {
      borderRadius: 20,
    },
    typography: {
      fontFamily: '"Poppins", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: { fontWeight: 800, letterSpacing: '-0.04em' },
      h2: { fontWeight: 800, letterSpacing: '-0.035em' },
      h3: { fontWeight: 800, letterSpacing: '-0.03em' },
      h4: { fontWeight: 700, letterSpacing: '-0.025em' },
      h5: { fontWeight: 700, letterSpacing: '-0.02em' },
      h6: { fontWeight: 700, letterSpacing: '-0.015em' },
      button: {
        fontWeight: 700,
        letterSpacing: '0.02em',
        textTransform: 'none',
      },
    },
    shadows: [
      'none',
      '0 1px 2px rgba(8, 10, 27, 0.06)',
      '0 2px 6px rgba(8, 10, 27, 0.08)',
      '0 4px 12px rgba(8, 10, 27, 0.10)',
      '0 8px 20px rgba(8, 10, 27, 0.12)',
      '0 12px 28px rgba(8, 10, 27, 0.16)',
      '0 16px 40px rgba(8, 10, 27, 0.20)',
    ],
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: isDark ? baseColors.darkBg : baseColors.lightBg,
            backgroundImage: 'none',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderRadius: 16,
            backgroundColor: isDark ? baseColors.darkSurface : baseColors.lightSurface,
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            borderRadius: 18,
            paddingInline: 22,
            transition: 'all 0.2s ease',
          },
          containedPrimary: {
            backgroundColor: baseColors.primary,
            boxShadow: '0 2px 6px rgba(8, 10, 27, 0.12)',
            '&:hover': {
              backgroundColor: baseColors.primaryDark,
              boxShadow: '0 4px 10px rgba(8, 10, 27, 0.16)',
            },
            '&:active': {
              boxShadow: '0 2px 4px rgba(8, 10, 27, 0.12)',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            fontWeight: 600,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? alpha('#161632', 0.94) : alpha('#ffffff', 0.92),
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: 'transparent',
            boxShadow: 'none',
          },
        },
      },
    },
  });
};

export default function App() {
  const [mode, setMode] = useState('light');
  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div data-theme={mode}>
        <Router>
          <Routes>
            <Route path="/learning/:courseId/:sectionId/:lessonId" element={<LearningContentPage />} />
            <Route path="/*" element={<LearningPathPage />} />
          </Routes>
        </Router>
        <IconButton
          className="visualizer-theme-toggle"
          onClick={() => setMode((value) => (value === 'light' ? 'dark' : 'light'))}
          aria-label="Toggle dark mode"
        >
          {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
        </IconButton>
      </div>
    </ThemeProvider>
  );
}
