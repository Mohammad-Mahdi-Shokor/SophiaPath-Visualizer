import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Container,
  Paper,
  Typography,
  useTheme,
  Tabs,
  Tab,
  Alert,
  Popover,
  Dialog,
  useMediaQuery,
  IconButton
} from '@mui/material';
import {
  School as SchoolIcon,
  CheckCircle as CheckCircleIcon,
  Lock as LockIcon,
  ArrowForward as ArrowForwardIcon,
  ChevronRight as ChevronRightIcon,
  MenuBook as BookIcon,
  Close as CloseIcon,
  FitnessCenter as ExerciseIcon,
  SportsEsports as AssessmentIcon,
  Check as CheckIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Code as CodeIcon,
  Terminal as TerminalIcon,
  Star as StarIcon,
} from '@mui/icons-material';

import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { loadCourses } from '../data/courses';
import { useTheme as useAppTheme } from '../context/ThemeContext';
import { CppPlaygroundDialog } from '../components/CppPlaygroundDialog';
import { JavaOopUmlPlayground } from '../components/JavaOopUmlPlayground';
import './LearningPathPage.css';

const STORAGE_KEY = 'sophia_learning_progress';

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

const getNodeIcon = (node, isMobile) => {
  const cat = node.category?.toLowerCase() || 'learning';
  const title = (node.title || '').trim().toLowerCase();
  const size = isMobile ? 21 : 28;
  
  if (title.startsWith('chapter test') || title.startsWith('review')) {
    return <StarIcon sx={{ fontSize: size }} />;
  }
  
  if (cat === 'exercise' || cat === 'quiz' || cat === 'mcq') {
    return <ExerciseIcon sx={{ fontSize: size }} />;
  }
  if (cat === 'assessment' || cat === 'test' || cat === 'exam') {
    return <AssessmentIcon sx={{ fontSize: size }} />;
  }
  return <BookIcon sx={{ fontSize: size }} />;
};

const LearningPathPage = () => {
  const { courseId, sectionId } = useParams();
  const theme = useTheme();
  const { isDarkMode, toggleTheme } = useAppTheme();
  const isMobileViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const location = useLocation();

  const [course, setCourse] = useState(null);
  const [courseLoading, setCourseLoading] = useState(true);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [hasInitialSectionBeenSet, setHasInitialSectionBeenSet] = useState(false);
  const [progress, setProgress] = useState(loadProgress());

  // Preview popover/dialog state
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);

  // Playground dialog states
  const [cppPlaygroundOpen, setCppPlaygroundOpen] = useState(false);
  const [javaPlaygroundOpen, setJavaPlaygroundOpen] = useState(false);

  // Load course from info.csv
  useEffect(() => {
    const loadCourseData = async () => {
      setCourseLoading(true);
      try {
        const courses = await loadCourses();
        if (courses.length > 0) {
          setCourse(courses[0]); // Use first course from info.csv
        }
      } catch (err) {
        console.error('Failed to load course:', err);
      } finally {
        setCourseLoading(false);
      }
    };
    loadCourseData();
  }, []);

  const sections = useMemo(() => {
    if (!course || !course.sections) return [];
    return course.sections.map((section) => {
      const allLessons = section.lessons || [];
      const coreLessons = allLessons.filter(l => {
        const title = (l.title || '').trim().toLowerCase();
        const cat = (l.category || '').trim().toLowerCase();
        return !(title.startsWith('cheatsheet:') || title.startsWith('cheatsheet ') || title === 'cheatsheet' || cat === 'cheatsheet');
      });
      const completedLessons = coreLessons.filter(l => {
        const cat = (l.category || '').trim().toLowerCase();
        const isExercise = ['exercise', 'quiz', 'mcq', 'assessment', 'test', 'exam'].includes(cat);
        if (isExercise && progress[l.id] !== undefined) return true;
        return (progress[l.id] || 0) >= 70;
      });
      const isComplete = coreLessons.length > 0 && completedLessons.length === coreLessons.length;

      return {
        ...section,
        lessons: allLessons, // Keep all lessons so cheatsheet button works
        isComplete,
        isUnlocked: true,
        progressPercent: coreLessons.length > 0 ? (completedLessons.length / coreLessons.length) * 100 : 0
      };
    });
  }, [course, progress]);

  // Auto-select section based on URL params, or fall back to first incomplete section
  useEffect(() => {
    if (sections.length > 0 && !hasInitialSectionBeenSet) {
      if (sectionId) {
        const sectionIndex = sections.findIndex(s => String(s.id) === String(sectionId));
        if (sectionIndex !== -1) {
          setActiveSectionIndex(sectionIndex);
        } else {
          const firstIncompleteIdx = sections.findIndex(s => !s.isComplete);
          setActiveSectionIndex(firstIncompleteIdx !== -1 ? firstIncompleteIdx : 0);
        }
      } else {
        const firstIncompleteIdx = sections.findIndex(s => !s.isComplete);
        setActiveSectionIndex(firstIncompleteIdx !== -1 ? firstIncompleteIdx : 0);
      }
      setHasInitialSectionBeenSet(true);
    }
  }, [sections, sectionId, hasInitialSectionBeenSet]);

  const activeSection = sections[activeSectionIndex];

  // Scroll to returned lesson if applicable
  useEffect(() => {
    if (location.state?.returnedFromLessonId && !courseLoading && sections.length > 0) {
      const lessonId = location.state.returnedFromLessonId;
      const timer = setTimeout(() => {
        const el = document.getElementById(`node-${lessonId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [location.state, courseLoading, sections, activeSectionIndex]);

  const lessons = useMemo(() => {
    const allLessons = activeSection?.lessons || [];
    return allLessons.filter(l => {
      const title = (l.title || '').trim().toLowerCase();
      const cat = (l.category || '').trim().toLowerCase();
      return !(title.startsWith('cheatsheet:') || title.startsWith('cheatsheet ') || title === 'cheatsheet' || cat === 'cheatsheet');
    });
  }, [activeSection]);

  const cheatsheetLesson = useMemo(() => {
    return activeSection?.lessons?.find(l => {
      const title = (l.title || '').trim().toLowerCase();
      const cat = (l.category || '').trim().toLowerCase();
      return title.startsWith('cheatsheet:') || title.startsWith('cheatsheet ') || title === 'cheatsheet' || cat === 'cheatsheet';
    }) || null;
  }, [activeSection]);

  const nodes = useMemo(() => {
    let currentY = 0;
    
    // Scale down layout for mobile by about 75%
    const stepStart = isMobileViewport ? 120 : 160;
    const stepNewChapter = isMobileViewport ? 270 : 360;
    const stepNormal = isMobileViewport ? 115 : 150;
    const xLeft = isMobileViewport ? 65 : 45;
    const xRight = isMobileViewport ? 235 : 255;

    return lessons.map((lesson, index) => {
      const rawScore = progress[lesson.id];
      const score = rawScore || 0;
      const cat = (lesson.category || '').trim().toLowerCase();
      const isExercise = ['exercise', 'quiz', 'mcq', 'assessment', 'test', 'exam'].includes(cat);
      
      let isPassed = score >= 70;
      if (isExercise && rawScore !== undefined) {
        isPassed = true;
      }

      let status = 'active';
      if (isPassed) status = 'completed';

      const chapterName = (lesson.chapterName || 'General').trim() || 'General';

      let isNewChapter = false;
      if (index === 0) {
        isNewChapter = true;
      } else {
        const prevChapter = (lessons[index - 1].chapterName || 'General').trim() || 'General';
        if (chapterName !== prevChapter) {
          isNewChapter = true;
        }
      }

      currentY += index === 0 ? stepStart : (isNewChapter ? stepNewChapter : stepNormal);

      const x = index % 2 === 0 ? xLeft : xRight;

      return {
        ...lesson,
        chapterName,
        isNewChapter,
        status,
        score,
        rawScore,
        isExercise,
        pos: { x, y: currentY },
      };
    });
  }, [lessons, progress, isMobileViewport]);

  const pathHeight = useMemo(() => {
    if (nodes.length === 0) return 300;
    return nodes[nodes.length - 1].pos.y + (isMobileViewport ? 85 : 110);
  }, [nodes, isMobileViewport]);

  const generatePath = () => {
    if (nodes.length < 2) return "";
    let d = `M ${nodes[0].pos.x} ${nodes[0].pos.y}`;
    for (let i = 1; i < nodes.length; i++) {
      const curr = nodes[i].pos;
      if (nodes[i].isNewChapter) {
        d += ` M ${curr.x} ${curr.y}`;
      } else {
        const prev = nodes[i - 1].pos;
        const cp1y = prev.y + (curr.y - prev.y) * 0.5;
        const cp2y = prev.y + (curr.y - prev.y) * 0.5;
        d += ` C ${prev.x} ${cp1y}, ${curr.x} ${cp2y}, ${curr.x} ${curr.y}`;
      }
    }
    return d;
  };

  const handleNodeClick = (event, node) => {
    setSelectedNode(node);
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      setOpenDialog(true);
    } else {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClosePreview = () => {
    setAnchorEl(null);
    setSelectedNode(null);
    setOpenDialog(false);
  };

  const handleStartLesson = () => {
    if (!selectedNode) return;
    const sectionId = activeSection?.id;
    navigate(`/learning/${course.id}/${sectionId}/${selectedNode.id}`);
    handleClosePreview();
  };

  const renderPreviewContent = () => {
    if (!selectedNode) return null;
    const isCompleted = selectedNode.status === 'completed';
    const accentColor = isCompleted ? '#58CC02' : 'var(--primary-main)';
    const buttonLabel = isCompleted ? 'RETAKE THE LESSON' : 'START THE LESSON';
    const categoryLabel = isCompleted ? 'COMPLETED LESSON' : (selectedNode.category === 'exercise' ? 'PRACTICE QUIZ' : 'ROADMAP LESSON');

    const description = selectedNode.category === 'exercise'
      ? `Test your knowledge with a quiz on "${selectedNode.title}". Answer the questions to prove your mastery and earn points!`
      : `Dive into "${selectedNode.title}" and learn key concepts in a step-by-step interactive slide viewer.`;

    return (
      <Box style={{ position: 'relative' }}>
        {isMobileViewport && (
          <IconButton
            style={{ position: 'absolute', right: '-12px', top: '-12px', color: 'var(--text-secondary)' }}
            onClick={handleClosePreview}
          >
            <CloseIcon />
          </IconButton>
        )}
        <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
          <Box style={{ flex: 1 }}>
            <Typography variant="caption" style={{
              color: accentColor, fontWeight: 800, letterSpacing: '0.12em',
              textTransform: 'uppercase', display: 'block', marginBottom: '4px'
            }}>
              {categoryLabel}
            </Typography>
            <Typography variant="h5" style={{
              fontWeight: 900, fontSize: '1.25rem', lineHeight: 1.3,
              color: 'var(--text-primary)', fontFamily: '"Outfit", sans-serif'
            }}>
              {selectedNode.title}
            </Typography>
          </Box>
          <Box style={{
            width: '52px', height: '52px', borderRadius: '50%',
            backgroundColor: isCompleted ? '#58CC02' : '#1CB0F6',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 8px 16px rgba(0,0,0,0.15)', flexShrink: 0
          }}>
            {selectedNode.title?.toLowerCase().startsWith('chapter test') || selectedNode.title?.toLowerCase().startsWith('review') ? (
              <StarIcon style={{ color: '#fff', fontSize: '26px' }} />
            ) : selectedNode.category === 'exercise' || selectedNode.category === 'quiz' || selectedNode.category === 'mcq' ? (
              <ExerciseIcon style={{ color: '#fff', fontSize: '26px' }} />
            ) : selectedNode.category === 'assessment' || selectedNode.category === 'test' ? (
              <AssessmentIcon style={{ color: '#fff', fontSize: '26px' }} />
            ) : (
              <BookIcon style={{ color: '#fff', fontSize: '26px' }} />
            )}
          </Box>
        </Box>

        <Typography variant="body2" style={{
          marginTop: '16px', color: 'var(--text-secondary)',
          lineHeight: 1.5, fontSize: '0.9rem'
        }}>
          {description}
        </Typography>

        {isCompleted && selectedNode.score > 0 && (
          <Box style={{
            marginTop: '14px', padding: '8px 12px',
            backgroundColor: 'rgba(88, 204, 2, 0.1)',
            border: '1px solid rgba(88, 204, 2, 0.2)',
            borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <CheckCircleIcon style={{ color: '#58CC02', fontSize: '18px' }} />
            <Typography variant="body2" style={{ color: '#58CC02', fontWeight: 700, fontSize: '0.85rem' }}>
              High Score: {selectedNode.score}%
            </Typography>
          </Box>
        )}

        <Button fullWidth variant="contained" onClick={handleStartLesson} style={{
          marginTop: '20px', padding: '12px', borderRadius: '14px',
          fontWeight: 800, fontSize: '0.9rem', backgroundColor: accentColor,
          color: '#fff', textTransform: 'none',
          fontFamily: '"Outfit", sans-serif'
        }}>
          {buttonLabel}
        </Button>
      </Box>
    );
  };

  if (courseLoading) {
    return (
      <div className="course-not-found" style={{ display: 'flex', flexDirection: 'column', gap: '20px', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="loading-spinner" style={{ width: '50px', height: '50px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary-main)', animation: 'spin 1s linear infinite' }} />
        <Typography variant="h6" style={{ color: 'var(--text-secondary)' }}>Loading Learning Path...</Typography>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!course) {
    return (
      <Box className="path-page-empty">
        <Typography variant="h5">No course data found in info.csv</Typography>
      </Box>
    );
  }

  const nextActiveNode = nodes.find(n => n.status === 'active') || nodes[nodes.length - 1];

  return (
    <Box className="path-page">
      <Container maxWidth="md">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, mt: 1 }}>
          <Typography variant="h5" style={{ fontWeight: 900, fontFamily: '"Outfit", sans-serif', color: 'var(--text-primary)' }}>
            {course.title}
          </Typography>
          <IconButton
            onClick={toggleTheme}
            sx={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              background: 'var(--surface-glass)',
              border: '1px solid var(--divider)',
              color: 'var(--text-primary)',
              '&:hover': { background: 'var(--action-hover)' },
            }}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
        </Box>

        <Box className="path-sections-tabs glass-panel" sx={{ mb: 2, borderRadius: 3 }}>
          <Tabs
            value={activeSectionIndex}
            onChange={(e, val) => setActiveSectionIndex(val)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ px: 2 }}
          >
            {sections.map((section) => (
              <Tab
                key={section.id}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {section.title}
                    {!section.isUnlocked && <LockIcon sx={{ fontSize: 16 }} />}
                  </Box>
                }
                disabled={!section.isUnlocked}
              />
            ))}
          </Tabs>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', mb: 3 }}>
          {cheatsheetLesson && (
            <Button
              variant="outlined"
              startIcon={<BookIcon />}
              onClick={() => {
                const sectionId = activeSection?.id;
                navigate(`/learning/${course.id}/${sectionId}/${cheatsheetLesson.id}`);
              }}
              sx={{
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '0.8rem',
                textTransform: 'none',
                borderColor: 'var(--primary-main)',
                color: 'var(--primary-main)',
                '&:hover': { borderColor: 'var(--primary-main)', bgcolor: 'rgba(28,176,246,0.08)' },
              }}
            >
              Cheatsheet
            </Button>
          )}
          {activeSection?.title === 'C++' && (
            <Button
              variant="contained"
              startIcon={<TerminalIcon />}
              onClick={() => setCppPlaygroundOpen(true)}
              sx={{
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '0.8rem',
                textTransform: 'none',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4192 100%)',
                },
              }}
            >
              C++ Playground
            </Button>
          )}
          {activeSection?.title === 'OOP' && (
            <Button
              variant="contained"
              startIcon={<CodeIcon />}
              onClick={() => setJavaPlaygroundOpen(true)}
              sx={{
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '0.8rem',
                textTransform: 'none',
                background: 'linear-gradient(135deg, #FF9100 0%, #FF3D00 100%)',
                color: '#fff',
                '&:hover': {
                  background: 'linear-gradient(135deg, #E68300 0%, #E63600 100%)',
                },
              }}
            >
              Java Playground
            </Button>
          )}
        </Box>

        {!activeSection?.isUnlocked && (
          <Alert severity="warning" sx={{ mb: 4, borderRadius: 3 }}>
            Complete the previous section to unlock this path.
          </Alert>
        )}

        <Box className="path-visual-shell glass-panel-strong">
          <Box className="path-visual" style={{ height: `${pathHeight}px` }}>
            <svg width="300" height={pathHeight} className="path-svg" viewBox={`0 0 300 ${pathHeight}`}>
              <defs>
                <linearGradient id="pathGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={theme.palette.primary.main} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={theme.palette.primary.main} stopOpacity="0.05" />
                </linearGradient>
              </defs>
              <path
                d={generatePath()}
                fill="none"
                stroke="url(#pathGradient)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray="15 15"
              />
            </svg>

            {nodes.map((node, index) => (
              <React.Fragment key={node.id}>
                {node.isNewChapter && (
                  <Box style={{
                    position: 'absolute', left: '150px',
                    top: `${node.pos.y - (index === 0 ? (isMobileViewport ? 95 : 126) : (isMobileViewport ? 165 : 220))}px`,
                    transform: 'translateX(-50%)', zIndex: 5,
                    width: '1200px', display: 'flex',
                    flexDirection: 'column', alignItems: 'center',
                    pointerEvents: 'none', gap: isMobileViewport ? '16px' : '24px'
                  }}>
                    {index > 0 && (
                      <Box style={{ width: '100%', height: '0', borderTop: '3px dotted var(--text-secondary)', opacity: 0.4 }} />
                    )}
                    <Typography variant="h5" style={{
                      fontWeight: 900, color: 'var(--text-primary)',
                      background: 'var(--surface-glass)', 
                      padding: isMobileViewport ? '8px 24px' : '12px 32px',
                      borderRadius: '30px', border: '1px solid var(--divider)',
                      backdropFilter: 'blur(12px)', fontFamily: '"Outfit", sans-serif',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.1)', textAlign: 'center',
                      textTransform: 'uppercase', letterSpacing: '1.5px', 
                      fontSize: isMobileViewport ? '1rem' : '1.35rem'
                    }}>
                      {node.chapterName}
                    </Typography>
                  </Box>
                )}

                <Box id={`node-${node.id}`} className="path-node-shell" style={{
                  left: `${node.pos.x}px`, top: `${node.pos.y}px`,
                  transform: 'translate(-50%, -50%)'
                }} onClick={(e) => handleNodeClick(e, node)}>
                  <Box className="path-node-wrapper">
                    <Box className={`path-node path-node-${node.status}`}>
                      {getNodeIcon(node, isMobileViewport)}
                    </Box>

                    {node.status === 'completed' && (
                      <Box style={{
                        position: 'absolute', 
                        top: isMobileViewport ? '-2px' : '-4px', 
                        right: isMobileViewport ? '-2px' : '-4px',
                        width: isMobileViewport ? '18px' : '22px', 
                        height: isMobileViewport ? '18px' : '22px', 
                        borderRadius: '50%',
                        backgroundColor: '#fff', 
                        border: `${isMobileViewport ? 2 : 2.5}px solid #29c57b`,
                        display: 'grid', placeItems: 'center',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)', zIndex: 10
                      }}>
                        <CheckIcon style={{ color: '#29c57b', fontSize: isMobileViewport ? '10px' : '12px', fontWeight: 'bold' }} />
                      </Box>
                    )}

                    {node.status === 'completed' && node.isExercise && node.rawScore !== undefined && (
                      <Box style={{
                        position: 'absolute', 
                        bottom: isMobileViewport ? '-6px' : '-8px', 
                        left: '50%',
                        transform: 'translateX(-50%)', 
                        padding: isMobileViewport ? '1.5px 6px' : '2px 8px',
                        borderRadius: '10px',
                        backgroundColor: node.score < 50 ? '#ff4d4d' : node.score < 80 ? '#ff9900' : '#29c57b',
                        border: '1.5px solid #fff',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)', zIndex: 10
                      }}>
                        <Typography style={{
                          color: '#fff', fontWeight: 900,
                          fontSize: isMobileViewport ? '0.55rem' : '0.68rem', 
                          lineHeight: 1,
                          fontFamily: '"Nunito", sans-serif'
                        }}>
                          {node.score}%
                        </Typography>
                      </Box>
                    )}

                    <Typography className={`path-node-caption-title status-${node.status}`}>
                      {node.title}
                    </Typography>
                  </Box>
                </Box>
              </React.Fragment>
            ))}
          </Box>
        </Box>

        <Box className="path-footer glass-panel">
          <Box className="path-footer-content">
            <Typography variant="h4" className="path-footer-title">
              {activeSection?.isComplete ? "Section Completed!" : "Ready for the next challenge?"}
            </Typography>
            <div className="path-footer-copy">
              {activeSection?.isComplete
                ? `You've mastered all lessons in ${activeSection.title}.`
                : `Progress in this section: ${Math.round(activeSection?.progressPercent || 0)}%`}
            </div>
            {!activeSection?.isComplete && (
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForwardIcon />}
                className="path-footer-button"
                onClick={(e) => handleNodeClick(e, nextActiveNode)}
              >
                {nextActiveNode?.status === 'active' ? `Start ${nextActiveNode.title}` : "Continue Learning"}
              </Button>
            )}
            {activeSection?.isComplete && activeSectionIndex < sections.length - 1 && (
              <Button
                variant="contained"
                size="large"
                endIcon={<ChevronRightIcon />}
                className="path-footer-button"
                onClick={() => setActiveSectionIndex(prev => prev + 1)}
              >
                Next Section
              </Button>
            )}
          </Box>
        </Box>

        <Popover
          open={Boolean(anchorEl) && !isMobileViewport}
          anchorEl={anchorEl}
          onClose={handleClosePreview}
          anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
          transformOrigin={{ vertical: 'center', horizontal: 'left' }}
          PaperProps={{
            style: {
              borderRadius: '24px', padding: '24px', width: '320px',
              border: selectedNode?.status === 'completed'
                ? '2px solid rgba(88, 204, 2, 0.4)'
                : '1px solid var(--divider)',
              background: selectedNode?.status === 'completed'
                ? (theme.palette.mode === 'dark' ? 'rgba(31, 45, 31, 0.96)' : 'rgba(242, 251, 240, 0.96)')
                : 'var(--surface-glass)',
              boxShadow: 'var(--shadow-soft)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }
          }}
        >
          {renderPreviewContent()}
        </Popover>

        <Dialog
          open={openDialog && isMobileViewport}
          onClose={handleClosePreview}
          fullWidth
          maxWidth="xs"
          PaperProps={{
            style: {
              borderRadius: '24px', padding: '24px',
              border: selectedNode?.status === 'completed'
                ? '2px solid rgba(88, 204, 2, 0.4)'
                : '1px solid var(--divider)',
              background: selectedNode?.status === 'completed'
                ? (theme.palette.mode === 'dark' ? 'rgba(31, 45, 31, 0.96)' : 'rgba(242, 251, 240, 0.96)')
                : 'var(--surface-glass)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }
          }}
        >
          {renderPreviewContent()}
        </Dialog>
      </Container>

      {/* Playground Dialogs */}
      <CppPlaygroundDialog
        open={cppPlaygroundOpen}
        onClose={() => setCppPlaygroundOpen(false)}
      />
      <JavaOopUmlPlayground
        open={javaPlaygroundOpen}
        onClose={() => setJavaPlaygroundOpen(false)}
      />
    </Box>
  );
};

export default LearningPathPage;